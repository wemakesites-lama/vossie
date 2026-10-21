import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { authCookieOptions, requestCookies } from "./cookies";
import type { Database } from "./database.types";
import { publishableKey, supabaseUrl } from "./env";

/**
 * The viewer's client from their verified access token (phase B, amendment 3): the publishable key with the token as a
 * bearer, so the access rules know who is asking, and nothing kept, refreshed or written to a cookie. forViewer()
 * (lib/data/supabase/clients.ts) makes it from the token currentClaims() has checked. A page read through it can never
 * refresh the session behind the proxy's back: only proxy.ts renews it.
 */
export function tokenClient(accessToken: string) {
  return createClient<Database>(supabaseUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * The cookie client (backend spec decision 5): the request's session cookie and the publishable key. Nothing calls it
 * since phase B: it refreshes an expired session on its first query and, in a Server Component, can't store the new
 * tokens, so the browser's refresh token would end up reused and the session ended (amendment 3). The twins use
 * tokenClient() through forViewer(). Request-time only, a new one for each request.
 */
export async function viewerClient() {
  return createServerClient<Database>(supabaseUrl(), publishableKey(), {
    cookieOptions: await authCookieOptions(),
    cookies: await requestCookies(),
  });
}
