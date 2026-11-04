// lib/data/ai.ts
import "server-only";
import { featureProviders, type ProviderName } from "@/lib/ai/config";
import {
  checkSuggestion,
  suggestionInstruction,
  suggestionSchema,
  type CategoryChoice,
  type Suggestion,
  type SuggestFailure,
} from "@/lib/selling/suggest";
import {
  checkInstruction,
  checkSchema,
  parseVerdict,
  stopsPublish,
  type Concern,
} from "@/lib/selling/listing-check";
import type { PhotoType } from "@/lib/types";
import type { AiTask, ProviderFailure, ProviderRequest, ReadPhoto } from "./ai/types";

// The only door to the AI providers (AI features spec 7.1; photo-to-listing spec decisions 9 to 11). Each provider file
// is loaded only when it's tried, so an SDK is never in a page's code. Failures are logged by provider and kind only:
// never a photo or text. Each feature has its reader here (photo-to-listing's `readListingPhotos`, the listing check's
// `checkListingGuidelines`).

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

function logFailure(task: AiTask, provider: ProviderName, failure: string): void {
  console.warn(`[vossie] ${task}: ${provider} ${failure}`);
}

/** What photo-to-listing asks. Exported for the photo test (`scripts/photo-test.hand.ts`). */
export function listingRequest(photos: readonly Photo[], categories: readonly CategoryChoice[]): ProviderRequest {
  return {
    task: "photo-to-listing",
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
  for (const name of featureProviders("listing")) {
    const reply = await (await LOAD[name]()).read(request);
    if (!reply.ok) {
      logFailure("photo-to-listing", name, reply.failure);
      if (MOVE_ON.has(reply.failure)) {
        last = reply.failure;
        continue;
      }
      return { ok: false, failure: reply.failure };
    }
    const checked = checkSuggestion(reply.text, slugs);
    if (typeof checked === "string") {
      logFailure("photo-to-listing", name, checked);
      return { ok: false, failure: checked };
    }
    return { ok: true, suggestion: checked };
  }
  return { ok: false, failure: last };
}

/** What the listing check reads (spec 3.1): the listing's words and its cover. Never the seller's name or shop. */
export type ListingForCheck = { title: string; description: string; categoryName: string; cover: Photo | null };

/** What the listing check asks. The title comes first: the fake reads it there. */
export function checkRequest(listing: ListingForCheck): ProviderRequest {
  return {
    task: "listing-check",
    system: checkInstruction(),
    images: listing.cover ? [{ type: listing.cover.type, base64: Buffer.from(listing.cover.bytes).toString("base64") }] : [],
    text: `Title: ${listing.title}\nCategory: ${listing.categoryName}\nDescription: ${listing.description}`,
    schema: checkSchema(),
  };
}

/**
 * The listing check (AI features spec section 3): the guideline a listing plainly breaks, or null to publish. Haiku
 * only (the fake in sample mode). It fails open (spec 3.5): no provider, a failure, a bad reply or anything thrown
 * publishes, and only the kind is logged, never the listing.
 */
export async function checkListingGuidelines(listing: ListingForCheck): Promise<Concern | null> {
  const request = checkRequest(listing);
  for (const name of featureProviders("listing-check")) {
    try {
      const reply = await (await LOAD[name]()).read(request);
      if (!reply.ok) {
        logFailure("listing-check", name, reply.failure);
        if (MOVE_ON.has(reply.failure)) continue;
        return null;
      }
      const verdict = parseVerdict(reply.text);
      if (!verdict) {
        logFailure("listing-check", name, "bad-output");
        return null;
      }
      return stopsPublish(verdict);
    } catch {
      logFailure("listing-check", name, "api-error");
      return null;
    }
  }
  return null;
}
