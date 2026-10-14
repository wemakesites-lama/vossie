/** The feed's shape while it streams in (community spec 3): the tab row and three cards, so nothing jumps. */
export function HubFeedSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton hub-feed-skeleton-tabs" />
      <ul className="hub-feed-list">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <span className="skeleton hub-card-skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}
