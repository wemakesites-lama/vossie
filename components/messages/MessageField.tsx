import { describedBy, FieldError } from "@/components/forms/FieldError";

type MessageFieldProps = {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  error: string | undefined;
  rows: number;
  required?: boolean;
};

/**
 * A labelled text area for a message, a swap offer or a report's detail (messaging spec 3.1, 3.3 and 3.4). No
 * maxlength, so a long paste isn't cut short without a word: the server says what's too long (plan decision 8).
 */
export function MessageField({ id, name, label, hint, defaultValue, error, rows, required }: MessageFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <p id={hintId} className="form-hint">
        {hint}
      </p>
      <FieldError id={errorId} message={error} />
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, error && errorId)}
        className="form-input msg-textarea"
      />
    </div>
  );
}
