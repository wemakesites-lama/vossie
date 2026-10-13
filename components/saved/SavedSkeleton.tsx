import { ListingCardSkeleton } from "@/components/listings/ListingCard";

/** Saved's shape while the list streams in (shopping spec 5.4): the count line and 8 card shapes, so nothing jumps. */
export function SavedSkeleton() {
  return (
    <div aria-hidden="true">
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
