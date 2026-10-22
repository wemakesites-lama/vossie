/**
 * /sell's shape while it streams in (role views N2 plan decision 15): the header card and one card under it, shorter
 * than every state (the shortest, a new shop's checklist, is measured in tests/e2e/role-views-writes.spec.ts).
 * `.sell-page` is a screen tall, so the footer stays below the first screen while it streams.
 */
export function SellSkeleton() {
  return (
    <div className="sell-column sell-home" aria-hidden="true">
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
