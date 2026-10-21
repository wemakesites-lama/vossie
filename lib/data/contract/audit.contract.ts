import { expect, it } from "vitest";
import { auditStaff, listAudit } from "@/lib/data/audit";
import { addPoint, verifySeller } from "@/lib/staff/admin-actions";
import type { ActionScenario } from "@/tests/contract/actions";

// The audit log in both backends (C4/C5 plan Task 13): its entries are written by the real staff actions, through the
// action harness (on the sample store recordAudit, on Supabase the staff functions themselves), so the log reads the
// same wording either way. The local stack keeps every entry ever written (the log has no delete), so the checks read
// the newest. audit.test.ts runs it on the sample store, audit.db.test.ts on the local stack.

/** What an entry says, without its id and time, which differ between backends. */
const said = (entry: { staffName: string; action: string; targetKind: string; targetName: string; detail: string }) => ({
  staffName: entry.staffName,
  action: entry.action,
  targetKind: entry.targetKind,
  targetName: entry.targetName,
  detail: entry.detail,
});

/** A short wait, so two entries never share a time (the sample keeps milliseconds, the database microseconds). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

export function auditContract(scenario: () => ActionScenario): void {
  /** Staff verifies the shopper's shop, takes Verified away again, and adds a pickup point: three entries. */
  const threeEntries = async () => {
    const { world } = scenario();
    await world.tidyPickupPoints();
    await world.tidyMessaging();
    const slug = await world.openShop("shopper", { name: "Contract Audit Shop" });
    const staffId = (await scenario().signIn("staff"))!;
    expect((await scenario().post(verifySeller, { shop: slug, verified: "yes" })).redirect).toBe(`/admin/sellers/${slug}`);
    await tick();
    expect((await scenario().post(verifySeller, { shop: slug, verified: "no" })).redirect).toBe(`/admin/sellers/${slug}`);
    await tick();
    const added = await scenario().post(addPoint, { campus: "pretoria", name: "Contract audit gate" });
    expect(added.redirect).toBe("/admin/pickup-points#points-pretoria");
    return { slug, staffId };
  };

  it("lists the entries the actions wrote, newest first, in the sample's words", async () => {
    const { staffId } = await threeEntries();
    const entries = await scenario().world.asViewer("staff", () => listAudit({ staff: null, kind: null }, 3));
    expect(entries.map(said)).toEqual([
      {
        staffName: "Staff",
        action: "point-added",
        targetKind: "pickup-point",
        targetName: "Contract audit gate",
        detail: "Pretoria",
      },
      { staffName: "Staff", action: "shop-unverified", targetKind: "shop", targetName: "Contract Audit Shop", detail: "" },
      { staffName: "Staff", action: "shop-verified", targetKind: "shop", targetName: "Contract Audit Shop", detail: "" },
    ]);
    expect(entries.every((entry) => entry.staffId === staffId)).toBe(true);
    expect(Date.parse(entries[0].at)).toBeGreaterThan(Date.parse(entries[2].at));
  });

  it("filters by kind and by staff member, and keeps to the limit", async () => {
    const { staffId } = await threeEntries();
    const shopperId = await scenario().world.signedIn("shopper");
    const read = (filter: Parameters<typeof listAudit>[0], limit?: number) =>
      scenario().world.asViewer("staff", () => listAudit(filter, limit));
    expect((await read({ staff: null, kind: "shops" }, 2)).map((entry) => entry.action)).toEqual([
      "shop-unverified",
      "shop-verified",
    ]);
    expect((await read({ staff: staffId, kind: "pickup-points" }, 1)).map(said)).toEqual([
      expect.objectContaining({ action: "point-added", targetName: "Contract audit gate" }),
    ]);
    expect(await read({ staff: shopperId, kind: null })).toEqual([]);
    expect(await read({ staff: null, kind: null }, 2)).toHaveLength(2);
  });

  it("names the staff members in the log for its filter, by their first name", async () => {
    const { staffId } = await threeEntries();
    const people = await scenario().world.asViewer("staff", () => auditStaff());
    expect(people).toContainEqual({ id: staffId, name: "Staff" });
    const shopperId = await scenario().world.signedIn("shopper");
    expect(people.some((person) => person.id === shopperId)).toBe(false);
    // On the sample store the log holds only this test's entries; the local stack keeps every run's.
    if (scenario().world.name === "sample") expect(people).toEqual([{ id: staffId, name: "Staff" }]);
  });
}
