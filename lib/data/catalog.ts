import { categories } from "@/data/fixtures/categories";
import type { ImageRef, Listing, Seller, SellerStatus } from "@/lib/types";
import type { ListingRow, SellerRow } from "./rows";
import { sampleStore } from "./store";

// What buyers see (selling spec 2.1, plan decision 2): the store's rows as the public Listing and Seller shapes, and
// the rules for which rows show where. Plain functions over the store; lib/data/index.ts wraps them in "use cache".
// A listing the Hub hid is in no list and has no page (staff tools plan decision 4); a declined shop is a waiting one
// (staff tools plan decision 2), so nothing changes for it here.
//
// The rules are written once, over a CatalogSource (2b plan decision 17): catalogOver(source) gives them for any set of
// rows, synchronously. The exports below are those rules over the sample store, with the signatures their callers had;
// on Supabase, lib/data/index.ts runs the same rules over a cached snapshot of the public tables
// (lib/data/supabase/catalog.ts). This module stays free of Supabase code: a client form imports categoryPicture.

const CATEGORY_NAMES: ReadonlyMap<string, string> = new Map(
  categories.map((category) => [category.slug, category.name]),
);

/** The rows the catalog's rules read, and how to tell a shop's status (2b plan decision 17). */
export type CatalogSource = {
  /** Shops by slug, in the order lists show them. */
  sellers: ReadonlyMap<string, SellerRow>;
  /** Listings by id, in the order lists show them. */
  listings: ReadonlyMap<string, ListingRow>;
  /** A shop's status (plan decision 1). */
  statusOf(row: SellerRow): SellerStatus;
  /** Whether the Hub paused it (staff tools spec 2.3): then it has no storefront. */
  pausedByStaff(row: SellerRow): boolean;
};

/** The catalog's rules over a source: what lib/data/index.ts reads in either backend. */
export type Catalog = ReturnType<typeof catalogOver>;

/** The catalog's rules (plan decisions 1 and 2) over the rows `source` holds. */
export function catalogOver(source: CatalogSource) {
  const shopStatus = (row: SellerRow): SellerStatus => source.statusOf(row);

  /**
   * Shops with a storefront: approved, or paused by their seller (plan decision 2). A shop the Hub paused disappears
   * (staff tools spec 2.3, amendment 13.2): its storefront and listing pages show the 404.
   */
  const hasStorefront = (row: SellerRow) => {
    const status = shopStatus(row);
    if (status === "approved") return true;
    if (status !== "paused") return false;
    return !source.pausedByStaff(row);
  };

  /**
   * A listing as buyers see it: its shop's badge (shopping spec 6.1), its photos with the title for an empty
   * description (selling spec 2.5) or its category's picture when it has none, and paused while its shop is.
   */
  function toListing(row: ListingRow, shop: SellerRow): Listing {
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
      sellerName: shop.name,
      morePhotos: more,
      description: row.description,
      condition: row.condition,
      handover: row.handover,
      pickupPointId: row.pickupPointId,
      swapFor: row.swapFor,
      availability: paused ? "paused" : (row.state as Listing["availability"]),
    };
  }

  /** Every shop buyers can find, in the source's order: approved, or a sample shop with no owner. */
  function liveSellerRows(): SellerRow[] {
    return [...source.sellers.values()].filter((row) => shopStatus(row) === "approved");
  }

  /** A storefront (plan decision 2): an approved or paused shop's. A shop waiting for approval has none. */
  function storefrontRow(slug: string): SellerRow | null {
    const row = source.sellers.get(slug);
    return row && hasStorefront(row) ? row : null;
  }

  /** Any shop's seller, for a listing's page (its shop has a storefront, or the listing wouldn't have a page). */
  function sellerFor(slug: string): Seller | null {
    const row = storefrontRow(slug);
    return row ? toSeller(row) : null;
  }

  /** Listed (plan decision 2): available, in an approved shop. In the source's order. */
  function listedListings(): Listing[] {
    return [...source.listings.values()].flatMap((row) => {
      const shop = source.sellers.get(row.sellerSlug);
      return shop && row.state === "available" && !row.hiddenAt && shopStatus(shop) === "approved"
        ? [toListing(row, shop)]
        : [];
    });
  }

  /** A listing's page (plan decision 2): anything but a draft, in an approved or paused shop. */
  function publicListing(id: string): Listing | null {
    const row = source.listings.get(id);
    const shop = row ? source.sellers.get(row.sellerSlug) : undefined;
    if (!row || !shop || row.state === "draft" || row.hiddenAt || !hasStorefront(shop)) return null;
    return toListing(row, shop);
  }

  /** Every listing with a page, for prerendering and the sitemap. */
  function publicListingIds(): string[] {
    return [...source.listings.keys()].filter((id) => publicListing(id) !== null);
  }

  return { shopStatus, toListing, liveSellerRows, storefrontRow, sellerFor, listedListings, publicListing, publicListingIds };
}

/**
 * A sample shop's status (plan decision 1): its owner's seller profile's, or approved for a sample shop with no owner.
 * An owned shop whose profile has gone counts as waiting, so it shows nowhere.
 */
function sampleStatus(row: Pick<SellerRow, "ownerId">): SellerStatus {
  if (row.ownerId === null) return "approved";
  return sampleStore().sellerProfiles.get(row.ownerId)?.status ?? "pending";
}

/** The sample store as a catalog source, read afresh on each call (a test may reset the store between calls). */
export function sampleCatalog(): Catalog {
  const store = sampleStore();
  return catalogOver({
    sellers: store.sellers,
    listings: store.listings,
    statusOf: sampleStatus,
    pausedByStaff: (row) => (row.ownerId ? store.sellerProfiles.get(row.ownerId)?.pausedBy === "staff" : false),
  });
}

/** A shop's status (plan decision 1), in the sample store. */
export function shopStatus(row: Pick<SellerRow, "ownerId">): SellerStatus {
  return sampleStatus(row);
}

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
  return sampleCatalog().toListing(row, shop);
}

/** Every shop buyers can find, in the store's order: approved, or a sample shop with no owner. */
export function liveSellerRows(): SellerRow[] {
  return sampleCatalog().liveSellerRows();
}

/** A storefront (plan decision 2): an approved or paused shop's. A shop waiting for approval has none. */
export function storefrontRow(slug: string): SellerRow | null {
  return sampleCatalog().storefrontRow(slug);
}

/** Any shop's seller, for a listing's page (its shop has a storefront, or the listing wouldn't have a page). */
export function sellerFor(slug: string): Seller | null {
  return sampleCatalog().sellerFor(slug);
}

/** Listed (plan decision 2): available, in an approved shop. In the store's order. */
export function listedListings(): Listing[] {
  return sampleCatalog().listedListings();
}

/** A listing's page (plan decision 2): anything but a draft, in an approved or paused shop. */
export function publicListing(id: string): Listing | null {
  return sampleCatalog().publicListing(id);
}

/** Every listing with a page, for prerendering and the sitemap. */
export function publicListingIds(): string[] {
  return sampleCatalog().publicListingIds();
}
