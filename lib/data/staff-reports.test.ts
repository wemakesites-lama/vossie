import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccountData } from "./accounts";
import { createReport, hasOpenReport } from "./reports";
import { createRequest, hideRequest } from "./requests";
import { createShop } from "./shops";
import { approveShop, hideListing, staffPauseShop } from "./staff-shops";
import {
  closeReport,
  closeReportsAboutShop,
  closeReportsOn,
  countHidden,
  getHidden,
  getReport,
  listHidden,
  listReports,
  openReportCount,
} from "./staff-reports";
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

  it("says what the Hub can do: hide a listing or a request that's there, pause an owned open shop, only dismiss the rest", async () => {
    const own = (await getReport(await report("acc-student", { kind: "listing", id: "l-001" }, 8)))!;
    expect(own).toMatchObject({ exists: true, can: { hide: true, pause: true }, shop: { slug: "tech-corner", name: "Tech corner" } });
    const sample = (await getReport(await report("acc-student", { kind: "listing", id: "l-004" }, 8)))!;
    expect(sample.can).toEqual({ hide: true, pause: false });
    const shop = (await getReport(await report("acc-student", { kind: "seller", id: "tech-corner" }, 8)))!;
    expect(shop.can).toEqual({ hide: false, pause: true });
    const request = (await getReport(await report("acc-student", { kind: "request", id: "r-001" }, 8)))!;
    expect(request.can).toEqual({ hide: true, pause: false });
    sampleStore().listings.delete("l-007");
    const gone = (await getReport(await report("acc-student", { kind: "listing", id: "l-007" }, 8)))!;
    expect(gone).toMatchObject({ exists: false, can: { hide: false, pause: false } });
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    expect((await getReport(own.id))!.can).toEqual({ hide: true, pause: false });
  });

  it("says when buyers can't see what was reported: a hidden listing, or a shop the Hub has paused", async () => {
    const listing = await report("acc-student", { kind: "listing", id: "l-001" }, 8);
    const shop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 9);
    expect(await getReport(listing)).toMatchObject({ exists: true, unseen: null });
    expect(await getReport(shop)).toMatchObject({ exists: true, unseen: null });
    sampleStore().listings.get("l-001")!.hiddenAt = NOW.toISOString();
    expect(await getReport(listing)).toMatchObject({ exists: true, unseen: "hidden" });
    delete sampleStore().listings.get("l-001")!.hiddenAt;
    // A shop the seller paused is still up, marked paused; only the Hub's pause makes it disappear (amendment 13.2).
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "seller";
    expect(await getReport(shop)).toMatchObject({ unseen: null });
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    expect(await getReport(shop)).toMatchObject({ exists: true, unseen: "paused" });
    expect(await getReport(listing)).toMatchObject({ exists: true, unseen: "paused" });
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
    await approveShop("tech-corner", "acc-mentor", new Date("2026-10-14T08:42:00.000Z"));
    for (const id of [aboutShop, aboutListing]) {
      expect((await getReport(id))!, id).toMatchObject({ exists: false, shop: null, can: { hide: false, pause: false } });
    }
    // Pausing or hiding on the reused link leaves the old reports open, and the old reporter can report the new shop
    // (amendment 14.2).
    await staffPauseShop("tech-corner", "Reported twice.");
    expect(await closeReportsAboutShop("tech-corner", "Reported twice.", "acc-admin", NOW)).toEqual([]);
    expect(await closeReportsOn({ kind: "seller", id: "tech-corner" }, "paused", "Reported twice.", "acc-admin", NOW)).toEqual([]);
    expect(await closeReportsOn({ kind: "listing", id: "l-001" }, "hidden", "Not allowed.", "acc-admin", NOW)).toEqual([]);
    for (const id of [aboutShop, aboutListing]) expect(sampleStore().reports.get(id), id).toMatchObject({ status: "open" });
    expect(await hasOpenReport("acc-student", { kind: "seller", id: "tech-corner" })).toBe(false);
    const aboutNewShop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 10);
    expect(await hasOpenReport("acc-student", { kind: "seller", id: "tech-corner" })).toBe(true);
    expect((await closeReportsAboutShop("tech-corner", "Reported twice.", "acc-admin", NOW)).map((item) => item.id)).toEqual([
      aboutNewShop,
    ]);
    for (const id of [aboutShop, aboutListing]) expect(sampleStore().reports.get(id)?.status, id).toBe("open");
  });

  it("closes every open report about a shop and about its listings when the shop is paused (amendment 14.1)", async () => {
    const aboutShop = await report("acc-student", { kind: "seller", id: "tech-corner" }, 8);
    const aboutListing = await report("acc-mentor", { kind: "listing", id: "l-001" }, 9);
    const aboutOtherListing = await report("acc-student", { kind: "listing", id: "l-007" }, 10);
    const elsewhere = await report("acc-student", { kind: "listing", id: "l-004" }, 11);
    const aboutRequest = await report("acc-student", { kind: "request", id: "r-001" }, 11);
    const closed = await closeReportsAboutShop("tech-corner", "Selling exam answers.", "acc-admin", NOW);
    expect(closed.map((item) => item.id).sort()).toEqual([aboutShop, aboutListing, aboutOtherListing].sort());
    expect(closed.map((item) => item.reporterId).sort()).toEqual(["acc-mentor", "acc-student", "acc-student"]);
    for (const id of [aboutShop, aboutListing, aboutOtherListing]) {
      expect(sampleStore().reports.get(id), id).toMatchObject({
        status: "closed",
        outcome: "paused",
        note: "Selling exam answers.",
        closedAt: NOW.toISOString(),
        closedBy: "acc-admin",
      });
    }
    // A report about another shop's listing, or about a request, is none of this shop's business.
    for (const id of [elsewhere, aboutRequest]) expect(sampleStore().reports.get(id)?.status, id).toBe("open");
    expect(await closeReportsAboutShop("tech-corner", "Again.", "acc-admin", NOW)).toEqual([]);
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

describe("reports about a request (community actions spec 2.14, plan decision 20)", () => {
  it("can hide a request that's there and not hidden yet; one that has gone can only be dismissed", async () => {
    const id = await report("acc-student", { kind: "request", id: "r-002" }, 8);
    expect((await getReport(id))!).toMatchObject({ exists: true, can: { hide: true, pause: false }, shop: null });
    sampleStore().requests.get("r-002")!.hiddenAt = NOW.toISOString();
    expect((await getReport(id))!.can).toEqual({ hide: false, pause: false });
    sampleStore().requests.delete("r-002");
    expect((await getReport(id))!).toMatchObject({ exists: false, can: { hide: false, pause: false } });
  });

  it("says students can't see a request the Hub has hidden, as it does for a listing (amendment 8)", async () => {
    const id = await report("acc-student", { kind: "request", id: "r-002" }, 8);
    expect(await getReport(id)).toMatchObject({ exists: true, unseen: null });
    sampleStore().requests.get("r-002")!.hiddenAt = NOW.toISOString();
    expect(await getReport(id)).toMatchObject({ exists: true, unseen: "hidden" });
    sampleStore().requests.delete("r-002");
    expect(await getReport(id)).toMatchObject({ exists: false, unseen: null });
  });

  it("can't hide once the report is closed", async () => {
    const id = await report("acc-student", { kind: "request", id: "r-002" }, 8);
    await closeReport(id, "Nothing wrong.", "acc-admin", NOW);
    expect((await getReport(id))!.can).toEqual({ hide: false, pause: false });
  });
});

describe("hidden listings and requests (stage J spec decision 14)", () => {
  const early = new Date("2026-10-13T08:00:00.000Z");
  const late = new Date("2026-10-14T08:00:00.000Z");

  it("lists what the Hub has hidden, newest first, with what the page and its confirm pages need", async () => {
    await hideListing("l-004", "Not allowed.", early);
    await hideListing("l-001", "Checking it.", late);
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff" });
    Object.assign(sampleStore().requests.get("r-001")!, { status: "closed" });
    await hideRequest("r-001", "Exam answers.", early);
    const { listings, requests } = await listHidden();
    expect(listings.map((item) => item.id)).toEqual(["l-001", "l-004"]);
    expect(listings[0]).toEqual({
      kind: "listing",
      id: "l-001",
      title: "Casio fx-991ZA Plus calculator",
      shopName: "Tech corner",
      campusSlug: "midrand",
      hiddenAt: late.toISOString(),
      reason: "Checking it.",
      listingState: "available",
      shopPausedByHub: true,
      requestClosed: false,
      own: false,
    });
    expect(listings[1].shopPausedByHub).toBe(false);
    expect(requests).toEqual([
      expect.objectContaining({
        kind: "request",
        id: "r-001",
        shopName: null,
        reason: "Exam answers.",
        listingState: null,
        requestClosed: true,
      }),
    ]);
    expect(await countHidden()).toEqual({ listings: 2, requests: 1 });
    expect(await getHidden("listing", "l-001")).toEqual(listings[0]);
    expect(await getHidden("listing", "l-002")).toBeNull();
    expect(await getHidden("request", "l-001")).toBeNull();
  });

  it("is empty when nothing is hidden", async () => {
    expect(await listHidden()).toEqual({ listings: [], requests: [] });
    expect(await countHidden()).toEqual({ listings: 0, requests: 0 });
  });
});

describe("whose a report or a hidden item is (stage L spec decisions 1 and 4)", () => {
  const sipho = async () =>
    (
      await createRequest({
        askerId: "acc-seller",
        fields: {
          title: "Desk lamp for res",
          categorySlug: "res-living",
          campusSlug: "midrand",
          details: "A lamp that clips onto a desk, by the weekend.",
          budgetZar: null,
          swapWelcome: false,
          neededBy: null,
        },
        now: NOW,
      })
    ).id;
  const reportOn = (target: { kind: "listing" | "seller" | "request"; id: string }, targetTitle: string) =>
    createReport({ reporterId: "acc-student", target, targetTitle, reason: "scam", detail: "", now: NOW });

  it("says when a report is about the viewing admin's own shop, listing or request, and then allows nothing", async () => {
    const aboutShop = await reportOn({ kind: "seller", id: "tech-corner" }, "Tech corner");
    const aboutListing = await reportOn({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator");
    const aboutRequest = await reportOn({ kind: "request", id: await sipho() }, "Desk lamp for res");
    for (const [id, kind] of [
      [aboutShop, "shop"],
      [aboutListing, "listing"],
      [aboutRequest, "request"],
    ] as const) {
      const view = (await getReport(id, "acc-seller"))!;
      expect([view.own, view.can], kind).toEqual([kind, { hide: false, pause: false }]);
      expect((await getReport(id, "acc-admin"))!.own, kind).toBeNull();
    }
    // Another admin can still act, and with no viewer the view is as before (plan decision 3).
    expect((await getReport(aboutListing, "acc-admin"))!.can).toEqual({ hide: true, pause: true });
    expect((await getReport(aboutListing))!.own).toBeNull();
    // The queue has no controls, so it names no owner.
    expect((await listReports()).every((view) => view.own === null)).toBe(true);
  });

  it("marks the viewer's own hidden listings and requests", async () => {
    await hideListing("l-001", "Checking it.", NOW);
    const id = await sipho();
    await hideRequest(id, "Checking it.", NOW);
    const mine = await listHidden("acc-seller");
    expect(mine.listings.map((item) => [item.id, item.own])).toEqual([["l-001", true]]);
    expect(mine.requests.map((item) => [item.id, item.own])).toEqual([[id, true]]);
    const theirs = await listHidden("acc-admin");
    expect([theirs.listings[0].own, theirs.requests[0].own]).toEqual([false, false]);
    expect((await getHidden("listing", "l-001", "acc-seller"))?.own).toBe(true);
    expect((await getHidden("request", id))?.own).toBe(false);
  });
});
