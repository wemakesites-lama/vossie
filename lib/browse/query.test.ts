import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { knownSlugs, parseBrowseParams, parseShown, toSearchQuery, type BrowseParams } from "./query";

const known = { campuses: new Set(["midrand", "pretoria"]), categories: new Set(["tech", "food"]) };
const parse = (params: BrowseParams, viewerCampus = "all") => parseBrowseParams(params, viewerCampus, known);

describe("parseBrowseParams (spec 3.2)", () => {
  it("reads every parameter", () => {
    expect(
      parse({
        q: " calculator ",
        cat: "tech",
        campus: "pretoria",
        price: "under-100",
        pay: "swap",
        deals: "free-and-swaps",
        sort: "price-low",
        n: "48",
      }),
    ).toEqual(
      makeBrowseQuery({
        q: "calculator",
        category: "tech",
        campus: "pretoria",
        campusFromLink: true,
        price: "under-100",
        pay: "swap",
        deals: "free-and-swaps",
        sort: "price-low",
        shown: 48,
      }),
    );
  });

  it("gives the defaults for a bare link", () => {
    expect(parse({})).toEqual(makeBrowseQuery());
  });

  it("sorts by best match by default with a search, and never without one", () => {
    expect(parse({ q: "lamp" }).sort).toBe("match");
    expect(parse({ q: "lamp", sort: "new" }).sort).toBe("new");
    expect(parse({ sort: "match" }).sort).toBe("new");
  });

  it("uses the viewer's campus when the link has none, and the link's when it has one", () => {
    expect(parse({}, "midrand")).toMatchObject({ campus: "midrand", campusFromLink: false });
    expect(parse({ campus: "all" }, "midrand")).toMatchObject({ campus: "all", campusFromLink: true });
    expect(parse({ campus: "pretoria" }, "midrand")).toMatchObject({ campus: "pretoria", campusFromLink: true });
    expect(parse({ campus: "atlantis" }, "midrand")).toMatchObject({ campus: "midrand", campusFromLink: false });
  });

  it("reads max as another name for price, and lets a valid price win", () => {
    expect(parse({ max: "50" }).price).toBe("under-50");
    expect(parse({ max: "500" }).price).toBe("under-500");
    expect(parse({ max: "75" }).price).toBeNull();
    expect(parse({ max: "constructor" }).price).toBeNull();
    expect(parse({ price: "free", max: "50" }).price).toBe("free");
    expect(parse({ price: "cheap", max: "50" }).price).toBe("under-50");
  });

  it("ignores unknown and empty values, and counts the first of a repeated parameter", () => {
    expect(parse({ cat: "spaceships", price: "", pay: "card", deals: "yes", sort: "random", q: "   " })).toEqual(
      makeBrowseQuery(),
    );
    expect(parse({ cat: ["food", "tech"], q: ["braids", "nails"] })).toMatchObject({ category: "food", q: "braids" });
  });

  it("cuts a long search to 100 characters", () => {
    expect(parse({ q: "a".repeat(150) }).q).toHaveLength(100);
  });
});

describe("parseShown", () => {
  it("rounds up to the next 24 and stops at 240", () => {
    expect(parseShown("48")).toBe(48);
    expect(parseShown("30")).toBe(48);
    expect(parseShown("1")).toBe(24);
    expect(parseShown("9999")).toBe(240);
  });

  it("ignores zero, negatives and anything that isn't a whole number", () => {
    for (const bad of ["0", "-24", "2.5", "abc", "", undefined]) expect(parseShown(bad)).toBe(24);
  });
});

describe("knownSlugs and toSearchQuery", () => {
  it("collects the slugs a link may name", () => {
    expect(knownSlugs([{ slug: "midrand" }], [{ slug: "tech" }])).toEqual({
      campuses: new Set(["midrand"]),
      categories: new Set(["tech"]),
    });
  });

  it("keeps what a search needs and drops the paging", () => {
    const query = makeBrowseQuery({ q: "lamp", campus: "midrand", campusFromLink: true, shown: 48 });
    expect(toSearchQuery(query)).toEqual({
      q: "lamp",
      category: null,
      campus: "midrand",
      price: null,
      pay: null,
      deals: null,
      sort: "new",
    });
  });
});
