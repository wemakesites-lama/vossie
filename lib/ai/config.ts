// lib/ai/config.ts
import { onSupabase } from "@/lib/backend";

// The AI features' settings (AI features spec 7.2; photo-to-listing spec decisions 11 and 14). A plain module with no
// SDK, so a Server Component can ask whether to show a feature without loading a provider. Read on each call, never
// kept at module scope.

type Env = Readonly<Record<string, string | undefined>>;

export type ProviderName = "anthropic" | "groq" | "fake";

/** The features, each with its own switch. Stages C to E add theirs here (AI features spec 7.2). */
export type AiFeature = "listing" | "listing-check" | "photo-search";

const KNOWN: readonly ProviderName[] = ["anthropic", "groq", "fake"];
const KEYS: Readonly<Record<Exclude<ProviderName, "fake">, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
};
const SWITCHES: Readonly<Record<AiFeature, string>> = {
  listing: "VOSSIE_LISTING_AI",
  "listing-check": "VOSSIE_AI_LISTING_CHECK",
  "photo-search": "VOSSIE_AI_PHOTO_SEARCH",
};

/** Groq's free tier is for the photo features only (AI features spec 7.1): the rest are Haiku's. */
const ONLY: Partial<Record<AiFeature, readonly ProviderName[]>> = { "listing-check": ["anthropic", "fake"] };

/** Haiku first, Groq's free tier behind it (AI features spec decision 1, Lama's Q1). */
const DEFAULT_PROVIDERS = "anthropic,groq";

/**
 * VOSSIE_AI_PROVIDERS in order. The old name, VOSSIE_LISTING_AI_PROVIDERS, is still read until it's gone from Vercel.
 * The fake is never used on Supabase.
 */
export function aiProviders(env: Env = process.env): ProviderName[] {
  const setting = env.VOSSIE_AI_PROVIDERS?.trim() || env.VOSSIE_LISTING_AI_PROVIDERS?.trim() || DEFAULT_PROVIDERS;
  const listed = setting.split(",").map((name) => name.trim());
  const known = [...new Set(listed)].filter((name): name is ProviderName => (KNOWN as readonly string[]).includes(name));
  return onSupabase(env) ? known.filter((name) => name !== "fake") : known;
}

export function providerHasKey(name: ProviderName, env: Env = process.env): boolean {
  return name === "fake" || Boolean(env[KEYS[name]]?.trim());
}

/** The providers a feature may try, in VOSSIE_AI_PROVIDERS's order, each with its key. */
export function featureProviders(feature: AiFeature, env: Env = process.env): ProviderName[] {
  const only = ONLY[feature];
  return aiProviders(env).filter((name) => (!only || only.includes(name)) && providerHasKey(name, env));
}

/** A feature shows only when its switch is "1" and a provider it may use can answer (photo-to-listing decision 14). */
export function aiFeatureOn(feature: AiFeature, env: Env = process.env): boolean {
  return env[SWITCHES[feature]] === "1" && featureProviders(feature, env).length > 0;
}
