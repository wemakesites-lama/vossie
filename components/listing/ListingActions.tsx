import Link from "next/link";
import { SaveHeart } from "@/components/listings/SaveHeart";
import { MessageSellerLink } from "@/components/messages/SessionLinks";
import type { Listing } from "@/lib/types";
import { ShareButton } from "./ShareButton";

/**
 * Message seller, Save and Share (spec 5.4). One set of actions: below the tablet step, CSS fixes them to the bottom
 * of the screen as the dock; from it, they sit in the page. Message seller follows the session: the static shell's link
 * goes through sign-in to the composer, and the signed-in one, streamed in, to the composer or the visitor's thread
 * about this listing (messaging plan decision 3). A paused or sold listing offers similar items instead (spec 5.5).
 */
export function ListingActions({
  listing,
}: {
  listing: Pick<Listing, "id" | "title" | "categorySlug" | "availability">;
}) {
  return (
    <div className="listing-actions">
      {listing.availability === "available" ? (
        <MessageSellerLink target={{ kind: "listing", listingId: listing.id }} className="btn btn-primary listing-message">
          Message seller
        </MessageSellerLink>
      ) : (
        <Link href={`/browse?cat=${listing.categorySlug}`} className="btn btn-outline text-navy listing-message">
          See similar items
        </Link>
      )}
      <SaveHeart id={listing.id} title={listing.title} className="save-heart-inline" />
      <ShareButton title={listing.title} />
    </div>
  );
}
