import Link from "next/link";
import { badgeLabel, priceLabel } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { Photo } from "./Photo";
import { SaveHeart } from "./SaveHeart";

/** A listing in a grid (spec 7.8). The title's link covers the whole card, and the heart sits on top of it. */
export function ListingCard({ listing, campusName }: { listing: Listing; campusName: string }) {
  return (
    <article className="listing-card">
      <Photo
        image={{ src: listing.image.src, alt: "" }}
        ratio="1 / 1"
        sizes="(orientation: landscape) and (max-height: 29.99rem) 23vw, (min-width: 64rem) and (min-height: 30rem) 220px, (min-width: 48rem) and (min-height: 30rem) 30vw, 46vw"
        className="listing-photo"
      />
      <h3 className="listing-title">
        <Link href={`/listings/${listing.id}`} className="listing-link">
          {listing.title}
        </Link>
      </h3>
      <p className="listing-price">{priceLabel(listing)}</p>
      <p className="listing-meta">{campusName}</p>
      {listing.badge && <p className="listing-badge">{badgeLabel(listing.badge)}</p>}
      <SaveHeart id={listing.id} title={listing.title} />
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
      <span className="skeleton listing-skeleton-meta" />
      <span className="skeleton listing-skeleton-badge" />
    </div>
  );
}
