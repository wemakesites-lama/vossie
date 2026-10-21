import "server-only";
import type { StaffRole } from "@/lib/types";
import { Refused, type RefusalCode } from "../refused";
import type * as Sample from "../staff-accounts";
import { forViewer, type DbClient } from "./clients";
import { selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// Staff accounts on Supabase (C4/C5 plan Tasks 12 and 20; decisions 2, 6 and 19). The admin reads with their own
// session: staff_accounts (everyone with a role and no one else, with the email roles are given by, for admins only),
// staff_seller_profiles and shops for the shops each mentors, and profiles for the admins' count. Give a role is
// give_role, which takes the form's one-time token, finds the account by exact email (staff_find_account's rule, never
// a search), writes the audit entry and tells the person in one transaction; Remove is remove_role, which refuses your
// own admin role, your own shop's mentor and the last admin, under a lock so two admins can't remove each other at once
// (decisions 3 and 19). Nothing cached reads roles. Request-time only.

/** Roles are stored and shown in this order (ROLE_ORDER in the sample module). */
const ROLE_ORDER: readonly StaffRole[] = ["mentor", "admin"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

const rolesOf = (roles: readonly string[] | null): StaffRole[] => ROLE_ORDER.filter((role) => roles?.includes(role));

/**
 * Who mentors the viewing admin's own shop, read from staff_seller_profiles (a seller never reads who mentors them in
 * seller_profiles; an admin reads every row of the staff view). Null when nobody does, or they have no shop.
 */
export const ownShopMentor: typeof Sample.ownShopMentor = async (ownerId) => {
  const client = await forViewerAs(ownerId);
  const { data, error } = await client.from("staff_seller_profiles").select("mentor_id").eq("account_id", ownerId).maybeSingle();
  if (error) failed("staff_seller_profiles", error);
  return data?.mentor_id ?? null;
};

/** The names of the shops each of these people mentors, by name: an owned shop whose seller profile names them. */
async function mentoredNames(client: DbClient, mentorIds: readonly string[]): Promise<Map<string, string[]>> {
  const names = new Map<string, string[]>();
  if (mentorIds.length === 0) return names;
  const profiles = await selectAll(
    () => client.from("staff_seller_profiles").select("account_id, shop_id, mentor_id").in("mentor_id", [...mentorIds]),
    ["account_id"],
  );
  const shopIds = profiles.flatMap((row) => (row.shop_id ? [row.shop_id] : []));
  const shops = new Map<string, string>();
  for (let from = 0; from < shopIds.length; from += 100) {
    const { data, error } = await client.from("shops").select("id, name").in("id", shopIds.slice(from, from + 100));
    if (error) failed("shops", error);
    for (const row of data) shops.set(row.id, row.name);
  }
  for (const row of profiles) {
    const name = row.shop_id ? shops.get(row.shop_id) : undefined;
    if (!row.mentor_id || name === undefined) continue;
    names.set(row.mentor_id, [...(names.get(row.mentor_id) ?? []), name]);
  }
  for (const list of names.values()) list.sort((a, b) => a.localeCompare(b));
  return names;
}

type StaffRecord = { id: string | null; first_name: string | null; email: string | null; campus_slug: string | null; roles: string[] | null };

async function staffAccounts(client: DbClient, rows: readonly StaffRecord[]): Promise<Sample.StaffAccount[]> {
  const mentors = await mentoredNames(
    client,
    rows.flatMap((row) => (row.id ? [row.id] : [])),
  );
  return rows.flatMap((row) =>
    row.id && row.first_name !== null && row.email !== null && row.campus_slug !== null
      ? [
          {
            id: row.id,
            firstName: row.first_name,
            email: row.email,
            campusSlug: row.campus_slug,
            roles: rolesOf(row.roles),
            mentors: mentors.get(row.id) ?? [],
          },
        ]
      : [],
  );
}

const STAFF_COLUMNS = "id, first_name, email, campus_slug, roles";

export const listStaffAccounts: typeof Sample.listStaffAccounts = async () => {
  const client = await forViewer();
  const rows = await selectAll(() => client.from("staff_accounts").select(STAFF_COLUMNS), ["id"]);
  return (await staffAccounts(client, rows)).sort(
    (a, b) => a.firstName.localeCompare(b.firstName) || a.email.localeCompare(b.email),
  );
};

export const getStaffAccount: typeof Sample.getStaffAccount = async (id) => {
  if (!UUID.test(id)) return null;
  const client = await forViewer();
  const { data, error } = await client.from("staff_accounts").select(STAFF_COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("staff_accounts", error);
  return data ? ((await staffAccounts(client, [data]))[0] ?? null) : null;
};

/** How many accounts hold the admin role (staff read every profile; callers ask only for an admin). */
export const countAdmins: typeof Sample.countAdmins = async () => {
  const { count, error } = await (await forViewer())
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .contains("roles", ["admin"]);
  if (error) failed("profiles", error);
  return count ?? 0;
};

export const removeMentorView: typeof Sample.removeMentorView = async (viewerId, personId) => {
  const [mentor, admins] = await Promise.all([ownShopMentor(viewerId), countAdmins()]);
  return { mentorsOwnShop: mentor === personId, onlyAdmin: admins === 1 };
};

/** The account with exactly this email, trimmed and lower case, never a search (staff_find_account, for admins). */
export const findStaffCandidate: typeof Sample.findStaffCandidate = async (email) => {
  const { data, error } = await (await forViewer()).rpc("staff_find_account", { p_email: email }).maybeSingle();
  if (error) failed("staff_find_account", error);
  return data ? { id: data.id, firstName: data.first_name, roles: rolesOf(data.roles) } : null;
};

/** give_role's answers that the sample's shape has no room for (decision 2). */
const GIVE_REFUSALS: readonly RefusalCode[] = ["forbidden", "once-expired", "once-taken"];

/**
 * Gives the role by exact email with the admin's session and the form's one-time token (decision 6). The person, read
 * back by the same exact lookup; "no-account" and "held" as the sample's.
 */
export const giveRole: typeof Sample.giveRole = async (email, role, onceToken) => {
  const client = await forViewer();
  const { data, error } = await client.rpc("give_role", {
    p_email: email,
    p_role: role,
    p_once_token: (onceToken ?? null) as string,
  });
  if (error) failed("give_role", error);
  if (data === "no-account" || data === "held") return data;
  if (GIVE_REFUSALS.includes(data as RefusalCode)) throw new Refused(data as RefusalCode);
  if (data !== "changed") throw new Error(`give_role answered ${String(data)}`);
  const given = await findStaffCandidate(email);
  if (!given) throw new Error("give_role's account can't be read back");
  return { id: given.id, firstName: given.firstName };
};

/**
 * Takes the role away with the acting admin's own session (`byId` must be it). The person's name and, for a mentor,
 * the shops they leave without a mentor are read first, as the function changes them; its refusals other than
 * "forbidden" pass through as the sample's.
 */
export const removeRole: typeof Sample.removeRole = async (accountId, role, byId) => {
  if (!UUID.test(accountId)) return null;
  const client = await forViewerAs(byId);
  const [person, unassigned] = await Promise.all([
    client.from("profiles").select("first_name").eq("id", accountId).maybeSingle(),
    role === "mentor" ? mentoredNames(client, [accountId]) : Promise.resolve(new Map<string, string[]>()),
  ]);
  if (person.error) failed("profiles", person.error);
  const { data, error } = await client.rpc("remove_role", { p_account: accountId, p_role: role });
  if (error) failed("remove_role", error);
  if (data === "nothing") return null;
  if (data === "own-admin" || data === "last-admin" || data === "own-shop-mentor") return data;
  if (data === "forbidden") throw new Refused("forbidden");
  if (data !== "changed" || !person.data) throw new Error(`remove_role answered ${String(data)}`);
  return { id: accountId, firstName: person.data.first_name, role, unassigned: unassigned.get(accountId) ?? [] };
};
