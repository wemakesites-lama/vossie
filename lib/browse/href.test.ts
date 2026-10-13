import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { browseHref } from "./href";

describe("browseHref (spec 3.3)", () => {
  it("leaves out every default", () => {
    expect(browseHref(makeBrowseQuery())).toBe("/browse");
  });

  it("writes the parameters in a fixed order", () => {
    const everything = makeBrowseQuery({
      q: "box braids",
      category: "hair-beauty",
      campus: "midrand",
      campusFromLink: true,
      price: "under-500",
      pay: "cash",
      deals: "free-and-swaps",
      sort: "price-low",
      shown: 48,
    });
    expect(browseHref(everything)).toBe(
      "/browse?q=box+braids&cat=hair-beauty&campus=midrand&price=under-500&pay=cash&deals=free-and-swaps&sort=price-low&n=48",
    );
  });

  it("writes the campus only when it came from the link or is being changed", () => {
    const fromCookie = makeBrowseQuery({ campus: "midrand", campusFromLink: false });
    expect(browseHref(fromCookie)).toBe("/browse");
    expect(browseHref(fromCookie, { category: "tech" })).toBe("/browse?cat=tech");
    expect(browseHref(fromCookie, { campus: "all" })).toBe("/browse?campus=all");
  });

  it("drops the default sort: best match with a search, newest without", () => {
    expect(browseHref(makeBrowseQuery({ q: "lamp", sort: "match" }))).toBe("/browse?q=lamp");
    expect(browseHref(makeBrowseQuery({ q: "lamp", sort: "new" }))).toBe("/browse?q=lamp&sort=new");
    expect(browseHref(makeBrowseQuery({ sort: "match" }))).toBe("/browse");
  });

  it("keeps n for Show more and for the same page, and drops it for any other change", () => {
    const second = makeBrowseQuery({ shown: 48 });
    expect(browseHref(second)).toBe("/browse?n=48");
    expect(browseHref(second, { shown: 72 })).toBe("/browse?n=72");
    expect(browseHref(second, { category: "food" })).toBe("/browse?cat=food");
    expect(browseHref(second, { sort: "price-high" })).toBe("/browse?sort=price-high");
  });
});
