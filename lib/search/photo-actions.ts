"use server";

import { notFound, redirect } from "next/navigation";
import { aiFeatureOn } from "@/lib/ai/config";
import { writeFormState } from "@/lib/auth/form-state";
import { isSampleAccount } from "@/lib/auth/sample-accounts";
import { requireAccount } from "@/lib/auth/session";
import { browseHref } from "@/lib/browse/href";
import { getCategories, searchListings } from "@/lib/data";
import { readSearchPhoto } from "@/lib/data/ai";
import { reservePhotoSearch } from "@/lib/data/photo-searches";
import { readUploads } from "@/lib/selling/uploads";
import type { Account } from "@/lib/types";
import {
  noticeFor,
  PHOTO_SEARCH_FORM,
  PHOTO_SEARCH_PATH,
  PHOTO_SEARCHES_PER_DAY,
  photoSearchFallback,
  photoSearchQuery,
  type PhotoSearchNotice,
} from "./photo";

// Snap to search's one action (AI features spec section 5). The photo is checked and stripped in memory, sent once and
// dropped: nothing is stored but the day's count (spec 5.1). Identity comes only from the session.

/** What one search came to: the Browse link, or the notice to go back with. Nothing in it redirects. */
type Outcome = { href: string } | { notice: PhotoSearchNotice };

async function search(formData: FormData, account: Account, now: Date): Promise<Outcome> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { notice: "no-photo" };
  // The same checks as the listing form's photos: size, signature, metadata stripped (lib/selling/uploads.ts).
  const { uploads, errors } = await readUploads([file], 1);
  const photo = uploads[0];
  if (!photo) {
    const error = errors[0];
    return { notice: error === "photo-size" || error === "photo-type" ? error : "photo-unreadable" };
  }
  try {
    // Counted after the photo passes its checks and before the provider, as photo-to-listing does (planning
    // decision 6): a refused photo costs nothing. Sample accounts aren't counted in sample mode (spec 5.4).
    if (!isSampleAccount(account) && !(await reservePhotoSearch(account.id, now, PHOTO_SEARCHES_PER_DAY))) {
      return { notice: "limit" };
    }
    const reading = await readSearchPhoto(photo, await getCategories());
    if (!reading.ok) return { notice: noticeFor(reading.failure) };
    const query = photoSearchQuery(reading.answer);
    const fallback = photoSearchFallback(reading.answer);
    if (!fallback) return { href: browseHref(query) };
    // Browse's own reader decides whether every word finds something (never a copy of its rules); a failed count
    // keeps every word, as Browse would show them.
    const found = await searchListings(query).then((result) => result.items.length > 0, () => true);
    return { href: browseHref(found ? query : fallback) };
  } catch {
    // Only the kind: never the photo or the words.
    console.warn("[vossie] photo-search: search error");
    return { notice: "failed" };
  }
}

/** "Search" on /browse/photo: Browse with the photo's words (spec 5.3), or back to the form with a notice. */
export async function searchByPhoto(formData: FormData): Promise<void> {
  if (!aiFeatureOn("photo-search")) notFound();
  const account = await requireAccount(PHOTO_SEARCH_PATH);
  const now = new Date();
  const outcome = await search(formData, account, now);
  if ("href" in outcome) redirect(outcome.href);
  await writeFormState(PHOTO_SEARCH_FORM, { errors: [], values: {}, notice: outcome.notice }, now);
  redirect(PHOTO_SEARCH_PATH);
}
