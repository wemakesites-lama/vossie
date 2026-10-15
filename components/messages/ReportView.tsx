import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendReport } from "@/lib/messaging/actions";
import { messagingErrors, REPORT_FIELDS } from "@/lib/messaging/errors";
import { REPORT_REASONS } from "@/lib/messaging/rules";
import type { ReportSubject } from "@/lib/messaging/subjects";
import type { ReportTarget } from "@/lib/types";
import { MessageField } from "./MessageField";

/** The report form after a post (D decision 3): the reason picked, the detail typed, and what's wrong. */
export type ReportForm = { reason: string; detail: string; errors: FormError[] };

export function reportForm(state: FormStateRow | null): ReportForm {
  if (!state) return { reason: "", detail: "", errors: [] };
  return {
    reason: state.values.reason ?? "",
    detail: state.values.detail ?? "",
    errors: messagingErrors(state.errors, REPORT_FIELDS),
  };
}

type ReportViewProps = {
  target: ReportTarget;
  subject: ReportSubject;
  /** The visitor has an open report on this already (plan decision 17). */
  already: boolean;
  form: ReportForm;
};

/** Report (messaging spec 3.4): what's reported, the seven reasons, the detail and Send report. */
export function ReportView({ target, subject, already, form }: ReportViewProps) {
  return (
    <div className="report-column">
      <Link href={subject.href} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        {subject.backLabel}
      </Link>
      <h1 className="report-title">{`Report this ${target.kind}`}</h1>
      <p className="report-subject">{subject.title}</p>
      {already ? (
        <p className="form-notice">
          {`You've reported this ${target.kind} already. The Hub reviews reports within two working days.`}
        </p>
      ) : (
        <ReportFormView target={target} form={form} />
      )}
    </div>
  );
}

function ReportFormView({ target, form }: { target: ReportTarget; form: ReportForm }) {
  const reasonError = errorFor(form.errors, REPORT_FIELDS.reason);
  // A missing reason is said on the group, through its description: ARIA has no aria-invalid for radio buttons.
  return (
    <>
      <ErrorSummary id="report-summary" errors={form.errors} />
      <form action={sendReport} noValidate className="form-stack">
        <input type="hidden" name="kind" value={target.kind} />
        <input type="hidden" name="id" value={target.id} />
        <fieldset className="report-reasons" aria-describedby={describedBy(reasonError && "report-reason-error")}>
          <legend className="form-label">Why are you reporting it?</legend>
          <FieldError id="report-reason-error" message={reasonError} />
          {REPORT_REASONS.map((reason) => (
            <div key={reason.value} className="form-check">
              <input
                id={`report-reason-${reason.value}`}
                type="radio"
                name="reason"
                value={reason.value}
                required
                defaultChecked={form.reason === reason.value}
                className="form-checkbox"
              />
              <label htmlFor={`report-reason-${reason.value}`}>{reason.label}</label>
            </div>
          ))}
        </fieldset>
        <MessageField
          id={REPORT_FIELDS.detail}
          name="detail"
          label="Tell us more (optional)"
          hint="Up to 500 characters. What happened, and when? Leave out bank details and passwords."
          defaultValue={form.detail}
          error={errorFor(form.errors, REPORT_FIELDS.detail)}
          rows={4}
        />
        <button type="submit" className="btn btn-primary form-submit">
          Send report
        </button>
      </form>
    </>
  );
}
