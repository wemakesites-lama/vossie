import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCollections, getListedHubPostIds, getListedRequestIds, getListingIds, getSellerSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/sitemap";
import { sastToday } from "@/lib/time";

/**
 * Every public page worth crawling today (info and system spec 2.8; stage L spec decision 19): the static pages,
 * collections, open shops and listings, then the requests open today and the Hub's tips and events from today on.
 * Closed requests and past events keep their pages; they just aren't offered to crawlers. "Today" is a request-time
 * read, so the sitemap is generated per fetch; its two dated readers are cached per day, the rest as before.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const today = sastToday();
  const [listingIds, sellerSlugs, collections, requestIds, hubPostIds] = await Promise.all([
    getListingIds(),
    getSellerSlugs(),
    getCollections(),
    getListedRequestIds({ today }),
    getListedHubPostIds({ today }),
  ]);
  return sitemapEntries(siteUrl(), {
    listingIds,
    sellerSlugs,
    collectionSlugs: collections.map((collection) => collection.slug),
    requestIds,
    hubPostIds,
  });
}
