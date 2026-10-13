import { ALL_CAMPUSES } from "@/lib/campus";
import type {
  BrowseQuery,
  BrowseSort,
  Campus,
  CampusChoice,
  Category,
  PayFilter,
  PriceFilter,
  SearchQuery,
} from "@/lib/types";

export const PAGE_SIZE = 24;
export const MAX_SHOWN = 240;
export const MAX_QUERY_LENGTH = 100;

/** A page's search params, as Next passes them. */
export type BrowseParams = Record<string, string | string[] | undefined>;

/** The slugs a link may name. Anything else in a link is ignored. */
export type KnownSlugs = {
  campuses: ReadonlySet<string>;
  categories: ReadonlySet<string>;
};

const PRICES = new Set<string>(["free", "under-50", "under-100", "under-250", "under-500"]);
// A Map, not an object, so a link like ?max=constructor can't reach Object's own properties.
const MAX_ALIASES = new Map<string, PriceFilter>([
  ["50", "under-50"],
  ["100", "under-100"],
  ["250", "under-250"],
  ["500", "under-500"],
]);
const PAYS = new Set<string>(["cash", "swap"]);
const SORTS = new Set<string>(["match", "new", "price-low", "price-high"]);

/** The first value of a parameter: a repeated parameter counts once. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Best match with a search, newest without one. */
export function defaultSort(q: string | null): BrowseSort {
  return q ? "match" : "new";
}

/** `n`: rounded up to the next 24 and capped at 240. Anything else means the first 24. */
export function parseShown(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return PAGE_SIZE;
  const asked = Number(raw);
  if (asked === 0) return PAGE_SIZE;
  return Math.min(MAX_SHOWN, Math.ceil(asked / PAGE_SIZE) * PAGE_SIZE);
}

/**
 * Turn a browse link into a query (browse and listing spec 3.2). Unknown, empty and repeated values are ignored, so a
 * mangled link still shows results. With no campus in the link, the viewer's chosen campus is used.
 */
export function parseBrowseParams(params: BrowseParams, viewerCampus: CampusChoice, known: KnownSlugs): BrowseQuery {
  const q = first(params.q)?.trim().slice(0, MAX_QUERY_LENGTH).trim() || null;

  const cat = first(params.cat);
  const campusParam = first(params.campus);
  const campusFromLink =
    campusParam !== undefined && (campusParam === ALL_CAMPUSES || known.campuses.has(campusParam));

  const priceParam = first(params.price);
  const price =
    priceParam !== undefined && PRICES.has(priceParam)
      ? (priceParam as PriceFilter)
      : (MAX_ALIASES.get(first(params.max) ?? "") ?? null);

  const payParam = first(params.pay);
  const sortParam = first(params.sort);
  const sortAllowed = sortParam !== undefined && SORTS.has(sortParam) && !(sortParam === "match" && !q);

  return {
    q,
    category: cat !== undefined && known.categories.has(cat) ? cat : null,
    campus: campusFromLink && campusParam !== undefined ? campusParam : viewerCampus,
    campusFromLink,
    price,
    pay: payParam !== undefined && PAYS.has(payParam) ? (payParam as PayFilter) : null,
    deals: first(params.deals) === "free-and-swaps" ? "free-and-swaps" : null,
    sort: sortAllowed ? (sortParam as BrowseSort) : defaultSort(q),
    shown: parseShown(first(params.n)),
  };
}

/** The slugs a link may name, from the campus and category lists. */
export function knownSlugs(
  campuses: readonly Pick<Campus, "slug">[],
  categories: readonly Pick<Category, "slug">[],
): KnownSlugs {
  return {
    campuses: new Set(campuses.map((campus) => campus.slug)),
    categories: new Set(categories.map((category) => category.slug)),
  };
}

/** The part of a query a search needs (spec 6.3): no paging, and no note of where the campus came from. */
export function toSearchQuery({ q, category, campus, price, pay, deals, sort }: BrowseQuery): SearchQuery {
  return { q, category, campus, price, pay, deals, sort };
}
