import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { featuredFor } from "@/lib/data/featured";
import { addDays } from "@/lib/staff/rules";
import type { CampusChoice } from "@/lib/types";
import { normalise, parity } from "@/tests/db/parity";
import { type SupabaseWorld, supabaseWorld } from "@/tests/db/supabase-world";
import { featuredContract } from "./featured.contract";

// Featured on the local stack (2b plan Task 18): the behaviour contract, and the first draw of a day giving the sample
// store's sellers in the sample store's order, from an empty draw table.

describe("Featured on the local stack (2b plan Task 18)", () => {
  featuredContract(supabaseWorld);
});

describe("the first draw of a day gives the sample store's row (2b plan Task 18)", () => {
  const DAY = "2031-09-15";
  let world: SupabaseWorld;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.forgetFeaturedDays([DAY]);
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("for everyone and for two campuses, with no row in the week before", async () => {
    const before = await world.admin.from("featured_draws").select("id").gte("day", addDays(DAY, -7)).lte("day", DAY);
    if (before.error) throw new Error(before.error.message);
    expect(before.data).toEqual([]);
    for (const campus of ["all", "pretoria", "midrand"] satisfies CampusChoice[]) {
      const { sample, supabase } = await parity(() => featuredFor(campus, DAY));
      expect(sample.length, campus).toBeGreaterThan(0);
      expect(normalise(supabase), campus).toEqual(normalise(sample));
    }
  });
});
