import Link from "next/link";
import { NavPending } from "@/components/ui/NavPending";
import type { FormError } from "@/lib/auth/messages";
import type { StaffAccount } from "@/lib/data/staff-accounts";
import { BACK } from "@/lib/motion";
import { removeStaffRole } from "@/lib/staff/account-actions";
import { ADMIN_STAFF_PATH } from "@/lib/staff/paths";
import type { StaffRole } from "@/lib/types";
import { ConfirmAction } from "./ConfirmAction";

type StaffRoleConfirmProps = {
  person: StaffAccount;
  role: StaffRole;
  /** The signed-in admin, who can't remove their own admin role (spec decision 5). */
  viewerId: string;
  errors: readonly FormError[];
  /**
   * Whether `person` mentors the signed-in admin's own shop: the page refuses rather than asks (stage M spec decision
   * 6). Only the remove-mentor page passes it.
   */
  mentorsOwnShop?: boolean;
  /** Whether the signed-in admin is the only one, so the refusal says how to hand the role on (stage M spec section 3). */
  onlyAdmin?: boolean;
};

/** What taking `role` away does, a line each (spec decision 4, plan decision 10). Samples for Lama to change. */
export function removalLines(person: Pick<StaffAccount, "firstName" | "roles" | "mentors">, role: StaffRole): string[] {
  const name = person.firstName;
  if (role === "admin") {
    return [`${name} loses the admin console straight away.`, `${name}'s entries in the audit log stay.`];
  }
  return [
    person.roles.includes("admin")
      ? `${name} stays an admin, so keeps the Hub's tools and the mentor dashboard.`
      : `${name} loses the Hub's tools and the mentor dashboard straight away.`,
    person.mentors.length > 0
      ? `These shops will have no mentor: ${person.mentors.join(", ")}. Give them a new one on each shop's page.`
      : `${name} mentors no shops.`,
    `${name}'s notes, check-ins and Hub posts stay. Only an admin can edit those posts afterwards.`,
  ];
}

/**
 * The page's heading. Your own admin role is named as yours, and the mentor role of whoever mentors your own shop as
 * theirs (stage M spec decision 6), since those pages refuse rather than ask.
 */
export function roleConfirmTitle(
  person: Pick<StaffAccount, "id" | "firstName">,
  role: StaffRole,
  viewerId: string,
  mentorsOwnShop = false,
): string {
  if (role === "admin" && person.id === viewerId) return "Your admin role";
  if (role === "mentor" && mentorsOwnShop) return `${person.firstName}'s mentor role`;
  return `Remove ${person.firstName}'s ${role} role`;
}

/**
 * A role's confirm page (spec decisions 4 and 5): what will happen, then the button, with no reason field. Your own
 * admin role gets the refusal and no button; the action refuses it too. So does the mentor role of whoever mentors your own shop (stage M).
 */
export function StaffRoleConfirm({
  person,
  role,
  viewerId,
  errors,
  mentorsOwnShop = false,
  onlyAdmin = false,
}: StaffRoleConfirmProps) {
  if (role === "admin" && person.id === viewerId) {
    return (
      <div className="staff-confirm">
        <p className="staff-confirm-lead">You can&apos;t remove your own admin role. Ask another admin.</p>
        <p>
          <Link href={ADMIN_STAFF_PATH} transitionTypes={BACK} prefetch={false}>
            Back to staff accounts
            <NavPending />
          </Link>
        </p>
      </div>
    );
  }
  if (role === "mentor" && mentorsOwnShop) {
    // Stage M spec decision 6: the reason where the button was, and no button. The words are samples for Lama.
    return (
      <div className="staff-confirm">
        <p className="staff-confirm-lead">
          {`${person.firstName} mentors your own shop, so another admin must remove this role: it would leave your shop without a mentor.`}
        </p>
        {onlyAdmin && <p>You&apos;re the only admin. Give someone else the Admin role first.</p>}
        <p>
          <Link href={ADMIN_STAFF_PATH} transitionTypes={BACK} prefetch={false}>
            Back to staff accounts
            <NavPending />
          </Link>
        </p>
      </div>
    );
  }
  const label = `Remove ${person.firstName}'s ${role} role`;
  return (
    <ConfirmAction
      id={`remove-${role}-${person.id}`}
      lead={`${label}?`}
      consequences={removalLines(person, role)}
      action={removeStaffRole}
      hidden={{ account: person.id, role }}
      reason={false}
      errors={errors}
      confirmLabel={label}
      keepHref={ADMIN_STAFF_PATH}
    />
  );
}
