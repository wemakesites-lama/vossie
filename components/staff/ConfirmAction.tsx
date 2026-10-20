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
  errors: readonly FormError[];
  /** The button names what it does to what: "Decline Crochet corner" (spec 4). */
  confirmLabel: string;
  /** Where Keep it goes back to. */
  keepHref: string;
} & (
  | {
      /** What was typed before a failed post, or "". */
      reason: string;
      /** Who sees the reason. */
      reasonHint: string;
    }
  | {
      /**
       * No reason field (stage J spec decision 4): taking a role away and Show again need none, as the person needs
       * none to read and the audit log records the action.
       */
      reason: false;
      reasonHint?: undefined;
    }
);

function ReasonField({ fieldId, hint, reason, error }: { fieldId: string; hint: string; reason: string; error: string | undefined }) {
  return (
    <div className="form-field">
      <label htmlFor={fieldId} className="form-label">
        Reason
      </label>
      <p id={`${fieldId}-hint`} className="form-hint">
        {hint} Up to {REASON_MAX} characters.
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
  );
}

/**
 * A destructive action's confirm page (spec 2.9, plan decision 18): what will happen, the reason (required, up to 500
 * characters) unless the page has none, the button that does it, and Keep it, a link back. A plain form: it works
 * without the app's JavaScript, and the server checks everything again.
 */
export function ConfirmAction(props: ConfirmActionProps) {
  const { id, lead, consequences, action, hidden, errors, confirmLabel, keepHref } = props;
  const fieldId = `${id}-reason`;
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
        {props.reason === false ? null : (
          <ReasonField fieldId={fieldId} hint={props.reasonHint} reason={props.reason} error={errorFor(errors, fieldId)} />
        )}
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
