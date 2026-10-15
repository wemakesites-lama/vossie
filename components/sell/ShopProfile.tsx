import { readFormState } from "@/lib/auth/form-state";
import { getCampuses, getCategories, getPickupPoints } from "@/lib/data";
import { sellingErrors, shopFieldIds } from "@/lib/selling/errors";
import { PROFILE_FORM, takeNotice } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { requireShopOwner } from "@/lib/selling/owner";
import { PROFILE_PATH } from "@/lib/selling/paths";
import { siteUrl } from "@/lib/site-url";
import { ShopProfileView } from "./ShopProfileView";

/**
 * Edit shop for this seller (selling spec 2.11 and section 3): request-time, as it reads the session. The notice a good
 * save left is taken as it is shown, so a second visit says nothing (amendment 10.6); the errors and typed values a bad
 * save left stay for their 10 minutes, as the wizard's do.
 */
export async function ShopProfile() {
  const owner = await requireShopOwner(PROFILE_PATH);
  const [saved, campuses, categories, pickupPoints] = await Promise.all([
    takeNotice(PROFILE_FORM),
    getCampuses(),
    getCategories(),
    getPickupPoints(),
  ]);
  // A state with a notice is a good save's; otherwise a bad save's errors and typed values may be waiting.
  const state = saved ?? (await readFormState(PROFILE_FORM));
  // After a save that went wrong, the form shows what was typed; otherwise the shop as it is.
  const typed = state && state.errors.length > 0 ? state.values : null;
  return (
    <ShopProfileView
      shop={owner.shop}
      status={owner.status}
      typed={typed}
      errors={sellingErrors(state?.errors ?? [], shopFieldIds("profile"))}
      notice={noticeText(saved?.notice)}
      campuses={campuses}
      categories={categories}
      pickupPoints={pickupPoints}
      host={new URL(siteUrl()).host}
    />
  );
}
