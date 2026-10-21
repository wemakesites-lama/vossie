import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { countByWeek } from "@/lib/data/numbers";
import { protectCounts } from "@/lib/staff/numbers";
import { parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { numbersContract } from "./numbers.contract";

// The admin's numbers on the local stack (C4/C5 plan Task 21): admin_weekly_counts through the admin client.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("the admin's numbers on the local stack (C4/C5 plan Task 21)", () => {
  numbersContract(supabaseWorld);
});

describe("the admin's numbers give the sample store's answer on the seed (C4/C5 plan Task 21)", () => {
  it("counts the same weeks, cells and open shops, and shows the same once protected", async () => {
    const now = new Date();
    const { sample, supabase } = await parity(() => countByWeek(now));
    expect(supabase).toEqual(sample);
    const slugs = campuses.map((campus) => campus.slug);
    expect(protectCounts(supabase.raw, slugs)).toEqual(protectCounts(sample.raw, slugs));
  });
});
