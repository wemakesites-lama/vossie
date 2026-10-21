import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { listStaffAccounts } from "@/lib/data/staff-accounts";
import type { ActionScenario } from "@/tests/contract/actions";
import type { WorldAccountName } from "@/tests/contract/world";
import { giveStaffRole, removeStaffRole } from "../account-actions";
import { GIVE_ROLE_FORM, removeRoleForm, STAFF_NOTICE } from "../form-state";
import { staffRoleText } from "../notification-text";
import { issueOnceToken } from "../once";
import { ADMIN_STAFF_PATH, removeRolePath } from "../paths";

// Giving and taking staff roles on both backends (C4/C5 plan Task 20; decisions 3, 6 and 19): a role is given by exact
// email only, once however many times the form is sent, with one entry in the log and the person told; a prefix of an
// email, a role held and a made-up token are the form's errors; a mentor gets the 404; nobody removes their own admin
// role or their own shop's mentor; another admin's removal takes a mentor's shops with it; and two admins removing each
// other at once leave exactly one. Every refusal leaves the roles, the log and everyone's notifications as they were.
// "staff" is an admin; "asker", "shopper" and "seller" get roles where a scenario says. roles.test.ts runs it on the
// sample store, roles.db.test.ts on the local stack.

const PEOPLE: readonly WorldAccountName[] = ["staff", "shopper", "asker", "seller"];

export function rolesContract(scenario: () => ActionScenario): void {
  const world = () => scenario().world;
  const setUp = async () => {
    await world().tidyStaffTools();
    await world().tidyMessaging();
  };
  /** Everyone's roles, the log's size and everyone's notifications: what a refusal must leave as it was. */
  const state = async () => ({
    roles: await Promise.all(PEOPLE.map(async (name) => (await world().viewerAccount(name)).roles)),
    audit: await world().auditCount(),
    notes: await Promise.all(PEOPLE.map((name) => world().notificationsOf(name))),
    tags: [...scenario().tags()],
  });
  const formErrors = async () => (await readFormState(GIVE_ROLE_FORM))?.errors ?? null;
  const give = async (email: string, role: string, once?: string) =>
    scenario().post(giveStaffRole, { email, role, once: once ?? (await issueOnceToken())! });

  it("gives a role by exact email once, however many times the form is sent, and tells the person once", async () => {
    await setUp();
    await scenario().signIn("staff");
    const before = await state();
    const once = (await issueOnceToken())!;
    expect((await give(" Contract-Shopper@VOSSIE.test ", "mentor", once)).redirect).toBe(ADMIN_STAFF_PATH);
    expect((await scenario().notice(STAFF_NOTICE))?.notice).toBe("role-given");
    expect((await give(" Contract-Shopper@VOSSIE.test ", "mentor", once)).redirect).toBe(ADMIN_STAFF_PATH);
    expect((await world().viewerAccount("shopper")).roles).toEqual(["mentor"]);
    expect(await world().auditCount()).toBe(before.audit + 1);
    expect((await world().notificationsOf("shopper")).slice(before.notes[1].length)).toEqual([
      { kind: "staff-role", subjectId: "mentor", text: staffRoleText("given", "mentor"), href: "/account" },
    ]);
    expect(scenario().tags()).toEqual([]);
  });

  it("refuses a part of an email, a role held and a made-up token as the form's errors, changing nothing", async () => {
    await setUp();
    await world().setRoles("asker", ["mentor"]);
    await scenario().signIn("staff");
    const before = await state();
    expect((await give("contract-shop", "mentor")).redirect).toBe(ADMIN_STAFF_PATH);
    expect(await formErrors()).toEqual(["staff-email-unknown"]);
    expect((await give("contract-shopper@vossie", "mentor")).redirect).toBe(ADMIN_STAFF_PATH);
    expect(await formErrors()).toEqual(["staff-email-unknown"]);
    expect((await give("contract-asker@vossie.test", "mentor")).redirect).toBe(ADMIN_STAFF_PATH);
    expect(await formErrors()).toEqual(["staff-role-held"]);
    expect((await give("contract-shopper@vossie.test", "mentor", randomUUID())).redirect).toBe(ADMIN_STAFF_PATH);
    expect(await readFormState(GIVE_ROLE_FORM)).toMatchObject({
      errors: ["once-expired"],
      values: { email: "contract-shopper@vossie.test", role: "mentor" },
    });
    expect(await state()).toEqual(before);
  });

  it("gives a mentor the 404 for both actions, changing nothing", async () => {
    await setUp();
    await world().setRoles("asker", ["mentor"]);
    const staffId = await world().signedIn("staff");
    await scenario().signIn("asker");
    const before = await state();
    expect(await give("contract-shopper@vossie.test", "mentor")).toEqual({ redirect: null, type: undefined, notFound: true });
    expect(await scenario().post(removeStaffRole, { account: staffId, role: "admin" })).toEqual({ redirect: null, type: undefined, notFound: true });
    expect(await state()).toEqual(before);
  });

  it("never removes your own admin role: back to the confirm page with the words, changing nothing", async () => {
    await setUp();
    const staffId = (await scenario().signIn("staff"))!;
    await world().setRoles("asker", ["admin"]);
    const before = await state();
    const posted = await scenario().post(removeStaffRole, { account: staffId, role: "admin" });
    expect(posted.redirect).toBe(removeRolePath(staffId, "admin"));
    expect((await readFormState(removeRoleForm(staffId, "admin")))?.errors).toEqual(["staff-own-admin"]);
    expect(await state()).toEqual(before);
  });

  it("never removes the mentor role of whoever mentors your own shop; another admin can, and the shop loses its mentor", async () => {
    await setUp();
    const askerId = await world().signedIn("asker");
    await world().setRoles("asker", ["mentor"]);
    await world().setRoles("seller", ["admin"]);
    await world().setMentor(await world().openShop("staff", { name: "Contract staff's bakes" }), "asker");
    await scenario().signIn("staff");
    const before = await state();
    const refused = await scenario().post(removeStaffRole, { account: askerId, role: "mentor" });
    expect(refused.redirect).toBe(ADMIN_STAFF_PATH);
    expect((await scenario().notice(STAFF_NOTICE))?.notice).toBe("own-shop-mentor");
    expect(await state()).toEqual(before);
    const mentors = async () => (await world().asViewer("staff", () => listStaffAccounts())).find((person) => person.id === askerId)?.mentors;
    expect(await mentors()).toEqual(["Contract staff's bakes"]);

    await scenario().signIn("seller");
    const removed = await scenario().post(removeStaffRole, { account: askerId, role: "mentor" });
    expect(removed.redirect).toBe(ADMIN_STAFF_PATH);
    expect((await scenario().notice(STAFF_NOTICE))?.notice).toBe("role-removed");
    expect((await world().viewerAccount("asker")).roles).toEqual([]);
    expect(await world().auditCount()).toBe(before.audit + 1);
    expect((await world().asViewer("seller", () => listAudit({ staff: null, kind: null }, 1)))[0]).toMatchObject({
      action: "role-removed",
      detail: "Mentor. No mentor now: Contract staff's bakes",
    });
    expect((await world().notificationsOf("asker")).slice(before.notes[2].length)).toEqual([
      { kind: "staff-role", subjectId: "mentor", text: staffRoleText("removed", "mentor"), href: "/account" },
    ]);
    expect(scenario().tags()).toEqual([]);
  });

  it("leaves exactly one admin when the last two remove each other at once (decision 19)", async () => {
    await setUp();
    const [staffId, askerId] = await Promise.all([world().signedIn("staff"), world().signedIn("asker")]);
    await world().onlyAdmins(["staff", "asker"]);
    await scenario().signIn(null);
    // One post first, alone, that changes nothing: the session and data modules load on first use, and a mocked
    // module's first load isn't safe to start twice at once in the test runner (the second can get the unmocked one).
    expect((await scenario().postAs("staff", removeStaffRole, { account: "", role: "" })).redirect).toBe(ADMIN_STAFF_PATH);
    const before = await world().auditCount();
    const [byStaff, byAsker] = await Promise.all([
      scenario().postAs("staff", removeStaffRole, { account: askerId, role: "admin" }),
      scenario().postAs("asker", removeStaffRole, { account: staffId, role: "admin" }),
    ]);
    const admins = await Promise.all(
      (["staff", "asker"] as const).map(async (name) => (await world().viewerAccount(name)).roles.includes("admin")),
    );
    expect(admins.filter(Boolean)).toHaveLength(1);
    expect(await world().auditCount()).toBe(before + 1);
    // The one that landed went to the Staff page; the other changed nothing: the last-admin words on the sample store,
    // where both passed the role check first, or the 404 on Supabase, where the second found its own role gone.
    const [landed, other, otherName, otherForm] = admins[0]
      ? [byStaff, byAsker, "asker" as const, removeRoleForm(staffId, "admin")]
      : [byAsker, byStaff, "staff" as const, removeRoleForm(askerId, "admin")];
    expect(landed.redirect).toBe(ADMIN_STAFF_PATH);
    if (other.notFound) {
      expect(other.redirect).toBeNull();
    } else {
      expect((await scenario().noticeAs(otherName, otherForm))?.errors).toEqual(["staff-last-admin"]);
    }
  });
}
