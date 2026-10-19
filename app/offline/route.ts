import { OFFLINE_PAGE } from "@/lib/offline";

/**
 * The offline page (community actions spec 2.20): a whole document from a route handler, so it needs none of the
 * site's script and style files. It reads no request data, so the build prerenders it. Search engines leave it out
 * (the header here, and robots.txt).
 */
export function GET(): Response {
  return new Response(OFFLINE_PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
