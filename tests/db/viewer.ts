import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type { WorldAccountName } from "@/tests/contract/world";
import { dbEnv, type DbClient } from "./accounts";

// A viewer for the database tests until phase B lands (2b plan decision 19, Task 13). The Supabase twins get the
// signed-in person's client from one seam, forViewer() in lib/data/supabase/clients.ts, which throws until phase B
// wires it to the cookie client. Each db test file replaces it with the session of whichever account the test chose:
//
//   vi.mock("@/lib/data/supabase/clients", async (original) =>
//     (await import("@/tests/db/viewer")).withViewerSeam(await original()));
//
// and a test picks its viewer with setViewer(name) (the Supabase world's asViewer does it for the length of a call).

/** A client that is that session's: the publishable key with its access token, and nothing kept or refreshed. */
export function sessionClient(accessToken: string): DbClient {
  const { url, publishable } = dbEnv();
  return createClient<Database>(url, publishable, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let current: WorldAccountName | null = null;

/** Which account the mocked forViewer() is, or null for none (it then throws, as the real one does signed out). */
export function setViewer(name: WorldAccountName | null): void {
  current = name;
}

/** The chosen account's session client. */
export function currentViewerClient(): DbClient {
  if (current === null) throw new Error("No viewer: call setViewer(name) first");
  return sessionClient(inject("dbSessions")[current].accessToken);
}

/** lib/data/supabase/clients.ts with forViewer() answering the chosen account's session. */
export function withViewerSeam<Clients extends object>(clients: Clients): Clients & { forViewer: () => Promise<DbClient> } {
  return { ...clients, forViewer: async () => currentViewerClient() };
}
