/** A thread's room while it streams in (messaging spec 3.3): the heading, the listing, three bubbles and the reply. */
export function ThreadSkeleton() {
  return (
    <div className="thread-column" aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <span className="skeleton composer-skeleton-summary" />
      <span className="skeleton thread-skeleton-bubble" />
      <span className="skeleton thread-skeleton-bubble thread-skeleton-theirs" />
      <span className="skeleton thread-skeleton-bubble" />
      <span className="skeleton thread-skeleton-reply" />
    </div>
  );
}
