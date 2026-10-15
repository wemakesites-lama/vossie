import { beforeEach, describe, expect, it } from "vitest";
import { createReport } from "./reports";
import {
  actOnReport,
  closeReport,
  getReport,
  listReports,
  openReportCount,
  pauseShopClosingReports,
} from "./staff-reports";
import { staffResumeShop } from "./staff-shops";
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

const reportRow = (id: string) => sampleStore().reports.get(id);

beforeEach(() => {
  resetSampleStore();
});

describe("the Hub's reports queue (staff tools spec 2.3, plan decision 5)", () => {
  it("lists open reports first, oldest first, then closed ones, newest closed first", async () => {
    const first = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    const second = await report("acc-mentor", { kind: "seller", id: "tech-corner" }, 9);
    const third = await report("acc-student", { kind: "request", id: "r-001" }, 10);
    const fourth = await report("acc-mentor", { kind: "listing", id: "l-002" }, 7);
    await closeReport(first, "Checked with the seller.", "acc-admin", NOW);
    await closeReport(fourth, "Fine.", "acc-admin", at(13));
    expect((await listReports()).map((view) => [view.id, view.open])).toEqual([
      [second, true],
      [third, true],
      [fourth, false],
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

  it("names a staff member whose account has gone as a former staff member (amendment 17)", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    await closeReport(id, "Fine.", "acc-admin", NOW);
    sampleStore().accounts.delete("acc-admin");
    expect((await getReport(id))?.closedByName).toBe("Former staff member");
  });

  it("says what the Hub can do: hide a listing that's there, pause an owned open shop, dismiss the rest", async () => {
    const own = (await getReport(await report("acc-student", { kind: "listing", id: "l-001" }, 8)))!;
    expect(own).toMatchObject({
      exists: true,
      can: { hide: true, pause: true },
      shop: { slug: "tech-corner", name: "Tech corner" },
    });
    const sample = (await getReport(await report("acc-student", { kind: "listing", id: "l-004" }, 8)))!;
    expect(sample.can).toEqual({ hide: true, pause: false });
    const shop = (await getReport(await report("acc-student", { kind: "seller", id: "tech-corner" }, 8)))!;
    expect(shop.can).toEqual({ hide: false, pause: true });
    // Requests are dismiss-only until stage H (amendment 29).
    const request = (await getReport(await report("acc-student", { kind: "request", id: "r-001" }, 8)))!;
    expect(request).toMatchObject({ exists: true, shop: null, can: { hide: false, pause: false } });
    sampleStore().listings.delete("l-007");
    const gone = (await getReport(await report("acc-student", { kind: "listing", id: "l-007" }, 8)))!;
    expect(gone).toMatchObject({ exists: false, shop: null, can: { hide: false, pause: false } });
    const pending = (await getReport(await report("acc-student", { kind: "seller", id: "crochet-corner" }, 8)))!;
    expect(pending.can).toEqual({ hide: false, pause: false });
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "seller";
    expect((await getReport(own.id))!.can).toEqual({ hide: true, pause: true });
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    expect((await getReport(own.id))!.can).toEqual({ hide: true, pause: false });
    sampleStore().listings.get("l-001")!.hiddenAt = NOW.toISOString();
    expect((await getReport(own.id))!.can).toEqual({ hide: false, pause: false });
  });

  it("dismisses one report with its note, once, naming the reported shop's owner and never the reporter", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    expect(await closeReport(id, "Nothing wrong.", "acc-admin", NOW)).toEqual({
      id,
      reporterId: "acc-student",
      title: "Title of l-004",
      ownerId: null,
    });
    expect(reportRow(id)).toMatchObject({
      status: "closed",
      outcome: "dismissed",
      note: "Nothing wrong.",
      closedAt: NOW.toISOString(),
      closedBy: "acc-admin",
    });
    expect(await closeReport(id, "Again.", "acc-admin", NOW)).toBeNull();
    expect(await closeReport("rep-nope", "No.", "acc-admin", NOW)).toBeNull();
    // Amendment 21: the audit entry names the owner of the reported listing's or shop's shop; a request names nobody.
    const listing = await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    expect((await closeReport(listing, "Fine.", "acc-admin", NOW))?.ownerId).toBe("acc-seller");
    const shop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 8);
    expect((await closeReport(shop, "Fine.", "acc-admin", NOW))?.ownerId).toBe("acc-seller");
    const request = await report("acc-seller", { kind: "request", id: "r-001" }, 8);
    expect((await closeReport(request, "Fine.", "acc-admin", NOW))?.ownerId).toBeNull();
  });
});

describe("acting on a report (spec 2.3; plan decision 5; amendments 19 to 21)", () => {
  it("hides the reported listing and closes every open report on it, giving back each reporter", async () => {
    const first = await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    await report("acc-mentor", { kind: "listing", id: "l-001" }, 9);
    const other = await report("acc-student", { kind: "listing", id: "l-007" }, 9);
    const shop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 9);
    const acted = actOnReport(first, "hide", "Not allowed.", "acc-admin", NOW)!;
    expect(acted).toMatchObject({
      act: "hide",
      decision: {
        id: "l-001",
        title: "Casio fx-991ZA Plus calculator",
        sellerSlug: "tech-corner",
        ownerId: "acc-seller",
      },
    });
    expect(acted.closed.map((item) => item.reporterId).sort()).toEqual(["acc-mentor", "acc-student"]);
    expect(acted.closed.every((item) => item.ownerId === "acc-seller")).toBe(true);
    expect(sampleStore().listings.get("l-001")).toMatchObject({
      hiddenAt: NOW.toISOString(),
      hiddenReason: "Not allowed.",
    });
    expect([...sampleStore().reports.values()].filter((row) => row.outcome === "hidden")).toHaveLength(2);
    expect(reportRow(first)).toMatchObject({ status: "closed", note: "Not allowed.", closedBy: "acc-admin" });
    expect(reportRow(other)?.status).toBe("open");
    expect(reportRow(shop)?.status).toBe("open");
    expect(actOnReport(first, "hide", "Again.", "acc-admin", NOW)).toBeNull();
  });

  it("pauses the reported shop and closes every open report on it and its listings (amendment 20)", async () => {
    const shop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 8);
    const listing = await report("acc-mentor", { kind: "listing", id: "l-001" }, 9);
    const another = await report("acc-student", { kind: "listing", id: "l-007" }, 9);
    const elsewhere = await report("acc-student", { kind: "listing", id: "l-004" }, 9);
    const acted = actOnReport(shop, "pause", "Asked for deposits.", "acc-admin", NOW)!;
    expect(acted).toMatchObject({
      act: "pause",
      decision: { slug: "tech-corner", name: "Tech corner", ownerId: "acc-seller" },
    });
    expect(acted.closed.map((item) => item.id).sort()).toEqual([shop, listing, another].sort());
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({
      status: "paused",
      pausedBy: "staff",
      staffReason: "Asked for deposits.",
    });
    for (const id of [shop, listing, another]) {
      expect(reportRow(id)).toMatchObject({ status: "closed", outcome: "paused", note: "Asked for deposits." });
    }
    expect(reportRow(elsewhere)?.status).toBe("open");
    expect(actOnReport(shop, "pause", "Again.", "acc-admin", NOW)).toBeNull();
  });

  it("pauses the shop behind a reported listing", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-007" }, 8);
    expect(actOnReport(id, "pause", "Fake headsets.", "acc-admin", NOW)).toMatchObject({
      act: "pause",
      decision: { slug: "tech-corner" },
      closed: [{ id, reporterId: "acc-student", title: "Title of l-007", ownerId: "acc-seller" }],
    });
    expect(sampleStore().listings.get("l-007")?.hiddenAt ?? null).toBeNull();
  });

  it("acts only as the report allows: not on a request, a sample shop, a gone target or a closed report", async () => {
    const request = await report("acc-student", { kind: "request", id: "r-001" }, 8);
    expect(actOnReport(request, "hide", "No.", "acc-admin", NOW)).toBeNull();
    expect(actOnReport(request, "pause", "No.", "acc-admin", NOW)).toBeNull();
    const sample = await report("acc-student", { kind: "listing", id: "l-004" }, 8);
    expect(actOnReport(sample, "pause", "No.", "acc-admin", NOW)).toBeNull();
    const shop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 8);
    expect(actOnReport(shop, "hide", "No.", "acc-admin", NOW)).toBeNull();
    const gone = await report("acc-student", { kind: "listing", id: "l-007" }, 8);
    sampleStore().listings.delete("l-007");
    expect(actOnReport(gone, "hide", "No.", "acc-admin", NOW)).toBeNull();
    expect(actOnReport(gone, "pause", "No.", "acc-admin", NOW)).toBeNull();
    await closeReport(sample, "Fine.", "acc-admin", NOW);
    expect(actOnReport(sample, "hide", "No.", "acc-admin", NOW)).toBeNull();
    expect(actOnReport("rep-nope", "hide", "No.", "acc-admin", NOW)).toBeNull();
    for (const id of [request, shop, gone]) expect(reportRow(id)?.status).toBe("open");
    expect(sampleStore().sellerProfiles.get("acc-seller")?.status).toBe("approved");
    expect(sampleStore().listings.get("l-004")?.hiddenAt ?? null).toBeNull();
  });

  it("pauses from the Sellers page too, closing the shop's open reports, and only once (amendment 20)", async () => {
    const listing = await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    const done = await report("acc-mentor", { kind: "listing", id: "l-001" }, 8);
    await closeReport(done, "Fine.", "acc-admin", NOW);
    const paused = pauseShopClosingReports("tech-corner", "Selling exam answers.", "acc-admin", NOW)!;
    expect(paused.decision).toEqual({ slug: "tech-corner", name: "Tech corner", ownerId: "acc-seller" });
    expect(paused.closed.map((item) => item.id)).toEqual([listing]);
    expect(reportRow(done)?.outcome).toBe("dismissed");
    expect(pauseShopClosingReports("tech-corner", "Again.", "acc-admin", NOW)).toBeNull();
    expect(pauseShopClosingReports("hair-studio", "No.", "acc-admin", NOW)).toBeNull();
    expect(pauseShopClosingReports("crochet-corner", "No.", "acc-admin", NOW)).toBeNull();
  });

  it("decides once when presses arrive together: dismiss and act, act twice, hide and pause", async () => {
    const one = await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    const [dismissed, acted] = await Promise.all([
      closeReport(one, "Fine.", "acc-admin", NOW),
      (async () => actOnReport(one, "hide", "Not allowed.", "acc-admin", NOW))(),
    ]);
    expect([dismissed, acted].filter(Boolean)).toHaveLength(1);
    expect(sampleStore().listings.get("l-001")?.hiddenAt ?? null).toBeNull();

    const two = await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    const [actFirst, dismissSecond] = await Promise.all([
      (async () => actOnReport(two, "hide", "Not allowed.", "acc-admin", NOW))(),
      closeReport(two, "Fine.", "acc-admin", NOW),
    ]);
    expect(actFirst).not.toBeNull();
    expect(dismissSecond).toBeNull();
    expect(reportRow(two)?.outcome).toBe("hidden");

    const three = await report("acc-student", { kind: "listing", id: "l-007" }, 8);
    const both = await Promise.all([
      (async () => actOnReport(three, "pause", "One.", "acc-admin", NOW))(),
      (async () => actOnReport(three, "hide", "Two.", "acc-admin", NOW))(),
    ]);
    // The pause closed the report, so the hide finds nothing left to do.
    expect(both.map((item) => item?.act ?? null)).toEqual(["pause", null]);
    expect(sampleStore().listings.get("l-007")?.hiddenAt ?? null).toBeNull();

    await staffResumeShop("tech-corner");
    const four = await report("acc-student", { kind: "seller", id: "tech-corner" }, 8);
    const pauses = await Promise.all([
      (async () => actOnReport(four, "pause", "Two.", "acc-admin", NOW))(),
      (async () => actOnReport(four, "pause", "Three.", "acc-admin", NOW))(),
      (async () => pauseShopClosingReports("tech-corner", "Four.", "acc-admin", NOW))(),
    ]);
    expect(pauses.filter(Boolean)).toHaveLength(1);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.staffReason).toBe("Two.");
  });
});
