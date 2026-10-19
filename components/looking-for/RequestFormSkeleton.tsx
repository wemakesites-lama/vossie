/** The request form's room while it streams in: the back link, the heading and four fields. Wordless. */
export function RequestFormSkeleton() {
  return (
    <div className="request-form-column" aria-hidden="true">
      <span className="skeleton request-form-skeleton-crumb" />
      <span className="skeleton request-form-skeleton-title" />
      <span className="skeleton request-form-skeleton-field" />
      <span className="skeleton request-form-skeleton-field" />
      <span className="skeleton request-form-skeleton-field" />
      <span className="skeleton request-form-skeleton-field" />
    </div>
  );
}
