import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowseQuery } from "@/lib/types";
import { WORDS_SEARCH_DAILY_CAP } from "@/lib/browse/words";
import { sastDate } from "@/lib/time";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { readSearchWords } from "./ai";
import { resetSampleStore, sampleStore } from "./store";
import { reserveWordsSearch, wordsSearchFor } from "./words-search";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

// The door itself, watched: the fake provider answers unless a test says otherwise.
vi.mock("./ai", async (original) => {
  const actual = await original<typeof import("./ai")>();
  return { ...actual, readSearchWords: vi.fn(actual.readSearchWords) };
});
const read = vi.mocked(readSearchWords);

const query = (changes: Partial<BrowseQuery> = {}): BrowseQuery => ({
  q: null,
  category: null,
  campus: "all",
  campusFromLink: false,
  price: null,
  pay: null,
  deals: null,
  sort: "new",
  shown: 24,
  ...changes,
});
const search = (q: string, changes: Partial<BrowseQuery> = {}) => query({ q, sort: "match", ...changes });

beforeEach(() => {
  resetRequest(request);
  resetSampleStore();
  vi.stubEnv("VOSSIE_BACKEND", "");
  vi.stubEnv("VOSSIE_AI_WORDS_SEARCH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
});

afterEach(() => {
  vi.unstubAllEnvs();
  read.mockClear();
});

describe("wordsSearchFor: Browse's one call (AI features spec 6)", () => {
  it("leaves the query alone with the switch off, and asks no provider", async () => {
    vi.stubEnv("VOSSIE_AI_WORDS_SEARCH", "");
    const typed = search("calculator under R300 at Midrand");
    expect(await wordsSearchFor(typed)).toEqual({ query: typed, line: null, typed });
    expect(read).not.toHaveBeenCalled();
  });

  it("searches short words, module codes and exact searches as typed, and asks no provider", async () => {
    for (const typed of [search("calculator"), search("FAC1501"), search("calculator under R300 at Midrand", { exact: true }), query()]) {
      expect(await wordsSearchFor(typed)).toEqual({ query: typed, line: null, typed });
    }
    expect(read).not.toHaveBeenCalled();
  });

  it("fills in a sentence's filters, marks the query exact and says what it used", async () => {
    const typed = search("calculator under R300 at Midrand");
    const result = await wordsSearchFor(typed);
    expect(result.query).toMatchObject({
      q: "calculator",
      price: "under-500",
      campus: "midrand",
      campusFromLink: true,
      exact: true,
    });
    expect(result.line).toBe("Showing calculator under R500 at Midrand.");
    expect(result.typed).toBe(typed);
  });

  it("sends the normalised words alone", async () => {
    await wordsSearchFor(search("  Calculator   UNDER R300  at Midrand ", { campus: "pretoria" }));
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe("calculator under r300 at midrand");
  });

  it("searches the words as typed when the day's parses are used up, and asks no provider", async () => {
    sampleStore().wordsSearchParses.set(sastDate(new Date()), WORDS_SEARCH_DAILY_CAP);
    const typed = search("calculator under R300 at Midrand");
    expect(await wordsSearchFor(typed)).toEqual({ query: typed, line: null, typed });
    expect(read).not.toHaveBeenCalled();
  });

  it("searches the words as typed when the provider gives nothing", async () => {
    read.mockResolvedValueOnce(null);
    const typed = search("calculator under R300 at Midrand");
    expect(await wordsSearchFor(typed)).toEqual({ query: typed, line: null, typed });
  });

  it("shows no line when the parse changes nothing", async () => {
    read.mockResolvedValueOnce({
      q: "old casio calculator cheap",
      category: null,
      campus: null,
      price: null,
      pay: null,
      deals: null,
      sort: null,
    });
    const typed = search("old casio calculator cheap");
    expect(await wordsSearchFor(typed)).toEqual({ query: typed, line: null, typed });
  });
});

describe("reserveWordsSearch: the site-wide daily cap (plan decision 5)", () => {
  it("takes parses while under the cap, then none, and starts again on a new SAST day", async () => {
    const before = new Date("2026-11-05T21:59:00Z");
    const after = new Date("2026-11-05T22:01:00Z");
    expect(await reserveWordsSearch(before, 2)).toBe(true);
    expect(await reserveWordsSearch(before, 2)).toBe(true);
    expect(await reserveWordsSearch(before, 2)).toBe(false);
    expect(sampleStore().wordsSearchParses.get("2026-11-05")).toBe(2);
    expect(await reserveWordsSearch(after, 2)).toBe(true);
    expect([...sampleStore().wordsSearchParses]).toEqual([["2026-11-06", 1]]);
  });

  it("takes nothing with a cap of 0", async () => {
    expect(await reserveWordsSearch(new Date("2026-11-05T08:00:00Z"), 0)).toBe(false);
    expect(sampleStore().wordsSearchParses.size).toBe(0);
  });
});
