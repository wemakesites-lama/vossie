// Opens an iPhone photo (HEIC or HEIF) in a browser that can't (Chrome, Edge and Firefox; Safari can), with libheif's
// WebAssembly build (libheif-js, LGPL-3.0, unmodified). This module and libheif are loaded only when such a photo is
// picked (lib/photos/shrink.ts imports this one by import()), so they're never part of a first visit: about 1.5 MB,
// once, then cached by the browser. Browser only.

/**
 * The photo as a JPEG at high quality, for the usual shrink to re-encode, or null when it can't be read (a broken
 * file, or libheif failing to load). libheif turns the picture the way the file says (its rotation and mirroring).
 */
export async function heicToJpeg(file: File): Promise<File | null> {
  try {
    const { default: libheif } = await import("libheif-js/wasm-bundle");
    const decoder = new libheif.HeifDecoder();
    const [image] = decoder.decode(new Uint8Array(await file.arrayBuffer()));
    if (!image) return null;
    const canvas = document.createElement("canvas");
    canvas.width = image.get_width();
    canvas.height = image.get_height();
    const context = canvas.getContext("2d");
    if (!context) return null;
    const pixels = context.createImageData(canvas.width, canvas.height);
    const shown = await new Promise<boolean>((resolve) => image.display(pixels, (done) => resolve(Boolean(done))));
    if (!shown) return null;
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    canvas.width = canvas.height = 0;
    return blob ? new File([blob], `${file.name.replace(/\.[^.]*$/, "") || "photo"}.jpg`, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
