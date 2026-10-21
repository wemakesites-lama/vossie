import { inject } from "vitest";
import type { ActAs, SignIn } from "@/tests/contract/actions";
import { WORLD_ACCOUNTS } from "@/tests/contract/world";
import { testAdminClient } from "./accounts";
import { setViewer, withViewer } from "./viewer";

// The database side of the action contracts (C4/C5 plan Task 3, decision 13). A db test file that runs Server Actions
// mocks Next with tests/helpers/next-request.ts over its own FakeRequest, as the unit tests do, and the two seams, so
// the real lib/auth/session reads the world account's session on Supabase: getViewer() reads its profile with its own
// client, requireLiveAccount() finds it live, getSessionKey() is its session_id, and form states are its session's:
//
//   const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
//   vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
//   vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
//   vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
//   vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
//   vi.mock("@/lib/data/supabase/clients", async (original) =>
//     (await import("@/tests/db/viewer")).withViewerSeam(await original()));
//   vi.mock("@/lib/data/supabase/auth-session", async (original) =>
//     (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()));
//
//   actionContract(supabaseWorld, request, dbActions, (scenario) => { … });
//
// The plan's vi.mock of lib/auth/session is replaced by the session seam: the session module itself then runs as it
// does on Supabase (Task 3's note in "Changes made during the build").

/** On Supabase, signing in is choosing the viewer: every seam reads it. */
export const signInDb: SignIn = async (world, name) => {
  setViewer(name);
  return name === null ? null : world.signedIn(name);
};

/**
 * The world accounts' form states go after each action test: the sessions are minted once per run, so a status line
 * one test leaves would otherwise be the next test's. The admin client, since a taken token can't be deleted by its
 * own session while it lasts.
 */
export async function tidyFormStates(): Promise<void> {
  const sessions = inject("dbSessions");
  const { error } = await testAdminClient()
    .from("form_states")
    .delete()
    .in(
      "account_id",
      WORLD_ACCOUNTS.map((name) => sessions[name].id),
    );
  if (error) throw new Error(error.message);
}

/** On Supabase, acting as someone for one call is that call's own viewer (amendment 7): every seam reads it. */
export const asDb: ActAs = (_world, name, run) => withViewer(name, run);

export const dbActions = { signIn: signInDb, tidy: tidyFormStates, as: asDb };
