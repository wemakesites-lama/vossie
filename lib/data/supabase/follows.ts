import "server-only";
import type * as Sample from "../follows";
import { catalogOver, toSeller } from "../catalog";
import { catalogSnapshot, catalogSourceFrom, SHOP_COLUMNS, sellerRowFrom, type ShopRecord } from "./catalog";
import { forViewer, type DbClient } from "./clients";
import { forViewerAs } from "./viewer";

// Following shops on Supabase (C4/C5 plan Task 7; decision 10, amendment 3). Everything is read as the follower: their
// follows (the follows policy), each shop (the shops policy lets a follower read a shop the Hub has paused, through
// private.is_shop_contact; amendment 3's probe, so no view of its own) and whether its storefront is up (storefronts,
// which lists a seller's pause and not the Hub's). A waiting shop is unreadable, so it's left out, as the sample leaves
// it off Saved. The writes are follow_shop and unfollow_shop; the owner's count is follower_count, never who.
// Followers are told of a first publish inside save_listing (private.tell_followers), so notifyFollowers does nothing
// here. Never cached: request-time only.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

type Followed = { followedAt: string; shop: ShopRecord };

/**
 * The account's follows, newest first, each with its shop when the follower may read it. Filtered to the account as
 * well as by the follows policy, so no other account's follow can ever show (C4 review fix 3).
 */
async function myFollows(client: DbClient, accountId: string): Promise<Followed[]> {
  const follows = await client
    .from("follows")
    .select("shop_id, created_at, id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .order("id");
  if (follows.error) failed("follows", follows.error);
  if (follows.data.length === 0) return [];
  const shops = await client.from("shops").select(SHOP_COLUMNS).in("id", follows.data.map((row) => row.shop_id));
  if (shops.error) failed("shops", shops.error);
  const byId = new Map(shops.data.map((shop) => [shop.id, shop]));
  return follows.data.flatMap((row) => {
    const shop = byId.get(row.shop_id);
    return shop ? [{ followedAt: row.created_at, shop }] : [];
  });
}

/** A shop's id by its link, as the signed-in reader may see it; null when it's none they can. */
async function shopIdOf(client: DbClient, sellerSlug: string): Promise<string | null> {
  const { data, error } = await client.from("shops").select("id").eq("slug", sellerSlug).maybeSingle();
  if (error) failed("shops", error);
  return data?.id ?? null;
}

/** Follow: follow_shop decides (a storefront, not the account's own, at most 200, under the account's lock). */
export const addFollow: typeof Sample.addFollow = async (accountId, sellerSlug) => {
  const client = await forViewerAs(accountId);
  const shopId = await shopIdOf(client, sellerSlug);
  if (!shopId) return "not-found";
  const { data, error } = await client.rpc("follow_shop", { p_shop: shopId });
  if (error) failed("follow_shop", error);
  if (data !== "followed" && data !== "already" && data !== "own" && data !== "limit" && data !== "not-found") {
    throw new Error(`follow_shop answered ${data}`);
  }
  return data;
};

/** Unfollow, a paused shop's included: true when there was a follow to remove. */
export const removeFollow: typeof Sample.removeFollow = async (accountId, sellerSlug) => {
  const client = await forViewerAs(accountId);
  const shopId = await shopIdOf(client, sellerSlug);
  if (!shopId) return false;
  const { data, error } = await client.rpc("unfollow_shop", { p_shop: shopId });
  if (error) failed("unfollow_shop", error);
  return data === "unfollowed";
};

export const isFollowing: typeof Sample.isFollowing = async (accountId, sellerSlug) =>
  (await myFollows(await forViewerAs(accountId), accountId)).some((row) => row.shop.slug === sellerSlug);

/**
 * Saved's Shops tab: newest follow first; an open or seller-paused shop with its storefront, a shop the Hub paused
 * with none (it isn't in storefronts), each with its photo or its category's picture and how many listings buyers see
 * (C1's catalog snapshot, read directly: 2b amendment 14). A shop waiting for approval is left out: it's unreadable,
 * except to an admin, whose staff view of seller profiles says so.
 */
export const listFollowedShops: typeof Sample.listFollowedShops = async (accountId) => {
  const client = await forViewerAs(accountId);
  const follows = await myFollows(client, accountId);
  if (follows.length === 0) return [];
  const ids = follows.map((row) => row.shop.id);
  const [storefronts, profiles, snapshot] = await Promise.all([
    client.from("storefronts").select("shop_id, status").in("shop_id", ids),
    client.from("staff_seller_profiles").select("shop_id, status").in("shop_id", ids),
    catalogSnapshot(),
  ]);
  if (storefronts.error) failed("storefronts", storefronts.error);
  if (profiles.error) failed("staff_seller_profiles", profiles.error);
  const fronts = new Map(storefronts.data.flatMap((row) => (row.shop_id ? [[row.shop_id, row.status]] : [])));
  const waiting = new Set(profiles.data.flatMap((row) => (row.shop_id && row.status === "pending" ? [row.shop_id] : [])));
  const listed = new Map<string, number>();
  for (const listing of catalogOver(catalogSourceFrom(snapshot)).listedListings()) {
    listed.set(listing.sellerSlug, (listed.get(listing.sellerSlug) ?? 0) + 1);
  }
  return follows.flatMap(({ shop }) => {
    const front = fronts.get(shop.id);
    // Readable without a storefront: paused by the Hub (the follower's clause reads only paused shops), unless an
    // admin is reading a waiting one.
    if (front === undefined && waiting.has(shop.id)) return [];
    const seller = toSeller(sellerRowFrom(shop, []));
    return [
      {
        slug: seller.slug,
        name: seller.name,
        campusSlug: seller.campusSlug,
        image: { ...seller.image },
        paused: front === undefined || front === "paused",
        storefront: front !== undefined,
        listed: listed.get(seller.slug) ?? 0,
      },
    ];
  });
};

/** A shop's name for a status line: any shop the signed-in reader may see, a followed Hub-paused one included. */
export const shopNameOf: typeof Sample.shopNameOf = async (sellerSlug) => {
  const { data, error } = await (await forViewer()).from("shops").select("name").eq("slug", sellerSlug).maybeSingle();
  if (error) failed("shops", error);
  return data?.name ?? null;
};

/** How many follow the signed-in owner's shop (follower_count answers its owner only). Never who. */
export const countFollowers: typeof Sample.countFollowers = async (sellerSlug) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, sellerSlug);
  if (!shopId) return 0;
  const { data, error } = await client.rpc("follower_count", { p_shop: shopId });
  if (error) failed("follower_count", error);
  return data ?? 0;
};

/**
 * Nothing to do on Supabase (decision 10): save_listing told the followers of a first publish by an approved shop of
 * a listing the Hub hasn't hidden, in its own transaction, once a day each, and never the owner. saveListingForm keeps
 * its call, under the same condition, so the two can't disagree about what's new.
 */
export const notifyFollowers: typeof Sample.notifyFollowers = async () => 0;

/** Deleting an account's follows, and its shop's followers, is forget_account's (phase B's deleteAccountData). */
export const forgetFollowsOf: typeof Sample.forgetFollowsOf = async () => {
  throw new Error("forgetFollowsOf: forget_account does this on Supabase (phase B's deleteAccountData)");
};

/** The shops the account follows, by name, newest first, for the download. No ids. */
export const exportFollowing: typeof Sample.exportFollowing = async (accountId) =>
  (await myFollows(await forViewerAs(accountId), accountId)).map((row) => row.shop.name);
