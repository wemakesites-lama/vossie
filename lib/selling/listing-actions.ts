"use server";

import { redirect } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { getCategories } from "@/lib/data";
import { deleteOwnListing, getOwnListing, saveOwnListing, setOwnListingState } from "@/lib/data/own-listings";
import { photoSrcsOf, storePhotos, type Upload } from "@/lib/data/photos";
import { listingsChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { characterCount, keepTyped } from "@/lib/messaging/rules";
import { PHOTOS_PER_LISTING } from "@/lib/photos/rules";
import { done, field, fieldList, fileList } from "./action-helpers";
import { listingFieldPrefix } from "./errors";
import { clearForm, listingForm, MY_LISTINGS_FORM } from "./form-state";
import { requireShopOwner } from "./owner";
import { editListingPath, myListingsPath, NEW_LISTING_PATH, parseListingsTab, tabFor } from "./paths";
import { applyPhotoMove, parsePhotoMove, photoOrder, resolveToken } from "./photo-order";
import { ALT_MAX, checkListing, cleanLine, type ListingInput } from "./rules";
import { readUploads } from "./uploads";

// The listing Server Actions (selling spec 2.9 and 2.10): the listing form's save and photo buttons, My listings'
// row buttons, and Delete listing. Identity comes only from the session, and every listing id from a form is looked
// up among the signed-in seller's own listings. Each ends with done(), after listingsChanged() when what buyers see
// changed (plan decision 6).

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

/**
 * What the form shows again after a failed save or a photo button (plan decision 9): all that was typed, the photos
 * in order, and each one's description.
 */
function typedValues(
  formData: FormData,
  order: readonly string[],
  alts: ReadonlyMap<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {
    kind: field(formData, "kind"),
    title: keepTyped(field(formData, "title")),
    category: field(formData, "category"),
    condition: field(formData, "condition"),
    price: keepTyped(field(formData, "price")),
    free: field(formData, "free"),
    from: field(formData, "from"),
    payMode: field(formData, "payMode"),
    swapFor: keepTyped(field(formData, "swapFor")),
    description: keepTyped(field(formData, "description")),
    handover: field(formData, "handover"),
    pickup: field(formData, "pickup"),
    photos: order.join("\n"),
  };
  for (const src of order) values[`alt:${src}`] = keepTyped(alts.get(src) ?? "");
  return values;
}

/**
 * The listing form (selling spec 2.10): Save and publish, Save as draft, and the photo buttons. Photos are checked,
 * stripped and stored first, so a save that fails, or a photo button pressed without the app's JavaScript, keeps
 * them (plan decisions 9 and 11). A shop waiting for approval saves drafts only (plan decision 4).
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

  // Photos: the listing's own, and photos this seller uploaded on a form that hasn't saved yet. Anything else is dropped.
  const tokens = fieldList(formData, "photo");
  const allowed = new Set([
    ...(existing?.photos.map((photo) => photo.src) ?? []),
    ...(await photoSrcsOf(owner.account.id, null)),
  ]);
  const room = PHOTOS_PER_LISTING - new Set(tokens.filter((token) => allowed.has(token))).size;
  const { uploads, errors: uploadErrors } = await readUploads(fileList(formData, "newPhotos"), room);
  const queue = await storePhotos(
    owner.account.id,
    uploads.filter((upload): upload is Upload => upload !== null),
    now,
  );
  const stored = uploads.map((upload) => (upload ? (queue.shift() ?? null) : null));
  const { order, tooMany } = photoOrder(tokens, allowed, stored);
  const alts = new Map<string, string>();
  for (const token of tokens) {
    const src = resolveToken(token, stored);
    if (src && order.includes(src)) alts.set(src, cleanLine(field(formData, `alt:${token}`)));
  }
  const photoErrors: string[] = [...uploadErrors];
  if (tooMany && !photoErrors.includes("photo-count")) photoErrors.push("photo-count");

  // A photo button: apply it, keep everything typed, and come back to the photos.
  const move = parsePhotoMove(field(formData, "photoMove"));
  if (move) {
    const token = resolveToken(move.token, stored);
    const moved = token ? applyPhotoMove(order, { token, op: move.op }) : order;
    await writeFormState(form, { errors: photoErrors, values: typedValues(formData, moved, alts), notice: null }, now);
    done(`${formPath}#${listingFieldPrefix(id)}-photos`);
  }

  const categories = await getCategories();
  const check = checkListing(listingInput(formData), {
    categorySlugs: categories.map((category) => category.slug),
    pickupPointIds: owner.shop.pickupPointIds,
  });
  const errors: string[] = [...check.errors, ...photoErrors];
  if ([...alts.values()].some((alt) => characterCount(alt) > ALT_MAX)) errors.push("alt-length");
  if (errors.length > 0 || !check.value) {
    await writeFormState(form, { errors, values: typedValues(formData, order, alts), notice: null }, now);
    done(formPath);
  }

  const intent = owner.status !== "pending" && field(formData, "intent") !== "draft" ? "publish" : "draft";
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
  let notice = "published";
  if (saved.state === "draft") notice = "drafted";
  else if (existing && existing.state !== "draft") notice = "saved";
  await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: saved.id }, notice }, now);
  done(myListingsPath(tabFor(saved.state)));
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
      await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: row.id }, notice: NOTICE_FOR[to] }, now);
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
