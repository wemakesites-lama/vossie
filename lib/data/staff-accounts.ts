import { normaliseEmail } from "@/lib/auth/email";
import { onSupabase } from "@/lib/backend";
import { findAccountByEmail } from "./accounts";
import type { StaffRole } from "@/lib/types";
import type { AccountRow } from "./rows";
import { sampleStore } from "./store";

// Staff accounts (stage J spec decisions 1 to 6): who holds the mentor or admin role, giving one by exact email, and
// taking one away. Roles live on the account row, which getViewer() reads on every request, so a change shows on the
// person's next page; their sessions aren't touched. Students without a role are never listed, searched or suggested
// (POPIA section 10). Only Server Actions call the writes. Nothing here awaits between a check and its write, so in
// sample mode two admins removing each other can't both pass the last-admin check; on Supabase remove_role takes a
// lock and checks the remover's role again under it (C4/C5 plan decision 19).
//
// On Supabase (C4/C5 plan Task 20) each function is lib/data/supabase/staff-accounts.ts's, picked by its first line
// through import(), so sample mode never loads Supabase code. ownShopMentorId stays the sample's internal.

const supabase = () => import("./supabase/staff-accounts");

/** Someone with a role, as /admin/staff lists them (spec decision 2). */
export type StaffAccount = {
  id: string;
  firstName: string;
  /** Lower case. Shown because roles are given by email and two staff may share a first name. */
  email: string;
  /** Their own campus, chosen at sign-in: information only, roles aren't tied to it (spec decision 1). */
  campusSlug: string;
  /** Mentor first, then admin. */
  roles: StaffRole[];
  /** The names of the shops they mentor, by name. */
  mentors: string[];
};

/** A role given (spec decision 3): who to tell and name in the log. */
export type GivenRole = { id: string; firstName: string };

/** A role taken away, and the shops a mentor leaves without a mentor (spec decisions 6 and 7). */
export type RemovedRole = { id: string; firstName: string; role: StaffRole; unassigned: string[] };

/** Roles are stored in this order, so "Mentor, Admin" always reads the same (plan decision 5). */
const ROLE_ORDER: readonly StaffRole[] = ["mentor", "admin"];

function mentoredShopNames(accountId: string): string[] {
  const { sellerProfiles, sellers } = sampleStore();
  const owners = new Set(
    [...sellerProfiles.values()].filter((profile) => profile.mentorId === accountId).map((profile) => profile.accountId),
  );
  return [...sellers.values()]
    .filter((row) => row.ownerId !== null && owners.has(row.ownerId))
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b));
}

function toStaff(row: AccountRow): StaffAccount {
  return {
    id: row.id,
    firstName: row.firstName,
    email: row.email,
    campusSlug: row.campusSlug,
    roles: ROLE_ORDER.filter((role) => row.roles.includes(role)),
    mentors: mentoredShopNames(row.id),
  };
}

const adminRows = () => [...sampleStore().accounts.values()].filter((row) => row.roles.includes("admin"));

/**
 * Who mentors `ownerId`'s own shop, read from the store now, never from a form (stage M spec decision 2): their seller
 * profile's mentor, whatever state the shop is in (live, paused or waiting), or null. Synchronous, so removeRole checks
 * it and writes in one pass.
 */
export function ownShopMentorId(ownerId: string): string | null {
  return sampleStore().sellerProfiles.get(ownerId)?.mentorId ?? null;
}

/**
 * Who mentors `ownerId`'s own shop, on either backend (C4/C5 plan Task 12, decision 5): what /admin/staff passes its
 * rows, so the remove link for that mentor shows the line instead. Pages ask this, never ownShopMentorId.
 */
export async function ownShopMentor(ownerId: string): Promise<string | null> {
  if (onSupabase()) return (await supabase()).ownShopMentor(ownerId);
  return ownShopMentorId(ownerId);
}

/** Everyone with a role, and no one else, by first name, then email (spec decision 2). */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  if (onSupabase()) return (await supabase()).listStaffAccounts();
  return [...sampleStore().accounts.values()]
    .filter((row) => row.roles.length > 0)
    .map(toStaff)
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.email.localeCompare(b.email));
}

/** One person with a role, for a confirm page (plan decision 5). Null for an unknown account or one with no role. */
export async function getStaffAccount(id: string): Promise<StaffAccount | null> {
  if (onSupabase()) return (await supabase()).getStaffAccount(id);
  const row = sampleStore().accounts.get(id);
  return row && row.roles.length > 0 ? toStaff(row) : null;
}

/** How many accounts hold the admin role, for privacy settings' "only admin" line (spec decision 8). */
export async function countAdmins(): Promise<number> {
  if (onSupabase()) return (await supabase()).countAdmins();
  return adminRows().length;
}

/**
 * What the remove-mentor confirm page shows, read from the store now (stage M spec decisions 2 and 6): whether
 * `personId` mentors `viewerId`'s own shop, and whether exactly one account holds the admin role.
 */
export async function removeMentorView(
  viewerId: string,
  personId: string,
): Promise<{ mentorsOwnShop: boolean; onlyAdmin: boolean }> {
  if (onSupabase()) return (await supabase()).removeMentorView(viewerId, personId);
  return { mentorsOwnShop: ownShopMentorId(viewerId) === personId, onlyAdmin: (await countAdmins()) === 1 };
}

/** Who Give a staff role would give it to (stage J spec decision 3): their id, first name and roles. */
export type StaffCandidate = { id: string; firstName: string; roles: StaffRole[] };

/**
 * The account with exactly this email, trimmed and lower case, the lookup sign-in uses, never a search (C4/C5 plan
 * Task 20): Give a staff role's check before it takes the form's token. Null when there's none.
 */
export async function findStaffCandidate(email: string): Promise<StaffCandidate | null> {
  if (onSupabase()) return (await supabase()).findStaffCandidate(email);
  const wanted = normaliseEmail(email);
  const account = wanted === "" ? null : await findAccountByEmail(wanted);
  if (!account) return null;
  return { id: account.id, firstName: account.firstName, roles: ROLE_ORDER.filter((role) => account.roles.includes(role)) };
}

/**
 * Gives `role` to the account with exactly this email (spec decision 3): trimmed and lower case, the lookup sign-in
 * uses, never a search. "no-account" when none has it (giving a role never makes an account), "held" when it has the
 * role already. `onceToken` is the form's one-time token (C4/C5 plan decision 6): on Supabase give_role takes it in the
 * same transaction; the sample ignores it (its action takes the token itself).
 */
export async function giveRole(
  email: string,
  role: StaffRole,
  onceToken?: string,
): Promise<GivenRole | "no-account" | "held"> {
  if (onSupabase()) return (await supabase()).giveRole(email, role, onceToken);
  const wanted = normaliseEmail(email);
  const row = wanted === "" ? undefined : [...sampleStore().accounts.values()].find((item) => item.email === wanted);
  if (!row) return "no-account";
  if (row.roles.includes(role)) return "held";
  row.roles = ROLE_ORDER.filter((item) => item === role || row.roles.includes(item));
  return { id: row.id, firstName: row.firstName };
}

/**
 * Takes `role` away from `accountId`, asked by the admin `byId` (spec decisions 5 and 6). Never your own admin role
 * ("own-admin"), never the last admin ("last-admin"), and never the mentor role of whoever mentors `byId`'s own shop
 * ("own-shop-mentor", stage M spec decision 2): leaving your own shop without a mentor is another admin's decision. A
 * mentor's shops lose their mentor, as deleting the account does (lib/data/staff-privacy.ts); their notes, check-ins
 * and Hub posts stay. Null when there's no such role to take.
 */
export async function removeRole(
  accountId: string,
  role: StaffRole,
  byId: string,
): Promise<RemovedRole | "own-admin" | "last-admin" | "own-shop-mentor" | null> {
  if (onSupabase()) return (await supabase()).removeRole(accountId, role, byId);
  const store = sampleStore();
  const row = store.accounts.get(accountId);
  if (!row || !row.roles.includes(role)) return null;
  if (role === "mentor" && ownShopMentorId(byId) === accountId) return "own-shop-mentor";
  if (role === "admin" && accountId === byId) return "own-admin";
  if (role === "admin" && adminRows().length <= 1) return "last-admin";
  const unassigned = role === "mentor" ? mentoredShopNames(accountId) : [];
  if (role === "mentor") {
    for (const profile of store.sellerProfiles.values()) {
      if (profile.mentorId === accountId) profile.mentorId = null;
    }
  }
  row.roles = row.roles.filter((item) => item !== role);
  return { id: row.id, firstName: row.firstName, role, unassigned };
}
