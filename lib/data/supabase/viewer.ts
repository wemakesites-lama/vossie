import "server-only";
import { forViewer, viewerId, type DbClient } from "./clients";

// The viewer's client for a twin given an account id (C2/C3 plan decision 2; 2b plan decision 20: a twin never trusts
// an account id over the session). It lives in its own module, not in clients.ts, so that the database tests' vi.mock
// of clients.ts (tests/db/viewer.ts) reaches the forViewer() and viewerId() it calls: a function inside clients.ts
// would call the unmocked ones. C4/C5's twins import it too.

/** The viewer's client, once `accountId` is checked to be the signed-in account. Rejects for any other, or signed out. */
export async function forViewerAs(accountId: string): Promise<DbClient> {
  const [client, id] = await Promise.all([forViewer(), viewerId()]);
  if (id !== accountId) throw new Error("A Supabase twin was asked about an account that isn't the signed-in one");
  return client;
}
