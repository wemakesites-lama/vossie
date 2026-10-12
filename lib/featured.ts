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

/**
 * The fair daily seller draw (spec 7.10). Verified sellers take turns: each day the order starts one place further
 * on, so nobody is favoured. The campus's own sellers come first, topped up from other campuses.
 */
export function drawFeatured(
  sellers: readonly Seller[],
  campus: CampusChoice,
  day: string,
  count = 4,
): Seller[] {
  const eligible = sellers.filter((seller) => seller.verified).sort((a, b) => a.slug.localeCompare(b.slug));
  if (campus === ALL_CAMPUSES) return rotate(eligible, day).slice(0, count);
  const own = rotate(
    eligible.filter((seller) => seller.campusSlug === campus),
    day,
  );
  const others = rotate(
    eligible.filter((seller) => seller.campusSlug !== campus),
    day,
  );
  return [...own, ...others].slice(0, count);
}
