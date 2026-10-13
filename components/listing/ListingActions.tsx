import Link from "next/link";
import { SaveHeart } from "@/components/listings/SaveHeart";
import type { Listing } from "@/lib/types";
import { ShareButton } from "./ShareButton";

/**
 * Message seller, Save and Share (spec 5.4). One set of actions: below the tablet step, CSS fixes them to the bottom
 * of the screen as the dock; from it, they sit in the page. Message leads to the sign-in page, which says sign-in is
 * coming (decision 44). A paused or sold listing offers similar items instead (spec 5.5).
 */
export function ListingActions({
  listing,
}: {
  listing: Pick<Listing, "id" | "title" | "categorySlug" | "availability">;
}) {
  const signIn = `/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`;
  return (
    <div className="listing-actions">
      {listing.availability === "available" ? (
        <Link href={signIn} prefetch={false} className="btn btn-primary listing-message">
          Message seller
        </Link>
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
