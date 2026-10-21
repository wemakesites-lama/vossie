import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { DAY_MS } from "@/lib/messaging/rules";
import type { PhotoType } from "@/lib/types";
import type { PhotoRow } from "./rows";
import { sampleStore } from "./store";

// Uploaded photos (selling spec 2.4, plan decision 11), standing in for Supabase Storage. Server Actions store, use
// and delete them; /photos/[id] hands them out. The bytes are shared, never copied: nothing changes them once stored.
//
// On Supabase (C2/C3 plan decisions 11 to 15) the rows are the photos table's and the files are in Storage's private
// photos bucket: lib/data/supabase/photos.ts. Each switched function's first line picks it, through import(), so sample
// mode never loads Supabase code. getPhoto and isHiddenFrom stay the sample's (the route asks photoFor).

const supabase = () => import("./supabase/photos");

/** A photo uploaded on a form that hasn't saved yet is kept for a day, and each account keeps its newest 12. */
export const LOOSE_PHOTO_TTL_MS = DAY_MS;
export const LOOSE_PHOTOS_PER_ACCOUNT = 12;

const PREFIX = "/photos/";
/**
 * A stored photo's id: the sample's "ph-" and a uuid, or Supabase's bare uuid, lower case (C2/C3 plan decision 13).
 * Either backend answers a miss for the other's: a 404.
 */
const PHOTO_ID = /^(ph-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A photo checked and stripped (lib/selling/uploads.ts), ready to store. */
export type Upload = { type: PhotoType; bytes: Uint8Array<ArrayBuffer> };

/** A photo that waits on a form (no use) and is a day old or more: it's gone for good (amendment 9.5). */
function isStale(row: Pick<PhotoRow, "use" | "createdAt">, nowMs: number): boolean {
  return row.use === null && Date.parse(row.createdAt) <= nowMs - LOOSE_PHOTO_TTL_MS;
}

export function isPhotoId(id: string): boolean {
  return PHOTO_ID.test(id);
}

export function photoSrc(id: string): string {
  return `${PREFIX}${id}`;
}

/** The photo's id from its address, or null when the address isn't a stored photo's (a placeholder, say). */
export function photoIdOf(src: string): string | null {
  const id = src.startsWith(PREFIX) ? src.slice(PREFIX.length) : "";
  return isPhotoId(id) ? id : null;
}

/** What a listing's photos are used for. */
export function listingPhotoUse(listingId: string): string {
  return `listing:${listingId}`;
}

/**
 * Stores photos for `ownerId`, waiting on a form (no use yet), and gives back their addresses in order. Tidies away
 * waiting photos more than a day old, and keeps each account's newest 12.
 */
export async function storePhotos(ownerId: string, uploads: readonly Upload[], now: Date): Promise<string[]> {
  if (onSupabase()) return (await supabase()).storePhotos(ownerId, uploads, now);
  const { photos } = sampleStore();
  const srcs = uploads.map((upload) => {
    const id = `ph-${randomUUID()}`;
    photos.set(id, { id, ownerId, use: null, type: upload.type, bytes: upload.bytes, createdAt: now.toISOString() });
    return photoSrc(id);
  });
  for (const [id, row] of photos) {
    if (isStale(row, now.getTime())) photos.delete(id);
  }
  // The store keeps insertion order, so the oldest waiting photos come first.
  const waiting = [...photos.values()].filter((row) => row.use === null && row.ownerId === ownerId);
  for (const row of waiting.slice(0, Math.max(0, waiting.length - LOOSE_PHOTOS_PER_ACCOUNT))) photos.delete(row.id);
  return srcs;
}

/**
 * A photo's type and bytes, for /photos/[id]. A waiting photo more than a day old is null, even if no upload has come
 * along to tidy it away yet, so its limit doesn't wait for the next upload (amendment 9.5).
 */
export async function getPhoto(id: string, now: Date): Promise<Pick<PhotoRow, "type" | "bytes"> | null> {
  const row = sampleStore().photos.get(id);
  return row && !isStale(row, now.getTime()) ? { type: row.type, bytes: row.bytes } : null;
}

/**
 * Whether a photo belongs to a listing the Hub hid, and so isn't for this viewer (staff tools amendment 13.5). Its
 * owner still sees it, because they can still edit the listing.
 */
export function isHiddenFrom(id: string, viewerId: string | null): boolean {
  const { photos, listings } = sampleStore();
  if (viewerId !== null && photos.get(id)?.ownerId === viewerId) return false;
  const src = photoSrc(id);
  return [...listings.values()].some((listing) => listing.hiddenAt && listing.photos.some((photo) => photo.src === src));
}

/** Who is asking for a photo, when it matters (C2/C3 plan decision 11): their account, and whether they're Hub staff. */
export type PhotoViewer = { id: string; hubStaff: boolean };

/**
 * A photo /photos/[id] serves: its type and bytes, and whether it's everyone's. One that isn't (a hidden listing's, for
 * its owner; on Supabase a Hub cover not yet out, for Hub staff) is never kept by a shared cache (fix 2 of the review
 * after C2 and C3).
 */
export type ServedPhoto = Pick<PhotoRow, "type" | "bytes"> & { forEveryone: boolean };

/**
 * A photo for /photos/[id] (C2/C3 plan decision 11), or null: getPhoto's, unless it belongs to a listing the Hub hid
 * and the viewer isn't its owner (staff tools amendment 13.5). `viewer` is asked only when the photo isn't everyone's,
 * so most photos cost no session read. On Supabase the database also keeps the Hub's waiting covers and covers of
 * unpublished posts for Hub staff (the controller's answer to open question 4: the sample doesn't change).
 */
export async function photoFor(
  id: string,
  viewer: () => Promise<PhotoViewer | null>,
  now: Date,
): Promise<ServedPhoto | null> {
  if (onSupabase()) return (await supabase()).photoFor(id, viewer, now);
  const photo = await getPhoto(id, now);
  if (!photo) return null;
  if (!isHiddenFrom(id, null)) return { ...photo, forEveryone: true };
  if (isHiddenFrom(id, (await viewer())?.id ?? null)) return null;
  return { ...photo, forEveryone: false };
}

/**
 * The addresses of `ownerId`'s photos with this use; null means waiting on a form. A waiting photo a day old or more
 * is left out, even if no upload has come along to tidy it away yet: it's gone, and nothing may point at it
 * (amendment 10.1).
 */
export async function photoSrcsOf(ownerId: string, use: string | null, now: Date): Promise<Set<string>> {
  if (onSupabase()) return (await supabase()).photoSrcsOf(ownerId, use, now);
  const nowMs = now.getTime();
  const rows = [...sampleStore().photos.values()].filter(
    (row) => row.ownerId === ownerId && row.use === use && !isStale(row, nowMs),
  );
  return new Set(rows.map((row) => photoSrc(row.id)));
}

/**
 * Gives `ownerId`'s photos at these addresses a use. Anyone else's photos, and placeholders, are left alone. (Not
 * called `usePhotos`: the React Hooks lint rule takes any `use…` name for a hook.)
 */
export async function attachPhotos(ownerId: string, srcs: Iterable<string>, use: string): Promise<void> {
  if (onSupabase()) return (await supabase()).attachPhotos(ownerId, srcs, use);
  const { photos } = sampleStore();
  for (const src of srcs) {
    const row = photos.get(photoIdOf(src) ?? "");
    if (row?.ownerId === ownerId) row.use = use;
  }
}

/** Deletes `ownerId`'s photos with this use, except those at the addresses in `keep`. */
export async function deletePhotosUsedBy(
  ownerId: string,
  use: string,
  keep: ReadonlySet<string> = new Set(),
): Promise<void> {
  if (onSupabase()) return (await supabase()).deletePhotosUsedBy(ownerId, use, keep);
  const { photos } = sampleStore();
  for (const [id, row] of photos) {
    if (row.ownerId === ownerId && row.use === use && !keep.has(photoSrc(id))) photos.delete(id);
  }
}

/** Deletes every photo `ownerId` uploaded (deleting an account, plan decision 22). */
export async function deletePhotosOf(ownerId: string): Promise<void> {
  if (onSupabase()) return (await supabase()).deletePhotosOf(ownerId);
  const { photos } = sampleStore();
  for (const [id, row] of photos) {
    if (row.ownerId === ownerId) photos.delete(id);
  }
}

/**
 * The daily sweep (C2/C3 plan decision 15; spec section 7), run by /api/cron/photos: waiting photos a day old go. How
 * many rows went and how many files with them. In the sample a photo's row is its file; on Supabase the files no row
 * names, more than an hour old, go too.
 */
export async function sweepPhotos(now: Date): Promise<{ rows: number; files: number }> {
  if (onSupabase()) return (await supabase()).sweepPhotos(now);
  const { photos } = sampleStore();
  let rows = 0;
  for (const [id, row] of photos) {
    if (!isStale(row, now.getTime())) continue;
    photos.delete(id);
    rows += 1;
  }
  return { rows, files: rows };
}
