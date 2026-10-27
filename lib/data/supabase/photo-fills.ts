import "server-only";
import type * as Sample from "../photo-fills";
import { forServer } from "./clients";

// Photo-to-listing's daily count on Supabase (plan Task 6, change 5). private.photo_fills is reached only through
// public.reserve_photo_fill, granted to the service role. Times come from the database's clock, per UTC hour.

function failed(fn: string, error: { code?: string } | null): never {
  throw new Error(`${fn} failed (${error?.code ?? "unknown"})`);
}

/** One press for `accountId`, counted per UTC hour on the database's clock (plan change 5). */
export const reservePhotoFill: typeof Sample.reservePhotoFill = async (accountId, _now, limit) => {
  const { data, error } = await forServer().rpc("reserve_photo_fill", { p_account_id: accountId, p_max_fills: limit });
  if (error) failed("reserve_photo_fill", error);
  return data === true;
};
