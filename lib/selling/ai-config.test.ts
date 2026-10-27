// lib/selling/ai-config.test.ts
import { describe, expect, it } from "vitest";
import { listingAiOn, listingAiProviders, providerHasKey } from "./ai-config";

describe("photo-to-listing settings (spec decisions 11 and 14)", () => {
  it("lists the providers in order, Groq alone when unset, ignoring unknown and repeated names", () => {
    expect(listingAiProviders({})).toEqual(["groq"]);
    expect(listingAiProviders({ VOSSIE_LISTING_AI_PROVIDERS: " groq, anthropic ,groq,openai" })).toEqual(["groq", "anthropic"]);
  });

  it("never uses the fake on Supabase", () => {
    expect(listingAiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "fake" })).toEqual(["fake"]);
    expect(listingAiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "fake,groq", VOSSIE_BACKEND: "supabase" })).toEqual(["groq"]);
  });

  it("is on only when switched on and a listed provider has its key (or is the fake)", () => {
    expect(listingAiOn({ GROQ_API_KEY: "k" })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1" })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", GROQ_API_KEY: " " })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", GROQ_API_KEY: "k" })).toBe(true);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", VOSSIE_LISTING_AI_PROVIDERS: "anthropic", GROQ_API_KEY: "k" })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", VOSSIE_LISTING_AI_PROVIDERS: "fake" })).toBe(true);
  });

  it("knows each provider's key", () => {
    expect(providerHasKey("anthropic", { ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(providerHasKey("groq", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(providerHasKey("fake", {})).toBe(true);
  });
});
