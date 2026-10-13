import { headers } from "next/headers";
import { readCookie } from "@/lib/cookies";
import { parseSavedIds, SAVED_COOKIE } from "@/lib/saved";

/**
 * The viewer's saved listing ids, newest first (shopping spec 5.1), read from the vossie_saved cookie. It reads the raw
 * Cookie header with the same reader the browser uses, not cookies(): Next's parser keeps the last of two cookies with
 * the name and URL-decodes values, and the browser's keeps the first and decodes nothing. Using one reader means the
 * server and the browser always agree on what's saved. Request-time: call it only inside <Suspense>.
 */
export async function getSavedIds(): Promise<string[]> {
  const header = (await headers()).get("cookie") ?? "";
  return parseSavedIds(readCookie(header, SAVED_COOKIE));
}
