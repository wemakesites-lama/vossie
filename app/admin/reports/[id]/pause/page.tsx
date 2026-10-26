import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/kit/Reveal";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getReport } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { reportPauseForm } from "@/lib/staff/form-state";
import { ADMIN_REPORTS_PATH, pauseReportedPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ id: "rep-sample" }];
}

/** Pause the account's confirm page (staff tools spec 2.9, plan decisions 3, 5 and 18). */
export default function PauseReportedPage({ params }: PageProps<"/admin/reports/[id]/pause">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Pause params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Pause({ params }: Pick<PageProps<"/admin/reports/[id]/pause">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", pauseReportedPath(id));
  const report = isId(id) ? await getReport(id, account.id) : null;
  if (!report) notFound();
  const state = await readFormState(reportPauseForm(id));
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
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
