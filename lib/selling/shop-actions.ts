"use server";

import { redirect } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories, getPickupPoints } from "@/lib/data";
import { storePhotos, type Upload } from "@/lib/data/photos";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import {
  createShop,
  emptyDraft,
  getOnboardingDraft,
  getShopOf,
  isShopNameTaken,
  isSlugTaken,
  saveOnboardingDraft,
  setShopPaused,
  updateShop,
  type ShopPhotoEdit,
} from "@/lib/data/shops";
import { sellersChanged } from "@/lib/data/tags";
import { keepTyped } from "@/lib/messaging/rules";
import type { Account } from "@/lib/types";
import { done, field, fieldList, fileList } from "./action-helpers";
import { DASHBOARD_FORM, onboardingForm, PROFILE_FORM } from "./form-state";
import { requireShopOwner } from "./owner";
import { onboardingPath, parseStep, PROFILE_PATH, SELL_PATH, type OnboardingStep } from "./paths";
import { checkAbout, checkShopName, checkSlug, checkTagline } from "./rules";
import { readUploads } from "./uploads";

// The shop's Server Actions (selling spec 2.6 to 2.8 and 2.11): the wizard, Edit shop, and Pause my shop. Each is a
// plain form's action, so it works before the app's JavaScript arrives (spec 2.2). Identity comes only from the
// session and the shop only from the account (selling spec section 3); every value from a field is checked against
// what the site knows; errors and typed values go to D's form state; every action ends with done() (refresh, then a
// replace redirect to one of selling's fixed addresses), and one that changes what buyers see expires the sellers tag
// first (plan decision 6).

async function isCategory(slug: string): Promise<boolean> {
  return (await getCategories()).some((category) => category.slug === slug);
}

async function isCampus(slug: string): Promise<boolean> {
  return (await getCampuses()).some((campus) => campus.slug === slug);
}

async function spotsAt(campusSlug: string): Promise<string[]> {
  return (await getPickupPoints()).filter((point) => point.campusSlug === campusSlug).map((point) => point.id);
}

/**
 * The campus and pickup points (step 4 and Edit shop, plan decision 15). The form shows the points of the campus it was
 * drawn with (`pointsCampus`); when the seller picks another, it comes back with that campus's points to choose.
 */
async function readCampusAndSpots(
  formData: FormData,
): Promise<{ campusSlug: string; pickupPointIds: string[]; errors: string[] }> {
  const chosen = field(formData, "campus");
  const campusSlug = (await isCampus(chosen)) ? chosen : "";
  if (!campusSlug) return { campusSlug, pickupPointIds: [], errors: ["campus-missing"] };
  const spots = await spotsAt(campusSlug);
  if (field(formData, "pointsCampus") !== campusSlug) {
    return { campusSlug, pickupPointIds: [], errors: spots.length > 0 ? ["points-campus"] : [] };
  }
  const pickupPointIds = [...new Set(fieldList(formData, "pickupPoint"))].filter((id) => spots.includes(id));
  const errors = spots.length > 0 && pickupPointIds.length === 0 ? ["points-missing"] : [];
  return { campusSlug, pickupPointIds, errors };
}

/** A shop photo from the form (spec 2.6, step 3), checked and stripped, not stored yet. Only the first file counts. */
async function readShopPhoto(formData: FormData): Promise<{ upload: Upload | null; errors: string[] }> {
  const files = fileList(formData, "photo");
  if (files.length === 0) return { upload: null, errors: [] };
  const { uploads, errors } = await readUploads(files.slice(0, 1), 1);
  return { upload: uploads[0] ?? null, errors };
}

/** Every step's problems with a draft, for Send for approval (plan decision 15). */
async function draftProblems(draft: OnboardingDraftRow): Promise<Map<OnboardingStep, string[]>> {
  const problems = new Map<OnboardingStep, string[]>();
  const note = (step: OnboardingStep, error: string | null) => {
    if (error) problems.set(step, [...(problems.get(step) ?? []), error]);
  };
  const name = checkShopName(draft.name);
  note(1, name.error ?? ((await isShopNameTaken(draft.name, draft.campusSlug, null)) ? "name-taken" : null));
  note(1, checkTagline(draft.tagline).error);
  note(1, (await isCategory(draft.categorySlug)) ? null : "category-missing");
  note(2, checkAbout(draft.about).error);
  const spots = await spotsAt(draft.campusSlug);
  note(4, (await isCampus(draft.campusSlug)) ? null : "campus-missing");
  note(4, spots.length > 0 && !draft.pickupPointIds.some((id) => spots.includes(id)) ? "points-missing" : null);
  return problems;
}

/**
 * The wizard is for students who haven't applied: anyone with a seller profile (waiting, approved or paused) goes to
 * /sell instead. The profile is read from the session's account, never from the form.
 */
function leaveIfApplied(account: Account): void {
  if (account.seller) redirect(SELL_PATH);
}

/**
 * One of the wizard's first four steps (selling spec 2.6, plan decision 15). What was typed goes into the draft, and
 * Continue moves on only when the step is right; otherwise the step shows its errors. Step 3's photo is optional.
 */
export async function saveOnboardingStep(formData: FormData): Promise<void> {
  const step = parseStep(field(formData, "step"));
  const account = await requireAccount(onboardingPath(step));
  leaveIfApplied(account);
  const now = new Date();
  const draft = (await getOnboardingDraft(account.id)) ?? emptyDraft(account.id, account.campusSlug, now);
  const errors: string[] = [];
  let stay = false;
  switch (step) {
    case 1: {
      const name = checkShopName(field(formData, "name"));
      const tagline = checkTagline(field(formData, "tagline"));
      const categorySlug = field(formData, "category");
      draft.name = keepTyped(name.value);
      draft.tagline = keepTyped(tagline.value);
      draft.categorySlug = (await isCategory(categorySlug)) ? categorySlug : "";
      if (name.error) errors.push(name.error);
      else if (await isShopNameTaken(name.value, draft.campusSlug, null)) errors.push("name-taken");
      if (tagline.error) errors.push(tagline.error);
      if (!draft.categorySlug) errors.push("category-missing");
      break;
    }
    case 2: {
      const about = checkAbout(field(formData, "about"));
      draft.about = keepTyped(about.value);
      if (about.error) errors.push(about.error);
      break;
    }
    case 3: {
      if (field(formData, "photoAction") === "remove") {
        draft.photoSrc = null;
        stay = true;
        break;
      }
      const photo = await readShopPhoto(formData);
      errors.push(...photo.errors);
      // Stored waiting on the form; saving the draft below gives it the draft's use and deletes the one it replaces.
      if (photo.upload) [draft.photoSrc] = await storePhotos(account.id, [photo.upload], now);
      break;
    }
    case 4: {
      const place = await readCampusAndSpots(formData);
      if (place.campusSlug) draft.campusSlug = place.campusSlug;
      draft.pickupPointIds = place.pickupPointIds;
      errors.push(...place.errors);
      break;
    }
    case 5:
      // Step 5's form posts to sendForApproval.
      redirect(onboardingPath(5));
  }
  draft.updatedAt = now.toISOString();
  await saveOnboardingDraft(draft);
  await writeFormState(onboardingForm(step), { errors, values: {}, notice: null }, now);
  done(errors.length > 0 || stay ? onboardingPath(step) : onboardingPath((step + 1) as OnboardingStep));
}

/**
 * Send for approval (selling spec 2.6 step 5, and 2.7). Every step is checked again, and the first with a problem
 * opens with its errors (plan decision 15). Then the shop is made, waiting for the Hub, and the seller lands on /sell.
 */
export async function sendForApproval(formData: FormData): Promise<void> {
  const account = await requireAccount(onboardingPath(5));
  leaveIfApplied(account);
  const now = new Date();
  const draft = await getOnboardingDraft(account.id);
  if (!draft) done(onboardingPath(1));
  const problems = await draftProblems(draft);
  for (const [step, errors] of problems) {
    await writeFormState(onboardingForm(step), { errors, values: {}, notice: null }, now);
  }
  const first = [...problems.keys()].sort((a, b) => a - b)[0];
  if (first) done(onboardingPath(first));
  if (field(formData, "guidelines") !== "yes") {
    await writeFormState(onboardingForm(5), { errors: ["guidelines-missing"], values: {}, notice: null }, now);
    done(onboardingPath(5));
  }
  // A point retired since the draft was saved isn't the new shop's (staff tools spec 2.3): only points in use.
  const spots = await spotsAt(draft.campusSlug);
  const made = await createShop(
    account.id,
    {
      name: draft.name,
      tagline: draft.tagline,
      categorySlug: draft.categorySlug,
      about: draft.about,
      image: draft.photoSrc ? { src: draft.photoSrc, alt: "" } : null,
      campusSlug: draft.campusSlug,
      pickupPointIds: draft.pickupPointIds.filter((id) => spots.includes(id)),
    },
    now,
  );
  // Another shop on the campus took the name since the check above: back to step 1, with nothing made.
  if (made?.error) {
    await writeFormState(onboardingForm(1), { errors: [made.error], values: {}, notice: null }, now);
    done(onboardingPath(1));
  }
  // Null when another post made the account's shop first: nothing changed here.
  if (made) sellersChanged();
  done(SELL_PATH);
}

/**
 * Edit shop (selling spec 2.11, plan decisions 15 to 17): the wizard's fields on one page, and the link, which an
 * approved or paused shop may change once. Nothing is saved until everything is right; then the shop, its listings
 * and, with a new link, everything that names the shop change together.
 */
export async function saveShopProfile(formData: FormData): Promise<void> {
  const owner = await requireShopOwner(PROFILE_PATH);
  const now = new Date();
  const { account } = owner;
  const errors: string[] = [];

  const name = checkShopName(field(formData, "name"));
  const tagline = checkTagline(field(formData, "tagline"));
  const categorySlug = field(formData, "category");
  const categoryKnown = await isCategory(categorySlug);
  const about = checkAbout(field(formData, "about"));
  // A file chosen as well as Remove the photo wins: choosing it is the newer intent.
  const removePhoto = field(formData, "removePhoto") === "yes";
  const photo = await readShopPhoto(formData);
  const place = await readCampusAndSpots(formData);
  const typedSlug = field(formData, "slug").trim().toLowerCase();
  const slug = checkSlug(typedSlug);
  // The link the form showed, posted with it. It comes from the browser, so it's checked like any link, and one that
  // isn't a link counts for nothing.
  const shown = checkSlug(field(formData, "slugWas"));
  const slugWas = shown.error ? null : shown.value;
  // The shop as it is now, read again after the form: a post sent twice (a double click) may find that the first has
  // already changed the link, and another tab may have changed it since this form was drawn.
  const { shop: current, status } = (await getShopOf(account.id)) ?? owner;
  // A change of link is a link typed other than the shop's now and the one the form showed. The one the form showed,
  // when the link has changed since (in another tab), leaves the link as it is now and saves the rest.
  const changeSlug = status !== "pending" && typedSlug !== "" && typedSlug !== current.slug && typedSlug !== slugWas;

  /** Back to the form with its errors and everything typed, having saved nothing. */
  const sendBack = async (problems: string[]): Promise<never> => {
    const values = {
      name: keepTyped(name.value),
      tagline: keepTyped(tagline.value),
      category: categoryKnown ? categorySlug : "",
      about: keepTyped(about.value),
      campus: place.campusSlug,
      points: place.pickupPointIds.join(" "),
      slug: keepTyped(typedSlug),
    };
    await writeFormState(PROFILE_FORM, { errors: problems, values, notice: null }, now);
    done(PROFILE_PATH);
  };

  // In the form's order, so the error summary reads top to bottom.
  if (name.error) errors.push(name.error);
  else if (place.campusSlug && (await isShopNameTaken(name.value, place.campusSlug, current.slug))) {
    errors.push("name-taken");
  }
  if (tagline.error) errors.push(tagline.error);
  if (!categoryKnown) errors.push("category-missing");
  if (about.error) errors.push(about.error);
  errors.push(...photo.errors, ...place.errors);
  if (changeSlug) {
    if (current.slugChanged) errors.push("slug-used");
    else if (slug.error) errors.push(slug.error);
    else if (await isSlugTaken(slug.value)) errors.push("slug-taken");
  }
  if (errors.length > 0) await sendBack(errors);

  // "keep" is the photo the shop has when it saves, which another post may have changed since this one read it.
  let image: ShopPhotoEdit = removePhoto ? "remove" : "keep";
  if (photo.upload) {
    const [src] = await storePhotos(account.id, [photo.upload], now);
    image = { src, alt: "" };
  }
  const saved = await updateShop(
    account.id,
    {
      name: name.value,
      tagline: tagline.value,
      categorySlug,
      about: about.value,
      image,
      campusSlug: place.campusSlug,
      pickupPointIds: place.pickupPointIds,
      slug: changeSlug ? slug.value : null,
    },
    now,
  );
  if (!saved) done(SELL_PATH);
  // Another post got there since the checks above (another shop took the name, or the link changed or was taken), so
  // nothing was saved; a photo stored for this edit waits a day, as on any form that didn't save (plan decision 11).
  if (saved.error) await sendBack([saved.error]);
  sellersChanged();
  await writeFormState(PROFILE_FORM, { errors: [], values: {}, notice: "shop-saved" }, now);
  done(PROFILE_PATH);
}

async function setPaused(paused: boolean): Promise<never> {
  const owner = await requireShopOwner(SELL_PATH);
  if (await setShopPaused(owner.account.id, paused)) {
    sellersChanged();
    const notice = paused ? "shop-paused" : "shop-resumed";
    await writeFormState(DASHBOARD_FORM, { errors: [], values: {}, notice }, new Date());
  }
  done(SELL_PATH);
}

/** Pause my shop (selling spec 2.8): buyers stop seeing its listings until Resume. Only an approved shop pauses. */
export async function pauseShop(): Promise<void> {
  await setPaused(true);
}

/** Resume (selling spec 2.8). */
export async function resumeShop(): Promise<void> {
  await setPaused(false);
}
