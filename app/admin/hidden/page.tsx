import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminHidden } from "@/components/staff/AdminHidden";
import { CampusFilter } from "@/components/staff/CampusFilter";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listHidden } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { inCampus, readCampusFilter } from "@/lib/staff/campus-filter";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_HIDDEN_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hidden listings and requests");
}

/**
 * Hidden listings and requests (stage J spec decision 14). Admins only; it sits under More (role views N3 plan decision
 * 8), with campus chips (spec 7.2).
 */
export default function AdminHiddenPage({ searchParams }: PageProps<"/admin/hidden">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton short />}>
        <Hidden searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Hidden({ searchParams }: Pick<PageProps<"/admin/hidden">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_HIDDEN_PATH);
  const [params, hidden, campuses, notice] = await Promise.all([searchParams, listHidden(account.id), getCampuses(), takeNotice()]);
  const chosen = readCampusFilter(params, campuses);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title="Hidden listings and requests"
      current={ADMIN_HIDDEN_PATH}
      notice={staffNoticeText(notice)}
    >
      <CampusFilter path={ADMIN_HIDDEN_PATH} campuses={campuses} chosen={chosen} />
      <AdminHidden
        listings={inCampus(hidden.listings, chosen, (item) => item.campusSlug)}
        requests={inCampus(hidden.requests, chosen, (item) => item.campusSlug)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        campusName={chosen?.name ?? null}
      />
    </StaffFrame>
  );
}
