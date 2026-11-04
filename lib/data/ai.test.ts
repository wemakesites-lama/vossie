import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderReply } from "./ai/types";

const haiku = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
const groq = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
vi.mock("./ai/anthropic", () => ({ read: haiku }));
vi.mock("./ai/groq", () => ({ read: groq }));

import { checkListingGuidelines, checkRequest, listingRequest, readListingPhotos, readSearchWords, wordsRequest } from "./ai";
import { FAKE_REPLY, fakeWords } from "./ai/fake";

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
