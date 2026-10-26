import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendReport } from "@/lib/messaging/actions";
import { messagingErrors, reportFields, reportReasonId } from "@/lib/messaging/errors";
import { reportFormKey } from "@/lib/messaging/paths";
import { REPORT_REASONS } from "@/lib/messaging/rules";
import type { ReportSubject } from "@/lib/messaging/subjects";
import type { ReportTarget } from "@/lib/types";
import { MessageField } from "./MessageField";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

/** The report form after a post (D decision 3): the reason picked, the detail typed, and what's wrong. */
export type ReportForm = { reason: string; detail: string; errors: FormError[] };

/** `target` is what the form is about: its field ids start with it (plan amendment 5). */
export function reportForm(state: FormStateRow | null, target: ReportTarget): ReportForm {
  if (!state) return { reason: "", detail: "", errors: [] };
  return {
    reason: state.values.reason ?? "",
    detail: state.values.detail ?? "",
    errors: messagingErrors(state.errors, reportFields(target)),
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
      {/* A report sits under what it reports. */}
      <Trail
        crumbs={trailFor("/report", {
          parent: { label: subject.title, href: subject.href },
          names: { "/report": `Report this ${target.kind}` },
        })}
      />
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
  const fields = reportFields(target);
  const reasonError = errorFor(form.errors, fields.reason);
  // The error belongs to the group (aria-invalid isn't allowed on a radio button), so the fieldset carries it.
  const reasonErrorId = fields.reasonError;
  return (
    <>
      <ErrorSummary id="report-summary" errors={form.errors} />
      {/* The key names the target: /report?listing=A and /report?seller=B are one page to Next's router, which keeps
          the form it has, so without it B would start with A's reason and detail (plan amendment 6). */}
      <form key={reportFormKey(target)} action={sendReport} noValidate className="form-stack">
        <input type="hidden" name="kind" value={target.kind} />
        <input type="hidden" name="id" value={target.id} />
        <fieldset className="report-reasons" aria-describedby={describedBy(reasonError && reasonErrorId)}>
          <legend className="form-label">Why are you reporting it?</legend>
          <FieldError id={reasonErrorId} message={reasonError} />
          {REPORT_REASONS.map((reason) => {
            const id = reportReasonId(target, reason.value);
            return (
              <div key={reason.value} className="form-check">
                <input
                  id={id}
                  type="radio"
                  name="reason"
                  value={reason.value}
                  required
                  defaultChecked={form.reason === reason.value}
                  className="form-checkbox"
                />
                <label htmlFor={id}>{reason.label}</label>
              </div>
            );
          })}
        </fieldset>
        <MessageField
          id={fields.detail}
          name="detail"
          label="Tell us more (optional)"
          hint="Up to 500 characters. What happened, and when? Leave out bank details and passwords."
          defaultValue={form.detail}
          error={errorFor(form.errors, fields.detail)}
          rows={4}
        />
        <button type="submit" className="btn btn-primary form-submit">
          Send report
        </button>
      </form>
    </>
  );
}
