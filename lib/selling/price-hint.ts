// lib/selling/price-hint.ts
import { searchWords } from "@/lib/browse/search";
import { formatRand } from "@/lib/format";
import type { CampusChoice, Listing, SearchQuery } from "@/lib/types";

// The price hint under the price field (spec 2.3 and decision 8): from real CampusCart listings found by browse's own
// search, never from the model. Shown only with 3 or more priced matches.

const MIN_MATCHES = 3;

/** Browse's query for a suggestion: the title's first two search words, in its category, at a campus. */
export function hintQuery(title: string, categorySlug: string, campus: CampusChoice): SearchQuery {
  return {
    q: searchWords(title).slice(0, 2).join(" ") || null,
    category: categorySlug,
    campus,
    price: null,
    pay: null,
    deals: null,
    sort: "match",
  };
}

/** "Similar on CampusCart: R180 to R260 (5 listings)", or null with fewer than 3 priced matches. */
export function priceHintText(listings: readonly Pick<Listing, "priceZar" | "priceIsFrom">[]): string | null {
  const prices = listings
    .filter((listing) => !listing.priceIsFrom && listing.priceZar !== null && listing.priceZar > 0)
    .map((listing) => listing.priceZar as number)
    .sort((a, b) => a - b);
  if (prices.length < MIN_MATCHES) return null;
  const low = prices[Math.floor(prices.length / 4)];
  const high = prices[Math.ceil((prices.length * 3) / 4) - 1];
  const range = low === high ? formatRand(low) : `${formatRand(low)} to ${formatRand(high)}`;
  return `Similar on CampusCart: ${range} (${prices.length} listings)`;
}
