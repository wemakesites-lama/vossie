import { beforeEach, describe, expect, it } from "vitest";
import {
  countReportsSince,
  createReport,
  deleteReportsBy,
  exportReports,
  hasOpenReport,
  listReportsBy,
} from "./reports";
import type { ReportTarget } from "@/lib/types";
import { createRequest } from "./requests";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const LISTING = { kind: "listing", id: "l-001" } as const;
const SELLER = { kind: "seller", id: "tech-corner" } as const;

beforeEach(() => {
  resetSampleStore();
});

async function report(reporterId: string, target: typeof LISTING | typeof SELLER, at = NOW) {
  return createReport({
    reporterId,
    target,
    targetTitle: target.kind === "listing" ? "Casio fx-991ZA Plus calculator" : "Tech corner",
    reason: "scam",
    detail: "Asked for a deposit.",
    now: at,
  });
}

describe("reports (messaging spec 2.8 and 3.4)", () => {
  it("stores an open report with the reporter, the target and its title, the reason, the detail and the time", async () => {
    const id = await report("acc-student", LISTING);
    expect(id).toMatch(/^rep-[0-9a-f-]{36}$/);
    expect(sampleStore().reports.get(id)).toEqual({
      id,
      reporterId: "acc-student",
      targetKind: "listing",
      targetId: "l-001",
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "scam",
      detail: "Asked for a deposit.",
      status: "open",
      createdAt: NOW.toISOString(),
      targetOwnerId: "acc-seller",
    });
  });

  it("records who owned the target: the shop's owner, or the asker of a request, or nobody for a sample", async () => {
    const store = sampleStore();
    const about = (target: ReportTarget) =>
      createReport({ reporterId: "acc-student", target, targetTitle: "T", reason: "scam", detail: "", now: NOW });
    expect(store.reports.get(await about(SELLER))?.targetOwnerId).toBe("acc-seller");
    const own = await createRequest({
      askerId: "acc-seller",
      fields: {
        title: "Desk lamp",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "Clip-on.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: null,
      },
      now: NOW,
    });
    expect(store.reports.get(await about({ kind: "request", id: own.id }))?.targetOwnerId).toBe("acc-seller");
    expect(store.reports.get(await about({ kind: "request", id: "r-001" }))?.targetOwnerId).toBeNull();
  });

  it("knows when the account has an open report on the same target (plan decision 17)", async () => {
    const id = await report("acc-student", LISTING);
    expect(await hasOpenReport("acc-student", LISTING)).toBe(true);
    expect(await hasOpenReport("acc-student", SELLER)).toBe(false);
    expect(await hasOpenReport("acc-mentor", LISTING)).toBe(false);
    sampleStore().reports.get(id)!.status = "closed";
    expect(await hasOpenReport("acc-student", LISTING)).toBe(false);
  });

  it("doesn't count an open report about something that has gone, so a new shop on the same link can be reported (amendment 14.2)", async () => {
    const id = await report("acc-student", SELLER);
    sampleStore().reports.get(id)!.targetGone = true;
    expect(await hasOpenReport("acc-student", SELLER)).toBe(false);
    await report("acc-student", SELLER);
    expect(await hasOpenReport("acc-student", SELLER)).toBe(true);
  });

  it("counts an account's reports since a time, for the daily limit", async () => {
    await report("acc-student", LISTING, new Date("2026-10-13T08:00:00.000Z"));
    await report("acc-student", SELLER, new Date("2026-10-14T08:00:00.000Z"));
    await report("acc-mentor", SELLER);
    expect(await countReportsSince("acc-student", new Date("2026-10-13T08:42:00.000Z"))).toBe(1);
  });

  it("lists an account's own reports, newest first, for privacy settings (plan decision 18)", async () => {
    await report("acc-student", LISTING, new Date("2026-10-13T08:00:00.000Z"));
    await report("acc-student", SELLER);
    await report("acc-mentor", LISTING);
    expect(await listReportsBy("acc-student")).toEqual([
      { kind: "seller", title: "Tech corner", reason: "scam", createdAt: NOW.toISOString(), open: true },
      {
        kind: "listing",
        title: "Casio fx-991ZA Plus calculator",
        reason: "scam",
        createdAt: "2026-10-13T08:00:00.000Z",
        open: true,
      },
    ]);
  });

  it("deletes one account's reports and no one else's (plan decision 14)", async () => {
    await report("acc-student", LISTING);
    await report("acc-mentor", LISTING);
    await deleteReportsBy("acc-student");
    expect([...sampleStore().reports.values()].map((row) => row.reporterId)).toEqual(["acc-mentor"]);
  });

  it("exports an account's reports in words, with no ids (plan decision 15)", async () => {
    await report("acc-student", LISTING);
    const data = await exportReports("acc-student");
    expect(data).toEqual([
      {
        about: "Casio fx-991ZA Plus calculator",
        kind: "listing",
        reason: "Scam or fraud",
        detail: "Asked for a deposit.",
        at: NOW.toISOString(),
        status: "open",
      },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/rep-|acc-/);
  });
});
