import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// supabase/ops/clear-sample-data.sql run against the local stack (Supabase phase B, review fix 3), as postgres, the role
// the dashboard's SQL editor uses: the dry run as written changes nothing and says so with the counts; the real run
// (dry_run := false) clears the samples and keeps the reference data; the guard refuses once a profile belongs to an
// address outside @vossie.test. The real run's own `commit;` is swapped for its checks and a rollback, so the local
// stack keeps its seed for the other db tests and no reset is needed.

const script = readFileSync(join(process.cwd(), "supabase", "ops", "clear-sample-data.sql"), "utf8");
const DRY_RUN_LINE = "dry_run boolean := true;";

/** The local database's container (supabase_db_ and config.toml's project_id), as the e2e helpers use it. */
const DB_CONTAINER = "supabase_db_vossie";

type Run = { status: number | null; stdout: string; stderr: string };

/** Runs `sql` with psql as postgres in the local database's container, stopping at the first error. */
function psql(sql: string): Run {
  const run = spawnSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** One row of counts, in a fixed order, to compare before and after. */
const COUNTS = `select concat_ws('|',
  (select count(*) from auth.users), (select count(*) from public.profiles), (select count(*) from public.shops),
  (select count(*) from public.listings), (select count(*) from public.requests), (select count(*) from public.campuses),
  (select count(*) from public.categories), (select count(*) from public.pickup_points),
  (select count(*) from private.policy_versions),
  (select string_agg(domain, ', ' order by domain) from private.allowed_email_domains));`;

function counts(): string {
  const run = psql(COUNTS);
  expect(run.status, run.stderr).toBe(0);
  return run.stdout.trim();
}

/** The script as it would be for the real run: only the dry-run line changed. */
function realRun(): string {
  expect(script).toContain(DRY_RUN_LINE);
  return script.replace(/^(\s*)dry_run boolean := true;$/m, "$1dry_run boolean := false;");
}

/** Swaps the script's last line, `commit;`, for `tail` (checks, then a rollback). */
function withoutCommit(sql: string, tail: string): string {
  expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  return `${sql.trimEnd().slice(0, -"commit;".length)}${tail}`;
}

describe("clearing the sample data, run on the local stack (review fix 3)", () => {
  it("as written, is a dry run: it reports the counts in its error and changes nothing", () => {
    const before = counts();
    const [users, , shops] = before.split("|");
    expect(Number(shops)).toBeGreaterThan(0);
    const run = psql(script);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/ERROR: {2}dry run: nothing changed\./);
    expect(run.stderr).toContain(`before: users ${users}, profiles`);
    expect(run.stderr).toMatch(/after: users 0, profiles 0, shops 0, listings 0, requests 0, hub posts 0, campuses 13, categories 10, pickup points 24, policy versions \d+, domains eduvos\.com, vossie\.net, files \d+/);
    expect(counts()).toBe(before);
  });

  it("for real (dry_run := false), clears every account and its content, and keeps the reference data and the live domains", () => {
    const before = counts().split("|");
    const run = psql(withoutCommit(realRun(), `${COUNTS}\nrollback;\n`));
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).not.toMatch(/ERROR/);
    expect(run.stderr).toMatch(/NOTICE: {2}cleared: users 0, profiles 0, shops 0/);
    // psql prints each command's tag too (DO, ROLLBACK): the counts are the one line with columns.
    const after = run.stdout.split("\n").filter((line) => line.includes("|")).at(-1)!.split("|");
    // users, profiles, shops, listings, requests gone; campuses, categories, pickup points and policy versions kept.
    expect(after.slice(0, 5)).toEqual(["0", "0", "0", "0", "0"]);
    expect(after.slice(5, 9)).toEqual(before.slice(5, 9));
    expect(after.slice(5, 8)).toEqual(["13", "10", "24"]);
    expect(after[9]).toBe("eduvos.com, vossie.net");
    // The checks ran inside the script's transaction, then rolled back: the seed is as it was.
    expect(counts()).toBe(before.join("|"));
  });

  it("refuses, before it clears anything, once a profile belongs to an address outside @vossie.test, even for real", () => {
    const before = counts();
    const student = `insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000c1ea', 'eduv7654321@vossie.net');
insert into public.profiles (id, first_name, campus_slug) values ('00000000-0000-4000-8000-00000000c1ea', 'Real', 'pretoria');
`;
    for (const sql of [script, realRun()]) {
      const run = psql(sql.replace(/^begin;$/m, `begin;\n${student}`));
      expect(run.status).not.toBe(0);
      expect(run.stderr).toMatch(/ERROR: {2}refused: 1 profile belongs to an address outside @vossie\.test/);
      expect(run.stderr).not.toMatch(/dry run:|NOTICE/);
    }
    expect(counts()).toBe(before);
  });

  it("isn't stopped by an Auth user with no profile, such as the delivery test's (runbook A7)", () => {
    const users = Number(counts().split("|")[0]);
    const run = psql(script.replace(/^begin;$/m, "begin;\ninsert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000c1eb', 'eduv7654321@vossie.net');\n"));
    expect(run.stderr).toMatch(/ERROR: {2}dry run: nothing changed\./);
    expect(run.stderr).toContain(`before: users ${users + 1},`);
  });
});
