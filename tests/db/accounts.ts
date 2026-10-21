import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { WORLD_ACCOUNTS, type WorldAccountName } from "@/tests/contract/world";

// The database tests' accounts (2b plan decision 19, Task 13). `pnpm test:db`'s global setup makes them on the local
// stack, mints each a real session once per run, and deletes them afterwards. Keys and tokens are never printed or
// written down: they come from `supabase status` at run time and live only in the test processes.

/** One test account's session, handed to the test files with Vitest's provide/inject. */
export type DbSession = { id: string; accessToken: string };
export type DbSessions = Record<WorldAccountName, DbSession>;

declare module "vitest" {
  export interface ProvidedContext {
    dbSessions: DbSessions;
  }
}

export type DbClient = ReturnType<typeof createClient<Database>>;

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/** The local stack's settings, which the global setup puts in process.env before the test processes start. */
export function dbEnv(): { url: string; publishable: string; secret: string } {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secret } = process.env;
  if (!url || !publishable || !secret) throw new Error("Run the database tests with `pnpm test:db`, which reads the local stack's settings");
  return { url, publishable, secret };
}

/** The secret key's client, for the tests' own setup and undo: it bypasses every access rule. */
export function testAdminClient(): DbClient {
  const { url, secret } = dbEnv();
  return createClient<Database>(url, secret, { auth: NO_SESSION });
}

export const contractEmail = (name: WorldAccountName) => `contract-${name}@vossie.test`;

const firstName = (name: WorldAccountName) => name[0].toUpperCase() + name.slice(1);

function fail(what: string, error: { code?: string; message?: string } | null): never {
  throw new Error(`${what}: ${error?.code ?? ""} ${error?.message ?? ""}`.trim());
}

/** The Auth user for `email`: made, or found when an earlier run left it behind. */
async function authUserId(admin: DbClient, email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  if (created.error?.code !== "email_exists") fail(`Making ${email}`, created.error);
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) fail(`Finding ${email}`, error);
    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length < 1_000) fail(`Finding ${email}`, { message: "not found" });
  }
}

/** Makes (or reuses) the account and its profile on Pretoria; "staff" holds the Admin role. */
export async function ensureAccount(admin: DbClient, name: WorldAccountName): Promise<string> {
  const id = await authUserId(admin, contractEmail(name));
  const { error } = await admin.from("profiles").upsert({
    id,
    first_name: firstName(name),
    campus_slug: "pretoria",
    roles: name === "staff" ? ["admin"] : [],
  });
  if (error) fail(`Making ${name}'s profile`, error);
  return id;
}

/**
 * A real session for the account, without an email: Auth's admin API makes a sign-in code (generateLink), and a
 * cookieless publishable client checks it (verifyOtp, as an email code), so the custom access token hook sees an
 * "otp" sign-in, as for a student. A fresh client for each, since verifyOtp keeps the session it gets in the client.
 * Auth allows 30 verifications per 5 minutes (config.toml), so the global setup mints once per run.
 */
export async function mintSession(admin: DbClient, name: WorldAccountName): Promise<string> {
  const email = contractEmail(name);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) fail(`A code for ${name}`, link.error);
  const { url, publishable } = dbEnv();
  const signIn = createClient<Database>(url, publishable, { auth: NO_SESSION });
  const { data, error } = await signIn.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  if (error || !data.session) fail(`Signing ${name} in`, error);
  return data.session.access_token;
}

/** Deletes the account as the app would (forget_account), then its Auth user. Every account is tried; errors throw after. */
export async function removeAccounts(admin: DbClient, ids: readonly string[]): Promise<void> {
  const errors: string[] = [];
  for (const id of ids) {
    const forgotten = await admin.rpc("forget_account", { p_account_id: id });
    if (forgotten.error) errors.push(`forget_account: ${forgotten.error.message}`);
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) errors.push(`deleteUser: ${deleted.error.message}`);
  }
  if (errors.length > 0) throw new Error(`Removing the test accounts: ${errors.join("; ")}`);
}

export { WORLD_ACCOUNTS };
