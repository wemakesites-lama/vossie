import "server-only";
import { createServerClient } from "@supabase/ssr";
import { authCookieOptions, requestCookies } from "./cookies";
import type { Database } from "./database.types";
import { publishableKey, supabaseUrl } from "./env";

/**
 * The viewer client (backend spec decision 5): the request's session cookie and the publishable key, so the database's
 * access rules know who is asking. For the signed-in person's own data and their actions (the public user-action
 * functions). Request-time: call inside <Suspense> or a Server Action, and make a new one for each request.
 */
export async function viewerClient() {
  return createServerClient<Database>(supabaseUrl(), publishableKey(), {
    cookieOptions: await authCookieOptions(),
    cookies: await requestCookies(),
  });
}
