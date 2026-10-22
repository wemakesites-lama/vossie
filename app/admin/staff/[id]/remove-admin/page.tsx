import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { roleConfirmTitle, StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getStaffAccount } from "@/lib/data/staff-accounts";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { removeRoleForm } from "@/lib/staff/form-state";
import { ADMIN_STAFF_PATH, removeRolePath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Remove a role");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no account. */
export function generateStaticParams() {
  return [{ id: "acc-sample" }];
}

/** Remove an admin role's confirm page (stage J spec decisions 4 and 5). Someone who isn't an admin is the 404; your own admin role shows the refusal and no button. */
export default function RemoveAdminPage({ params }: PageProps<"/admin/staff/[id]/remove-admin">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton short />}>
        <Remove params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Remove({ params }: Pick<PageProps<"/admin/staff/[id]/remove-admin">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", removeRolePath(id, "admin"));
  const person = isId(id) ? await getStaffAccount(id) : null;
  if (!person || !person.roles.includes("admin")) notFound();
  const state = await readFormState(removeRoleForm(id, "admin"));
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title={roleConfirmTitle(person, "admin", account.id)}
      current={ADMIN_STAFF_PATH}
      notice={null}
    >
      <StaffRoleConfirm person={person} role="admin" viewerId={account.id} errors={staffErrors(state?.errors ?? [], {})} />
    </StaffFrame>
  );
}
