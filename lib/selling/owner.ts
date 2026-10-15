import { redirect } from "next/navigation";
import { getViewer, requireAccount } from "@/lib/auth/session";
import type { SellerRow } from "@/lib/data/rows";
import { getShopOf } from "@/lib/data/shops";
import { safeNextPath } from "@/lib/next-path";
import type { Account, SellerStatus } from "@/lib/types";
import { SELL_PATH } from "./paths";

/** A signed-in seller and their shop: who may act on it (selling spec section 3). */
export type ShopOwner = { account: Account; shop: SellerRow; status: SellerStatus };

/** The signed-in account and its shop, or null. Request-time: call it inside <Suspense>. */
export async function getShopOwner(): Promise<ShopOwner | null> {
  const account = await getViewer();
  if (!account) return null;
  const own = await getShopOf(account.id);
  return own ? { account, ...own } : null;
}

/**
 * The signed-in account's shop (selling spec section 3). Signed out: sign in, then come back to `nextPath`, which must
 * be a path on this site (anything else comes back to /sell). No shop: the pitch at /sell. The account comes only from
 * the session and the shop only from the account, never from a form. Pages call it inside <Suspense>; Server Actions
 * call it first.
 */
export async function requireShopOwner(nextPath: string): Promise<ShopOwner> {
  const account = await requireAccount(safeNextPath(nextPath) ?? SELL_PATH);
  const own = await getShopOf(account.id);
  if (!own) redirect(SELL_PATH);
  return { account, ...own };
}
