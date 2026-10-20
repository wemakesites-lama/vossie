import { describe, expect, it } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { knownSlugs } from "@/lib/browse/query";
import type { MatchQuery } from "@/lib/types";
import {
  browseFrom,
  filterWords,
  isWorthSaving,
  matchQueryOf,
  SAVED_SEARCH_LIMIT,
  SAVED_SEARCHES_FORM,
  SAVED_SEARCHES_PATH,
  saveNoteOf,
  saveSearchNoteKey,
  savedSearchFrom,
  savedSearchHref,
  savedSearchLabel,
  savedSearchNoticeOf,
  searchKey,
} from "./rules";

const KNOWN = knownSlugs(campuses, categories);
const NAMES = {
  categories: new Map(categories.map((category) => [category.slug, category.name])),
  campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
};

const search = (overrides: Partial<MatchQuery> = {}): MatchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

describe("a saved search from Save this search's fields (search alerts spec 2.1, plan decision 2)", () => {
  it("reads them as browse reads its link, dropping sort and n", () => {
    const posted = {
      q: "  calculator ",
      cat: "tech",
      campus: "midrand",
      price: "under-100",
      pay: "cash",
      sort: "price-low",
      n: "48",
    };
    expect(savedSearchFrom(posted, KNOWN)).toEqual(
      search({ q: "calculator", category: "tech", campus: "midrand", price: "under-100", pay: "cash" }),
    );
  });

  it("takes browse's max alias, ignores unknown values and cuts the words at 100 characters", () => {
    const posted = { q: "x".repeat(120), cat: "nope", campus: "nowhere", max: "250", pay: "card", deals: "free-and-swaps" };
    expect(savedSearchFrom(posted, KNOWN)).toEqual(
      search({ q: "x".repeat(100), price: "under-250", deals: "free-and-swaps" }),
    );
  });

  it("always has a campus: the one posted, or every campus", () => {
    expect(savedSearchFrom({ q: "lamp", campus: "online" }, KNOWN).campus).toBe("online");
    expect(savedSearchFrom({ q: "lamp" }, KNOWN).campus).toBe("all");
  });

  it("keeps no words when there are only stop words and single letters", () => {
    expect(savedSearchFrom({ q: "the a", cat: "tech" }, KNOWN)).toEqual(search({ category: "tech" }));
    expect(matchQueryOf(search({ q: "Accounting 1" })).q).toBe("Accounting 1");
  });
});

describe("what's worth saving, and when two are the same (spec 2.4, plan decision 3)", () => {
  it("needs words, a category or a filter; a campus alone isn't a search", () => {
    expect(isWorthSaving(search({ campus: "midrand" }))).toBe(false);
    expect(isWorthSaving(search({ q: "the" }))).toBe(false);
    expect(isWorthSaving(search({ q: "lamp" }))).toBe(true);
    expect(isWorthSaving(search({ category: "tech" }))).toBe(true);
    expect(isWorthSaving(search({ price: "free" }))).toBe(true);
    expect(isWorthSaving(search({ pay: "swap" }))).toBe(true);
    expect(isWorthSaving(search({ deals: "free-and-swaps" }))).toBe(true);
    expect(SAVED_SEARCH_LIMIT).toBe(20);
  });

  it("treats word order, case, accents, stop words and repeats as the same search, and any other filter as another", () => {
    const key = searchKey(search({ q: "Calculator casio", campus: "midrand" }));
    expect(searchKey(search({ q: "casio calculator", campus: "midrand" }))).toBe(key);
    expect(searchKey(search({ q: "CÁSIO the calculator calculator", campus: "midrand" }))).toBe(key);
    expect(searchKey(search({ q: "casio calculator", campus: "pretoria" }))).not.toBe(key);
    expect(searchKey(search({ q: "casio calculator", campus: "midrand", pay: "cash" }))).not.toBe(key);
    expect(searchKey(search({ q: "casio", campus: "midrand" }))).not.toBe(key);
  });
});

describe("the label (spec 2.3, plan decision 4)", () => {
  it("names the words, the category, the campus, then the filters in the chips' words and order", () => {
    const label = (overrides: Partial<MatchQuery>) => savedSearchLabel(search(overrides), NAMES);
    expect(label({ q: "calculator", category: "tech", campus: "midrand", price: "under-100" })).toBe(
      "“calculator” in Tech at Midrand, under R100",
    );
    expect(label({ q: "calculator", campus: "midrand" })).toBe("“calculator” at Midrand");
    expect(label({ category: "tech" })).toBe("Tech at every campus");
    expect(label({ campus: "online", price: "free" })).toBe("Everything on Eduvos Online, free");
    expect(label({ category: "res-living", campus: "pretoria", pay: "swap", deals: "free-and-swaps" })).toBe(
      "Res & living at Pretoria, swaps, free & swaps",
    );
    expect(filterWords(search({ price: "under-500", pay: "cash" }))).toEqual(["under R500", "cash"]);
  });
});

describe("links (spec 2.5, 2.7 and 2.12; plan decisions 5 and 9)", () => {
  it("opens a saved search's results with the campus pinned: Best match with words, Newest without", () => {
    expect(savedSearchHref(search({ q: "casio calculator", campus: "midrand" }))).toBe(
      "/browse?q=casio+calculator&campus=midrand",
    );
    expect(savedSearchHref(search({ category: "tech" }))).toBe("/browse?cat=tech&campus=all");
  });

  it("opens them Newest first for a notification about several", () => {
    expect(savedSearchHref(search({ q: "calculator", campus: "midrand" }), "new")).toBe(
      "/browse?q=calculator&campus=midrand&sort=new",
    );
    expect(savedSearchHref(search({ category: "tech" }), "new")).toBe("/browse?cat=tech&campus=all");
  });

  it("goes back only to a browse link on this site", () => {
    expect(browseFrom("/browse?q=lamp&campus=midrand")).toBe("/browse?q=lamp&campus=midrand");
    expect(browseFrom("/browse")).toBe("/browse");
    expect(browseFrom("/browsers")).toBeNull();
    expect(browseFrom("/saved")).toBeNull();
    expect(browseFrom("//evil.example/browse")).toBeNull();
    expect(browseFrom("https://evil.example/browse")).toBeNull();
    expect(browseFrom("")).toBeNull();
  });

  it("keeps the Searches tab's address and the status lines' keys", () => {
    expect(SAVED_SEARCHES_PATH).toBe("/saved?tab=searches");
    expect(SAVED_SEARCHES_FORM).toBe("saved-searches");
    expect(saveSearchNoteKey(search({ q: "Casio calculator", campus: "midrand" }))).toBe(
      "save-search:calculator casio||midrand|||",
    );
  });
});

describe("status lines (plan decision 7)", () => {
  it("reads what the last Save this search said", () => {
    expect(saveNoteOf({ errors: [], notice: "saved" })).toBe("saved");
    expect(saveNoteOf({ errors: ["already"], notice: null })).toBe("already");
    expect(saveNoteOf({ errors: ["limit"], notice: null })).toBe("limit");
    expect(saveNoteOf({ errors: ["toString"], notice: null })).toBeNull();
    expect(saveNoteOf(null)).toBeNull();
  });

  it("reads what the Searches tab's last press did, to which search", () => {
    const values = { label: "“lamp” at Midrand", href: "/browse?q=lamp&campus=midrand" };
    expect(savedSearchNoticeOf({ notice: "deleted", values })).toEqual({ code: "deleted", ...values });
    expect(savedSearchNoticeOf({ notice: "paused", values })).toEqual({ code: "paused", ...values });
    expect(savedSearchNoticeOf({ notice: "saved", values })).toBeNull();
    expect(savedSearchNoticeOf(null)).toBeNull();
  });
});
