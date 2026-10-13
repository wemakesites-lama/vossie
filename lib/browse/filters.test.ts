import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { activeFilters, clearAllHref, clearFiltersHref, countActiveFilters, countLabel } from "./filters";

const names = new Map([["midrand", "Midrand"]]);

describe("activeFilters (spec 4.5)", () => {
  it("has no chips with no filters on", () => {
    expect(activeFilters(makeBrowseQuery(), names)).toEqual([]);
  });

  it("lists campus, price, pay and deals in that order, each with a link that removes only it", () => {
    const query = makeBrowseQuery({
      q: "lamp",
      sort: "match",
      campus: "midrand",
      price: "under-100",
      pay: "swap",
      deals: "free-and-swaps",
    });
    expect(activeFilters(query, names)).toEqual([
      {
        key: "campus",
        label: "Midrand",
        removeHref: "/browse?q=lamp&campus=all&price=under-100&pay=swap&deals=free-and-swaps",
      },
      { key: "price", label: "Under R100", removeHref: "/browse?q=lamp&pay=swap&deals=free-and-swaps" },
      { key: "pay", label: "Swaps", removeHref: "/browse?q=lamp&price=under-100&deals=free-and-swaps" },
      { key: "deals", label: "Free & swaps", removeHref: "/browse?q=lamp&price=under-100&pay=swap" },
    ]);
  });

  it("names Free and Cash", () => {
    const labels = activeFilters(makeBrowseQuery({ price: "free", pay: "cash" }), names).map((chip) => chip.label);
    expect(labels).toEqual(["Free", "Cash"]);
  });
});

describe("counting and clearing", () => {
  it("counts the campus (unless every campus), price, pay and deals", () => {
    expect(countActiveFilters(makeBrowseQuery())).toBe(0);
    expect(countActiveFilters(makeBrowseQuery({ campus: "midrand", price: "free" }))).toBe(2);
  });

  it("clears everything but the search, category and sort, and switches to every campus", () => {
    const query = makeBrowseQuery({
      q: "lamp",
      category: "res-living",
      campus: "midrand",
      price: "free",
      sort: "price-low",
      shown: 48,
    });
    expect(clearAllHref(query)).toBe("/browse?q=lamp&cat=res-living&campus=all&sort=price-low");
  });

  it("clears the filters but keeps the campus for the empty state", () => {
    const query = makeBrowseQuery({ campus: "midrand", campusFromLink: true, pay: "cash", deals: "free-and-swaps" });
    expect(clearFiltersHref(query)).toBe("/browse?campus=midrand");
  });
});

describe("countLabel (spec 4.6)", () => {
  it("counts listings, or says how many of how many are showing", () => {
    expect(countLabel(1, 1)).toBe("1 listing");
    expect(countLabel(29, 29)).toBe("29 listings");
    expect(countLabel(36, 24)).toBe("Showing 24 of 36");
  });
});
