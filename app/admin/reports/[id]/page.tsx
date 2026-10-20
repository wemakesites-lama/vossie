import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminReport } from "@/components/staff/AdminReport";
import { reportedThing } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { dismissForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH, adminReportPath } from "@/lib/staff/paths";

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
    <Suspense fallback={<StaffSkeleton />}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: Pick<PageProps<"/admin/reports/[id]">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", adminReportPath(id));
  const report = isId(id) ? await getReport(id, account.id) : null;
  if (!report) notFound();
  const [state, notice] = await Promise.all([readFormState(dismissForm(id)), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title={reportedThing(report)} current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <AdminReport
        report={report}
        note={state?.values.note ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`dismiss-${id}`))}
      />
    </StaffFrame>
  );
}
