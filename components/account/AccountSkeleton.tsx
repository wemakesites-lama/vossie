import { YOU_SKELETON_BLOCKS } from "./you-skeleton";

/** Your details' and privacy settings' shape while they stream in (spec 3.2): the details card and the form. */
export function AccountSkeleton() {
  return (
    <div className="account-body" aria-hidden="true">
      <span className="skeleton account-skeleton-card" />
      <span className="skeleton account-skeleton-form" />
    </div>
  );
}

/**
 * You's shape while it streams in (role views spec 9): shorter than its shortest state, a new account's (All clear,
 * six rows, Settings), so nothing below moves up when the page arrives; the page is a screen tall, so the footer
 * stays below the first screen meanwhile.
 */
export function YouSkeleton() {
  return (
    <div className="you-skeleton-body" aria-hidden="true">
      {YOU_SKELETON_BLOCKS.map((block) => (
        <span key={block} className={`skeleton ${block}`} />
      ))}
    </div>
  );
}
