import "server-only";
import { Refused, type RefusalCode } from "../refused";
import type { OnboardingDraftRow } from "../rows";
import type * as Sample from "../shops";
import { categoryName, draftExport, listingExport, type SpotName } from "../shops";
import { forViewer, type DbClient } from "./clients";
import { SHOP_COLUMNS, sellerRowFrom } from "./catalog";
import { listOwnListings } from "./own-listings";
import { dbPhotoId, removePhotoFiles } from "./photos";
import { pickupPointRows } from "./pickup-points";
import { iso } from "./rows";
import { forViewerAs } from "./viewer";

// A seller's own shop on Supabase (C2/C3 plan Task 8; decisions 6 to 8 and 21). Every read and write is the owner's,
// through their own client (forViewerAs: the account id is checked against the session, decision 2), never cached
// (decision 4):
// - the shop: seller_profiles (status, shop, who paused it, when the Hub approved it), shops by id (the owner reads
//   their own in any status), its pickup points, and my_previous_shop_slugs() for the links it left;
// - the name and link checks: shop_name_taken and shop_slug_taken, which see the shops RLS hides (waiting, declined,
//   Hub-paused) and answer only true or false;
// - the writes: create_shop, update_shop (then change_shop_slug, as the sample's two calls), set_shop_paused and
//   save_onboarding_draft. The files they no longer need (removed_paths) go through removePhotoFiles.
// A refusal only a race can produce, after the action's own checks passed, throws Refused (decision 3); createShop's
// return null, which the action turns into send-failed. Deleting an account is forget_account's (phase B), so
// forgetShopOf throws, and sample mode is off on Supabase, so restoreSampleShop is false (decision 21).

const PROFILE_COLUMNS = "status, shop_id, paused_by, approved_at";
const DRAFT_COLUMNS = "account_id, name, tagline, category_slug, about, photo_id, campus_slug, pickup_point_ids, updated_at";
const PHOTO_PREFIX = "/photos/";

/** The race refusals update_shop answers after the action's own checks passed (decision 6). */
const UPDATE_REFUSALS: readonly RefusalCode[] = ["name-taken", "slug-taken", "points-invalid", "photo-invalid"];

/** The generated types say string where SQL takes null too (a uuid argument with no default). */
const orNull = (value: string | null) => value as string;

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

type Own = Awaited<ReturnType<typeof Sample.getShopOf>> & { approvedAt: string | null; shopId: string };

/** The ids of the pickup points, in the campuses' order (the store's and the forms'). */
async function inPointOrder(ids: readonly string[]): Promise<string[]> {
  const order = new Map((await pickupPointRows()).map((row, i) => [row.id, i]));
  return [...ids].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || a.localeCompare(b));
}

/** The owner's shop as the viewer reads it, or null when they have none. */
async function readOwn(db: DbClient, accountId: string): Promise<Own | null> {
  const profile = await db.from("seller_profiles").select(PROFILE_COLUMNS).eq("account_id", accountId).maybeSingle();
  if (profile.error) failed("seller_profiles", profile.error);
  const shopId = profile.data?.shop_id;
  if (!profile.data || !shopId) return null;
  const [shop, points, previous] = await Promise.all([
    db.from("shops").select(SHOP_COLUMNS).eq("id", shopId).maybeSingle(),
    db.from("shop_pickup_points").select("pickup_point_id").eq("shop_id", shopId),
    db.rpc("my_previous_shop_slugs"),
  ]);
  if (shop.error) failed("shops", shop.error);
  if (points.error) failed("shop_pickup_points", points.error);
  if (previous.error) failed("my_previous_shop_slugs", previous.error);
  if (!shop.data) return null;
  const pointIds = await inPointOrder(points.data.map((row) => row.pickup_point_id));
  return {
    shop: sellerRowFrom(shop.data, pointIds, { ownerId: accountId, previousSlugs: previous.data }),
    status: profile.data.status as Own["status"],
    pausedByHub: profile.data.paused_by === "staff",
    approvedAt: iso(profile.data.approved_at),
    shopId,
  };
}

/** The signed-in account's shop id and link, or null: what the own-listings twin checks a link against. */
export async function viewerShop(db: DbClient, accountId: string): Promise<{ id: string; slug: string } | null> {
  const profile = await db.from("seller_profiles").select("shop_id").eq("account_id", accountId).maybeSingle();
  if (profile.error) failed("seller_profiles", profile.error);
  if (!profile.data?.shop_id) return null;
  const shop = await db.from("shops").select("id, slug").eq("id", profile.data.shop_id).maybeSingle();
  if (shop.error) failed("shops", shop.error);
  return shop.data;
}

export const getShopOf: typeof Sample.getShopOf = async (accountId) => {
  const own = await readOwn(await forViewerAs(accountId), accountId);
  return own ? { shop: own.shop, status: own.status, pausedByHub: own.pausedByHub } : null;
};

export const isShopNameTaken: typeof Sample.isShopNameTaken = async (name, campusSlug, exceptSlug) => {
  const { data, error } = await (await forViewer()).rpc("shop_name_taken", {
    p_name: name,
    p_campus_slug: campusSlug,
    p_except_slug: exceptSlug ?? undefined,
  });
  if (error) failed("shop_name_taken", error);
  return data;
};

export const isSlugTaken: typeof Sample.isSlugTaken = async (slug) => {
  const { data, error } = await (await forViewer()).rpc("shop_slug_taken", { p_slug: slug });
  if (error) failed("shop_slug_taken", error);
  return data;
};

/** A shop's photo as the database takes it: a stored photo's uuid, or null (none, a placeholder, or not a real one). */
const photoIdIn = (details: { image: { src: string } | null }) => (details.image ? dbPhotoId(details.image.src) : null);

export const createShop: typeof Sample.createShop = async (accountId, details) => {
  const db = await forViewerAs(accountId);
  const { data, error } = await db.rpc("create_shop", {
    p_name: details.name,
    p_tagline: details.tagline,
    p_category_slug: details.categorySlug,
    p_about: details.about,
    p_photo_id: orNull(photoIdIn(details)),
    p_campus_slug: details.campusSlug,
    p_pickup_point_ids: details.pickupPointIds,
  });
  if (error) failed("create_shop", error);
  const answer = data as { result: string; removed_paths?: string[] };
  if (answer.result !== "created") return null;
  await removePhotoFiles(answer.removed_paths ?? []);
  return (await readOwn(db, accountId))?.shop ?? null;
};

export const updateShop: typeof Sample.updateShop = async (accountId, details) => {
  const db = await forViewerAs(accountId);
  const photoId = photoIdIn(details);
  // A placeholder (a sample shop's picture) sends neither a photo nor a removal, so the shop keeps it.
  const { data, error } = await db.rpc("update_shop", {
    p_name: details.name,
    p_tagline: details.tagline,
    p_category_slug: details.categorySlug,
    p_about: details.about,
    p_campus_slug: details.campusSlug,
    p_pickup_point_ids: details.pickupPointIds,
    p_photo_id: photoId ?? undefined,
    p_remove_photo: details.image === null,
    p_slug: undefined,
  });
  if (error) failed("update_shop", error);
  const answer = data as { result: string; removed_paths?: string[] };
  if (answer.result === "no-shop") return null;
  if (answer.result !== "saved") {
    if ((UPDATE_REFUSALS as readonly string[]).includes(answer.result)) throw new Refused(answer.result as RefusalCode);
    throw new Error(`update_shop answered ${answer.result}`);
  }
  await removePhotoFiles(answer.removed_paths ?? []);
  return (await readOwn(db, accountId))?.shop ?? null;
};

export const changeShopSlug: typeof Sample.changeShopSlug = async (accountId, slug) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("change_shop_slug", { p_slug: slug });
  if (error) failed("change_shop_slug", error);
  if (data === "not-allowed") return null;
  if (data === "changed" || data === "same" || data === "used" || data === "taken") return data;
  throw new Error(`change_shop_slug answered ${data}`);
};

export const setShopPaused: typeof Sample.setShopPaused = async (accountId, paused) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("set_shop_paused", { p_paused: paused });
  if (error) failed("set_shop_paused", error);
  if (data === "paused" || data === "approved") return data;
  return null;
};

export const getOnboardingDraft: typeof Sample.getOnboardingDraft = async (accountId) => {
  const { data, error } = await (await forViewerAs(accountId))
    .from("onboarding_drafts")
    .select(DRAFT_COLUMNS)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) failed("onboarding_drafts", error);
  if (!data) return null;
  const draft: OnboardingDraftRow = {
    accountId: data.account_id,
    name: data.name,
    tagline: data.tagline,
    categorySlug: data.category_slug ?? "",
    about: data.about,
    photoSrc: data.photo_id ? `${PHOTO_PREFIX}${data.photo_id}` : null,
    campusSlug: data.campus_slug ?? "",
    pickupPointIds: [...data.pickup_point_ids],
    updatedAt: iso(data.updated_at),
  };
  return draft;
};

export const saveOnboardingDraft: typeof Sample.saveOnboardingDraft = async (draft) => {
  const db = await forViewerAs(draft.accountId);
  const save = async (photoId: string | null) => {
    const { data, error } = await db.rpc("save_onboarding_draft", {
      p_name: draft.name,
      p_tagline: draft.tagline,
      p_category_slug: draft.categorySlug,
      p_about: draft.about,
      p_photo_id: orNull(photoId),
      p_campus_slug: draft.campusSlug,
      p_pickup_point_ids: draft.pickupPointIds,
    });
    if (error) failed("save_onboarding_draft", error);
    return data as { result: string; removed_paths?: string[] };
  };
  const photoId = draft.photoSrc ? dbPhotoId(draft.photoSrc) : null;
  let answer = await save(photoId);
  // A waiting photo that ran out (a day old) is gone: the draft is saved without it, never with a dead address.
  if (answer.result === "photo-invalid") answer = await save(null);
  await removePhotoFiles(answer.removed_paths ?? []);
};

export const forgetShopOf: typeof Sample.forgetShopOf = async () => {
  throw new Error("forgetShopOf runs in the database on Supabase");
};

export const restoreSampleShop: typeof Sample.restoreSampleShop = async () => false;

export const exportShop: typeof Sample.exportShop = async (accountId) => {
  const db = await forViewerAs(accountId);
  const names = new Map((await pickupPointRows()).map((row) => [row.id, row.name]));
  const spot: SpotName = (id) => (id ? (names.get(id) ?? null) : null);
  const [draft, own] = await Promise.all([getOnboardingDraft(accountId), readOwn(db, accountId)]);
  const onboardingDraft = draft ? draftExport(draft, spot) : null;
  if (!own) return { shop: null, listings: [], onboardingDraft };
  const { shop, status } = own;
  const listings = await listOwnListings(shop.slug);
  return {
    shop: {
      name: shop.name,
      link: shop.slug,
      previousLinks: shop.previousSlugs.map((slug) => `/sellers/${slug}`),
      status,
      approvedAt: own.approvedAt,
      tagline: shop.tagline,
      category: categoryName(shop.categorySlug),
      campus: shop.campusSlug,
      about: shop.about,
      photo: shop.image?.src ?? null,
      pickupPoints: shop.pickupPointIds.flatMap((id) => spot(id) ?? []),
      since: shop.since,
      createdAt: shop.createdAt,
    },
    listings: listings.map((row) => listingExport(row, spot)),
    onboardingDraft,
  };
};
