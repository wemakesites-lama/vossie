import { categories } from "@/data/fixtures/categories";
import type { ImageRef, Listing, Seller, SellerStatus } from "@/lib/types";
import type { ListingRow, SellerRow } from "./rows";
import { sampleStore } from "./store";

// What buyers see (selling spec 2.1, plan decision 2): the store's rows as the public Listing and Seller shapes, and
// the rules for which rows show where. Plain functions over the store; lib/data/index.ts wraps them in "use cache".
// A listing the Hub hid is in no list and has no page (staff tools plan decision 4); a declined shop is a waiting one
// (staff tools plan decision 2), so nothing changes for it here.

const CATEGORY_NAMES: ReadonlyMap<string, string> = new Map(
  categories.map((category) => [category.slug, category.name]),
);

/**
 * A shop's status (plan decision 1): its owner's seller profile's, or approved for a sample shop with no owner. An
 * owned shop whose profile has gone counts as waiting, so it shows nowhere.
 */
export function shopStatus(row: Pick<SellerRow, "ownerId">): SellerStatus {
  if (row.ownerId === null) return "approved";
  return sampleStore().sellerProfiles.get(row.ownerId)?.status ?? "pending";
}

/** Shops with a storefront: approved or paused (plan decision 2). */
const hasStorefront = (row: SellerRow) => {
  const status = shopStatus(row);
  return status === "approved" || status === "paused";
};

/** A shop without a photo shows its category's picture (selling spec 2.6, step 3). */
export function categoryPicture(categorySlug: string): ImageRef {
  return { src: `/placeholders/category/${categorySlug}.svg`, alt: "" };
}

export function toSeller(row: SellerRow): Seller {
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    category: CATEGORY_NAMES.get(row.categorySlug) ?? "",
    categorySlug: row.categorySlug,
    campusSlug: row.campusSlug,
    verified: row.verified,
    badge: row.badge,
    about: row.about,
    since: row.since,
    image: row.image ? { ...row.image } : categoryPicture(row.categorySlug),
  };
}

/**
 * A listing as buyers see it: its shop's badge (shopping spec 6.1), its photos with the title for an empty
 * description (selling spec 2.5) or its category's picture when it has none, and paused while its shop is.
 */
export function toListing(row: ListingRow, shop: SellerRow): Listing {
  const [cover, ...more] = row.photos.map((photo) => ({ src: photo.src, alt: photo.alt || row.title }));
  const paused = row.state === "draft" || shopStatus(shop) === "paused";
  return {
    id: row.id,
    title: row.title,
    priceZar: row.priceZar,
    priceIsFrom: row.priceIsFrom,
    payMode: row.payMode,
    campusSlug: row.campusSlug,
    image: cover ?? { src: `/placeholders/listing/${row.categorySlug}.svg`, alt: row.title },
    badge: shop.badge,
    createdAt: row.createdAt,
    kind: row.kind,
    categorySlug: row.categorySlug,
    sellerSlug: row.sellerSlug,
    morePhotos: more,
    description: row.description,
    condition: row.condition,
    handover: row.handover,
    pickupPointId: row.pickupPointId,
    swapFor: row.swapFor,
    availability: paused ? "paused" : (row.state as Listing["availability"]),
  };
}

/** Every shop buyers can find, in the store's order: approved, or a sample shop with no owner. */
export function liveSellerRows(): SellerRow[] {
  return [...sampleStore().sellers.values()].filter((row) => shopStatus(row) === "approved");
}

/** A storefront (plan decision 2): an approved or paused shop's. A shop waiting for approval has none. */
export function storefrontRow(slug: string): SellerRow | null {
  const row = sampleStore().sellers.get(slug);
  return row && hasStorefront(row) ? row : null;
}

/** Any shop's seller, for a listing's page (its shop has a storefront, or the listing wouldn't have a page). */
export function sellerFor(slug: string): Seller | null {
  const row = storefrontRow(slug);
  return row ? toSeller(row) : null;
}

/** Listed (plan decision 2): available, in an approved shop. In the store's order. */
export function listedListings(): Listing[] {
  const { sellers, listings } = sampleStore();
  return [...listings.values()].flatMap((row) => {
    const shop = sellers.get(row.sellerSlug);
    return shop && row.state === "available" && !row.hiddenAt && shopStatus(shop) === "approved" ? [toListing(row, shop)] : [];
  });
}

/** A listing's page (plan decision 2): anything but a draft, in an approved or paused shop. */
export function publicListing(id: string): Listing | null {
  const { sellers, listings } = sampleStore();
  const row = listings.get(id);
  const shop = row ? sellers.get(row.sellerSlug) : undefined;
  if (!row || !shop || row.state === "draft" || row.hiddenAt || !hasStorefront(shop)) return null;
  return toListing(row, shop);
}

/** Every listing with a page, for prerendering and the sitemap. */
export function publicListingIds(): string[] {
  return [...sampleStore().listings.keys()].filter((id) => publicListing(id) !== null);
}
