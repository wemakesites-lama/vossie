import { dayMonth } from "@/lib/format";
import type { RequestState } from "@/lib/types";
import { type CloseReason, IDLE_CLOSE_DAYS, NEEDED_BY_GRACE_DAYS, OPEN_REQUESTS_MAX } from "./rules";

// Looking For's words (community actions spec 2.10, 2.13, 2.14 and section 4; plan decisions 7 to 9, 14 and 26). The
// status lines are kept as codes in form state, never words, so a stale or made-up code shows nothing. The words are
// samples for Lama to change.

/** What the shop calls the asker until the asker writes (spec 2.10). */
export const UNNAMED_ASKER = "The student who asked";

/** The thread's note after Send offer (plan decision 8). */
export const OFFER_SENT_NOTE = "Sent. The student who asked gets a notification.";
/** In place of the shop's reply form until the asker replies (spec 2.9). */
export const SHOP_WAITS_NOTE = "You can write again when they reply.";
/** An offer thread's card once its request has gone (spec 2.6). */
export const REQUEST_REMOVED_NOTE = "This request was removed.";
/** The asker's offer thread once the Hub has hidden the request (plan amendment 19.4); the shop reads the note above. */
export const REQUEST_HIDDEN_NOTE = "The Hub hid this request.";
/** In place of the asker's reply form once the shop that offered has gone: the asker dealt with a shop (amendment 19.2). */
export const SHOP_CLOSED_NOTE = "This shop has closed, so you can't reply.";

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["posted", "Your request is up."],
  ["saved", "Your changes are saved."],
  ["closed", "Request closed."],
  ["reopened", "Request reopened."],
  ["deleted", "Request deleted."],
  ["reopen-limit", `You have ${OPEN_REQUESTS_MAX} open requests. Close one before you reopen this one.`],
  // Stage L (spec decision 13): reopening took off a needed-by date that had passed, or it would close again at once.
  ["reopened-date-cleared", "Request reopened. Its needed-by date had passed, so it's been removed. Add a new one with Edit."],
]);

export function requestNoticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}

/** The asker's notification for each offer (spec 2.13), with the "offer" kind. */
export function offerNoteText(shop: string, requestTitle: string): string {
  return `${shop} offered to help with ${requestTitle}`;
}

/** The asker's notification when the Hub hides their request (spec 2.14), with the "request-update" kind. */
export function requestHiddenText(title: string): string {
  return `The Hub hid your request ${title}. See why in Your requests.`;
}

/** Why a request closed by itself, as the asker's notification and lines end it (stage L spec section 4, Words). */
export const AUTO_CLOSE_WHY: Readonly<Record<CloseReason, string>> = {
  "needed-by": `${NEEDED_BY_GRACE_DAYS} days after the date you needed it by`,
  idle: `after ${IDLE_CLOSE_DAYS} days with no changes`,
};

/** The asker's notification when their request closes by itself (stage L spec decision 12), "request-update" kind. */
export function requestAutoClosedText(title: string, reason: CloseReason): string {
  return `Your request ${title} closed automatically ${AUTO_CLOSE_WHY[reason]}. Reopen it in Your requests if you still need it.`;
}

/** What keeps the request up, by why it would close (stage M spec section 5, Words). */
const REMINDER_NEXT: Readonly<Record<CloseReason, string>> = {
  "needed-by": "Give it a new date in Your requests.",
  idle: `Edit it in Your requests and it stays up for ${IDLE_CLOSE_DAYS} days more.`,
};

/**
 * The asker's one reminder, 2 days before their request closes itself (stage M spec decisions 13 and 17), with the
 * "request-update" kind. `closesOn` is the closing day, written as Your requests writes it.
 */
export function requestCloseReminderText(title: string, closesOn: string, reason: CloseReason): string {
  return `Your request ${title} closes automatically on ${dayMonth(closesOn)}, ${AUTO_CLOSE_WHY[reason]}. Still need it? ${REMINDER_NEXT[reason]}`;
}

/** Under Reopen when the request's needed-by date has passed (stage L spec decision 13). */
export const REOPEN_CLEARS_DATE_HINT = "Reopening removes the needed-by date, which has passed.";

/** Added to the request form's needed-by hint (stage L spec section 4). */
export const CLOSES_BY_ITSELF_HINT = `Your request closes automatically ${NEEDED_BY_GRACE_DAYS} days after this date. Without one, it closes after ${IDLE_CLOSE_DAYS} days with no changes.`;

/** What an offer thread is about, in the inbox (plan decision 8). */
export function offerAbout(role: "buyer" | "seller", requestTitle: string): string {
  return role === "buyer" ? `Your request: ${requestTitle}` : `Request: ${requestTitle}`;
}

const STATES: Readonly<Record<RequestState, string>> = { open: "Open", closed: "Closed", hidden: "Hidden by the Hub" };

export function requestStateLabel(state: RequestState): string {
  return STATES[state];
}
