import { describe, expect, it, vi } from "vitest";
import { forgetRequestsOf } from "@/lib/data/requests";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { requestsOwnContract } from "./requests-own.contract";

// Looking For requests, the asker's side, on the local stack (C4/C5 plan Task 4): save_request, set_request_open,
// delete_request, hide_request and show_request with the viewer's session, my_requests for the reads, and the
// database's settle_requests first.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("Looking For requests, the asker's side, on the local stack (C4/C5 plan Task 4)", () => {
  requestsOwnContract(supabaseWorld);
});

describe("deleting an account's requests on Supabase (C4/C5 plan decision 16)", () => {
  it("is forget_account's, so the twin throws", async () => {
    await expect(forgetRequestsOf("anyone")).rejects.toThrow("forget_account does this");
  });
});
