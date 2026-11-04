import { describe, expect, it } from "vitest";
import type { ParsedWords } from "@/lib/browse/words";
import type { Listing, MatchQuery } from "@/lib/types";
import { listings } from "@/data/fixtures/listings";
import {
  asMatchQuery,
  matchRequests,
  matchStep,
  REQUEST_WORDS_MAX,
  requestMatchQuery,
  requestWords,
  wantedFrom,
  wantedLine,
  withPlace,
  type MatchCandidate,
} from "./match";
import type { RequestFields } from "./rules";

const FIELDS: RequestFields = {
  title: "Casio fx-991 calculator",
  categorySlug: "tech",
  campusSlug: "midrand",
  details: "Need it for\n\nmy stats exam.   Can meet at the library.",
  budgetZar: 250,
  swapWelcome: false,
  neededBy: null,
};
const parsed = (changes: Partial<ParsedWords> = {}): ParsedWords => ({
  q: "casio calculator",
  category: "textbooks-notes",
  campus: "pretoria",
  price: "under-500",
  pay: "cash",
  deals: null,
  sort: "price-low",
  ...changes,
});
const QUERY: MatchQuery = { q: "casio calculator", category: "tech", campus: "midrand", price: null, pay: null, deals: null };

describe("requestWords (planning decision 2)", () => {
  it("joins the title and details, collapses spaces and lowercases", () => {
    expect(requestWords(FIELDS)).toBe("casio fx-991 calculator. need it for my stats exam. can meet at the library.");
  });
  it("adds no full stop after a title that ends with one", () => {
    expect(requestWords({ title: "Anyone selling a kettle?", details: "Mine broke this week, sadly." })).toBe(
      "anyone selling a kettle? mine broke this week, sadly.",
    );
  });
  it("cuts at 300 characters, at a word", () => {
    const words = requestWords({ title: "Desk lamp", details: "lamp ".repeat(100) });
    expect(Array.from(words).length).toBeLessThanOrEqual(REQUEST_WORDS_MAX);
    expect(words.endsWith("lamp")).toBe(true);
  });
});

describe("requestMatchQuery (planning decision 1)", () => {
  it("takes the model's q and the request's own category and campus, with no price, pay or deals", () => {
    expect(requestMatchQuery(parsed(), FIELDS)).toEqual(QUERY);
  });
  it.each([null, "", "  ", "a the of"])("stores nothing when q %j has no search words", (q) => {
    expect(requestMatchQuery(parsed({ q }), FIELDS)).toBeNull();
  });
  it("moves a search to a new category and campus", () => {
    expect(withPlace(QUERY, { categorySlug: "res-living", campusSlug: "pretoria" })).toEqual({
      ...QUERY,
      category: "res-living",
      campus: "pretoria",
    });
  });
});

describe("asMatchQuery (a stored search read back)", () => {
  it("takes a stored search", () => {
    expect(asMatchQuery(JSON.parse(JSON.stringify(QUERY)))).toEqual(QUERY);
  });
  it.each([
    ["null", null],
    ["an array", [QUERY]],
    ["no q", { ...QUERY, q: null }],
    ["a q of stop words", { ...QUERY, q: "the" }],
    ["an extra key", { ...QUERY, owner: "x" }],
    ["a missing key", { q: "lamp", category: null, campus: "midrand", price: null, pay: null }],
    ["a bad price", { ...QUERY, price: "under-7" }],
    ["a bad pay", { ...QUERY, pay: "card" }],
    ["a bad deals", { ...QUERY, deals: "yes" }],
    ["no campus", { ...QUERY, campus: null }],
  ])("refuses %s", (_name, value) => {
    expect(asMatchQuery(value)).toBeNull();
  });
});

describe("matchStep (planning decisions 4 and 5)", () => {
  const read = { query: QUERY, readAt: "2026-11-04T10:00:00.000Z" };
  const unreadable = { query: null, readAt: "2026-11-04T10:00:00.000Z" };
  const never = { query: null, readAt: null };
  const moved = { ...FIELDS, campusSlug: "pretoria" };
  const reworded = { ...FIELDS, title: "Sharp EL-W506 calculator" };

  it("reads a new request while on, and does nothing while off", () => {
    expect(matchStep(null, FIELDS, null, true)).toBe("read");
    expect(matchStep(null, FIELDS, null, false)).toBe("nothing");
  });
  it("leaves an edit that changes neither the words nor the place", () => {
    expect(matchStep(FIELDS, { ...FIELDS, budgetZar: 300 }, read, true)).toBe("nothing");
    expect(matchStep(FIELDS, { ...FIELDS, budgetZar: 300 }, read, false)).toBe("nothing");
  });
  it("moves a read search to a new category or campus without reading, on or off", () => {
    expect(matchStep(FIELDS, moved, read, true)).toBe("move");
    expect(matchStep(FIELDS, moved, read, false)).toBe("move");
    expect(matchStep(FIELDS, moved, unreadable, true)).toBe("nothing");
  });
  it("reads again when the words change, or when it was never read, while on", () => {
    expect(matchStep(FIELDS, reworded, read, true)).toBe("read");
    expect(matchStep(FIELDS, FIELDS, never, true)).toBe("read");
  });
  it("clears a search whose words changed while off, and leaves one never read", () => {
    expect(matchStep(FIELDS, reworded, read, false)).toBe("clear");
    expect(matchStep(FIELDS, reworded, unreadable, false)).toBe("clear");
    expect(matchStep(FIELDS, reworded, never, false)).toBe("nothing");
  });
});

describe("matchRequests and wantedFrom (planning decision 7)", () => {
  // l-001 is the sample "Casio fx-991ZA Plus calculator", Tech corner, Midrand.
  const casio = listings.find((listing) => listing.id === "l-001") as Listing;
  const names = { sellers: new Map([[casio.sellerSlug, "Tech corner"]]), categories: new Map([["tech", "Tech"]]) };
  const candidate = (id: string, askerId: string, changes: Partial<MatchQuery> = {}, createdAt = "2026-11-01T08:00:00.000Z"): MatchCandidate => ({
    id,
    title: `Request ${id}`,
    askerId,
    query: { ...QUERY, q: "calculator", campus: casio.campusSlug, ...changes },
    createdAt,
  });

  it("matches with browse's own rules and leaves out the seller's own requests", () => {
    const found = matchRequests(
      casio,
      [
        candidate("r-a", "acc-1"),
        candidate("r-own", "owner"),
        candidate("r-elsewhere", "acc-2", { campus: "pretoria" }),
        candidate("r-books", "acc-3", { category: "textbooks-notes" }),
        candidate("r-lamp", "acc-4", { q: "lamp" }),
      ],
      names,
      "owner",
    );
    expect(found.map((match) => match.id)).toEqual(["r-a"]);
  });
  it("orders by score, then newest, and counts each student once", () => {
    const found = matchRequests(
      casio,
      [
        candidate("r-old", "acc-1", {}, "2026-10-01T08:00:00.000Z"),
        candidate("r-new", "acc-1", {}, "2026-11-02T08:00:00.000Z"),
        candidate("r-casio", "acc-2", { q: "casio calculator" }),
        candidate("r-3", "acc-3"),
        candidate("r-4", "acc-4"),
      ],
      names,
      "owner",
    );
    expect(found[0].id).toBe("r-casio");
    const wanted = wantedFrom(found);
    expect(wanted.students).toBe(4);
    expect(wanted.requests).toHaveLength(3);
    expect(wanted.requests.map((request) => request.id)).not.toContain("r-old");
  });
  it("says how many students", () => {
    expect(wantedLine(1)).toBe("1 student is looking for something like this.");
    expect(wantedLine(2)).toBe("2 students are looking for something like this.");
  });
});
