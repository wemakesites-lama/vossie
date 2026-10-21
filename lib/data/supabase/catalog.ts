import "server-only";
import type {
  Condition,
  Handover,
  ImageRef,
  ListingKind,
  ListingState,
  PayMode,
  SellerStatus,
  TrustBadge,
} from "@/lib/types";
import type { CatalogSource } from "../catalog";
import type { ListingRow, SellerRow } from "../rows";
import { tagListings, tagSellers } from "../tags";
import { forPublic } from "./clients";
import { iso, photoSrc, selectAll } from "./rows";

// The catalog on Supabase (2b plan Task 15, decision 17). lib/data/index.ts runs the catalog's own rules
// (catalogOver, lib/data/catalog.ts) over a snapshot of the public tables, so both backends share one set of rules.
//
// The snapshot is read through the cookieless public client, inside "use cache": the access rules give it exactly the
// shops with a storefront (approved, or paused by their seller) and their published, shown listings, and the
// storefronts view tells approved from paused, which anon can't read from seller_profiles. It is tagged `listings` and
// `sellers`, so a write to either expires it and not only the readers around it (amendment 14).

// One literal each, so supabase-js can type the rows from them. Exported with the two row mappers below for the twins
// that read a shop or a listing with the viewer's client (C2/C3 plan amendment 8), so both map rows the same way.
export const SHOP_COLUMNS =
  "id, slug, name, tagline, category_slug, campus_slug, verified, badge, about, since, image_photo_id, image_placeholder, image_alt, slug_changed, created_at, updated_at";
export const LISTING_COLUMNS =
  "id, shop_id, state, kind, title, category_slug, condition, price_zar, price_is_from, pay_mode, swap_for, description, handover, pickup_point_id, campus_slug, created_at, first_published_at, updated_at, hidden_at, hidden_reason, listing_photos(position, photo_id, placeholder_src, alt)";

async function readShops() {
  return selectAll(() => forPublic().from("shops").select(SHOP_COLUMNS), ["slug"]);
}

async function readStorefronts() {
  return selectAll(() => forPublic().from("storefronts").select("shop_id, status"), ["shop_id"]);
}

async function readShopPoints() {
  return selectAll(
    () => forPublic().from("shop_pickup_points").select("shop_id, pickup_point_id"),
    ["shop_id", "pickup_point_id"],
  );
}

async function readListings() {
  return selectAll(() => forPublic().from("listings").select(LISTING_COLUMNS), ["id"]);
}

/** What catalogSnapshot() reads: the public tables' rows as they came, plain arrays the cache can keep. */
export type CatalogSnapshot = {
  shops: Awaited<ReturnType<typeof readShops>>;
  storefronts: Awaited<ReturnType<typeof readStorefronts>>;
  shopPoints: Awaited<ReturnType<typeof readShopPoints>>;
  listings: Awaited<ReturnType<typeof readListings>>;
};

/**
 * Every public shop with its status and pickup points, and every public listing with its photos, a page of 1,000 rows
 * at a time (spec section 11 plans search over the cached list while there are hundreds). Cached, tagged `listings`
 * and `sellers`.
 */
export async function catalogSnapshot(): Promise<CatalogSnapshot> {
  "use cache";
  // tagListings() tags both `listings` and `sellers`; tagSellers() says so here too, since a seller write must reach
  // the snapshot itself (amendment 14).
  tagListings();
  tagSellers();
  const [shops, storefronts, shopPoints, listings] = await Promise.all([
    readShops(),
    readStorefronts(),
    readShopPoints(),
    readListings(),
  ]);
  return { shops, storefronts, shopPoints, listings };
}

/** Newest first by when it was first published (the store's createdAt), then by id: the store's order on the seed. */
function newestFirst(a: ListingRow, b: ListingRow): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

/** A shops row as SHOP_COLUMNS reads it. */
export type ShopRecord = CatalogSnapshot["shops"][number];
/** A listings row as LISTING_COLUMNS reads it, with its photos. */
export type ListingRecord = CatalogSnapshot["listings"][number];

/**
 * A shop's row as the app's SellerRow. Its owner is null and it has no old links unless `extra` says so: anon can read
 * neither, and nothing buyers see needs them. The image is a stored photo at /photos/<uuid> or a placeholder's path.
 */
export function sellerRowFrom(
  shop: ShopRecord,
  pickupPointIds: string[],
  extra: Partial<Pick<SellerRow, "ownerId" | "previousSlugs">> = {},
): SellerRow {
  const src = photoSrc({ photo_id: shop.image_photo_id, placeholder_src: shop.image_placeholder });
  return {
    slug: shop.slug,
    ownerId: extra.ownerId ?? null,
    name: shop.name,
    tagline: shop.tagline,
    categorySlug: shop.category_slug,
    campusSlug: shop.campus_slug,
    verified: shop.verified,
    badge: shop.badge as TrustBadge | null,
    about: shop.about,
    since: shop.since,
    image: src === null ? null : { src, alt: shop.image_alt },
    pickupPointIds,
    slugChanged: shop.slug_changed,
    previousSlugs: extra.previousSlugs ?? [],
    createdAt: iso(shop.created_at),
    updatedAt: iso(shop.updated_at),
  };
}

/**
 * A listing's row as the app's ListingRow, on the shop with link `sellerSlug`. Its createdAt is when it was first
 * published, else when it was made (ListingRow.createdAt). Photos are in their order, a stored photo at /photos/<uuid>,
 * a placeholder at its own path, the alt as stored.
 */
export function listingRowFrom(row: ListingRecord, sellerSlug: string): ListingRow {
  const photos: ImageRef[] = [...row.listing_photos]
    .sort((a, b) => a.position - b.position)
    .flatMap((photo) => {
      const src = photoSrc(photo);
      return src === null ? [] : [{ src, alt: photo.alt }];
    });
  return {
    id: row.id,
    sellerSlug,
    state: row.state as ListingState,
    kind: row.kind as ListingKind,
    title: row.title,
    categorySlug: row.category_slug,
    condition: row.condition as Condition | null,
    priceZar: row.price_zar,
    priceIsFrom: row.price_is_from,
    payMode: row.pay_mode as PayMode,
    swapFor: row.swap_for,
    description: row.description,
    handover: row.handover as Handover,
    pickupPointId: row.pickup_point_id,
    campusSlug: row.campus_slug,
    photos,
    createdAt: iso(row.first_published_at ?? row.created_at),
    firstPublishedAt: iso(row.first_published_at),
    updatedAt: iso(row.updated_at),
    hiddenReason: row.hidden_reason,
    hiddenAt: iso(row.hidden_at),
  };
}

/**
 * The snapshot as the catalog's source: shops by slug (A to Z), listings newest first.
 * - A shop's owner is null: anon can't read it, and nothing buyers see needs it. Its status comes from the storefronts
 *   view, and no shop the Hub paused is in the snapshot at all (the access rules leave it out).
 * - Listings and shops are mapped by listingRowFrom and sellerRowFrom.
 */
export function catalogSourceFrom(snapshot: CatalogSnapshot): CatalogSource {
  const statuses = new Map(snapshot.storefronts.map((row) => [row.shop_id, row.status as SellerStatus | null]));
  const points = new Map<string, string[]>();
  for (const row of snapshot.shopPoints) points.set(row.shop_id, [...(points.get(row.shop_id) ?? []), row.pickup_point_id]);

  const slugs = new Map<string, string>();
  const statusBySlug = new Map<string, SellerStatus>();
  const sellers = new Map<string, SellerRow>();
  for (const shop of snapshot.shops) {
    slugs.set(shop.id, shop.slug);
    const status = statuses.get(shop.id);
    if (status) statusBySlug.set(shop.slug, status);
    sellers.set(shop.slug, sellerRowFrom(shop, points.get(shop.id) ?? []));
  }

  const listings: ListingRow[] = snapshot.listings.flatMap((row) => {
    const sellerSlug = slugs.get(row.shop_id);
    return sellerSlug === undefined ? [] : [listingRowFrom(row, sellerSlug)];
  });
  listings.sort(newestFirst);

  return {
    sellers,
    listings: new Map(listings.map((row) => [row.id, row])),
    // A shop not in the storefronts view has no storefront: it counts as waiting, so it shows nowhere.
    statusOf: (row) => statusBySlug.get(row.slug) ?? "pending",
    pausedByStaff: () => false,
  };
}
