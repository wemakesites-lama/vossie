import { describe, vi } from "vitest";
import { actionContract } from "@/tests/contract/actions";
import { dbActions } from "@/tests/db/actions";
import { supabaseWorld } from "@/tests/db/supabase-world";
import type { FakeRequest } from "@/tests/helpers/next-request";
import { saveSearchActionContract } from "./actions.contract";

// Save this search on the local stack (C4/C5 plan Task 8): the real Server Action, with lib/auth/session
// reading the world account's session through the seams (tests/db/actions.ts).
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("Save this search on the local stack (C4/C5 plan Task 8)", () => {
  actionContract(supabaseWorld, request, dbActions, saveSearchActionContract);
});
