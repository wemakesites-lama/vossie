import type { ReadPhoto } from "./types";

// Fixed replies for the e2e tests and the sample demo (spec decision 13). Photo-to-listing: a textbook with a module
// code, so the tags, the price hint and the Looking For line can all show; with two photos or more, a better cover
// (FAKE_COVER_TIP). The listing check: see fakeVerdict. The words
// search: see fakeWords. Snap to search: see FAKE_SEARCH_REPLY.
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
  photoTip: null,
} as const;

/** Photo tips' fake (AI stage F): with two photos or more, photo 2 is the better cover, so the e2e test can move it. */
export const FAKE_COVER_TIP = {
  photo: 2,
  kind: "better-cover",
  text: "This one shows the whole cover, so buyers see more.",
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
 * The report read's fake (AI stage C, planning decision 9): "fake" in the title is counterfeit, else none; it agrees when
 * that matches a "Prohibited item" reason. A detail with "[no read]" in it is a bad reply, so the e2e test sees Read again.
 */
export function fakeFirstRead(text: string): string {
  if (text.includes("[no read]")) return "not a read";
  const title = (text.split("\n")[0] ?? "").replace(/^Title: /, "");
  const concern = /\bfake\b/i.test(title) ? "counterfeit" : "none";
  const prohibited = /^Reporter's reason: Prohibited item$/m.test(text);
  return JSON.stringify({ summary: `A report about ${title}.`.slice(0, 140), concern, agrees: (concern !== "none") === prohibited });
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

/** Snap to search's fake (AI features spec 5.2): words that find the sample Casio calculator (l-001). */
export const FAKE_SEARCH_REPLY = {
  words: ["casio", "calculator"],
  categorySlug: "tech",
  moduleCode: null,
  personIsSubject: false,
  confidence: "high",
} as const;

/** One reply per task: a stage adds its own line here. */
function fakeReply(request: Parameters<ReadPhoto>[0]): unknown {
  switch (request.task) {
    case "listing-check":
      return fakeVerdict(request.text);
    case "words-search":
      return fakeWords(request.text, schemaCampuses(request.schema));
    case "photo-search":
      return FAKE_SEARCH_REPLY;
    case "photo-to-listing":
      return request.images.length > 1 ? { ...FAKE_REPLY, photoTip: FAKE_COVER_TIP } : FAKE_REPLY;
    default:
      return FAKE_REPLY;
  }
}

export const read: ReadPhoto = async (request) => ({
  ok: true,
  // The report read's fake gives its reply text as is, so it can give a bad one (fakeFirstRead).
  text: request.task === "report-read" ? fakeFirstRead(request.text) : JSON.stringify(fakeReply(request)),
});
