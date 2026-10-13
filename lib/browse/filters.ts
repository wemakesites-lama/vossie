import { ALL_CAMPUSES } from "@/lib/campus";
import type { BrowseQuery, BrowseSort, PayFilter, PriceFilter } from "@/lib/types";
import { browseHref } from "./href";

export const PRICE_LABELS: Readonly<Record<PriceFilter, string>> = {
  free: "Free",
  "under-50": "Under R50",
  "under-100": "Under R100",
  "under-250": "Under R250",
  "under-500": "Under R500",
};

export const PAY_LABELS: Readonly<Record<PayFilter, string>> = { cash: "Cash", swap: "Swaps" };

export const SORT_LABELS: Readonly<Record<BrowseSort, string>> = {
  match: "Best match",
  new: "Newest",
  "price-low": "Price: low to high",
  "price-high": "Price: high to low",
};

export const DEALS_LABEL = "Free & swaps";

export type FilterChip = {
  key: "campus" | "price" | "pay" | "deals";
  label: string;
  removeHref: string;
};

/** A chip for each active filter, in order, with a link that removes just that one (spec 4.5). */
export function activeFilters(query: BrowseQuery, campusNames: ReadonlyMap<string, string>): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query.campus !== ALL_CAMPUSES) {
    chips.push({
      key: "campus",
      label: campusNames.get(query.campus) ?? query.campus,
      removeHref: browseHref(query, { campus: ALL_CAMPUSES }),
    });
  }
  if (query.price) {
    chips.push({ key: "price", label: PRICE_LABELS[query.price], removeHref: browseHref(query, { price: null }) });
  }
  if (query.pay) chips.push({ key: "pay", label: PAY_LABELS[query.pay], removeHref: browseHref(query, { pay: null }) });
  if (query.deals) chips.push({ key: "deals", label: DEALS_LABEL, removeHref: browseHref(query, { deals: null }) });
  return chips;
}

/** How many filters are on, for the Filters button: the campus (unless every campus), price, pay and deals. */
export function countActiveFilters(query: BrowseQuery): number {
  return [query.campus !== ALL_CAMPUSES, query.price, query.pay, query.deals].filter(Boolean).length;
}

/** "Clear all" (spec 4.5): every campus, and no price, pay or deals. The search, category and sort stay. */
export function clearAllHref(query: BrowseQuery): string {
  return browseHref(query, { campus: ALL_CAMPUSES, price: null, pay: null, deals: null });
}

/** The empty state's "Clear filters" (spec 4.7): price, pay and deals go; the campus stays. */
export function clearFiltersHref(query: BrowseQuery): string {
  return browseHref(query, { price: null, pay: null, deals: null });
}

/** "1 listing", "29 listings", or "Showing 24 of 36" when there are more than shown (spec 4.6). */
export function countLabel(total: number, shown: number): string {
  if (shown < total) return `Showing ${shown} of ${total}`;
  return total === 1 ? "1 listing" : `${total} listings`;
}
