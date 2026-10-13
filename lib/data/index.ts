import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { collections } from "@/data/fixtures/collections";
import { heroSlides } from "@/data/fixtures/hero";
import { hubBanner, hubEvents } from "@/data/fixtures/hub";
import { listings } from "@/data/fixtures/listings";
import { requests } from "@/data/fixtures/requests";
import { sellers } from "@/data/fixtures/sellers";
import { trendingSearches } from "@/data/fixtures/trending";
import { ALL_CAMPUSES } from "@/lib/campus";
import { drawFeatured } from "@/lib/featured";
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
  Listing,
  ListingSummary,
  LookingForRequest,
  Seller,
  TrendingSearches,
} from "@/lib/types";

// Sample data for this stage (spec section 13). Switching to Supabase changes only this file:
// keep the signatures, query the tables, and give each function cacheLife() and cacheTag().

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

/** Listings people can buy or book. Paused and sold listings never appear in lists (spec 5.5). */
function available(items: readonly Listing[]): Listing[] {
  return items.filter((listing) => listing.availability === "available");
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

/** The newest listings at one campus, or at every campus for "all" (spec 7.8). */
export async function getJustListed({ campus, limit }: CampusQuery): Promise<readonly Listing[]> {
  "use cache";
  return available(listings)
    .filter((listing) => campus === ALL_CAMPUSES || listing.campusSlug === campus)
    .sort(newestFirst)
    .slice(0, limit);
}

/** Today's featured sellers (spec 7.10). `day` is the SAST date, so the draw changes at midnight in South Africa. */
export async function getFeatured({ campus, day }: { campus: CampusChoice; day: string }): Promise<readonly Seller[]> {
  "use cache";
  return drawFeatured(sellers, campus, day);
}

export async function getRequests({ campus, limit }: CampusQuery): Promise<readonly LookingForRequest[]> {
  "use cache";
  return campusFirst(requests, campus, limit);
}

/** Free & swaps (spec 7.12): the free and swap-only listings, the visitor's campus first. */
export async function getFreeAndSwaps({ campus, limit }: CampusQuery): Promise<readonly FreeSwapItem[]> {
  "use cache";
  const items = available(listings)
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

/** The next Hub events for a campus: its own and the every-campus ones, soonest first (spec 7.13). */
export async function getHubEvents({ campus, limit, from }: CampusQuery & { from: string }): Promise<readonly HubEvent[]> {
  "use cache";
  // `from` is today's SAST date (YYYY-MM-DD). It keeps past events out, and the cache keys on it, so it turns over each day.
  return hubEvents
    .filter((event) => event.date >= from)
    .filter((event) => campus === ALL_CAMPUSES || event.campusSlug === ALL_CAMPUSES || event.campusSlug === campus)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export async function getHubBanner(): Promise<HubBanner> {
  "use cache";
  return hubBanner;
}

/** A listing page's summary. Task 3 replaces this with getListingDetail. */
export async function getListing(id: string): Promise<ListingSummary | null> {
  "use cache";
  const found = listings.find((listing) => listing.id === id);
  return found ? { id: found.id, title: found.title, campusSlug: found.campusSlug, image: found.image } : null;
}

export async function getListingIds(): Promise<readonly string[]> {
  "use cache";
  return listings.map((listing) => listing.id);
}

export async function getSeller(slug: string): Promise<Seller | null> {
  "use cache";
  return sellers.find((seller) => seller.slug === slug) ?? null;
}

export async function getSellerSlugs(): Promise<readonly string[]> {
  "use cache";
  return sellers.map((seller) => seller.slug);
}
