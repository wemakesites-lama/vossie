import { connection } from "next/server";
import { getPhoto, isPhotoId } from "@/lib/data/photos";

/**
 * A stored photo (selling spec 2.4): its stripped bytes with their real type. A photo never changes once stored and
 * its id is random, so browsers may keep it for a year; pages show it resized through next/image (plan decision 12).
 * Supabase Storage replaces this route.
 */
export async function GET(_request: Request, { params }: RouteContext<"/photos/[id]">): Promise<Response> {
  // Per request, always: the store changes, so nothing here may be prerendered.
  await connection();
  const { id } = await params;
  const photo = isPhotoId(id) ? await getPhoto(id) : null;
  if (!photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(photo.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
