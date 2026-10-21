import "server-only";
import type { PhotoType } from "@/lib/types";
import { Refused } from "../refused";
import type * as Sample from "../photos";
import { LOOSE_PHOTO_TTL_MS, type Upload } from "../photos";
import { forServer, forViewer } from "./clients";
import { forViewerAs } from "./viewer";

// Photos on Supabase (C2/C3 plan decisions 11 to 15; backend spec sections 6 and 7). A photo is a row in public.photos
// and a file in Storage's private photos bucket, at {owner}/{id}, or hub/{id} for the Hub's covers.
//
// - Rows first, then files (decision 12). The row is made by a user action through the viewer's client (add_photos,
//   or add_hub_photo for the Hub), and the file is uploaded with the admin client to the path the row names. If an
//   upload fails, the rows just made and any files already uploaded go, and the call throws: a row never points at a
//   missing file for longer than the request.
// - Files a database function no longer needs (its removed_paths) go through removePhotoFiles, which never throws: a
//   file it couldn't remove is an orphan, and the daily sweep (/api/cron/photos, sweepPhotos) takes it.
// - forServer() only for the files, the route's lookup (photo_file) and the sweep (decision 4). Never inside "use cache".
// - Using a photo (attachPhotos, deletePhotosUsedBy) and forgetting an account's (deletePhotosOf) happen inside the
//   database functions that need them (save_listing, create_shop, update_shop, save_onboarding_draft, delete_listing,
//   save_hub_post, forget_account), so those TypeScript calls throw here, except the Hub's, which do nothing (decision
//   14 and amendment 4).

const BUCKET = "photos";
/** The Hub's photos' owner in the app (lib/staff/hub-actions.ts's HUB_PHOTOS); in the database, no owner. */
const HUB_OWNER = "hub";
/** A Hub cover waiting for its form (add_hub_photo): the Hub's "no use yet". */
const HUB_WAITING = "hub-draft";
/** A bare, lower-case uuid: the only photo id Supabase knows (decision 13). Anything else is a miss, never a query. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREFIX = "/photos/";
/** Storage removes up to this many files a call. */
const REMOVE_BATCH = 100;
/** orphan_photo_paths' page, and how many pages one sweep takes at most. */
const ORPHAN_PAGE = 1_000;
const ORPHAN_PAGES = 10;

/**
 * The database's photo id in a photo's address, or null (amendment 10): only /photos/<uuid>. A sample address
 * (/photos/ph-…) or a placeholder's is null, so a forged one goes to SQL as a placeholder and is refused there, never a
 * uuid cast error.
 */
export function dbPhotoId(src: string): string | null {
  const id = src.startsWith(PREFIX) ? src.slice(PREFIX.length) : "";
  return UUID.test(id) ? id : null;
}

/** A photo row just made: its id and the file's path. */
export type MadePhoto = { id: string; path: string };

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

function statusOf(error: unknown): string {
  const status = (error as { status?: unknown; statusCode?: unknown } | null)?.status ?? (error as { statusCode?: unknown } | null)?.statusCode;
  return status === undefined || status === null ? "unknown" : String(status);
}

/**
 * Removes these files from the photos bucket, 100 at a time, and gives back how many went. Never throws: a failure is
 * logged with its status and the count only, never a path or an id, and the file is left to the sweep.
 */
export async function removePhotoFiles(paths: readonly string[]): Promise<number> {
  if (paths.length === 0) return 0;
  let removed = 0;
  for (let from = 0; from < paths.length; from += REMOVE_BATCH) {
    const batch = paths.slice(from, from + REMOVE_BATCH);
    try {
      const { data, error } = await forServer().storage.from(BUCKET).remove([...batch]);
      if (error) console.error(`[vossie] photo files not removed (${statusOf(error)}, ${batch.length})`);
      else removed += data?.length ?? 0;
    } catch (error) {
      console.error(`[vossie] photo files not removed (${statusOf(error)}, ${batch.length})`);
    }
  }
  return removed;
}

/**
 * Uploads each upload's bytes to its row's path, with its type, never over a file that's there. If any fails, the
 * rows (admin) and the files that did upload go, and it throws.
 */
export async function uploadPhotoFiles(made: readonly MadePhoto[], uploads: readonly Upload[]): Promise<void> {
  const results = await Promise.allSettled(
    made.map(async (photo, i) => {
      const { error } = await forServer()
        .storage.from(BUCKET)
        .upload(photo.path, uploads[i].bytes, { contentType: uploads[i].type, upsert: false });
      if (error) throw new Error(`photo upload failed (${statusOf(error)})`);
    }),
  );
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (!failure) return;
  const uploaded = made.filter((_, i) => results[i].status === "fulfilled").map((photo) => photo.path);
  await removePhotoFiles(uploaded);
  const { error } = await forServer()
    .from("photos")
    .delete()
    .in(
      "id",
      made.map((photo) => photo.id),
    );
  if (error) console.error(`[vossie] photo rows not removed (${error.code ?? "unknown"}, ${made.length})`);
  throw failure.reason instanceof Error ? failure.reason : new Error("photo upload failed");
}

type Made = { photos: MadePhoto[]; removed: string[] };

/** A student's rows, through their own client (add_photos: one to six, the newest 12 kept). */
async function addOwnRows(ownerId: string, uploads: readonly Upload[]): Promise<Made> {
  const { data, error } = await (await forViewerAs(ownerId)).rpc("add_photos", { p_types: uploads.map((u) => u.type) });
  if (error) failed("add_photos", error);
  const answer = data as { photos: MadePhoto[]; removed_paths: string[] };
  return { photos: answer.photos, removed: answer.removed_paths };
}

/** The Hub's rows, one call each (add_hub_photo), by Hub staff only. A later one failing takes the earlier ones' rows. */
async function addHubRows(uploads: readonly Upload[]): Promise<Made> {
  const db = await forViewer();
  const made: Made = { photos: [], removed: [] };
  try {
    for (const upload of uploads) {
      const { data, error } = await db.rpc("add_hub_photo", { p_type: upload.type });
      if (error) failed("add_hub_photo", error);
      const answer = data as { result: string; id?: string; path?: string; removed_paths?: string[] };
      if (answer.result !== "created" || !answer.id || !answer.path) throw new Refused("forbidden");
      made.photos.push({ id: answer.id, path: answer.path });
      made.removed.push(...(answer.removed_paths ?? []));
    }
  } catch (error) {
    if (made.photos.length > 0) {
      await forServer()
        .from("photos")
        .delete()
        .in(
          "id",
          made.photos.map((photo) => photo.id),
        );
    }
    await removePhotoFiles(made.removed);
    throw error;
  }
  return made;
}

export const storePhotos: typeof Sample.storePhotos = async (ownerId, uploads) => {
  if (uploads.length === 0) return [];
  const made = ownerId === HUB_OWNER ? await addHubRows(uploads) : await addOwnRows(ownerId, uploads);
  try {
    await uploadPhotoFiles(made.photos, uploads);
  } finally {
    // The rows add_photos trimmed are gone whether the upload worked or not (amendment 13).
    await removePhotoFiles(made.removed);
  }
  return made.photos.map((photo) => `${PREFIX}${photo.id}`);
};

export const photoFor: typeof Sample.photoFor = async (id, viewer) => {
  if (!UUID.test(id)) return null;
  const { data, error } = await forServer().rpc("photo_file", { p_photo: id }).maybeSingle();
  if (error) failed("photo_file", error);
  if (!data) return null;
  const forEveryone = !data.owner_only && !data.hub_only;
  if (!forEveryone) {
    const who = await viewer();
    if (data.owner_only && who?.id !== data.owner_only) return null;
    if (data.hub_only && !who?.hubStaff) return null;
  }
  const file = await forServer().storage.from(BUCKET).download(data.path);
  if (file.error) return null;
  return { type: data.type as PhotoType, bytes: new Uint8Array(await file.data.arrayBuffer()), forEveryone };
};

export const photoSrcsOf: typeof Sample.photoSrcsOf = async (ownerId, use, now) => {
  const hub = ownerId === HUB_OWNER;
  let query = (hub ? await forViewer() : await forViewerAs(ownerId)).from("photos").select("id, use, created_at");
  query = hub ? query.is("owner_id", null) : query.eq("owner_id", ownerId);
  const wanted = hub && use === null ? HUB_WAITING : use;
  query = wanted === null ? query.is("use", null) : query.eq("use", wanted);
  const { data, error } = await query;
  if (error) failed("photos", error);
  // A waiting photo a day old or more is left out, as the sample does, though the sweep hasn't taken it yet.
  const since = now.getTime() - LOOSE_PHOTO_TTL_MS;
  return new Set(
    data
      .filter((row) => (row.use !== null && row.use !== HUB_WAITING) || Date.parse(row.created_at) > since)
      .map((row) => `${PREFIX}${row.id}`),
  );
};

function inTheDatabase(fn: string): never {
  throw new Error(`${fn} runs in the database on Supabase`);
}

export const attachPhotos: typeof Sample.attachPhotos = async (ownerId) => {
  // save_hub_post moves the Hub's cover itself (decision 14).
  if (ownerId === HUB_OWNER) return;
  inTheDatabase("attachPhotos");
};

export const deletePhotosUsedBy: typeof Sample.deletePhotosUsedBy = async (ownerId) => {
  if (ownerId === HUB_OWNER) return;
  inTheDatabase("deletePhotosUsedBy");
};

export const deletePhotosOf: typeof Sample.deletePhotosOf = async () => {
  inTheDatabase("deletePhotosOf");
};

export const sweepPhotos: typeof Sample.sweepPhotos = async () => {
  const swept = await forServer().rpc("sweep_waiting_photos");
  if (swept.error) failed("sweep_waiting_photos", swept.error);
  let files = await removePhotoFiles(swept.data);
  // Files no row names, a page at a time, while a page comes back full and its files went.
  for (let page = 0; page < ORPHAN_PAGES; page += 1) {
    const orphans = await forServer().rpc("orphan_photo_paths", { p_limit: ORPHAN_PAGE });
    if (orphans.error) failed("orphan_photo_paths", orphans.error);
    const removed = await removePhotoFiles(orphans.data);
    files += removed;
    if (orphans.data.length < ORPHAN_PAGE || removed === 0) break;
  }
  return { rows: swept.data.length, files };
};
