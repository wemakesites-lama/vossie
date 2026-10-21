import Link from "next/link";
import { offersLabel, offersSoFarLabel } from "@/lib/format";
import { offerPath } from "@/lib/looking-for/paths";
import { threadPath } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import { sastDateTime } from "@/lib/time";
import type { LookingForRequest, OfferSummary, OwnRequest } from "@/lib/types";
import { RequestActions } from "./RequestActions";

// The two versions of the request page's offers panel (community actions plan, Task 15). Pure views with no session:
// OffersPanel (the <Suspense>) and ViewerOffers (the session's part) both use them, so neither imports the other.

/**
 * Everyone's view of the offers (community spec 4.2): the count and Offer to help, which opens the composer, through
 * sign-in when signed out (community actions spec section 3); or "This request is closed". The static shell has the
 * signed-out version, so the session's version has the same size and nothing moves. `open`: whether it takes offers
 * today. The static shell passes the cached status; the session's part works it out by date, so on a closing day Offer
 * to help gives way to "This request is closed" as the page finishes (stage L spec decision 15).
 */
export function PublicOffers({
  request,
  signedIn,
  open,
}: {
  request: LookingForRequest;
  signedIn: boolean;
  open: boolean;
}) {
  if (!open) return <p className="request-offers-count">This request is closed</p>;
  const composer = offerPath(request.id);
  return (
    <>
      <p className="request-offers-count">{offersSoFarLabel(request.offers)}</p>
      <Link href={signedIn ? composer : signInHref(composer)} prefetch={false} className="btn btn-primary request-offer">
        Offer to help
      </Link>
    </>
  );
}

type AskerOffersProps = {
  own: OwnRequest;
  /** Newest first. */
  offers: readonly OfferSummary[];
  /** The last action's words, once (plan decision 7). */
  notice: string | null;
};

/**
 * The asker's view (community actions spec 2.13, plan decision 19): "Your request", the count, each offer (the shop,
 * the time in SAST and the offer's first line, linking to the thread), and what they can do with it.
 */
export function AskerOffers({ own, offers, notice }: AskerOffersProps) {
  const { request, state } = own;
  return (
    <>
      <p className="request-offers-eyebrow">Your request</p>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      <p className="request-offers-count">{offersLabel(request.offers)}</p>
      {state === "closed" && <p className="request-offers-state">This request is closed</p>}
      {offers.length > 0 && (
        <ul className="request-offers-list">
          {offers.map((offer) => (
            <li key={offer.conversationId}>
              <Link href={threadPath(offer.conversationId)} prefetch={false} className="request-offers-row">
                <span className="request-offers-shop">{offer.shopName}</span>{" "}
                <time dateTime={offer.offeredAt} className="request-offers-time">
                  {sastDateTime(offer.offeredAt)}
                </time>{" "}
                <span className="request-offers-preview">{offer.preview}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {state === "open" && <p className="form-hint">Found it? Close it so shops stop offering.</p>}
      <RequestActions own={own} from="page" />
    </>
  );
}
