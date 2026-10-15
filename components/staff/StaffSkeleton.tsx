/**
 * A staff page's static shell (plan decision 1): shapes only, with no words, so the shell says nothing about the page
 * to someone who gets the 404 in its place. It keeps the frame's height while the page streams in.
 */
export function StaffSkeleton() {
  return (
    <div className="page staff-page" aria-hidden="true">
      <span className="skeleton staff-skeleton-eyebrow" />
      <span className="skeleton staff-skeleton-title" />
      <span className="skeleton staff-skeleton-nav" />
      <span className="skeleton staff-skeleton-body" />
    </div>
  );
}
