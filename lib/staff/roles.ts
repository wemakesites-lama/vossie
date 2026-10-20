import type { Account, StaffArea, StaffRole } from "@/lib/types";

// Who may use each staff area (staff tools spec 2.1): an admin for /admin; a mentor or an admin for the Hub's tools
// (/hub/manage, /hub/new, /hub/[id]/edit) and the mentor dashboard (/mentor). Plain functions, safe anywhere.

const AREA_ROLES: Readonly<Record<StaffArea, readonly StaffRole[]>> = {
  admin: ["admin"],
  hub: ["mentor", "admin"],
  mentor: ["mentor", "admin"],
};

const AREAS: readonly StaffArea[] = ["admin", "hub", "mentor"];

/** Whether `account` may use `area`. A signed-out visitor (null) never may. */
export function canUse(account: Pick<Account, "roles"> | null, area: StaffArea): boolean {
  return account !== null && account.roles.some((role) => AREA_ROLES[area].includes(role));
}

/** Admins see every assigned shop and edit any post; mentors see their own (plan decisions 11 and 15). */
export function isAdmin(account: Pick<Account, "roles">): boolean {
  return account.roles.includes("admin");
}

/** The staff areas the account may use, in the order the account page lists them (plan decision 19). */
export function staffAreasOf(account: Pick<Account, "roles">): StaffArea[] {
  return AREAS.filter((area) => canUse(account, area));
}

/** The roles an admin can give, in the form's order, with what each opens (stage J spec decisions 1 and 3). */
export const ROLE_CHOICES: ReadonlyArray<{ role: StaffRole; label: string; hint: string }> = [
  { role: "mentor", label: "Mentor", hint: "The Hub's posts and office hours, and the mentor dashboard" },
  { role: "admin", label: "Admin", hint: "Everything, including this page" },
];

/** A role from a form, only from the fixed list: anything else, a forged value included, is null (spec section 5). */
export function parseStaffRole(raw: string): StaffRole | null {
  return ROLE_CHOICES.find((choice) => choice.role === raw)?.role ?? null;
}

/** "Mentor" or "Admin", as the staff list, the audit log and the confirm pages write it. */
export function roleLabel(role: StaffRole): string {
  return role === "mentor" ? "Mentor" : "Admin";
}

/** "Mentor", "Admin" or "Mentor, Admin": always in the form's order (spec decision 2). */
export function rolesText(roles: readonly StaffRole[]): string {
  return ROLE_CHOICES.filter((choice) => roles.includes(choice.role))
    .map((choice) => choice.label)
    .join(", ");
}
