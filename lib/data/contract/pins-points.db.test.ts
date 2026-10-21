import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { pinsPointsContract } from "./pins-points.contract";

// Featured pins and pickup point writes on the local stack (C4/C5 plan Task 17): pin_shop, unpin_shop and the four point
// functions with the admin's session; update_shop with the seller's.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("Featured pins and pickup point writes on the local stack (C4/C5 plan Task 17)", () => {
  pinsPointsContract(supabaseWorld);
});
