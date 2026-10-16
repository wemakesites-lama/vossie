import { categories } from "@/data/fixtures/categories";
import { sampleListingRows, sampleSellerRows, sampleShopOwners } from "@/data/fixtures/shops";
import { nameKey, SLUG_MAX, slugify } from "@/lib/selling/rules";
import { sastDate } from "@/lib/time";
import type { Condition, Handover, ImageRef, ListingKind, ListingState, PayMode, SellerStatus } from "@/lib/types";
import { claimPhotosNow, deletePhotosOf, deletePhotosUsedByNow } from "./photos";
import { pickupPointName } from "./pickup-points";
import type { ListingRow, OnboardingDraftRow, SellerRow } from "./rows";
import { sampleStore } from "./store";

// A seller's own shop (selling spec 2.6 to 2.8 and 2.11): applying, editing, pausing, the one change of link, the
// wizard's draft, and what deleting an account removes. Status lives on the owner's seller profile (plan decision 1).
// Only Server Actions change anything; pages only read. Times come from the caller.

export type OwnShop = { shop: SellerRow; status: SellerStatus };

/**
 * The account's shop row itself (not a copy) and its status, read with no await, so a writer that changes the row in
 * the same synchronous run can't act on a copy another post has made stale (two posts at once, such as a double click).
 */
function liveShopOf(accountId: string): { row: SellerRow; status: SellerStatus } | null {
  const store = sampleStore();
  const profile = store.sellerProfiles.get(accountId);
  if (!profile) return null;
  for (const row of store.sellers.values()) {
    if (row.ownerId === accountId) return { row, status: profile.status };
  }
  return null;
}

/** The account's shop and its status, or null when it has none. */
export async function getShopOf(accountId: string): Promise<OwnShop | null> {
  const own = liveShopOf(accountId);
  return own ? { shop: structuredClone(own.row), status: own.status } : null;
}

/** Whether another shop on `campusSlug` has this name (plan decision 16). `exceptSlug` is the shop being edited. */
export async function isShopNameTaken(name: string, campusSlug: string, exceptSlug: string | null): Promise<boolean> {
  return nameTakenNow(name, campusSlug, exceptSlug === null ? null : (sampleStore().sellers.get(exceptSlug) ?? null));
}

/** isShopNameTaken with no await, for a writer's last check before it writes. `except` is the shop being edited. */
function nameTakenNow(name: string, campusSlug: string, except: SellerRow | null): boolean {
  const key = nameKey(name);
  for (const row of sampleStore().sellers.values()) {
    if (row !== except && row.campusSlug === campusSlug && nameKey(row.name) === key) return true;
  }
  return false;
}

/**
 * Whether a shop has this link, or had it where buyers could see it (plan decision 16). A link an approved or paused
 * shop has left, by its one change or by being deleted, is retired for good: buyers' saved links, conversations and
 * reports may still name it, so it must 404 rather than land on another shop and pick up that shop's history.
 */
function slugInUse(slug: string): boolean {
  const { sellers, retiredSlugs } = sampleStore();
  return sellers.has(slug) || retiredSlugs.has(slug);
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  return slugInUse(slug);
}

/** A link no shop has or had, from `base`: "crochet-corner", then "crochet-corner-2" and so on. `own` keeps its own. */
function freeSlug(base: string, own: string | null): string {
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "" : `-${n}`;
    const slug = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (slug === own || !slugInUse(slug)) return slug;
  }
}

/** Moves a shop to a new link, and everything that names it by its link with it (plan decision 16). */
function moveShop(from: string, to: string): void {
  const store = sampleStore();
  const row = store.sellers.get(from);
  if (!row || from === to) return;
  store.sellers.delete(from);
  row.slug = to;
  store.sellers.set(to, row);
  for (const listing of store.listings.values()) {
    if (listing.sellerSlug === from) listing.sellerSlug = to;
  }
  for (const profile of store.sellerProfiles.values()) {
    if (profile.sellerSlug === from) profile.sellerSlug = to;
  }
  // Messaging names the shop by its link (messaging plan decision 1), so its conversations and reports move too.
  for (const conversation of store.conversations.values()) {
    if (conversation.sellerSlug === from) conversation.sellerSlug = to;
  }
  for (const report of store.reports.values()) {
    if (report.targetKind === "seller" && report.targetId === from) report.targetId = to;
  }
  // Featured names the shop by its link too (staff tools plan amendment 11). The audit log keeps the old link: it's
  // the record of what happened, and links are never reused.
  for (const pin of store.featuredPins.values()) {
    if (pin.sellerSlug === from) pin.sellerSlug = to;
  }
  for (const draw of store.featuredDraws.values()) {
    draw.sellerSlugs = draw.sellerSlugs.map((slug) => (slug === from ? to : slug));
  }
}

/** What the wizard sets (selling spec 2.6). */
export type ShopDetails = {
  name: string;
  tagline: string;
  categorySlug: string;
  about: string;
  /** A stored photo, or null for the category's picture. */
  image: ImageRef | null;
  campusSlug: string;
  pickupPointIds: string[];
};

/**
 * Edit shop's photo: keep the one the shop has when the edit saves (which another post may have changed since the form
 * was read), remove it, or a photo just stored for this edit.
 */
export type ShopPhotoEdit = "keep" | "remove" | ImageRef;

/** What Edit shop sets (selling spec 2.11). */
export type ShopEdit = Omit<ShopDetails, "image"> & {
  image: ShopPhotoEdit;
  /** The one change of link (an approved or paused shop's), or null to leave the link as it is. */
  slug: string | null;
};

/** A shop write's outcome: the shop as saved, or why nothing was saved. */
export type ShopWrite<E extends string> = { shop: SellerRow; error: null } | { shop: null; error: E };

export type ShopEditError = "name-taken" | "slug-used" | "slug-taken";

/**
 * Sends an application (selling spec 2.6 and 2.7): a new shop with a link made from its name, and a seller profile
 * waiting for the Hub, with no storefront yet (plan decision 1). The draft goes, and its photo becomes the shop's.
 * "name-taken" when another shop on the campus has the name by now; null when the account already has a shop.
 * From the checks to the last write there's no await, so a post at the same time can't come between (amendment 15).
 */
export async function createShop(
  accountId: string,
  details: ShopDetails,
  now: Date,
): Promise<ShopWrite<"name-taken"> | null> {
  const store = sampleStore();
  if (store.sellerProfiles.has(accountId)) return null;
  if (nameTakenNow(details.name, details.campusSlug, null)) return { shop: null, error: "name-taken" };
  const photo = details.image;
  const image = photo && claimPhotosNow(accountId, [photo.src], "shop").has(photo.src) ? { ...photo } : null;
  const at = now.toISOString();
  const row: SellerRow = {
    slug: freeSlug(slugify(details.name), null),
    ownerId: accountId,
    name: details.name,
    tagline: details.tagline,
    categorySlug: details.categorySlug,
    campusSlug: details.campusSlug,
    verified: false,
    badge: "new-seller",
    about: details.about,
    since: sastDate(now).slice(0, 7),
    image,
    pickupPointIds: [...details.pickupPointIds],
    slugChanged: false,
    createdAt: at,
    updatedAt: at,
  };
  store.sellers.set(row.slug, row);
  store.sellerProfiles.set(accountId, { accountId, status: "pending", sellerSlug: null, appliedAt: at });
  store.onboardingDrafts.delete(accountId);
  deletePhotosUsedByNow(accountId, "draft");
  return { shop: structuredClone(row), error: null };
}

/**
 * Edit shop (selling spec 2.11), and with it an approved or paused shop's one change of link. While the shop waits
 * for approval its link follows its name, and a link asked for is ignored (plan decision 16). Its listings follow its
 * campus, and a pickup whose point it no longer uses moves to its first point, or online when it has none (plan
 * decision 17). A replaced or removed photo is deleted, and the shop keeps no photo it doesn't show.
 *
 * Nothing is saved when another shop on the campus has the name by now ("name-taken"), or the link can't change
 * ("slug-used", "slug-taken"); a link that is already the one asked for (a double click) isn't a change. From reading
 * the row to the last write there's no await, so a post at the same time (a double click, another tab, another
 * seller) can't come between this one's checks and its writes (amendment 15). Null when the account has no shop.
 */
export async function updateShop(
  accountId: string,
  edit: ShopEdit,
  now: Date,
): Promise<ShopWrite<ShopEditError> | null> {
  const store = sampleStore();
  const own = liveShopOf(accountId);
  if (!own) return null;
  const { row, status } = own;
  if (nameTakenNow(edit.name, edit.campusSlug, row)) return { shop: null, error: "name-taken" };
  const slug = status === "pending" ? null : edit.slug;
  const change = slug === null ? "same" : linkChange(row, slug);
  if (change === "used") return { shop: null, error: "slug-used" };
  if (change === "taken") return { shop: null, error: "slug-taken" };
  // The new photo is claimed first; the shop's others are deleted after, keeping only the one it shows.
  const photo = edit.image;
  if (photo === "remove") row.image = null;
  else if (photo !== "keep" && claimPhotosNow(accountId, [photo.src], "shop").has(photo.src)) row.image = { ...photo };
  deletePhotosUsedByNow(accountId, "shop", new Set(row.image ? [row.image.src] : []));
  row.name = edit.name;
  row.tagline = edit.tagline;
  row.categorySlug = edit.categorySlug;
  row.about = edit.about;
  row.campusSlug = edit.campusSlug;
  row.pickupPointIds = [...edit.pickupPointIds];
  row.updatedAt = now.toISOString();
  if (slug !== null && change === "free") spendLinkChange(row, slug);
  if (status === "pending") moveShop(row.slug, freeSlug(slugify(row.name), row.slug));
  for (const listing of store.listings.values()) {
    if (listing.sellerSlug !== row.slug) continue;
    listing.campusSlug = row.campusSlug;
    if (listing.handover === "pickup" && !row.pickupPointIds.includes(listing.pickupPointId ?? "")) {
      listing.pickupPointId = row.pickupPointIds[0] ?? null;
      if (listing.pickupPointId === null) listing.handover = "online";
    }
  }
  return { shop: structuredClone(row), error: null };
}

export type SlugChange = "changed" | "same" | "used" | "taken";

/** Whether an approved or paused shop's link can become `slug`: "free" when it can. */
function linkChange(row: SellerRow, slug: string): Exclude<SlugChange, "changed"> | "free" {
  if (row.slug === slug) return "same";
  if (row.slugChanged) return "used";
  return slugInUse(slug) ? "taken" : "free";
}

/** The one change of link: the shop moves, and its old link is retired (plan decision 16). */
function spendLinkChange(row: SellerRow, slug: string): void {
  const from = row.slug;
  moveShop(from, slug);
  sampleStore().retiredSlugs.add(from);
  row.slugChanged = true;
}

/**
 * The seller's one change of link (selling spec 2.11), for an approved or paused shop. Old links then 404. Null when
 * the account has no shop, or its shop is still waiting (its link follows its name).
 */
export async function changeShopSlug(accountId: string, slug: string, now: Date): Promise<SlugChange | null> {
  const own = liveShopOf(accountId);
  if (!own || own.status === "pending") return null;
  const { row } = own;
  const change = linkChange(row, slug);
  if (change !== "free") return change;
  spendLinkChange(row, slug);
  row.updatedAt = now.toISOString();
  return "changed";
}

/**
 * Pause my shop and Resume (selling spec 2.8): approved to paused and back. The seller's own pause is marked as theirs;
 * a pause the Hub made is the Hub's to undo, so the seller can't resume it (staff tools plan decision 3). The new
 * status, or null when it can't change, or when the account has no shop. Read and written with no await between, so
 * two presses at once change it once (staff tools plan amendment 19).
 */
export async function setShopPaused(accountId: string, paused: boolean): Promise<SellerStatus | null> {
  const own = liveShopOf(accountId);
  const profile = sampleStore().sellerProfiles.get(accountId);
  if (!own || !profile || profile.status !== (paused ? "approved" : "paused")) return null;
  if (!paused && profile.pausedBy === "staff") return null;
  profile.status = paused ? "paused" : "approved";
  profile.pausedBy = paused ? "seller" : null;
  profile.sellerPauseHeld = null;
  return profile.status;
}

/** A wizard with nothing answered yet, on the account's campus. */
export function emptyDraft(accountId: string, campusSlug: string, now: Date): OnboardingDraftRow {
  return {
    accountId,
    name: "",
    tagline: "",
    categorySlug: "",
    about: "",
    photoSrc: null,
    campusSlug,
    pickupPointIds: [],
    updatedAt: now.toISOString(),
  };
}

export async function getOnboardingDraft(accountId: string): Promise<OnboardingDraftRow | null> {
  const row = sampleStore().onboardingDrafts.get(accountId);
  return row ? structuredClone(row) : null;
}

/**
 * Saves the wizard's answers (selling spec 2.2). Its photo becomes the draft's, and one it no longer uses goes: claimed
 * first, then the others deleted, with no await between, so two posts at once (a double click) leave one (amendment 15).
 */
export async function saveOnboardingDraft(draft: OnboardingDraftRow): Promise<void> {
  sampleStore().onboardingDrafts.set(draft.accountId, structuredClone(draft));
  if (draft.photoSrc) claimPhotosNow(draft.accountId, [draft.photoSrc], "draft");
  deletePhotosUsedByNow(draft.accountId, "draft", new Set(draft.photoSrc ? [draft.photoSrc] : []));
}

/**
 * Deleting an account (plan decision 22): its shop, the shop's listings, every photo it uploaded and its wizard
 * draft. True when it had a shop. Its seller profile goes with the account (D), after this; its conversations stay
 * for the buyers, with each listing's title (messaging plan decision 14). A shop buyers could see retires its link
 * (plan decision 16); a waiting shop's link was never public, so it's free again.
 */
export async function forgetShopOf(accountId: string): Promise<boolean> {
  const store = sampleStore();
  const waiting = store.sellerProfiles.get(accountId)?.status === "pending";
  let hadShop = false;
  for (const [slug, row] of store.sellers) {
    if (row.ownerId !== accountId) continue;
    hadShop = true;
    store.sellers.delete(slug);
    if (!waiting) store.retiredSlugs.add(slug);
    for (const [id, listing] of store.listings) {
      if (listing.sellerSlug === slug) store.listings.delete(id);
    }
  }
  store.onboardingDrafts.delete(accountId);
  await deletePhotosOf(accountId);
  return hadShop;
}

/**
 * Brings a sample account's shop and its sample listings back from the fixtures, once deleted (D's plan decision 15:
 * a sample account's button puts it back). An approved shop gets its own link back: deleting it retired the link, so
 * no other shop can have taken it. A waiting shop's link was freed, so when another shop has it by now, it takes the
 * next free one, as a waiting shop's link follows its name anyway (plan decision 16). True when it did.
 */
export async function restoreSampleShop(accountId: string): Promise<boolean> {
  const store = sampleStore();
  if ([...store.sellers.values()].some((row) => row.ownerId === accountId)) return false;
  let restored = false;
  for (const [seedSlug, owner] of sampleShopOwners) {
    const seed = sampleSellerRows.find((row) => row.slug === seedSlug);
    if (owner !== accountId || !seed) continue;
    const slug = store.sellers.has(seedSlug) ? freeSlug(seedSlug, null) : seedSlug;
    store.sellers.set(slug, { ...structuredClone(seed), slug });
    store.retiredSlugs.delete(slug);
    // The profile's storefront always names the shop's own link, never another shop's.
    const profile = store.sellerProfiles.get(accountId);
    if (profile?.sellerSlug) profile.sellerSlug = slug;
    for (const listing of sampleListingRows) {
      if (listing.sellerSlug === seedSlug && !store.listings.has(listing.id)) {
        store.listings.set(listing.id, { ...structuredClone(listing), sellerSlug: slug });
      }
    }
    restored = true;
  }
  return restored;
}

/** The shop in the account's data export (plan decision 22): pickup points by name, the photo by its address, no ids. */
export type ShopExport = {
  name: string;
  link: string;
  status: SellerStatus;
  tagline: string;
  category: string;
  campus: string;
  about: string;
  photo: string | null;
  pickupPoints: string[];
  since: string;
  createdAt: string;
};

export type ListingExport = {
  title: string;
  state: ListingState;
  kind: ListingKind;
  category: string;
  condition: Condition | null;
  priceZar: number | null;
  priceIsFrom: boolean;
  payMode: PayMode;
  swapFor: string | null;
  description: string;
  handover: Handover;
  pickupPoint: string | null;
  campus: string;
  /** Each photo's address (a placeholder's, or /photos/… to download it) and description ("" means the title). */
  photos: { address: string; description: string }[];
  createdAt: string;
  updatedAt: string;
};

// Retired points keep their names in the export (staff tools plan decision 10).
const spotName = (id: string | null) => pickupPointName(id);
const categoryName = (slug: string) => categories.find((category) => category.slug === slug)?.name ?? slug;

function listingExport(row: ListingRow): ListingExport {
  return {
    title: row.title,
    state: row.state,
    kind: row.kind,
    category: categoryName(row.categorySlug),
    condition: row.condition,
    priceZar: row.priceZar,
    priceIsFrom: row.priceIsFrom,
    payMode: row.payMode,
    swapFor: row.swapFor,
    description: row.description,
    handover: row.handover,
    pickupPoint: spotName(row.pickupPointId),
    campus: row.campusSlug,
    photos: row.photos.map((photo) => ({ address: photo.src, description: photo.alt })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The account's shop and listings, most recently changed first, for the data export. */
export async function exportShop(accountId: string): Promise<{ shop: ShopExport | null; listings: ListingExport[] }> {
  const own = await getShopOf(accountId);
  if (!own) return { shop: null, listings: [] };
  const { shop, status } = own;
  const listings = [...sampleStore().listings.values()]
    .filter((row) => row.sellerSlug === shop.slug)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    shop: {
      name: shop.name,
      link: shop.slug,
      status,
      tagline: shop.tagline,
      category: categoryName(shop.categorySlug),
      campus: shop.campusSlug,
      about: shop.about,
      photo: shop.image?.src ?? null,
      pickupPoints: shop.pickupPointIds.flatMap((id) => spotName(id) ?? []),
      since: shop.since,
      createdAt: shop.createdAt,
    },
    listings: listings.map(listingExport),
  };
}
