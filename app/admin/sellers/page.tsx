import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSellers } from "@/components/staff/AdminSellers";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Sellers");
}

/** Sellers (staff tools spec 2.3): waiting for approval first. Per request, behind a wordless skeleton. */
export default function AdminSellersPage() {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Sellers />
      </Suspense>
    </PageTransition>
  );
}

async function Sellers() {
  const account = await requireStaff("admin", ADMIN_SELLERS_PATH);
  const [rows, campuses, notice] = await Promise.all([listShopsForReview(), getCampuses(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Sellers" current={ADMIN_SELLERS_PATH} notice={staffNoticeText(notice)}>
      <AdminSellers rows={rows} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />
    </StaffFrame>
  );
}
