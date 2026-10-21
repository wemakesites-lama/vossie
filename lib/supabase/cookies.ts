import "server-only";
import { combineChunks, stringFromBase64URL, type CookieMethodsServer, type CookieOptions, type CookieOptionsWithName } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_TTL_MS } from "@/lib/auth/config";
import { AUTH_COOKIE } from "@/lib/auth/cookie-names";
import { isHttps } from "@/lib/auth/cookies";

// The session cookies the viewer and auth clients share (backend spec section 5). Request-time: call inside <Suspense>
// or a Server Action.

export { AUTH_COOKIE, isAuthCookie } from "@/lib/auth/cookie-names";

/** The cookie's lifetime in seconds: 30 days from its last renewal (Supabase phase B decision 3). */
export const SESSION_MAX_AGE = SESSION_TTL_MS / 1000;

/**
 * httpOnly (the browser's JavaScript never reads it), Lax, the whole site, and Secure on HTTPS (as lib/auth/cookies.ts).
 * The maxAge is here for the record only: @supabase/ssr 0.12.7 ignores cookieOptions.maxAge and writes its own 400 days
 * (cookies.js:228-231 and :466-471), so the setAll callbacks apply the 30 days with sessionLifetime() (amendment 1).
 */
export async function authCookieOptions(): Promise<CookieOptionsWithName> {
  return { name: AUTH_COOKIE, httpOnly: true, sameSite: "lax", secure: await isHttps(), path: "/", maxAge: SESSION_MAX_AGE };
}

/**
 * The options a session cookie is written with: Supabase's own, with 30 days in place of its 400 (amendment 1). A
 * removal (maxAge 0) stays a removal. Every setAll that writes vossie_auth goes through this.
 */
export function sessionLifetime<Options extends CookieOptions>(options: Options): Options {
  return { ...options, maxAge: options.maxAge === 0 ? 0 : SESSION_MAX_AGE };
}

/** What @supabase/ssr puts before a base64url cookie value (cookieEncoding "base64url", its default). */
const BASE64_PREFIX = "base64-";

/**
 * The access token in the stored session, read as @supabase/ssr stores it (its chunks joined, then the base64url
 * decoded), or null. It only reads: nothing here checks the token or refreshes it (amendment 3). Whoever uses the token
 * checks it first (getClaims with the token, which verifies the signature and the expiry without refreshing).
 */
export async function accessTokenFrom(read: (name: string) => string | null | undefined): Promise<string | null> {
  const raw = await combineChunks(AUTH_COOKIE, read);
  if (!raw) return null;
  try {
    const json = raw.startsWith(BASE64_PREFIX) ? stringFromBase64URL(raw.slice(BASE64_PREFIX.length)) : raw;
    const session: unknown = JSON.parse(json);
    if (session === null || typeof session !== "object") return null;
    const token = (session as { access_token?: unknown }).access_token;
    return typeof token === "string" && token !== "" ? token : null;
  } catch {
    return null;
  }
}

/**
 * The request's cookies for @supabase/ssr. Writing works in Server Actions and route handlers; a Server Component
 * can't set cookies, so the write is skipped there, as Supabase's Next.js guide does: proxy.ts renews the session
 * before pages render (phase B).
 *
 * The no-store headers Supabase passes with a cookie write (setAll's second argument) can't be set from here: Next has
 * no API for response headers in Server Functions or Components. A Server Action's response is a POST, which no CDN
 * caches; proxy.ts sets them on the page responses it renews (spec 5, phase B).
 */
export async function requestCookies(): Promise<CookieMethodsServer> {
  const store = await cookies();
  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll(toSet) {
      try {
        for (const { name, value, options } of toSet) store.set(name, value, sessionLifetime(options));
      } catch {
        // A Server Component: see above.
      }
    },
  };
}
