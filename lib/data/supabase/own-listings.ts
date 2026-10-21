import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type * as Sample from "../own-listings";
import type { ListingRow } from "../rows";
import { LISTING_COLUMNS, listingRowFrom } from "./catalog";
import { forViewer, viewerId, type DbClient } from "./clients";
import { dbPhotoId, removePhotoFiles } from "./photos";
import { viewerShop } from "./shops";
import { forViewerAs } from "./viewer";

// A shop's own listings on Supabase (C2/C3 plan Task 9), drafts and hidden ones included, through the owner's own
// client: the listings policy lets an owner read all of theirs. The writes are save_listing, set_listing_state and
// delete_listing, which act on the signed-in account's own shop only; the files they no longer need (removed_paths)
// go through removePhotoFiles. A twin given a shop's link checks it is the signed-in account's shop and throws
// otherwise (2b plan decision 20). Times are the database's: `now` is unused. Never cached (decision 4).
//
// The new listing's one-time token is taken by take_form_state before the save (the controller's answer to amendment
// 2), so save_listing is unchanged and takes none.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** The viewer's client and their shop's id, once `sellerSlug` is checked to be it. */
async function ownShop(sellerSlug: string, accountId?: string): Promise<{ db: DbClient; shopId: string }> {
  const id = accountId ?? (await viewerId());
  const db = accountId ? await forViewerAs(accountId) : await forViewer();
  const shop = await viewerShop(db, id);
  if (!shop || shop.slug !== sellerSlug) {
    throw new Error("A Supabase twin was asked about a shop that isn't the signed-in account's");
  }
  return { db, shopId: shop.id };
}

/** A row as the sample keeps it: no hiddenAt or hiddenReason unless the Hub hid it. */
function ownRow(row: Parameters<typeof listingRowFrom>[0], sellerSlug: string): ListingRow {
  const mapped = listingRowFrom(row, sellerSlug);
  if (!mapped.hiddenAt) {
    delete mapped.hiddenAt;
    delete mapped.hiddenReason;
  }
  return mapped;
}

export const listOwnListings: typeof Sample.listOwnListings = async (sellerSlug) => {
  const { db, shopId } = await ownShop(sellerSlug);
  const { data, error } = await db
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false })
    .order("id");
  if (error) failed("listings", error);
  return data.map((row) => ownRow(row, sellerSlug));
};

async function readOwnListing(db: DbClient, shopId: string, sellerSlug: string, id: string): Promise<ListingRow | null> {
  const { data, error } = await db.from("listings").select(LISTING_COLUMNS).eq("shop_id", shopId).eq("id", id).maybeSingle();
  if (error) failed("listings", error);
  return data ? ownRow(data, sellerSlug) : null;
}

export const getOwnListing: typeof Sample.getOwnListing = async (sellerSlug, id) => {
  const { db, shopId } = await ownShop(sellerSlug);
  return readOwnListing(db, shopId, sellerSlug, id);
};

/** The photos as save_listing takes them: a stored photo by its uuid, anything else as a placeholder (amendment 10). */
function photosArg(photos: Sample.ListingSave["photos"]): Json {
  return photos.map((photo) => {
    const id = dbPhotoId(photo.src);
    return id ? { photo_id: id, alt: photo.alt } : { placeholder_src: photo.src, alt: photo.alt };
  });
}

/** The generated types say string or number where SQL takes null too. */
const orNull = <T>(value: T | null) => value as T;

export const saveOwnListing: typeof Sample.saveOwnListing = async (save) => {
  const { db, shopId } = await ownShop(save.sellerSlug, save.ownerId);
  const f = save.fields;
  const { data, error } = await db.rpc("save_listing", {
    p_listing_id: orNull(save.id),
    p_kind: f.kind,
    p_title: f.title,
    p_category_slug: f.categorySlug,
    p_condition: orNull(f.condition),
    p_price_zar: orNull(f.priceZar),
    p_price_is_from: f.priceIsFrom,
    p_pay_mode: f.payMode,
    p_swap_for: orNull(f.swapFor),
    p_description: f.description,
    p_handover: f.handover,
    p_pickup_point_id: orNull(f.pickupPointId),
    p_photos: photosArg(save.photos),
    p_publish: save.intent === "publish",
  });
  if (error) failed("save_listing", error);
  const answer = data as { result: string; listing_id?: string; removed_paths?: string[] };
  if (answer.result !== "saved" || !answer.listing_id) return null;
  await removePhotoFiles(answer.removed_paths ?? []);
  return readOwnListing(db, shopId, save.sellerSlug, answer.listing_id);
};

export const setOwnListingState: typeof Sample.setOwnListingState = async (sellerSlug, id, to) => {
  const { db, shopId } = await ownShop(sellerSlug);
  const { data, error } = await db.rpc("set_listing_state", { p_listing_id: id, p_to: to });
  if (error) failed("set_listing_state", error);
  return data === "moved" ? readOwnListing(db, shopId, sellerSlug, id) : null;
};

export const deleteOwnListing: typeof Sample.deleteOwnListing = async (sellerSlug, ownerId, id) => {
  const { db } = await ownShop(sellerSlug, ownerId);
  const { data, error } = await db.rpc("delete_listing", { p_listing_id: id });
  if (error) failed("delete_listing", error);
  const answer = data as { result: string; removed_paths?: string[] };
  if (answer.result !== "deleted") return false;
  await removePhotoFiles(answer.removed_paths ?? []);
  return true;
};
