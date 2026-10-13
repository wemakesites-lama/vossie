import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { collectionBrowseLinks, matchesRule } from "./collections";
import type { CollectionRule } from "./types";

const categories = [
  { slug: "res-living", name: "Res & living" },
  { slug: "services", name: "Services" },
  { slug: "tutoring", name: "Tutoring" },
];

const resUnder500: CollectionRule = { categories: ["res-living"], maxPrice: 500 };
const skills: CollectionRule = { categories: ["services", "tutoring"] };

describe("matchesRule (shopping spec 6.2)", () => {
  it("takes listings in the rule's categories only", () => {
    expect(matchesRule(makeListing({ categorySlug: "services" }), skills)).toBe(true);
    expect(matchesRule(makeListing({ categorySlug: "food" }), skills)).toBe(false);
  });

  it("keeps to the cap: the cap itself and free listings count, dearer and swap-only ones don't", () => {
    const res = (priceZar: number | null) => makeListing({ categorySlug: "res-living", priceZar });
    expect(matchesRule(res(500), resUnder500)).toBe(true);
    expect(matchesRule(res(0), resUnder500)).toBe(true);
    expect(matchesRule(res(501), resUnder500)).toBe(false);
    expect(matchesRule(res(null), resUnder500)).toBe(false);
  });

  it("takes swap-only listings when there's no cap", () => {
    expect(matchesRule(makeListing({ categorySlug: "services", priceZar: null, payMode: "swap" }), skills)).toBe(true);
  });
});

describe("collectionBrowseLinks (shopping spec 7.2)", () => {
  it("links to each category in browse, keeping the cap", () => {
    expect(collectionBrowseLinks(resUnder500, categories)).toEqual([
      { label: "More in Res & living under R500", href: "/browse?cat=res-living&max=500" },
    ]);
  });

  it("follows the rule's order without a cap, and skips a category that doesn't exist", () => {
    expect(collectionBrowseLinks({ categories: ["tutoring", "nope", "services"] }, categories)).toEqual([
      { label: "More in Tutoring", href: "/browse?cat=tutoring" },
      { label: "More in Services", href: "/browse?cat=services" },
    ]);
  });
});
