import { afterEach, describe, vi } from "vitest";
import { testAdminClient } from "@/tests/db/accounts";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { listingCheckContract } from "./listing-check.contract";

// The listing check's reports on the local stack (AI stage B, Task 6): file_listing_check_report with the seller's session.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the listing check's reports on the local stack (AI stage B, Task 6)", () => {
  // The world removes the listing, but a report with no reporter outlives it: delete the contract's own (their titles
  // start "Contract", which no seed report's does), so staff-reports.db.test.ts still sees only the seed's queue.
  afterEach(async () => {
    const { error } = await testAdminClient()
      .from("reports")
      .delete()
      .is("reporter_id", null)
      .like("target_title", "Contract %");
    if (error) throw new Error(error.message);
  });
  listingCheckContract(supabaseWorld);
});
