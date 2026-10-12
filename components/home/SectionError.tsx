/**
 * A section's error state (spec section 9). One failing section never blanks the page. "Try again" reloads the page
 * and comes back to this section: the query string makes it a fresh request, and the hash scrolls back.
 */
export function SectionError({ id, title }: { id: string; title: string }) {
  return (
    <div className="section-error">
      <p>{title} didn&apos;t load.</p>
      <a href={`/?retry=${id}#${id}`} className="btn btn-outline text-navy">
        Try again
      </a>
    </div>
  );
}
