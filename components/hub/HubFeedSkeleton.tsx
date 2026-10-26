/**
 * Coming up's shape while it streams in (Launchpad spec 4.2): its heading, the tab row and three rows, so nothing
 * jumps. No taller than the shortest state (nothing planned and no tips).
 */
export function HubFeedSkeleton() {
  return (
    <div aria-hidden="true" className="hub-section">
      <span className="skeleton hub-feed-skeleton-title" />
      <span className="skeleton hub-feed-skeleton-tabs" />
      <ul className="hub-rows">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <span className="skeleton hub-row-skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}
