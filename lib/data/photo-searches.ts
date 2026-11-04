import { onSupabase } from "@/lib/backend";
import { DAY_MS } from "@/lib/messaging/rules";
import { sampleStore } from "./store";

// Snap to search's daily count per account (AI features spec 5.4): kept 24 hours, gone with the account, not in the
// data download. The same counter as photo-to-listing's (photo-fills.ts), kept apart so one feature can't use up the
// other's allowance.

const supabase = () => import("./supabase/photo-searches");

/** Counts one search for `accountId` and says yes while under `limit` in the 24 hours before `now`; else counts nothing. */
export async function reservePhotoSearch(accountId: string, now: Date, limit: number): Promise<boolean> {
  if (onSupabase()) return (await supabase()).reservePhotoSearch(accountId, now, limit);
  const store = sampleStore();
  const since = now.getTime() - DAY_MS;
  const recent = (store.photoSearches.get(accountId) ?? []).filter((at) => Date.parse(at) > since);
  if (recent.length >= limit) {
    store.photoSearches.set(accountId, recent);
    return false;
  }
  store.photoSearches.set(accountId, [...recent, now.toISOString()]);
  return true;
}
