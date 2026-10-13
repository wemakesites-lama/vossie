import { cookies } from "next/headers";
import { parseSavedIds, SAVED_COOKIE } from "@/lib/saved";

/**
 * The viewer's saved listing ids, newest first (shopping spec 5.1), read from the vossie_saved cookie with the same
 * rules as the browser. Request-time: call it only inside <Suspense>.
 */
export async function getSavedIds(): Promise<string[]> {
  const store = await cookies();
  return parseSavedIds(store.get(SAVED_COOKIE)?.value);
}
