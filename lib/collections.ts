import { formatRand } from "./format";
import type { Category, CollectionRule, Listing } from "./types";

/**
 * Whether a listing belongs in a collection (shopping spec 6.2): its category is one of the rule's and, under a cap,
 * it costs the cap or less. A free listing (R0) counts; a swap-only one has no price, so a capped rule leaves it out.
 * Whether it's available is the caller's job.
 */
export function matchesRule(listing: Pick<Listing, "categorySlug" | "priceZar">, rule: CollectionRule): boolean {
  if (!rule.categories.includes(listing.categorySlug)) return false;
  if (rule.maxPrice === undefined) return true;
  return listing.priceZar !== null && listing.priceZar <= rule.maxPrice;
}

export type BrowseLink = { label: string; href: string };

/**
 * "More in browse" (shopping spec 7.2): one link per category in the rule, in the rule's order, keeping the cap.
 * "More in Res & living under R500" goes to /browse?cat=res-living&max=500. The links name no campus, so browse opens
 * on the viewer's own (plan decision 10).
 */
export function collectionBrowseLinks(
  rule: CollectionRule,
  categories: readonly Pick<Category, "slug" | "name">[],
): BrowseLink[] {
  const cap = rule.maxPrice;
  return rule.categories.flatMap((slug) => {
    const category = categories.find((item) => item.slug === slug);
    if (!category) return [];
    if (cap === undefined) return [{ label: `More in ${category.name}`, href: `/browse?cat=${slug}` }];
    return [{ label: `More in ${category.name} under ${formatRand(cap)}`, href: `/browse?cat=${slug}&max=${cap}` }];
  });
}
