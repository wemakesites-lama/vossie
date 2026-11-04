import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { listingCheckContract } from "./listing-check.contract";

// The listing check's reports on the local stack (AI stage B, Task 6): file_listing_check_report with the seller's session.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the listing check's reports on the local stack (AI stage B, Task 6)", () => {
  listingCheckContract(supabaseWorld);
});
