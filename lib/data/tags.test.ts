import { beforeEach, describe, expect, it, vi } from "vitest";

// The data layer's cached functions tag what they return, so a listing or shop write reaches every page that read
// it (selling plan decision 6). vitest.setup.ts stands cacheTag in with a no-op; here it's a spy.
const { cacheTag } = vi.hoisted(() => ({ cacheTag: vi.fn() }));
vi.mock("next/cache", () => ({
  cacheTag,
  cacheLife: () => {},
  updateTag: () => {},
  revalidateTag: () => {},
  refresh: () => {},
}));

import * as data from "./index";
import { resetSampleStore } from "./store";

beforeEach(() => {
  resetSampleStore();
  cacheTag.mockClear();
});

const LISTINGS: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ["getCollectionListings", () => data.getCollectionListings("moving-in")],
  ["getJustListed", () => data.getJustListed({ campus: "midrand", limit: 4 })],
  ["getRelatedListings", () => data.getRelatedListings({ categorySlug: "tech", campusSlug: "midrand", limit: 4 })],
  ["getFreeAndSwaps", () => data.getFreeAndSwaps({ campus: "midrand", limit: 4 })],
  ["getListingDetail", () => data.getListingDetail("l-001")],
  ["getMoreFrom", () => data.getMoreFrom({ id: "l-001", sellerSlug: "tech-corner", categorySlug: "tech", campusSlug: "midrand" }, 4)],
  ["searchListings", () => data.searchListings({} as Parameters<typeof data.searchListings>[0])],
  ["getListingIds", () => data.getListingIds()],
  ["getSellerListings", () => data.getSellerListings("tech-corner")],
  ["getListingsByIds", () => data.getListingsByIds(["l-001"])],
];

const SELLERS: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ["getVerifiedSellers", () => data.getVerifiedSellers()],
  ["getSeller", () => data.getSeller("tech-corner")],
  ["getSellerSlugs", () => data.getSellerSlugs()],
  ["isShopPaused", () => data.isShopPaused("tech-corner")],
];

// The staff tools' pickup points (staff tools plan decision 10, amendment 3): a listing's page names its point too.
const PICKUP_POINTS: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ["getPickupPoints", () => data.getPickupPoints()],
  ["getListingDetail", () => data.getListingDetail("l-001")],
];

describe("the data layer's cache tags (selling plan decision 6)", () => {
  it.each(LISTINGS)("%s is tagged listings and sellers", async (_name, read) => {
    await read().catch(() => undefined);
    expect(cacheTag).toHaveBeenCalledWith("listings", "sellers");
  });

  it.each(SELLERS)("%s is tagged sellers", async (_name, read) => {
    await read().catch(() => undefined);
    expect(cacheTag).toHaveBeenCalledWith("sellers");
  });

  it.each(PICKUP_POINTS)("%s is tagged pickup-points", async (_name, read) => {
    await read().catch(() => undefined);
    expect(cacheTag).toHaveBeenCalledWith("pickup-points");
  });

  it("leaves getFeatured uncached: it records the day's row (staff tools plan decision 9)", async () => {
    await data.getFeatured({ campus: "midrand", day: "2026-10-15" });
    expect(cacheTag).not.toHaveBeenCalled();
  });
});
