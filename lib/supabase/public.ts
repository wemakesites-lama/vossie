import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publishableKey, supabaseUrl } from "./env";

/**
 * The public client (backend spec decision 5): the publishable key and no cookies or session, so the access rules see
 * an anonymous reader. For what anyone may see (listings, shops, campuses). It holds no request data, so it's safe
 * inside "use cache" functions. Made in each call, never kept at module scope.
 */
export function publicClient() {
  return createClient<Database>(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
