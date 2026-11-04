import type { ReadPhoto } from "./types";

// Fixed replies for the e2e tests and the sample demo (spec decision 13). Photo-to-listing: a textbook with a module
// code, so the tags, the price hint and the Looking For line can all show. The listing check: see fakeVerdict.
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

export const read: ReadPhoto = async (request) => ({
  ok: true,
  text:
    request.task === "report-read"
      ? fakeFirstRead(request.text)
      : JSON.stringify(request.task === "listing-check" ? fakeVerdict(request.text) : FAKE_REPLY),
});
