import { onSupabase } from "@/lib/backend";
import { DAY_MS } from "@/lib/messaging/rules";
import { sampleStore } from "./store";

// The daily count of photo-to-listing presses per account (spec decision 12): a counter like the sign-in code sends,
// kept 24 hours, gone with the account, not in the data download (plan change 5).

const supabase = () => import("./supabase/photo-fills");

/** Counts one press for `accountId` and says yes while under `limit` in the 24 hours before `now`; else counts nothing. */
export async function reservePhotoFill(accountId: string, now: Date, limit: number): Promise<boolean> {
  if (onSupabase()) return (await supabase()).reservePhotoFill(accountId, now, limit);
  const store = sampleStore();
  const since = now.getTime() - DAY_MS;
  const recent = (store.photoFills.get(accountId) ?? []).filter((at) => Date.parse(at) > since);
  if (recent.length >= limit) {
    store.photoFills.set(accountId, recent);
    return false;
  }
  store.photoFills.set(accountId, [...recent, now.toISOString()]);
  return true;
}
