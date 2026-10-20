import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getStaffAccount } from "@/lib/data/staff-accounts";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { removeRoleForm } from "@/lib/staff/form-state";
import { ADMIN_STAFF_PATH, removeRolePath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Remove a role");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no account. */
export function generateStaticParams() {
  return [{ id: "acc-sample" }];
}

/** Remove a mentor role's confirm page (stage J spec decision 4). Someone who isn't a mentor is the 404. */
export default function RemoveMentorPage({ params }: PageProps<"/admin/staff/[id]/remove-mentor">) {
  return (
    <Suspense fallback={<StaffSkeleton short />}>
      <Remove params={params} />
    </Suspense>
  );
}

async function Remove({ params }: Pick<PageProps<"/admin/staff/[id]/remove-mentor">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", removeRolePath(id, "mentor"));
  const person = isId(id) ? await getStaffAccount(id) : null;
  if (!person || !person.roles.includes("mentor")) notFound();
  const state = await readFormState(removeRoleForm(id, "mentor"));
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={`Remove ${person.firstName}'s mentor role`}
      current={ADMIN_STAFF_PATH}
      notice={null}
    >
      <StaffRoleConfirm person={person} role="mentor" viewerId={account.id} errors={staffErrors(state?.errors ?? [], {})} />
    </StaffFrame>
  );
}
