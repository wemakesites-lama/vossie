import { describe, vi } from "vitest";
import { actionContract } from "@/tests/contract/actions";
import { dbActions } from "@/tests/db/actions";
import { supabaseWorld } from "@/tests/db/supabase-world";
import type { FakeRequest } from "@/tests/helpers/next-request";
import { rolesContract } from "./roles.contract";

// Staff roles' actions on the local stack (C4/C5 plan Task 20): the real Server Actions, with lib/auth/session reading
// the world account's session through the seams (tests/db/actions.ts), and give_role and remove_role writing (remove_role
// under its lock, so two admins at once leave one).
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);
// The race posts two actions at once: lib/auth reaches the session through the wrapper, with no import() in between.
vi.mock("@/lib/data/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withAuthSessionWrapperSeam(await original<object>()),
);

describe("staff roles' actions on the local stack (C4/C5 plan Task 20)", () => {
  actionContract(supabaseWorld, request, dbActions, rolesContract);
});
