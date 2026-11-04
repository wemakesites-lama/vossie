// lib/ai/config.test.ts
import { describe, expect, it } from "vitest";
import { aiFeatureOn, aiProviders, featureProviders, providerHasKey } from "./config";

describe("the AI settings (AI features spec 7.2)", () => {
  it("lists Haiku then Groq when unset, otherwise in the order given, ignoring unknown and repeated names", () => {
    expect(aiProviders({})).toEqual(["anthropic", "groq"]);
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: " groq, anthropic ,groq,openai" })).toEqual(["groq", "anthropic"]);
  });

  it("still reads the old setting's name, and the new one wins", () => {
    expect(aiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "groq" })).toEqual(["groq"]);
    expect(aiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "groq", VOSSIE_AI_PROVIDERS: "anthropic" })).toEqual(["anthropic"]);
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: " " })).toEqual(["anthropic", "groq"]);
  });

  it("never uses the fake on Supabase", () => {
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: "fake" })).toEqual(["fake"]);
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: "fake,groq", VOSSIE_BACKEND: "supabase" })).toEqual(["groq"]);
  });

  it("turns a feature on only when its switch is on and a listed provider has its key (or is the fake)", () => {
    expect(aiFeatureOn("listing", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1" })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", ANTHROPIC_API_KEY: " " })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", GROQ_API_KEY: "k" })).toBe(true);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", VOSSIE_AI_PROVIDERS: "anthropic", GROQ_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", VOSSIE_AI_PROVIDERS: "fake" })).toBe(true);
  });

  it("knows each provider's key", () => {
    expect(providerHasKey("anthropic", { ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(providerHasKey("groq", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(providerHasKey("fake", {})).toBe(true);
  });

  it("turns the listing check on by its own switch, with Haiku or the fake, never Groq alone", () => {
    expect(aiFeatureOn("listing-check", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing-check", { VOSSIE_AI_LISTING_CHECK: "1", ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(aiFeatureOn("listing-check", { VOSSIE_AI_LISTING_CHECK: "1", GROQ_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing-check", { VOSSIE_AI_LISTING_CHECK: "1", VOSSIE_AI_PROVIDERS: "fake" })).toBe(true);
    // Photo-to-listing's switch doesn't turn it on.
    expect(aiFeatureOn("listing-check", { VOSSIE_LISTING_AI: "1", ANTHROPIC_API_KEY: "k" })).toBe(false);
  });

  it("gives each feature the providers it may use that have their keys, in order", () => {
    const env = { VOSSIE_AI_PROVIDERS: "groq,anthropic", ANTHROPIC_API_KEY: "k", GROQ_API_KEY: "k" };
    expect(featureProviders("listing", env)).toEqual(["groq", "anthropic"]);
    expect(featureProviders("listing-check", env)).toEqual(["anthropic"]);
    expect(featureProviders("listing", { ANTHROPIC_API_KEY: "k" })).toEqual(["anthropic"]);
  });

  it("turns the words search on only with its switch and Haiku or the fake (AI stage E)", () => {
    const env = { VOSSIE_AI_PROVIDERS: "groq", GROQ_API_KEY: "g", VOSSIE_AI_WORDS_SEARCH: "1" };
    expect(featureProviders("words-search", env)).toEqual([]);
    expect(aiFeatureOn("words-search", env)).toBe(false);
    const haiku = { VOSSIE_AI_PROVIDERS: "groq,anthropic", GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" };
    expect(featureProviders("words-search", haiku)).toEqual(["anthropic"]);
    expect(aiFeatureOn("words-search", haiku)).toBe(false);
    expect(aiFeatureOn("words-search", { ...haiku, VOSSIE_AI_WORDS_SEARCH: "1" })).toBe(true);
    expect(aiFeatureOn("words-search", { VOSSIE_AI_PROVIDERS: "fake", VOSSIE_AI_WORDS_SEARCH: "1" })).toBe(true);
  });
});
