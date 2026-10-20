/**
 * A staff page's static shell (plan decision 1): shapes only, with no words, so the shell says nothing about the page
 * to someone who gets the 404 in its place. It keeps the frame's height while the page streams in.
 *
 * `short` leaves out the body block. CLAUDE.md asks for a skeleton no taller than the page's shortest state, and the
 * confirm pages (a role's removal, Show again, the admin's own-role refusal) are much shorter than the full shell: on a
 * short phone the full one shifted them by 0.09 when they arrived.
 */
export function StaffSkeleton({ short = false }: { short?: boolean }) {
  return (
    <div className="page staff-page" aria-hidden="true">
      <span className="skeleton staff-skeleton-eyebrow" />
      <span className="skeleton staff-skeleton-title" />
      <span className="skeleton staff-skeleton-nav" />
      {!short && <span className="skeleton staff-skeleton-body" />}
    </div>
  );
}
