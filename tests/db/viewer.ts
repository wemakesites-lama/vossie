import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type { WorldAccountName } from "@/tests/contract/world";
import { dbEnv, type DbClient } from "./accounts";

// A viewer for the database tests (2b plan decision 19, Task 13). The Supabase twins get the signed-in person's client
// from one seam, forViewer() in lib/data/supabase/clients.ts, and their id from viewerId(). Each db test file replaces
// them with the session of whichever account the test chose:
//
//   vi.mock("@/lib/data/supabase/clients", async (original) =>
//     (await import("@/tests/db/viewer")).withViewerSeam(await original()));
//
// and, where a twin or an action reads the session's claims (form states, one-time tokens, a Server Action's session):
//
//   vi.mock("@/lib/data/supabase/auth-session", async (original) =>
//     (await import("@/tests/db/viewer")).withSessionSeam(await original()));
//
// A test picks its viewer with setViewer(name), or for the length of one call with withViewer(name, run) (the Supabase
// world's asViewer does). withViewer keeps its viewer in an AsyncLocalStorage, so two calls running at once (two admins
// racing, C4/C5 plan amendment 7) each see their own; setViewer is the default outside any.

/** A client that is that session's: the publishable key with its access token, and nothing kept or refreshed. */
export function sessionClient(accessToken: string): DbClient {
  const { url, publishable } = dbEnv();
  return createClient<Database>(url, publishable, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let fallback: WorldAccountName | null = null;
const scoped = new AsyncLocalStorage<{ name: WorldAccountName | null }>();

/** Which account the mocked forViewer() is outside withViewer, or null for none (it then throws, as signed out). */
export function setViewer(name: WorldAccountName | null): void {
  fallback = name;
}

/** Runs `run` with that account as the viewer (or nobody), whatever else runs at the same time. */
export function withViewer<T>(name: WorldAccountName | null, run: () => Promise<T>): Promise<T> {
  return scoped.run({ name }, run);
}

/** The viewer now: withViewer's, else setViewer's. */
export function currentViewerName(): WorldAccountName | null {
  const store = scoped.getStore();
  return store ? store.name : fallback;
}

function current(): WorldAccountName {
  const name = currentViewerName();
  if (name === null) throw new Error("No viewer: call setViewer(name) first");
  return name;
}

/** The chosen account's session client. */
export function currentViewerClient(): DbClient {
  return sessionClient(inject("dbSessions")[current()].accessToken);
}

/** The chosen account's id (viewerId(), C2/C3 plan decision 2). */
export function currentViewerId(): string {
  return inject("dbSessions")[current()].id;
}

/** The claims in a test session's access token, read without checking: the local stack issued it. */
export function claimsIn(accessToken: string): { userId: string; sessionId: string; email: string } {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
  const { sub, session_id: sessionId, email } = payload;
  if (typeof sub !== "string" || typeof sessionId !== "string" || typeof email !== "string") {
    throw new Error("The test session's token lacks its claims");
  }
  return { userId: sub, sessionId, email: email.toLowerCase() };
}

/** The viewer's session claims, as currentClaims() gives them, or null with no viewer (signed out). */
export function currentViewerClaims(): { userId: string; sessionId: string; email: string } | null {
  const name = currentViewerName();
  return name === null ? null : claimsIn(inject("dbSessions")[name].accessToken);
}

/**
 * lib/data/supabase/clients.ts with forViewer() answering the chosen account's session, and viewerId() its id. Mocking
 * the module reaches forViewerAs() (lib/data/supabase/viewer.ts), which imports both from it.
 */
export function withViewerSeam<Clients extends object>(
  clients: Clients,
): Clients & { forViewer: () => Promise<DbClient>; viewerId: () => Promise<string> } {
  return { ...clients, forViewer: async () => currentViewerClient(), viewerId: async () => currentViewerId() };
}

/**
 * lib/data/supabase/auth-session.ts with the viewer's session as the request's: currentClaims(), readClaims() and
 * viewerSession() give the chosen account's claims (null with none), and liveUserId() its id, as Auth would.
 */
export function withSessionSeam<AuthSession extends object>(authSession: AuthSession) {
  return {
    ...authSession,
    currentClaims: async () => currentViewerClaims(),
    readClaims: async () => currentViewerClaims(),
    viewerSession: async () => {
      const name = currentViewerName();
      if (name === null) return null;
      const { accessToken } = inject("dbSessions")[name];
      return { ...claimsIn(accessToken), accessToken };
    },
    liveUserId: async () => currentViewerClaims()?.userId ?? null,
  };
}

/**
 * lib/data/auth-session.ts (lib/auth's way to Supabase Auth) answering from the viewer's session directly, as
 * withSessionSeam does one layer down. For a db test that runs two Server Actions at once (the last-admin race, C4/C5
 * plan Task 20): the wrapper reaches the twin through import() on every call, and the test runner can hand a second
 * import() of a mocked module, made while another is under way, the unmocked module. lib/auth imports the wrapper
 * statically, so mocking it here leaves no import() between the actions and the seam.
 */
export function withAuthSessionWrapperSeam<AuthSession extends object>(authSession: AuthSession) {
  return {
    ...authSession,
    currentClaims: async () => currentViewerClaims(),
    readClaims: async () => currentViewerClaims(),
    liveUserId: async () => currentViewerClaims()?.userId ?? null,
  };
}
