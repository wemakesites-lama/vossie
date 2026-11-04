import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderReply } from "./ai/types";

const haiku = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
const groq = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
vi.mock("./ai/anthropic", () => ({ read: haiku }));
vi.mock("./ai/groq", () => ({ read: groq }));

import { checkListingGuidelines, checkRequest, listingRequest, readListingPhotos } from "./ai";
import { FAKE_REPLY } from "./ai/fake";
// Stage D: Snap to search.
import { photoSearchSchema } from "@/lib/search/photo";
import { readSearchPhoto, searchRequest } from "./ai";
import { FAKE_SEARCH_REPLY } from "./ai/fake";

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
