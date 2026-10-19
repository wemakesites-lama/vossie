import { randomUUID } from "node:crypto";
import { FOLLOW_LIMIT } from "@/lib/following/rules";
import type { FollowedShop } from "@/lib/types";
import { listedListings, shopStatus, storefrontRow, toSeller } from "./catalog";
import { deleteNotificationsAbout, notifyNewListing } from "./notifications";
import type { FollowRow } from "./rows";
import { sampleStore } from "./store";

// Following shops (community actions spec 2.15 to 2.19 and 2.23; plan decisions 15, 17 and 21). A follow is the
// account, the shop's slug and when; F's moveShop keeps the slug up to date. A shop only ever sees how many follow it.
// Times come from the caller; only Server Actions call addFollow, which makes ids.

export type FollowResult = "followed" | "already" | "own" | "limit" | "not-found";

/** The account's follows, newest first. */
function followsBy(accountId: string): FollowRow[] {
  return [...sampleStore().follows.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function followsOf(sellerSlug: string): FollowRow[] {
  return [...sampleStore().follows.values()].filter((row) => row.sellerSlug === sellerSlug);
}

/** Follow (spec 2.15): a shop with a storefront, never the account's own, at most 200. */
export async function addFollow(accountId: string, sellerSlug: string, now: Date): Promise<FollowResult> {
  const shop = storefrontRow(sellerSlug);
  if (!shop) return "not-found";
  if (shop.ownerId === accountId) return "own";
  const mine = followsBy(accountId);
  if (mine.some((row) => row.sellerSlug === sellerSlug)) return "already";
  if (mine.length >= FOLLOW_LIMIT) return "limit";
  const id = `follow-${randomUUID()}`;
  sampleStore().follows.set(id, { id, accountId, sellerSlug, createdAt: now.toISOString() });
  return "followed";
}

/** Unfollow: true when there was a follow to remove. */
export async function removeFollow(accountId: string, sellerSlug: string): Promise<boolean> {
  const { follows } = sampleStore();
  for (const [id, row] of follows) {
    if (row.accountId === accountId && row.sellerSlug === sellerSlug) {
      follows.delete(id);
      return true;
    }
  }
  return false;
}

export async function isFollowing(accountId: string, sellerSlug: string): Promise<boolean> {
  return followsBy(accountId).some((row) => row.sellerSlug === sellerSlug);
}

/**
 * Saved's Shops tab (spec 2.17): the shops the account follows that have a storefront, newest follow first, each with
 * its photo (or its category's picture), campus, whether it's paused, and how many listings buyers can see now.
 */
export async function listFollowedShops(accountId: string): Promise<FollowedShop[]> {
  const listed = new Map<string, number>();
  for (const listing of listedListings()) listed.set(listing.sellerSlug, (listed.get(listing.sellerSlug) ?? 0) + 1);
  return followsBy(accountId).flatMap((follow) => {
    const row = storefrontRow(follow.sellerSlug);
    if (!row) return [];
    const seller = toSeller(row);
    return [
      {
        slug: seller.slug,
        name: seller.name,
        campusSlug: seller.campusSlug,
        image: { ...seller.image },
        paused: shopStatus(row) === "paused",
        listed: listed.get(seller.slug) ?? 0,
      },
    ];
  });
}

/** How many follow the shop: its dashboard's number (spec 2.18). Never who. */
export async function countFollowers(sellerSlug: string): Promise<number> {
  return followsOf(sellerSlug).length;
}

/**
 * Tells the shop's followers about a listing it has just published (spec 2.19), through notifyNewListing's one-a-day
 * rule. How many followers it told.
 */
export async function notifyFollowers({
  sellerSlug,
  shopName,
  listing,
  now,
}: {
  sellerSlug: string;
  shopName: string;
  listing: { id: string; title: string };
  now: Date;
}): Promise<number> {
  const followers = followsOf(sellerSlug);
  for (const follow of followers) {
    await notifyNewListing({ accountId: follow.accountId, sellerSlug, shopName, listing, now });
  }
  return followers.length;
}

/**
 * Deleting an account (spec 2.23, plan decision 21): its follows, the follows of every shop it owns, and those shops'
 * followers' new-listing notifications. Call it before F's forgetShopOf, while the shops still name their owner.
 */
export async function forgetFollowsOf(accountId: string): Promise<void> {
  const store = sampleStore();
  const shops = new Set([...store.sellers.values()].filter((row) => row.ownerId === accountId).map((row) => row.slug));
  for (const [id, row] of store.follows) {
    if (row.accountId === accountId || shops.has(row.sellerSlug)) store.follows.delete(id);
  }
  await deleteNotificationsAbout("new-listing", shops);
}

/** The shops the account follows, by name, newest first, for its data export (plan decision 21). No ids. */
export async function exportFollowing(accountId: string): Promise<string[]> {
  const { sellers } = sampleStore();
  return followsBy(accountId).flatMap((row) => {
    const name = sellers.get(row.sellerSlug)?.name;
    return name ? [name] : [];
  });
}
