import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { secretKey, supabaseUrl } from "./env";

/**
 * The admin client (backend spec decision 5): the secret key, no session and no cookies. It bypasses every access
 * rule, so it's only for the jobs, account deletion (public.forget_account, then the Auth user), staff tools, the
 * sign-in counters and photo files. Made in each call, never kept at module scope.
 */
export function adminClient() {
  return createClient<Database>(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
