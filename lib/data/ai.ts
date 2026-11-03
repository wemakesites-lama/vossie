// lib/data/ai.ts
import "server-only";
import { aiProviders, providerHasKey, type ProviderName } from "@/lib/ai/config";
import {
  checkSuggestion,
  suggestionInstruction,
  suggestionSchema,
  type CategoryChoice,
  type Suggestion,
  type SuggestFailure,
} from "@/lib/selling/suggest";
import type { PhotoType } from "@/lib/types";
import type { ProviderFailure, ProviderRequest, ReadPhoto } from "./ai/types";

// The only door to the AI providers (AI features spec 7.1; photo-to-listing spec decisions 9 to 11). Each provider file
// is loaded only when it's tried, so an SDK is never in a page's code. Failures are logged by provider and kind only:
// never a photo or text.

const LOAD: Readonly<Record<ProviderName, () => Promise<{ read: ReadPhoto }>>> = {
  anthropic: () => import("./ai/anthropic"),
  groq: () => import("./ai/groq"),
  fake: () => import("./ai/fake"),
};

/** These mean the provider couldn't answer, so the next one is tried (photo-to-listing decision 11). */
const MOVE_ON: ReadonlySet<ProviderFailure> = new Set(["timeout", "rate-limited", "model-gone", "api-error"]);

/** Photo-to-listing reads at most this many photos, the cover first (AI features spec 2.2). */
export const PHOTOS_READ = 3;

export type ListingReading = { ok: true; suggestion: Suggestion } | { ok: false; failure: SuggestFailure };

type Photo = { type: PhotoType; bytes: Uint8Array };

function logFailure(provider: ProviderName, failure: SuggestFailure): void {
  console.warn(`[vossie] photo-to-listing: ${provider} ${failure}`);
}

/** What photo-to-listing asks. Exported for the photo test (`scripts/photo-test.hand.ts`). */
export function listingRequest(photos: readonly Photo[], categories: readonly CategoryChoice[]): ProviderRequest {
  return {
    system: suggestionInstruction(categories),
    images: photos.slice(0, PHOTOS_READ).map((photo) => ({
      type: photo.type,
      base64: Buffer.from(photo.bytes).toString("base64"),
    })),
    text: "The photos show one item or service, the cover first.",
    schema: suggestionSchema(categories.map((category) => category.slug)),
  };
}

export async function readListingPhotos(
  photos: readonly Photo[],
  categories: readonly CategoryChoice[],
): Promise<ListingReading> {
  const request = listingRequest(photos, categories);
  const slugs = categories.map((category) => category.slug);
  let last: SuggestFailure = "api-error";
  for (const name of aiProviders()) {
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
    const checked = checkSuggestion(reply.text, slugs);
    if (typeof checked === "string") {
      logFailure(name, checked);
      return { ok: false, failure: checked };
    }
    return { ok: true, suggestion: checked };
  }
  return { ok: false, failure: last };
}
