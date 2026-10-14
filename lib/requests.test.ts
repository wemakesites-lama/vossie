import { describe, expect, it } from "vitest";
import { boardHref, readRequestCategory, splitByCampus } from "./requests";

const categories = [{ slug: "tech" }, { slug: "food" }];

describe("the board's category (community spec 4.1)", () => {
  it("reads a known category from ?cat=, and nothing else", () => {
    expect(readRequestCategory("tech", categories)).toBe("tech");
    expect(readRequestCategory(["food", "tech"], categories)).toBe("food");
    expect(readRequestCategory("nope", categories)).toBeNull();
    expect(readRequestCategory("", categories)).toBeNull();
    expect(readRequestCategory(undefined, categories)).toBeNull();
  });

  it("links to the board with one category, or with all of them", () => {
    expect(boardHref("tech")).toBe("/looking-for?cat=tech");
    expect(boardHref(null)).toBe("/looking-for");
  });
});

describe("splitByCampus (community spec 4.1)", () => {
  const items = [
    { id: "a", campusSlug: "pretoria" },
    { id: "b", campusSlug: "midrand" },
    { id: "c", campusSlug: "pretoria" },
  ];

  it("puts the viewer's campus first and every other campus after, each in the order given", () => {
    expect(splitByCampus(items, "pretoria")).toEqual({ own: [items[0], items[2]], others: [items[1]] });
    expect(splitByCampus(items, "mbombela")).toEqual({ own: [], others: items });
  });

  it("keeps one list when no campus is chosen", () => {
    expect(splitByCampus(items, "all")).toBeNull();
  });
});
