// The browser's part of a photo's way to the server (selling spec 2.3, plan decision 10). Browser code only: the photo
// field (components/sell/PhotoField.tsx) loads this module with import() the first time a photo is picked, so no
// page's first load carries it. It imports nothing at first: the sizes and quality come from lib/photos/rules.ts by way
// of the server (components/sell/PhotoFieldset.tsx), so no module is shared with the page's own code. Only an iPhone
// photo the browser can't open brings in lib/photos/heic.ts, and libheif with it.

/** An iPhone photo (HEIC or HEIF), by its type or its name's ending (some browsers give HEIC no type). */
const heic = (file: File) => /hei[cf]/i.test(`${file.type} ${file.name.slice(-5)}`);

/**
 * How to shrink: the longest side in pixels and the WebP (or JPEG) quality (SHRINK_MAX_SIDE and SHRINK_QUALITY), and,
 * to keep a post under Vercel's 4.5 MB request body (C2/C3 plan decision 16), the most bytes the photo may take
 * (SHRINK_PHOTO_BUDGET, its share of POST_PHOTOS_MAX_BYTES) with the qualities to try in turn (SHRINK_QUALITIES).
 */
export type ShrinkTo = { side: number; quality: number; budget?: number; qualities?: readonly number[] };

/** A picture's size with its longest side at most `max`: never bigger than it was, and at least 1px each way. */
export function fitWithin(width: number, height: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** The decoded photo drawn at its new size and encoded: WebP, else JPEG on white. Null when there's nothing to give. */
async function reencode(bitmap: ImageBitmap, to: ShrinkTo): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const [width, height] = fitWithin(bitmap.width, bitmap.height, to.side);
  [canvas.width, canvas.height] = [width, height];
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  const webp = await encode(canvas, "image/webp", to.quality);
  if (webp?.type === "image/webp") return webp;
  // JPEG has no transparency, and a transparent pixel would turn black: white goes down first.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return encode(canvas, "image/jpeg", to.quality);
}

/**
 * `files` re-encoded at each of `qualities` in turn (0.8, then 0.7, then 0.6), one photo at a time, until together
 * they come to `budget` bytes or less (C2/C3 plan decision 16). Each is re-encoded at the first quality, even a small
 * one; at the last, what it has is given back, over or not.
 */
export async function shrinkAll(
  files: readonly File[],
  budget: number,
  qualities: readonly number[],
  encode: (file: File, quality: number) => Promise<File>,
): Promise<File[]> {
  let out: File[] = [...files];
  for (const quality of qualities) {
    out = [];
    for (const file of files) out.push(await encode(file, quality));
    if (out.reduce((sum, file) => sum + file.size, 0) <= budget) break;
  }
  return out;
}

/** The photo drawn at `to.side` and encoded at `quality`, or the original when that doesn't work. */
async function shrinkOnce(file: File, side: number, quality: number): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const blob = await reencode(bitmap, { side, quality }).finally(() => bitmap.close());
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]*$/, "") || "photo"}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}

/**
 * The photo with its longest side at most `to.side` (1,600px), turned the way its Exif says, re-encoded as WebP at
 * `to.quality` (0.8), or JPEG on white where the browser can't encode WebP (Safari), which leaves every bit of hidden
 * data behind. Even a small photo is re-encoded. While it's over `to.budget`, its share of a post's 4 MiB, it's
 * re-encoded at the lower `to.qualities` (0.7, then 0.6), so a post's photos fit Vercel's request body (C2/C3 plan
 * decision 16). Anything that doesn't work (a photo the browser can't decode, a browser that refuses the orientation
 * option, no 2D context, no blob) gives the original back, for the server to check and strip (amendment 11.3). The
 * decoded photo is let go as soon as it's drawn, whatever happens.
 */
export async function shrink(file: File, to: ShrinkTo): Promise<File> {
  const qualities = to.budget === undefined ? [to.quality] : (to.qualities ?? [to.quality]);
  const source = heic(file) ? await openableHeic(file) : file;
  const [small] = await shrinkAll([source], to.budget ?? Infinity, qualities, (each, quality) =>
    shrinkOnce(each, to.side, quality),
  );
  return small;
}

/**
 * An iPhone photo this browser can open as it is (Safari), or a JPEG made from it with libheif, loaded only now
 * (lib/photos/heic.ts), decoded once however many qualities the shrink tries. The original when neither works: the
 * photo field then drops it and says why, since the server takes only JPEG, PNG and WebP.
 */
async function openableHeic(file: File): Promise<File> {
  try {
    (await createImageBitmap(file)).close();
    return file;
  } catch {
    const { heicToJpeg } = await import("./heic");
    return (await heicToJpeg(file)) ?? file;
  }
}
