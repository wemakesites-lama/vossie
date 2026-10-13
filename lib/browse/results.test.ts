import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import type { Listing, SearchQuery } from "@/lib/types";
import { findListings, passesFilters } from "./results";

const names = {
  sellers: new Map([["tech-corner", "Tech corner"]]),
  categories: new Map([["tech", "Tech"]]),
};

const search = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  sort: "new",
  ...overrides,
});

const ids = (items: readonly Listing[]) => items.map((listing) => listing.id);

const free = makeListing({ id: "free", priceZar: 0, createdAt: "2026-10-01T10:00:00Z" });
const cheap = makeListing({ id: "cheap", priceZar: 50, createdAt: "2026-10-02T10:00:00Z" });
const dear = makeListing({ id: "dear", priceZar: 400, createdAt: "2026-10-03T10:00:00Z" });
const swapOnly = makeListing({ id: "swap", priceZar: null, payMode: "swap", swapFor: "a kettle", createdAt: "2026-10-04T10:00:00Z" });
const either = makeListing({ id: "either", priceZar: 120, payMode: "both", swapFor: "a lamp", createdAt: "2026-10-05T10:00:00Z" });
const all = [free, cheap, dear, swapOnly, either];

describe("passesFilters (spec 4.9)", () => {
  it("reads price=free as R0 and under-N as N or less, free included, swap-only left out", () => {
    expect(all.filter((listing) => passesFilters(listing, search({ price: "free" }))).map((l) => l.id)).toEqual(["free"]);
    expect(all.filter((listing) => passesFilters(listing, search({ price: "under-50" }))).map((l) => l.id)).toEqual([
      "free",
      "cheap",
    ]);
  });

  it("reads pay=cash as cash or both (free counts as cash) and pay=swap as swap or both", () => {
    expect(all.filter((listing) => passesFilters(listing, search({ pay: "cash" }))).map((l) => l.id)).toEqual([
      "free",
      "cheap",
      "dear",
      "either",
    ]);
    expect(all.filter((listing) => passesFilters(listing, search({ pay: "swap" }))).map((l) => l.id)).toEqual([
      "swap",
      "either",
    ]);
  });

  it("reads deals as free, or taking swaps", () => {
    expect(all.filter((listing) => passesFilters(listing, search({ deals: "free-and-swaps" }))).map((l) => l.id)).toEqual([
      "free",
      "swap",
      "either",
    ]);
  });
});

describe("findListings (spec 4.8, 4.9)", () => {
  it("sorts newest first, and leaves out paused and sold listings", () => {
    const paused = makeListing({ id: "paused", availability: "paused", createdAt: "2026-10-09T10:00:00Z" });
    const sold = makeListing({ id: "sold", availability: "sold", createdAt: "2026-10-09T10:00:00Z" });
    expect(ids(findListings([...all, paused, sold], search(), names).items)).toEqual([
      "either",
      "swap",
      "dear",
      "cheap",
      "free",
    ]);
  });

  it("sorts by price both ways, swap-only last, ties newest first", () => {
    const twin = makeListing({ id: "twin", priceZar: 50, createdAt: "2026-10-06T10:00:00Z" });
    expect(ids(findListings([...all, twin], search({ sort: "price-low" }), names).items)).toEqual([
      "free",
      "twin",
      "cheap",
      "either",
      "dear",
      "swap",
    ]);
    expect(ids(findListings(all, search({ sort: "price-high" }), names).items)).toEqual([
      "dear",
      "either",
      "cheap",
      "free",
      "swap",
    ]);
  });

  it("keeps one category, and counts matches at other campuses", () => {
    const food = makeListing({ id: "food", categorySlug: "food" });
    const pretoria = makeListing({ id: "pretoria", campusSlug: "pretoria" });
    const result = findListings([...all, food, pretoria], search({ category: "tech", campus: "midrand" }), names);
    expect(ids(result.items)).not.toContain("food");
    expect(ids(result.items)).not.toContain("pretoria");
    expect(result.elsewhere).toBe(1);
  });

  it("searches the title, category, seller name and description, best match first", () => {
    const inTitle = makeListing({ id: "title", title: "Gaming headset", createdAt: "2026-10-01T10:00:00Z" });
    const inDescription = makeListing({
      id: "description",
      title: "Speaker",
      description: "Works with any headset.",
      createdAt: "2026-10-09T10:00:00Z",
    });
    const bySeller = makeListing({ id: "seller", title: "Cable", description: "" });
    const result = findListings([inTitle, inDescription, bySeller], search({ q: "headset", sort: "match" }), names);
    expect(ids(result.items)).toEqual(["title", "description"]);
    expect(ids(findListings([bySeller], search({ q: "corner", sort: "match" }), names).items)).toEqual(["seller"]);
  });
});
