/** The composer's room while it streams in (messaging spec 3.1): the back link, the heading, the card and the form. */
export function ComposerSkeleton() {
  return (
    <div className="composer-skeleton" aria-hidden="true">
      <span className="skeleton composer-skeleton-crumb" />
      <span className="skeleton composer-skeleton-title" />
      <span className="skeleton composer-skeleton-summary" />
      <span className="skeleton composer-skeleton-form" />
    </div>
  );
}
