import type { PhotoType } from "@/lib/types";

// The photos the server takes, and how the browser shrinks them (selling spec 2.3). Plain values, safe anywhere,
// the photo field's client code included.

/** The types, known by their signature (lib/photos/signature.ts). The file input asks for the same ones. */
export const PHOTO_TYPES: readonly PhotoType[] = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
/** Each photo, as it arrives: 5 MB. */
export const PHOTO_MAX_MB = 5;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
/** Photos per listing, the cover included. */
export const PHOTOS_PER_LISTING = 6;
/** The browser's re-encode: the longest side in pixels, and the WebP (or JPEG) quality. */
export const SHRINK_MAX_SIDE = 1600;
export const SHRINK_QUALITY = 0.8;
