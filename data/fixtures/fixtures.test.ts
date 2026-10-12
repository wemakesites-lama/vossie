import { describe, expect, it } from "vitest";
import { campuses } from "./campuses";
import { categories } from "./categories";
import { collections } from "./collections";
import { freeSwapItems } from "./free-swaps";
import { heroSlides } from "./hero";
import { hubBanner, hubEvents } from "./hub";
import { listings } from "./listings";
import { requests } from "./requests";
import { sellers } from "./sellers";

const campusSlugs = new Set(campuses.map((campus) => campus.slug));
const isUnique = (values: readonly string[]) => new Set(values).size === values.length;

describe("homepage fixtures (spec section 13)", () => {
  it("has three hero slides, each opening one of the categories", () => {
    expect(heroSlides.map((slide) => slide.word)).toEqual(["textbooks", "tech", "services"]);
    const categoryPaths = new Set(categories.map((category) => `/categories/${category.slug}`));
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

  it("gives every listing a known campus, a real time and a price that matches how it's paid", () => {
    for (const listing of listings) {
      expect(campusSlugs.has(listing.campusSlug)).toBe(true);
      expect(Number.isNaN(Date.parse(listing.createdAt))).toBe(false);
      if (listing.payMode === "swap") expect(listing.priceZar).toBeNull();
      else expect(listing.priceZar).toBeGreaterThan(0);
    }
  });

  it("keeps ids unique across listings and free and swap items, so one listing page finds either", () => {
    expect(isUnique([...listings, ...freeSwapItems].map((item) => item.id))).toBe(true);
  });

  it("puts sellers, requests and free and swap items on known campuses", () => {
    for (const item of [...sellers, ...requests, ...freeSwapItems]) expect(campusSlugs.has(item.campusSlug)).toBe(true);
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
