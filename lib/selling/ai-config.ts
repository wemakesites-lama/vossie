// lib/selling/ai-config.ts
import { onSupabase } from "@/lib/backend";

// Photo-to-listing's settings (spec decisions 11 and 14). A plain module with no SDK, so a Server Component can ask
// whether to show the button without loading a provider. Read on each call, never kept at module scope.

type Env = Readonly<Record<string, string | undefined>>;

export type ProviderName = "groq" | "anthropic" | "fake";

const KNOWN: readonly ProviderName[] = ["groq", "anthropic", "fake"];
const KEYS: Readonly<Record<Exclude<ProviderName, "fake">, string>> = {
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** VOSSIE_LISTING_AI_PROVIDERS in order ("groq" when unset). The fake is never used on Supabase. */
export function listingAiProviders(env: Env = process.env): ProviderName[] {
  const listed = (env.VOSSIE_LISTING_AI_PROVIDERS ?? "groq").split(",").map((name) => name.trim());
  const known = [...new Set(listed)].filter((name): name is ProviderName => (KNOWN as readonly string[]).includes(name));
  return onSupabase(env) ? known.filter((name) => name !== "fake") : known;
}

export function providerHasKey(name: ProviderName, env: Env = process.env): boolean {
  return name === "fake" || Boolean(env[KEYS[name]]?.trim());
}

/** The button shows only when VOSSIE_LISTING_AI is "1" and a listed provider can answer (decision 14). */
export function listingAiOn(env: Env = process.env): boolean {
  return env.VOSSIE_LISTING_AI === "1" && listingAiProviders(env).some((name) => providerHasKey(name, env));
}
