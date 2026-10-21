import { afterEach, beforeEach, expect, it } from "vitest";
import { CLOSED_SHOP, countOffersSince, findOffer, offersForRequest } from "@/lib/data/offers";
import type { World } from "@/tests/contract/world";

// Offers on Looking For requests, the request side, in both backends (C4/C5 plan Task 5; amendments 3, 8 and 11): the
// asker's list of offers names each shop while it's there (a shop the Hub paused included: the shops policy lets the
// asker read it, amendment 3's probe), and "A closed shop" once its seller has gone; the shop's own offer and its daily
// count. offers.test.ts runs it on the sample store, offers.db.test.ts on the local stack.

const DAY = 86_400_000;

export function offersContract(makeWorld: () => World): void {
  let world: World;
  let slug: string;
  let request: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidySelling("shopper");
    await world.tidyMessaging();
    slug = await world.openShop("shopper", { name: "Contract lamps" });
    request = await world.addRequest({ asker: "asker", title: "A contract desk lamp", neededBy: null });
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const offers = () => world.asViewer("asker", () => offersForRequest(request));

  it("lists the request's offers for the asker: the shop, the offer's first line and when", async () => {
    const before = Date.now();
    const thread = await world.addOffer(slug, request, "I have one, R120.\nCollect at the library.");
    const listed = await offers();
    expect(listed).toEqual([{ conversationId: thread, shopName: "Contract lamps", preview: "I have one, R120.", offeredAt: expect.any(String) }]);
    expect(Date.parse(listed[0].offeredAt)).toBeGreaterThanOrEqual(before - 5_000);
    expect(listed[0].offeredAt).toBe(new Date(listed[0].offeredAt).toISOString());
  });

  it("still names a shop the Hub has paused", async () => {
    await world.addOffer(slug, request, "I have one, R120.");
    await world.pauseShop(slug, "staff");
    expect((await offers()).map((offer) => offer.shopName)).toEqual(["Contract lamps"]);
  });

  it("calls a shop whose seller has gone A closed shop, newest offer first", async () => {
    const first = await world.addOffer(slug, request, "I have one, R120.");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const gone = await world.offerFromGoneShop(request, "Mine is R90.");
    const listed = await offers();
    expect(listed.map((offer) => [offer.conversationId, offer.shopName, offer.preview])).toEqual([
      [gone, CLOSED_SHOP, ""],
      [first, "Contract lamps", "I have one, R120."],
    ]);
  });

  it("finds the shop's own offer on the request for its owner, and none for another shop", async () => {
    const thread = await world.addOffer(slug, request, "I have one, R120.");
    expect(await world.asViewer("shopper", () => findOffer(request, slug))).toBe(thread);
    const other = await world.addRequest({ asker: "asker", title: "A contract kettle", neededBy: null });
    expect(await world.asViewer("shopper", () => findOffer(other, slug))).toBeNull();
  });

  it("counts the shop's offers in the last day, for its limit", async () => {
    expect(await world.asViewer("shopper", () => countOffersSince(slug, new Date(Date.now() - DAY)))).toBe(0);
    await world.addOffer(slug, request, "I have one, R120.");
    expect(await world.asViewer("shopper", () => countOffersSince(slug, new Date(Date.now() - DAY)))).toBe(1);
    expect(await world.asViewer("shopper", () => countOffersSince(slug, new Date(Date.now() + 60_000)))).toBe(0);
  });
}
