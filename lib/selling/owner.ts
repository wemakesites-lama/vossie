import { redirect } from "next/navigation";
import { getViewer, requireAccount } from "@/lib/auth/session";
import type { SellerRow } from "@/lib/data/rows";
import { getShopOf } from "@/lib/data/shops";
import type { Account, SellerStatus } from "@/lib/types";
import { SELL_PATH } from "./paths";

/**
 * A signed-in seller and their shop: who may act on it (selling spec section 3). `pausedByHub`: the Hub paused it, so
 * the Hub resumes it (C2/C3 plan decision 8).
 */
export type ShopOwner = { account: Account; shop: SellerRow; status: SellerStatus; pausedByHub: boolean };

/** The signed-in account and its shop, or null. Request-time: call it inside <Suspense>. */
export async function getShopOwner(): Promise<ShopOwner | null> {
  const account = await getViewer();
  if (!account) return null;
  const own = await getShopOf(account.id);
  return own ? { account, ...own } : null;
}

/**
 * The signed-in account's shop (selling spec section 3). Signed out: sign in, then come back to `nextPath`. No shop:
 * the pitch at /sell. Pages call it inside <Suspense>; Server Actions call it first.
 */
export async function requireShopOwner(nextPath: string): Promise<ShopOwner> {
  const account = await requireAccount(nextPath);
  const own = await getShopOf(account.id);
  if (!own) redirect(SELL_PATH);
  return { account, ...own };
}
