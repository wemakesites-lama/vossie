import { randomUUID } from "node:crypto";
import { nextState, type ListingFields } from "@/lib/selling/rules";
import type { ImageRef, ListingState } from "@/lib/types";
import { attachPhotos, deletePhotosUsedBy, listingPhotoUse } from "./photos";
import type { ListingRow } from "./rows";
import { sampleStore } from "./store";

// A shop's own listings (selling spec 2.9 and 2.10, plan decision 3), drafts included. Every function takes the
// shop's slug and only ever finds or changes that shop's listings, so a listing id from a form can't reach anyone
// else's. Times come from the caller.

const copy = (row: ListingRow): ListingRow => structuredClone(row);

/**
 * Whether saving a listing to `state` is its first publish (amendment 9.2): it isn't a draft, and it has never been
 * published. `before` is the listing as it was stored, or null for a new one. A listing published, saved back as a
 * draft and published again isn't a first publish the second time. Stages H and I tell a shop's followers and the
 * matching saved searches only on a first publish, so they ask this rather than work it out from the state.
 */
export function isFirstPublish(before: Pick<ListingRow, "firstPublishedAt"> | null, state: ListingState): boolean {
  return state !== "draft" && (before === null || before.firstPublishedAt === null);
}

/** The shop's listings, most recently changed first. */
export async function listOwnListings(sellerSlug: string): Promise<ListingRow[]> {
  return [...sampleStore().listings.values()]
    .filter((row) => row.sellerSlug === sellerSlug)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(copy);
}

export async function getOwnListing(sellerSlug: string, id: string): Promise<ListingRow | null> {
  const row = sampleStore().listings.get(id);
  return row && row.sellerSlug === sellerSlug ? copy(row) : null;
}

export type ListingSave = {
  sellerSlug: string;
  /** The shop's owner, whose photos these are. */
  ownerId: string;
  /** Null for a new listing. */
  id: string | null;
  fields: ListingFields;
  /** In order, the cover first. An empty alt means the title. */
  photos: readonly ImageRef[];
  intent: "publish" | "draft";
  now: Date;
};

/**
 * Saves a new or changed listing (plan decision 3) on its shop's campus. The photos it uses become its own, and the
 * ones it no longer uses are deleted. A draft's `createdAt` moves to when it's first published, and that moment is
 * kept in `firstPublishedAt` for good: publishing again after a save back to draft changes neither (amendment 9.2).
 * Null when `id` isn't one of the shop's listings, or the shop has gone.
 */
export async function saveOwnListing(save: ListingSave): Promise<ListingRow | null> {
  const { listings, sellers } = sampleStore();
  const shop = sellers.get(save.sellerSlug);
  const existing = save.id ? listings.get(save.id) : undefined;
  if (!shop || (save.id && existing?.sellerSlug !== save.sellerSlug)) return null;
  const at = save.now.toISOString();
  const state = nextState(existing?.state ?? null, save.intent);
  const firstPublish = isFirstPublish(existing ?? null, state);
  const row: ListingRow = {
    id: existing?.id ?? `l-${randomUUID()}`,
    sellerSlug: save.sellerSlug,
    state,
    ...save.fields,
    campusSlug: shop.campusSlug,
    photos: save.photos.map((photo) => ({ src: photo.src, alt: photo.alt })),
    createdAt: !existing || firstPublish ? at : existing.createdAt,
    firstPublishedAt: firstPublish ? at : (existing?.firstPublishedAt ?? null),
    updatedAt: at,
    // A listing the Hub hid stays hidden when its seller saves it (staff tools plan decision 4). New rows get no field.
    ...(existing?.hiddenAt ? { hiddenAt: existing.hiddenAt, hiddenReason: existing.hiddenReason ?? null } : {}),
  };
  listings.set(row.id, row);
  const srcs = new Set(row.photos.map((photo) => photo.src));
  await attachPhotos(save.ownerId, srcs, listingPhotoUse(row.id));
  await deletePhotosUsedBy(save.ownerId, listingPhotoUse(row.id), srcs);
  return copy(row);
}

/** The row buttons' moves (plan decision 3): Pause, Resume, Mark sold and Relist. A draft publishes from its form. */
const MOVES_TO: Readonly<Record<"available" | "paused" | "sold", readonly ListingState[]>> = {
  paused: ["available"],
  available: ["paused", "sold"],
  sold: ["available", "paused"],
};

/** Moves one of the shop's listings to `to`. Null when it isn't the shop's, or can't move there. */
export async function setOwnListingState(
  sellerSlug: string,
  id: string,
  to: "available" | "paused" | "sold",
  now: Date,
): Promise<ListingRow | null> {
  const row = sampleStore().listings.get(id);
  if (!row || row.sellerSlug !== sellerSlug || !MOVES_TO[to].includes(row.state)) return null;
  row.state = to;
  row.updatedAt = now.toISOString();
  return copy(row);
}

/** Deletes one of the shop's listings and its photos (selling spec 2.9). Conversations keep its title (messaging). */
export async function deleteOwnListing(sellerSlug: string, ownerId: string, id: string): Promise<boolean> {
  const { listings } = sampleStore();
  const row = listings.get(id);
  if (!row || row.sellerSlug !== sellerSlug) return false;
  listings.delete(id);
  // Alerts that lead to this listing would only lead to a 404 (search alerts plan amendment 11). The ones that lead to
  // a search's results, or to the shop, stay.
  const { notifications } = sampleStore();
  for (const [noteId, note] of notifications) {
    if ((note.kind === "search-match" || note.kind === "new-listing") && note.href === `/listings/${id}`) {
      notifications.delete(noteId);
    }
  }
  await deletePhotosUsedBy(ownerId, listingPhotoUse(id));
  return true;
}
