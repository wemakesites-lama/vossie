/** The board's shape while it streams in (community spec 3): the chips, a heading and six rows, so nothing jumps. */
export function BoardSkeleton() {
  return (
    <div aria-hidden="true">
      <span className="skeleton board-skeleton-chips" />
      <span className="skeleton board-skeleton-heading" />
      <ul className="board-list">
        {Array.from({ length: 6 }, (_, n) => (
          <li key={n}>
            <span className="skeleton board-skeleton-row" />
          </li>
        ))}
      </ul>
    </div>
  );
}
