import type { MetadataRoute } from "next";
import { getCollections, getHubPostIds, getListingIds, getRequestIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/sitemap";

/**
 * Every public page (info and system spec 2.8), requests and Hub posts included (community spec 3). A cached route
 * handler: the data functions are cached too.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listingIds, sellerSlugs, collections, requestIds, hubPostIds] = await Promise.all([
    getListingIds(),
    getSellerSlugs(),
    getCollections(),
    getRequestIds(),
    getHubPostIds(),
  ]);
  return sitemapEntries(siteUrl(), {
    listingIds,
    sellerSlugs,
    collectionSlugs: collections.map((collection) => collection.slug),
    requestIds,
    hubPostIds,
  });
}
