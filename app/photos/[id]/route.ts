import { connection } from "next/server";
import { getPhoto, isPhotoId } from "@/lib/data/photos";

/**
 * A stored photo (selling spec 2.4): its stripped bytes with their real type. A photo never changes once stored and
 * its id is random, so the device that asked may keep it for a year; pages show it resized through next/image (plan
 * decision 12). The cache header says `private`, so no shared cache or CDN keeps a photo after its listing or account
 * is deleted (amendment 9.4). Supabase Storage replaces this route.
 */
export async function GET(_request: Request, { params }: RouteContext<"/photos/[id]">): Promise<Response> {
  // Per request, always: the store changes, so nothing here may be prerendered. The clock is read after it, because
  // a waiting photo expires a day after it was uploaded whether or not another upload has come along (amendment 9.5).
  await connection();
  const { id } = await params;
  const photo = isPhotoId(id) ? await getPhoto(id, new Date()) : null;
  if (!photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(photo.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
