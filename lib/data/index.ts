import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { collections } from "@/data/fixtures/collections";
import { heroSlides } from "@/data/fixtures/hero";
import { hubBanner } from "@/data/fixtures/hub";
import { trendingSearches } from "@/data/fixtures/trending";
import { findListings } from "@/lib/browse/results";
import { ALL_CAMPUSES } from "@/lib/campus";
import { matchesRule } from "@/lib/collections";
import { orderHubPosts, toHubEvent } from "@/lib/hub";
import type {
  Announcement,
  Campus,
  CampusChoice,
  Category,
  Collection,
  FreeSwapItem,
  HeroSlide,
  HubBanner,
  HubEvent,
  HubPost,
  HubPostKind,
  Listing,
  ListingDetail,
  LookingForRequest,
  MoreFrom,
  PickupPoint,
  SearchQuery,
  SearchResult,
  Seller,
  TrendingSearches,
} from "@/lib/types";
import {
  listedListings,
  liveSellerRows,
  publicListing,
  publicListingIds,
  sellerFor,
  storefrontRow,
  toSeller,
} from "./catalog";
import { featuredFor } from "./featured";
import { publishedPost, publishedPosts } from "./hub-posts";
import { pickupPointById, pointsInUse } from "./pickup-points";
import { listedRequests, publicRequest, publicRequestIds } from "./requests";
import { tagHub, tagListings, tagPickupPoints, tagRequests, tagSellers } from "./tags";

// The data layer (spec section 13). Listings and sellers come from the sample store, through lib/data/catalog.ts,
// tagged so a write shows on the next request (selling spec 2.1). Requests come from it too, through
// lib/data/requests.ts, tagged `requests` (community actions plan decision 1); the rest is still read from the
// fixtures. Switching to Supabase changes only this file and the catalog: keep the signatures, query the tables, keep
// the tags.

export async function getCampuses(): Promise<readonly Campus[]> {
  "use cache";
  return campuses;
}

export async function getCategories(): Promise<readonly Category[]> {
  "use cache";
  return categories;
}

export async function getAnnouncements(): Promise<readonly Announcement[]> {
  "use cache";
  return announcements;
}

export async function getTrendingSearches(): Promise<TrendingSearches> {
  "use cache";
  return trendingSearches;
}

type CampusQuery = { campus: CampusChoice; limit: number };

/** Up to `limit` items, the campus's own first, topped up from every other campus. */
function campusFirst<T extends { campusSlug: string }>(items: readonly T[], campus: CampusChoice, limit: number): T[] {
  if (campus === ALL_CAMPUSES) return items.slice(0, limit);
  const own = items.filter((item) => item.campusSlug === campus);
  const others = items.filter((item) => item.campusSlug !== campus);
  return [...own, ...others].slice(0, limit);
}

/** Newest first: ISO times in UTC sort as text. */
function newestFirst(a: Pick<Listing, "createdAt">, b: Pick<Listing, "createdAt">): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export async function getHeroSlides(): Promise<readonly HeroSlide[]> {
  "use cache";
  return heroSlides;
}

export async function getCollections(): Promise<readonly Collection[]> {
  "use cache";
  return collections;
}

export async function getCollection(slug: string): Promise<Collection | null> {
  "use cache";
  return collections.find((collection) => collection.slug === slug) ?? null;
}

/** The most a collection page shows (shopping spec 6.2). */
const COLLECTION_LIMIT = 48;

/**
 * A collection's listings (shopping spec 6.2): the available listings its rule matches, at every campus, newest first,
 * at most 48. An unknown collection has none.
 */
export async function getCollectionListings(slug: string): Promise<readonly Listing[]> {
  "use cache";
  tagListings();
  const collection = collections.find((item) => item.slug === slug);
  if (!collection) return [];
  return listedListings()
    .filter((listing) => matchesRule(listing, collection.rule))
    .sort(newestFirst)
    .slice(0, COLLECTION_LIMIT);
}

/** The newest listings at one campus, or at every campus for "all" (spec 7.8). */
export async function getJustListed({ campus, limit }: CampusQuery): Promise<readonly Listing[]> {
  "use cache";
  tagListings();
  return listedListings()
    .filter((listing) => campus === ALL_CAMPUSES || listing.campusSlug === campus)
    .sort(newestFirst)
    .slice(0, limit);
}

/**
 * Today's featured sellers (spec 7.10; staff tools spec 2.8). `day` is the SAST date, so the row changes at midnight in
 * South Africa. Not cached: it reads and records the day's row in the store (staff tools plan decision 9), and the
 * homepage's section renders per request already, after connection().
 */
export async function getFeatured({ campus, day }: { campus: CampusChoice; day: string }): Promise<readonly Seller[]> {
  return featuredFor(campus, day);
}

/**
 * The homepage's open requests (spec 7.11): newest first, the visitor's campus first (community spec 4.3). `today` is
 * the SAST date: a request leaves on its closing day, settled or not (stage L spec decision 10). The cache keys on
 * it, so the entry turns over at SAST midnight.
 */
export async function getRequests({
  campus,
  limit,
  today,
}: CampusQuery & { today: string }): Promise<readonly LookingForRequest[]> {
  "use cache";
  tagRequests();
  return campusFirst(listedRequests(today).sort(newestFirst), campus, limit);
}

/**
 * The Looking For board (community spec 4.1): requests open on `today`, newest first, in one category or in all of
 * them (stage L spec decision 10).
 */
export async function getOpenRequests({
  category,
  today,
}: {
  category: string | null;
  today: string;
}): Promise<readonly LookingForRequest[]> {
  "use cache";
  tagRequests();
  return listedRequests(today)
    .filter((request) => category === null || request.categorySlug === category)
    .sort(newestFirst);
}

/** A request's page (community spec 4.2), open or closed; a hidden one has none (community actions spec 2.14). */
export async function getRequest(id: string): Promise<LookingForRequest | null> {
  "use cache";
  tagRequests();
  return publicRequest(id);
}

/** Every request with a page, so each is prerendered (community spec 3); a new one renders on its first request. */
export async function getRequestIds(): Promise<readonly string[]> {
  "use cache";
  tagRequests();
  return publicRequestIds();
}

/**
 * The requests the sitemap offers crawlers: open on `today` (stage L spec decision 19). Their pages stay up and
 * prerendered either way (getRequestIds).
 */
export async function getListedRequestIds({ today }: { today: string }): Promise<readonly string[]> {
  "use cache";
  tagRequests();
  return listedRequests(today).map((request) => request.id);
}

/**
 * "Already on Vossie" (community spec 4.2, decision 4): up to `limit` available listings in a request's category,
 * those at its campus first, then the rest, each part newest first.
 */
export async function getRelatedListings({
  categorySlug,
  campusSlug,
  limit,
}: {
  categorySlug: string;
  campusSlug: string;
  limit: number;
}): Promise<readonly Listing[]> {
  "use cache";
  tagListings();
  const sameCategory = listedListings()
    .filter((listing) => listing.categorySlug === categorySlug)
    .sort(newestFirst);
  return campusFirst(sameCategory, campusSlug, limit);
}

/** Free & swaps (spec 7.12): the free and swap-only listings, the visitor's campus first. */
export async function getFreeAndSwaps({ campus, limit }: CampusQuery): Promise<readonly FreeSwapItem[]> {
  "use cache";
  tagListings();
  const items = listedListings()
    .filter((listing) => listing.priceZar === 0 || listing.payMode === "swap")
    .sort(newestFirst)
    .map(
      (listing): FreeSwapItem => ({
        id: listing.id,
        kind: listing.priceZar === 0 ? "free" : "swap",
        title: listing.title,
        campusSlug: listing.campusSlug,
        image: listing.image,
      }),
    );
  return campusFirst(items, campus, limit);
}

/**
 * The next Hub events for a campus: its own and the every-campus ones, soonest first (spec 7.13). They're derived from
 * the Hub's posts (community spec 5.3): events become RSVP rows, office hours Book rows.
 */
export async function getHubEvents({ campus, limit, from }: CampusQuery & { from: string }): Promise<readonly HubEvent[]> {
  "use cache";
  tagHub();
  // `from` is today's SAST date (YYYY-MM-DD). It keeps past events out, and the cache keys on it, so it turns over each day.
  return orderHubPosts(
    publishedPosts().filter((post) => post.kind !== "tip"),
    from,
  )
    .filter((post) => campus === ALL_CAMPUSES || post.campusSlug === ALL_CAMPUSES || post.campusSlug === campus)
    .flatMap((post) => toHubEvent(post) ?? [])
    .slice(0, limit);
}

/**
 * The Hub's feed (community spec 5.1): posts of the given kinds. Events and office hours on or after `from` (today's
 * SAST date) come first, soonest first; tips follow, newest first. The cache keys on `from`, so it turns over each day.
 */
export async function getHubPosts({
  kinds,
  from,
}: {
  kinds: readonly HubPostKind[];
  from: string;
}): Promise<readonly HubPost[]> {
  "use cache";
  tagHub();
  return orderHubPosts(
    publishedPosts().filter((post) => kinds.includes(post.kind)),
    from,
  );
}

/** A post's page (community spec 5.2), past events and office hours included. */
export async function getHubPost(id: string): Promise<HubPost | null> {
  "use cache";
  tagHub();
  // A draft or an unknown id has no page (staff tools plan decision 11).
  return publishedPost(id);
}

/** Every published post's id, so each post page is prerendered (community spec 3). A new post's page renders on its first request (staff tools plan decision 11). */
export async function getHubPostIds(): Promise<readonly string[]> {
  "use cache";
  tagHub();
  return publishedPosts().map((post) => post.id);
}

/** The Hub's Verified sellers (community spec 5.1), A to Z by name so no one is favoured (plan decision 11). */
export async function getVerifiedSellers(): Promise<readonly Seller[]> {
  "use cache";
  tagSellers();
  return liveSellerRows()
    .filter((row) => row.verified)
    .map(toSeller)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getHubBanner(): Promise<HubBanner> {
  "use cache";
  return hubBanner;
}

/** Everything a listing page needs (browse and listing spec 6.3), for any listing, paused and sold ones included. */
export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  "use cache";
  tagListings();
  tagPickupPoints();
  const listing = publicListing(id);
  if (!listing) return null;
  const seller = sellerFor(listing.sellerSlug);
  const category = categories.find((item) => item.slug === listing.categorySlug);
  const campus = campuses.find((item) => item.slug === listing.campusSlug);
  if (!seller || !category || !campus) return null;
  // Retired or not: a listing keeps its point, marked "no longer used" (staff tools plan decision 10).
  const pickupPoint = pickupPointById(listing.pickupPointId);
  return { listing, seller, category, campus, pickupPoint };
}

/**
 * A listing page's "More from" row (browse and listing spec 5.7): up to `limit` of the seller's other available
 * listings, newest first.
 * When the seller has none, the same category's: those at the listing's campus first, then the rest.
 */
export async function getMoreFrom(
  listing: Pick<Listing, "id" | "sellerSlug" | "categorySlug" | "campusSlug">,
  limit: number,
): Promise<MoreFrom> {
  "use cache";
  tagListings();
  const others = listedListings()
    .filter((item) => item.id !== listing.id)
    .sort(newestFirst);
  const fromSeller = others.filter((item) => item.sellerSlug === listing.sellerSlug);
  if (fromSeller.length > 0) return { from: "seller", items: fromSeller.slice(0, limit) };
  const sameCategory = others.filter((item) => item.categorySlug === listing.categorySlug);
  const ownCampus = sameCategory.filter((item) => item.campusSlug === listing.campusSlug);
  const elsewhere = sameCategory.filter((item) => item.campusSlug !== listing.campusSlug);
  return { from: "category", items: [...ownCampus, ...elsewhere].slice(0, limit) };
}

/** The pickup points in use (staff tools plan decision 10): what onboarding, Edit shop and the listing form offer. */
export async function getPickupPoints(): Promise<readonly PickupPoint[]> {
  "use cache";
  tagPickupPoints();
  return pointsInUse();
}

/**
 * Browse results (browse and listing spec 6.3): every available listing that matches, filtered and sorted, and how
 * many match at other campuses. The caller shows the first `shown`, so Show more reuses this cached result.
 */
export async function searchListings(query: SearchQuery): Promise<SearchResult> {
  "use cache";
  tagListings();
  return findListings(listedListings(), query, {
    sellers: new Map(liveSellerRows().map((row) => [row.slug, row.name])),
    categories: new Map(categories.map((category) => [category.slug, category.name])),
  });
}

/**
 * Every listing with a page (plan decision 2): drafts and waiting shops' listings have none. For prerendering and the
 * sitemap.
 */
export async function getListingIds(): Promise<readonly string[]> {
  "use cache";
  tagListings();
  return publicListingIds();
}

/** A storefront's seller: an approved or paused shop (plan decision 2). */
export async function getSeller(slug: string): Promise<Seller | null> {
  "use cache";
  tagSellers();
  const row = storefrontRow(slug);
  return row ? toSeller(row) : null;
}

/** Open shops' slugs, for prerendering and the sitemap. A paused shop's storefront renders on its first request. */
export async function getSellerSlugs(): Promise<readonly string[]> {
  "use cache";
  tagSellers();
  return liveSellerRows().map((row) => row.slug);
}

/** A storefront's listings (shopping spec 4.1): the seller's available listings, newest first. */
export async function getSellerListings(slug: string): Promise<readonly Listing[]> {
  "use cache";
  tagListings();
  return listedListings()
    .filter((listing) => listing.sellerSlug === slug)
    .sort(newestFirst);
}

/**
 * The Saved page's listings (shopping spec 5.2): one per id, in the order given, paused and sold ones included. Ids
 * that don't exist any more are dropped. The cache keys on the whole list of ids, which is fine for sample data;
 * revisit it with Supabase (plan decision 13).
 */
export async function getListingsByIds(ids: readonly string[]): Promise<readonly Listing[]> {
  "use cache";
  tagListings();
  return ids.flatMap((id) => publicListing(id) ?? []);
}
