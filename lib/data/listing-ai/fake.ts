import type { ReadPhoto } from "./types";

// A fixed reply for the e2e tests and the sample demo (spec decision 13): a textbook with a module code, so the tags,
// the price hint and the Looking For line can all show. listingAiProviders never lists it on Supabase.

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

export const read: ReadPhoto = async () => ({ ok: true, text: JSON.stringify(FAKE_REPLY) });
