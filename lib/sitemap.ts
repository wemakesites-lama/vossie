import type { MetadataRoute } from "next";

/**
 * The pages with no id in their address (info and system spec 2.8), in the order they appear. Saved, sign-in, the
 * account pages and the selling pages are left out on purpose: they belong to one person or one device. So are
 * Privacy, Terms and Seller guidelines: they are drafts marked `noindex` until Eduvos signs them off (plan amendment 1),
 * and a sitemap shouldn't ask search engines to index them. Add them here when the `noindex` comes off.
 */
export const STATIC_PATHS = ["/", "/browse", "/looking-for", "/hub", "/how-it-works", "/safety", "/trust"] as const;

type SitemapSources = {
  listingIds: readonly string[];
  sellerSlugs: readonly string[];
  collectionSlugs: readonly string[];
  /** The Looking For requests (community spec 3). Optional, so the sitemap works without them. */
  requestIds?: readonly string[];
  /** The Hub's posts (community spec 3). Optional, so the sitemap works without them. */
  hubPostIds?: readonly string[];
};

/**
 * The sitemap's entries: the static pages, then every collection, seller and listing, then (when given) requests and
 * Hub posts. `base` is the site's origin (`siteUrl()`). There is no `lastModified`: it would need the clock while
 * prerendering, and crawlers cope without it (plan decision 10).
 */
export function sitemapEntries(base: string, sources: SitemapSources): MetadataRoute.Sitemap {
  const paths = [
    ...STATIC_PATHS,
    ...sources.collectionSlugs.map((slug) => `/collections/${slug}`),
    ...sources.sellerSlugs.map((slug) => `/sellers/${slug}`),
    ...sources.listingIds.map((id) => `/listings/${id}`),
    ...(sources.requestIds ?? []).map((id) => `/looking-for/${id}`),
    ...(sources.hubPostIds ?? []).map((id) => `/hub/${id}`),
  ];
  return paths.map((path) => ({ url: new URL(path, base).href }));
}
