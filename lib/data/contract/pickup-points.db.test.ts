import { describe, expect, it } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { normalise, parity } from "@/tests/db/parity";
import { supabaseWorld } from "@/tests/db/supabase-world";
import { pickupPointsContract } from "./pickup-points.contract";

describe("pickup points on the local stack (2b plan Task 14)", () => {
  pickupPointsContract(supabaseWorld);

  it("offers the same points as the sample store, in the same order (amendment 12)", async () => {
    const { sample, supabase } = await parity(() => getPickupPoints());
    expect(normalise(supabase)).toEqual(normalise(sample));
  });
});
