import { afterEach, beforeEach, expect, it } from "vitest";
import { getVerifiedSellers } from "@/lib/data";
import { featuredFor } from "@/lib/data/featured";
import type { Seller } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// Featured in both backends (2b plan Task 18; staff tools spec 2.8, stage M spec decisions 9 to 11): a campus's row is
// drawn on its first view of the day and kept all day; pins come first; a seller who stops being eligible drops out
// and the place stays empty; resting sellers come back longest wait first. The days are far in the future, so no test
// meets a real draw, and the world forgets every row and pin on them afterwards. featured.test.ts runs it on the sample
// store, featured.db.test.ts on the local stack.

const slugs = (sellers: readonly Seller[]) => sellers.map((seller) => seller.slug);

export function featuredContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("draws at most four Verified sellers on the first view and keeps the row all day", async () => {
    const day = "2031-03-10";
    await world.forgetFeaturedDays([day]);
    const first = await featuredFor("all", day);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(4);
    expect(first.every((seller) => seller.verified)).toBe(true);
    expect(new Set(slugs(first)).size).toBe(first.length);
    expect(await featuredFor("all", day)).toEqual(first);
  });

  it("brings the resting sellers back longest wait first: shown 5, 3 and 1 days ago, they come back b, c, a", async () => {
    const scratch = "2031-01-06";
    const day = "2031-04-14";
    const [oneAgo, threeAgo, fiveAgo] = ["2031-04-13", "2031-04-11", "2031-04-09"];
    await world.forgetFeaturedDays([scratch, day, oneAgo, threeAgo, fiveAgo]);
    // Three sellers who can be featured, and nobody else Verified, so all three are resting today.
    const three = slugs(await featuredFor("all", scratch)).slice(0, 3);
    expect(three).toHaveLength(3);
    for (const seller of await getVerifiedSellers()) {
      if (!three.includes(seller.slug)) await world.unverifyShop(seller.slug);
    }
    const [a, b, c] = three;
    await world.recordDraw("all", oneAgo, [a]);
    await world.recordDraw("all", threeAgo, [c]);
    await world.recordDraw("all", fiveAgo, [b]);
    expect(slugs(await featuredFor("all", day))).toEqual([b, c, a]);
  });

  it("puts a pin first", async () => {
    const scratch = "2031-05-19";
    const day = "2031-06-23";
    await world.forgetFeaturedDays([scratch, day]);
    const drawn = slugs(await featuredFor("all", scratch));
    const pinned = drawn[drawn.length - 1];
    await world.addPin("all", day, pinned);
    expect(slugs(await featuredFor("all", day))[0]).toBe(pinned);
  });

  it("drops a seller who stops being eligible after the draw, and leaves the place empty", async () => {
    const day = "2031-07-28";
    await world.forgetFeaturedDays([day]);
    const first = slugs(await featuredFor("all", day));
    await world.unverifyShop(first[0]);
    expect(slugs(await featuredFor("all", day))).toEqual(first.slice(1));
  });
}
