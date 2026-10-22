import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAudit } from "@/components/staff/AdminAudit";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { auditStaff, listAudit } from "@/lib/data/audit";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { parseAuditFilter } from "@/lib/staff/audit-words";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_AUDIT_PATH } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Audit log");
}

/** The audit log (staff tools spec 2.2 and 2.3). Its filters are in the link, read inside <Suspense>. */
export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Audit({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_AUDIT_PATH);
  const filter = parseAuditFilter(await searchParams);
  const [entries, staff, notice] = await Promise.all([listAudit(filter), auditStaff(), takeNotice()]);
  return (
    <StaffFrame account={account} area="Admin console" title="Audit log" current={ADMIN_AUDIT_PATH} notice={staffNoticeText(notice)}>
      <AdminAudit entries={entries} staff={staff} filter={filter} />
    </StaffFrame>
  );
}
