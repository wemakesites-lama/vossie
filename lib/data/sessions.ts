import type { SessionRow } from "./rows";
import { sampleStore } from "./store";

// Sessions (accounts spec 2.5). The key is the SHA-256 of the cookie's token (lib/auth/session.ts makes both), so the
// store never holds a token. Supabase Auth replaces this table.

export async function createSession(session: {
  key: string;
  accountId: string;
  createdAt: Date;
  expiresAt: Date;
}): Promise<void> {
  const { sessions } = sampleStore();
  // Tidy away sessions that have run out, so the table can't grow for ever.
  for (const [key, row] of sessions) {
    if (Date.parse(row.expiresAt) <= session.createdAt.getTime()) sessions.delete(key);
  }
  sessions.set(session.key, {
    key: session.key,
    accountId: session.accountId,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  });
}

/** The account a session belongs to, while it hasn't run out. */
export async function findSessionAccountId(key: string, now: Date): Promise<string | null> {
  const row = sampleStore().sessions.get(key);
  return row && Date.parse(row.expiresAt) > now.getTime() ? row.accountId : null;
}

/** An account's sessions, oldest first, for the data export (spec 3.3). */
export async function listSessions(accountId: string): Promise<SessionRow[]> {
  return [...sampleStore().sessions.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((row) => ({ ...row }));
}

/** Signs one browser out (spec 2.5): its session goes, and so does its forms' state. */
export async function deleteSession(key: string): Promise<void> {
  const store = sampleStore();
  store.sessions.delete(key);
  for (const [stateKey, row] of store.formStates) {
    if (row.sessionKey === key) store.formStates.delete(stateKey);
  }
}
