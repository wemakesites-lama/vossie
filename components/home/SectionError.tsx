/**
 * A section's error state (spec section 9). One failing section never blanks the page. "Try again" reloads the page
 * it's on (the homepage unless `path` says otherwise) and comes back to this section: the query string makes it a
 * fresh request, and the hash scrolls back.
 */
export function SectionError({ id, title, path = "/" }: { id: string; title: string; path?: string }) {
  return (
    <div className="section-error">
      <p>{title} didn&apos;t load.</p>
      <a href={`${path}?retry=${id}#${id}`} className="btn btn-outline text-navy">
        Try again
      </a>
    </div>
  );
}
