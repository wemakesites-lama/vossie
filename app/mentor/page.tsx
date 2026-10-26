import type { Metadata } from "next";
import { connection } from "next/server";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { MentorDashboard } from "@/components/staff/MentorDashboard";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { openBookingCount } from "@/lib/data/hub-posts";
import { mentoredShops } from "@/lib/data/mentors";
import { dailyEnquiriesFor } from "@/lib/data/shop-stats";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { MENTOR_WINDOW_DAYS } from "@/lib/staff/mentor";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";
import { lastSastDays, sastDate } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "Mentor dashboard");
}

/** The mentor's caseload (staff tools spec 2.6; role views spec 7.3). Mentors and admins only. */
export default function MentorPage({ searchParams }: PageProps<"/mentor">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Reveal>
    </PageTransition>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/mentor">, "searchParams">) {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days, the check-in ages and the chart's days read the clock (decision 26).
  await connection();
  const now = new Date();
  const view = (await searchParams).view === "all" ? "all" : "needs";
  const [rows, campuses, notice, slotRequests] = await Promise.all([
    mentoredShops(account, now),
    getCampuses(),
    takeNotice(),
    openBookingCount().catch(() => null),
  ]);
  // Only mentoredShops' slugs: on Supabase this reads with the admin client (N4 plan decision 9).
  const daily = await dailyEnquiriesFor(
    rows.map((row) => row.slug),
    MENTOR_WINDOW_DAYS,
    now,
  ).catch(() => null);
  return (
    <StaffFrame account={account} area="Mentoring" title="Mentor dashboard" current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorDashboard
        rows={rows}
        view={view}
        showMentor={isAdmin(account)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        slotRequests={slotRequests}
        daily={daily}
        days={lastSastDays(MENTOR_WINDOW_DAYS, now)}
        today={sastDate(now)}
      />
    </StaffFrame>
  );
}
