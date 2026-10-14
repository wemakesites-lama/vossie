import { ALL_CAMPUSES } from "./campus";
import type { CampusChoice, Category } from "./types";

/** The board's `?cat=` (community spec 4.1): a known category's slug, or null for every category. */
export function readRequestCategory(
  raw: string | string[] | undefined,
  categories: readonly Pick<Category, "slug">[],
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return null;
  return categories.some((category) => category.slug === value) ? value : null;
}

/** The board's link for one category, or for all of them. */
export function boardHref(category: string | null): string {
  return category === null ? "/looking-for" : `/looking-for?cat=${category}`;
}

/**
 * The board's two lists (community spec 4.1): the viewer's campus, then every other campus, each keeping the order
 * given. With "All campuses" chosen there's one list, so this returns null.
 */
export function splitByCampus<T extends { campusSlug: string }>(
  items: readonly T[],
  campus: CampusChoice,
): { own: T[]; others: T[] } | null {
  if (campus === ALL_CAMPUSES) return null;
  return {
    own: items.filter((item) => item.campusSlug === campus),
    others: items.filter((item) => item.campusSlug !== campus),
  };
}
