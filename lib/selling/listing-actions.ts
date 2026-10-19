"use server";

import { redirect } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { getCategories, getPickupPoints } from "@/lib/data";
import { notifyFollowers } from "@/lib/data/follows";
import {
  deleteOwnListing,
  getOwnListing,
  isFirstPublish,
  saveOwnListing,
  setOwnListingState,
} from "@/lib/data/own-listings";
import { photoSrcsOf, storePhotos, type Upload } from "@/lib/data/photos";
import { shopStanding } from "@/lib/data/staff-shops";
import { listingsChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { characterCount, keepTyped } from "@/lib/messaging/rules";
import { PHOTOS_PER_LISTING } from "@/lib/photos/rules";
import { done, field, fieldList, fileList } from "./action-helpers";
import { listingFieldPrefix } from "./errors";
import {
  clearForm,
  leaveListingToken,
  listingForm,
  MY_LISTINGS_FORM,
  sentListing,
  takeListingToken,
  type ListingSent,
} from "./form-state";
import { requireShopOwner, type ShopOwner } from "./owner";
import { editListingPath, myListingsPath, NEW_LISTING_PATH, parseListingsTab, tabFor } from "./paths";
import { applyPhotoMove, parsePhotoMove, photoOrder, resolveToken } from "./photo-order";
import {
  ALT_MAX,
  checkListing,
  cleanLine,
  CONDITION_CHOICES,
  HANDOVER_CHOICES,
  KIND_CHOICES,
  PAY_CHOICES,
  type ListingContext,
  type ListingInput,
} from "./rules";
import { readUploads } from "./uploads";

// The listing Server Actions (selling spec 2.9 and 2.10): the listing form's save and photo buttons, My listings'
// row buttons, and Delete listing. Identity comes only from the session, and every listing id from a form is looked
// up among the signed-in seller's own listings. Each ends with done(), after listingsChanged() when what buyers see
// changed (plan decision 6).

/**
 * The notice for a listing that was saved, resumed or relisted while the shop is paused, since buyers won't see it yet,
 * or null when the shop isn't paused. When the Hub paused the shop, the Hub resumes it, so the seller isn't told they
 * will (staff tools plan decision 3).
 */
async function pausedShopNotice(owner: ShopOwner): Promise<"saved-shop-paused" | "saved-shop-hub-paused" | null> {
  if (owner.status !== "paused") return null;
  return (await shopStanding(owner.account.id))?.pausedByHub ? "saved-shop-hub-paused" : "saved-shop-paused";
}

function listingInput(formData: FormData): ListingInput {
  return {
    kind: field(formData, "kind"),
    title: field(formData, "title"),
    categorySlug: field(formData, "category"),
    condition: field(formData, "condition"),
    price: field(formData, "price"),
    free: field(formData, "free") === "yes",
    priceIsFrom: field(formData, "from") === "yes",
    payMode: field(formData, "payMode"),
    swapFor: field(formData, "swapFor"),
    description: field(formData, "description"),
    handover: field(formData, "handover"),
    pickupPointId: field(formData, "pickup"),
  };
}

const valuesOf = (choices: ReadonlyArray<{ value: string }>) => choices.map((choice) => choice.value);
const KINDS = valuesOf(KIND_CHOICES);
const CONDITIONS = valuesOf(CONDITION_CHOICES);
const PAY_MODES = valuesOf(PAY_CHOICES);
const HANDOVERS = valuesOf(HANDOVER_CHOICES);

/** A choice field's posted value when it is one of its choices, else nothing: form state holds no stranger's text. */
const known = (raw: string, choices: readonly string[]) => (choices.includes(raw) ? raw : "");

/**
 * What the form shows again after a failed save or a photo button (plan decision 9): all that was typed, the photos
 * in order, and each one's description. Form state keeps only bounded values (amendment 10.2): typed text is cut at
 * `keepTyped`'s limit, and a choice field is kept only when it is one of its known choices.
 */
function typedValues(
  formData: FormData,
  order: readonly string[],
  alts: ReadonlyMap<string, string>,
  context: ListingContext,
): Record<string, string> {
  const values: Record<string, string> = {
    kind: known(field(formData, "kind"), KINDS),
    title: keepTyped(field(formData, "title")),
    category: known(field(formData, "category"), context.categorySlugs),
    condition: known(field(formData, "condition"), CONDITIONS),
    price: keepTyped(field(formData, "price")),
    free: known(field(formData, "free"), ["yes"]),
    from: known(field(formData, "from"), ["yes"]),
    payMode: known(field(formData, "payMode"), PAY_MODES),
    swapFor: keepTyped(field(formData, "swapFor")),
    description: keepTyped(field(formData, "description")),
    handover: known(field(formData, "handover"), HANDOVERS),
    pickup: known(field(formData, "pickup"), context.pickupPointIds),
    photos: order.join("\n"),
  };
  for (const src of order) values[`alt:${src}`] = keepTyped(alts.get(src) ?? "");
  return values;
}

/** A new listing's form sent again (amendment 14.1): back to where the first send went, with the notice it left. */
async function sentAgain(sent: ListingSent, now: Date): Promise<never> {
  await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: sent.listing }, notice: sent.notice }, now);
  done(sent.path);
}

/**
 * The listing form (selling spec 2.10): Save and publish, Save as draft, and the photo buttons. Photos are checked,
 * stripped and stored first, so a save that fails, or a photo button pressed without the app's JavaScript, keeps
 * them (plan decisions 9 and 11). A shop waiting for approval saves drafts only (plan decision 4).
 *
 * A new listing is made once, however many times its form is sent (amendment 14.1): the form carries a one-time token,
 * and only the first save to take it makes a listing. A later one goes where the first went; one with no token, or a
 * made-up or run-out one, is refused with the form's error and what was typed.
 */
export async function saveListingForm(formData: FormData): Promise<void> {
  const posted = field(formData, "listing");
  const owner = await requireShopOwner(posted && isId(posted) ? editListingPath(posted) : NEW_LISTING_PATH);
  const now = new Date();
  const existing = posted && isId(posted) ? await getOwnListing(owner.shop.slug, posted) : null;
  if (posted && !existing) redirect(myListingsPath());
  const id = existing?.id ?? null;
  const form = listingForm(id);
  const formPath = id ? editListingPath(id) : NEW_LISTING_PATH;

  // A token that has made its listing already: go where that save went, before any photo is stored or checked.
  const once = id ? "" : field(formData, "once");
  const earlier = once ? await sentListing(once, now) : null;
  if (earlier) await sentAgain(earlier, now);

  // A save offers only the shop's pickup points that are still in use. A listing already on a retired point keeps it
  // until its seller saves it, and then chooses a point in use (staff tools plan amendment 5).
  const inUse = new Set((await getPickupPoints()).map((point) => point.id));
  const context: ListingContext = {
    categorySlugs: (await getCategories()).map((category) => category.slug),
    pickupPointIds: owner.shop.pickupPointIds.filter((id) => inUse.has(id)),
  };

  // A photo button posts its move. Remove is applied before anything else, so the room it makes is there for a new
  // file chosen in the same post (amendment 10.3).
  const move = parsePhotoMove(field(formData, "photoMove"));
  const removing = move?.op === "remove" ? move.token : null;

  // Photos: the listing's own, and photos this seller uploaded on a form that hasn't saved yet. Anything else is dropped.
  const tokens = fieldList(formData, "photo").filter((token) => token !== removing);
  const ownSrcs = existing?.photos.map((photo) => photo.src) ?? [];
  const waitingBefore = await photoSrcsOf(owner.account.id, null, now);
  const room =
    PHOTOS_PER_LISTING - new Set(tokens.filter((token) => ownSrcs.includes(token) || waitingBefore.has(token))).size;
  const { uploads, errors: uploadErrors } = await readUploads(fileList(formData, "newPhotos"), room);
  const queue = await storePhotos(
    owner.account.id,
    uploads.filter((upload): upload is Upload => upload !== null),
    now,
  );
  const stored = uploads.map((upload) => (upload ? (queue.shift() ?? null) : null));
  // Storing tidied away waiting photos a day old and any past an account's newest 12, so what a form may use is read
  // again now: a saved listing never points at a photo that has gone (amendment 10.1).
  const allowed = new Set([...ownSrcs, ...(await photoSrcsOf(owner.account.id, null, now))]);
  // A new file that was removed in this post is left out, though it was posted.
  const removedSrc = removing ? resolveToken(removing, stored) : null;
  const { order, tooMany } = photoOrder(
    tokens,
    allowed,
    stored.map((src) => (src === removedSrc ? null : src)),
  );
  const alts = new Map<string, string>();
  for (const token of tokens) {
    const src = resolveToken(token, stored);
    if (src && order.includes(src)) alts.set(src, cleanLine(field(formData, `alt:${token}`)));
  }
  const photoErrors: string[] = [...uploadErrors];
  if (tooMany && !photoErrors.includes("photo-count")) photoErrors.push("photo-count");

  // A photo button: apply it, keep everything typed, and come back to the photos: to their legend, above the list,
  // not the file input below it (amendment 11.4). The error summary's links still go to the file input.
  if (move) {
    const token = resolveToken(move.token, stored);
    const moved = token ? applyPhotoMove(order, { token, op: move.op }) : order;
    const state = { errors: photoErrors, values: typedValues(formData, moved, alts, context), notice: null };
    await writeFormState(form, state, now);
    done(`${formPath}#${listingFieldPrefix(id)}-photos-title`);
  }

  const check = checkListing(listingInput(formData), context);
  const errors: string[] = [...check.errors, ...photoErrors];
  if ([...alts.values()].some((alt) => characterCount(alt) > ALT_MAX)) errors.push("alt-length");
  if (errors.length > 0 || !check.value) {
    await writeFormState(form, { errors, values: typedValues(formData, order, alts, context), notice: null }, now);
    done(formPath);
  }

  const intent = owner.status !== "pending" && field(formData, "intent") !== "draft" ? "publish" : "draft";
  // Only now, with a listing about to be made, is the token taken. Taking it is one step, so of two posts sent together
  // only one makes the listing; the other goes to My listings, or where the first says it went.
  if (!existing) {
    const token = await takeListingToken(once, now);
    if (token.kind === "none") {
      const values = typedValues(formData, order, alts, context);
      await writeFormState(form, { errors: ["form-expired"], values, notice: null }, now);
      done(formPath);
    }
    if (token.kind === "again") {
      if (token.sent) await sentAgain(token.sent, now);
      done(myListingsPath(intent === "draft" ? "drafts" : "available"));
    }
  }
  const saved = await saveOwnListing({
    sellerSlug: owner.shop.slug,
    ownerId: owner.account.id,
    id,
    fields: check.value,
    photos: order.map((src) => ({ src, alt: alts.get(src) ?? "" })),
    intent,
    now,
  });
  if (!saved) redirect(myListingsPath());
  await clearForm(form);
  listingsChanged();
  // A first publish (a new listing, or a draft published for the first time) by an open shop tells its followers, once
  // a day (community actions plan decision 15 and amendment 1). Edits, relists, a shop resuming, and a listing
  // published again after a save back to draft don't. `existing` is the row as it was before this save.
  if (isFirstPublish(existing, saved.state) && owner.status === "approved" && !saved.hiddenAt) {
    await notifyFollowers({
      sellerSlug: owner.shop.slug,
      shopName: owner.shop.name,
      listing: { id: saved.id, title: saved.title },
      now,
    });
  }
  let notice = "published";
  if (saved.state === "draft") notice = "drafted";
  else if (existing && existing.state !== "draft") notice = "saved";
  // A paused shop's listings are hidden, so a publish isn't seen until the shop resumes (amendment 11.6).
  else notice = (await pausedShopNotice(owner)) ?? notice;
  const path = myListingsPath(tabFor(saved.state));
  if (!existing) await leaveListingToken(once, { path, listing: saved.id, notice }, now);
  await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: saved.id }, notice }, now);
  done(path);
}

const NOTICE_FOR = { paused: "paused", available: "resumed", sold: "sold" } as const;

/** Pause, Resume, Mark sold and Relist on My listings (selling spec 2.9, plan decision 3), back to the same tab. */
export async function changeListingState(formData: FormData): Promise<void> {
  const tab = parseListingsTab(field(formData, "tab"));
  const owner = await requireShopOwner(myListingsPath(tab));
  const id = field(formData, "listing");
  const to = field(formData, "to");
  if (isId(id) && (to === "available" || to === "paused" || to === "sold")) {
    const now = new Date();
    const row = await setOwnListingState(owner.shop.slug, id, to, now);
    if (row) {
      listingsChanged();
      // Resume and Relist don't put a paused shop's listing in front of buyers (amendment 11.6).
      const pausedNotice = to === "available" ? await pausedShopNotice(owner) : null;
      const notice = pausedNotice ?? NOTICE_FOR[to];
      await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: row.id }, notice }, now);
    }
  }
  done(myListingsPath(tab));
}

/** Delete listing, from its confirm page (selling spec 2.9): it and its photos go; conversations keep its title. */
export async function deleteListingForm(formData: FormData): Promise<void> {
  const owner = await requireShopOwner(myListingsPath());
  const id = field(formData, "listing");
  const row = isId(id) ? await getOwnListing(owner.shop.slug, id) : null;
  if (row && (await deleteOwnListing(owner.shop.slug, owner.account.id, row.id))) {
    listingsChanged();
    await writeFormState(MY_LISTINGS_FORM, { errors: [], values: {}, notice: "deleted" }, new Date());
  }
  done(myListingsPath(row ? tabFor(row.state) : "available"));
}
