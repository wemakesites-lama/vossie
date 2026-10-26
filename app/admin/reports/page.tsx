import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { AdminReports } from "@/components/staff/AdminReports";
import { CampusFilter } from "@/components/staff/CampusFilter";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listReports } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { inCampus, readCampusFilter } from "@/lib/staff/campus-filter";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Reports");
}

/** Reports (staff tools spec 2.3): open first, with campus chips (role views spec 7.2). */
export default function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton short />}>
        <Reports searchParams={searchParams} />
      </Reveal>
    </PageTransition>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_REPORTS_PATH);
  const [params, reports, campuses, notice] = await Promise.all([searchParams, listReports(), getCampuses(), takeNotice()]);
  const chosen = readCampusFilter(params, campuses);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Reports" route="/admin/reports" notice={staffNoticeText(notice)}>
      <CampusFilter path={ADMIN_REPORTS_PATH} campuses={campuses} chosen={chosen} />
      <AdminReports reports={inCampus(reports, chosen, (report) => report.campusSlug)} campusName={chosen?.name ?? null} />
    </StaffFrame>
  );
}
