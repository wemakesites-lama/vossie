import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { ReportView } from "@/lib/data/staff-reports";
import { targetPath } from "@/lib/messaging/paths";
import { reasonLabel } from "@/lib/messaging/rules";
import { dismissReport } from "@/lib/staff/admin-actions";
import { hideReportedPath, pauseReportedPath, showListingPath, showRequestPath } from "@/lib/staff/paths";
import { REASON_MAX } from "@/lib/staff/rules";
import { longSastDate } from "@/lib/time";
import { kindWords, outcomeWords } from "./AdminReports";

type AdminReportProps = {
  report: ReportView;
  /** Dismiss's note as typed before a failed post. */
  note: string;
  errors: readonly FormError[];
};

/**
 * A report's page (spec 2.3, plan decision 5): what was reported (linked while it's there), the reason, the detail,
 * the reporter's first name and when. Open: Hide the listing or request and Pause the account through their confirm
 * pages, where the report allows them, and Dismiss with a note. Closed: what was done, by whom and when.
 */
export function AdminReport({ report, note, errors }: AdminReportProps) {
  const noteId = `dismiss-${report.id}-note`;
  const noteError = errorFor(errors, noteId);
  return (
    <>
      <section aria-labelledby="admin-report-title" className="staff-section">
        <h2 id="admin-report-title" className="staff-section-title">
          The report
        </h2>
        <dl className="staff-facts">
          <div>
            <dt>What</dt>
            <dd>
              {report.exists && !report.unseen ? (
                <Link href={targetPath(report.target)} prefetch={false}>
                  {report.targetTitle}
                </Link>
              ) : report.exists ? (
                report.targetTitle
              ) : (
                `${report.targetTitle} (gone)`
              )}
              <span className="staff-muted"> · {kindWords(report.target.kind)}</span>
              {report.unseen && (
                <span className="staff-muted staff-unseen">
                  {report.unseen === "hidden"
                    ? report.target.kind === "request"
                      ? "Students can't see this request: the Hub has hidden it."
                      : "Buyers can't see this listing: the Hub has hidden it."
                    : "Buyers can't see this shop while the Hub's pause lasts."}
                </span>
              )}
              {/* Show it again (stage J spec decision 14): a hide closes every report on its target. */}
              {!report.open && report.unseen === "hidden" && report.target.kind !== "seller" && (
                <>
                  {" "}
                  <Link
                    href={
                      report.target.kind === "request" ? showRequestPath(report.target.id) : showListingPath(report.target.id)
                    }
                    prefetch={false}
                  >
                    Show it again
                  </Link>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{reasonLabel(report.reason)}</dd>
          </div>
          <div>
            <dt>Detail</dt>
            <dd className="staff-prewrap">{report.detail || "None given"}</dd>
          </div>
          <div>
            <dt>Reporter</dt>
            <dd>{report.reporterName}</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>
              <time dateTime={report.createdAt}>{longSastDate(report.createdAt)}</time>
            </dd>
          </div>
        </dl>
      </section>

      {report.open ? (
        <section aria-labelledby="admin-report-actions-title" className="staff-section">
          <h2 id="admin-report-actions-title" className="staff-section-title">
            What you can do
          </h2>
          {(report.can.hide || report.can.pause) && (
            <div className="staff-row-actions">
              {report.can.hide && (
                <Link href={hideReportedPath(report.id)} prefetch={false} className="btn btn-danger">
                  Hide {report.targetTitle}
                </Link>
              )}
              {report.can.pause && report.shop && (
                <Link href={pauseReportedPath(report.id)} prefetch={false} className="btn btn-danger">
                  Pause {report.shop.name}
                </Link>
              )}
            </div>
          )}
          {!report.can.hide && !report.can.pause && (
            <p>
              This report is about something that has gone, or a shop the Hub can&apos;t pause, so it can only be
              dismissed.
            </p>
          )}
          <ErrorSummary id={`dismiss-${report.id}-summary`} errors={errors} />
          <form action={dismissReport} noValidate className="form-stack staff-inline-form">
            <input type="hidden" name="report" value={report.id} />
            <div className="form-field">
              <label htmlFor={noteId} className="form-label">
                Note
              </label>
              <p id={`${noteId}-hint`} className="form-hint">
                Only Hub staff see it. Up to {REASON_MAX} characters.
              </p>
              <FieldError id={`${noteId}-error`} message={noteError} />
              <textarea
                id={noteId}
                name="note"
                rows={3}
                required
                defaultValue={note}
                aria-invalid={noteError ? true : undefined}
                aria-describedby={describedBy(`${noteId}-hint`, noteError && `${noteId}-error`)}
                className="form-input staff-textarea"
              />
            </div>
            <button type="submit" className="btn btn-outline text-navy form-submit">
              Dismiss <span className="sr-only">the report about {report.targetTitle}</span>
            </button>
          </form>
        </section>
      ) : (
        <section aria-labelledby="admin-report-outcome-title" className="staff-section">
          <h2 id="admin-report-outcome-title" className="staff-section-title">
            What was done
          </h2>
          <p className="staff-standing">
            {outcomeWords(report.outcome, report.target.kind)} on {longSastDate(report.closedAt ?? report.createdAt)} by{" "}
            {report.closedByName ?? "Deleted account"}.
          </p>
          {report.note && <p className="staff-prewrap">{report.note}</p>}
        </section>
      )}
    </>
  );
}
