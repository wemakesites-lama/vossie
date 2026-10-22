import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminMore } from "@/components/staff/AdminMore";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { countHidden } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { ADMIN_MORE_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "More tools");
}

/** More (role views spec 4.1): admins only, the 404 for everyone else, like every staff page. */
export default function AdminMorePage() {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton short />}>
        <More />
      </Suspense>
    </PageTransition>
  );
}

async function More() {
  const account = await requireStaff("admin", ADMIN_MORE_PATH);
  const hidden = await countHidden();
  return (
    <StaffFrame account={account} area="Admin console" title="More tools" current={ADMIN_MORE_PATH} notice={null}>
      <AdminMore hidden={hidden} />
    </StaffFrame>
  );
}
