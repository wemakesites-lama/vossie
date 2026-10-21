import { execFileSync, spawnSync } from "node:child_process";
import { expect, type BrowserContext, type Page } from "@playwright/test";

// The local stack, for the end-to-end sign-in specs on Supabase (phase B, Task 11). Local only: the addresses and keys
// come from `supabase status` at run time and are never printed or written down. SQL runs as postgres inside the local
// database's container (psql isn't installed on the host), with values passed as psql variables, never pasted into the
// SQL. These helpers don't import Supabase's packages: only lib/data, lib/supabase and tests/db may (boundaries rule 4).

/** The local stack's settings from `supabase status -o env` (CLI 2.118: API_URL, MAILPIT_URL, …). */
export function localStack(): Record<string, string> {
  const output = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  );
}

/** The local database's container: supabase_db_ and config.toml's project_id. */
const DB_CONTAINER = "supabase_db_vossie";

/** Runs `query` as postgres on the local database, with `vars` as psql variables (:'name'). Rows as lines, columns by |. */
export function sql(query: string, vars: Record<string, string> = {}): string[] {
  const args = ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"];
  for (const [name, value] of Object.entries(vars)) args.push("-v", `${name}=${value}`);
  const output = execFileSync("docker", args, { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  return output.split("\n").filter((line) => line !== "");
}

/** How many requests to `path` (such as "/verify") local Auth has answered since `since`, from its container's log. */
export function authRequests(path: string, since: Date): number {
  const logs = spawnSync("docker", ["logs", "--since", since.toISOString(), "supabase_auth_vossie"], { encoding: "utf8" });
  return `${logs.stdout}\n${logs.stderr}`
    .split("\n")
    .filter((line) => line.includes('"msg":"request completed"') && line.includes(`"path":"${path}"`)).length;
}

/** A new address for each test, on the local seed's own domain. */
export function newAddress(project: string): string {
  return `e2e-${project}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@vossie.test`;
}

/** Deletes the accounts the specs made, as the app would (forget_account), then their Auth users. */
export function removeE2eAccounts(project: string): void {
  sql(
    `select public.forget_account(u.id) from auth.users u where u.email like 'e2e-' || :'project' || '-%@vossie.test';
     delete from auth.users where email like 'e2e-' || :'project' || '-%@vossie.test';`,
    { project },
  );
}

/** The Auth user's id for an address, or null. */
export function authUserId(email: string): string | null {
  return sql(`select id from auth.users where email = :'email'`, { email })[0] ?? null;
}

/** The newest 6-digit code emailed to `address` after `after`, from Mailpit (polled every 250 ms for up to 10 s). */
export async function latestCode(address: string, after: Date): Promise<string> {
  const mailpit = localStack().MAILPIT_URL;
  const until = Date.now() + 10_000;
  while (Date.now() < until) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string; Created: string }[] };
    const newest = messages
      .filter((message) => Date.parse(message.Created) >= after.getTime() - 1_000)
      .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created))[0];
    if (newest) {
      const message = (await (await fetch(`${mailpit}/api/v1/message/${newest.ID}`)).json()) as { Subject: string; Text: string };
      expect(message.Subject).toBe("Your Vossie sign-in code");
      const codes = message.Text.match(/\b\d{6}\b/g) ?? [];
      expect(codes).toHaveLength(1);
      return codes[0]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No code reached ${address}`);
}

/** How many messages Mailpit holds for `address`. */
export async function messagesTo(address: string): Promise<number> {
  const search = await fetch(`${localStack().MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  return ((await search.json()) as { messages: unknown[] }).messages.length;
}

/** A code that isn't `code`. */
export const otherThan = (code: string) => (code === "111111" ? "222222" : "111111");

/** The session the vossie_auth cookie holds (its chunks joined, the base64url decoded), as @supabase/ssr stores it. */
export async function storedSession(context: BrowserContext): Promise<Record<string, unknown> | null> {
  const cookies = (await context.cookies()).filter((cookie) => /^vossie_auth(\.\d+)?$/.test(cookie.name));
  if (cookies.length === 0) return null;
  const whole = cookies.find((cookie) => cookie.name === "vossie_auth");
  const value = whole
    ? whole.value
    : cookies
        .sort((a, b) => Number(a.name.split(".")[1]) - Number(b.name.split(".")[1]))
        .map((cookie) => cookie.value)
        .join("");
  return JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64url").toString("utf8"));
}

/** Puts the session back in one vossie_auth cookie with its access token marked expired, so the next page must renew it. */
export async function expireStoredSession(page: Page): Promise<void> {
  const context = page.context();
  const session = await storedSession(context);
  expect(session).not.toBeNull();
  const old = (await context.cookies()).filter((cookie) => /^vossie_auth(\.\d+)?$/.test(cookie.name));
  await context.clearCookies({ name: /^vossie_auth(\.\d+)?$/ });
  const value = `base64-${Buffer.from(JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) - 3_600 })).toString("base64url")}`;
  await context.addCookies([{ ...old[0], name: "vossie_auth", value }]);
}
