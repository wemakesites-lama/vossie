import type { FormError } from "@/lib/auth/messages";

/**
 * What went wrong on the last post (accounts spec 6), each message linking to its field. On a page load, which is what
 * a post without the app's JavaScript gives, the browser focuses it (autoFocus). With the JavaScript, React only
 * autofocuses form controls, so role="alert" announces it instead (accounts plan decision 11).
 *
 * `id` names the summary and, with "-title" after it, its heading. Each form passes its own, because Next keeps earlier
 * pages in the DOM and ids must stay unique across them. It's passed in rather than made with useId, which restarts on
 * every request in a Server Component, so kept copies would repeat it.
 */
export function ErrorSummary({ id, errors }: { id: string; errors: readonly FormError[] }) {
  if (errors.length === 0) return null;
  const titleId = `${id}-title`;
  return (
    <div id={id} role="alert" tabIndex={-1} autoFocus aria-labelledby={titleId} className="form-summary">
      <h2 id={titleId} className="form-summary-title">
        There&apos;s a problem
      </h2>
      <ul className="form-summary-list">
        {errors.map((error) => (
          <li key={`${error.fieldId}:${error.message}`}>
            {error.fieldId ? <a href={`#${error.fieldId}`}>{error.message}</a> : error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
