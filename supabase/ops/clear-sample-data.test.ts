import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// supabase/ops/clear-sample-data.sql (Supabase phase B decision 10, Task 10): Lama runs it in the live project's SQL
// editor, so it's checked here as text. Its effect was checked by running it on the local stack (counts in the plan's
// "Changes made during the build"); this keeps a table added later from being missed, and keeps the reference data.

const ROOT = process.cwd();
const script = readFileSync(join(ROOT, "supabase", "ops", "clear-sample-data.sql"), "utf8");
/** The statements, without comments, in order. */
const statements = script
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .map((statement) => statement.replace(/\s+/g, " ").trim())
  .filter(Boolean);
const deleted = statements.flatMap((statement) => statement.match(/^delete from ([a-z_]+\.[a-z_]+)/)?.[1] ?? []);

/** The reference data the live site needs from its first sign-in (step 3's campuses, and so on). */
const REFERENCE = ["public.campuses", "public.categories", "public.pickup_points", "private.policy_versions"];

/** Every table the migrations make in public. */
function publicTables(): string[] {
  const folder = join(ROOT, "supabase", "migrations");
  const names = new Set<string>();
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".sql"))) {
    for (const [, name] of readFileSync(join(folder, file), "utf8").matchAll(/create table (?:if not exists )?public\.([a-z_]+)/gi)) {
      names.add(`public.${name}`);
    }
  }
  return [...names].sort();
}

describe("clearing the sample data from the live project (phase B decision 10)", () => {
  it("is one transaction that ends in rollback as written, so pasting it as it is changes nothing", () => {
    expect(statements[0]).toBe("begin");
    expect(statements.at(-1)).toBe("rollback");
    expect(statements.filter((statement) => /^(begin|commit|rollback)$/.test(statement))).toEqual(["begin", "rollback"]);
  });

  it("empties every content table the migrations make, and keeps the reference data", () => {
    const content = publicTables().filter((table) => !REFERENCE.includes(table));
    expect(content.length).toBeGreaterThanOrEqual(25);
    for (const table of content) expect(deleted, table).toContain(table);
    for (const table of REFERENCE) expect(deleted, table).not.toContain(table);
  });

  it("removes every Auth user and sign-in in progress, and every domain but the live two", () => {
    expect(deleted).toEqual(expect.arrayContaining(["auth.users", "private.sign_in_attempts", "private.code_sends"]));
    expect(statements).toContain("delete from private.allowed_email_domains where domain not in ('vossie.net', 'eduvos.com')");
    // Profiles go before their Auth users, and the users last of the accounts' rows.
    expect(deleted.indexOf("public.profiles")).toBeLessThan(deleted.indexOf("auth.users"));
  });

  it("leaves Storage's files to the dashboard: deleting their rows by SQL would leave the files", () => {
    expect(deleted.filter((table) => table.startsWith("storage."))).toEqual([]);
    expect(script).toMatch(/empty the photos bucket in Storage/);
  });
});
