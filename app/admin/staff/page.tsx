import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminStaff } from "@/components/staff/AdminStaff";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { listStaffAccounts, ownShopMentorId } from "@/lib/data/staff-accounts";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { GIVE_ROLE_FIELDS, staffErrors } from "@/lib/staff/errors";
import { GIVE_ROLE_FORM, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { issueOnceToken } from "@/lib/staff/once";
import { ADMIN_STAFF_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Staff accounts");
}

/** Staff accounts (stage J spec decisions 2 and 3). Admins only. */
export default function AdminStaffPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <StaffAccounts />
    </Suspense>
  );
}

async function StaffAccounts() {
  const account = await requireStaff("admin", ADMIN_STAFF_PATH);
  // Give role gets a one-time token, made now, at request time (staff tools amendment 15.7).
  const [people, campuses, state, notice, once] = await Promise.all([
    listStaffAccounts(),
    getCampuses(),
    readFormState(GIVE_ROLE_FORM),
    takeNotice(),
    issueOnceToken(),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title="Staff accounts" current={ADMIN_STAFF_PATH} notice={staffNoticeText(notice)}>
      <AdminStaff
        people={people}
        viewerId={account.id}
        ownShopMentorId={ownShopMentorId(account.id)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        values={state?.values ?? {}}
        errors={staffErrors(state?.errors ?? [], GIVE_ROLE_FIELDS)}
        once={once}
      />
    </StaffFrame>
  );
}
