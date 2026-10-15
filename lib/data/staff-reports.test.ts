import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccountData } from "./accounts";
import { createReport } from "./reports";
import { createShop } from "./shops";
import { approveShop } from "./staff-shops";
import { closeReport, closeReportsOn, getReport, listReports, openReportCount } from "./staff-reports";
import { resetSampleStore, sampleStore } from "./store";

const at = (hour: number) => new Date(`2026-10-14T${String(hour).padStart(2, "0")}:00:00.000Z`);
const NOW = at(12);

function report(reporterId: string, target: { kind: "listing" | "seller" | "request"; id: string }, hour: number) {
  return createReport({
    reporterId,
    target,
    targetTitle: `Title of ${target.id}`,
    reason: "scam",
    detail: "Asked for a deposit.",
    now: at(hour),
  });
}

beforeEach(() => {
  resetSampleStore();
});

describe("the Hub's reports queue (staff tools spec 2.3, plan decision 5)", () => {
  it("lists open reports first, oldest first, then closed ones, newest closed first", async () => {
    const first = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    const second = await report("acc-mentor", { kind: "seller", id: "tech-corner" }, 9);
    const third = await report("acc-student", { kind: "request", id: "r-001" }, 10);
    await closeReport(first, "Checked with the seller.", "acc-admin", NOW);
    expect((await listReports()).map((view) => [view.id, view.open])).toEqual([
      [second, true],
      [third, true],
      [first, false],
    ]);
    expect(await openReportCount()).toBe(2);
  });

  it("names the reporter by first name only, and says who closed it", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    await closeReport(id, "Checked with the seller.", "acc-admin", NOW);
    const view = (await getReport(id))!;
    expect(view).toMatchObject({
      reporterName: "Thandi",
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-004" },
      targetTitle: "Title of l-004",
      reason: "scam",
      detail: "Asked for a deposit.",
      open: false,
      outcome: "dismissed",
      note: "Checked with the seller.",
      closedAt: NOW.toISOString(),
      closedByName: "Pieter",
    });
    expect(JSON.stringify(view)).not.toContain("@eduvos.com");
    expect(await getReport("rep-nope")).toBeNull();
  });

  it("says what the Hub can do: hide a listing that's there, pause an owned open shop, only dismiss the rest", async () => {
    const own = (await getReport(await report("acc-student", { kind: "listing", id: "l-001" }, 8)))!;
    expect(own).toMatchObject({ exists: true, can: { hide: true, pause: true }, shop: { slug: "tech-corner", name: "Tech corner" } });
    const sample = (await getReport(await report("acc-student", { kind: "listing", id: "l-004" }, 8)))!;
    expect(sample.can).toEqual({ hide: true, pause: false });
    const shop = (await getReport(await report("acc-student", { kind: "seller", id: "tech-corner" }, 8)))!;
    expect(shop.can).toEqual({ hide: false, pause: true });
    const request = (await getReport(await report("acc-student", { kind: "request", id: "r-001" }, 8)))!;
    expect(request.can).toEqual({ hide: false, pause: false });
    sampleStore().listings.delete("l-007");
    const gone = (await getReport(await report("acc-student", { kind: "listing", id: "l-007" }, 8)))!;
    expect(gone).toMatchObject({ exists: false, can: { hide: false, pause: false } });
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    expect((await getReport(own.id))!.can).toEqual({ hide: true, pause: false });
  });

  it("never lets a report about a deleted shop reach a new shop on the same link (amendment 13.1)", async () => {
    const aboutShop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 8);
    const aboutListing = await report("acc-student", { kind: "listing", id: "l-001" }, 9);
    await deleteAccountData("acc-seller");
    expect(sampleStore().reports.get(aboutShop)?.targetGone).toBe(true);
    expect(sampleStore().reports.get(aboutListing)?.targetGone).toBe(true);
    await createShop(
      "acc-mentor",
      {
        name: "Tech corner",
        tagline: "A new shop on the old link.",
        categorySlug: "tech",
        about: "",
        image: null,
        campusSlug: "midrand",
        pickupPointIds: [],
      },
      NOW,
    );
    expect(sampleStore().sellers.get("tech-corner")?.ownerId).toBe("acc-mentor");
    await approveShop("tech-corner");
    for (const id of [aboutShop, aboutListing]) {
      expect((await getReport(id))!, id).toMatchObject({ exists: false, shop: null, can: { hide: false, pause: false } });
    }
  });

  it("dismisses one report with its note, once", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    expect(await closeReport(id, "Nothing wrong.", "acc-admin", NOW)).toEqual({
      id,
      reporterId: "acc-student",
      title: "Title of l-004",
    });
    expect(sampleStore().reports.get(id)).toMatchObject({
      status: "closed",
      outcome: "dismissed",
      note: "Nothing wrong.",
      closedAt: NOW.toISOString(),
      closedBy: "acc-admin",
    });
    expect(await closeReport(id, "Again.", "acc-admin", NOW)).toBeNull();
  });

  it("closes every open report on the same target when it's hidden or paused, and gives back each reporter", async () => {
    await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    await report("acc-mentor", { kind: "listing", id: "l-001" }, 9);
    const other = await report("acc-student", { kind: "listing", id: "l-007" }, 9);
    const closed = await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Not allowed.", "acc-admin", NOW);
    expect(closed.map((item) => item.reporterId).sort()).toEqual(["acc-mentor", "acc-student"]);
    expect([...sampleStore().reports.values()].filter((row) => row.outcome === "hidden")).toHaveLength(2);
    expect(sampleStore().reports.get(other)?.status).toBe("open");
    expect(await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Again.", "acc-admin", NOW)).toEqual([]);
  });
});
