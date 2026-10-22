import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminToday } from "@/components/staff/AdminToday";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { recalculateBadges } from "@/lib/data/badges";
import { listBookings } from "@/lib/data/hub-posts";
import { countByWeek } from "@/lib/data/numbers";
import { countHidden, listReports } from "@/lib/data/staff-reports";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { protectCounts } from "@/lib/staff/numbers";
import { ADMIN_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";
import { todayLede, todayQueue } from "@/lib/staff/queue";
import { campusBars, lastWeekTiles } from "@/lib/staff/today-numbers";

/** "Today" for admins, "Page not found" for everyone else (staff tools plan decision 1). */
export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Today");
}

/** Today (role views spec 7.2). The static shell is a wordless skeleton; everything else needs the session. */
export default function AdminPage() {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Today />
      </Suspense>
    </PageTransition>
  );
}

/** The queue from its four lists, or null when one fails: the Waiting card shows its error box (spec 8). */
async function readQueue(now: Date) {
  try {
    const [shops, reports, bookings, hidden] = await Promise.all([
      listShopsForReview(),
      listReports(),
      listBookings(),
      countHidden(),
    ]);
    return todayQueue({ shops, reports, bookings, hidden, now });
  } catch {
    return null;
  }
}

/** Last week through protectCounts (CLAUDE.md), or null when the counts fail. */
async function readWeek(now: Date) {
  try {
    const [{ weeks, raw }, campuses] = await Promise.all([countByWeek(now), getCampuses()]);
    const places = campuses.map((campus) => ({ slug: campus.slug, name: campus.name }));
    const slugs = places.map((place) => place.slug);
    const shown = protectCounts(raw, slugs);
    return {
      label: weeks.last.label,
      beforeLabel: weeks.before.label,
      tiles: lastWeekTiles(shown),
      campuses: campusBars(shown, "listings", places),
    };
  } catch {
    return null;
  }
}

async function Today() {
  const account = await requireStaff("admin", ADMIN_PATH);
  // The ages, the weeks and the badges read the clock (decision 26): once, at request time.
  await connection();
  const now = new Date();
  // The badges first, as Overview did (staff tools spec 2.7, plan decision 8): a render can't expire cache tags, and
  // the queue below reads after the calculation has written.
  const badgesChanged = await recalculateBadges(now).then(
    (changed) => changed.length,
    () => null,
  );
  const [queue, week, notice] = await Promise.all([readQueue(now), readWeek(now), takeNotice()]);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title="Today"
      lede={queue ? todayLede(queue, now) : undefined}
      current={ADMIN_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminToday waiting={queue?.items ?? null} week={week} badgesChanged={badgesChanged} />
    </StaffFrame>
  );
}
