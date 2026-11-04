import { cacheLife } from "next/cache";
import { aiFeatureOn } from "@/lib/ai/config";
import { toSearchQuery } from "@/lib/browse/query";
import {
  nameWords,
  normaliseSentence,
  pickPack,
  starterQuery,
  type ItemFinds,
  type Pack,
  type StarterItem,
  type StarterRead,
} from "@/lib/browse/starter";
import { WORDS_SEARCH_DAILY_CAP } from "@/lib/browse/words";
import type { CampusChoice } from "@/lib/types";
import { readStarterPack } from "./ai";
import { getCampuses, getCategories, searchListings } from "./index";
import { tagStarterPack } from "./tags";
import { reserveWordsSearch } from "./words-search";

// Starter pack (AI round two spec section 6; stage H plan Task 4): the read, cached by the normalised sentence alone,
// counted against the words search's daily cap only on a miss, then each item searched through Browse's own reader.

const DAY = 60 * 60 * 24;

/**
 * The read, kept at most a week by the normalised sentence alone (spec 6). A miss takes one of the day's parses first,
 * from the cap the words search uses. A full cap or a failure throws, so nothing is cached and the page offers Browse.
 * The sentence is its only argument: nothing about the request (an account, a campus cookie) may reach it.
 */
export async function parseStarterSentence(sentence: string): Promise<StarterRead> {
  "use cache";
  // As parseSearchWords: expire longer than revalidate, a week at most.
  cacheLife({ stale: 300, revalidate: 6 * DAY, expire: 7 * DAY });
  tagStarterPack();
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  if (!(await reserveWordsSearch(new Date(), WORDS_SEARCH_DAILY_CAP))) throw new Error("starter-pack: over the cap");
  const read = await readStarterPack(sentence, categories, campuses);
  if (!read) throw new Error("starter-pack: no read");
  return read;
}

/** One item's matches (spec 6, planning decision 4): its words, then its name alone when they found nothing. */
async function findFor(item: StarterItem, campus: CampusChoice): Promise<ItemFinds> {
  const search = async (words: string) =>
    (await searchListings(toSearchQuery(starterQuery(words, item.category, campus)))).items;
  const matches = await search(item.words);
  const name = nameWords(item.name);
  if (matches.length > 0 || !name || name === item.words) return { item, words: item.words, matches };
  return { item, words: name, matches: await search(name) };
}

export type StarterOutcome =
  | { kind: "empty" }
  | { kind: "failed"; sentence: string }
  | { kind: "pack"; sentence: string; pack: Pack; campus: CampusChoice };

/**
 * The page's one call (spec 6): nothing without a sentence; the pack at the sentence's campus, else the viewer's; or
 * "failed" for the switch off, a full cap, no read or a search that threw (planning decision 9).
 */
export async function starterPackFor(sentence: string | null, viewerCampus: CampusChoice): Promise<StarterOutcome> {
  if (!sentence) return { kind: "empty" };
  if (!aiFeatureOn("starter-pack")) return { kind: "failed", sentence };
  try {
    const read = await parseStarterSentence(normaliseSentence(sentence));
    const campus = read.campus ?? viewerCampus;
    const finds = await Promise.all(read.items.map((item) => findFor(item, campus)));
    return { kind: "pack", sentence, pack: pickPack(finds, read.budget, campus), campus };
  } catch {
    // Only the kind, never the sentence (the door has logged the provider's failure already).
    return { kind: "failed", sentence };
  }
}
