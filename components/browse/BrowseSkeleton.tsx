import { ListingCardSkeleton } from "@/components/listings/ListingCard";

/** The browse page's shape while it streams in (spec section 8): the same sizes, so nothing jumps. */
export function BrowseSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="browse-head">
        <div>
          <span className="skeleton browse-skeleton-eyebrow" />
          <span className="skeleton browse-skeleton-title" />
        </div>
        <span className="skeleton browse-skeleton-search" />
      </div>
      <span className="skeleton browse-skeleton-tabs" />
      <span className="skeleton browse-skeleton-tools" />
      <ul className="results-grid">
        {Array.from({ length: 8 }, (_, n) => (
          <li key={n}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
