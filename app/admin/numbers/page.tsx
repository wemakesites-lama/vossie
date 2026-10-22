import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminNumbers } from "@/components/staff/AdminNumbers";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { isSampleMode } from "@/lib/auth/config";
import { getCampuses } from "@/lib/data";
import { countByWeek } from "@/lib/data/numbers";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { parseNumbersCampus, protectCounts } from "@/lib/staff/numbers";
import { ADMIN_NUMBERS_PATH } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Numbers");
}

/** The admin's numbers (stage J spec decisions 9 to 13). Admins only, in G's shape: the gate runs inside <Suspense>. */
export default function AdminNumbersPage({ searchParams }: PageProps<"/admin/numbers">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Numbers searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

/**
 * `?campus=` is a query, not a route, so an unknown value shows the main page (spec decision 12). The weeks read the
 * clock, after `connection()` (spec section 5).
 */
async function Numbers({ searchParams }: Pick<PageProps<"/admin/numbers">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_NUMBERS_PATH);
  await connection();
  const [params, campuses, notice] = await Promise.all([searchParams, getCampuses(), takeNotice()]);
  const places = campuses.map((campus) => ({ slug: campus.slug, name: campus.name }));
  const slugs = places.map((place) => place.slug);
  const { weeks, raw } = await countByWeek(new Date());
  const chosen = parseNumbersCampus(params, slugs);
  return (
    <StaffFrame account={account} area="Admin console" title="Numbers" current={ADMIN_NUMBERS_PATH} notice={staffNoticeText(notice)}>
      <AdminNumbers
        weeks={weeks}
        shown={protectCounts(raw, slugs)}
        campuses={places}
        campus={places.find((place) => place.slug === chosen) ?? null}
        sampleMode={isSampleMode()}
      />
    </StaffFrame>
  );
}
