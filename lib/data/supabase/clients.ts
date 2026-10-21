import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { publicClient } from "@/lib/supabase/public";
import { tokenClient } from "@/lib/supabase/viewer";

/**
 * The one seam every Supabase twin in lib/data/supabase gets its client from, and the one the database tests replace
 * (2b plan decisions 15, 19 to 21; backend spec decision 5). Never a client from lib/supabase directly.
 *
 * - forPublic(): the publishable key, no session and no cookies, so the access rules see an anonymous reader. Only
 *   what anyone may see. It holds no request data, so it's the only one safe inside "use cache".
 * - forServer(): the secret key, which bypasses every access rule. Request-time server code only (after connection(),
 *   or in a Server Action), never inside "use cache", and only where no API role may read the rows and only counts or
 *   the outcome leave the server: settleRequests, featuredFor, shopStats, badges (decision 21); C4's
 *   notifySavedSearches (every active saved search, matched in TypeScript, then record_search_matches, which only the
 *   service role runs) and requestAskerId (one request's asker, compared with the viewer's id, never shown); later
 *   C5's countByWeek (admin_weekly_counts) and the jobs (C4/C5 plan decision 9). A twin never trusts an account id
 *   it's given over the session (decision 20).
 * - forViewer(): the signed-in person's own client, so the access rules know who is asking (phase B). It carries the
 *   access token currentClaims() verified (auth-session.ts) as a bearer, with nothing kept or refreshed
 *   (lib/supabase/viewer.ts's tokenClient), so a read in a Server Component can never refresh the session: only
 *   proxy.ts does (amendment 3). It rejects when nobody is signed in. Request-time only, never inside "use cache". The
 *   database tests replace it with vi.mock (tests/db/viewer.ts).
 * - viewerId(): that session's account id (C2/C3 plan decision 2). A twin given an account id gets its client through
 *   forViewerAs() (viewer.ts), which checks the id against it.
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
  // Through import(): auth-session.ts gets its public client from here.
  const { viewerSession } = await import("./auth-session");
  const session = await viewerSession();
  if (!session) throw new Error("forViewer() needs a signed-in session");
  return tokenClient(session.accessToken);
}

/**
 * The signed-in account's id, from the same verified session forViewer() uses, without a round trip (C2/C3 plan
 * decision 2). It rejects when nobody is signed in. Twins check an account id they're given against it through
 * forViewerAs() (viewer.ts), never trusting the id over the session (decision 20). The database tests replace it with
 * forViewer() (tests/db/viewer.ts).
 */
export async function viewerId(): Promise<string> {
  const { viewerSession } = await import("./auth-session");
  const session = await viewerSession();
  if (!session) throw new Error("viewerId() needs a signed-in session");
  return session.userId;
}
