import { connection } from "next/server";
import { workerSource } from "@/lib/offline";

/**
 * The service worker (community actions spec 2.21): its source, sent per request (connection()) so the header here is
 * exactly what goes out, with no-cache so a fix arrives on the next visit. WORKER_ON in lib/offline.ts is the kill
 * switch. Served from the site's root, so its scope is the whole site.
 */
export async function GET(): Promise<Response> {
  await connection();
  return new Response(workerSource(), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
