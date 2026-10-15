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

/** What a day's draw honours besides the rotation (staff tools spec 2.8; plan decision 9 and amendment 14). */
export type FeaturedOptions = {
  /** Pinned sellers' slugs, in the order they were pinned. They take the first places, before the draw. */
  pinned?: readonly string[];
  /**
   * Sellers on the week's break, each with the last day (YYYY-MM-DD) they were shown. They sit out the draw while
   * others can fill the places; then they fill what's left, the one shown longest ago first. A pin ignores it.
   */
  resting?: ReadonlyMap<string, string>;
};

/**
 * The fair daily seller draw (spec 7.10). Verified sellers take turns: each day the order starts one place further
 * on, so nobody is favoured. The campus's own sellers come first, topped up from other campuses. Pins come before
 * the draw; sellers resting after a recent turn come after everyone else, so the row stays full while there are
 * enough sellers (staff tools spec 2.8, amendment 14: the break is soft). Only sellers in `sellers` can be pinned:
 * the caller passes the ones who may be featured.
 */
export function drawFeatured(
  sellers: readonly Seller[],
  campus: CampusChoice,
  day: string,
  count = 4,
  { pinned = [], resting = new Map<string, string>() }: FeaturedOptions = {},
): Seller[] {
  const eligible = sellers.filter((seller) => seller.verified).sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = new Map(eligible.map((seller) => [seller.slug, seller]));
  const pins = [...new Set(pinned)].flatMap((slug) => bySlug.get(slug) ?? []).slice(0, count);
  const taken = new Set(pins.map((seller) => seller.slug));
  // The rotation over everyone who may be featured, so that with no pins and nobody resting it draws as it always has.
  const rotation =
    campus === ALL_CAMPUSES
      ? rotate(eligible, day)
      : [
          ...rotate(
            eligible.filter((seller) => seller.campusSlug === campus),
            day,
          ),
          ...rotate(
            eligible.filter((seller) => seller.campusSlug !== campus),
            day,
          ),
        ];
  const open = rotation.filter((seller) => !taken.has(seller.slug));
  const fresh = open.filter((seller) => !resting.has(seller.slug));
  // Shown longest ago first; the sort is stable, so sellers last shown on the same day keep the rotation's order.
  const rested = open
    .filter((seller) => resting.has(seller.slug))
    .sort((a, b) => resting.get(a.slug)!.localeCompare(resting.get(b.slug)!));
  return [...pins, ...fresh, ...rested].slice(0, count);
}
