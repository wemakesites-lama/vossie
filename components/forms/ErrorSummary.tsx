import type { FormError } from "@/lib/auth/messages";

/**
 * What went wrong on the last post (accounts spec 6), each message linking to its field. On a page load, which is what
 * a post without the app's JavaScript gives, the browser focuses it (autoFocus). With the JavaScript, React only
 * autofocuses form controls, so role="alert" announces it instead (accounts plan decision 11).
 */
export function ErrorSummary({ errors }: { errors: readonly FormError[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" tabIndex={-1} autoFocus aria-labelledby="form-summary-title" className="form-summary">
      <h2 id="form-summary-title" className="form-summary-title">
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
