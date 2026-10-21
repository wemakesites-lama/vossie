import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { offersContract } from "./offers.contract";

// Offers, the request side, on the local stack (C4/C5 plan Task 5): my_conversations, shops and messages as the asker
// or the shop's owner.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("offers, the request side, on the local stack (C4/C5 plan Task 5)", () => {
  offersContract(supabaseWorld);
});
