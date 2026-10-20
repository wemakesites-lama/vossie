import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHidden } from "@/components/staff/AdminHidden";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listHidden } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_HIDDEN_PATH, ADMIN_REPORTS_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hidden listings and requests");
}

/** Hidden listings and requests (stage J spec decision 14). Admins only; it sits under Reports in the frame. */
export default function AdminHiddenPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Hidden />
    </Suspense>
  );
}

async function Hidden() {
  const account = await requireStaff("admin", ADMIN_HIDDEN_PATH);
  const [hidden, campuses, notice] = await Promise.all([listHidden(account.id), getCampuses(), takeNotice()]);
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title="Hidden listings and requests"
      current={ADMIN_REPORTS_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminHidden
        listings={hidden.listings}
        requests={hidden.requests}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
