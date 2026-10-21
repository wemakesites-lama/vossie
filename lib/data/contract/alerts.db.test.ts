import { describe, expect, it, vi } from "vitest";
import { forgetSavedSearchesOf } from "@/lib/data/saved-searches";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { alertsContract } from "./alerts.contract";

// Saved searches and alerts on the local stack (C4/C5 plan Task 8): saved_searches read as their owner, save_search,
// set_search_paused and delete_search with the viewer's session, and notifySavedSearches matching in TypeScript with
// browse's listingMatches, then record_search_matches through the admin client (decision 9).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("saved searches and alerts on the local stack (C4/C5 plan Task 8)", () => {
  alertsContract(supabaseWorld);
});

describe("deleting an account's saved searches on Supabase (C4/C5 plan decision 16)", () => {
  it("is forget_account's, so the twin throws", async () => {
    await expect(forgetSavedSearchesOf("anyone")).rejects.toThrow("forget_account does this");
  });
});
