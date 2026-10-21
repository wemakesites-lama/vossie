import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onSupabase } from "@/lib/backend";
import { recalculateBadges } from "@/lib/data/badges";
import { recentCounts, shopStats } from "@/lib/data/shop-stats";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { parity } from "@/tests/db/parity";
import { type SupabaseWorld, supabaseWorld } from "@/tests/db/supabase-world";
import { statsContract } from "./stats.contract";

// Shop stats and badges on the local stack (2b plan Task 19): the behaviour contract, the numbers giving the sample
// store's answers on the seed's conversations, and the badges the database holds after recalculating being the ones
// the sample store holds after the same call.

describe("shop stats and badges on the local stack (2b plan Task 19)", () => {
  statsContract(supabaseWorld);
});

/** Every shop with a conversation in the sample store, a shop with none, and no such shop. */
function shopsToCount(): string[] {
  resetSampleStore();
  const talked = new Set([...sampleStore().conversations.values()].map((row) => row.sellerSlug));
  return [...talked, "hair-studio", "no-such-shop"];
}

describe("the numbers and badges give the sample store's answers on the seed (2b plan Task 19)", () => {
  let world: SupabaseWorld;
  /** The real time, and a fixed one while the seed's conversations are recent (shopStats counts from the time given). */
  const times = [new Date(), new Date("2026-10-14T10:00:00.000Z")];
  beforeEach(() => {
    world = supabaseWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("a shop's week and record, and the mentor's 14 days", async () => {
    for (const now of times) {
      for (const slug of shopsToCount()) {
        const stats = await parity(() => shopStats(slug, now));
        expect(stats.supabase, slug).toEqual(stats.sample);
        const recent = await parity(() => recentCounts(slug, 14, now));
        expect(recent.supabase, slug).toEqual(recent.sample);
      }
    }
  });

  it("the same shops change badge, and every shop's badge is then the same", async () => {
    await world.keepBadges();
    const { sample, supabase } = await parity(async () => {
      const changed = [...(await recalculateBadges(times[0]))].sort();
      if (!onSupabase()) {
        return { changed, badges: new Map([...sampleStore().sellers.values()].map((row) => [row.slug, row.badge])) };
      }
      const { data, error } = await world.admin.from("shops").select("slug, badge");
      if (error) throw new Error(error.message);
      return { changed, badges: new Map(data.map((row) => [row.slug, row.badge])) };
    });
    expect(sample.changed.length).toBeGreaterThan(0);
    expect(supabase).toEqual(sample);
  });
});
