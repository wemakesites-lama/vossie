import { beforeEach, describe, expect, it } from "vitest";
import { listBookings, openBookingCount } from "./hub-posts";
import { createReport } from "./reports";
import { listReports, openReportCount } from "./staff-reports";
import { countWaitingShops, listShopsForReview } from "./staff-shops";
import { resetSampleStore } from "./store";

// Each section bar's badge comes from a counter; the list the tab opens comes from a reader. They must agree, or the
// badge says a number the list doesn't show (role views spec 4.2).
beforeEach(() => {
  resetSampleStore();
});

describe("a bar's badge equals the list it opens", () => {
  it("Shops: waiting shops", async () => {
    const waiting = (await listShopsForReview()).filter((shop) => shop.standing === "waiting");
    expect(await countWaitingShops()).toBe(waiting.length);
  });

  it("Reports: open reports", async () => {
    // The fixtures hold no open report, so make one: a 0 = 0 would pass whatever the counter did.
    await createReport({
      reporterId: "badge-test",
      target: { kind: "listing", id: "badge-listing" },
      targetTitle: "A listing",
      reason: "scam",
      detail: "Asked for a deposit.",
      now: new Date("2026-10-14T12:00:00.000Z"),
    });
    const open = (await listReports()).filter((report) => report.open);
    expect(open.length).toBeGreaterThan(0);
    expect(await openReportCount()).toBe(open.length);
  });

  it("Hub and Office hours: open slot requests", async () => {
    const open = (await listBookings()).filter((booking) => booking.status === "open");
    expect(await openBookingCount()).toBe(open.length);
  });
});
