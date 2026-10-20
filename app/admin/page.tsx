import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminOverview } from "@/components/staff/AdminOverview";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { recalculateBadges } from "@/lib/data/badges";
import { openBookingCount } from "@/lib/data/hub-posts";
import { countHidden, openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_PATH } from "@/lib/staff/paths";

/** "Admin console" for admins, "Page not found" for everyone else (plan decision 1). */
export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Admin console");
}

/** Overview (staff tools spec 2.3). The static shell is a wordless skeleton; everything else needs the session. */
export default function AdminPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const account = await requireStaff("admin", ADMIN_PATH);
  // The badges read the clock (decision 26).
  await connection();
  // Overview works the badges out as it renders (spec 2.7, plan decision 8). A render can't expire cache tags.
  const changed = await recalculateBadges(new Date());
  const [waiting, openReports, openSlots, hidden, notice] = await Promise.all([
    countWaitingShops(),
    openReportCount(),
    openBookingCount(),
    countHidden(),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Overview" current={ADMIN_PATH} notice={staffNoticeText(notice)}>
      <AdminOverview
        waiting={waiting}
        openReports={openReports}
        openSlots={openSlots}
        badgesChanged={changed.length}
        hidden={hidden}
      />
    </StaffFrame>
  );
}
