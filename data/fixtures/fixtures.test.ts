import { describe, expect, it } from "vitest";
import { parseSavedIds } from "@/lib/saved";
import { campuses } from "./campuses";
import { categories } from "./categories";
import { collections } from "./collections";
import { heroSlides } from "./hero";
import { hubBanner, hubEvents } from "./hub";
import { listings } from "./listings";
import { pickupPoints } from "./pickup-points";
import { requests } from "./requests";
import { sellers } from "./sellers";

const campusSlugs = new Set(campuses.map((campus) => campus.slug));
const categorySlugs = new Set(categories.map((category) => category.slug));
const sellersBySlug = new Map(sellers.map((seller) => [seller.slug, seller]));
const pointsById = new Map(pickupPoints.map((point) => [point.id, point]));
const isUnique = (values: readonly string[]) => new Set(values).size === values.length;

describe("homepage fixtures (spec section 13)", () => {
  it("has three hero slides, each opening one of the categories", () => {
    expect(heroSlides.map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    const categoryPaths = new Set(categories.map((category) => `/browse?cat=${category.slug}`));
    for (const slide of heroSlides) expect(categoryPaths.has(slide.cta.href)).toBe(true);
  });

  it("has four collections with unique slugs", () => {
    expect(collections).toHaveLength(4);
    expect(isUnique(collections.map((collection) => collection.slug))).toBe(true);
  });

  it("lists items on every campus but Mbombela, so the empty state can be tested", () => {
    const withListings = new Set(listings.map((listing) => listing.campusSlug));
    expect(campuses.filter((campus) => !withListings.has(campus.slug)).map((campus) => campus.slug)).toEqual([
      "mbombela",
    ]);
  });

  it("has at least ten listings at Midrand, to fill the desktop grid", () => {
    expect(listings.filter((listing) => listing.campusSlug === "midrand").length).toBeGreaterThanOrEqual(10);
  });

  it("puts sellers and requests on known campuses", () => {
    for (const item of [...sellers, ...requests]) expect(campusSlugs.has(item.campusSlug)).toBe(true);
    expect(isUnique(sellers.map((seller) => seller.slug))).toBe(true);
  });

  it("dates Hub events as YYYY-MM-DD at a known campus or every campus", () => {
    for (const event of hubEvents) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.campusSlug === "all" || campusSlugs.has(event.campusSlug)).toBe(true);
    }
    expect(hubBanner.image.src).toMatch(/^\/placeholders\//);
  });
});

describe("listing fixtures (browse and listing spec 6.2)", () => {
  it("gives every listing a unique id, a known campus and category, and a real time", () => {
    expect(isUnique(listings.map((listing) => listing.id))).toBe(true);
    for (const listing of listings) {
      expect(campusSlugs.has(listing.campusSlug), listing.id).toBe(true);
      expect(categorySlugs.has(listing.categorySlug), listing.id).toBe(true);
      // UTC to the second, with a Z: the newest-first sorts compare these as text.
      expect(listing.createdAt, listing.id).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      expect(Number.isNaN(Date.parse(listing.createdAt)), listing.id).toBe(false);
    }
  });

  it("gives every listing an id the saved cookie can hold, or its heart would fail with \"Couldn't update\"", () => {
    for (const listing of listings) expect(parseSavedIds(listing.id), listing.id).toEqual([listing.id]);
  });

  it("gives every listing a seller on the listing's own campus", () => {
    for (const listing of listings) {
      expect(sellersBySlug.get(listing.sellerSlug)?.campusSlug, listing.id).toBe(listing.campusSlug);
    }
  });

  it("has no price exactly when a listing is swap-only, and swap terms exactly when it takes swaps", () => {
    for (const listing of listings) {
      expect(listing.priceZar === null, listing.id).toBe(listing.payMode === "swap");
      if (listing.priceZar !== null) expect(listing.priceZar, listing.id).toBeGreaterThanOrEqual(0);
      expect(listing.swapFor !== null, listing.id).toBe(listing.payMode !== "cash");
    }
  });

  it("names a pickup point on the listing's own campus exactly when the handover is a pickup", () => {
    for (const listing of listings) {
      expect(listing.pickupPointId !== null, listing.id).toBe(listing.handover === "pickup");
      if (listing.pickupPointId) {
        expect(pointsById.get(listing.pickupPointId)?.campusSlug, listing.id).toBe(listing.campusSlug);
      }
    }
  });

  it("gives items a condition and services none, and hands over online at Eduvos Online", () => {
    for (const listing of listings) {
      expect(listing.condition === null, listing.id).toBe(listing.kind === "service");
      if (listing.campusSlug === "online") expect(listing.handover, listing.id).toBe("online");
    }
  });

  it("has at most five more photos per listing, and at least three listings with more than one", () => {
    for (const listing of listings) expect(listing.morePhotos.length, listing.id).toBeLessThanOrEqual(5);
    expect(listings.filter((listing) => listing.morePhotos.length > 0).length).toBeGreaterThanOrEqual(3);
  });

  it("uses every way of handing over, so each collect box wording can be tested", () => {
    expect(new Set(listings.map((listing) => listing.handover))).toEqual(
      new Set(["pickup", "on-campus", "on-campus-or-online", "online"]),
    );
  });

  it("has paused, sold, free and swap-only listings, to test those states", () => {
    expect(listings.some((listing) => listing.availability === "paused")).toBe(true);
    expect(listings.some((listing) => listing.availability === "sold")).toBe(true);
    expect(listings.some((listing) => listing.priceZar === 0)).toBe(true);
    expect(listings.some((listing) => listing.payMode === "swap")).toBe(true);
  });

  it("has pickup points with unique ids on the physical campuses only", () => {
    expect(isUnique(pickupPoints.map((point) => point.id))).toBe(true);
    expect(new Set(pickupPoints.map((point) => point.campusSlug))).toEqual(
      new Set(campuses.filter((campus) => campus.slug !== "online").map((campus) => campus.slug)),
    );
  });
});

describe("seller and collection fixtures (shopping spec 6.1)", () => {
  it("gives every seller an about, a start month and a known category with its own name", () => {
    for (const seller of sellers) {
      expect(seller.about.trim().length, seller.slug).toBeGreaterThan(0);
      expect(seller.since, seller.slug).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(seller.since <= "2026-10", seller.slug).toBe(true);
      expect(categories.find((category) => category.slug === seller.categorySlug)?.name, seller.slug).toBe(
        seller.category,
      );
    }
  });

  it("gives every listing its seller's trust badge", () => {
    for (const listing of listings) {
      expect(listing.badge, listing.id).toBe(sellersBySlug.get(listing.sellerSlug)?.badge);
    }
  });

  it("has a seller with nothing available, so the storefront's empty state can be tested", () => {
    const selling = new Set(
      listings.filter((listing) => listing.availability === "available").map((listing) => listing.sellerSlug),
    );
    expect(sellers.filter((seller) => !selling.has(seller.slug)).map((seller) => seller.slug)).toContain("lash-lounge");
  });

  it("builds every collection from known categories, with an intro", () => {
    for (const collection of collections) {
      expect(collection.intro.length, collection.slug).toBeGreaterThan(0);
      expect(collection.rule.categories.length, collection.slug).toBeGreaterThan(0);
      for (const slug of collection.rule.categories) expect(categorySlugs.has(slug), collection.slug).toBe(true);
    }
  });
});
