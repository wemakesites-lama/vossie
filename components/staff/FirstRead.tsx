import { firstReadLines, type FirstRead as Read } from "@/lib/staff/report-read";
import { readReportAgain } from "@/lib/staff/report-read-actions";
import type { ReportReason } from "@/lib/types";

type FirstReadProps = {
  reportId: string;
  read: Read | null;
  reason: ReportReason;
  /** Read again's button (AI stage C planning decision 4): only on an open student's report that isn't the admin's own. */
  readAgain: boolean;
};

/**
 * The report read (AI features spec section 4, stage C): above the reporter's words, headed so staff know it may be
 * wrong. It has no controls but Read again, shown only when there's no read: staff decide everything.
 */
export function FirstRead({ reportId, read, reason, readAgain }: FirstReadProps) {
  if (read) {
    const lines = firstReadLines(read, reason);
    return (
      <section aria-labelledby="first-read-title" className="staff-section staff-first-read">
        <h2 id="first-read-title" className="staff-section-title">
          First read (may be wrong)
        </h2>
        <p>{lines.summary}</p>
        <ul className="staff-first-read-lines">
          <li>{lines.guideline}</li>
          <li>{lines.agreement}</li>
        </ul>
      </section>
    );
  }
  if (!readAgain) return null;
  return (
    <form action={readReportAgain} className="staff-first-read-again">
      <input type="hidden" name="report" value={reportId} />
      <p className="staff-muted">No first read of this report yet.</p>
      <button type="submit" className="btn btn-outline text-navy">
        Read again
      </button>
    </form>
  );
}
