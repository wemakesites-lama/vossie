// lib/data/listing-ai.ts
import "server-only";
import type { PhotoType } from "@/lib/types";
import { listingAiProviders, providerHasKey, type ProviderName } from "@/lib/selling/ai-config";
import {
  checkSuggestion,
  SUGGESTION_INSTRUCTION,
  suggestionSchema,
  type Suggestion,
  type SuggestFailure,
} from "@/lib/selling/suggest";
import type { ProviderFailure, ReadPhoto } from "./listing-ai/types";

// The only door to photo-to-listing's providers (spec decisions 9 to 11). Each provider file is loaded only when it's
// tried, so an SDK is never in a page's code. Failures are logged by provider and kind only: never the photo or text.

const LOAD: Readonly<Record<ProviderName, () => Promise<{ read: ReadPhoto }>>> = {
  groq: () => import("./listing-ai/groq"),
  anthropic: () => import("./listing-ai/anthropic"),
  fake: () => import("./listing-ai/fake"),
};

/** These mean the provider couldn't answer, so the next one is tried (decision 11). */
const MOVE_ON: ReadonlySet<ProviderFailure> = new Set(["timeout", "rate-limited", "model-gone", "api-error"]);

export type CoverReading = { ok: true; suggestion: Suggestion } | { ok: false; failure: SuggestFailure };

function logFailure(provider: ProviderName, failure: SuggestFailure): void {
  console.warn(`[vossie] photo-to-listing: ${provider} ${failure}`);
}

export async function readCoverPhoto(
  photo: { type: PhotoType; bytes: Uint8Array },
  categorySlugs: readonly string[],
): Promise<CoverReading> {
  const request = {
    image: { type: photo.type, base64: Buffer.from(photo.bytes).toString("base64") },
    instruction: SUGGESTION_INSTRUCTION,
    schema: suggestionSchema(categorySlugs),
  };
  let last: SuggestFailure = "api-error";
  for (const name of listingAiProviders()) {
    if (!providerHasKey(name)) continue;
    const reply = await (await LOAD[name]()).read(request);
    if (!reply.ok) {
      logFailure(name, reply.failure);
      if (MOVE_ON.has(reply.failure)) {
        last = reply.failure;
        continue;
      }
      return { ok: false, failure: reply.failure };
    }
    const checked = checkSuggestion(reply.text, categorySlugs);
    if (typeof checked === "string") {
      logFailure(name, checked);
      return { ok: false, failure: checked };
    }
    return { ok: true, suggestion: checked };
  }
  return { ok: false, failure: last };
}
