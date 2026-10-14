import type { ConversationStatus, ReportReason } from "@/lib/types";

// Messaging's limits and text rules (messaging spec 2 and FUNCTION-MAP section 6). Plain values and functions: safe
// anywhere on the server and in tests.

/** A message, a swap offer and a report's detail, in characters (code points). */
export const MESSAGE_MAX = 1000;
export const SWAP_OFFER_MAX = 200;
export const REPORT_DETAIL_MAX = 500;
/** Typed text kept in form state after a failed post is cut at this many characters (plan decision 8). */
export const KEEP_MAX = 4000;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** A sale confirms itself 7 days after the seller marks it done (spec 2.5). */
export const AUTO_CONFIRM_MS = 7 * DAY_MS;
/** Reports an account can send in 24 hours (plan decision 17). */
export const REPORTS_PER_DAY = 10;
/** How many notifications /notifications shows (plan decision 12). */
export const NOTIFICATIONS_SHOWN = 50;

/** How many characters a text has, counting each letter or emoji once, as the limits mean them. */
export function characterCount(text: string): number {
  return [...text].length;
}

/**
 * User text as it's stored (spec 2.12, plan decision 29): every line break becomes "\n", control characters other than
 * line breaks and tabs go, and the ends are trimmed. Pages render it as text, never as HTML.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n\t]/gu, "")
    .trim();
}

/** At most `max` characters, cut with "…". Never splits an emoji. */
export function truncate(text: string, max: number): string {
  const characters = [...text];
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join("").trimEnd()}…`;
}

/** A message's first line, at most 80 characters, for the inbox (spec 3.2). */
export function firstLine(text: string, max = 80): string {
  return truncate(text.split("\n")[0].trim(), max);
}

export type TextCheck<E extends string> = { value: string; error: E | null };

/** A message (spec 3.1): something, and at most 1,000 characters. */
export function checkMessage(raw: string): TextCheck<"message-missing" | "message-length"> {
  const value = cleanText(raw);
  if (value === "") return { value, error: "message-missing" };
  return { value, error: characterCount(value) > MESSAGE_MAX ? "message-length" : null };
}

/** An optional swap offer (spec 2.4), at most 200 characters. "" is no offer. */
export function checkSwapOffer(raw: string): TextCheck<"swap-length"> {
  const value = cleanText(raw);
  return { value, error: characterCount(value) > SWAP_OFFER_MAX ? "swap-length" : null };
}

/** A report's optional detail (spec 2.8), at most 500 characters. */
export function checkReportDetail(raw: string): TextCheck<"detail-length"> {
  const value = cleanText(raw);
  return { value, error: characterCount(value) > REPORT_DETAIL_MAX ? "detail-length" : null };
}

/** Typed text kept for a form to show again after a failed post (plan decision 8). */
export function keepTyped(text: string): string {
  return [...text].slice(0, KEEP_MAX).join("");
}

const STATUS_LABELS: Readonly<Record<ConversationStatus, string>> = {
  asked: "Asked",
  replied: "Replied",
  done: "Done",
  confirmed: "Confirmed",
};

/** The status pill's words (spec 2.5). */
export function statusLabel(status: ConversationStatus): string {
  return STATUS_LABELS[status];
}

/** When a sale marked done at `completedAt` confirms itself (spec 2.5, plan decision 30). */
export function autoConfirmAt(completedAt: string): string {
  return new Date(Date.parse(completedAt) + AUTO_CONFIRM_MS).toISOString();
}

/** The seven reasons, in the form's order (spec 2.8). */
export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "scam", label: "Scam or fraud" },
  { value: "prohibited", label: "Prohibited item" },
  { value: "misleading", label: "Misleading listing" },
  { value: "offensive", label: "Offensive content" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
];

/** A posted reason, when it's one of the seven. */
export function parseReason(raw: string): ReportReason | null {
  return REPORT_REASONS.find((reason) => reason.value === raw)?.value ?? null;
}

/** A reason in words. */
export function reasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((item) => item.value === reason)?.label ?? reason;
}
