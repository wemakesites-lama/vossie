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
