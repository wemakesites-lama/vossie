import "server-only";
import type * as Facts from "../coach-facts";
import { forServer } from "./clients";
import { iso, selectAll } from "./rows";

// The owner's own rows for Shop coach on Supabase (AI stage I1 plan Task 6): the shop's about and photo, its listings
// in every state with their photo counts, and the posts the owner has booked. It reads with the admin client, like
// shopStats: callers pass only the signed-in seller's own shop (I1), or a shop staff may open, after that check (I2).
// Request-time only; only the numbers and the owner's own titles leave the server.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

export async function ownRows(slug: string): Promise<Facts.OwnRows | null> {
  const { data: shop, error } = await forServer()
    .from("shops")
    .select("id, campus_slug, category_slug, about, image_photo_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) failed("shops", error);
  if (!shop) return null;
  const rows = await selectAll(
    () =>
      forServer()
        .from("listings")
        .select("id, title, category_slug, state, hidden_at, price_zar, price_is_from, description, updated_at")
        .eq("shop_id", shop.id),
    ["id"],
  );
  const photos = new Map<string, number>();
  const ids = rows.map((row) => row.id);
  for (let from = 0; from < ids.length; from += 50) {
    const { data, error: photoError } = await forServer()
      .from("listing_photos")
      .select("listing_id")
      .in("listing_id", ids.slice(from, from + 50));
    if (photoError) failed("listing_photos", photoError);
    for (const row of data) photos.set(row.listing_id, (photos.get(row.listing_id) ?? 0) + 1);
  }
  return {
    shop: {
      campusSlug: shop.campus_slug,
      categorySlug: shop.category_slug,
      about: shop.about,
      hasPhoto: shop.image_photo_id !== null,
    },
    listings: rows.map((row) => ({
      id: row.id,
      title: row.title,
      categorySlug: row.category_slug,
      state: row.state as Facts.OwnRows["listings"][number]["state"],
      hidden: row.hidden_at !== null,
      priceZar: row.price_zar,
      priceIsFrom: row.price_is_from,
      photos: photos.get(row.id) ?? 0,
      descriptionChars: Array.from(row.description).length,
      updatedAt: iso(row.updated_at),
    })),
  };
}

export const bookedPosts: typeof Facts.bookedPosts = async (ownerId, postIds) => {
  if (postIds.length === 0) return new Set();
  const wanted = [...postIds];
  const [rsvps, bookings] = await Promise.all([
    forServer().from("hub_rsvps").select("post_id").eq("account_id", ownerId).in("post_id", wanted),
    forServer().from("hub_bookings").select("post_id").eq("account_id", ownerId).in("post_id", wanted),
  ]);
  if (rsvps.error) failed("hub_rsvps", rsvps.error);
  if (bookings.error) failed("hub_bookings", bookings.error);
  return new Set([...rsvps.data, ...bookings.data].map((row) => row.post_id));
};
