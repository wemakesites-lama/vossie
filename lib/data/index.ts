import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { collections } from "@/data/fixtures/collections";
import { freeSwapItems } from "@/data/fixtures/free-swaps";
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
  return listings
    .filter((listing) => campus === ALL_CAMPUSES || listing.campusSlug === campus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // ISO times in UTC sort as text
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

export async function getFreeAndSwaps({ campus, limit }: CampusQuery): Promise<readonly FreeSwapItem[]> {
  "use cache";
  return campusFirst(freeSwapItems, campus, limit);
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

/** A listing page's summary, for regular listings and free and swap items alike. */
export async function getListing(id: string): Promise<ListingSummary | null> {
  "use cache";
  const found = listings.find((listing) => listing.id === id) ?? freeSwapItems.find((item) => item.id === id);
  return found ? { id: found.id, title: found.title, campusSlug: found.campusSlug, image: found.image } : null;
}

export async function getListingIds(): Promise<readonly string[]> {
  "use cache";
  return [...listings, ...freeSwapItems].map((item) => item.id);
}

export async function getSeller(slug: string): Promise<Seller | null> {
  "use cache";
  return sellers.find((seller) => seller.slug === slug) ?? null;
}

export async function getSellerSlugs(): Promise<readonly string[]> {
  "use cache";
  return sellers.map((seller) => seller.slug);
}
