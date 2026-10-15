import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { reportPauseForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, pauseReportedPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** Pause the account's confirm page (staff tools spec 2.9, plan decisions 3, 5 and 18). */
export default function PauseReportedPage({ params }: PageProps<"/admin/reports/[id]/pause">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Pause params={params} />
    </Suspense>
  );
}

async function Pause({ params }: Pick<PageProps<"/admin/reports/[id]/pause">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", pauseReportedPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const state = await readFormState(reportPauseForm(id));
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={report.shop ? `Pause ${report.shop.name}` : "Pause a shop"}
      current={ADMIN_REPORTS_PATH}
      notice={null}
    >
      <ReportConfirm
        kind="pause"
        report={report}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`report-pause-${id}`))}
      />
    </StaffFrame>
  );
}
