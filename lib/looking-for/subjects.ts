import { getCampuses, getRequest, getSellerListings } from "@/lib/data";
import { findOffer } from "@/lib/data/offers";
import { requestAskerId } from "@/lib/data/requests";
import type { Account, LookingForRequest } from "@/lib/types";
import { requestOpenOn } from "./rules";

// What an offer is about and whether the visitor can make it (community actions spec 2.8, 2.9 and 2.11; plan
// decisions 12 and 13), looked up once for the composer page and again by sendOffer, which never trusts the form.

export type OfferSubject = { request: LookingForRequest; campusName: string };

/** A request with a page (open or closed, not hidden) and its campus's name; null otherwise (the composer is the 404). */
export async function offerSubject(id: string): Promise<OfferSubject | null> {
  const [request, campuses] = await Promise.all([getRequest(id), getCampuses()]);
  if (!request) return null;
  return { request, campusName: campuses.find((campus) => campus.slug === request.campusSlug)?.name ?? "" };
}

/** Whether this account can offer, with what it needs to; otherwise why not (plan decision 12). */
export type OfferStatus =
  | { kind: "open"; askerId: string; shopSlug: string; listings: { id: string; title: string }[] }
  | { kind: "own" }
  | { kind: "no-shop" }
  | { kind: "pending" }
  | { kind: "paused" }
  | { kind: "offered"; conversationId: string }
  | { kind: "closed" }
  | { kind: "sample" };

/**
 * Only shops offer (spec 2.8): an approved shop with a storefront, not paused. One offer per shop per request, so an
 * offer already made is "offered" (spec 2.9), checked before the shop's own standing: a shop that offered and was
 * paused since can still open its offer (plan amendment 19.7). Then a closed request, and a sample one, which has no
 * one to answer. `today` is the SAST date: a request on its closing day takes no offers, settled or not (stage L spec
 * decision 14).
 */
export async function offerStatus(
  subject: OfferSubject,
  account: Pick<Account, "id" | "seller">,
  today: string,
): Promise<OfferStatus> {
  const { request } = subject;
  const askerId = await requestAskerId(request.id);
  if (askerId === account.id) return { kind: "own" };
  const seller = account.seller;
  if (!seller) return { kind: "no-shop" };
  // A shop with no link yet has made no offer.
  const existing = seller.sellerSlug ? await findOffer(request.id, seller.sellerSlug) : null;
  if (existing) return { kind: "offered", conversationId: existing };
  if (seller.status === "pending" || !seller.sellerSlug) return { kind: "pending" };
  if (seller.status === "paused") return { kind: "paused" };
  if (!requestOpenOn(request, today)) return { kind: "closed" };
  if (!askerId) return { kind: "sample" };
  const listings = await getSellerListings(seller.sellerSlug);
  return {
    kind: "open",
    askerId,
    shopSlug: seller.sellerSlug,
    listings: listings.map((listing) => ({ id: listing.id, title: listing.title })),
  };
}
