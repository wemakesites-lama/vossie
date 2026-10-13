// Search on the browse page (browse and listing spec 4.8). Plain functions: Supabase later swaps them for Postgres
// full-text search with trigram matching, and the rules stay the same.

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** Typos are forgiven only in query words this long or longer. */
const TYPO_MIN_LENGTH = 5;

/** Lowercase words with accents removed, split on anything that isn't a letter or digit. */
export function searchWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The words a search looks for: no stop words and no single letters. Digits stay ("Accounting 1"). */
export function queryWords(q: string | null): string[] {
  if (!q) return [];
  return searchWords(q).filter((word) => !STOP_WORDS.has(word) && !(word.length === 1 && /\p{L}/u.test(word)));
}

/** True when `a` becomes `b` with at most one letter added, removed or changed, or two neighbours swapped. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    const differences: number[] = [];
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) differences.push(i);
      if (differences.length > 2) return false;
    }
    if (differences.length === 1) return true;
    const [first, second] = differences;
    return second === first + 1 && a[first] === b[second] && a[second] === b[first];
  }

  // One letter added or removed: skip it in the longer word and the rest must match.
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < shorter.length && shorter[i] === longer[i]) i += 1;
  return shorter.slice(i) === longer.slice(i + 1);
}

/** A query word matches a word in the text when the text word starts with it, or, if it's long enough, is one typo away. */
export function wordMatches(queryWord: string, textWord: string): boolean {
  if (textWord.startsWith(queryWord)) return true;
  return queryWord.length >= TYPO_MIN_LENGTH && withinOneEdit(queryWord, textWord);
}

/** The text a listing is searched by. */
export type SearchFields = {
  title: string;
  category: string;
  seller: string;
  description: string;
};

/**
 * The Best match score, or null when any query word is missing. Each word scores where it's found first: 3 in the
 * title, 2 in the category or seller name, 1 in the description. With no words, everything matches with 0.
 */
export function matchScore(fields: SearchFields, words: readonly string[]): number | null {
  if (words.length === 0) return 0;
  const title = searchWords(fields.title);
  const names = searchWords(`${fields.category} ${fields.seller}`);
  const description = searchWords(fields.description);
  const found = (text: readonly string[], word: string) => text.some((textWord) => wordMatches(word, textWord));

  let score = 0;
  for (const word of words) {
    if (found(title, word)) score += 3;
    else if (found(names, word)) score += 2;
    else if (found(description, word)) score += 1;
    else return null;
  }
  return score;
}
