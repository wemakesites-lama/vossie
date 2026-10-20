import { cacheTag, revalidateTag, updateTag } from "next/cache";

// The data layer's cache tags (selling spec 2.1, plan decision 6). The cached readers in index.ts call the tag
// functions inside "use cache"; Server Actions call the "changed" functions after a write, so the next request, and
// every prerendered page that read the data, reads the store again.

export const LISTINGS_TAG = "listings";
export const SELLERS_TAG = "sellers";
export const REQUESTS_TAG = "requests";

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

/**
 * The same, from a Route Handler, where updateTag throws (stage K spec decision 4): `{ expire: 0 }` means the next
 * request never gets the stale catalog, as updateTag's would (Next 16.4's revalidateTag docs).
 */
export function sellersChangedNow(): void {
  revalidateTag(SELLERS_TAG, { expire: 0 });
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

/** The same as hubChanged(), from a Route Handler, where updateTag throws (see sellersChangedNow). */
export function hubChangedNow(): void {
  revalidateTag(HUB_TAG, { expire: 0 });
}

/** After a pickup point changes. Server Actions only. */
export function pickupPointsChanged(): void {
  updateTag(PICKUP_POINTS_TAG);
}

/** For a cached function that returns requests (community actions plan decision 1). Offer counts are in them too. */
export function tagRequests(): void {
  cacheTag(REQUESTS_TAG);
}

/** After a request, or its offers, change. Server Actions only. */
export function requestsChanged(): void {
  updateTag(REQUESTS_TAG);
}

/** The same as requestsChanged(), from a Route Handler, where updateTag throws (see sellersChangedNow). */
export function requestsChangedNow(): void {
  revalidateTag(REQUESTS_TAG, { expire: 0 });
}
