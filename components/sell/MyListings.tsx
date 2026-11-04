import { getRequest } from "@/lib/data";
import { listOwnListings } from "@/lib/data/own-listings";
import { shopStanding } from "@/lib/data/staff-shops";
import { requestOpenOn } from "@/lib/looking-for/rules";
import type { Wanted } from "@/lib/looking-for/match";
import { MY_LISTINGS_FORM, takeNotice } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { requireShopOwner } from "@/lib/selling/owner";
import { myListingsPath, parseListingsTab } from "@/lib/selling/paths";
import { readWanted } from "@/lib/selling/wanted";
import { sastDate } from "@/lib/time";
import type { LookingForRequest } from "@/lib/types";
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
  // "Someone's looking for this" (AI stage G planning decision 8): the requests the publish matched, read now through
  // the cached public reader, so a request closed or hidden since is left out and the titles are current. Request-time:
  // the clock is read after the session and the notice.
  const asked = readWanted(state?.values);
  let wanted: Wanted | null = null;
  if (asked) {
    const today = sastDate(new Date());
    const open = (await Promise.all(asked.ids.map((id) => getRequest(id)))).filter(
      (request): request is LookingForRequest => request !== null && requestOpenOn(request, today),
    );
    if (open.length > 0) wanted = { students: asked.students, requests: open.map(({ id, title }) => ({ id, title })) };
  }
  return (
    <MyListingsView
      tab={tab}
      rows={rows}
      waiting={owner.status === "pending"}
      paused={owner.status === "paused"}
      hubPause={standing?.pausedByHub ? (standing.reason ?? "") : null}
      notice={noticeText(state?.notice)}
      noticeListing={state?.values.listing ?? null}
      wanted={wanted}
    />
  );
}
