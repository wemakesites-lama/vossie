import { describe, vi } from "vitest";
import { actionContract } from "@/tests/contract/actions";
import { dbActions } from "@/tests/db/actions";
import { supabaseWorld } from "@/tests/db/supabase-world";
import type { FakeRequest } from "@/tests/helpers/next-request";
import { hubActionsContract } from "./hub.contract";

// The Hub's actions on the local stack (C4/C5 plan Task 18): the real Server Actions, with lib/auth/session reading
// the world account's session through the seams (tests/db/actions.ts), and save_hub_post, request_slot, answer_booking
// and rsvp writing, and the covers in Storage.
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("the Hub's actions on the local stack (C4/C5 plan Task 18)", () => {
  actionContract(supabaseWorld, request, dbActions, hubActionsContract);
});
