import Link from "next/link";
import { badgeLabel, priceLabel } from "@/lib/format";
import type { Availability, Listing } from "@/lib/types";
import { Photo } from "./Photo";
import { SaveHeart } from "./SaveHeart";

const STATE_TAGS: Partial<Record<Availability, string>> = { paused: "Not taking orders", sold: "Sold" };

type ListingCardProps = {
  listing: Listing;
  campusName: string;
  /** On the Saved page: the heart starts pressed, and a "Removed" tag shows once it's unpressed (shopping spec 5.3). */
  saved?: boolean;
};

/** A listing in a grid (spec 7.8). The title's link covers the whole card, and the heart sits on top of it. */
export function ListingCard({ listing, campusName, saved = false }: ListingCardProps) {
  const stateTag = STATE_TAGS[listing.availability];
  return (
    <article className="listing-card">
      <Photo
        image={{ src: listing.image.src, alt: "" }}
        ratio="1 / 1"
        sizes="(orientation: landscape) and (max-height: 29.99rem) 23vw, (min-width: 64rem) and (min-height: 30rem) 220px, (min-width: 48rem) and (min-height: 30rem) 30vw, 46vw"
        className="listing-photo"
      />
      <h3 className="listing-title">
        {/* No prefetch: a row of cards would fetch every page as it scrolls past (mobile data). */}
        <Link href={`/listings/${listing.id}`} prefetch={false} className="listing-link">
          {listing.title}
        </Link>
      </h3>
      <p className="listing-price">{priceLabel(listing)}</p>
      <p className="listing-shop">{listing.sellerName}</p>
      <p className="listing-meta">{campusName}</p>
      {listing.badge && <p className="listing-badge">{badgeLabel(listing.badge)}</p>}
      {/* On the photo, but last in reading order (plan decision 6). Only Saved shows paused and sold listings. The
          Removed tag is for sight only: the heart's pressed state already tells screen readers. */}
      {(stateTag || saved) && (
        <div className="listing-tags">
          {stateTag && <p className="listing-tag">{stateTag}</p>}
          {saved && (
            <p className="listing-tag listing-removed" aria-hidden="true">
              Removed
            </p>
          )}
        </div>
      )}
      <SaveHeart id={listing.id} title={listing.title} savedOnServer={saved} />
    </article>
  );
}

/** The card's shape while Just listed streams in (spec section 9). */
export function ListingCardSkeleton() {
  return (
    <div className="listing-card" aria-hidden="true">
      <span className="skeleton listing-photo listing-skeleton-photo" />
      <span className="skeleton listing-skeleton-line" />
      <span className="skeleton listing-skeleton-price" />
      <span className="skeleton listing-skeleton-shop" />
      <span className="skeleton listing-skeleton-meta" />
      <span className="skeleton listing-skeleton-badge" />
    </div>
  );
}
