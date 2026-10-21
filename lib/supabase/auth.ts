import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type AuthError } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { authCookieOptions, isAuthCookie, requestCookies } from "./cookies";
import type { Database } from "./database.types";
import { secretKey, supabaseUrl } from "./env";

/**
 * Why Supabase Auth refused, without its message: Auth's error code (such as "otp_expired") and HTTP status.
 * `tooSoon` marks the one refusal whose code says too little: over_email_send_rate_limit is both the per-address minute
 * between codes and the project's hourly email cap, and only the first is "wait a minute" (phase B amendment 5).
 */
export type AuthRefusal = { ok: false; code: string; status: number; tooSoon?: true };

/** Auth's words for the per-address minute (validateSentWithinFrequencyLimit), read only to tell the two apart. */
const PER_ADDRESS_MINUTE = /^For security purposes/;

export type SendResult = { ok: true } | AuthRefusal;
export type VerifyResult = { ok: true; userId: string } | AuthRefusal;
export type SignOutResult = { ok: true } | AuthRefusal;

/**
 * The sign-in client (backend spec decision 5): the three calls the sign-in Server Actions make, and nothing else. No
 * `.auth` (whose `.admin` would hand out the secret key's powers), no `.from`, `.rpc` or `.storage`: data never goes
 * through it, so it can't compile.
 */
export type AuthClient = {
  /** Step 1: emails a 6-digit code (a new address gets an account, which the domain hook may refuse). */
  sendSignInCode(email: string): Promise<SendResult>;
  /** Step 2: checks the code and, when it's right, sets the vossie_auth session cookie. */
  verifySignInCode(email: string, token: string): Promise<VerifyResult>;
  /** Sign out: ends this browser's session only (spec 5) and clears its cookie. */
  signOutHere(): Promise<SignOutResult>;
};

function refusal(error: AuthError): AuthRefusal {
  const code = error.code ?? "unknown";
  const status = error.status ?? 500;
  // The message is read to classify, never passed on or logged.
  if (code === "over_email_send_rate_limit" && PER_ADDRESS_MINUTE.test(error.message ?? "")) {
    return { ok: false, code, status, tooSoon: true };
  }
  return { ok: false, code, status };
}

/** The student's address, from Vercel's x-real-ip (a visitor can't set it), for Supabase's per-address limits. */
async function forwardedFor(): Promise<Record<string, string>> {
  const address = (await headers()).get("x-real-ip")?.trim();
  return address ? { "Sb-Forwarded-For": address } : {};
}

/**
 * The sign-in client, for the sign-in Server Actions only. Every call uses the secret key and the student's address
 * in Sb-Forwarded-For, which Supabase trusts only with a secret key, so its per-address limits count each student
 * rather than all of Vercel. Never for data: the secret key bypasses every access rule.
 *
 * - Sending a code goes through a client with no cookies, on the implicit flow: @supabase/ssr's cookie client always
 *   uses PKCE, and its signInWithOtp would set three vossie_auth-…-code-verifier cookies lasting 400 days (found in
 *   phase A). The emailed code needs no verifier.
 * - Checking the code and signing out go through the request's cookies, so the session lands in (or leaves) the
 *   vossie_auth cookie.
 */
export async function authClient(): Promise<AuthClient> {
  const global = { headers: await forwardedFor() };
  const cookieClient = async () =>
    createServerClient<Database>(supabaseUrl(), secretKey(), {
      cookieOptions: await authCookieOptions(),
      cookies: await requestCookies(),
      global,
    });

  return {
    async sendSignInCode(email) {
      const client = createClient<Database>(supabaseUrl(), secretKey(), {
        auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global,
      });
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      return error ? refusal(error) : { ok: true };
    },
    async verifySignInCode(email, token) {
      const { data, error } = await (await cookieClient()).auth.verifyOtp({ email, token, type: "email" });
      if (error) return refusal(error);
      if (!data.user) return { ok: false, code: "no_user", status: 500 };
      return { ok: true, userId: data.user.id };
    },
    async signOutHere() {
      const { error } = await (await cookieClient()).auth.signOut({ scope: "local" });
      return error ? refusal(error) : { ok: true };
    },
  };
}

/**
 * Deletes this browser's session cookie, every chunk of it, without asking Supabase (sign-out's last step, whatever
 * Supabase answered, and account deletion's). Only vossie_auth and vossie_auth.N: nothing else. Server Actions and
 * Route Handlers only.
 */
export async function clearHere(): Promise<void> {
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (isAuthCookie(name)) store.delete(name);
  }
}
