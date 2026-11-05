"use server";

import { aiFeatureOn } from "@/lib/ai/config";
import { tickCoachAction as tick } from "@/lib/data/coach";
import { done, field } from "@/lib/selling/action-helpers";
import { requireShopOwner } from "@/lib/selling/owner";
import { SELL_PATH } from "@/lib/selling/paths";

// "Mark done" and "Kept on purpose" (AI round two spec 2.1; I1 planning decision 13): a plain form's action. Identity
// comes only from the session. No token (a second press changes nothing), no notice (the tick shows), no tag (nothing
// cached reads coach rows). It ends with done(), back where it was pressed.

const ACTION_ID = /^(check-price|read-tip):[a-z0-9-]{1,100}$/;
export async function tickCoachAction(formData: FormData): Promise<void> {
  const back = field(formData, "from") === "hub" ? "/hub" : SELL_PATH;
  const owner = await requireShopOwner(back);
  const actionId = field(formData, "action");
  if (aiFeatureOn("shop-coach") && owner.status === "approved" && ACTION_ID.test(actionId)) {
    await tick(owner.account.id, owner.shop.slug, actionId, new Date());
  }
  done(back);
}
