/** The account page's shape while it streams in (spec 3.2): the details card and the form. */
export function AccountSkeleton() {
  return (
    <div className="account-body" aria-hidden="true">
      <span className="skeleton account-skeleton-card" />
      <span className="skeleton account-skeleton-form" />
    </div>
  );
}
