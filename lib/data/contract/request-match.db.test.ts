import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { requestMatchContract } from "./request-match.contract";

// A request's stored search and a first publish's matches on the local stack (AI stage G Task 4): save_request_match
// and the requests table's match columns, both through the admin client only.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("a request's stored search and a first publish's matches, on the local stack (AI stage G Task 4)", () => {
  requestMatchContract(supabaseWorld);
});
