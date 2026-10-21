import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeReportsAboutShop, countHidden, listReports, openReportCount } from "@/lib/data/staff-reports";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { setViewer } from "@/tests/db/viewer";
import { staffReportsContract } from "./staff-reports.contract";

// The reports queue and Show again's reads on the local stack (C4/C5 plan Task 15): staff_reports with its own,
// dismiss_report with the admin's session, and the hidden lists over listings and requests.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the reports queue and Show again's reads on the local stack (C4/C5 plan Task 15)", () => {
  staffReportsContract(supabaseWorld);
});

describe("the queue gives the sample store's answer on the seed (C4/C5 plan Task 15)", () => {
  beforeEach(() => {
    setViewer("staff");
  });
  afterEach(() => {
    setViewer(null);
  });

  // The seed has no reports and hides nothing, so the queue, its count and the hidden counts are empty in both.
  it("lists the same reports and counts the same open and hidden", async () => {
    for (const read of [listReports, openReportCount, countHidden] as const) {
      const { sample, supabase } = await parity(() => (read as () => Promise<unknown>)());
      expect(normalise(supabase)).toEqual(normalise(sample));
    }
  });

  it("has no closeReportsAboutShop: staff_pause_shop closed them", async () => {
    await expect(closeReportsAboutShop("x", "x", "x", new Date())).rejects.toThrow("the staff function closed them");
  });
});
