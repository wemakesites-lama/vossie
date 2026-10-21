import "server-only";
import type * as Sample from "../sessions";
import { forServer } from "./clients";
import { iso } from "./rows";

// Sessions on Supabase (phase B, Task 4; amendment 10). Supabase Auth keeps them, in auth.sessions; the data download
// lists an account's through account_sessions (when each started and when it ends), never a session id: `key` is "".

const AUTH_KEEPS_THEM = "Supabase Auth keeps sessions";

export const listSessions: typeof Sample.listSessions = async (accountId) => {
  const { data, error } = await forServer().rpc("account_sessions", { p_account: accountId });
  if (error) throw new Error(`account_sessions failed (${error.code ?? "unknown"})`);
  return (data ?? []).map((row) => ({
    key: "",
    accountId,
    createdAt: iso(row.signed_in_at),
    expiresAt: iso(row.expires_at),
  }));
};

export const createSession: typeof Sample.createSession = async () => {
  throw new Error(AUTH_KEEPS_THEM);
};

export const findSessionAccountId: typeof Sample.findSessionAccountId = async () => {
  throw new Error(AUTH_KEEPS_THEM);
};

export const deleteSession: typeof Sample.deleteSession = async () => {
  throw new Error(AUTH_KEEPS_THEM);
};
