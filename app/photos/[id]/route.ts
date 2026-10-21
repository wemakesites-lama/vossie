import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { isPhotoId, photoFor } from "@/lib/data/photos";
import { canUse } from "@/lib/staff/roles";

/**
 * A stored photo (selling spec 2.4): its stripped bytes with their real type. A photo never changes once stored and
 * its id is random, so the device that asked may keep it for a year; pages show it resized through next/image (plan
 * decision 12). The cache header says `private`, so no shared cache or CDN keeps a photo after its listing or account
 * is deleted (amendment 9.4). On Supabase the route stays and Storage holds the files (spec section 6): photoFor asks
 * the database who may see each photo (C2/C3 plan decision 11).
 */
export async function GET(_request: Request, { params }: RouteContext<"/photos/[id]">): Promise<Response> {
  // Per request, always: the store changes, so nothing here may be prerendered. The clock is read after it, because
  // a waiting photo expires a day after it was uploaded whether or not another upload has come along (amendment 9.5).
  await connection();
  const { id } = await params;
  // The session is read per request, and only when the photo isn't everyone's: a hidden listing's photos go to its
  // owner only (staff tools amendment 13.5), and on Supabase the Hub's waiting and unpublished covers to Hub staff.
  const viewer = async () => {
    const account = await getViewer();
    return account ? { id: account.id, hubStaff: canUse(account, "hub") } : null;
  };
  const photo = isPhotoId(id) ? await photoFor(id, viewer, new Date()) : null;
  if (!photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(photo.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
