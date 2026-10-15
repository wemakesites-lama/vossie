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
