import { beforeEach, describe, expect, it } from "vitest";
import { FORMER_STAFF } from "@/lib/staff/audit-words";
import { auditStaff, listAudit, recordAudit } from "./audit";
import { resetSampleStore, sampleStore } from "./store";

const admin = { id: "acc-admin", firstName: "Pieter" };
const mentor = { id: "acc-mentor", firstName: "Naledi" };
const at = (minute: number) => new Date(`2026-10-14T08:${String(minute).padStart(2, "0")}:00.000Z`);

beforeEach(() => {
  resetSampleStore();
});

describe("the audit log (staff tools spec 2.2, plan decision 6)", () => {
  it("records who did what to what, why and when", async () => {
    await recordAudit({
      staff: admin,
      action: "shop-declined",
      target: { kind: "shop", id: "crochet-corner", name: "Crochet corner" },
      detail: "The photo shows someone else's work.",
      subjectId: "acc-pending",
      now: at(1),
    });
    const [entry] = await listAudit({ staff: null, kind: null });
    expect(entry).toEqual({
      id: expect.stringMatching(/^aud-[0-9a-f-]{36}$/),
      at: "2026-10-14T08:01:00.000Z",
      staffId: "acc-admin",
      staffName: "Pieter",
      action: "shop-declined",
      targetKind: "shop",
      targetName: "Crochet corner",
      detail: "The photo shows someone else's work.",
    });
    expect([...sampleStore().auditLog.values()][0]).toMatchObject({ targetId: "crochet-corner", subjectId: "acc-pending" });
  });

  it("names no one when the entry is about no one (amendment 21)", async () => {
    await recordAudit({ staff: admin, action: "point-added", target: { kind: "pickup-point", id: "pp-1", name: "Gate" }, now: at(1) });
    expect([...sampleStore().auditLog.values()][0]).toMatchObject({ detail: "", subjectId: null });
  });

  it("lists the newest first, and filters by staff member and by kind (spec 2.3)", async () => {
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff: admin, action: "shop-verified", target: shop, now: at(1) });
    await recordAudit({ staff: mentor, action: "note-added", target: shop, now: at(2) });
    await recordAudit({ staff: admin, action: "report-dismissed", target: { kind: "report", id: "rep-1", name: "Desk lamp" }, now: at(3) });
    expect((await listAudit({ staff: null, kind: null })).map((entry) => entry.action)).toEqual([
      "report-dismissed",
      "note-added",
      "shop-verified",
    ]);
    expect((await listAudit({ staff: "acc-admin", kind: null })).map((entry) => entry.action)).toEqual([
      "report-dismissed",
      "shop-verified",
    ]);
    expect((await listAudit({ staff: null, kind: "mentoring" })).map((entry) => entry.action)).toEqual(["note-added"]);
    expect(await listAudit({ staff: "acc-mentor", kind: "shops" })).toEqual([]);
    expect(await auditStaff()).toEqual([
      { id: "acc-mentor", name: "Naledi" },
      { id: "acc-admin", name: "Pieter" },
    ]);
  });

  it("keeps entries made in the same moment newest first, and stops at the limit", async () => {
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff: admin, action: "shop-paused", target: shop, now: at(5) });
    await recordAudit({ staff: admin, action: "shop-resumed", target: shop, now: at(5) });
    await recordAudit({ staff: admin, action: "shop-verified", target: shop, now: at(4) });
    expect((await listAudit({ staff: null, kind: null })).map((entry) => entry.action)).toEqual([
      "shop-resumed",
      "shop-paused",
      "shop-verified",
    ]);
    expect(await listAudit({ staff: null, kind: null }, 1)).toHaveLength(1);
  });

  it("lists a staff member whose account has gone as a former staff member (amendments 17 and 31)", async () => {
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff: mentor, action: "note-added", target: shop, now: at(1) });
    await recordAudit({ staff: admin, action: "shop-verified", target: shop, now: at(2) });
    sampleStore().accounts.delete("acc-mentor");
    expect(await auditStaff()).toEqual([
      { id: "acc-admin", name: "Pieter" },
      { id: "acc-mentor", name: FORMER_STAFF },
    ]);
    // The entries themselves are the record: they keep the id, and a filter by it still works.
    expect((await listAudit({ staff: "acc-mentor", kind: null })).map((entry) => entry.action)).toEqual(["note-added"]);
  });

  it("can't be edited: recording is the only way in, and nothing changes or removes an entry", async () => {
    expect(Object.keys(await import("./audit")).sort()).toEqual(["auditStaff", "listAudit", "recordAudit"]);
  });

  it("hands out copies", async () => {
    await recordAudit({ staff: admin, action: "shop-verified", target: { kind: "shop", id: "tech-corner", name: "Tech corner" }, now: at(1) });
    const [entry] = await listAudit({ staff: null, kind: null });
    entry.detail = "Changed.";
    expect([...sampleStore().auditLog.values()][0].detail).toBe("");
  });
});
