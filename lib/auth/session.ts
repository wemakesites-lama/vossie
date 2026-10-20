import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getAccount } from "@/lib/data/accounts";
import { createSession, deleteSession, findSessionAccountId } from "@/lib/data/sessions";
import { signInHref } from "@/lib/next-path";
import type { Account } from "@/lib/types";
import { isSampleMode, SESSION_TTL_MS } from "./config";
import { deleteCookie, readCookieValue, SESSION_COOKIE, setPrivateCookie } from "./cookies";
import { hashToken, newToken } from "./secrets";

/** The store's key for this browser's session, or null when it has no session cookie. Request-time. */
export async function getSessionKey(): Promise<string | null> {
  // Sample mode off: nothing is hashed, so a missing key can't break signing out (stage K spec decision 14).
  if (!isSampleMode()) return null;
  const token = await readCookieValue(SESSION_COOKIE);
  return token ? hashToken(token) : null;
}

/**
 * Who is signed in (accounts spec 2.9): the account, or null. The server trusts only the httpOnly session cookie,
 * looked up by its hash in the store; no other cookie says anything about who you are (plan decision 1).
 *
 * Request-time: call it inside <Suspense>. React's cache() makes it one lookup per render. A Server Action or route
 * handler calls it too; there it simply runs.
 */
export const getViewer = cache(async (): Promise<Account | null> => {
  if (!isSampleMode()) return null;
  const key = await getSessionKey();
  if (!key) return null;
  // The expiry check reads the clock, which Next allows once the render waits for the request (decision 26).
  await connection();
  const accountId = await findSessionAccountId(key, new Date());
  return accountId ? getAccount(accountId) : null;
});

/** The signed-in account, or a redirect to sign-in that comes back to `nextPath` (spec 2.10). Inside <Suspense>. */
export async function requireAccount(nextPath: string): Promise<Account> {
  const account = await getViewer();
  if (!account) redirect(signInHref(nextPath));
  return account;
}

/**
 * Signs this browser in as `accountId` (spec 2.5): a new random token in the cookie, its hash in the store, 30 days.
 * The browser's old session, if any, goes first, so a session id is never reused. Server Actions only.
 */
export async function startSession(accountId: string, now: Date): Promise<void> {
  const oldKey = await getSessionKey();
  if (oldKey) await deleteSession(oldKey);
  const token = newToken();
  await createSession({
    key: hashToken(token),
    accountId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  await setPrivateCookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000);
}

/** Signs this browser out (spec 2.5): the stored session and the cookie both go. Server Actions only. */
export async function endSession(): Promise<void> {
  const key = await getSessionKey();
  if (key) await deleteSession(key);
  await deleteCookie(SESSION_COOKIE);
}
