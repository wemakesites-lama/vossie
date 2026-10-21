import { execFileSync } from "node:child_process";

// SQL as postgres on the local stack's database, for what no API role may write: storage.objects' times, so a test can
// make an orphan file an hour or more old (C2/C3 plan Tasks 5 and 7). psql isn't installed on the host, so it runs
// inside the database's container, as tests/e2e-supabase/helpers/local.ts does. Values go in as psql variables
// (:'name'), never pasted into the SQL. Local only.

/** The local database's container: supabase_db_ and config.toml's project_id. */
const DB_CONTAINER = "supabase_db_vossie";

/** Runs `query` as postgres, with `vars` as psql variables. Rows as lines, columns by |. */
export function sql(query: string, vars: Record<string, string> = {}): string[] {
  const args = ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"];
  for (const [name, value] of Object.entries(vars)) args.push("-v", `${name}=${value}`);
  const output = execFileSync("docker", args, { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  return output.split("\n").filter((line) => line !== "");
}
