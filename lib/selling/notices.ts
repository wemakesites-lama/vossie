// What a selling page says after an action (plan decision 27). D's form state holds a code, never words, so a stale
// or made-up code shows nothing.

const NOTICES: ReadonlyMap<string, string> = new Map([
  ["published", "Published. Buyers can find it now."],
  ["saved", "Your changes are saved."],
  ["drafted", "Saved as a draft. Only you can see it."],
  ["paused", "Paused. Buyers can't see it until you resume it."],
  ["resumed", "It's available again."],
  ["sold", "Marked as sold. Its page stays up and says Sold."],
  ["deleted", "Deleted."],
  ["shop-paused", "Your shop is paused. Buyers can't see your listings until you resume it."],
  ["shop-resumed", "Your shop is live again."],
  ["shop-saved", "Your shop is saved."],
]);

export function noticeText(code: string | null | undefined): string | null {
  return code ? (NOTICES.get(code) ?? null) : null;
}
