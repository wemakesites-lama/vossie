import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORDS_SEARCH_DAILY_CAP } from "@/lib/browse/words";
import type { RequestFields } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { readSearchWords } from "./ai";
import { BACKFILL_BATCH, backfillRequestMatches, readRequestMatch } from "./request-reading";
import { createRequest } from "./requests";
import { resetSampleStore, sampleStore } from "./store";

// Reading a Looking For request into its stored search (AI stage G plan Task 5; planning decisions 3 to 5 and 10).
const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

// The door itself, watched: the fake provider answers unless a test says otherwise.
vi.mock("./ai", async (original) => {
  const actual = await original<typeof import("./ai")>();
  return { ...actual, readSearchWords: vi.fn(actual.readSearchWords) };
});
const read = vi.mocked(readSearchWords);

const FIELDS: RequestFields = {
  title: "Zorbitron desk lamp",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "Zorbitron lamp that clips onto my desk.",
  budgetZar: null,
  swapWelcome: false,
  neededBy: null,
};
const NOW = new Date("2026-11-04T10:00:00.000Z");

/** A request of acc-student's in the store, as createRequest leaves it. */
async function posted(fields = FIELDS) {
  return (await createRequest({ askerId: "acc-student", fields, now: NOW })).id;
}
const stored = (id: string) => sampleStore().requests.get(id)!;

beforeEach(() => {
  resetRequest(request);
  resetSampleStore();
  vi.stubEnv("VOSSIE_BACKEND", "");
  vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  read.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readRequestMatch (planning decisions 3 to 5)", () => {
  it("reads a new request into a search: the fake's q, the request's category and campus", async () => {
    const id = await posted();
    await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
    expect(stored(id).matchQuery).toMatchObject({ category: "res-living", campus: "midrand", price: null, pay: null, deals: null });
    expect(stored(id).matchQuery?.q).toContain("zorbitron");
    expect(stored(id).matchReadAt).toBe(NOW.toISOString());
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe("zorbitron desk lamp. zorbitron lamp that clips onto my desk.");
  });

  it("stores a read with no search when the model can't answer, and never throws", async () => {
    read.mockResolvedValueOnce(null);
    const id = await posted();
    await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
    expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: NOW.toISOString() });
  });

  it("never throws when the provider itself throws", async () => {
    read.mockRejectedValueOnce(new Error("boom"));
    const id = await posted();
    await expect(readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW })).resolves.toBeUndefined();
    expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: NOW.toISOString() });
  });

  it("stores a read with no search when the day's parses are used up", async () => {
    sampleStore().wordsSearchParses.set(sastDate(new Date()), WORDS_SEARCH_DAILY_CAP);
    const id = await posted();
    await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
    expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: NOW.toISOString() });
    expect(read).not.toHaveBeenCalled();
  });

  it("reads nothing while the switch is off", async () => {
    vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "");
    const id = await posted();
    await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
    expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: null });
    expect(read).not.toHaveBeenCalled();
  });

  it("moves the search on an edit of the campus alone, without reading", async () => {
    const id = await posted();
    await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
    read.mockClear();
    const after = { ...FIELDS, campusSlug: "pretoria" };
    await readRequestMatch({ id, askerId: "acc-student", before: FIELDS, after, now: NOW });
    expect(stored(id).matchQuery?.campus).toBe("pretoria");
    expect(read).not.toHaveBeenCalled();
  });

  it("clears the search when an edit changes the words while off", async () => {
    const id = await posted();
    await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
    vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "");
    await readRequestMatch({ id, askerId: "acc-student", before: FIELDS, after: { ...FIELDS, title: "Zorbitron floor lamp" }, now: NOW });
    expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: null });
  });
});

describe("the backfill (planning decision 10)", () => {
  it("reads unread open requests, oldest first, and says whether more are left", async () => {
    for (let n = 0; n < BACKFILL_BATCH + 1; n += 1) await posted({ ...FIELDS, title: `Zorbitron lamp ${n}` });
    const first = await backfillRequestMatches(NOW);
    expect(first).toEqual({ matched: BACKFILL_BATCH, unmatched: 0, more: true, capped: false });
    expect(await backfillRequestMatches(NOW)).toEqual({ matched: 1, unmatched: 0, more: false, capped: false });
  });

  it("stops at a full cap and marks nothing it didn't read", async () => {
    const id = await posted();
    sampleStore().wordsSearchParses.set(sastDate(NOW), WORDS_SEARCH_DAILY_CAP);
    expect(await backfillRequestMatches(NOW)).toEqual({ matched: 0, unmatched: 0, more: true, capped: true });
    expect(stored(id).matchReadAt).toBeNull();
  });

  it("stores a read with no search when the model can't answer", async () => {
    read.mockResolvedValueOnce(null);
    const id = await posted();
    expect(await backfillRequestMatches(NOW)).toEqual({ matched: 0, unmatched: 1, more: false, capped: false });
    expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: NOW.toISOString() });
  });

  it("leaves the samples alone", async () => {
    await backfillRequestMatches(NOW);
    expect(stored("r-001")).toMatchObject({ matchQuery: null, matchReadAt: null });
  });
});
