import { DEALS_LABEL, PAY_LABELS, PRICE_LABELS } from "@/lib/browse/filters";
import { browseHref } from "@/lib/browse/href";
import { defaultSort, PAGE_SIZE, parseBrowseParams, type BrowseParams, type KnownSlugs } from "@/lib/browse/query";
import { queryWords } from "@/lib/browse/search";
import { ALL_CAMPUSES, ONLINE_CAMPUS } from "@/lib/campus";
import { savedTabPath } from "@/lib/following/rules";
import { safeNextPath } from "@/lib/next-path";
import type { MatchQuery } from "@/lib/types";

// Saved searches (search alerts spec 2.1 to 2.8; plan decisions 2 to 5, 7 and 9): what one is, when two are the same,
// what's worth saving, its label and links, and where the status lines wait. Plain functions over browse's own
// parser and search words, so a saved search, its link and its alert always agree.

/** The most an account keeps (spec 2.4). */
export const SAVED_SEARCH_LIMIT = 20;

/** The fields Save this search posts (spec 2.5), read as browse reads its link. `max` is browse's price alias. */
export const SEARCH_FIELDS = ["q", "cat", "campus", "price", "max", "pay", "deals"] as const;

/** Saved's Searches tab (spec 2.7). */
export const SAVED_SEARCHES_PATH = savedTabPath("searches");

/** Where Pause, Resume and Delete leave the Searches tab's status line (plan decision 7). */
export const SAVED_SEARCHES_FORM = "saved-searches";

/**
 * A search as it's matched and saved (plan decision 2): browse's query without its order or paging. Words that are
 * all stop words or single letters match like none, so they're kept as null.
 */
export function matchQueryOf({ q, category, campus, price, pay, deals }: MatchQuery): MatchQuery {
  return { q: queryWords(q).length > 0 ? q : null, category, campus, price, pay, deals };
}

/**
 * A saved search from Save this search's fields (spec 2.1), read with browse's own parser, so the max alias, unknown
 * values and the 100-character cut work as they do on the page. The form always posts the campus; a post without
 * one is for every campus. Sort and n are dropped.
 */
export function savedSearchFrom(params: BrowseParams, known: KnownSlugs): MatchQuery {
  return matchQueryOf(parseBrowseParams(params, ALL_CAMPUSES, known));
}

/** Worth saving (spec 2.4): words, a category, or a price, pay or deals filter. A campus alone isn't. */
export function isWorthSaving(search: MatchQuery): boolean {
  return (
    queryWords(search.q).length > 0 ||
    search.category !== null ||
    search.price !== null ||
    search.pay !== null ||
    search.deals !== null
  );
}

/**
 * Two searches are the same (spec 2.4, plan decision 3) when they have the same set of words and the same filters:
 * "Calculator casio" is "casio calculator", and case, accents, stop words and repeats don't count.
 */
export function searchKey(search: MatchQuery): string {
  const words = [...new Set(queryWords(search.q))].sort();
  return [
    words.join(" "),
    search.category ?? "",
    search.campus,
    search.price ?? "",
    search.pay ?? "",
    search.deals ?? "",
  ].join("|");
}

/** Category and campus names by slug, for the label. */
export type SearchNames = {
  categories: ReadonlyMap<string, string>;
  campuses: ReadonlyMap<string, string>;
};

/** A browse chip's words inside a sentence: "Under R100" becomes "under R100". */
const inSentence = (chip: string) => chip.charAt(0).toLowerCase() + chip.slice(1);

/** The filters' words, in the browse chips' order (spec 2.3): "under R100", "cash", "free & swaps". */
export function filterWords(search: Pick<MatchQuery, "price" | "pay" | "deals">): string[] {
  const words: string[] = [];
  if (search.price) words.push(inSentence(PRICE_LABELS[search.price]));
  if (search.pay) words.push(inSentence(PAY_LABELS[search.pay]));
  if (search.deals) words.push(inSentence(DEALS_LABEL));
  return words;
}

/** " at Midrand", " on Eduvos Online" or " at every campus" (spec 2.3). */
function campusWords(campus: string, names: SearchNames): string {
  if (campus === ALL_CAMPUSES) return " at every campus";
  if (campus === ONLINE_CAMPUS) return " on Eduvos Online";
  return ` at ${names.campuses.get(campus) ?? campus}`;
}

/**
 * A saved search's name (spec 2.3, plan decision 4), built from the query whenever it's shown: "“calculator” in Tech
 * at Midrand, under R100", "Tech at every campus", "Everything on Eduvos Online, free". It can't be renamed.
 */
export function savedSearchLabel(search: MatchQuery, names: SearchNames): string {
  const category = search.category ? (names.categories.get(search.category) ?? search.category) : null;
  let what = category ?? "Everything";
  if (search.q) what = category ? `“${search.q}” in ${category}` : `“${search.q}”`;
  return [`${what}${campusWords(search.campus, names)}`, ...filterWords(search)].join(", ");
}

/**
 * A saved search's results (spec 2.7, plan decision 5): browse's link with the campus pinned, so it never depends on
 * one device's cookie. "new" is for a notification about several new listings (spec 2.12): Newest first.
 */
export function savedSearchHref(search: MatchQuery, sort?: "new"): string {
  return browseHref({ ...search, campusFromLink: true, sort: sort ?? defaultSort(search.q), shown: PAGE_SIZE });
}

/** Save this search's `from` (spec 2.5, plan decision 9): a browse link on this site, or null. */
export function browseFrom(raw: string): string | null {
  const path = safeNextPath(raw);
  return path && (path === "/browse" || path.startsWith("/browse?")) ? path : null;
}

/** Where the browse row's status line waits, so it shows only on its own search's row (plan decision 7). */
export function saveSearchNoteKey(search: MatchQuery): string {
  return `save-search:${searchKey(search)}`;
}

/** What the last Save this search said (spec 2.6): saved, or why not. */
export type SaveNote = "saved" | "already" | "limit";

export function saveNoteOf(state: { errors: readonly string[]; notice: string | null } | null): SaveNote | null {
  if (!state) return null;
  if (state.notice === "saved") return "saved";
  const [error] = state.errors;
  return error === "already" || error === "limit" ? error : null;
}

/** The Searches tab's status line (plan decision 7): what was done, to which search, and where its results are. */
export type SavedSearchNotice = { code: "paused" | "resumed" | "deleted"; label: string; href: string };

export function savedSearchNoticeOf(
  state: { notice: string | null; values: Record<string, string> } | null,
): SavedSearchNotice | null {
  if (!state) return null;
  const { notice, values } = state;
  if (notice !== "paused" && notice !== "resumed" && notice !== "deleted") return null;
  return { code: notice, label: values.label ?? "", href: values.href ?? SAVED_SEARCHES_PATH };
}
