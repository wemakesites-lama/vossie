import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { offersForRequest } from "@/lib/data/offers";
import { getOwnRequest, settleRequests } from "@/lib/data/requests";
import { takeNote } from "@/lib/looking-for/form-state";
import { requestNoteKey } from "@/lib/looking-for/paths";
import { requestOpenOn } from "@/lib/looking-for/rules";
import { requestNoticeText } from "@/lib/looking-for/words";
import { sastDate } from "@/lib/time";
import type { LookingForRequest } from "@/lib/types";
import { AskerOffers, PublicOffers } from "./OffersViews";

/**
 * The offers panel once the session is read (community actions plan decision 19): the asker's panel for the asker,
 * the public one for everyone else. An async Server Component: OffersPanel puts it inside <Suspense>. A failed
 * session read gives the signed-out panel, which still works. Whether the request takes offers is worked out from
 * today, since the page's cached copy may still say open on its closing day, and a due request's close is stored here
 * (stage L spec decisions 11 and 15).
 */
export async function ViewerOffers({ request }: { request: LookingForRequest }) {
  await connection();
  const now = new Date();
  await settleRequests(now);
  const open = requestOpenOn(request, sastDate(now));
  const account = await getViewer().catch(() => null);
  if (!account) return <PublicOffers request={request} signedIn={false} open={open} />;
  const own = await getOwnRequest(account.id, request.id, now);
  if (!own) return <PublicOffers request={request} signedIn open={open} />;
  const [offers, note] = await Promise.all([offersForRequest(request.id), takeNote(requestNoteKey(request.id))]);
  return <AskerOffers own={own} offers={offers} notice={requestNoticeText(note?.notice)} />;
}
