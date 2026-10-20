// Following shops (community actions spec 2.15 to 2.19; plan decisions 7, 15 to 17 and 26): the cap, Saved's tabs,
// the status lines' keys and words, the new-listing notification's sentences and the dashboard's line. Plain values
// and functions. The words are samples for Lama to change.

export const FOLLOW_LIMIT = 200;

/** Saved's tabs (community actions spec 2.17; search alerts spec 2.7). */
export type SavedTab = "listings" | "shops" | "searches";

/**
 * "?tab=shops" opens Shops and "?tab=searches" Searches; anything else is Listings (community actions plan decision
 * 17, search alerts plan decision 10).
 */
export function parseSavedTab(raw: string | string[] | undefined): SavedTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "shops" || value === "searches" ? value : "listings";
}

export function savedTabPath(tab: SavedTab): string {
  return tab === "listings" ? "/saved" : `/saved?tab=${tab}`;
}

/** The storefront's status line after Follow or Unfollow, and Saved's after Unfollow (plan decision 7). */
export const followNoteKey = (slug: string) => `follow:${slug}`;
export const SAVED_SHOPS_FORM = "saved-shops";

/** Beside Follow on the band, after an unfollow: short, so it fits the row (plan decision 16). */
export const UNFOLLOWED_SHORT = "Unfollowed.";

export function followNoticeText(code: string | null | undefined, shop: string): string | null {
  switch (code) {
    case "followed":
      return `You follow ${shop}.`;
    case "unfollowed":
      return `You've unfollowed ${shop}.`;
    case "follow-limit":
      return `You follow ${FOLLOW_LIMIT} shops. Unfollow one first.`;
    default:
      return null;
  }
}

/** A followed shop's first new listing of the day (spec 2.19), linking to the listing. */
export function newListingText(shop: string, title: string): string {
  return `${shop} listed ${title}`;
}

/** The same notification once the shop lists more that day, linking to the shop. */
export function newListingsText(shop: string, count: number): string {
  return `${shop} listed ${count} new things`;
}

/** The dashboard's line (spec 2.18): how many follow, never who. */
export function followersLine(count: number): string {
  if (count === 0) return "No one follows your shop yet";
  return count === 1 ? "1 person follows your shop" : `${count} people follow your shop`;
}
