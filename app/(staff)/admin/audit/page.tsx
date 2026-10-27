import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { AdminAudit } from "@/components/staff/AdminAudit";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { auditStaff, listAudit } from "@/lib/data/audit";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { parseAuditFilter } from "@/lib/staff/audit-words";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_AUDIT_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Audit log");
}

/** The audit log (staff tools spec 2.2 and 2.3). Its filters are in the link, read inside <Suspense>. */
export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Audit searchParams={searchParams} />
      </Reveal>
    </PageTransition>
  );
}

async function Audit({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_AUDIT_PATH);
  const filter = parseAuditFilter(await searchParams);
  const [entries, staff, notice] = await Promise.all([listAudit(filter), auditStaff(), takeNotice()]);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Audit log" route="/admin/audit" notice={staffNoticeText(notice)}>
      <AdminAudit entries={entries} staff={staff} filter={filter} />
    </StaffFrame>
  );
}
