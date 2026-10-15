// The browser's part of a photo's way to the server (selling spec 2.3, plan decision 10). Browser code only: the photo
// field (components/sell/PhotoField.tsx) loads this module with import() the first time a photo is picked, so no
// page's first load carries it. It imports nothing: the sizes and quality come from lib/photos/rules.ts by way of the
// server (components/sell/PhotoFieldset.tsx), so no module is shared with the page's own code.

/** How to shrink: the longest side in pixels, and the WebP (or JPEG) quality (SHRINK_MAX_SIDE and SHRINK_QUALITY). */
export type ShrinkTo = { side: number; quality: number };

/** A picture's size with its longest side at most `max`: never bigger than it was, and at least 1px each way. */
export function fitWithin(width: number, height: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * The photo with its longest side at most `to.side` (1,600px), re-encoded as WebP at `to.quality` (0.8), or JPEG where
 * the browser can't encode WebP (Safari), which leaves every bit of hidden data behind. Even a small photo is
 * re-encoded. A photo the browser can't decode comes back as it is, for the server to check and strip.
 */
export async function shrink(file: File, to: ShrinkTo): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = fitWithin(bitmap.width, bitmap.height, to.side);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob = await encode(canvas, "image/webp", to.quality);
    if (blob?.type !== "image/webp") blob = await encode(canvas, "image/jpeg", to.quality);
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]*$/, "") || "photo"}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
