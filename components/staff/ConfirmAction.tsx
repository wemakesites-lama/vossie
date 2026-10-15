import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { REASON_MAX } from "@/lib/staff/rules";

type ConfirmActionProps = {
  /** The form's id prefix, unique across the pages Next keeps ("decline-crochet-corner"). */
  id: string;
  /** What will happen, in a sentence (spec 4: confirm pages repeat what will happen). */
  lead: ReactNode;
  /** What follows from it, a line each. */
  consequences: readonly string[];
  action: (formData: FormData) => Promise<void>;
  /** The hidden fields that say what it's about. */
  hidden: Readonly<Record<string, string>>;
  /** Who sees the reason. */
  reasonHint: string;
  /** What was typed before a failed post, or "". */
  reason: string;
  errors: readonly FormError[];
  /** The button names what it does to what: "Decline Crochet corner" (spec 4). */
  confirmLabel: string;
  /** Where Keep it goes back to. */
  keepHref: string;
};

/**
 * A destructive action's confirm page (spec 2.9, plan decision 18): what will happen, the reason (required, up to 500
 * characters), the button that does it, and Keep it, a link back. A plain form: it works without the app's
 * JavaScript, and the server checks everything again.
 */
export function ConfirmAction({
  id,
  lead,
  consequences,
  action,
  hidden,
  reasonHint,
  reason,
  errors,
  confirmLabel,
  keepHref,
}: ConfirmActionProps) {
  const fieldId = `${id}-reason`;
  const error = errorFor(errors, fieldId);
  return (
    <div className="staff-confirm">
      <p className="staff-confirm-lead">{lead}</p>
      {consequences.length > 0 && (
        <ul className="staff-confirm-list">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <ErrorSummary id={`${id}-summary`} errors={errors} />
      <form action={action} noValidate className="form-stack">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="form-field">
          <label htmlFor={fieldId} className="form-label">
            Reason
          </label>
          <p id={`${fieldId}-hint`} className="form-hint">
            {reasonHint} Up to {REASON_MAX} characters.
          </p>
          <FieldError id={`${fieldId}-error`} message={error} />
          <textarea
            id={fieldId}
            name="reason"
            rows={4}
            required
            defaultValue={reason}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(`${fieldId}-hint`, error && `${fieldId}-error`)}
            className="form-input staff-textarea"
          />
        </div>
        <div className="staff-actions">
          <button type="submit" className="btn btn-danger">
            {confirmLabel}
          </button>
          <Link href={keepHref} prefetch={false} className="link-button">
            Keep it
          </Link>
        </div>
      </form>
    </div>
  );
}
