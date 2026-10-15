import "server-only";
import type { CookieMethodsServer, CookieOptionsWithName } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isHttps } from "@/lib/auth/cookies";

// The session cookies the viewer and auth clients share (backend spec section 5). Request-time: call inside <Suspense>
// or a Server Action.

/** Supabase's session cookie, renamed so every cookie is vossie_… (the privacy page's test). Chunked as .0, .1 when long. */
export const AUTH_COOKIE = "vossie_auth";

/** httpOnly (the browser's JavaScript never reads it), Lax, the whole site, and Secure on HTTPS (as lib/auth/cookies.ts). */
export async function authCookieOptions(): Promise<CookieOptionsWithName> {
  return { name: AUTH_COOKIE, httpOnly: true, sameSite: "lax", secure: await isHttps(), path: "/" };
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
        for (const { name, value, options } of toSet) store.set(name, value, options);
      } catch {
        // A Server Component: see above.
      }
    },
  };
}
