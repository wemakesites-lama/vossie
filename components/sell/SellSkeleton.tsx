/** /sell's shape while it streams in: a heading block and the sections under it. Task 17 checks its height. */
export function SellSkeleton() {
  return (
    <div className="sell-column" aria-hidden="true">
      <span className="skeleton sell-skeleton-head" />
      <span className="skeleton sell-skeleton-body" />
    </div>
  );
}
