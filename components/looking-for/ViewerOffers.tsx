import { getViewer } from "@/lib/auth/session";
import { offersForRequest } from "@/lib/data/offers";
import { getOwnRequest } from "@/lib/data/requests";
import { takeNote } from "@/lib/looking-for/form-state";
import { requestNoteKey } from "@/lib/looking-for/paths";
import { requestNoticeText } from "@/lib/looking-for/words";
import type { LookingForRequest } from "@/lib/types";
import { AskerOffers, PublicOffers } from "./OffersViews";

/**
 * The offers panel once the session is read (community actions plan decision 19): the asker's panel for the asker,
 * the public one for everyone else. An async Server Component: OffersPanel puts it inside <Suspense>. A failed
 * session read gives the signed-out panel, which still works.
 */
export async function ViewerOffers({ request }: { request: LookingForRequest }) {
  const account = await getViewer().catch(() => null);
  if (!account) return <PublicOffers request={request} signedIn={false} />;
  const own = await getOwnRequest(account.id, request.id);
  if (!own) return <PublicOffers request={request} signedIn />;
  const [offers, note] = await Promise.all([offersForRequest(request.id), takeNote(requestNoteKey(request.id))]);
  return <AskerOffers own={own} offers={offers} notice={requestNoticeText(note?.notice)} />;
}
