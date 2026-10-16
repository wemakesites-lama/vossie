import { readFormState } from "@/lib/auth/form-state";
import { getCampuses, getCategories, getPickupPoints } from "@/lib/data";
import { retiredPoints } from "@/lib/data/pickup-points";
import { sellingErrors, shopFieldIds } from "@/lib/selling/errors";
import { PROFILE_FORM } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { requireShopOwner } from "@/lib/selling/owner";
import { PROFILE_PATH } from "@/lib/selling/paths";
import { siteUrl } from "@/lib/site-url";
import { ShopProfileView } from "./ShopProfileView";

/** Edit shop for this seller (selling spec 2.11 and section 3): request-time, as it reads the session. */
export async function ShopProfile() {
  const owner = await requireShopOwner(PROFILE_PATH);
  const [state, campuses, categories, pickupPoints] = await Promise.all([
    readFormState(PROFILE_FORM),
    getCampuses(),
    getCategories(),
    getPickupPoints(),
  ]);
  // After a save that went wrong, the form shows what was typed; otherwise the shop as it is.
  const typed = state && state.errors.length > 0 ? state.values : null;
  return (
    <ShopProfileView
      shop={owner.shop}
      status={owner.status}
      typed={typed}
      errors={sellingErrors(state?.errors ?? [], shopFieldIds("profile"))}
      notice={noticeText(state?.notice)}
      campuses={campuses}
      categories={categories}
      pickupPoints={pickupPoints}
      retired={retiredPoints(owner.shop.pickupPointIds)}
      host={new URL(siteUrl()).host}
    />
  );
}
