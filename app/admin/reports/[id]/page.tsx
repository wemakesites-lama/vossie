import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/kit/Reveal";
import { AdminReport } from "@/components/staff/AdminReport";
import { NextInQueue } from "@/components/staff/NextInQueue";
import { reportedThing } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport, listReports } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { dismissForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH, adminReportPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { nextOpenReport } from "@/lib/staff/queue";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "A report");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no report. */
export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** A report's page (staff tools spec 2.3). An unknown report is the 404. */
export default function AdminReportPage({ params }: PageProps<"/admin/reports/[id]">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Report params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Report({ params }: Pick<PageProps<"/admin/reports/[id]">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", adminReportPath(id));
  const report = isId(id) ? await getReport(id, account.id) : null;
  if (!report) notFound();
  const [state, notice, reports] = await Promise.all([readFormState(dismissForm(id)), takeNotice(), listReports()]);
  // The Next link (role views spec 7.2): the oldest open report that isn't this one.
  const next = nextOpenReport(reports, id);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title={reportedThing(report)} current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <NextInQueue
        label="Next open report"
        next={next && { title: reportedThing(next), href: adminReportPath(next.id) }}
        none="No other report is open."
      />
      <AdminReport
        report={report}
        note={state?.values.note ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`dismiss-${id}`))}
      />
    </StaffFrame>
  );
}
