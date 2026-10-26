/**
 * A staff page's static shell (plan decision 1): shapes only, with no words, so the shell says nothing about the page
 * to someone who gets the 404 in its place. It keeps the frame's height while the page streams in.
 *
 * `short` leaves out the body block. CLAUDE.md asks for a skeleton no taller than the page's shortest state, and the
 * confirm pages (a role's removal, Show again, the admin's own-role refusal) are much shorter than the full shell: on a
 * short phone the full one shifted them by 0.09 when they arrived.
 *
 * The first line is the breadcrumb trail's (wayfinding spec 3.1). `trail={false}` leaves it out for Today, the
 * console's front page, which has none.
 */
export function StaffSkeleton({ short = false, trail = true }: { short?: boolean; trail?: boolean }) {
  return (
    <div className="page staff-page" aria-hidden="true">
      {trail && <span className="skeleton staff-skeleton-trail" />}
      <span className="skeleton staff-skeleton-eyebrow" />
      <span className="skeleton staff-skeleton-title" />
      {!short && <span className="skeleton staff-skeleton-body" />}
    </div>
  );
}
