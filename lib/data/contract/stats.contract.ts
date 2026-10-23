import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getSeller, getSellerSlugs } from "@/lib/data";
import { recalculateBadgeFor, recalculateBadges } from "@/lib/data/badges";
import { saveOwnListing } from "@/lib/data/own-listings";
import { dailyEnquiries, dailyEnquiriesFor, recentCounts, shopStats } from "@/lib/data/shop-stats";
import type { TrustBadge } from "@/lib/types";
import type { World, WorldAccountName } from "@/tests/contract/world";

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
      expect(await recentCounts(slug, 14, now), slug).toEqual({ ...NOTHING, previous: NOTHING });
    }
  });

  it("counts Tech corner's two enquiries, both answered in time, and no sale yet", async () => {
    const counts = { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 };
    expect(await shopStats("tech-corner", now)).toEqual({ week: counts, record: counts });
    expect(await recentCounts("tech-corner", 14, now)).toEqual({ ...counts, previous: NOTHING });
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

  it("works out the badge of the shop a conversation is with, as after a reply or a sale (fix 8)", async () => {
    await world.tidySelling("seller");
    await world.tidyMessaging();
    const seller = await world.signedIn("seller");
    const slug = await world.openShop("seller", { name: "Contract badge shop" });
    const listing = await world.asViewer("seller", () =>
      saveOwnListing({
        sellerSlug: slug,
        ownerId: seller,
        id: null,
        fields: {
          kind: "service",
          title: "Contract tutoring",
          categorySlug: "tutoring",
          condition: null,
          priceZar: 100,
          priceIsFrom: true,
          payMode: "cash",
          swapFor: null,
          description: "Tutoring the contract tests list.",
          handover: "online",
          pickupPointId: null,
        },
        photos: [],
        intent: "publish",
        now: new Date(),
      }),
    );
    const hour = 60 * 60 * 1000;
    /** An enquiry `daysAgo` days ago, answered within the hour. */
    const answered = (buyer: WorldAccountName, daysAgo: number) => {
      const asked = new Date(Date.now() - daysAgo * 24 * hour);
      return world.addConversation({
        buyer,
        slug,
        listingId: listing!.id,
        messages: [
          { side: "buyer", body: "Is it still on offer?", sentAt: asked, readAt: asked },
          { side: "seller", body: "It is.", sentAt: new Date(asked.getTime() + hour) },
        ],
      });
    };
    const now = new Date();
    const first = await answered("shopper", 5);
    // One enquiry isn't enough for Responsive (the trust page's rules), so nothing changes.
    expect(await recalculateBadgeFor(first, now)).toBe(false);
    await answered("asker", 4);
    const third = await answered("staff", 3);
    expect(await recalculateBadgeFor(third, now)).toBe(true);
    expect((await getSeller(slug))?.badge).toBe("responsive");
    expect(await recalculateBadgeFor(third, now)).toBe(false);
    expect(await recalculateBadgeFor(randomUUID(), now)).toBe(false);
    // A conversation whose shop has gone is no shop's to work out.
    await world.shopGone(first);
    expect(await recalculateBadgeFor(first, now)).toBe(false);
  });

  it("counts Tech corner's enquiries by SAST day for the mentor's chart, as dailyEnquiries does (role views spec 6)", async () => {
    const series = await dailyEnquiriesFor(["tech-corner", "no-such-shop"], 14, now);
    expect([...series.keys()]).toEqual(["tech-corner"]);
    // The seed's two enquiries started on 12 and 13 October (SAST); the 14 days run from 1 to 14 October.
    expect(series.get("tech-corner")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
    expect(await dailyEnquiriesFor([], 14, now)).toEqual(new Map());
  });

  it("leaves the days before a shop opened empty, never 0, for every shop in one read", async () => {
    await world.tidyMessaging();
    const opened = new Date();
    const slug = await world.openShop("shopper");
    const listingId = await world.addListing(slug, { title: "Desk lamp for the chart" });
    await world.addConversation({
      buyer: "asker",
      slug,
      listingId,
      messages: [{ side: "buyer", body: "Is the desk lamp still there?", sentAt: opened }],
    });
    const series = await dailyEnquiriesFor([slug, "tech-corner"], 7, opened);
    expect(series.get(slug)).toEqual([null, null, null, null, null, null, 1]);
    expect(series.get(slug)).toEqual(await dailyEnquiries(slug, 7, opened));
    expect(series.get("tech-corner")).toHaveLength(7);
  });
}
