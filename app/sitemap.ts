import type { MetadataRoute } from "next";
import { getCollections, getListingIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/sitemap";

/**
 * Every public page (info and system spec 2.8). A cached route handler: the data functions are cached too.
 *
 * Part B must add its ids when its data functions land: import `getHubPostIds` and `getRequestIds` from `@/lib/data`,
 * add `getRequestIds(), getHubPostIds()` to the `Promise.all` and its destructuring (`requestIds, hubPostIds`), and
 * pass `requestIds, hubPostIds` to `sitemapEntries`, which already handles them. Then add the matching test to
 * `app/sitemap.test.ts` (every request and Hub post is listed).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listingIds, sellerSlugs, collections] = await Promise.all([getListingIds(), getSellerSlugs(), getCollections()]);
  return sitemapEntries(siteUrl(), {
    listingIds,
    sellerSlugs,
    collectionSlugs: collections.map((collection) => collection.slug),
  });
}
