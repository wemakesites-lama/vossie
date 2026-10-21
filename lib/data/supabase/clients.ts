import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { publicClient } from "@/lib/supabase/public";

/**
 * The one seam every Supabase twin in lib/data/supabase gets its client from, and the one the database tests replace
 * (2b plan decisions 15, 19 to 21; backend spec decision 5). Never a client from lib/supabase directly.
 *
 * - forPublic(): the publishable key, no session and no cookies, so the access rules see an anonymous reader. Only
 *   what anyone may see. It holds no request data, so it's the only one safe inside "use cache".
 * - forServer(): the secret key, which bypasses every access rule. Request-time server code only (after connection(),
 *   or in a Server Action), never inside "use cache", and only where no API role may read the rows and only counts or
 *   the outcome leave the server: settleRequests, featuredFor, shopStats, badges (decision 21), and later the staff
 *   tools and jobs. A twin never trusts an account id it's given over the session (decision 20).
 * - forViewer(): the signed-in person's own client, so the access rules know who is asking. Phase B points it at the
 *   cookie client (lib/supabase/viewer.ts). Until then it throws: this module never reaches the modules that can set
 *   the vossie_auth cookie (2b plan amendment 9), and the database tests replace it with vi.mock.
 */

/** A Supabase client typed by the database's schema. */
export type DbClient = ReturnType<typeof publicClient>;

export function forPublic(): DbClient {
  return publicClient();
}

export function forServer(): DbClient {
  return adminClient();
}

export async function forViewer(): Promise<DbClient> {
  throw new Error("forViewer() is wired by phase B");
}
