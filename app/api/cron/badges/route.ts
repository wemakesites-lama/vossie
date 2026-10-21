import { connection } from "next/server";
import { onSupabase } from "@/lib/backend";
import { cronAllowed } from "@/lib/cron";
import { recalculateBadges } from "@/lib/data/badges";
import { sellersChangedNow } from "@/lib/data/tags";

/**
 * The nightly trust badges (C4 review fix 6; staff tools spec 2.7's nightly job), called by Vercel Cron (vercel.json,
 * 00:05 SAST) with "Authorization: Bearer <CRON_SECRET>": every owned shop's badge worked out by the sample's rule
 * (recalculateBadges, with the admin client), each that changed written, and `sellers` expired when any did, the way a
 * Route Handler can (updateTag throws here). It answers how many changed, which nothing keeps. Overview and a reply or
 * a sale still work badges out between runs.
 *
 * - Sample mode: a 404, and nothing is worked out (Overview does it there).
 * - A call without exactly the secret, or while CRON_SECRET is unset or shorter than 32 characters: a 401.
 *
 * proxy.ts never sees the call: it has no session cookie.
 */
export async function GET(request: Request): Promise<Response> {
  // Per request, always: never prerendered, and the secret and the clock are read now, never at module scope.
  await connection();
  const headers = { "Cache-Control": "no-store" };
  if (!onSupabase()) return new Response("Not found", { status: 404, headers });
  if (!cronAllowed(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  const changed = await recalculateBadges(new Date());
  if (changed.length > 0) sellersChangedNow();
  return Response.json({ changed: changed.length }, { headers });
}
