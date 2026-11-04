import { listingMatches, type ListingNames } from "@/lib/browse/results";
import { queryWords } from "@/lib/browse/search";
import type { ParsedWords } from "@/lib/browse/words";
import type { Listing, MatchQuery, PayFilter, PriceFilter } from "@/lib/types";
import type { RequestFields } from "./rules";

// "Someone's looking for this" (AI round two spec section 5; AI stage G plan): a request's own words are read once into
// a stored search, and a first publish is matched against the open ones with browse's own listingMatches, never a copy
// of its rules. Pure: lib/data/request-match.ts and lib/data/request-reading.ts call these, and Shop coach's
// answer-request (stage I) reuses matchRequests so the two always agree. Askers are compared here, never shown.

/** The most of a request's words that are read (planning decision 2): the title and the start of the details. */
export const REQUEST_WORDS_MAX = 300;
/** The most requests the Published notice links to (spec 5). */
export const WANTED_SHOWN = 3;

type Words = Pick<RequestFields, "title" | "details">;
type Place = Pick<RequestFields, "categorySlug" | "campusSlug">;

/** "{title}. {details}", trimmed, spaces and line breaks collapsed, lowercased, cut at a word: the cache key and the only input. */
export function requestWords({ title, details }: Words): string {
  const head = title.trim();
  const text = `${/[.!?]$/.test(head) ? head : `${head}.`} ${details}`.replace(/\s+/g, " ").trim().toLowerCase();
  const chars = Array.from(text);
  if (chars.length <= REQUEST_WORDS_MAX) return text;
  const cut = chars.slice(0, REQUEST_WORDS_MAX).join("");
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

/**
 * The stored search (planning decision 1): the model's q, and the request's own category and campus; no price, pay or
 * deals. Null when q has no search words, since an empty q would match everything in the category.
 */
export function requestMatchQuery(parse: ParsedWords, place: Place): MatchQuery | null {
  if (queryWords(parse.q).length === 0) return null;
  return { q: parse.q, category: place.categorySlug, campus: place.campusSlug, price: null, pay: null, deals: null };
}

/** A read search moved to the request's new category and campus (planning decision 5): no read, no cap. */
export function withPlace(query: MatchQuery, place: Place): MatchQuery {
  return { ...query, category: place.categorySlug, campus: place.campusSlug };
}

const KEYS = "campus,category,deals,pay,price,q";
const PRICES: readonly PriceFilter[] = ["free", "under-50", "under-100", "under-250", "under-500"];
const PAYS: readonly PayFilter[] = ["cash", "swap"];
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T | null =>
  value === null || (typeof value === "string" && (allowed as readonly string[]).includes(value));

/** A stored search read back (Supabase's jsonb, or anything else): null unless it's exactly a MatchQuery with search words. */
export function asMatchQuery(value: unknown): MatchQuery | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== KEYS) return null;
  const { q, category, campus, price, pay, deals } = record;
  if (typeof q !== "string" || queryWords(q).length === 0) return null;
  if (category !== null && typeof category !== "string") return null;
  if (typeof campus !== "string" || campus === "") return null;
  if (!oneOf(price, PRICES) || !oneOf(pay, PAYS) || !oneOf(deals, ["free-and-swaps"] as const)) return null;
  return { q, category, campus, price, pay, deals };
}

/** A request's stored search and when it was read (with or without one); null readAt means never read. */
export type StoredMatch = { query: MatchQuery | null; readAt: string | null };

/** What a save does to the stored search (planning decisions 4 and 5). */
export type MatchStep = "nothing" | "read" | "move" | "clear";

export function matchStep(
  before: RequestFields | null,
  after: RequestFields,
  stored: StoredMatch | null,
  on: boolean,
): MatchStep {
  if (before === null) return on ? "read" : "nothing";
  const read = Boolean(stored?.readAt);
  const samePlace = before.categorySlug === after.categorySlug && before.campusSlug === after.campusSlug;
  if (requestWords(before) === requestWords(after)) {
    if (on && !read) return "read";
    return samePlace || !stored?.query ? "nothing" : "move";
  }
  if (on) return "read";
  return read || stored?.query ? "clear" : "nothing";
}

/** An open request with a stored search, as the matcher sees it. `askerId` is compared and counted, never shown. */
export type MatchCandidate = { id: string; title: string; askerId: string; query: MatchQuery; createdAt: string };

export type RequestMatch = MatchCandidate & { score: number };

/**
 * The requests a listing answers (spec 5): each candidate's stored search through browse's listingMatches, the
 * seller's own left out, best score first, then newest. Its campus is the request's, so only the listing's campus matches.
 */
export function matchRequests(
  listing: Listing,
  candidates: readonly MatchCandidate[],
  names: ListingNames,
  ownerId: string,
): RequestMatch[] {
  const found: RequestMatch[] = [];
  for (const candidate of candidates) {
    if (candidate.askerId === ownerId) continue;
    const score = listingMatches(listing, candidate.query, names);
    if (score !== null) found.push({ ...candidate, score });
  }
  return found.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
}

/** What the Published notice says (planning decision 7): how many students, and up to three requests, one each. */
export type Wanted = { students: number; requests: { id: string; title: string }[] };

export function wantedFrom(matches: readonly RequestMatch[]): Wanted {
  const seen = new Set<string>();
  const requests: Wanted["requests"] = [];
  for (const match of matches) {
    if (seen.has(match.askerId)) continue;
    seen.add(match.askerId);
    if (requests.length < WANTED_SHOWN) requests.push({ id: match.id, title: match.title });
  }
  return { students: seen.size, requests };
}

/** "2 students are looking for something like this." (spec 5). */
export function wantedLine(students: number): string {
  return students === 1
    ? "1 student is looking for something like this."
    : `${students} students are looking for something like this.`;
}
