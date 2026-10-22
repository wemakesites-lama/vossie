import { afterEach, beforeEach, expect, it } from "vitest";
import { followerCounts } from "@/lib/data/follows";
import { setOwnListingState } from "@/lib/data/own-listings";
import { sellerQueue } from "@/lib/data/seller-queue";
import { dailyEnquiries, recentCounts } from "@/lib/data/shop-stats";
import { hideListing, showListing } from "@/lib/data/staff-shops";
import type { World } from "@/tests/contract/world";

// The seller home's readers in both backends (role views spec 6; N2 plan decisions 1 to 3, 9 and 10): sellerQueue,
// recentCounts' window before, dailyEnquiries and followerCounts. seller-home.test.ts runs it on the sample store,
// seller-home.db.test.ts on the local stack. The queue and the follower counts are read as the shop's owner.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOTHING = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };

export function sellerHomeContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidySelling("seller");
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const queueOf = (slug: string) => world.asViewer("seller", () => sellerQueue(slug));

  it("a new shop's queue is empty: nothing waits, nothing to mark, never replied", async () => {
    const slug = await world.openShop("seller");
    expect(await queueOf(slug)).toEqual({
      replies: { count: 0, oldest: null },
      sales: [],
      drafts: { count: 0, oldest: null },
      hidden: { count: 0, oldest: null },
      paused: { count: 0, oldest: null },
      listings: { available: 0, paused: 0, sold: 0, drafts: 0 },
      everReplied: false,
    });
  });

  it("counts buyers waiting for a first reply, oldest first, leaving out replied ones and offers", async () => {
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract lamp" });
    const asked = new Date(Date.now() - 2 * HOUR);
    const oldest = await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [{ side: "buyer", body: "Is it still there?", sentAt: asked }],
    });
    await world.addConversation({
      buyer: "asker",
      slug,
      messages: [{ side: "buyer", body: "Do you deliver?", sentAt: new Date(Date.now() - HOUR) }],
    });
    await world.addConversation({
      buyer: "staff",
      slug,
      listingId: listing,
      messages: [
        { side: "buyer", body: "Still there?", sentAt: new Date(Date.now() - 3 * HOUR) },
        { side: "seller", body: "It is.", sentAt: new Date(Date.now() - 2.5 * HOUR) },
      ],
    });
    const request = await world.addRequest({ asker: "asker", title: "A contract kettle", neededBy: null });
    await world.addConversation({
      buyer: "asker",
      slug,
      offerOn: request,
      messages: [{ side: "seller", body: "I have one.", sentAt: new Date(Date.now() - 4 * HOUR) }],
    });
    const queue = await queueOf(slug);
    expect(queue.replies).toEqual({
      count: 2,
      oldest: { id: oldest, title: "Contract lamp", at: asked.toISOString(), state: null },
    });
    expect(queue.everReplied).toBe(true);
  });

  it("lists a sale to mark as sold until its listing is sold", async () => {
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract radio" });
    const conversation = await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [
        { side: "buyer", body: "Is it still there?", sentAt: new Date(Date.now() - 2 * HOUR) },
        { side: "seller", body: "It is.", sentAt: new Date(Date.now() - HOUR) },
      ],
    });
    // A little ahead, so the database's clock (the listing's updated_at) can't land after it on the local stack.
    await world.markDone(conversation, new Date(Date.now() + 5 * 60 * 1000));
    expect((await queueOf(slug)).sales.map((sale) => [sale.conversationId, sale.listingId, sale.title])).toEqual([
      [conversation, listing, "Contract radio"],
    ]);
    await world.asViewer("seller", () => setOwnListingState(slug, listing, "sold", new Date()));
    const after = await queueOf(slug);
    expect(after.sales).toEqual([]);
    expect(after.listings).toEqual({ available: 0, paused: 0, sold: 1, drafts: 0 });
  });

  it("stops asking once the Hub has hidden and shown the listing again: a Hub decision is a change (plan decision 3)", async () => {
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract heater" });
    const conversation = await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [
        { side: "buyer", body: "Is it still there?", sentAt: new Date(Date.now() - 2 * HOUR) },
        { side: "seller", body: "It is.", sentAt: new Date(Date.now() - HOUR) },
      ],
    });
    // Marked completed after the listing was made and before the Hub acts. On Supabase the listing's times are the
    // database's clock (the local stack's container shares the host's), so leave two seconds either side.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await world.markDone(conversation, new Date());
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect((await queueOf(slug)).sales.map((sale) => sale.conversationId)).toEqual([conversation]);
    // hide_listing needs an open report on Supabase; the sample's hideListing doesn't mind one.
    await world.addReport("asker", { kind: "listing", id: listing });
    await world.asViewer("staff", () => hideListing(listing, "Checking it.", new Date()));
    expect((await queueOf(slug)).sales).toEqual([]);
    await world.asViewer("staff", () => showListing(listing, new Date()));
    expect((await queueOf(slug)).sales).toEqual([]);
  });

  it("counts drafts, Hub-hidden and paused listings, each with its oldest", async () => {
    const slug = await world.openShop("seller");
    const draft = await world.addListing(slug, { title: "Contract draft" });
    const hidden = await world.addListing(slug, { title: "Contract hidden" });
    const paused = await world.addListing(slug, { title: "Contract paused" });
    await world.draftListing(draft);
    await world.hideListing(hidden, "Not allowed on CampusCart.");
    await world.asViewer("seller", () => setOwnListingState(slug, paused, "paused", new Date()));
    const queue = await queueOf(slug);
    expect([queue.drafts.count, queue.drafts.oldest?.id, queue.drafts.oldest?.state]).toEqual([1, draft, "draft"]);
    expect([queue.hidden.count, queue.hidden.oldest?.id, queue.hidden.oldest?.state]).toEqual([1, hidden, "available"]);
    expect([queue.paused.count, queue.paused.oldest?.id]).toEqual([1, paused]);
    expect(queue.listings).toEqual({ available: 1, paused: 1, sold: 0, drafts: 1 });
  });

  it("compares Tech corner's week with the week before, the seed's sale confirming itself on the 20th", async () => {
    // 21 October, noon in South Africa: the two enquiries (12 and 13 October) are the week before's; the sale marked
    // done on 13 October confirmed itself 7 days later, inside this week.
    const now = new Date("2026-10-21T10:00:00.000Z");
    expect(await recentCounts("tech-corner", 7, now)).toEqual({
      enquiries: 0,
      due: 0,
      repliedInTime: 0,
      salesConfirmed: 1,
      previous: { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 },
    });
    expect(await recentCounts("no-such-shop", 7, now)).toEqual({ ...NOTHING, previous: NOTHING });
  });

  it("gives Tech corner's enquiries by SAST day, and none before a shop existed", async () => {
    expect(await dailyEnquiries("tech-corner", 7, new Date("2026-10-14T10:00:00.000Z"))).toEqual([0, 0, 0, 0, 1, 1, 0]);
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract fan" });
    const now = new Date();
    await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [{ side: "buyer", body: "Still there?", sentAt: now }],
    });
    expect(await dailyEnquiries(slug, 3, new Date(now.getTime() + 1000))).toEqual([null, null, 1]);
  });

  it("counts the shop's followers and the ones from the last 7 days, never who", async () => {
    const slug = await world.openShop("seller");
    await world.follow("shopper", slug, new Date(Date.now() - 10 * DAY));
    await world.follow("asker", slug, new Date(Date.now() - 2 * DAY));
    expect(await world.asViewer("seller", () => followerCounts(slug, new Date(Date.now() - 7 * DAY)))).toEqual({
      total: 2,
      recent: 1,
    });
  });
}
