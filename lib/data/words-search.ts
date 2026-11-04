import { cacheLife } from "next/cache";
import { aiFeatureOn } from "@/lib/ai/config";
import { onSupabase } from "@/lib/backend";
import {
  applyWords,
  looksLikeSentence,
  normaliseWords,
  WORDS_SEARCH_DAILY_CAP,
  wordsLine,
  type ParsedWords,
} from "@/lib/browse/words";
import { sastDate } from "@/lib/time";
import type { BrowseQuery } from "@/lib/types";
import { readSearchWords } from "./ai";
import { getCampuses, getCategories } from "./index";
import { sampleStore } from "./store";
import { tagWordsSearch } from "./tags";

// Search in your own words (AI features spec 6; AI stage E plan Task 4): the parse, cached by the normalised words
// alone, and the site-wide daily cap, counted only when the cache misses.

const supabase = () => import("./supabase/words-search");

const DAY = 60 * 60 * 24;

/** Takes one of today's (SAST) parses while under `cap`, else takes nothing (plan decision 5). */
export async function reserveWordsSearch(now: Date, cap: number): Promise<boolean> {
  if (onSupabase()) return (await supabase()).reserveWordsSearch(now, cap);
  const store = sampleStore();
  const day = sastDate(now);
  const used = store.wordsSearchParses.get(day) ?? 0;
  if (used >= cap) return false;
  store.wordsSearchParses.clear(); // only today's count is kept
  store.wordsSearchParses.set(day, used + 1);
  return true;
}

/**
 * The parse, kept at most a week by the normalised words alone (spec 6.3). A miss takes one of the day's parses first.
 * A full cap or a failure throws, so nothing is cached and Browse searches the words exactly (plan decision 6). The
 * words are its only argument: nothing about the request (an account, a campus cookie) may reach it.
 */
export async function parseSearchWords(words: string): Promise<ParsedWords> {
  "use cache";
  // Next wants expire longer than revalidate: a week at most, refreshed in the background after six days.
  cacheLife({ stale: 300, revalidate: 6 * DAY, expire: 7 * DAY });
  tagWordsSearch();
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  if (!(await reserveWordsSearch(new Date(), WORDS_SEARCH_DAILY_CAP))) throw new Error("words-search: over the cap");
  const parsed = await readSearchWords(words, categories, campuses);
  if (!parsed) throw new Error("words-search: no parse");
  return parsed;
}

export type WordsSearch = {
  /** The query Browse shows. */
  query: BrowseQuery;
  /** "Showing calculator under R500 at Midrand.", or null when the words were searched as typed. */
  line: string | null;
  /** The query as the link had it, for "Search for exactly what I typed". */
  typed: BrowseQuery;
};

/**
 * Browse's one call: the query to show and the line above the results, or the query unchanged with no line for a short
 * search, an exact one, the switch off, a full cap or any failure (spec 6.2, 6.4 and 6.5).
 */
export async function wordsSearchFor(typed: BrowseQuery): Promise<WordsSearch> {
  const unchanged: WordsSearch = { query: typed, line: null, typed };
  if (!typed.q || typed.exact || !aiFeatureOn("words-search")) return unchanged;
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  if (!looksLikeSentence(typed.q, campuses)) return unchanged;
  try {
    const applied = applyWords(typed, await parseSearchWords(normaliseWords(typed.q)));
    if (!applied) return unchanged;
    const names = {
      campuses: new Map(campuses.map((campus) => [campus.slug, campus.name])),
      categories: new Map(categories.map((category) => [category.slug, category.name])),
    };
    return { query: applied, line: wordsLine(applied, names), typed };
  } catch {
    return unchanged;
  }
}
