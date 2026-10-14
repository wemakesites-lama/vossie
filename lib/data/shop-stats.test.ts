import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationRow } from "./rows";
import { shopStats } from "./shop-stats";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR_MS).toISOString();

let made = 0;
/** A conversation with Tech corner about a listing, asked an hour ago. */
function add(overrides: Partial<ConversationRow>): void {
  made += 1;
  const row: ConversationRow = {
    id: `conv-t${made}`,
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-student",
    sellerGone: false,
    status: "asked",
    createdAt: ago(1),
    lastMessageAt: ago(1),
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    ...overrides,
  };
  sampleStore().conversations.set(row.id, row);
}

beforeEach(() => {
  resetSampleStore();
});

describe("the dashboard's numbers (selling spec 2.8, plan decision 18)", () => {
  it("has the sample seller's two enquiries this week, both answered in time, and no sale yet", async () => {
    const counts = { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 };
    expect(await shopStats("tech-corner", NOW)).toEqual({ week: counts, record: counts });
  });

  it("counts an enquiry as due once it's answered or 48 hours old, and answered in time within 48 hours", async () => {
    sampleStore().conversations.clear();
    add({ createdAt: ago(10), firstReplyAt: ago(9) });
    add({ createdAt: ago(60), firstReplyAt: ago(5) });
    add({ createdAt: ago(50) });
    add({ createdAt: ago(5) });
    expect((await shopStats("tech-corner", NOW)).week).toEqual({
      enquiries: 4,
      due: 3,
      repliedInTime: 1,
      salesConfirmed: 0,
    });
  });

  it("leaves out questions to the shop, other shops, and enquiries older than each window", async () => {
    sampleStore().conversations.clear();
    add({ listingId: null, listingTitle: null });
    add({ sellerSlug: "hair-studio" });
    add({ createdAt: ago(24 * 8) });
    add({ createdAt: ago(24 * 91) });
    const stats = await shopStats("tech-corner", NOW);
    expect(stats.week.enquiries).toBe(0);
    expect(stats.record.enquiries).toBe(1);
  });

  it("leaves out conversations whose shop's owner has gone, so a restored or reused link inherits none (amendment 9.1)", async () => {
    sampleStore().conversations.clear();
    add({ sellerGone: true, firstReplyAt: ago(0.5) });
    add({ sellerGone: true, status: "confirmed", confirmedAt: ago(24), confirmedBy: "buyer" });
    add({ sellerGone: true, status: "done", completedAt: ago(24 * 8) });
    add({});
    const stats = await shopStats("tech-corner", NOW);
    expect(stats.week).toEqual({ enquiries: 1, due: 0, repliedInTime: 0, salesConfirmed: 0 });
    expect(stats.record).toEqual({ enquiries: 1, due: 0, repliedInTime: 0, salesConfirmed: 0 });
  });

  it("counts sales the buyer confirmed, and ones marked done 7 days ago, writing nothing", async () => {
    sampleStore().conversations.clear();
    add({ status: "confirmed", confirmedAt: ago(24), confirmedBy: "buyer" });
    add({ status: "done", completedAt: ago(24 * 8) });
    add({ status: "done", completedAt: ago(24 * 2) });
    add({ status: "confirmed", confirmedAt: ago(24 * 30), confirmedBy: "auto" });
    const stats = await shopStats("tech-corner", NOW);
    expect(stats.week.salesConfirmed).toBe(2);
    expect(stats.record.salesConfirmed).toBe(3);
    expect([...sampleStore().conversations.values()].filter((row) => row.status === "done")).toHaveLength(2);
  });
});
