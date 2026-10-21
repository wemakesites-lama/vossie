import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { staffPrivacyContract } from "./staff-privacy.contract";

// The staff tools' part of the download on the local stack (C4/C5 plan Task 21): hub_rsvps, hub_bookings and hub_cards
// with the account's own session.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
vi.mock("@/lib/data/supabase/auth-session", async (original) =>
  (await import("@/tests/db/viewer")).withSessionSeam(await original<object>()),
);

describe("the staff tools' part of the download on the local stack (C4/C5 plan Task 21)", () => {
  staffPrivacyContract(supabaseWorld);
});
