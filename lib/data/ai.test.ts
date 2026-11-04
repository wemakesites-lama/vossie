import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderReply } from "./ai/types";

const haiku = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
const groq = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
vi.mock("./ai/anthropic", () => ({ read: haiku }));
vi.mock("./ai/groq", () => ({ read: groq }));

import {
  checkListingGuidelines,
  checkRequest,
  listingRequest,
  readListingPhotos,
  readSearchPhoto,
  readSearchWords,
  searchRequest,
  wordsRequest,
} from "./ai";
import { readReport, reportReadRequest, type ReportForRead } from "./ai";
import { FAKE_REPLY, FAKE_SEARCH_REPLY, fakeWords } from "./ai/fake";
// Stage D: Snap to search.
import { photoSearchSchema } from "@/lib/search/photo";
// Stage H: Starter pack.
import { readStarterPack, STARTER_TIMEOUT_MS, starterRequest } from "./ai";
import { starterSchema } from "@/lib/browse/starter";

const CATEGORIES = [
  { slug: "textbooks-notes", name: "Textbooks & notes" },
  { slug: "tech", name: "Tech" },
];
const photo = (byte: number) => ({ type: "image/jpeg" as const, bytes: new Uint8Array([byte]) });
const REPLY = JSON.stringify(FAKE_REPLY);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  haiku.mockReset();
  groq.mockReset();
});

function bothProviders() {
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "anthropic,groq");
  vi.stubEnv("ANTHROPIC_API_KEY", "k");
  vi.stubEnv("GROQ_API_KEY", "k");
  vi.spyOn(console, "warn").mockImplementation(() => {});
}

describe("the provider door (AI features spec 7.1)", () => {
  it("sends at most three photos, the cover first, with the instruction as the system prompt", () => {
    const request = listingRequest([1, 2, 3, 4].map(photo), CATEGORIES);
    expect(request.images.map((image) => image.base64)).toEqual(["AQ==", "Ag==", "Aw=="]);
    expect(request.system).toContain("- tech: Tech, such as laptops");
    expect(request.schema).toMatchObject({ properties: { categorySlug: { enum: ["textbooks-notes", "tech"] } } });
  });

  it("names the task in the request and in the log line", async () => {
    bothProviders();
    const warn = vi.mocked(console.warn);
    expect(listingRequest([photo(1)], CATEGORIES).task).toBe("photo-to-listing");
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    groq.mockResolvedValueOnce({ ok: true, text: REPLY });
    await readListingPhotos([photo(1)], CATEGORIES);
    expect(warn).toHaveBeenCalledWith("[vossie] photo-to-listing: anthropic timeout");
  });

  it("asks Haiku first, and Groq only when Haiku couldn't answer", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    groq.mockResolvedValueOnce({ ok: true, text: REPLY });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true, suggestion: { moduleCode: "FAC1501" } });
    expect(haiku).toHaveBeenCalledTimes(1);
    expect(groq).toHaveBeenCalledTimes(1);
  });

  it("stops at Haiku's answer, a refusal included, so the photos go to one provider", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toEqual({ ok: false, failure: "refusal" });
    haiku.mockResolvedValueOnce({ ok: true, text: REPLY });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true });
    expect(groq).not.toHaveBeenCalled();
  });

  it("returns the first provider's checked suggestion, sending the photo as base64 with the form's categories", async () => {
    bothProviders();
    haiku.mockResolvedValue({ ok: true, text: REPLY });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true, suggestion: { moduleCode: "FAC1501" } });
    expect(haiku).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [{ type: "image/jpeg", base64: "AQ==" }],
        schema: expect.objectContaining({
          properties: expect.objectContaining({ categorySlug: expect.objectContaining({ enum: ["textbooks-notes", "tech"] }) }),
        }),
      }),
    );
    expect(groq).not.toHaveBeenCalled();
  });

  it("moves on only when the first couldn't answer", async () => {
    bothProviders();
    for (const failure of ["timeout", "rate-limited", "model-gone", "api-error"] as const) {
      haiku.mockResolvedValueOnce({ ok: false, failure });
      groq.mockResolvedValueOnce({ ok: true, text: REPLY });
      expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true });
    }
    expect(groq).toHaveBeenCalledTimes(4);
  });

  it("never sends a refusal, a bad reply or a person to a second provider", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toEqual({ ok: false, failure: "refusal" });
    haiku.mockResolvedValueOnce({ ok: true, text: "{}" });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toEqual({ ok: false, failure: "bad-output" });
    haiku.mockResolvedValueOnce({ ok: true, text: JSON.stringify({ ...FAKE_REPLY, personIsSubject: true }) });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toEqual({ ok: false, failure: "person" });
    expect(groq).not.toHaveBeenCalled();
  });

  it("skips a provider without its key, and reports the last failure when none can answer", async () => {
    bothProviders();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    groq.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toEqual({ ok: false, failure: "rate-limited" });
    expect(haiku).not.toHaveBeenCalled();
  });

  it("logs a failure by provider and kind only, never the photo or the text", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: true, text: "Financial Accounting" });
    await readListingPhotos([photo(1)], CATEGORIES);
    expect(console.warn).toHaveBeenCalledWith("[vossie] photo-to-listing: anthropic bad-output");
  });
});

describe("the listing check through the door (AI features spec 3 and 7.1)", () => {
  const LISTING = { title: "Rolex watch", description: "Like new.", categoryName: "Fashion & thrift", cover: photo(7) };

  it("sends the listing's words and its cover, never a seller, with the check's schema", () => {
    const request = checkRequest(LISTING);
    expect(request.task).toBe("listing-check");
    expect(request.text).toBe("Title: Rolex watch\nCategory: Fashion & thrift\nDescription: Like new.");
    expect(request.images.map((image) => image.base64)).toEqual(["Bw=="]);
    expect(checkRequest({ ...LISTING, cover: null }).images).toEqual([]);
    expect(request.schema).toMatchObject({ required: ["concern", "confidence"] });
  });

  it("asks Haiku only, never Groq, and stops on a high-confidence concern", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: true, text: '{"concern":"counterfeit","confidence":"high"}' });
    expect(await checkListingGuidelines(LISTING)).toBe("counterfeit");
    haiku.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    expect(groq).not.toHaveBeenCalled();
  });

  it("fails open: a failure, a bad reply, a lower confidence or no provider all publish, logging only the kind", async () => {
    bothProviders();
    const warn = vi.mocked(console.warn);
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: true, text: "{}" });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: true, text: '{"concern":"weapons","confidence":"medium"}' });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    haiku.mockRejectedValueOnce(new Error("Rolex watch"));
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      "[vossie] listing-check: anthropic timeout",
      "[vossie] listing-check: anthropic bad-output",
      "[vossie] listing-check: anthropic api-error",
    ]);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await checkListingGuidelines(LISTING)).toBeNull();
  });

  it("uses the fake in sample mode: a title with 'fake' in it looks counterfeit", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    expect(await checkListingGuidelines({ ...LISTING, title: "Fake designer watch" })).toBe("counterfeit");
    expect(await checkListingGuidelines(LISTING)).toBeNull();
  });
});

describe("the report read through the door (AI features spec 4 and 7.1)", () => {
  const READ_INPUT: ReportForRead = {
    kind: "listing",
    title: "Rolex watch",
    words: "Real Rolex, R300.",
    categoryName: "Fashion",
    cover: null,
    reason: "prohibited",
    detail: "Looks fake",
  };

  it("builds the report read's request without any name or account", () => {
    const request = reportReadRequest(READ_INPUT);
    expect(request.task).toBe("report-read");
    expect(request.text.split("\n")[0]).toBe("Title: Rolex watch");
    expect(request.text).toContain("Reported: a listing");
    expect(request.text).toContain("Reporter's reason: Prohibited item");
    expect(request.text).toContain("Reporter's detail: Looks fake");
    expect(request.images).toHaveLength(0);
    expect(reportReadRequest({ ...READ_INPUT, cover: photo(7) }).images.map((image) => image.base64)).toEqual(["Bw=="]);
    expect(request.schema).toMatchObject({ required: ["summary", "concern", "agrees"] });
  });

  it("reads a report with Haiku, never Groq, and gives null on any failure", async () => {
    bothProviders();
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "groq,anthropic");
    const warn = vi.mocked(console.warn);
    haiku.mockResolvedValueOnce({ ok: true, text: JSON.stringify({ summary: "A watch.", concern: "none", agrees: false }) });
    expect(await readReport(READ_INPUT)).toEqual({ summary: "A watch.", concern: "none", agrees: false });
    haiku.mockResolvedValueOnce({ ok: true, text: "{}" });
    expect(await readReport(READ_INPUT)).toBeNull();
    haiku.mockRejectedValueOnce(new Error("Rolex watch"));
    expect(await readReport(READ_INPUT)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    expect(await readReport(READ_INPUT)).toBeNull();
    expect(groq).not.toHaveBeenCalled();
    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      "[vossie] report-read: anthropic bad-output",
      "[vossie] report-read: anthropic api-error",
      "[vossie] report-read: anthropic timeout",
    ]);
  });

  it("uses the fake in sample mode: 'fake' in the title is counterfeit, and [no read] is a bad reply", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readReport({ ...READ_INPUT, title: "Fake designer watch" })).toEqual({
      summary: "A report about Fake designer watch.",
      concern: "counterfeit",
      agrees: true,
    });
    expect(await readReport({ ...READ_INPUT, reason: "scam" })).toMatchObject({ concern: "none", agrees: true });
    expect(await readReport(READ_INPUT)).toMatchObject({ concern: "none", agrees: false });
    expect(await readReport({ ...READ_INPUT, detail: "[no read]" })).toBeNull();
  });
});

describe("the words search through the door (AI features spec 6 and 7.1)", () => {
  const TECH = [{ slug: "tech", name: "Tech" }];
  const MIDRAND = [{ slug: "midrand", name: "Midrand" }];
  const WORDS = "calculator under r300 at midrand";
  const PARSED = { q: "calculator", category: null, campus: "midrand", price: "under-500", pay: null, deals: null, sort: null };
  const reply = (fields: Record<string, unknown> = {}) =>
    JSON.stringify({
      q: "calculator",
      categorySlug: null,
      campus: "midrand",
      maxPrice: 300,
      free: false,
      pay: null,
      deals: false,
      sort: null,
      ...fields,
    });

  it("sends the words only, with no photos, under the words search's schema", () => {
    const request = wordsRequest(WORDS, TECH, MIDRAND);
    expect(request.task).toBe("words-search");
    expect(request.images).toEqual([]);
    expect(request.text).toBe(`Search: ${WORDS}`);
    expect(request.system).toContain("- midrand: Midrand");
    expect(request.schema).toMatchObject({ properties: { campus: { enum: ["midrand", "all", null] } } });
    // Browse waits on it: a short wait, then the exact words (stage E review).
    expect(request.quick).toEqual({ timeoutMs: 3_000 });
  });

  it("uses the fake in sample mode", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toEqual(PARSED);
  });

  it("asks Haiku only, never Groq, and is null with no provider that may answer", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toBeNull();
    expect(groq).not.toHaveBeenCalled();
    expect(haiku).not.toHaveBeenCalled();
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: true, text: reply() });
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toEqual(PARSED);
    expect(groq).not.toHaveBeenCalled();
  });

  it("is null on a bad reply or a throw, logging only the kind, never the words", async () => {
    bothProviders();
    const warn = vi.mocked(console.warn);
    haiku.mockResolvedValueOnce({ ok: true, text: reply({ campus: "mars" }) });
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toBeNull();
    haiku.mockRejectedValueOnce(new Error(WORDS));
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toBeNull();
    const lines = warn.mock.calls.map(([line]) => String(line));
    expect(lines).toEqual([
      "[vossie] words-search: anthropic bad-output",
      "[vossie] words-search: anthropic api-error",
      "[vossie] words-search: anthropic refusal",
    ]);
    expect(lines.join(" ")).not.toContain("calculator");
  });

  it("moves on to the next provider after a timeout", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "anthropic,fake");
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    expect(await readSearchWords(WORDS, TECH, MIDRAND)).toEqual(PARSED);
    expect(console.warn).toHaveBeenCalledWith("[vossie] words-search: anthropic timeout");
  });

  it("has a fake that reads a price, free, cheap and a campus, the rest as q", () => {
    const campuses = ["midrand", "cape-town-mowbray", "all"];
    expect(fakeWords("Search: free textbooks at cape town mowbray", campuses)).toMatchObject({
      q: "textbooks",
      campus: "cape-town-mowbray",
      free: true,
      maxPrice: null,
      sort: null,
    });
    expect(fakeWords("Search: cheap kettle", campuses)).toMatchObject({ q: "kettle", campus: null, sort: "price-low" });
    expect(fakeWords("Search: desk 300 rand", campuses)).toMatchObject({ q: "desk", maxPrice: 300 });
  });
});

// Stage H: Starter pack.
describe("readStarterPack (AI stage H)", () => {
  const MIDRAND = [{ slug: "midrand", name: "Midrand" }];
  const WITH_RES = [
    { slug: "tech", name: "Tech" },
    { slug: "res-living", name: "Res living" },
  ];
  const SENTENCE = "starting at midrand, need stuff for res under r1000";
  const reply = JSON.stringify({
    campus: "midrand",
    budget: 1000,
    items: [{ name: "Lamp", words: "desk lamp", categorySlug: "res-living" }],
  });

  it("sends the sentence only, with no photos, under the starter schema and a 5-second wait", () => {
    const request = starterRequest("need a lamp", CATEGORIES, MIDRAND);
    expect(request.task).toBe("starter-pack");
    expect(request.images).toEqual([]);
    expect(request.text).toBe("Sentence: need a lamp");
    expect(request.quick).toEqual({ timeoutMs: 5_000 });
    expect(STARTER_TIMEOUT_MS).toBe(5_000);
    expect(request.schema).toEqual(starterSchema(["textbooks-notes", "tech"], ["midrand"]));
  });

  it("uses the fake in sample mode: the sentence's campus and budget, four fixed items", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    const read = await readStarterPack(SENTENCE, WITH_RES, MIDRAND);
    expect(read).toMatchObject({ campus: "midrand", budget: 1000 });
    expect(read?.items).toHaveLength(4);
    expect(read?.items[0]).toEqual({ name: "Calculator", words: "casio calculator", category: "tech" });
  });

  it("the fake gives a bad reply for [no pack], logged by kind", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readStarterPack(`${SENTENCE} [no pack]`, WITH_RES, MIDRAND)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("[vossie] starter-pack: fake bad-output");
  });

  it("asks Haiku only, never Groq", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    expect(await readStarterPack(SENTENCE, WITH_RES, MIDRAND)).toBeNull();
    expect(groq).not.toHaveBeenCalled();
    expect(haiku).not.toHaveBeenCalled();
  });

  it("moves on after a timeout, stops at a refusal or a throw, and never logs the sentence", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "anthropic,fake");
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    expect(await readStarterPack(SENTENCE, WITH_RES, MIDRAND)).toMatchObject({ campus: "midrand", budget: 1000 });
    haiku.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readStarterPack(SENTENCE, WITH_RES, MIDRAND)).toBeNull();
    haiku.mockRejectedValueOnce(new Error(SENTENCE));
    expect(await readStarterPack(SENTENCE, WITH_RES, MIDRAND)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: true, text: reply });
    expect(await readStarterPack(SENTENCE, WITH_RES, MIDRAND)).toEqual({
      campus: "midrand",
      budget: 1000,
      items: [{ name: "Lamp", words: "desk lamp", category: "res-living" }],
    });
    const lines = warn.mock.calls.map((call) => call.map(String).join(" "));
    expect(lines).toEqual([
      "[vossie] starter-pack: anthropic timeout",
      "[vossie] starter-pack: anthropic refusal",
      "[vossie] starter-pack: anthropic api-error",
    ]);
    for (const line of lines) expect(line).not.toContain("res under");
  });
});

// Stage D: Snap to search.
describe("Snap to search through the door (AI features spec 5 and 7.1)", () => {
  const SEARCH_REPLY = JSON.stringify(FAKE_SEARCH_REPLY);

  it("sends one photo with the search instruction and schema, named photo-search", () => {
    const request = searchRequest(photo(9), CATEGORIES);
    expect(request.task).toBe("photo-search");
    expect(request.images).toEqual([{ type: "image/jpeg", base64: "CQ==" }]);
    expect(request.schema).toEqual(photoSearchSchema(["textbooks-notes", "tech"]));
    expect(request.system).toContain("search CampusCart");
  });

  it("uses the fake in sample mode: words that find the sample calculator", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    expect(await readSearchPhoto(photo(1), CATEGORIES)).toEqual({
      ok: true,
      answer: { words: ["casio", "calculator"], categorySlug: "tech", moduleCode: null, confidence: "high" },
    });
  });

  it("asks Haiku first, and Groq only when Haiku couldn't answer", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    groq.mockResolvedValueOnce({ ok: true, text: SEARCH_REPLY });
    expect(await readSearchPhoto(photo(1), CATEGORIES)).toMatchObject({ ok: true, answer: { words: ["casio", "calculator"] } });
    expect(haiku).toHaveBeenCalledWith(expect.objectContaining({ task: "photo-search" }));
    expect(vi.mocked(console.warn)).toHaveBeenCalledWith("[vossie] photo-search: anthropic timeout");
  });

  it("a person comes back as its failure, logging only the provider and kind, never the photo or words", async () => {
    bothProviders();
    const warn = vi.mocked(console.warn);
    haiku.mockResolvedValueOnce({ ok: true, text: JSON.stringify({ ...FAKE_SEARCH_REPLY, personIsSubject: true }) });
    expect(await readSearchPhoto(photo(1), CATEGORIES)).toEqual({ ok: false, failure: "person" });
    expect(warn.mock.calls).toEqual([["[vossie] photo-search: anthropic person"]]);
    expect(groq).not.toHaveBeenCalled();
  });

  it("stops at a refusal, so the photo goes to one provider", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readSearchPhoto(photo(1), CATEGORIES)).toEqual({ ok: false, failure: "refusal" });
    expect(groq).not.toHaveBeenCalled();
  });

  it("with no provider to ask, or none that could answer, it's an API error or the last failure", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await readSearchPhoto(photo(1), CATEGORIES)).toEqual({ ok: false, failure: "api-error" });
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    groq.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    expect(await readSearchPhoto(photo(1), CATEGORIES)).toEqual({ ok: false, failure: "rate-limited" });
  });
});
