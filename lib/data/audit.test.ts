import { beforeEach, describe, expect, it } from "vitest";
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
    expect((await listAudit({ staff: "acc-mentor", kind: "shops" }))).toEqual([]);
    expect(await auditStaff()).toEqual([
      { id: "acc-mentor", name: "Naledi" },
      { id: "acc-admin", name: "Pieter" },
    ]);
  });

  it("can't be edited: recording is the only way in, and nothing changes or removes an entry", async () => {
    expect(Object.keys(await import("./audit")).sort()).toEqual(["auditStaff", "listAudit", "recordAudit"]);
  });
});
