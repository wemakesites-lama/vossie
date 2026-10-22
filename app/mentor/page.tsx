import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MentorDashboard } from "@/components/staff/MentorDashboard";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { mentoredShops } from "@/lib/data/mentors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "Mentor dashboard");
}

/** The mentor dashboard (staff tools spec 2.6). Mentors and admins only. */
export default function MentorPage() {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Dashboard />
      </Suspense>
    </PageTransition>
  );
}

async function Dashboard() {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days read the clock (decision 26).
  await connection();
  const [rows, campuses, notice] = await Promise.all([mentoredShops(account, new Date()), getCampuses(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Mentoring" title="Mentor dashboard" current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorDashboard
        rows={rows}
        showMentor={isAdmin(account)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
