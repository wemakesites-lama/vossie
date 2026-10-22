import { beforeEach, describe, expect, it } from "vitest";
import { listBookings, openBookingCount } from "@/lib/data/hub-posts";
import { countHidden, listReports, openReportCount, type ReportView } from "@/lib/data/staff-reports";
import { countWaitingShops, listShopsForReview, type ShopReview } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import type { HubBooking } from "@/lib/types";
import { hiddenLine, nextOpenReport, nextWaitingShop, oldestOf, todayLede, todayQueue } from "./queue";

// 2026-10-22 08:00 UTC.
const NOW = new Date("2026-10-22T08:00:00.000Z");

// Only the fields the queue reads; the rest of each view doesn't matter here.
const shop = (slug: string, name: string, standing: ShopReview["standing"], appliedAt: string | null) =>
  ({ shop: { slug, name, campusSlug: "pretoria" }, standing, appliedAt }) as unknown as ShopReview;
const report = (id: string, open: boolean, createdAt: string) =>
  ({ id, open, createdAt, targetTitle: `Thing ${id}` }) as unknown as ReportView;
const booking = (id: string, status: HubBooking["status"], createdAt: string) =>
  ({ id, status, createdAt, postTitle: "Office hours: your first listing" }) as unknown as HubBooking;

const SHOPS = [
  shop("tech-corner", "Tech corner", "open", "2026-03-02T09:40:00.000Z"),
  shop("crochet-corner", "Crochet corner", "waiting", "2026-10-10T12:20:00.000Z"),
  shop("bake-house", "Bake house", "waiting", "2026-10-21T08:00:00.000Z"),
  shop("old-decline", "Old decline", "declined", "2026-10-01T08:00:00.000Z"),
];
const REPORTS = [
  report("r1", true, "2026-10-20T07:00:00.000Z"),
  report("r2", true, "2026-10-21T20:00:00.000Z"),
  report("r0", false, "2026-09-01T08:00:00.000Z"),
];
const BOOKINGS = [booking("bk-s1", "open", "2026-10-13T10:15:00.000Z"), booking("bk-old", "accepted", "2026-09-01T08:00:00.000Z")];

describe("oldestOf", () => {
  it("picks the earliest, puts items without a time last, and keeps the list's order on a tie", () => {
    const items = [
      { id: "a", at: null },
      { id: "b", at: "2026-10-12T00:00:00.000Z" },
      { id: "c", at: "2026-10-11T00:00:00.000Z" },
      { id: "d", at: "2026-10-11T00:00:00.000Z" },
    ];
    expect(oldestOf(items, (item) => item.at)?.id).toBe("c");
    expect(oldestOf([items[0]], (item) => item.at)?.id).toBe("a");
    expect(oldestOf([], () => null)).toBeNull();
  });
});

describe("todayQueue (role views spec 7.2)", () => {
  it("lists shops, slot requests and reports by their oldest wait, then Hidden, each linking to its oldest item", () => {
    const queue = todayQueue({ shops: SHOPS, reports: REPORTS, bookings: BOOKINGS, hidden: { listings: 2, requests: 1 }, now: NOW });
    expect(queue.items.map((item) => item.key)).toEqual(["shops", "slots", "reports", "hidden"]);
    expect(queue.items[0]).toEqual({
      key: "shops",
      count: 2,
      title: "Shops to approve",
      detail: "Oldest: Crochet corner",
      age: { label: "11 days", tone: "warning" },
      href: "/admin/sellers/crochet-corner",
      urgent: true,
    });
    expect(queue.items[1]).toEqual({
      key: "slots",
      count: 1,
      title: "Slot request",
      detail: "Oldest: Office hours: your first listing",
      age: { label: "8 days", tone: "warning" },
      href: "/hub/manage#hub-queue",
      urgent: true,
    });
    // 49 hours: over 2 days, so warning, though it reads "2 days".
    expect(queue.items[2]).toEqual({
      key: "reports",
      count: 2,
      title: "Open reports",
      detail: "Oldest: Thing r1",
      age: { label: "2 days", tone: "warning" },
      href: "/admin/reports/r1",
      urgent: true,
    });
    expect(queue.items[3]).toEqual({
      key: "hidden",
      count: 3,
      title: "Hidden by the Hub",
      detail: "2 listings and 1 request are hidden",
      href: "/admin/hidden",
    });
    expect(queue.waiting).toBe(5);
    expect(queue.oldestAt).toBe("2026-10-10T12:20:00.000Z");
  });

  it("leaves out empty rows and declined shops, and counts nothing when nothing waits", () => {
    const queue = todayQueue({ shops: [SHOPS[0], SHOPS[3]], reports: [REPORTS[2]], bookings: [BOOKINGS[1]], hidden: { listings: 0, requests: 0 }, now: NOW });
    expect(queue).toEqual({ items: [], waiting: 0, oldestAt: null });
  });

  it("shows Hidden alone without counting it as waiting", () => {
    const queue = todayQueue({ shops: [], reports: [], bookings: [], hidden: { listings: 0, requests: 1 }, now: NOW });
    expect(queue.items.map((item) => item.key)).toEqual(["hidden"]);
    expect(queue.waiting).toBe(0);
  });

  it("gives a shop with no application date no age chip, after the timed rows", () => {
    const queue = todayQueue({
      shops: [shop("no-date", "No date", "waiting", null)],
      reports: [REPORTS[0]],
      bookings: [],
      hidden: { listings: 0, requests: 0 },
      now: NOW,
    });
    expect(queue.items.map((item) => item.key)).toEqual(["reports", "shops"]);
    expect(queue.items[1].age).toBeUndefined();
  });
});

describe("todayLede", () => {
  it("says how many wait and how long the oldest has", () => {
    expect(todayLede({ waiting: 5, oldestAt: "2026-10-10T12:20:00.000Z" }, NOW)).toBe("5 waiting · oldest 11 days");
    expect(todayLede({ waiting: 1, oldestAt: "2026-10-22T07:30:00.000Z" }, NOW)).toBe("1 waiting · oldest under 1h");
    expect(todayLede({ waiting: 1, oldestAt: null }, NOW)).toBe("1 waiting");
    expect(todayLede({ waiting: 0, oldestAt: null }, NOW)).toBe("Nothing waiting");
  });
});

describe("the Next links (role views spec 7.2)", () => {
  it("leads from a shop to the oldest waiting shop that isn't it", () => {
    expect(nextWaitingShop(SHOPS, "tech-corner")?.shop.slug).toBe("crochet-corner");
    expect(nextWaitingShop(SHOPS, "crochet-corner")?.shop.slug).toBe("bake-house");
    expect(nextWaitingShop([SHOPS[1]], "crochet-corner")).toBeNull();
  });

  it("leads from a report to the oldest open report that isn't it", () => {
    expect(nextOpenReport(REPORTS, "r1")?.id).toBe("r2");
    expect(nextOpenReport(REPORTS, "r0")?.id).toBe("r1");
    expect(nextOpenReport([REPORTS[0], REPORTS[2]], "r1")).toBeNull();
  });
});

describe("hiddenLine (stage J plan decision 17, moved from AdminOverview)", () => {
  it("names listings and requests in words, or nothing", () => {
    expect(hiddenLine({ listings: 1, requests: 0 })).toBe("1 listing is hidden");
    expect(hiddenLine({ listings: 0, requests: 1 })).toBe("1 request is hidden");
    expect(hiddenLine({ listings: 0, requests: 3 })).toBe("3 requests are hidden");
    expect(hiddenLine({ listings: 1, requests: 1 })).toBe("1 listing and 1 request are hidden");
    expect(hiddenLine({ listings: 0, requests: 0 })).toBeNull();
  });
});

describe("each row counts what its bar badge counts (role views spec 4.2)", () => {
  beforeEach(() => {
    resetSampleStore();
  });

  it("matches countWaitingShops, openReportCount and openBookingCount on the sample store", async () => {
    const queue = todayQueue({
      shops: await listShopsForReview(),
      reports: await listReports(),
      bookings: await listBookings(),
      hidden: await countHidden(),
      now: NOW,
    });
    const count = (key: string) => queue.items.find((item) => item.key === key)?.count ?? 0;
    expect(count("shops")).toBe(await countWaitingShops());
    expect(count("reports")).toBe(await openReportCount());
    expect(count("slots")).toBe(await openBookingCount());
  });
});
