import { describe, expect, it } from "vitest";
import type { BrowseQuery } from "@/lib/types";
import {
  applyWords,
  checkWords,
  looksLikeSentence,
  normaliseWords,
  priceStep,
  wordsLine,
  wordsSchema,
  type ParsedWords,
} from "./words";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
  { slug: "cape-town-mowbray", name: "Cape Town Mowbray" },
];
const CATEGORIES = [
  { slug: "tech", name: "Tech" },
  { slug: "textbooks-notes", name: "Textbooks & notes" },
];
const base: BrowseQuery = {
  q: "calculator under r300 at midrand",
  category: null,
  campus: "all",
  campusFromLink: false,
  price: null,
  pay: null,
  deals: null,
  sort: "match",
  shown: 24,
};
const parsed = (changes: Partial<ParsedWords> = {}): ParsedWords => ({
  q: "calculator",
  category: null,
  campus: null,
  price: null,
  pay: null,
  deals: null,
  sort: null,
  ...changes,
});

describe("looksLikeSentence (planning decision 7)", () => {
  it.each(["calculator", "FAC1501", "fx-991", "casio fx 991", "laptop charger hp", "R", "", "canon eos r5", "ryzen r7"])("leaves %j alone", (q) => {
    expect(looksLikeSentence(q, CAMPUSES)).toBe(false);
  });
  it.each([
    "graphing calculator for my exams",
    "calculator under R300",
    "laptop R 2000",
    "desk 300 rand",
    "lamp below 150",
    "kettle less than 200",
    "lamp at Pretoria",
    "Cape Town Mowbray",
    "cheap kettle",
    "free textbooks",
    "cheapest laptop",
    "laptop r2k",
  ])("parses %j", (q) => {
    expect(looksLikeSentence(q, CAMPUSES)).toBe(true);
  });
  it("needs a campus's every word, as whole words", () => {
    expect(looksLikeSentence("cape town", CAMPUSES)).toBe(false);
    expect(looksLikeSentence("midrandish", CAMPUSES)).toBe(false);
  });
});

describe("normaliseWords", () => {
  it("trims, collapses spaces, lowercases and cuts at 100 characters", () => {
    expect(normaliseWords("  Calculator   UNDER R300 ")).toBe("calculator under r300");
    expect(Array.from(normaliseWords("a ".repeat(80))).length).toBeLessThanOrEqual(100);
  });
});

describe("priceStep (planning decision 1)", () => {
  it.each([
    [0, null],
    [30, "under-50"],
    [50, "under-50"],
    [51, "under-100"],
    [100, "under-100"],
    [250, "under-250"],
    [300, "under-500"],
    [500, "under-500"],
    [501, null],
  ] as const)("R%d → %s", (rand, step) => {
    expect(priceStep(rand)).toBe(step);
  });
});

describe("checkWords", () => {
  const reply = (fields: Record<string, unknown>) =>
    JSON.stringify({
      q: "calculator",
      categorySlug: null,
      campus: null,
      maxPrice: null,
      free: false,
      pay: null,
      deals: false,
      sort: null,
      ...fields,
    });
  const slugs = { categories: ["tech"], campuses: ["midrand"] };

  it("turns a reply into a parse", () => {
    expect(checkWords(reply({ categorySlug: "tech", campus: "midrand", maxPrice: 300, sort: "price-low" }), slugs)).toEqual(
      parsed({ category: "tech", campus: "midrand", price: "under-500", sort: "price-low" }),
    );
  });
  it("free wins over a top price; deals and pay come through", () => {
    expect(checkWords(reply({ free: true, maxPrice: 300, deals: true, pay: "swap" }), slugs)).toEqual(
      parsed({ price: "free", deals: "free-and-swaps", pay: "swap" }),
    );
  });
  it("takes all campuses and an empty q", () => {
    expect(checkWords(reply({ campus: "all", q: "  " }), slugs)).toEqual(parsed({ campus: "all", q: null }));
  });
  it.each([
    ["not json", "{"],
    ["an unknown category", reply({ categorySlug: "cars" })],
    ["an unknown campus", reply({ campus: "mars" })],
    ["a bad sort", reply({ sort: "random" })],
    ["a bad pay", reply({ pay: "card" })],
    ["a negative price", reply({ maxPrice: -5 })],
    ["a fractional price", reply({ maxPrice: 2.5 })],
    ["a missing field", JSON.stringify({ q: "x" })],
    ["an extra field", reply({ owner: "me" })],
  ])("refuses %s", (_name, text) => {
    expect(checkWords(text, slugs)).toBeNull();
  });
  it("cuts a long q to 100 characters", () => {
    expect(Array.from(checkWords(reply({ q: "x".repeat(300) }), slugs)?.q ?? "").length).toBe(100);
  });
  it("has the schema's fields and no others", () => {
    expect(Object.keys(wordsSchema(["tech"], ["midrand"]).properties).sort()).toEqual(
      ["campus", "categorySlug", "deals", "free", "maxPrice", "pay", "q", "sort"],
    );
  });
});

describe("applyWords (planning decisions 2 to 4)", () => {
  it("fills empty filters, takes the q and marks the query exact", () => {
    expect(applyWords(base, parsed({ campus: "midrand", price: "under-500", category: "tech" }))).toEqual({
      ...base,
      q: "calculator",
      category: "tech",
      campus: "midrand",
      campusFromLink: true,
      price: "under-500",
      exact: true,
    });
  });
  it("never overrides what the link set", () => {
    const linked: BrowseQuery = { ...base, category: "textbooks-notes", campus: "pretoria", campusFromLink: true, price: "free" };
    const applied = applyWords(linked, parsed({ campus: "midrand", price: "under-500", category: "tech" }));
    expect(applied).toMatchObject({ category: "textbooks-notes", campus: "pretoria", price: "free" });
  });
  it("fills the sort only when the link has the default; no q means newest first", () => {
    expect(applyWords(base, parsed({ sort: "price-low" }))?.sort).toBe("price-low");
    expect(applyWords({ ...base, sort: "new" }, parsed({ sort: "price-low" }))?.sort).toBe("new");
    expect(applyWords(base, parsed({ q: null }))?.sort).toBe("new");
  });
  it("is null when the parse changes nothing", () => {
    expect(applyWords(base, parsed({ q: base.q }))).toBeNull();
  });
});

describe("wordsLine", () => {
  const names = {
    campuses: new Map(CAMPUSES.map((c) => [c.slug, c.name])),
    categories: new Map(CATEGORIES.map((c) => [c.slug, c.name])),
  };
  it("says what was used", () => {
    const applied = { ...base, q: "calculator", campus: "midrand", campusFromLink: true, price: "under-500" as const, exact: true as const };
    expect(wordsLine(applied, names)).toBe("Showing calculator under R500 at Midrand.");
  });
  it("names a category, free, payment, deals, every campus and the sort", () => {
    const applied: BrowseQuery = {
      ...base,
      q: null,
      category: "tech",
      campus: "all",
      campusFromLink: true,
      price: "free",
      pay: "swap",
      deals: "free-and-swaps",
      sort: "price-low",
      exact: true,
    };
    expect(wordsLine(applied, names)).toBe(
      "Showing everything in Tech, free, swaps only, free and swaps at every campus, cheapest first.",
    );
  });
});
