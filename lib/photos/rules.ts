import type { PhotoType } from "@/lib/types";

// The photos the server takes, and how the browser shrinks them (selling spec 2.3). Plain values, safe anywhere,
// the photo field's client code included.

/** The types, known by their signature (lib/photos/signature.ts). The file input asks for the same ones. */
export const PHOTO_TYPES: readonly PhotoType[] = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
/**
 * The listing photo field also takes iPhone photos (HEIC and HEIF): its code re-encodes every photo as WebP or JPEG
 * before it's sent, so the server still sees only PHOTO_TYPES. Where the browser can't open HEIC (most but Safari's),
 * libheif opens it, loaded only then (lib/photos/heic.ts); a photo neither can read is dropped with a message. Other
 * fields (a shop's photo, a Hub post's) don't re-encode, so they keep PHOTO_ACCEPT.
 */
export const LISTING_PHOTO_ACCEPT = [...PHOTO_TYPES, "image/heic", "image/heif", ".heic", ".heif"].join(",");
/**
 * Each photo, as it arrives: 4 MB (C2/C3 plan decision 16, Lama's go-ahead 2026-10-21). Vercel refuses a request body
 * over 4.5 MB before the action runs, so one post's photos must come to 4 MiB or less, with room for its text (about
 * 300 KB at the very worst). Supabase Storage's bucket keeps 5 MiB as the backstop.
 */
export const PHOTO_MAX_MB = 4;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
/** One post's photos together: 4 MiB. Without JavaScript the form asks for a few photos at a time. */
export const POST_PHOTOS_MAX_BYTES = 4 * 1024 * 1024;
/** Photos per listing, the cover included. */
export const PHOTOS_PER_LISTING = 6;
/** The browser's re-encode: the longest side in pixels, and the WebP (or JPEG) quality. */
export const SHRINK_MAX_SIDE = 1600;
export const SHRINK_QUALITY = 0.8;
/** The qualities the browser tries in turn while a photo is over its share of a post: 0.8, then 0.7, then 0.6. */
export const SHRINK_QUALITIES: readonly number[] = [SHRINK_QUALITY, 0.7, 0.6];
/** Each photo's share of a post's 4 MiB, so the six a listing takes fit together, whichever are new. */
export const SHRINK_PHOTO_BUDGET = Math.floor(POST_PHOTOS_MAX_BYTES / PHOTOS_PER_LISTING);
