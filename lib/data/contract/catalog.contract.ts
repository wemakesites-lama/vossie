import { afterEach, beforeEach, expect, it } from "vitest";
import {
  getJustListed,
  getListingDetail,
  getListingIds,
  getSeller,
  getSellerListings,
  getSellerSlugs,
  getVerifiedSellers,
  searchListings,
} from "@/lib/data";
import type { SearchQuery } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// The catalog in both backends (2b plan Task 15, decision 17): which listings and shops buyers see, and where. A
// listing the Hub hid has no page and is in no list; a shop its seller paused keeps its storefront and its listing
// pages, marked paused, and leaves every list; a shop the Hub paused disappears; a draft has no page.
// catalog.test.ts runs it on the sample store, catalog.db.test.ts on the local stack.

/** Tech corner: the one sample shop an account owns that is open (Thabo's, acc-seller), with l-001 among its listings. */
const OWNED_SHOP = "tech-corner";
const ITS_LISTING = "l-001";

const EVERYTHING: SearchQuery = { q: null, category: null, campus: "all", price: null, pay: null, deals: null, sort: "new" };

async function justListedIds(): Promise<string[]> {
  return (await getJustListed({ campus: "all", limit: 1_000 })).map((listing) => listing.id);
}

async function searchedIds(): Promise<string[]> {
  return (await searchListings(EVERYTHING)).items.map((listing) => listing.id);
}

export function catalogContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("starts with the owned shop open and its listing on show", async () => {
    expect((await getSeller(OWNED_SHOP))?.slug).toBe(OWNED_SHOP);
    expect(await getSellerSlugs()).toContain(OWNED_SHOP);
    expect((await getListingDetail(ITS_LISTING))?.listing.availability).toBe("available");
    expect(await justListedIds()).toContain(ITS_LISTING);
    expect(await searchedIds()).toContain(ITS_LISTING);
    expect(await getListingIds()).toContain(ITS_LISTING);
  });

  it("leaves a hidden listing out of every list, and gives it no page", async () => {
    await world.hideListing(ITS_LISTING, "Not allowed on Vossie.");
    expect(await justListedIds()).not.toContain(ITS_LISTING);
    expect(await searchedIds()).not.toContain(ITS_LISTING);
    expect(await getListingIds()).not.toContain(ITS_LISTING);
    expect((await getSellerListings(OWNED_SHOP)).map((listing) => listing.id)).not.toContain(ITS_LISTING);
    expect(await getListingDetail(ITS_LISTING)).toBeNull();
  });

  it("keeps a shop its seller paused, with its listing pages marked paused, and leaves it out of every list", async () => {
    await world.pauseShop(OWNED_SHOP, "seller");
    expect((await getSeller(OWNED_SHOP))?.slug).toBe(OWNED_SHOP);
    expect((await getListingDetail(ITS_LISTING))?.listing.availability).toBe("paused");
    expect((await getListingDetail(ITS_LISTING))?.seller.slug).toBe(OWNED_SHOP);
    expect(await getSellerSlugs()).not.toContain(OWNED_SHOP);
    expect((await getVerifiedSellers()).map((seller) => seller.slug)).not.toContain(OWNED_SHOP);
    expect(await justListedIds()).not.toContain(ITS_LISTING);
    expect(await searchedIds()).not.toContain(ITS_LISTING);
    expect(await getListingIds()).toContain(ITS_LISTING);
  });

  it("takes away a shop the Hub paused, storefront and listing pages", async () => {
    await world.pauseShop(OWNED_SHOP, "staff");
    expect(await getSeller(OWNED_SHOP)).toBeNull();
    expect(await getListingDetail(ITS_LISTING)).toBeNull();
    expect(await getSellerSlugs()).not.toContain(OWNED_SHOP);
    expect(await getListingIds()).not.toContain(ITS_LISTING);
    expect(await justListedIds()).not.toContain(ITS_LISTING);
  });

  it("gives a draft no page", async () => {
    await world.draftListing(ITS_LISTING);
    expect(await getListingDetail(ITS_LISTING)).toBeNull();
    expect(await getListingIds()).not.toContain(ITS_LISTING);
    expect(await justListedIds()).not.toContain(ITS_LISTING);
  });
}
