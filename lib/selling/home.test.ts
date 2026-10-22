import { describe, expect, it } from "vitest";
import type { SellerQueue } from "@/lib/types";
import {
  dayLabels,
  enquirySummary,
  isNewShop,
  salesToMarkCount,
  sellerNeeds,
  setupSteps,
  waitChip,
} from "./home";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const EMPTY = { count: 0, oldest: null };
const QUEUE: SellerQueue = {
  replies: EMPTY,
  sales: [],
  drafts: EMPTY,
  hidden: EMPTY,
  paused: EMPTY,
  listings: { available: 0, paused: 0, sold: 0, drafts: 0 },
  everReplied: false,
};

describe("waitChip (role views spec 7.1, N2 plan decision 7)", () => {
  it("says hours, then days, and turns warning at 24 hours and danger at 48", () => {
    expect(waitChip(hoursAgo(0.5), NOW)).toEqual({ label: "<1h", tone: "info" });
    expect(waitChip(hoursAgo(23.9), NOW)).toEqual({ label: "23h", tone: "info" });
    expect(waitChip(hoursAgo(24), NOW)).toEqual({ label: "24h", tone: "warning" });
    expect(waitChip(hoursAgo(47.5), NOW)).toEqual({ label: "47h", tone: "warning" });
    expect(waitChip(hoursAgo(49), NOW)).toEqual({ label: "2d", tone: "danger" });
  });
});

describe("sellerNeeds", () => {
  it("gives the five rows in the spec's order, each linking to where the work is", () => {
    const rows = sellerNeeds(
      {
        ...QUEUE,
        replies: { count: 2, oldest: { id: "conv-1", title: null, at: hoursAgo(30), state: null } },
        sales: [
          { conversationId: "conv-9", listingId: "l-a", title: "Desk lamp", at: hoursAgo(80) },
          { conversationId: "conv-8", listingId: "l-a", title: "Desk lamp", at: hoursAgo(20) },
        ],
        drafts: { count: 1, oldest: { id: "l-d", title: "Bike", at: hoursAgo(90), state: "draft" } },
        hidden: { count: 1, oldest: { id: "l-h", title: "Exam papers", at: hoursAgo(5), state: "paused" } },
        paused: { count: 3, oldest: { id: "l-p", title: "Kettle", at: hoursAgo(200), state: "paused" } },
      },
      NOW,
    );
    expect(rows.map((row) => [row.key, row.count, row.title, row.href])).toEqual([
      ["replies", 2, "Buyers waiting for a reply", "/messages?tab=selling"],
      ["sales", 1, "Sale to mark as sold", "/messages/conv-9"],
      ["drafts", 1, "Draft ready to publish", "/sell/listings?tab=drafts"],
      ["hidden", 1, "Hidden by the Hub", "/sell/listings?tab=paused"],
      ["paused", 3, "Paused listings", "/sell/listings?tab=paused"],
    ]);
    expect(rows[0]).toMatchObject({ detail: "Oldest: a question for the shop", age: { label: "30h", tone: "warning" }, urgent: true });
    expect(rows[1]).toMatchObject({ detail: "Desk lamp" });
  });

  it("counts sales by listing, however many threads sold it", () => {
    expect(
      salesToMarkCount({
        ...QUEUE,
        sales: [
          { conversationId: "c1", listingId: "l-a", title: "A", at: hoursAgo(1) },
          { conversationId: "c2", listingId: "l-a", title: "A", at: hoursAgo(2) },
          { conversationId: "c3", listingId: "l-b", title: "B", at: hoursAgo(3) },
        ],
      }),
    ).toBe(2);
  });
});

describe("the setup checklist (role views spec 7.1, N2 plan decision 6)", () => {
  const shop = { image: null, about: "I bake.", pickupPointIds: ["pp-1"] };

  it("is shown until the shop has published and replied", () => {
    expect(isNewShop(QUEUE)).toBe(true);
    expect(isNewShop({ ...QUEUE, listings: { ...QUEUE.listings, sold: 1 } })).toBe(true);
    expect(isNewShop({ ...QUEUE, everReplied: true })).toBe(true);
    expect(isNewShop({ ...QUEUE, everReplied: true, listings: { ...QUEUE.listings, paused: 1 } })).toBe(false);
    // A draft isn't published.
    expect(isNewShop({ ...QUEUE, everReplied: true, listings: { ...QUEUE.listings, drafts: 3 } })).toBe(true);
  });

  it("completes each step from data, and leaves out pickup points where the campus has none", () => {
    expect(setupSteps(shop, QUEUE, true).map((step) => [step.label, step.done, step.href])).toEqual([
      ["Add a photo of your shop", false, "/sell/profile"],
      ["Say what you sell", true, "/sell/profile"],
      ["Choose a pickup point", true, "/sell/profile"],
      ["Publish your first listing", false, "/sell/listings/new"],
      ["Reply to your first buyer", false, "/messages?tab=selling"],
    ]);
    expect(setupSteps(shop, QUEUE, false).map((step) => step.label)).not.toContain("Choose a pickup point");
  });
});

describe("the home's words", () => {
  it("labels the days by SAST date and sums the week", () => {
    expect(dayLabels(3, NOW)).toEqual(["12 Oct", "13 Oct", "14 Oct"]);
    expect(enquirySummary([0, 0, 0, 0, 1, 1, 0])).toBe("2 enquiries across these 7 days, none today.");
    expect(enquirySummary([null, null, 0, 0, 0, 0, 1])).toBe("1 enquiry across these 7 days, 1 today.");
    expect(enquirySummary([0, 0, 0])).toBe("No enquiries in these 3 days yet.");
  });
});
