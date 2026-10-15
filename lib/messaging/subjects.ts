import { getCampuses, getListingDetail, getRequest, getSeller, isShopPaused } from "@/lib/data";
import type { Account, Listing, ReportTarget, Seller } from "@/lib/types";
import { targetPath, type MessageTarget } from "./paths";

// What a first message or a report is about, looked up once for the page and again by its Server Action, which never
// trusts the form for it (messaging spec 3.1 and 3.4).

/** Where a first message goes (spec 3.1, plan decision 2). */
export type ComposerSubject = {
  target: MessageTarget;
  /** The listing, for a first message about one; null for a question to the shop. */
  listing: Listing | null;
  seller: Seller;
  campusName: string;
  /** The composer offers a swap when the listing takes swaps (spec 2.4). */
  swaps: boolean;
  /**
   * A paused or sold listing can't be messaged (spec 3.1), nor can a paused shop (selling plan amendment 10). Replies
   * in a conversation already started still go.
   */
  open: boolean;
};

export async function composerSubject(target: MessageTarget): Promise<ComposerSubject | null> {
  if (target.kind === "listing") {
    const detail = await getListingDetail(target.listingId);
    if (!detail) return null;
    return {
      target,
      listing: detail.listing,
      seller: detail.seller,
      campusName: detail.campus.name,
      swaps: detail.listing.payMode !== "cash",
      open: detail.listing.availability === "available",
    };
  }
  const [seller, campuses, paused] = await Promise.all([
    getSeller(target.sellerSlug),
    getCampuses(),
    isShopPaused(target.sellerSlug),
  ]);
  if (!seller) return null;
  const campusName = campuses.find((campus) => campus.slug === seller.campusSlug)?.name ?? "";
  return { target, listing: null, seller, campusName, swaps: false, open: !paused };
}

/** The account's storefront's slug, when it has one (an approved or paused shop; a pending one has none yet). */
export function shopSlugOf(account: Pick<Account, "seller">): string | null {
  return account.seller?.sellerSlug ?? null;
}

/** What a report is about, and the way back to it (spec 3.4). */
export type ReportSubject = { title: string; href: string; backLabel: string };

export async function reportSubject(target: ReportTarget): Promise<ReportSubject | null> {
  const href = targetPath(target);
  if (target.kind === "listing") {
    const detail = await getListingDetail(target.id);
    return detail ? { title: detail.listing.title, href, backLabel: "Back to the listing" } : null;
  }
  if (target.kind === "seller") {
    const seller = await getSeller(target.id);
    return seller ? { title: seller.name, href, backLabel: "Back to the shop" } : null;
  }
  const request = await getRequest(target.id);
  return request ? { title: request.title, href, backLabel: "Back to the request" } : null;
}
