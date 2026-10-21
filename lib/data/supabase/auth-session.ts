import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { authClient, clearHere } from "@/lib/supabase/auth";
import { accessTokenFrom } from "@/lib/supabase/cookies";
import type { SendOutcome, SessionClaims, VerifyOutcome } from "../auth-session";
import { forPublic } from "./clients";

// Supabase Auth's side of lib/data/auth-session.ts (phase B, Task 4; amendments 3, 4, 5 and 12). Loaded only through
// that façade's import(), on Supabase.
//
// Reading the session never refreshes it (amendment 3): the access token stored in the vossie_auth cookie is checked
// with getClaims(token), which verifies its signature and expiry (against the project's keys, or with Auth for a
// symmetric key) and refreshes nothing. An expired token is signed out for that request; proxy.ts renews the session
// before pages render. Refusals are mapped from Auth's code and status, never its message (amendment 5 reads it only to
// classify, in lib/supabase/auth.ts).

/** A verified session, with the access token the viewer's client sends (forViewer, clients.ts). Server only. */
export type VerifiedSession = SessionClaims & { accessToken: string };

/**
 * The stored session's access token, read from the request's cookies as they are now (a write earlier included). With
 * a token, it waits for the request first: checking it reads the clock (the token's exp against Date.now()), which Next
 * refuses while it prerenders a page (phase B Task 6's spike), as the sample path's getViewer does. No cookie, no wait.
 */
async function storedAccessToken(): Promise<string | null> {
  const store = await cookies();
  const token = await accessTokenFrom((name) => store.get(name)?.value);
  if (token) await connection();
  return token;
}

const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

/** The token checked with Supabase Auth's keys, or null. Never throws: anything wrong is "signed out". */
async function verify(accessToken: string): Promise<VerifiedSession | null> {
  try {
    const { data, error } = await forPublic().auth.getClaims(accessToken);
    if (error || !data) return null;
    const { sub, session_id: sessionId, email } = data.claims as Record<string, unknown>;
    if (!isText(sub) || !isText(sessionId) || !isText(email)) return null;
    return { userId: sub, sessionId, email: email.toLowerCase(), accessToken };
  } catch {
    return null;
  }
}

/** One check per token per render. Keyed by the token, so a session changed mid-request is never answered from before. */
const verifyOnce = cache(verify);

const claimsOf = ({ userId, sessionId, email }: VerifiedSession): SessionClaims => ({ userId, sessionId, email });

/** The verified session with its access token, or null. The cookie is read each time; the check once per token. */
export async function viewerSession(): Promise<VerifiedSession | null> {
  const token = await storedAccessToken();
  return token ? verifyOnce(token) : null;
}

export async function currentClaims(): Promise<SessionClaims | null> {
  const session = await viewerSession();
  return session && claimsOf(session);
}

/** Checked afresh, not from React's cache (amendment 12): for a Route Handler that has just signed in or out. */
export async function readClaims(): Promise<SessionClaims | null> {
  const token = await storedAccessToken();
  const session = token ? await verify(token) : null;
  return session && claimsOf(session);
}

/**
 * The session's user as Supabase Auth sees it now (getUser with the stored token): null when the session was ended
 * elsewhere, or the user deleted, even while the access token's hour runs. No refresh: the proxy renewed it before.
 */
export async function liveUserId(): Promise<string | null> {
  const token = await storedAccessToken();
  if (!token) return null;
  try {
    const { data, error } = await forPublic().auth.getUser(token);
    return !error && isText(data.user?.id) ? data.user.id : null;
  } catch {
    return null;
  }
}

export async function sendSignInCode(email: string): Promise<SendOutcome> {
  const sent = await (await authClient()).sendSignInCode(email);
  if (sent.ok) return "sent";
  // The per-address minute between codes only; the project's hourly email cap is a failure (amendment 5).
  if (sent.tooSoon) return "too-soon";
  if (sent.code === "over_request_rate_limit") return "ip-rate";
  // The before_user_created hook's refusal is a 403 (its code isn't set), as is Auth's own for an address it won't mail.
  if (sent.status === 403 || sent.code === "email_address_not_authorized") return "refused";
  return "failed";
}

export async function verifySignInCode(email: string, code: string): Promise<VerifyOutcome> {
  const verified = await (await authClient()).verifySignInCode(email, code);
  if (verified.ok) return { ok: true, userId: verified.userId };
  // Auth answers otp_expired for a wrong code and an expired one alike.
  if (verified.code === "otp_expired") return "wrong";
  if (verified.code === "over_request_rate_limit") return "ip-rate";
  return "failed";
}

export async function signOutHere(): Promise<void> {
  try {
    await (await authClient()).signOutHere();
  } catch {
    // Supabase unreachable: this browser is still signed out below. The session runs out with its access token's
    // hour and is swept after 30 idle days (sweep_idle_sessions).
  } finally {
    await clearHere();
  }
}

export async function clearAuthCookies(): Promise<void> {
  await clearHere();
}
