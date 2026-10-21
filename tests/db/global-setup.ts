import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { ensureAccount, mintSession, removeAccounts, testAdminClient, WORLD_ACCOUNTS, type DbSessions } from "./accounts";

// `pnpm test:db`'s global setup (2b plan decision 19, Task 13). Runs once in Vitest's main process, before the test
// processes start:
// 1. reads the local stack's address and keys from `supabase status`, and puts them in process.env with
//    VOSSIE_BACKEND=supabase, so every test process is born with them (as vitest.global-setup.ts sets TZ);
// 2. makes (or reuses) the test accounts, with profiles, and mints each one session, which the test files get with
//    inject("dbSessions");
// 3. afterwards, deletes the accounts.
// It never prints a key or a token.

const STACK_DOWN = "Start the local stack (supabase start) and reset it (supabase db reset) first";

type Status = { API_URL?: string; PUBLISHABLE_KEY?: string; SECRET_KEY?: string };

function stackStatus(): Status {
  let output: string;
  try {
    output = execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error(STACK_DOWN);
  }
  try {
    return JSON.parse(output) as Status;
  } catch {
    throw new Error(STACK_DOWN);
  }
}

export default async function setup({ provide }: TestProject) {
  const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = stackStatus();
  if (!API_URL || !PUBLISHABLE_KEY || !SECRET_KEY) throw new Error(STACK_DOWN);
  process.env.VOSSIE_BACKEND = "supabase";
  process.env.SUPABASE_URL = API_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
  process.env.SUPABASE_SECRET_KEY = SECRET_KEY;

  const admin = testAdminClient();
  const ids: string[] = [];
  const sessions = {} as DbSessions;
  try {
    for (const name of WORLD_ACCOUNTS) {
      const id = await ensureAccount(admin, name);
      ids.push(id);
      sessions[name] = { id, accessToken: await mintSession(admin, name) };
    }
  } catch (error) {
    await removeAccounts(admin, ids).catch(() => {});
    throw error;
  }
  provide("dbSessions", sessions);

  return async () => {
    await removeAccounts(admin, ids);
  };
}
