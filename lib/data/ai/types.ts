import type { PhotoType } from "@/lib/types";

// The one shape every AI provider answers (photo-to-listing spec decision 9; AI features spec 7.1). A
// provider turns this into one request and hands back the reply's raw text, or why it couldn't answer; lib/data/ai.ts
// checks the text.

/** One photo as a provider gets it. */
export type ProviderImage = { type: PhotoType; base64: string };

/** What a request is for: the fake answers each, and a failure's log line names it. */
export type AiTask = "photo-to-listing" | "listing-check";

export type ProviderRequest = {
  task: AiTask;
  /** The instruction, sent as the system prompt. */
  system: string;
  /** None to three photos in the seller's order, the cover first (AI features spec 2.2). Groq reads only the first. */
  images: readonly ProviderImage[];
  /** What's asked of the photos. */
  text: string;
  schema: Readonly<Record<string, unknown>>;
};

/** Why a provider couldn't answer. The first four send the photo to the next provider (decision 11). */
export type ProviderFailure = "timeout" | "rate-limited" | "model-gone" | "api-error" | "refusal" | "bad-output";

export type ProviderReply = { ok: true; text: string } | { ok: false; failure: ProviderFailure };

/** Each provider file exports one of these as `read`. */
export type ReadPhoto = (request: ProviderRequest) => Promise<ProviderReply>;

/** A provider answers within this, or it's a timeout. */
export const PROVIDER_TIMEOUT_MS = 10_000;
