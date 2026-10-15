/** /sell's shape while it streams in: a heading block and the sections under it. Task 17 checks its height. */
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
 * Delete listing's confirmation while it streams in: the listing's row, the warning and the buttons, about their height
 * (measured at 360 to 1440 with the sample listing), so the footer doesn't jump. Task 17 checks it.
 */
export function SellDeleteSkeleton() {
  return <span className="skeleton sell-skeleton-delete" aria-hidden="true" />;
}
