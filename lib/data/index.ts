import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { collections } from "@/data/fixtures/collections";
import { heroSlides } from "@/data/fixtures/hero";
import { hubBanner, hubPosts } from "@/data/fixtures/hub";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { requests } from "@/data/fixtures/requests";
import { trendingSearches } from "@/data/fixtures/trending";
import { findListings } from "@/lib/browse/results";
import { ALL_CAMPUSES } from "@/lib/campus";
import { matchesRule } from "@/lib/collections";
import { drawFeatured } from "@/lib/featured";
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
  shopStatus,
  storefrontRow,
  toSeller,
} from "./catalog";
import { tagListings, tagSellers } from "./tags";

// The data layer (spec section 13). Listings and sellers come from the sample store, through lib/data/catalog.ts,
// tagged so a write shows on the next request (selling spec 2.1); the rest is still read from the fixtures. Switching
// to Supabase changes only this file and the catalog: keep the signatures, query the tables, keep the tags.

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

/** Today's featured sellers (spec 7.10). `day` is the SAST date, so the draw changes at midnight in South Africa. */
export async function getFeatured({ campus, day }: { campus: CampusChoice; day: string }): Promise<readonly Seller[]> {
  "use cache";
  tagSellers();
  // Only open shops take part (plan decision 2). Stage G adds pins, the week's break and "something listed".
  return drawFeatured(liveSellerRows().map(toSeller), campus, day);
}

/** Open requests only: closed ones never appear in lists (community spec 4.3). */
function openRequests(items: readonly LookingForRequest[]): LookingForRequest[] {
  return items.filter((request) => request.status === "open");
}

/** The homepage's open requests (spec 7.11): newest first, the visitor's campus first (community spec 4.3). */
export async function getRequests({ campus, limit }: CampusQuery): Promise<readonly LookingForRequest[]> {
  "use cache";
  return campusFirst(openRequests(requests).sort(newestFirst), campus, limit);
}

/** The Looking For board (community spec 4.1): open requests, newest first, in one category or in all of them. */
export async function getOpenRequests({ category }: { category: string | null }): Promise<readonly LookingForRequest[]> {
  "use cache";
  return openRequests(requests)
    .filter((request) => category === null || request.categorySlug === category)
    .sort(newestFirst);
}

/** A request's page (community spec 4.2), open or closed. */
export async function getRequest(id: string): Promise<LookingForRequest | null> {
  "use cache";
  return requests.find((request) => request.id === id) ?? null;
}

/** Every request's id, so each request page is prerendered (community spec 3). */
export async function getRequestIds(): Promise<readonly string[]> {
  "use cache";
  return requests.map((request) => request.id);
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
  // `from` is today's SAST date (YYYY-MM-DD). It keeps past events out, and the cache keys on it, so it turns over each day.
  return orderHubPosts(
    hubPosts.filter((post) => post.kind !== "tip"),
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
  return orderHubPosts(
    hubPosts.filter((post) => kinds.includes(post.kind)),
    from,
  );
}

/** A post's page (community spec 5.2), past events and office hours included. */
export async function getHubPost(id: string): Promise<HubPost | null> {
  "use cache";
  return hubPosts.find((post) => post.id === id) ?? null;
}

/** Every post's id, so each post page is prerendered (community spec 3). */
export async function getHubPostIds(): Promise<readonly string[]> {
  "use cache";
  return hubPosts.map((post) => post.id);
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

/**
 * Everything a listing page needs (browse and listing spec 6.3), paused and sold ones included; null for a draft or
 * a listing whose shop is waiting for approval (selling plan decision 2).
 */
export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  "use cache";
  tagListings();
  const listing = publicListing(id);
  if (!listing) return null;
  const seller = sellerFor(listing.sellerSlug);
  const category = categories.find((item) => item.slug === listing.categorySlug);
  const campus = campuses.find((item) => item.slug === listing.campusSlug);
  if (!seller || !category || !campus) return null;
  const pickupPoint = pickupPoints.find((point) => point.id === listing.pickupPointId) ?? null;
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

export async function getPickupPoints(): Promise<readonly PickupPoint[]> {
  "use cache";
  return pickupPoints;
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

/**
 * Whether a storefront's shop is paused (selling plan decision 2, amendment 10): its storefront stays up but takes no
 * new messages. False for an open shop and for a slug with no storefront.
 */
export async function isShopPaused(slug: string): Promise<boolean> {
  "use cache";
  tagSellers();
  const row = storefrontRow(slug);
  return row !== null && shopStatus(row) === "paused";
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
