"use server";

import { normaliseEmail } from "@/lib/auth/email";
import { writeFormState } from "@/lib/auth/form-state";
import { findAccountByEmail } from "@/lib/data/accounts";
import { recordAudit } from "@/lib/data/audit";
import { notify } from "@/lib/data/notifications";
import { giveRole, removeRole } from "@/lib/data/staff-accounts";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { requireStaffAction } from "./access";
import { sampleFollowUps } from "./follow-ups";
import { clearStaffForm, GIVE_ROLE_FORM, leaveNotice, removeRoleForm } from "./form-state";
import { staffRoleText } from "./notification-text";
import { leaveOnceToken, type OnceSent, sentOnceToken, takeOnceToken } from "./once";
import { ADMIN_STAFF_PATH, removeRolePath } from "./paths";
import { parseStaffRole, roleLabel } from "./roles";

// Staff accounts' Server Actions (stage J spec decisions 3 to 7): giving the mentor or admin role by exact email, and
// taking one away. G's order (staff tools spec 2.2): the admin's role first, so a forged post gets the 404; the
// checks; the write; one audit entry, only when something changed; the person told, with the "staff-role" kind; a
// notice; done(). Nothing cached reads roles (getViewer() reads the store per request), so no tag is expired (plan
// decision 8). The person's next page load shows or hides their tools; their sessions aren't touched.

/** Where a role notification leads: the account page lists each staff area by role (staff tools plan decision 19). */
const ACCOUNT_PAGE = "/account";

/** A form sent again after its first send gave the role: back where that went, with its notice (G amendment 15.7). */
async function sentAgain(sent: OnceSent, now: Date): Promise<never> {
  await leaveNotice(sent.notice, now);
  done(sent.path);
}

/** Give a staff role's errors and typed values, kept in form state, never in the link (spec decision 3). */
async function backToForm(errors: string[], values: Record<string, string>, now: Date): Promise<never> {
  await writeFormState(GIVE_ROLE_FORM, { errors, values, notice: null }, now);
  done(ADMIN_STAFF_PATH);
}

/** A change that didn't happen: no audit entry, nothing sent, and the page says so (staff tools plan decision 23). */
async function nothingChanged(now: Date): Promise<never> {
  await leaveNotice("nothing", now);
  done(ADMIN_STAFF_PATH);
}

/**
 * Give a staff role (spec decision 3): the account with exactly this email, never a search. The fields are checked
 * before the one-time token is taken, so a mistake keeps it for the next try (plan decision 7).
 */
export async function giveStaffRole(formData: FormData): Promise<void> {
  const staff = await requireStaffAction("admin", ADMIN_STAFF_PATH);
  const now = new Date();
  const once = field(formData, "once");
  const earlier = await sentOnceToken(once, now);
  if (earlier) await sentAgain(earlier, now);
  const typed = field(formData, "email");
  const email = normaliseEmail(typed);
  const role = parseStaffRole(field(formData, "role"));
  const values = { email: keepTyped(typed), role: role ?? "" };
  const errors: string[] = [];
  const target = email === "" ? null : await findAccountByEmail(email);
  if (email === "") errors.push("staff-email-missing");
  else if (!target) errors.push("staff-email-unknown");
  if (!role) errors.push("staff-role-missing");
  else if (target?.roles.includes(role)) errors.push("staff-role-held");
  if (errors.length > 0 || !role) return backToForm(errors, values, now);
  const token = await takeOnceToken(once, now);
  if (token.kind === "none") return backToForm(["once-expired"], values, now);
  if (token.kind === "again") {
    if (token.sent) await sentAgain(token.sent, now);
    done(ADMIN_STAFF_PATH);
  }
  const given = await giveRole(email, role);
  if (given === "no-account") return backToForm(["staff-email-unknown"], values, now);
  if (given === "held") return backToForm(["staff-role-held"], values, now);
  // On Supabase give_role wrote the entry and told the person (decision 3).
  await sampleFollowUps(async () => {
    await recordAudit({
      staff: { id: staff.id, firstName: staff.firstName },
      action: "role-given",
      target: { kind: "account", id: given.id, name: given.firstName },
      detail: roleLabel(role),
      subjectId: given.id,
      now,
    });
    await notify({
      accountId: given.id,
      kind: "staff-role",
      subjectId: role,
      text: staffRoleText("given", role),
      href: ACCOUNT_PAGE,
      now,
    });
  });
  await clearStaffForm(GIVE_ROLE_FORM);
  await leaveOnceToken(once, { path: ADMIN_STAFF_PATH, notice: "role-given" }, now);
  await leaveNotice("role-given", now);
  done(ADMIN_STAFF_PATH);
}

/**
 * Take a role away, from its confirm page (spec decisions 4 and 5). Never your own admin role, never the last admin:
 * those go back to the confirm page with the words. Never the mentor role of whoever mentors your own shop (stage M
 * spec decision 5): that lands on the staff page with a notice, and nothing else is written. A mentor's shops lose
 * their mentor, and the entry names them.
 */
export async function removeStaffRole(formData: FormData): Promise<void> {
  const raw = field(formData, "account");
  const accountId = isId(raw) ? raw : null;
  const role = parseStaffRole(field(formData, "role"));
  const path = accountId && role ? removeRolePath(accountId, role) : ADMIN_STAFF_PATH;
  const staff = await requireStaffAction("admin", path);
  const now = new Date();
  if (!accountId || !role) return nothingChanged(now);
  const removed = await removeRole(accountId, role, staff.id);
  if (removed === "own-shop-mentor") {
    // Another admin's decision (stage M spec decisions 2 and 5): the notice is the only write, on the page that shows
    // staff notices. The confirm page's form state is left as it was.
    await leaveNotice("own-shop-mentor", now);
    done(ADMIN_STAFF_PATH);
  }
  if (removed === "own-admin" || removed === "last-admin") {
    await writeFormState(removeRoleForm(accountId, role), { errors: [`staff-${removed}`], values: {}, notice: null }, now);
    done(path);
  }
  if (!removed) return nothingChanged(now);
  const detail =
    role === "mentor" && removed.unassigned.length > 0
      ? `Mentor. No mentor now: ${removed.unassigned.join(", ")}`
      : roleLabel(role);
  // On Supabase remove_role wrote the entry and told the person (decision 3).
  await sampleFollowUps(async () => {
    await recordAudit({
      staff: { id: staff.id, firstName: staff.firstName },
      action: "role-removed",
      target: { kind: "account", id: removed.id, name: removed.firstName },
      detail,
      subjectId: removed.id,
      now,
    });
    await notify({
      accountId: removed.id,
      kind: "staff-role",
      subjectId: role,
      text: staffRoleText("removed", role),
      href: ACCOUNT_PAGE,
      now,
    });
  });
  await clearStaffForm(removeRoleForm(accountId, role));
  await leaveNotice("role-removed", now);
  done(ADMIN_STAFF_PATH);
}
