import { listOwnListings } from "@/lib/data/own-listings";
import { shopStanding } from "@/lib/data/staff-shops";
import { MY_LISTINGS_FORM, takeNotice } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { requireShopOwner } from "@/lib/selling/owner";
import { myListingsPath, parseListingsTab } from "@/lib/selling/paths";
import { MyListingsView } from "./MyListingsView";

type MyListingsProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * My listings for this seller (selling spec 2.9): request-time, as it reads the link and the session. The notice the
 * last action left is taken as it is shown, so a second visit says nothing (amendment 10.6).
 */
export async function MyListings({ searchParams }: MyListingsProps) {
  const tab = parseListingsTab((await searchParams).tab);
  const owner = await requireShopOwner(myListingsPath(tab));
  const [rows, state, standing] = await Promise.all([
    listOwnListings(owner.shop.slug),
    takeNotice(MY_LISTINGS_FORM),
    shopStanding(owner.account.id),
  ]);
  return (
    <MyListingsView
      tab={tab}
      rows={rows}
      waiting={owner.status === "pending"}
      paused={owner.status === "paused"}
      hubPause={standing?.pausedByHub ? (standing.reason ?? "") : null}
      notice={noticeText(state?.notice)}
      noticeListing={state?.values.listing ?? null}
    />
  );
}
