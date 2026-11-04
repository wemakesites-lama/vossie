import { describe, vi } from "vitest";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { reportReadContract } from "./report-read.contract";

// The report read on the local stack (AI stage C, Task 3): reportForRead and save_report_first_read with the secret key,
// staff_reports with the admin's session.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the report read on the local stack (AI stage C, Task 3)", () => {
  reportReadContract(supabaseWorld);
});
