import { connection } from "next/server";
import { aiFeatureOn } from "@/lib/ai/config";
import { onSupabase } from "@/lib/backend";
import { cronAllowed } from "@/lib/cron";
import { backfillRequestMatches } from "@/lib/data/request-reading";

/**
 * The one-off backfill of "Someone's looking for this" (AI round two spec 5; AI stage G planning decision 10): open
 * Looking For requests made before stage G, read into their stored search, 15 a call, oldest first. Called by hand,
 * never by Vercel Cron (it isn't in vercel.json), with "Authorization: Bearer <CRON_SECRET>", until `more` is false.
 * It writes only the stored search, which no cached page reads, so it expires no tag.
 *
 * - Sample mode, or the switch off: a 404, and nothing is read.
 * - A call without exactly the secret, or while CRON_SECRET is unset or shorter than 32 characters: a 401.
 *
 * proxy.ts never sees the call: it has no session cookie.
 */
export async function GET(request: Request): Promise<Response> {
  // Per request, always: never prerendered, and the secret and the clock are read now, never at module scope.
  await connection();
  const headers = { "Cache-Control": "no-store" };
  if (!onSupabase() || !aiFeatureOn("looking-match")) return new Response("Not found", { status: 404, headers });
  if (!cronAllowed(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  return Response.json(await backfillRequestMatches(new Date()), { headers });
}
