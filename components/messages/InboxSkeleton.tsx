/** The inbox's room while it streams in (messaging spec 3.2): the tabs' bar and three rows. */
export function InboxSkeleton() {
  return (
    <div className="inbox-body inbox-skeleton" aria-hidden="true">
      <span className="skeleton inbox-skeleton-bar" />
      <span className="skeleton inbox-skeleton-row" />
      <span className="skeleton inbox-skeleton-row" />
      <span className="skeleton inbox-skeleton-row" />
    </div>
  );
}
