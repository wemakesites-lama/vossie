import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminReports } from "@/components/staff/AdminReports";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { listReports } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Reports");
}

/** Reports (staff tools spec 2.3): open first. */
export default function AdminReportsPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  const account = await requireStaff("admin", ADMIN_REPORTS_PATH);
  const [reports, notice] = await Promise.all([listReports(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Reports" current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <AdminReports reports={reports} />
    </StaffFrame>
  );
}
