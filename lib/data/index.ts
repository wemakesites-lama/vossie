import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { trendingSearches } from "@/data/fixtures/trending";
import type { Announcement, Campus, Category, TrendingSearches } from "@/lib/types";

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
