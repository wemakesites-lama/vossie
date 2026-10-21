import { beforeEach, describe, expect, it } from "vitest";
import { listings } from "@/data/fixtures/listings";
import { sellers } from "@/data/fixtures/sellers";
import { makeListingRow } from "@/tests/helpers/fakes";
import {
  listedListings,
  liveSellerRows,
  publicListing,
  publicListingIds,
  sellerFor,
  shopStatus,
  storefrontRow,
  toListing,
  toSeller,
} from "./catalog";
import { resetSampleStore, sampleStore } from "./store";

beforeEach(() => {
  resetSampleStore();
});

describe("the store as buyers see it (selling spec 2.1, plan decision 7)", () => {
  it("gives back every sample listing exactly as the fixture has it", () => {
    for (const listing of listings) expect(publicListing(listing.id), listing.id).toEqual(listing);
    expect(listedListings()).toEqual(listings.filter((listing) => listing.availability === "available"));
  });

  it("gives back every sample seller exactly as the fixture has it", () => {
    for (const seller of sellers) expect(sellerFor(seller.slug), seller.slug).toEqual(seller);
    expect(liveSellerRows().map((row) => row.slug)).toEqual(sellers.map((seller) => seller.slug));
  });
});

describe("which shops are open (plan decisions 1 and 2)", () => {
  it("takes a shop's status from its owner's seller profile, and opens every sample shop no one owns", () => {
    const rows = sampleStore().sellers;
    expect(shopStatus(rows.get("hair-studio")!)).toBe("approved");
    expect(shopStatus(rows.get("tech-corner")!)).toBe("approved");
    expect(shopStatus(rows.get("crochet-corner")!)).toBe("pending");
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(shopStatus(rows.get("tech-corner")!)).toBe("paused");
    // An owned shop whose profile has gone shows nowhere.
    sampleStore().sellerProfiles.delete("acc-seller");
    expect(shopStatus(rows.get("tech-corner")!)).toBe("pending");
  });

  it("keeps a paused shop's storefront and pages, marked paused, and leaves it out of every list", () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(storefrontRow("tech-corner")?.name).toBe("Tech corner");
    expect(publicListing("l-001")?.availability).toBe("paused");
    expect(listedListings().some((listing) => listing.sellerSlug === "tech-corner")).toBe(false);
    expect(liveSellerRows().some((row) => row.slug === "tech-corner")).toBe(false);
    expect(publicListingIds()).toContain("l-001");
  });

  it("makes a shop the Hub paused disappear: no storefront, no listing pages, no place in the lists (spec 2.3)", () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff" });
    expect(storefrontRow("tech-corner")).toBeNull();
    expect(sellerFor("tech-corner")).toBeNull();
    expect(publicListing("l-001")).toBeNull();
    expect(publicListingIds()).not.toContain("l-001");
    expect(listedListings().some((listing) => listing.sellerSlug === "tech-corner")).toBe(false);
    expect(liveSellerRows().some((row) => row.slug === "tech-corner")).toBe(false);
  });

  it("gives a waiting shop no storefront, and its listings no pages", () => {
    sampleStore().listings.set(
      "l-crochet",
      makeListingRow({ id: "l-crochet", sellerSlug: "crochet-corner", campusSlug: "pretoria", pickupPointId: null }),
    );
    expect(storefrontRow("crochet-corner")).toBeNull();
    expect(publicListing("l-crochet")).toBeNull();
    expect(publicListingIds()).not.toContain("l-crochet");
  });

  it("keeps drafts to their seller", () => {
    sampleStore().listings.get("l-001")!.state = "draft";
    expect(publicListing("l-001")).toBeNull();
    expect(listedListings().some((listing) => listing.id === "l-001")).toBe(false);
    expect(publicListingIds()).not.toContain("l-001");
  });
});

describe("pictures (selling spec 2.5 and 2.6)", () => {
  it("shows a listing's category picture when it has no photos, and its title for an empty description", () => {
    const shop = sampleStore().sellers.get("tech-corner")!;
    expect(toListing(makeListingRow({ title: "Desk fan", categorySlug: "res-living", photos: [] }), shop)).toMatchObject({
      image: { src: "/placeholders/listing/res-living.svg", alt: "Desk fan" },
      morePhotos: [],
      badge: "responsive",
    });
    const photos = [
      { src: "/photos/ph-1", alt: "" },
      { src: "/photos/ph-2", alt: "The plug" },
    ];
    expect(toListing(makeListingRow({ title: "Desk fan", photos }), shop)).toMatchObject({
      image: { src: "/photos/ph-1", alt: "Desk fan" },
      morePhotos: [{ src: "/photos/ph-2", alt: "The plug" }],
    });
  });

  it("shows a shop's category picture when it has no photo", () => {
    expect(toSeller(sampleStore().sellers.get("crochet-corner")!)).toMatchObject({
      category: "Fashion & thrift",
      image: { src: "/placeholders/category/fashion-thrift.svg", alt: "" },
    });
  });
});

describe("hidden listings (staff tools plan decision 4)", () => {
  it("keeps a listing the Hub hid out of every list, and gives it no page", () => {
    Object.assign(sampleStore().listings.get("l-007")!, {
      hiddenAt: "2026-10-14T08:00:00.000Z",
      hiddenReason: "Not allowed on CampusCart.",
    });
    expect(listedListings().some((listing) => listing.id === "l-007")).toBe(false);
    expect(publicListing("l-007")).toBeNull();
    expect(publicListingIds()).not.toContain("l-007");
  });
});
