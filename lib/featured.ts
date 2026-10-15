import { ALL_CAMPUSES } from "./campus";
import type { CampusChoice, Seller } from "./types";

const DAY_MS = 86_400_000;

/** Whole days since 1 January 1970 for a YYYY-MM-DD date. */
export function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** The list rotated to start `dayNumber(day)` places on, so each day a different seller leads. */
function rotate(list: readonly Seller[], day: string): Seller[] {
  if (list.length === 0) return [];
  const start = dayNumber(day) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

/** What a day's draw honours besides the rotation (staff tools spec 2.8, plan decision 9). */
export type FeaturedOptions = {
  /** Pinned sellers' slugs, in the order they were pinned. They take the first places, before the draw. */
  pinned?: readonly string[];
  /** Sellers who featured recently: the week's break. They come after everyone else, so a pin ignores it. */
  resting?: ReadonlySet<string>;
};

/**
 * The fair daily seller draw (spec 7.10). Verified sellers take turns: each day the order starts one place further
 * on, so nobody is favoured. The campus's own sellers come first, topped up from other campuses. Pins come before
 * the draw. Sellers resting after a recent turn come after everyone else, so the break is a preference: with nine
 * sellers for four places a strict break would empty the row for days (staff tools plan amendment 3). Only sellers in
 * `sellers` can be pinned: the caller passes the ones who may be featured.
 */
export function drawFeatured(
  sellers: readonly Seller[],
  campus: CampusChoice,
  day: string,
  count = 4,
  { pinned = [], resting = new Set<string>() }: FeaturedOptions = {},
): Seller[] {
  const eligible = sellers.filter((seller) => seller.verified).sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  const pins = [...new Set(pinned)].flatMap((slug) => bySlug.get(slug) ?? []).slice(0, count);
  const taken = new Set(pins.map((seller) => seller.slug));
  // The campus's own sellers first, as for the rest.
  const inOrder = (list: readonly Seller[]) =>
    campus === ALL_CAMPUSES
      ? rotate(list, day)
      : [
          ...rotate(
            list.filter((seller) => seller.campusSlug === campus),
            day,
          ),
          ...rotate(
            list.filter((seller) => seller.campusSlug !== campus),
            day,
          ),
        ];
  const rested = eligible.filter((seller) => !taken.has(seller.slug) && resting.has(seller.slug));
  const pool = eligible.filter((seller) => !taken.has(seller.slug) && !resting.has(seller.slug));
  return [...pins, ...inOrder(pool), ...inOrder(rested)].slice(0, count);
}
