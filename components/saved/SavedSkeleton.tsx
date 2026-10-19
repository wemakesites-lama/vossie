import { ListingCardSkeleton } from "@/components/listings/ListingCard";

/**
 * Saved's shape while it streams in (shopping spec 5.4, community actions plan decision 17): the tabs, the note, the
 * count line and 8 card shapes, so nothing jumps.
 */
export function SavedSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton saved-skeleton-tabs" />
      <span className="skeleton saved-skeleton-note" />
      <span className="skeleton saved-skeleton-count" />
      <ul className="card-grid" data-columns="five">
        {Array.from({ length: 8 }, (_, n) => (
          <li key={n}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
