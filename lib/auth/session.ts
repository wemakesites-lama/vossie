import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getAccount, getViewerAccount } from "@/lib/data/accounts";
import { clearAuthCookies, currentClaims, liveUserId, signOutHere } from "@/lib/data/auth-session";
import { clearSessionFormStates } from "@/lib/data/form-states";
import { createSession, deleteSession, findSessionAccountId } from "@/lib/data/sessions";
import { signInHref } from "@/lib/next-path";
import type { Account } from "@/lib/types";
import { SESSION_TTL_MS, signInMode } from "./config";
import { deleteCookie, readCookieValue, SESSION_COOKIE, setPrivateCookie } from "./cookies";
import { hashToken, newToken } from "./secrets";

/**
 * This browser's session's key, or null when it has none. Request-time. In sample mode, the store's key (the session
 * cookie's hash); on Supabase, the verified session's id (the JWT's session_id), which form states are kept under.
 */
export async function getSessionKey(): Promise<string | null> {
  switch (signInMode()) {
    case "supabase":
      return (await currentClaims())?.sessionId ?? null;
    case "sample": {
      const token = await readCookieValue(SESSION_COOKIE);
      return token ? hashToken(token) : null;
    }
    default:
      // Sign-in off: nothing is hashed, so a missing key can't break signing out (stage K spec decision 14).
      return null;
  }
}

/**
 * Who is signed in (accounts spec 2.9): the account, or null. The server trusts only the httpOnly session cookie,
 * looked up by its hash in the store; no other cookie says anything about who you are (plan decision 1).
 *
 * On Supabase (phase B decision 7), the verified session's claims, then the profile, read on every request: roles come
 * from the profile each time and nothing cached reads them (spec 4.3). A session with no profile (a student between
 * steps 2 and 3) is signed out.
 *
 * Request-time: call it inside <Suspense>. React's cache() makes it one lookup per render. A Server Action or route
 * handler calls it too; there it simply runs.
 */
export const getViewer = cache(async (): Promise<Account | null> => {
  const mode = signInMode();
  if (mode === "supabase") {
    const claims = await currentClaims();
    return claims ? getViewerAccount(claims) : null;
  }
  if (mode !== "sample") return null;
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
 * As requireAccount, re-checked with Supabase Auth (getUser), so a session ended elsewhere can't act even while its
 * access token's hour runs: for account deletion and staff actions (spec 5). Sample mode has nothing more to check.
 */
export async function requireLiveAccount(nextPath: string): Promise<Account> {
  const account = await requireAccount(nextPath);
  if (signInMode() === "supabase" && (await liveUserId()) !== account.id) redirect(signInHref(nextPath));
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

/**
 * Signs this browser out (spec 2.5): the stored session and the cookie both go. Server Actions and Route Handlers only.
 * On Supabase: this session's form states, then signOut({ scope: "local" }) and the vossie_auth cookie, which is
 * cleared even when Supabase can't be reached.
 */
export async function endSession(): Promise<void> {
  if (signInMode() === "supabase") {
    const sessionId = await getSessionKey();
    if (sessionId) await clearSessionFormStates(sessionId).catch(() => {});
    try {
      await signOutHere();
    } catch {
      await clearAuthCookies().catch(() => {});
    }
    return;
  }
  const key = await getSessionKey();
  if (key) await deleteSession(key);
  await deleteCookie(SESSION_COOKIE);
}

/**
 * Signs this browser out after its account was deleted (accounts spec 2.13): the account and its sessions have gone
 * already, so only the cookie is left. Sample mode deletes vossie_session; Supabase clears every vossie_auth cookie
 * without asking Supabase, whose Auth user has gone. Route Handlers only.
 */
export async function endSessionAfterDeletion(): Promise<void> {
  if (signInMode() === "supabase") await clearAuthCookies();
  else await deleteCookie(SESSION_COOKIE);
}
