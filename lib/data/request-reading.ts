import { aiFeatureOn } from "@/lib/ai/config";
import { looksLikeSentence, WORDS_SEARCH_DAILY_CAP } from "@/lib/browse/words";
import { matchStep, requestMatchQuery, requestWords, withPlace } from "@/lib/looking-for/match";
import type { RequestFields } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { MatchQuery } from "@/lib/types";
import { readSearchWords } from "./ai";
import { getCampuses, getCategories } from "./index";
import { requestMatchOf, saveRequestMatch, unreadRequests } from "./request-match";
import { parseSearchWords, reserveWordsSearch } from "./words-search";

// Reading a Looking For request into its stored search ("Someone's looking for this", AI round two spec 5; AI stage G
// plan Task 5): once when it's posted, again when an edit changes its words, and by the backfill. Request-time only:
// saveMyRequest calls readRequestMatch after the save and before requestsChanged(); nothing here runs inside
// "use cache" (parseSearchWords is the words search's cached parse, whose cap reservation is its own). Only the words
// go to the model: no account, campus cookie or budget.

/** The search a request's words read as, or null: not a sentence, a full cap, a failed call, or no item words. */
async function queryFor(fields: RequestFields): Promise<MatchQuery | null> {
  const words = requestWords(fields);
  if (!looksLikeSentence(words, await getCampuses())) return null;
  try {
    return requestMatchQuery(await parseSearchWords(words), fields);
  } catch {
    // parseSearchWords throws on a full cap or any failure, so nothing bad is cached: this request just isn't matched.
    return null;
  }
}

/**
 * After a request is posted (`before` null) or edited: reads, moves, clears or leaves its stored search (planning
 * decisions 4 and 5). Never throws, so a request is always posted; only the kind of failure is logged.
 */
export async function readRequestMatch({
  id,
  askerId,
  before,
  after,
  now,
}: {
  id: string;
  askerId: string;
  before: RequestFields | null;
  after: RequestFields;
  now: Date;
}): Promise<void> {
  try {
    const on = aiFeatureOn("looking-match");
    if (before === null && !on) return;
    const stored = before === null ? null : await requestMatchOf(askerId, id);
    const step = matchStep(before, after, stored, on);
    if (step === "nothing") return;
    if (step === "clear") await saveRequestMatch(id, null, false, now);
    else if (step === "move" && stored?.query) await saveRequestMatch(id, withPlace(stored.query, after), true, now);
    else if (step === "read") await saveRequestMatch(id, await queryFor(after), true, now);
  } catch {
    console.warn("[vossie] looking-match: store error");
  }
}

/** Requests the backfill reads per call (Haiku's 3-second wait each, well inside a function's time). */
export const BACKFILL_BATCH = 15;

export type Backfill = { matched: number; unmatched: number; more: boolean; capped: boolean };

/**
 * The one-off backfill (spec 5, planning decision 10): open requests never read, oldest first, BACKFILL_BATCH a call.
 * It reserves and reads directly, not through the cached parse, so a full cap stops it without marking anything.
 */
export async function backfillRequestMatches(now: Date): Promise<Backfill> {
  const due = await unreadRequests(sastDate(now), BACKFILL_BATCH + 1);
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  let matched = 0;
  let unmatched = 0;
  for (const { id, fields } of due.slice(0, BACKFILL_BATCH)) {
    const words = requestWords(fields);
    let query: MatchQuery | null = null;
    if (looksLikeSentence(words, campuses)) {
      if (!(await reserveWordsSearch(now, WORDS_SEARCH_DAILY_CAP))) return { matched, unmatched, more: true, capped: true };
      const parsed = await readSearchWords(words, categories, campuses);
      query = parsed ? requestMatchQuery(parsed, fields) : null;
    }
    // A row that can't be saved (gone, or a sample) isn't counted, so a caller looping on `more` can't spin on it.
    if (!(await saveRequestMatch(id, query, true, now))) continue;
    if (query) matched += 1;
    else unmatched += 1;
  }
  return { matched, unmatched, more: due.length > BACKFILL_BATCH, capped: false };
}
