import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { coachContract } from "./coach.contract";

// Shop coach's storage and facts on the local stack (AI stage I1, Task 6): own_coach_weeks and tick_coach_action with the
// viewer's session, the weeks themselves written with the admin client.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("Shop coach's storage and facts on the local stack (AI stage I1, Task 6)", () => {
  coachContract(supabaseWorld);
});
