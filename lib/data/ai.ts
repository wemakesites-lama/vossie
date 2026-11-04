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
import { reasonLabel } from "@/lib/messaging/rules";
import { parseFirstRead, readInstruction, readSchema, type FirstRead } from "@/lib/staff/report-read";
import type { PhotoType } from "@/lib/types";
import type { ReportReason } from "@/lib/types";
import { checkWords, wordsInstruction, wordsSchema, type ParsedWords } from "@/lib/browse/words";
import type { AiTask, ProviderFailure, ProviderRequest, ReadPhoto } from "./ai/types";
// Stage D: Snap to search.
import {
  checkPhotoSearch,
  photoSearchInstruction,
  photoSearchSchema,
  type PhotoSearchAnswer,
  type PhotoSearchFailure,
} from "@/lib/search/photo";
// Stage H: Starter pack.
import { checkStarter, starterInstruction, starterSchema, type StarterRead } from "@/lib/browse/starter";

// The only door to the AI providers (AI features spec 7.1; photo-to-listing spec decisions 9 to 11). Each provider file
// is loaded only when it's tried, so an SDK is never in a page's code. Failures are logged by provider and kind only:
// never a photo or text. Each feature has its reader here (photo-to-listing's `readListingPhotos`, the listing check's
// `checkListingGuidelines`, the words search's `readSearchWords`, the starter pack's `readStarterPack`).

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

/**
 * What the report read reads (spec 4.2): the reported thing's own words, a listing's cover, and the reporter's reason
 * and detail. Never a name or account; reports never cover messages.
 */
export type ReportForRead = {
  kind: "listing" | "seller" | "request";
  /** The listing's or request's title, or the shop's name. */
  title: string;
  /** The listing's description, the request's details, or the shop's about text. */
  words: string;
  categoryName: string | null;
  cover: Photo | null;
  reason: ReportReason;
  detail: string;
};

const KIND_WORDS = { listing: "a listing", seller: "a shop", request: "a Looking For request" } as const;

/** What the report read asks. The title comes first: the fake reads it there. */
export function reportReadRequest(input: ReportForRead): ProviderRequest {
  return {
    task: "report-read",
    system: readInstruction(),
    images: input.cover ? [{ type: input.cover.type, base64: Buffer.from(input.cover.bytes).toString("base64") }] : [],
    text: [
      `Title: ${input.title}`,
      `Reported: ${KIND_WORDS[input.kind]}`,
      ...(input.categoryName ? [`Category: ${input.categoryName}`] : []),
      `Words: ${input.words}`,
      `Reporter's reason: ${reasonLabel(input.reason)}`,
      `Reporter's detail: ${input.detail || "None given"}`,
    ].join("\n"),
    schema: readSchema(),
  };
}

/** The report read (spec section 4): Haiku only (the fake in sample mode). Null on anything else; only the kind is logged. */
export async function readReport(input: ReportForRead): Promise<FirstRead | null> {
  const request = reportReadRequest(input);
  for (const name of featureProviders("report-read")) {
    try {
      const reply = await (await LOAD[name]()).read(request);
      if (!reply.ok) {
        logFailure("report-read", name, reply.failure);
        if (MOVE_ON.has(reply.failure)) continue;
        return null;
      }
      const read = parseFirstRead(reply.text);
      if (!read) logFailure("report-read", name, "bad-output");
      return read;
    } catch {
      logFailure("report-read", name, "api-error");
      return null;
    }
  }
  return null;
}

type Named = { slug: string; name: string };

/** The words search's wait (AI stage E review): Browse searches the words exactly after this. */
export const WORDS_TIMEOUT_MS = 3_000;

/** What the words search asks (spec 6): the normalised words only. Never an account, a campus cookie or a filter. */
export function wordsRequest(words: string, categories: readonly Named[], campuses: readonly Named[]): ProviderRequest {
  return {
    task: "words-search",
    system: wordsInstruction(categories, campuses),
    images: [],
    text: `Search: ${words}`,
    schema: wordsSchema(
      categories.map((category) => category.slug),
      campuses.map((campus) => campus.slug),
    ),
    // Browse waits on this inside its <Suspense> (spec 6.6): give up after 3 seconds and search the words exactly.
    quick: { timeoutMs: WORDS_TIMEOUT_MS },
  };
}

/**
 * The words search (AI features spec section 6): the filters a sentence asks for, or null to search the words exactly.
 * Haiku only (the fake in sample mode). No provider, a failure, a bad reply or anything thrown is null; only the kind is
 * logged, never the words.
 */
export async function readSearchWords(
  words: string,
  categories: readonly Named[],
  campuses: readonly Named[],
): Promise<ParsedWords | null> {
  const request = wordsRequest(words, categories, campuses);
  const slugs = { categories: categories.map((c) => c.slug), campuses: campuses.map((c) => c.slug) };
  for (const name of featureProviders("words-search")) {
    try {
      const reply = await (await LOAD[name]()).read(request);
      if (!reply.ok) {
        logFailure("words-search", name, reply.failure);
        if (MOVE_ON.has(reply.failure)) continue;
        return null;
      }
      const parsed = checkWords(reply.text, slugs);
      if (!parsed) logFailure("words-search", name, "bad-output");
      return parsed;
    } catch {
      logFailure("words-search", name, "api-error");
      return null;
    }
  }
  return null;
}

// --- Stage H: Starter pack (AI round two spec section 6) ---------------------------------------------------------

/** The starter pack's wait (spec 6): the page offers Browse after this. */
export const STARTER_TIMEOUT_MS = 5_000;

/** What the starter pack asks (spec 6): the normalised sentence only. Never an account, a campus cookie or a filter. */
export function starterRequest(
  sentence: string,
  categories: readonly CategoryChoice[],
  campuses: readonly Named[],
): ProviderRequest {
  return {
    task: "starter-pack",
    system: starterInstruction(categories, campuses),
    images: [],
    text: `Sentence: ${sentence}`,
    schema: starterSchema(
      categories.map((category) => category.slug),
      campuses.map((campus) => campus.slug),
    ),
    // The page waits on this inside its <Suspense>: give up after 5 seconds and offer Browse.
    quick: { timeoutMs: STARTER_TIMEOUT_MS },
  };
}

/**
 * The starter pack's read (spec 6): the campus, budget and items a sentence names, or null. Haiku only (the fake in
 * sample mode). No provider, a failure, a bad reply or anything thrown is null; only the kind is logged, never the
 * sentence.
 */
export async function readStarterPack(
  sentence: string,
  categories: readonly CategoryChoice[],
  campuses: readonly Named[],
): Promise<StarterRead | null> {
  const request = starterRequest(sentence, categories, campuses);
  const slugs = { categories: categories.map((c) => c.slug), campuses: campuses.map((c) => c.slug) };
  for (const name of featureProviders("starter-pack")) {
    try {
      const reply = await (await LOAD[name]()).read(request);
      if (!reply.ok) {
        logFailure("starter-pack", name, reply.failure);
        if (MOVE_ON.has(reply.failure)) continue;
        return null;
      }
      const read = checkStarter(reply.text, slugs);
      if (!read) logFailure("starter-pack", name, "bad-output");
      return read;
    } catch {
      logFailure("starter-pack", name, "api-error");
      return null;
    }
  }
  return null;
}

// --- Stage D: Snap to search (AI features spec section 5) --------------------------------------------------------

export type SearchPhotoReading = { ok: true; answer: PhotoSearchAnswer } | { ok: false; failure: PhotoSearchFailure };

/** What Snap to search asks (spec 5.2): one photo, already re-encoded and stripped. Never anything about the buyer. */
export function searchRequest(photo: Photo, categories: readonly CategoryChoice[]): ProviderRequest {
  return {
    task: "photo-search",
    system: photoSearchInstruction(categories),
    images: [{ type: photo.type, base64: Buffer.from(photo.bytes).toString("base64") }],
    text: "The photo shows something a student wants to buy.",
    schema: photoSearchSchema(categories.map((category) => category.slug)),
  };
}

/**
 * Snap to search (spec section 5): Haiku, then Groq when Haiku couldn't answer, the fake in sample mode. The photo is
 * sent once and dropped; only the provider and the failure's kind are logged.
 */
export async function readSearchPhoto(photo: Photo, categories: readonly CategoryChoice[]): Promise<SearchPhotoReading> {
  const request = searchRequest(photo, categories);
  const slugs = categories.map((category) => category.slug);
  let last: PhotoSearchFailure = "api-error";
  for (const name of featureProviders("photo-search")) {
    const reply = await (await LOAD[name]()).read(request);
    if (!reply.ok) {
      logFailure("photo-search", name, reply.failure);
      if (MOVE_ON.has(reply.failure)) {
        last = reply.failure;
        continue;
      }
      return { ok: false, failure: reply.failure };
    }
    const checked = checkPhotoSearch(reply.text, slugs);
    if (typeof checked === "string") {
      logFailure("photo-search", name, checked);
      return { ok: false, failure: checked };
    }
    return { ok: true, answer: checked };
  }
  return { ok: false, failure: last };
}
