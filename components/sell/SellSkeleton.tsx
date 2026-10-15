/** /sell's shape while it streams in: a heading block and the sections under it (heights checked in Task 17). */
export function SellSkeleton() {
  return (
    <div className="sell-column" aria-hidden="true">
      <span className="skeleton sell-skeleton-head" />
      <span className="skeleton sell-skeleton-body" />
    </div>
  );
}

/** A selling form's shape while it streams in (the wizard, Edit shop and the listing form). */
export function SellFormSkeleton() {
  return <span className="skeleton sell-skeleton-form" aria-hidden="true" />;
}

/**
 * Delete listing's confirmation while it streams in: its own height (about 17rem on a phone, 16rem from the tablet
 * step, a form's is 32rem), so the footer doesn't jump about 240px when it arrives (amendment 10.8, Task 17).
 */
export function SellDeleteSkeleton() {
  return <span className="skeleton sell-skeleton-delete" aria-hidden="true" />;
}
