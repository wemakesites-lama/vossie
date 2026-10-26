import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/kit/Reveal";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { roleConfirmTitle, StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getStaffAccount, removeMentorView } from "@/lib/data/staff-accounts";
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

/** Remove a mentor role's confirm page (stage J spec decision 4). Someone who isn't a mentor is the 404. */
export default function RemoveMentorPage({ params }: PageProps<"/admin/staff/[id]/remove-mentor">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton short />}>
        <Remove params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Remove({ params }: Pick<PageProps<"/admin/staff/[id]/remove-mentor">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", removeRolePath(id, "mentor"));
  const person = isId(id) ? await getStaffAccount(id) : null;
  if (!person || !person.roles.includes("mentor")) notFound();
  const state = await readFormState(removeRoleForm(id, "mentor"));
  // Whether this person mentors the admin's own shop, read from the store now (stage M spec decisions 2 and 6).
  const { mentorsOwnShop, onlyAdmin } = await removeMentorView(account.id, id);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title={roleConfirmTitle(person, "mentor", account.id, mentorsOwnShop)}
      current={ADMIN_STAFF_PATH}
      notice={null}
    >
      <StaffRoleConfirm
        person={person}
        role="mentor"
        viewerId={account.id}
        errors={staffErrors(state?.errors ?? [], {})}
        mentorsOwnShop={mentorsOwnShop}
        onlyAdmin={onlyAdmin}
      />
    </StaffFrame>
  );
}
