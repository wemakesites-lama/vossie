import { connection } from "next/server";
import { onSupabase } from "@/lib/backend";
import { cronAllowed } from "@/lib/cron";
import { sweepPhotos } from "@/lib/data/photos";

/**
 * The daily photo sweep (C2/C3 plan decision 15; backend spec section 7), called by Vercel Cron (vercel.json, 05:20
 * SAST) with "Authorization: Bearer <CRON_SECRET>": waiting photos a day old go, rows and files, and so do files no
 * photo names that are more than an hour old. It answers how many rows and files went, which nothing keeps.
 *
 * - Sample mode: a 404, and nothing is touched (the sample's waiting photos are tidied by the next upload).
 * - A call without exactly the secret, or while CRON_SECRET is unset or shorter than 32 characters: a 401.
 *
 * Nothing serves or uses a waiting photo once it is a day old (photo_file, photo_usable, photoSrcsOf), so the sweep
 * only frees storage, and running once a day is enough. proxy.ts never sees the call: it has no session cookie.
 */
export async function GET(request: Request): Promise<Response> {
  // Per request, always: never prerendered, and the secret is read now, never at module scope.
  await connection();
  const headers = { "Cache-Control": "no-store" };
  if (!onSupabase()) return new Response("Not found", { status: 404, headers });
  if (!cronAllowed(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  return Response.json(await sweepPhotos(new Date()), { headers });
}
