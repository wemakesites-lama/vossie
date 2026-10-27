// What a selling page says after an action (plan decision 27). D's form state holds a code, never words, so a stale
// or made-up code shows nothing.

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["published", "Published. Buyers can find it now."],
  // Publish, Resume or Relist while the shop is paused: buyers see none of its listings yet (amendment 11.6).
  ["saved-shop-paused", "Saved. Your shop is paused, so buyers will see it when you resume your shop."],
  // The same, when the Hub paused the shop: only the Hub resumes it (staff tools plan decision 3).
  ["saved-shop-hub-paused", "Saved. The Hub has paused your shop, so buyers will see it once the Hub resumes it."],
  ["saved", "Your changes are saved."],
  ["drafted", "Saved as a draft. Only you can see it."],
  ["paused", "Paused. Buyers can't see it until you resume it."],
  ["resumed", "It's available again."],
  ["sold", "Marked as sold. Its page stays up and says Sold."],
  ["deleted", "Deleted."],
  ["shop-paused", "Your shop is paused. Buyers can't see your listings until you resume it."],
  ["shop-resumed", "Your shop is live again."],
  ["shop-saved", "Your shop is saved."],
  // Photo-to-listing (photo-to-listing spec 2.3 and 2.4). "suggested" is drawn with its count by the form itself.
  ["suggest-failed", "We couldn't read that photo. Fill it in yourself below, or try a clearer, closer photo of the item."],
  [
    "suggest-person",
    "We don't fill in listings from photos of people. Fill it in yourself below. If a person is in the photo, make sure they're happy to be in it.",
  ],
  ["suggest-no-photo", "Add a photo first. Choose one above, then press Fill in from my photo."],
  ["suggest-limit", "You've used today's photo fills. Fill it in yourself below, or try again tomorrow."],
]);

export function noticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}
