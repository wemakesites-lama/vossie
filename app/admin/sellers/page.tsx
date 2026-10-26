import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { AdminSellers } from "@/components/staff/AdminSellers";
import { CampusFilter } from "@/components/staff/CampusFilter";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { inCampus, readCampusFilter } from "@/lib/staff/campus-filter";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Shops");
}

/** Shops (staff tools spec 2.3): waiting for approval first, with campus chips (role views spec 7.2). Per request. */
export default function AdminSellersPage({ searchParams }: PageProps<"/admin/sellers">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton short />}>
        <Shops searchParams={searchParams} />
      </Reveal>
    </PageTransition>
  );
}

async function Shops({ searchParams }: Pick<PageProps<"/admin/sellers">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_SELLERS_PATH);
  const [params, rows, campuses, notice] = await Promise.all([searchParams, listShopsForReview(), getCampuses(), takeNotice()]);
  const chosen = readCampusFilter(params, campuses);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Shops" current={ADMIN_SELLERS_PATH} notice={staffNoticeText(notice)}>
      <CampusFilter path={ADMIN_SELLERS_PATH} campuses={campuses} chosen={chosen} />
      <AdminSellers
        rows={inCampus(rows, chosen, (row) => row.shop.campusSlug)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        campusName={chosen?.name ?? null}
      />
    </StaffFrame>
  );
}
