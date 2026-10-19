import type { RequestState } from "@/lib/types";
import { OPEN_REQUESTS_MAX } from "./rules";

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

/** What an offer thread is about, in the inbox (plan decision 8). */
export function offerAbout(role: "buyer" | "seller", requestTitle: string): string {
  return role === "buyer" ? `Your request: ${requestTitle}` : `Request: ${requestTitle}`;
}

const STATES: Readonly<Record<RequestState, string>> = { open: "Open", closed: "Closed", hidden: "Hidden by the Hub" };

export function requestStateLabel(state: RequestState): string {
  return STATES[state];
}
