import type { FormError } from "@/lib/auth/messages";
import { REPORTS_PER_DAY } from "./rules";

// Messaging's error words (spec 3.1 and 3.4; plan decision 26 for the ones the spec doesn't give), each linked to its
// field, in the shape D's ErrorSummary and errorFor take.

/** The composer's fields' ids. */
export const COMPOSER_FIELDS = { body: "composer-body", swapOffer: "composer-swap" } as const;
/** The thread's reply field's id. */
export const REPLY_FIELDS = { body: "thread-reply" } as const;
/** The report form's fields' ids. The reason links to the first radio button. */
export const REPORT_FIELDS = { reason: "report-reason-scam", detail: "report-detail" } as const;

// A Map, so a stray code such as "toString" finds nothing. "report-rate" belongs to no field.
const MESSAGES: ReadonlyMap<string, { message: string; field: string }> = new Map([
  ["message-missing", { message: "Write a message first.", field: "body" }],
  ["message-length", { message: "Keep it under 1,000 characters.", field: "body" }],
  ["swap-length", { message: "Keep your swap offer under 200 characters.", field: "swapOffer" }],
  ["reason-missing", { message: "Choose a reason.", field: "reason" }],
  ["detail-length", { message: "Keep it under 500 characters.", field: "detail" }],
  [
    "report-rate",
    { message: `You've sent ${REPORTS_PER_DAY} reports in the last 24 hours. Try again later.`, field: "none" },
  ],
]);

/** The words for a form's error codes, in order, each linked to its field's id when the form has that field. */
export function messagingErrors(codes: readonly string[], fieldIds: Readonly<Record<string, string>>): FormError[] {
  return codes.flatMap((code) => {
    const known = MESSAGES.get(code);
    if (!known) return [];
    return [{ message: known.message, fieldId: Object.hasOwn(fieldIds, known.field) ? fieldIds[known.field] : null }];
  });
}
