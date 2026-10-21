import { afterEach, beforeEach, expect, it } from "vitest";
import { getSeller, getSellerSlugs } from "@/lib/data";
import { recalculateBadges } from "@/lib/data/badges";
import { recentCounts, shopStats } from "@/lib/data/shop-stats";
import type { TrustBadge } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// A shop's numbers and the trust badges in both backends (2b plan Task 19; staff tools spec 2.7, selling spec 2.8):
// counted from the shop's conversations by the trust page's rules, and a badge worked out only for a shop an account
// owns. On the seed, Tech corner (Thabo's) has two enquiries and no sale, so it can't be more than a New seller, though
// its sample badge says Responsive. The time is fixed (shopStats counts in TypeScript, from the time it's given), so
// the counts don't move as the seed's conversations age. stats.test.ts runs it on the sample store, stats.db.test.ts on
// the local stack.

/** Wednesday 14 October 2026, noon in South Africa: Tech corner's two enquiries are this week's. */
const NOW = new Date("2026-10-14T10:00:00.000Z");
const NOTHING = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };

export function statsContract(makeWorld: () => World): void {
  let world: World;
  const now = NOW;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("counts nothing for a shop with no conversations, or no such shop", async () => {
    for (const slug of ["hair-studio", "no-such-shop"]) {
      expect(await shopStats(slug, now), slug).toEqual({ week: NOTHING, record: NOTHING });
      expect(await recentCounts(slug, 14, now), slug).toEqual(NOTHING);
    }
  });

  it("counts Tech corner's two enquiries, both answered in time, and no sale yet", async () => {
    const counts = { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 };
    expect(await shopStats("tech-corner", now)).toEqual({ week: counts, record: counts });
    expect(await recentCounts("tech-corner", 14, now)).toEqual(counts);
  });

  it("works out the owned shop's badge once, and leaves the sample shops' badges alone", async () => {
    await world.keepBadges();
    const badges = async () => {
      const shown = new Map<string, TrustBadge | null>();
      for (const slug of await getSellerSlugs()) shown.set(slug, (await getSeller(slug))?.badge ?? null);
      return shown;
    };
    const before = await badges();
    expect(before.get("tech-corner")).toBe("responsive");
    expect(await recalculateBadges(now)).toEqual(["tech-corner"]);
    const after = await badges();
    expect(after.get("tech-corner")).toBe("new-seller");
    for (const [slug, badge] of before) if (slug !== "tech-corner") expect(after.get(slug), slug).toBe(badge);
    expect(await recalculateBadges(now)).toEqual([]);
  });
}
