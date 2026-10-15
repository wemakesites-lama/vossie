// What a page says after a staff action, or after a student's RSVP or slot request (staff tools spec 4: "Status changes
// after a post show a status message at the top of the page"; plan decisions 22 and 23). D's form state holds a code,
// never words, so a stale or made-up code shows nothing. The words are samples for Lama to change.

/** What a seller's own pause does (selling amendment 10; staff tools plan amendment 30). The confirm pages say it too. */
export const SELLER_PAUSE_LINE =
  "Paused. Its listings are off every list and it takes no new messages. Its pages stay up, marked paused.";

/** What a Hub pause does (decisions log row 74; amendment 30). The confirm pages say it too. */
export const HUB_PAUSE_LINE = "Paused by the Hub. Its pages are down for buyers and it can't send messages.";

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["approved", "Approved. The shop is live, and its owner has been told."],
  ["declined", "Declined. The seller has been told why, and can send it again."],
  ["verified", "Verified. The tick shows on the shop and its listings."],
  ["unverified", "Verified is off. The tick has gone from the shop and its listings."],
  // Staff only ever make a Hub pause.
  ["paused", HUB_PAUSE_LINE],
  ["resumed", "Resumed. The shop and its listings are back, and its owner has been told."],
  // Resuming a Hub pause that took over the seller's own pause gives the seller's pause back (amendment 29).
  [
    "resumed-seller-pause",
    "The Hub's pause is lifted, and the seller's own pause is back: its listings stay off every list and it takes " +
      "no new messages. Its pages are up again, marked paused.",
  ],
  ["mentor-assigned", "Mentor saved."],
  ["mentor-removed", "The shop has no mentor now."],
  ["dismissed", "Dismissed. The reporter has been told."],
  ["hidden", "Hidden. Its seller and everyone who reported it have been told."],
  ["listing-shown", "Shown again. Its seller has been told."],
  ["report-paused", "Paused. The seller and everyone who reported it have been told."],
  ["pinned", "Pinned. They take one of the four places that day."],
  ["unpinned", "Pin removed."],
  ["point-added", "Pickup point added."],
  ["point-renamed", "Pickup point renamed."],
  ["point-retired", "Retired. Listings that use it keep it, marked no longer used."],
  ["point-restored", "It's in use again."],
  ["post-published", "Published. It's on the Hub's feed."],
  ["post-draft", "Saved as a draft. Only Hub staff can see it."],
  ["booking-accepted", "Accepted. The student has been told."],
  ["booking-declined", "Declined. The student has been told."],
  // A request for office hours whose day is over has no Accept or Decline (amendment 23).
  ["booking-passed", "Those office hours have passed, so the request can't be answered."],
  ["note-added", "Note saved."],
  ["check-in-added", "Check-in saved."],
  ["note-deleted", "Note deleted."],
  ["check-in-deleted", "Check-in deleted."],
  ["nothing", "Nothing changed. It was already done."],
  // The target has gone or changed its link since the page was drawn (amendment 29).
  ["changed", "That has changed; open it again."],
  // A student's own, on a Hub post and its slot request page (plan decision 13).
  ["rsvp", "You're going. See you there."],
  ["rsvp-cancelled", "Your RSVP is cancelled."],
  ["event-full", "Sorry, this event is full."],
  ["slot-requested", "Request sent. A mentor will answer in your notifications."],
]);

export function staffNoticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}
