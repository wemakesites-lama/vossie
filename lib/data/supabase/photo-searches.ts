import "server-only";
import type * as Sample from "../photo-searches";
import { forServer } from "./clients";

// Snap to search's daily count on Supabase (AI features spec 5.4, stage D). private.photo_searches is reached only
// through public.reserve_photo_search, granted to the service role. Times come from the database's clock, per UTC hour.

function failed(fn: string, error: { code?: string } | null): never {
  throw new Error(`${fn} failed (${error?.code ?? "unknown"})`);
}

/** One search for `accountId`, counted per UTC hour on the database's clock, as photo-to-listing's presses are. */
export const reservePhotoSearch: typeof Sample.reservePhotoSearch = async (accountId, _now, limit) => {
  const { data, error } = await forServer().rpc("reserve_photo_search", {
    p_account_id: accountId,
    p_max_searches: limit,
  });
  if (error) failed("reserve_photo_search", error);
  return data === true;
};
