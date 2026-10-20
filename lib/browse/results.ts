import { ALL_CAMPUSES } from "@/lib/campus";
import type { BrowseSort, Listing, MatchQuery, PriceFilter, SearchQuery, SearchResult } from "@/lib/types";
import { matchScore, queryWords } from "./search";

const PRICE_CAPS: Readonly<Record<Exclude<PriceFilter, "free">, number>> = {
  "under-50": 50,
  "under-100": 100,
  "under-250": 250,
  "under-500": 500,
};

/**
 * The price, pay and deals filters (browse and listing spec 4.9). A free listing is R0 and counts as cash; a
 * swap-only listing has no price, so price filters leave it out. A "From" price counts at its from amount.
 */
export function passesFilters(listing: Listing, query: Pick<SearchQuery, "price" | "pay" | "deals">): boolean {
  const { priceZar, payMode } = listing;
  if (query.price === "free" && priceZar !== 0) return false;
  if (query.price && query.price !== "free" && (priceZar === null || priceZar > PRICE_CAPS[query.price])) return false;
  if (query.pay === "cash" && payMode === "swap") return false;
  if (query.pay === "swap" && payMode === "cash") return false;
  if (query.deals === "free-and-swaps" && priceZar !== 0 && payMode === "cash") return false;
  return true;
}

type Scored = { listing: Listing; score: number };

const newest = (a: Scored, b: Scored) => b.listing.createdAt.localeCompare(a.listing.createdAt);

/** Price order, with swap-only listings (no price) always last. Ties go to the newest. */
function byPrice(direction: 1 | -1) {
  return (a: Scored, b: Scored) => {
    const priceA = a.listing.priceZar;
    const priceB = b.listing.priceZar;
    if (priceA === null || priceB === null) {
      if (priceA === priceB) return newest(a, b);
      return priceA === null ? 1 : -1;
    }
    return (priceA - priceB) * direction || newest(a, b);
  };
}

const COMPARE: Readonly<Record<BrowseSort, (a: Scored, b: Scored) => number>> = {
  new: newest,
  "price-low": byPrice(1),
  "price-high": byPrice(-1),
  match: (a, b) => b.score - a.score || newest(a, b),
};

/** Seller and category names by slug, so a search can find a listing by them. */
export type ListingNames = {
  sellers: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
};

/**
 * The per-listing test (browse and listing spec 4.8 and 4.9; search alerts spec 2.2): an available listing in the
 * query's category and campus that passes its price, pay and deals filters and has every one of its words. Its Best
 * match score when it matches; null when it doesn't. Browse's results and saved-search alerts both call it, so they
 * can't disagree.
 */
export function listingMatches(listing: Listing, query: MatchQuery, names: ListingNames): number | null {
  if (listing.availability !== "available") return null;
  if (query.category && listing.categorySlug !== query.category) return null;
  if (query.campus !== ALL_CAMPUSES && listing.campusSlug !== query.campus) return null;
  if (!passesFilters(listing, query)) return null;
  return matchScore(
    {
      title: listing.title,
      category: names.categories.get(listing.categorySlug) ?? "",
      seller: names.sellers.get(listing.sellerSlug) ?? "",
      description: listing.description,
    },
    queryWords(query.q),
  );
}

/**
 * Every available listing that matches the query, sorted (spec 4.8 and 4.9), and how many matches sit at other
 * campuses when the query is for one campus (for the empty state, spec 4.7). A listing at another campus counts when
 * it would match with every campus.
 */
export function findListings(all: readonly Listing[], query: SearchQuery, names: ListingNames): SearchResult {
  const everyCampus = { ...query, campus: ALL_CAMPUSES };
  const found: Scored[] = [];
  let elsewhere = 0;

  for (const listing of all) {
    if (query.campus === ALL_CAMPUSES || listing.campusSlug === query.campus) {
      const score = listingMatches(listing, query, names);
      if (score !== null) found.push({ listing, score });
    } else if (listingMatches(listing, everyCampus, names) !== null) {
      elsewhere += 1;
    }
  }

  found.sort(COMPARE[query.sort]);
  return { items: found.map((entry) => entry.listing), elsewhere };
}
