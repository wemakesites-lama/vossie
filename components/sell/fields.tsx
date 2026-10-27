import type { ReactNode } from "react";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { cx } from "@/lib/cx";

// The selling forms' fields (selling spec section 4, plan decision 24), in D's pattern: a label (or a legend), a
// hint, the error, then the control, with the hint and the error joined to it by aria-describedby.

type Choice = { value: string; label: string };

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  hint?: ReactNode;
  defaultValue: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  inputMode?: "numeric" | "text";
  tag?: string;
};

export function TextField({ id, name, label, hint, defaultValue, error, required, multiline, inputMode, tag }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = `${id}-error`;
  const shared = {
    id,
    name,
    defaultValue,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(hintId, error && errorId),
  };
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
        {tag && <> <span className="field-tag">{tag}</span></>}
      </label>
      {hint && (
        <p id={hintId!} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
      {multiline ? (
        <textarea {...shared} placeholder=" " rows={5} className="form-input sell-textarea" />
      ) : (
        <input {...shared} placeholder=" " type="text" inputMode={inputMode} autoComplete="off" className="form-input" />
      )}
    </div>
  );
}

type SelectFieldProps = {
  id: string;
  name: string;
  label: string;
  hint?: ReactNode;
  options: readonly Choice[];
  /** The first option, with no value: "Choose a category". */
  placeholder: string;
  defaultValue: string;
  error?: string;
  /** Announced as required unless it's optional for some answers (a service's condition, say). */
  required?: boolean;
  tag?: string;
};

export function SelectField({
  id,
  name,
  label,
  hint,
  options,
  placeholder,
  defaultValue,
  error,
  required = true,
  tag,
}: SelectFieldProps) {
  const hintId = hint ? `${id}-hint` : null;
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
        {tag && <> <span className="field-tag">{tag}</span></>}
      </label>
      {hint && (
        <p id={hintId!} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, error && `${id}-error`)}
        className="form-input form-select"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type GroupProps = {
  /** The first control's id, where an error's link lands; the others add their value. */
  id: string;
  name: string;
  legend: string;
  hint?: ReactNode;
  options: readonly Choice[];
  error?: string;
  /** Lay the choices out in a row from the tablet step. */
  row?: boolean;
  tag?: string;
};

/** A fieldset with its legend, hint and error, around radios or boxes (`name` and `options` are the caller's). */
function Group({ id, legend, hint, error, row, tag, children }: GroupProps & { children: ReactNode }) {
  const hintId = hint ? `${id}-hint` : null;
  return (
    <fieldset className="form-field sell-fieldset" aria-describedby={describedBy(hintId, error && `${id}-error`)}>
      <legend className="form-label">
        {legend}
        {tag && <> <span className="field-tag">{tag}</span></>}
      </legend>
      {hint && (
        <p id={hintId!} className="form-hint">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
      <div className={cx("sell-choices", row && "sell-choices-row")}>{children}</div>
    </fieldset>
  );
}

const controlId = (id: string, index: number, value: string) => (index === 0 ? id : `${id}-${value}`);

// No aria-invalid on the radios: the role doesn't support it. The group's error is joined to the fieldset instead.
export function RadioGroup({ defaultValue, ...props }: GroupProps & { defaultValue: string }) {
  return (
    <Group {...props}>
      {props.options.map((option, index) => (
        <div key={option.value} className="form-check">
          <input
            id={controlId(props.id, index, option.value)}
            type="radio"
            name={props.name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            required
            className="form-checkbox"
          />
          <label htmlFor={controlId(props.id, index, option.value)}>{option.label}</label>
        </div>
      ))}
    </Group>
  );
}

export function CheckList({ chosen, ...props }: GroupProps & { chosen: readonly string[] }) {
  return (
    <Group {...props}>
      {props.options.map((option, index) => (
        <div key={option.value} className="form-check">
          <input
            id={controlId(props.id, index, option.value)}
            type="checkbox"
            name={props.name}
            value={option.value}
            defaultChecked={chosen.includes(option.value)}
            aria-invalid={props.error ? true : undefined}
            className="form-checkbox"
          />
          <label htmlFor={controlId(props.id, index, option.value)}>{option.label}</label>
        </div>
      ))}
    </Group>
  );
}
