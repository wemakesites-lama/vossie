import type { Upload } from "@/lib/data/photos";
import { PHOTO_MAX_BYTES } from "@/lib/photos/rules";
import { photoTypeOf } from "@/lib/photos/signature";
import { stripMetadata } from "@/lib/photos/strip-metadata";

export type UploadError = "photo-type" | "photo-size" | "photo-unreadable" | "photo-count";

/**
 * Posted photo files, checked (selling spec 2.3, plan decision 11): at most `room` good ones, each up to 5 MB, each a
 * JPEG, PNG or WebP by its signature, each stripped of its metadata. Good ones come back in order, with null in a
 * refused one's place, so "new:<n>" still points at the right file. Each kind of problem is reported once. Nothing
 * is stored here.
 */
export async function readUploads(
  files: readonly File[],
  room: number,
): Promise<{ uploads: (Upload | null)[]; errors: UploadError[] }> {
  const errors = new Set<UploadError>();
  const uploads: (Upload | null)[] = [];
  // Only good photos take up room, so a refused file doesn't push a good one out.
  let accepted = 0;
  for (const file of files) {
    const result = await check(file, accepted < room);
    if (typeof result === "string") {
      errors.add(result);
      uploads.push(null);
    } else {
      accepted += 1;
      uploads.push(result);
    }
  }
  return { uploads, errors: [...errors] };
}

async function check(file: File, hasRoom: boolean): Promise<Upload | UploadError> {
  if (!hasRoom) return "photo-count";
  if (file.size > PHOTO_MAX_BYTES) return "photo-size";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = photoTypeOf(bytes);
  if (!type) return "photo-type";
  const stripped = stripMetadata(bytes, type);
  return stripped ? { type, bytes: stripped } : "photo-unreadable";
}
