import { connection } from "next/server";
import { getPhoto, isPhotoId } from "@/lib/data/photos";
import type { PhotoType } from "@/lib/types";

/** The only types this route ever serves, with the file name's extension for each. */
const EXTENSIONS: Readonly<Record<PhotoType, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

/**
 * A stored photo (selling spec 2.4): its stripped bytes with their real type. A photo never changes once stored and
 * its id is random, so browsers may keep it for a year; pages show it resized through next/image (plan decision 12).
 * It reads only the store's photos, by an id that matches the photo pattern, so it can hand out nothing else. A
 * photo waiting on a form is served too (the form's thumbnails); a deleted one is a 404. Supabase Storage replaces
 * this route.
 */
export async function GET(_request: Request, { params }: RouteContext<"/photos/[id]">): Promise<Response> {
  // Per request, always: the store changes, so nothing here may be prerendered.
  await connection();
  const { id } = await params;
  const photo = isPhotoId(id) ? await getPhoto(id) : null;
  // The store holds only JPEG, PNG and WebP (checked by signature); anything else is refused rather than served.
  if (!photo || !Object.hasOwn(EXTENSIONS, photo.type)) return notFound();
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(photo.bytes.byteLength),
      // Private: browsers keep a photo for a year (its id is never reused), but a shared cache in front of the site
      // doesn't, so a photo deleted with its listing or account (POPIA) isn't kept there.
      "Cache-Control": "private, max-age=31536000, immutable",
      // Uploaded bytes: never sniffed as another type, shown rather than run when opened on their own (the same
      // policy Next's image optimizer sends), and saved under a name made from the id. next.config.ts also sends
      // nosniff on every path; it's here too so the photo doesn't depend on that.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "script-src 'none'; frame-src 'none'; sandbox;",
      "Content-Disposition": `inline; filename="${id}.${EXTENSIONS[photo.type]}"`,
    },
  });
}
