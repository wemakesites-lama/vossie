import type { FormError } from "@/lib/auth/messages";
import type { ReportTarget } from "@/lib/types";
import type { MessageTarget } from "./paths";
import { REPORT_REASONS, REPORTS_PER_DAY } from "./rules";

// Messaging's error words (spec 3.1 and 3.4; plan decision 26 for the ones the spec doesn't give), each linked to its
// field, in the shape D's ErrorSummary and errorFor take.

// Field ids end with the item they belong to (plan amendment 5). Next keeps the last pages hidden in the DOM, and two
// composers or two threads can be there at once: a <label for> or an error summary's "#field" link goes to the *first*
// element with that id, which may be on the hidden page. The ids of a field's hint and error ("-hint", "-error") are
// made from its id, so they follow.

/** The composer's fields' ids, for the listing or the shop the message goes to: "composer-message-l-001". */
export function composerFields(target: MessageTarget): { body: string; swapOffer: string } {
  const item = target.kind === "listing" ? target.listingId : target.sellerSlug;
  return { body: `composer-message-${item}`, swapOffer: `composer-swap-${item}` };
}

/** The thread's reply field's id, for its conversation: "thread-reply-conv-s1". */
export function replyFields(conversationId: string): { body: string } {
  return { body: `thread-reply-${conversationId}` };
}

/**
 * One reason's radio button's id, for the thing reported: "report-reason-listing-l-001-scam". The kind goes first, so a
 * shop whose slug happens to be a listing's id still gets ids of its own.
 */
export function reportReasonId(target: ReportTarget, reason: string): string {
  return `report-reason-${target.kind}-${target.id}-${reason}`;
}

/**
 * The report form's fields' ids, for the thing reported. A missing reason links to the first radio button, so the
 * reason's id is that button's; the detail's is "report-detail-seller-tech-corner".
 */
export function reportFields(target: ReportTarget): { reason: string; detail: string } {
  return {
    reason: reportReasonId(target, REPORT_REASONS[0].value),
    detail: `report-detail-${target.kind}-${target.id}`,
  };
}

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
