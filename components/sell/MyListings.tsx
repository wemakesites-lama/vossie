import { readFormState } from "@/lib/auth/form-state";
import { listOwnListings } from "@/lib/data/own-listings";
import { MY_LISTINGS_FORM } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { requireShopOwner } from "@/lib/selling/owner";
import { myListingsPath, parseListingsTab } from "@/lib/selling/paths";
import { MyListingsView } from "./MyListingsView";

type MyListingsProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** My listings for this seller (selling spec 2.9): request-time, as it reads the link and the session. */
export async function MyListings({ searchParams }: MyListingsProps) {
  const tab = parseListingsTab((await searchParams).tab);
  const owner = await requireShopOwner(myListingsPath(tab));
  const [rows, state] = await Promise.all([listOwnListings(owner.shop.slug), readFormState(MY_LISTINGS_FORM)]);
  return (
    <MyListingsView
      tab={tab}
      rows={rows}
      waiting={owner.status === "pending"}
      notice={noticeText(state?.notice)}
      noticeListing={state?.values.listing ?? null}
    />
  );
}
