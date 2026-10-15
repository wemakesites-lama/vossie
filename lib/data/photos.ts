import { randomUUID } from "node:crypto";
import { DAY_MS } from "@/lib/messaging/rules";
import type { PhotoType } from "@/lib/types";
import type { PhotoRow } from "./rows";
import { sampleStore } from "./store";

// Uploaded photos (selling spec 2.4, plan decision 11), standing in for Supabase Storage. Server Actions store, use
// and delete them; /photos/[id] hands them out. The bytes are shared, never copied: nothing changes them once stored.

/** A photo uploaded on a form that hasn't saved yet is kept for a day, and each account keeps its newest 12. */
export const LOOSE_PHOTO_TTL_MS = DAY_MS;
export const LOOSE_PHOTOS_PER_ACCOUNT = 12;

const PREFIX = "/photos/";
const PHOTO_ID = /^ph-[0-9a-f-]{36}$/;

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
 * The addresses of `ownerId`'s photos with this use; null means waiting on a form. A waiting photo a day old or more
 * is left out, even if no upload has come along to tidy it away yet: it's gone, and nothing may point at it
 * (amendment 10.1).
 */
export async function photoSrcsOf(ownerId: string, use: string | null, now: Date): Promise<Set<string>> {
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
  const { photos } = sampleStore();
  for (const [id, row] of photos) {
    if (row.ownerId === ownerId && row.use === use && !keep.has(photoSrc(id))) photos.delete(id);
  }
}

/** Deletes every photo `ownerId` uploaded (deleting an account, plan decision 22). */
export async function deletePhotosOf(ownerId: string): Promise<void> {
  const { photos } = sampleStore();
  for (const [id, row] of photos) {
    if (row.ownerId === ownerId) photos.delete(id);
  }
}
