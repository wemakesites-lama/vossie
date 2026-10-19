// What a page says after a staff action, or after a student's RSVP or slot request (staff tools spec 4: "Status changes
// after a post show a status message at the top of the page"; plan decisions 22 and 23). D's form state holds a code,
// never words, so a stale or made-up code shows nothing. The words are samples for Lama to change.

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["approved", "Approved. The shop is live, and its owner has been told."],
  ["declined", "Declined. The seller has been told why, and can send it again."],
  ["verified", "Verified. The tick shows on the shop and its listings."],
  ["unverified", "Verified is off. The tick has gone from the shop and its listings."],
  ["paused", "Paused. The shop and its listings are hidden from buyers, and its owner has been told why."],
  ["resumed", "Resumed. The shop and its listings are back, and its owner has been told."],
  ["mentor-assigned", "Mentor saved."],
  ["mentor-removed", "The shop has no mentor now."],
  ["dismissed", "Dismissed. The reporter has been told."],
  ["hidden", "Hidden. Its seller and everyone who reported it have been told."],
  ["request-hidden", "Hidden. The asker and everyone who reported it have been told."],
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
  ["note-added", "Note saved."],
  ["check-in-added", "Check-in saved."],
  ["nothing", "Nothing changed. It was already done."],
  // A student's own, on a Hub post and its slot request page (plan decision 13).
  ["rsvp", "You're going. See you there."],
  ["rsvp-cancelled", "Your RSVP is cancelled."],
  ["event-full", "Sorry, this event is full."],
  ["slot-requested", "Request sent. A mentor will answer in your notifications."],
]);

export function staffNoticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}
