import { cacheTag, updateTag } from "next/cache";

// The data layer's cache tags (selling spec 2.1, plan decision 6). The cached readers in index.ts call the tag
// functions inside "use cache"; Server Actions call the "changed" functions after a write, so the next request, and
// every prerendered page that read the data, reads the store again.

export const LISTINGS_TAG = "listings";
export const SELLERS_TAG = "sellers";

/** For a cached function that returns listings: a shop's status and badge change its listings too. */
export function tagListings(): void {
  cacheTag(LISTINGS_TAG, SELLERS_TAG);
}

/** For a cached function that returns only sellers. */
export function tagSellers(): void {
  cacheTag(SELLERS_TAG);
}

/** After a listing changes. Server Actions only. */
export function listingsChanged(): void {
  updateTag(LISTINGS_TAG);
}

/** After a shop changes: its seller and, through their second tag, its listings. Server Actions only. */
export function sellersChanged(): void {
  updateTag(SELLERS_TAG);
}

// The staff tools' tags (staff tools plan decisions 10 and 11): the Hub's posts, which staff write and RSVPs count, and
// the pickup points, which staff add, rename and retire.

export const HUB_TAG = "hub";
export const PICKUP_POINTS_TAG = "pickup-points";

/** For a cached function that returns Hub posts or events. */
export function tagHub(): void {
  cacheTag(HUB_TAG);
}

/** For a cached function that returns pickup points, or a listing with its pickup point. */
export function tagPickupPoints(): void {
  cacheTag(PICKUP_POINTS_TAG);
}

/** After a Hub post, an RSVP or a slot request changes. Server Actions only. */
export function hubChanged(): void {
  updateTag(HUB_TAG);
}

/** After a pickup point changes. Server Actions only. */
export function pickupPointsChanged(): void {
  updateTag(PICKUP_POINTS_TAG);
}
