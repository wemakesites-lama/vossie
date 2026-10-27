import type { PhotoType } from "@/lib/types";

// The one shape every photo-to-listing provider answers (spec decision 9). A provider turns this into one request and
// hands back the reply's raw text, or why it couldn't answer; lib/data/listing-ai.ts checks the text.

export type ProviderRequest = {
  image: { type: PhotoType; base64: string };
  instruction: string;
  schema: Readonly<Record<string, unknown>>;
};

/** Why a provider couldn't answer. The first four send the photo to the next provider (decision 11). */
export type ProviderFailure = "timeout" | "rate-limited" | "model-gone" | "api-error" | "refusal" | "bad-output";

export type ProviderReply = { ok: true; text: string } | { ok: false; failure: ProviderFailure };

/** Each provider file exports one of these as `read`. */
export type ReadPhoto = (request: ProviderRequest) => Promise<ProviderReply>;

/** A provider answers within this, or it's a timeout. */
export const PROVIDER_TIMEOUT_MS = 10_000;
