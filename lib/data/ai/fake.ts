import type { ReadPhoto } from "./types";

// Fixed replies for the e2e tests and the sample demo (spec decision 13). Photo-to-listing: a textbook with a module
// code, so the tags, the price hint and the Looking For line can all show. The listing check: see fakeVerdict. The words
// search: see fakeWords.
// aiProviders never lists it on Supabase.

export const FAKE_REPLY = {
  title: "Financial Accounting, 3rd edition",
  categorySlug: "textbooks-notes",
  condition: "good",
  description: "A clean copy with a few highlighted pages. No missing pages.",
  alt: "The cover of Financial Accounting, 3rd edition",
  isTextbook: true,
  moduleCode: "FAC1501",
  personIsSubject: false,
  confidence: "high",
} as const;

/**
 * The listing check's fake (AI features spec 3.7): a title with "fake" in it looks like counterfeit goods, so the e2e
 * test can stop a publish; anything else breaks nothing. The title is the request text's first line.
 */
export function fakeVerdict(text: string) {
  const title = text.split("\n")[0] ?? "";
  return /\bfake\b/i.test(title)
    ? { concern: "counterfeit", confidence: "high" }
    : { concern: "none", confidence: "high" };
}

/**
 * The words search's fake (AI stage E planning decision 10): a price, "free", "cheap" and a campus from the schema's
 * campus list, the rest as q. The words are the request text after "Search: ".
 */
export function fakeWords(text: string, campusSlugs: readonly string[]) {
  let rest = ` ${text.replace(/^Search:\s*/, "").toLowerCase()} `;
  const price = /\b(?:under|below|less than)?\s*r\s?(\d{2,})\b/.exec(rest) ?? /\b(\d+)\s?rand\b/.exec(rest);
  if (price) rest = rest.replace(price[0], " ");
  const free = /\bfree\b/.test(rest);
  const cheap = /\bcheap(?:er|est)?\b/.test(rest);
  let campus: string | null = null;
  for (const slug of campusSlugs) {
    const name = ` ${slug.replace(/-/g, " ")} `;
    if (slug !== "all" && rest.includes(name)) {
      campus = slug;
      rest = rest.replace(name, " ");
      break;
    }
  }
  const q = rest
    .replace(/\b(?:free|cheap|cheaper|cheapest|at|in|for|a|an|i|need|want|looking|under|below)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    q: q || null,
    categorySlug: null,
    campus,
    maxPrice: price ? Number(price[1]) : null,
    free,
    pay: null,
    deals: false,
    sort: cheap ? "price-low" : null,
  };
}

/** The campus slugs a words search's schema allows (its enum, less null). */
function schemaCampuses(schema: Readonly<Record<string, unknown>>): string[] {
  const campus = (schema as { properties?: { campus?: { enum?: readonly unknown[] } } }).properties?.campus?.enum ?? [];
  return campus.filter((slug): slug is string => typeof slug === "string");
}

/** One reply per task: a stage adds its own line here. */
function fakeReply(request: Parameters<ReadPhoto>[0]): unknown {
  switch (request.task) {
    case "listing-check":
      return fakeVerdict(request.text);
    case "words-search":
      return fakeWords(request.text, schemaCampuses(request.schema));
    default:
      return FAKE_REPLY;
  }
}

export const read: ReadPhoto = async (request) => ({ ok: true, text: JSON.stringify(fakeReply(request)) });
