import { onSupabase } from "@/lib/backend";

// Supabase Auth, for lib/auth (Supabase phase B decision 5, amendment 4): who the verified session says this is, the
// live re-check, sending and checking a code, and signing out. lib/auth reaches Supabase only through here. On the
// sample backend nothing here loads Supabase code: the reads say "nobody", and the calls only Supabase can answer
// throw, since lib/auth never makes them there (it asks signInMode() first).

/** Who a verified session is: the Auth user, the session's id (the JWT's session_id) and the address, lower case. */
export type SessionClaims = { userId: string; sessionId: string; email: string };

/** How sending a code went (phase B, Task 4's table). */
export type SendOutcome = "sent" | "too-soon" | "ip-rate" | "refused" | "failed";

/** How checking a code went: the account's id when it was right. */
export type VerifyOutcome = { ok: true; userId: string } | "wrong" | "failed" | "ip-rate";

const supabase = () => import("./supabase/auth-session");

function supabaseOnly(name: string): never {
  throw new Error(`${name}() runs on Supabase only`);
}

/**
 * Who the verified session says this is, or null: no cookie, a bad signature, an expired access token or an ended
 * session. Never refreshes (amendment 3): proxy.ts renews the session before pages render. Request-time.
 *
 * No React cache here (review fix 5): a cache with no argument would answer a Server Action or Route Handler that has
 * just signed in or out with the session from before. The twin reads the cookie on every call and checks each access
 * token once per render (React's cache, keyed by the token), so a render still checks once, and a changed session is
 * read afresh. A Route Handler that has just changed the session reads readClaims(), which never uses the cache.
 */
export async function currentClaims(): Promise<SessionClaims | null> {
  if (!onSupabase()) return null;
  return (await supabase()).currentClaims();
}

/** As currentClaims(), read afresh from the request's cookies each time (amendment 12): after verifyOtp or a sign-out. */
export async function readClaims(): Promise<SessionClaims | null> {
  if (!onSupabase()) return null;
  return (await supabase()).readClaims();
}

/** The session's user, re-checked with Supabase Auth (getUser), so a session ended elsewhere fails (spec 5). */
export async function liveUserId(): Promise<string | null> {
  if (!onSupabase()) return null;
  return (await supabase()).liveUserId();
}

/** Step 1: asks Supabase Auth to email a 6-digit code (a new address gets an Auth user, which the domain hook may refuse). */
export async function sendSignInCode(email: string): Promise<SendOutcome> {
  if (!onSupabase()) supabaseOnly("sendSignInCode");
  return (await supabase()).sendSignInCode(email);
}

/** Step 2: checks the code; when it's right, the vossie_auth cookie holds the new session. */
export async function verifySignInCode(email: string, code: string): Promise<VerifyOutcome> {
  if (!onSupabase()) supabaseOnly("verifySignInCode");
  return (await supabase()).verifySignInCode(email, code);
}

/** The demo sign-in (isDemoSignIn): straight into a seed account, no code; the vossie_auth cookie holds the session. */
export async function signInDemo(email: string): Promise<VerifyOutcome> {
  if (!onSupabase()) supabaseOnly("signInDemo");
  return (await supabase()).signInDemo(email);
}

/** Signs this browser out: signOut({ scope: "local" }), then every vossie_auth cookie cleared, whatever Supabase said. */
export async function signOutHere(): Promise<void> {
  if (!onSupabase()) supabaseOnly("signOutHere");
  return (await supabase()).signOutHere();
}

/** Clears every vossie_auth cookie without asking Supabase (account deletion, after the Auth user has gone). */
export async function clearAuthCookies(): Promise<void> {
  if (!onSupabase()) supabaseOnly("clearAuthCookies");
  return (await supabase()).clearAuthCookies();
}
