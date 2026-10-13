/** The search failed (spec section 8). "Try again" reloads the same results page, with no JavaScript. */
export function BrowseError({ href }: { href: string }) {
  return (
    <div className="section-error">
      <p>We couldn&apos;t load listings just now.</p>
      <a href={href} className="btn btn-outline text-navy">
        Try again
      </a>
    </div>
  );
}
