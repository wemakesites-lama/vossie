import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { isRefused } from "@/lib/data/refused";
import {
  countAdmins,
  findStaffCandidate,
  getStaffAccount,
  giveRole,
  listStaffAccounts,
  removeMentorView,
  removeRole,
} from "@/lib/data/staff-accounts";
import type { World, WorldAccountName } from "@/tests/contract/world";

// Staff accounts' data in both backends (C4/C5 plan Task 20; decisions 6 and 19): everyone with a role and no one
// else, roles found by exact email only, giving and taking a role, and the refusals removeRole answers itself (your own
// admin role, your own shop's mentor). On Supabase every read and write is the admin's own session, and give_role takes
// the form's one-time token, so each give carries one (the sample ignores it). staff-accounts.test.ts runs it on the
// sample store, staff-accounts.db.test.ts on the local stack. The actions' gates are lib/staff/contract/roles.contract.ts.

export function staffAccountsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyStaffTools();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const asStaff = <T>(read: (staffId: string) => Promise<T>) => world.asViewer("staff", read);
  const token = async (name: WorldAccountName) => {
    const value = randomUUID();
    await world.onceRow(name, `staff-once:${value}`);
    return value;
  };

  it("finds an account by its exact email only, trimmed and in any case, never by part of it", async () => {
    const askerId = await world.signedIn("asker");
    expect(await asStaff(() => findStaffCandidate(" Contract-Asker@VOSSIE.test "))).toEqual({ id: askerId, firstName: "Asker", roles: [] });
    expect(await asStaff(() => findStaffCandidate("contract-ask"))).toBeNull();
    expect(await asStaff(() => findStaffCandidate("contract-asker@vossie"))).toBeNull();
    expect(await asStaff(() => findStaffCandidate("@vossie.test"))).toBeNull();
    expect(await asStaff(() => findStaffCandidate("  "))).toBeNull();
  });

  it("lists everyone with a role and no one else, with the shops each mentors", async () => {
    const [askerId, staffId, shopperId] = await Promise.all([world.signedIn("asker"), world.signedIn("staff"), world.signedIn("shopper")]);
    await world.setRoles("asker", ["admin", "mentor"]);
    const slug = await world.openShop("shopper", { name: "Contract mentored bakes" });
    await world.setMentor(slug, "asker");
    const asker = {
      id: askerId,
      firstName: "Asker",
      email: "contract-asker@vossie.test",
      campusSlug: "pretoria",
      roles: ["mentor", "admin"],
      mentors: ["Contract mentored bakes"],
    };
    const list = await asStaff(() => listStaffAccounts());
    expect(list.find((person) => person.id === askerId)).toEqual(asker);
    expect(list.find((person) => person.id === staffId)).toMatchObject({ roles: ["admin"], mentors: [] });
    expect(list.some((person) => person.id === shopperId)).toBe(false);
    expect(await asStaff(() => getStaffAccount(askerId))).toEqual(asker);
    expect(await asStaff(() => getStaffAccount(shopperId))).toBeNull();
    expect(await asStaff(() => getStaffAccount("not-an-account"))).toBeNull();
  });

  it("counts the admins, and says whether someone mentors the admin's own shop", async () => {
    const askerId = await world.signedIn("asker");
    const before = await asStaff(() => countAdmins());
    await world.setRoles("asker", ["mentor", "admin"]);
    expect(await asStaff(() => countAdmins())).toBe(before + 1);
    expect(await asStaff((staffId) => removeMentorView(staffId, askerId))).toEqual({ mentorsOwnShop: false, onlyAdmin: false });
    await world.setMentor(await world.openShop("staff"), "asker");
    expect(await asStaff((staffId) => removeMentorView(staffId, askerId))).toEqual({ mentorsOwnShop: true, onlyAdmin: false });
  });

  it("gives a role by exact email once, and takes it away with the shops it mentored", async () => {
    const askerId = await world.signedIn("asker");
    expect(await asStaff(async () => giveRole("Contract-Asker@vossie.test", "mentor", await token("staff")))).toEqual({
      id: askerId,
      firstName: "Asker",
    });
    expect((await world.viewerAccount("asker")).roles).toEqual(["mentor"]);
    expect(await asStaff(async () => giveRole("contract-asker@vossie.test", "mentor", await token("staff")))).toBe("held");
    expect(await asStaff(async () => giveRole("contract-ask@vossie.test", "admin", await token("staff")))).toBe("no-account");
    const slug = await world.openShop("shopper", { name: "Contract mentored bakes" });
    await world.setMentor(slug, "asker");
    expect(await asStaff((staffId) => removeRole(askerId, "mentor", staffId))).toEqual({
      id: askerId,
      firstName: "Asker",
      role: "mentor",
      unassigned: ["Contract mentored bakes"],
    });
    expect((await world.viewerAccount("asker")).roles).toEqual([]);
    expect(await asStaff((staffId) => removeRole(askerId, "mentor", staffId))).toBeNull();
  });

  it("never removes your own admin role, or the mentor role of whoever mentors your own shop", async () => {
    const [askerId, staffId] = await Promise.all([world.signedIn("asker"), world.signedIn("staff")]);
    await world.setRoles("asker", ["mentor"]);
    await world.setMentor(await world.openShop("staff"), "asker");
    const before = await world.auditCount();
    expect(await asStaff(() => removeRole(staffId, "admin", staffId))).toBe("own-admin");
    expect(await asStaff(() => removeRole(askerId, "mentor", staffId))).toBe("own-shop-mentor");
    expect((await world.viewerAccount("staff")).roles).toEqual(["admin"]);
    expect((await world.viewerAccount("asker")).roles).toEqual(["mentor"]);
    expect(await world.auditCount()).toBe(before);
  });

  it("on Supabase takes the give's token in the same step, and refuses someone without the admin role", async () => {
    if (world.name !== "supabase") return;
    const refusal = async (work: () => Promise<unknown>) => work().then(() => null, (error: unknown) => error);
    expect(isRefused(await refusal(() => asStaff(() => giveRole("contract-asker@vossie.test", "mentor", randomUUID()))), "once-expired")).toBe(true);
    const once = await token("staff");
    await asStaff(() => giveRole("contract-asker@vossie.test", "mentor", once));
    expect(isRefused(await refusal(() => asStaff(() => giveRole("contract-shopper@vossie.test", "mentor", once))), "once-taken")).toBe(true);
    await world.setRoles("asker", ["mentor"]);
    const shopperId = await world.signedIn("shopper");
    const before = await world.auditCount();
    const asMentor = <T>(work: (id: string) => Promise<T>) => world.asViewer("asker", work);
    expect(isRefused(await refusal(async () => asMentor(async () => giveRole("contract-shopper@vossie.test", "mentor", await token("asker")))), "forbidden")).toBe(true);
    expect(isRefused(await refusal(() => asMentor((id) => removeRole(shopperId, "mentor", id))), "forbidden")).toBe(true);
    expect(await asMentor(() => findStaffCandidate("contract-shopper@vossie.test"))).toBeNull();
    expect((await world.viewerAccount("shopper")).roles).toEqual([]);
    expect(await world.auditCount()).toBe(before);
  });
}
