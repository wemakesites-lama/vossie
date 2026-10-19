import Link from "next/link";
import type { ReportView } from "@/lib/data/staff-reports";
import { reasonLabel } from "@/lib/messaging/rules";
import { adminReportPath } from "@/lib/staff/paths";
import { shortSastDate } from "@/lib/time";
import type { ReportOutcome, ReportTarget } from "@/lib/types";
import { StaffTable } from "./StaffTable";

const KIND_WORDS: Readonly<Record<ReportTarget["kind"], string>> = {
  listing: "Listing",
  seller: "Shop",
  request: "Looking For request",
};

const OUTCOME_WORDS: Readonly<Record<ReportOutcome, string>> = {
  dismissed: "Dismissed",
  hidden: "Listing hidden",
  paused: "Shop paused",
};

/** "Listing", "Shop" or "Looking For request". */
export function kindWords(kind: ReportTarget["kind"]): string {
  return KIND_WORDS[kind];
}

/** "Listing: Desk lamp". */
export function reportedThing(report: Pick<ReportView, "target" | "targetTitle">): string {
  return `${kindWords(report.target.kind)}: ${report.targetTitle}`;
}

/** What a closed report ended in. "Hidden" is a listing, or a Looking For request when `kind` says so (plan decision 20). */
export function outcomeWords(outcome: ReportOutcome | null, kind?: ReportTarget["kind"]): string {
  if (outcome === "hidden" && kind === "request") return "Request hidden";
  return outcome ? OUTCOME_WORDS[outcome] : "Closed";
}

function ReviewLink({ report }: { report: ReportView }) {
  return (
    <Link href={adminReportPath(report.id)} prefetch={false} className="staff-row-action">
      Review <span className="sr-only">the report about {report.targetTitle}</span>
    </Link>
  );
}

/** Reports (spec 2.3): open first, oldest first, each with what, why and who sent it (first name only), then closed ones. */
export function AdminReports({ reports }: { reports: readonly ReportView[] }) {
  const open = reports.filter((report) => report.open);
  const closed = reports.filter((report) => !report.open);
  return (
    <>
      <section aria-labelledby="admin-open-reports-title" className="staff-section">
        <h2 id="admin-open-reports-title" className="staff-section-title">
          Open
        </h2>
        <StaffTable
          caption="Open reports, oldest first"
          columns={["Sent", "What", "Reason", "Reporter", "Review"]}
          rows={open.map((report) => ({
            key: report.id,
            cells: [
              <time key="sent" dateTime={report.createdAt}>
                {shortSastDate(report.createdAt)}
              </time>,
              reportedThing(report),
              reasonLabel(report.reason),
              report.reporterName,
              <ReviewLink key="review" report={report} />,
            ],
          }))}
          empty="No open reports."
        />
      </section>
      <section aria-labelledby="admin-closed-reports-title" className="staff-section">
        <h2 id="admin-closed-reports-title" className="staff-section-title">
          Closed
        </h2>
        <StaffTable
          caption="Closed recently"
          columns={["What", "Outcome", "Closed", "By", "Review"]}
          rows={closed.map((report) => ({
            key: report.id,
            cells: [
              reportedThing(report),
              outcomeWords(report.outcome, report.target.kind),
              report.closedAt ? (
                <time key="closed" dateTime={report.closedAt}>
                  {shortSastDate(report.closedAt)}
                </time>
              ) : (
                ""
              ),
              report.closedByName ?? "",
              <ReviewLink key="review" report={report} />,
            ],
          }))}
          empty="Nothing closed yet."
        />
      </section>
    </>
  );
}
