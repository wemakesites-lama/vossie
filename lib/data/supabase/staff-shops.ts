import "server-only";
import type { ListingState, SellerStatus } from "@/lib/types";
import { catalogOver } from "../catalog";
import { Refused } from "../refused";
import type { SellerProfileRow, SellerRow } from "../rows";
import type * as Sample from "../staff-shops";
import { inReviewOrder, listedCountsOf, type ReviewSource, reviewOver } from "../staff-shops";
import { catalogSnapshot, catalogSourceFrom, SHOP_COLUMNS, sellerRowFrom, type ShopRecord } from "./catalog";
import { forViewer, type DbClient } from "./clients";
import { pickupPointRows } from "./pickup-points";
import { iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// The Hub's decisions about shops and listings on Supabase (C4/C5 plan Tasks 12 and 14; decisions 2, 5 and 11).
//
// Reads are the admin's own, with their session: every shop (the shops policy), every seller profile with its mentor
// (staff_seller_profiles), first names (profiles: staff read every one) and what's listed now (C1's catalog snapshot).
// A shop's owner is the seller profile whose shop_id is the shop's (decision 5; shops.owner_id isn't granted to any API
// role), and a shop with no seller profile is a sample shop: no owner, open. The views are the sample's own rules over
// those rows (reviewOver). A shop's old links aren't the admin's to read and the review never shows them: none here.
//
// Writes are the staff functions of the same names, with the admin's session (decision 2). Each does its audit entry,
// report closes and notifications in its own transaction (decision 3). 'changed' gives the decision read back, 'nothing'
// (and hide_listing's 'no-open-report') null, as the sample's; 'own-shop', 'own-request' and 'forbidden' throw Refused,
// which the actions turn into their notice or the 404. Request-time only, never cached.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

// --- Whose it is (decision 5) -------------------------------------------------------------------------------------
// A shop is its owner's through seller_profiles.shop_id (phase A's owns_shop rule; shops.owner_id isn't granted to any
// API role). Owners read their own seller profile, admins every one. A request is the asker's when my_requests holds it.

/** The viewer's own shop's id (a waiting shop's too), or null when they have none. */
export async function ownShopId(client: DbClient, accountId: string): Promise<string | null> {
  const { data, error } = await client.from("seller_profiles").select("shop_id").eq("account_id", accountId).maybeSingle();
  if (error) failed("seller_profiles", error);
  return data?.shop_id ?? null;
}

/** The viewer's own requests' ids, hidden ones included. */
export async function myRequestIds(client: DbClient): Promise<Set<string>> {
  const { data, error } = await client.from("my_requests").select("id");
  if (error) failed("my_requests", error);
  return new Set(data.flatMap((row) => (row.id ? [row.id] : [])));
}

export const ownsShop: typeof Sample.ownsShop = async (accountId, slug) => {
  const client = await forViewerAs(accountId);
  const shopId = await ownShopId(client, accountId);
  if (!shopId) return false;
  const { data, error } = await client.from("shops").select("slug").eq("id", shopId).maybeSingle();
  if (error) failed("shops", error);
  return data?.slug === slug;
};

export const ownsListing: typeof Sample.ownsListing = async (accountId, listingId) => {
  const client = await forViewerAs(accountId);
  const shopId = await ownShopId(client, accountId);
  if (!shopId) return false;
  const { data, error } = await client.from("listings").select("id").eq("id", listingId).eq("shop_id", shopId).maybeSingle();
  if (error) failed("listings", error);
  return data !== null;
};

export const ownsRequest: typeof Sample.ownsRequest = async (accountId, requestId) => {
  const client = await forViewerAs(accountId);
  const { data, error } = await client.from("my_requests").select("id").eq("id", requestId).maybeSingle();
  if (error) failed("my_requests", error);
  return data !== null;
};

// --- Reads ---------------------------------------------------------------------------------------------------------

const PROFILE_COLUMNS =
  "account_id, status, shop_id, applied_at, declined_at, paused_by, seller_paused_too, staff_reason, mentor_id, approved_at";

type ProfileRecord = {
  account_id: string | null;
  status: string | null;
  shop_id: string | null;
  applied_at: string | null;
  declined_at: string | null;
  paused_by: string | null;
  seller_paused_too: boolean | null;
  staff_reason: string | null;
  mentor_id: string | null;
  approved_at: string | null;
};

/** A staff_seller_profiles row as the store's SellerProfileRow, on the shop with link `slug`. */
function profileRowFrom(row: ProfileRecord, slug: string | null): SellerProfileRow {
  const status = row.status as SellerStatus;
  return {
    accountId: row.account_id!,
    status,
    sellerSlug: status === "pending" ? null : slug,
    appliedAt: iso(row.applied_at!),
    declinedAt: iso(row.declined_at),
    pausedBy: row.paused_by as SellerProfileRow["pausedBy"],
    sellerPausedToo: row.seller_paused_too === true,
    staffReason: row.staff_reason,
    mentorId: row.mentor_id,
    approvedAt: iso(row.approved_at),
  };
}

/** First names by account id, a hundred ids a request (an address has a length limit). */
async function firstNames(client: DbClient, ids: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await client.from("profiles").select("id, first_name").in("id", unique.slice(from, from + 100));
    if (error) failed("profiles", error);
    for (const row of data) names.set(row.id, row.first_name);
  }
  return names;
}

/**
 * Shops with their owners and pickup points (in the campuses' order), and the source a review is built over. One shop
 * reads only its own rows; a list reads every seller profile and shop's points.
 */
async function reviewSource(client: DbClient, shops: readonly ShopRecord[]): Promise<{ rows: SellerRow[]; source: ReviewSource }> {
  const one = shops.length === 1 ? shops[0].id : null;
  const [profiles, points, order, snapshot] = await Promise.all([
    selectAll(() => {
      const query = client.from("staff_seller_profiles").select(PROFILE_COLUMNS);
      return one ? query.eq("shop_id", one) : query;
    }, ["account_id"]),
    selectAll(() => {
      const query = client.from("shop_pickup_points").select("shop_id, pickup_point_id");
      return one ? query.eq("shop_id", one) : query;
    }, ["shop_id", "pickup_point_id"]),
    pickupPointRows(),
    catalogSnapshot(),
  ]);
  const people = profiles.flatMap((row) => [row.account_id, row.mentor_id].filter((id): id is string => id !== null));
  const names = await firstNames(client, people);
  const position = new Map(order.map((row, i) => [row.id, i]));
  const pointsOf = new Map<string, string[]>();
  for (const row of points) pointsOf.set(row.shop_id, [...(pointsOf.get(row.shop_id) ?? []), row.pickup_point_id]);
  const profileOf = new Map(profiles.flatMap((row) => (row.shop_id && row.account_id ? [[row.shop_id, row] as const] : [])));

  const rows = shops.map((shop) => {
    const pointIds = (pointsOf.get(shop.id) ?? []).sort(
      (a, b) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity) || a.localeCompare(b),
    );
    return sellerRowFrom(shop, pointIds, { ownerId: profileOf.get(shop.id)?.account_id ?? null });
  });
  const bySlug = new Map(shops.map((shop) => [shop.slug, shop.id]));
  const source: ReviewSource = {
    profileOf(row) {
      const profile = profileOf.get(bySlug.get(row.slug) ?? "");
      return profile ? profileRowFrom(profile, row.slug) : null;
    },
    personOf(accountId) {
      const firstName = accountId ? names.get(accountId) : undefined;
      return accountId && firstName !== undefined ? { id: accountId, firstName } : null;
    },
    listed: listedCountsOf(catalogOver(catalogSourceFrom(snapshot)).listedListings()),
  };
  return { rows, source };
}

async function reviews(client: DbClient, shops: readonly ShopRecord[]) {
  if (shops.length === 0) return [];
  const { rows, source } = await reviewSource(client, shops);
  return rows.map((row) => reviewOver(source, row));
}

export const listShopsForReview: typeof Sample.listShopsForReview = async () => {
  const client = await forViewer();
  const shops = await selectAll(() => client.from("shops").select(SHOP_COLUMNS), ["slug"]);
  return inReviewOrder(await reviews(client, shops));
};

export const getShopForReview: typeof Sample.getShopForReview = async (slug) => {
  const client = await forViewer();
  const { data, error } = await client.from("shops").select(SHOP_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) failed("shops", error);
  return data ? ((await reviews(client, [data]))[0] ?? null) : null;
};

export const countWaitingShops: typeof Sample.countWaitingShops = async () =>
  (await listShopsForReview()).filter((review) => review.standing === "waiting").length;

/** Accounts with the mentor role, by first name, leaving out `exceptOwnerId` (staff read every profile). */
export const listMentors: typeof Sample.listMentors = async (exceptOwnerId = null) => {
  const client = await forViewer();
  const rows = await selectAll(() => client.from("profiles").select("id, first_name").contains("roles", ["mentor"]), ["id"]);
  return rows
    .filter((row) => row.id !== exceptOwnerId)
    .map((row) => ({ id: row.id, firstName: row.first_name }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
};

/** The viewer's own standing with the Hub, from their own seller profile. */
export const shopStanding: typeof Sample.shopStanding = async (accountId) => {
  const client = await forViewerAs(accountId);
  const { data, error } = await client
    .from("seller_profiles")
    .select("status, applied_at, declined_at, paused_by, staff_reason")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) failed("seller_profiles", error);
  if (!data) return null;
  return {
    declinedAt: iso(data.declined_at),
    pausedByHub: data.status === "paused" && data.paused_by === "staff",
    reason: data.staff_reason,
    appliedAt: iso(data.applied_at),
  };
};

// --- Writes --------------------------------------------------------------------------------------------------------

/** A staff function's answer: true when it changed something, false for nothing; a refusal throws (decision 2). */
function changedBy(what: string, answer: { data: unknown; error: { code?: string } | null }, nothing: readonly string[] = []): boolean {
  if (answer.error) failed(what, answer.error);
  const result = answer.data;
  if (result === "changed") return true;
  if (result === "nothing" || nothing.includes(result as string)) return false;
  if (result === "own-shop" || result === "own-request" || result === "forbidden") throw new Refused(result);
  throw new Error(`${what} answered ${String(result)}`);
}

/** A shop's id by its link, as the viewer may read it; null when it's none they can. */
async function shopIdOf(client: DbClient, slug: string): Promise<string | null> {
  const { data, error } = await client.from("shops").select("id").eq("slug", slug).maybeSingle();
  if (error) failed("shops", error);
  return data?.id ?? null;
}

/** A shop's owner: the account whose seller profile names it, or null for a sample shop. */
async function ownerOf(client: DbClient, shopId: string): Promise<string | null> {
  const { data, error } = await client.from("staff_seller_profiles").select("account_id").eq("shop_id", shopId).maybeSingle();
  if (error) failed("staff_seller_profiles", error);
  return data?.account_id ?? null;
}

/** What a decision changed, read back after it: the shop's link, name and owner. */
async function decisionOn(client: DbClient, shopId: string): Promise<Sample.ShopDecision> {
  const [shop, ownerId] = await Promise.all([
    client.from("shops").select("slug, name").eq("id", shopId).single(),
    ownerOf(client, shopId),
  ]);
  if (shop.error) failed("shops", shop.error);
  return { slug: shop.data.slug, name: shop.data.name, ownerId };
}

/**
 * The shop the Hub reviewed is still `ownerId`'s (amendment 14.6): their seller profile names the shop on this link. An
 * admin reads every profile; someone without the role reads none, and the function then answers 'forbidden'. The
 * shop's id, or false when it's another shop now.
 */
async function reviewedShop(client: DbClient, slug: string, ownerId: string): Promise<string | null | false> {
  if (ownerId === "") return false;
  const { data, error } = await client.from("staff_seller_profiles").select("shop_id").eq("account_id", ownerId).maybeSingle();
  if (error) failed("staff_seller_profiles", error);
  if (!data) return null;
  if (!data.shop_id) return false;
  const shop = await client.from("shops").select("id, slug").eq("id", data.shop_id).maybeSingle();
  if (shop.error) failed("shops", shop.error);
  return shop.data?.slug === slug ? shop.data.id : false;
}

export const approveShop: typeof Sample.approveShop = async (slug, ownerId) => {
  const client = await forViewer();
  const shopId = await reviewedShop(client, slug, ownerId);
  if (shopId === false) return null;
  if (!changedBy("approve_shop", await client.rpc("approve_shop", { p_account: ownerId }))) return null;
  return decisionOn(client, shopId ?? (await shopIdOf(client, slug))!);
};

export const declineShop: typeof Sample.declineShop = async (slug, ownerId, reason) => {
  const client = await forViewer();
  const shopId = await reviewedShop(client, slug, ownerId);
  if (shopId === false) return null;
  if (!changedBy("decline_shop", await client.rpc("decline_shop", { p_account: ownerId, p_reason: reason }))) return null;
  return decisionOn(client, shopId ?? (await shopIdOf(client, slug))!);
};

/** Send for approval again: the seller's own (resend_for_approval reads who from the session). */
export const resendForApproval: typeof Sample.resendForApproval = async (accountId) => {
  const client = await forViewerAs(accountId);
  return changedBy("resend_for_approval", await client.rpc("resend_for_approval"));
};

export const setVerified: typeof Sample.setVerified = async (slug, verified) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, slug);
  if (!shopId) return null;
  if (!changedBy("set_shop_verified", await client.rpc("set_shop_verified", { p_shop: shopId, p_verified: verified }))) {
    return null;
  }
  return decisionOn(client, shopId);
};

export const staffPauseShop: typeof Sample.staffPauseShop = async (slug, reason) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, slug);
  if (!shopId) return null;
  if (!changedBy("staff_pause_shop", await client.rpc("staff_pause_shop", { p_shop: shopId, p_reason: reason }))) return null;
  return decisionOn(client, shopId);
};

/** The Hub's Resume; the seller's own pause, if they had made one, is back (read from the profile after). */
export const staffResumeShop: typeof Sample.staffResumeShop = async (slug) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, slug);
  if (!shopId) return null;
  if (!changedBy("staff_resume_shop", await client.rpc("staff_resume_shop", { p_shop: shopId }))) return null;
  const profile = await client.from("staff_seller_profiles").select("status").eq("shop_id", shopId).single();
  if (profile.error) failed("staff_seller_profiles", profile.error);
  return { ...(await decisionOn(client, shopId)), stillPausedBySeller: profile.data.status === "paused" };
};

export const setShopMentor: typeof Sample.setShopMentor = async (slug, mentorId) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, slug);
  if (!shopId) return null;
  const answer = await client.rpc("set_shop_mentor", { p_shop: shopId, p_mentor: mentorId as string });
  if (!changedBy("set_shop_mentor", answer)) return null;
  let mentorName: string | null = null;
  if (mentorId) {
    const mentor = await client.from("profiles").select("first_name").eq("id", mentorId).single();
    if (mentor.error) failed("profiles", mentor.error);
    mentorName = mentor.data.first_name;
  }
  return { ...(await decisionOn(client, shopId)), mentorName };
};

/** A listing as hide and show give it back: an admin reads every listing, hidden ones included. */
async function listingOn(client: DbClient, id: string) {
  const { data, error } = await client.from("listings").select("id, title, state, shop_id").eq("id", id).single();
  if (error) failed("listings", error);
  const [shop, ownerId] = await Promise.all([
    client.from("shops").select("slug").eq("id", data.shop_id).single(),
    ownerOf(client, data.shop_id),
  ]);
  if (shop.error) failed("shops", shop.error);
  return { id: data.id, title: data.title, sellerSlug: shop.data.slug, state: data.state as ListingState, ownerId };
}

/** Hide the listing: hide_listing needs an open report on it ('no-open-report' is null, decision 2). */
export const hideListing: typeof Sample.hideListing = async (id, reason) => {
  const client = await forViewer();
  const answer = await client.rpc("hide_listing", { p_listing: id, p_reason: reason });
  if (!changedBy("hide_listing", answer, ["no-open-report"])) return null;
  return listingOn(client, id);
};

export const showListing: typeof Sample.showListing = async (id) => {
  const client = await forViewer();
  if (!changedBy("show_listing", await client.rpc("show_listing", { p_listing: id }))) return null;
  const shown = await listingOn(client, id);
  return { id: shown.id, title: shown.title, state: shown.state, ownerId: shown.ownerId };
};
