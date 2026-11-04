import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { totalLine } from "@/lib/browse/starter";
import { WORDS_SEARCH_DAILY_CAP } from "@/lib/browse/words";
import { sastDate } from "@/lib/time";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { readStarterPack } from "./ai";
import { searchListings } from "./index";
import { starterPackFor } from "./starter-pack";
import { resetSampleStore, sampleStore } from "./store";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

// The door itself, watched: the fake provider answers unless a test says otherwise.
vi.mock("./ai", async (original) => {
  const actual = await original<typeof import("./ai")>();
  return { ...actual, readStarterPack: vi.fn(actual.readStarterPack) };
});
const read = vi.mocked(readStarterPack);

// Browse's reader, watched, so a test can make one search throw.
vi.mock("./index", async (original) => {
  const actual = await original<typeof import("./index")>();
  return { ...actual, searchListings: vi.fn(actual.searchListings) };
});
const search = vi.mocked(searchListings);

const SENTENCE = "Starting at Midrand, need stuff for res under R1000";

beforeEach(() => {
  resetRequest(request);
  resetSampleStore();
  vi.stubEnv("VOSSIE_BACKEND", "");
  vi.stubEnv("VOSSIE_AI_STARTER_PACK", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
});

afterEach(() => {
  vi.unstubAllEnvs();
  read.mockClear();
  search.mockClear();
});

describe("starterPackFor: the page's one call (AI round two spec 6)", () => {
  it("makes the fake's pack at Midrand within R1,000 (planning decisions 4, 5 and 15)", async () => {
    const outcome = await starterPackFor(SENTENCE, "all");
    expect(outcome.kind).toBe("pack");
    if (outcome.kind !== "pack") return;
    expect(outcome.campus).toBe("midrand");
    expect(
      outcome.pack.lines.map((line) =>
        line.kind === "pick" ? line.listing.id : line.kind === "no-fit" ? line.reason : "none",
      ),
    ).toEqual(["l-001", "l-006", "budget", "none"]);
    // The lamp came from its name alone: See more searches "lamp".
    expect(outcome.pack.lines[1]).toMatchObject({
      seeMore: "/browse?q=lamp&cat=res-living&campus=midrand&sort=price-low&exact=1",
    });
    expect(totalLine(outcome.pack)).toBe("Total R430 of your R1,000 budget, R570 left");
  });

  it("uses the viewer's campus when the sentence names none (planning decision 8)", async () => {
    const outcome = await starterPackFor("Stuff for my first year in res", "midrand");
    expect(outcome.kind === "pack" && totalLine(outcome.pack)).toBe("Total R1,630");
  expect(outcome.kind === "pack" && outcome.campus).toBe("midrand");
  });

  it("sends only the normalised sentence", async () => {
    await starterPackFor("  Stuff  for my FIRST year in res ", "midrand");
    expect(read).toHaveBeenCalledWith("stuff for my first year in res", expect.any(Array), expect.any(Array));
  });

  it.each([
    ["no sentence", null, "empty"],
    ["a reply that isn't a pack", "Need a kettle [no pack]", "failed"],
  ])("gives %s as %s", async (_name, sentence, kind) => {
    expect((await starterPackFor(sentence, "all")).kind).toBe(kind);
  });

  it("fails without reading when the switch is off", async () => {
    vi.stubEnv("VOSSIE_AI_STARTER_PACK", "");
    expect((await starterPackFor(SENTENCE, "all")).kind).toBe("failed");
    expect(read).not.toHaveBeenCalled();
  });

  it("fails without reading when today's parses are used up (the words search's cap)", async () => {
    sampleStore().wordsSearchParses.set(sastDate(new Date()), WORDS_SEARCH_DAILY_CAP);
    expect((await starterPackFor(SENTENCE, "all")).kind).toBe("failed");
    expect(read).not.toHaveBeenCalled();
  });

  it("takes one of the day's parses for a read", async () => {
    await starterPackFor(SENTENCE, "all");
    expect(sampleStore().wordsSearchParses.get(sastDate(new Date()))).toBe(1);
  });

  it("fails when a search throws", async () => {
    search.mockRejectedValueOnce(new Error("down"));
    expect((await starterPackFor(SENTENCE, "all")).kind).toBe("failed");
    expect(search).toHaveBeenCalled();
  });
});
