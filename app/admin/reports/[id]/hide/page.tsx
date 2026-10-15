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
import { hideForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, hideReportedPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hide a listing");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** Hide the listing's confirm page (staff tools spec 2.9, plan decisions 4 and 18). */
export default function HideReportedPage({ params }: PageProps<"/admin/reports/[id]/hide">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Hide params={params} />
    </Suspense>
  );
}

async function Hide({ params }: Pick<PageProps<"/admin/reports/[id]/hide">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", hideReportedPath(id));
  const report = isId(id) ? await getReport(id) : null;
  if (!report) notFound();
  const state = await readFormState(hideForm(id));
  return (
    <StaffFrame account={account} area="Admin console" title={`Hide ${report.targetTitle}`} current={ADMIN_REPORTS_PATH} notice={null}>
      <ReportConfirm
        kind="hide"
        report={report}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`hide-${id}`))}
      />
    </StaffFrame>
  );
}
