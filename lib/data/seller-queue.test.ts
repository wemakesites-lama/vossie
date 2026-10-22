import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationRow, ListingRow } from "./rows";
import { queueOver, sellerQueue } from "./seller-queue";
import { resetSampleStore, sampleStore } from "./store";
import { makeListingRow } from "@/tests/helpers/fakes";

beforeEach(() => {
  resetSampleStore();
});

let made = 0;
/** A conversation with Tech corner, asked at `createdAt` and nothing else, unless the overrides say. */
function talk(overrides: Partial<ConversationRow>): ConversationRow {
  made += 1;
  return {
    id: `conv-q${made}`,
    listingId: "q-avail",
    listingTitle: "Desk lamp",
    sellerSlug: "tech-corner",
    buyerId: `acc-buyer-${made}`,
    sellerGone: false,
    status: "asked",
    createdAt: "2026-10-18T08:00:00.000Z",
    lastMessageAt: "2026-10-18T08:00:00.000Z",
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    ...overrides,
  };
}

const listing = (overrides: Partial<ListingRow>): ListingRow =>
  makeListingRow({ kind: "item", state: "available", updatedAt: "2026-10-10T08:00:00.000Z", ...overrides });

const LISTINGS = [
  listing({ id: "q-avail", title: "Desk lamp" }),
  listing({ id: "q-relist", title: "Kettle", updatedAt: "2026-10-20T08:00:00.000Z" }),
  listing({ id: "q-service", title: "Maths tutoring", kind: "service", condition: null }),
  listing({ id: "q-draft", title: "Bike", state: "draft", updatedAt: "2026-10-05T08:00:00.000Z" }),
  listing({ id: "q-paused", title: "Paused lamp", state: "paused", updatedAt: "2026-10-08T08:00:00.000Z" }),
  listing({ id: "q-hidden", title: "Exam papers", hiddenAt: "2026-10-17T08:00:00.000Z", hiddenReason: "Not allowed." }),
  listing({ id: "q-sold", title: "Radio", state: "sold", updatedAt: "2026-10-09T08:00:00.000Z" }),
];

describe("the seller's queue (role views spec 6 and 7.1)", () => {
  it("counts buyers waiting for a first reply, oldest first, and leaves out offers, replies and anyone gone", () => {
    const queue = queueOver(
      [
        talk({ id: "conv-old", listingId: "q-paused", listingTitle: "Paused lamp", createdAt: "2026-10-17T08:00:00.000Z" }),
        talk({ id: "conv-new", listingId: "q-sold", listingTitle: "Radio" }),
        talk({ id: "conv-question", listingId: null, listingTitle: null, createdAt: "2026-10-19T08:00:00.000Z" }),
        talk({ status: "replied", firstReplyAt: "2026-10-18T09:00:00.000Z" }),
        talk({ status: "offered", requestId: "r-001", requestTitle: "A lamp", createdAt: "2026-10-01T08:00:00.000Z" }),
        talk({ sellerGone: true, createdAt: "2026-10-01T08:00:00.000Z" }),
        talk({ buyerId: null, createdAt: "2026-10-01T08:00:00.000Z" }),
      ],
      LISTINGS,
    );
    expect(queue.replies).toEqual({
      count: 3,
      oldest: { id: "conv-old", title: "Paused lamp", at: "2026-10-17T08:00:00.000Z", state: null },
    });
    expect(queue.everReplied).toBe(true);
  });

  it("lists sales to mark as sold: an available item, not hidden, unchanged since the sale, oldest first", () => {
    const queue = queueOver(
      [
        talk({ id: "conv-done", status: "done", completedAt: "2026-10-15T08:00:00.000Z" }),
        talk({
          id: "conv-confirmed",
          status: "confirmed",
          completedAt: "2026-10-12T08:00:00.000Z",
          confirmedAt: "2026-10-13T08:00:00.000Z",
          confirmedBy: "buyer",
        }),
        // Relisted after the sale: the seller has acted since (plan decision 3).
        talk({ listingId: "q-relist", status: "done", completedAt: "2026-10-14T08:00:00.000Z" }),
        // A service is sold again and again; a hidden listing isn't the seller's to sell now; a sold one is done.
        talk({ listingId: "q-service", status: "done", completedAt: "2026-10-15T08:00:00.000Z" }),
        talk({ listingId: "q-hidden", status: "done", completedAt: "2026-10-16T08:00:00.000Z" }),
        talk({ listingId: "q-sold", status: "done", completedAt: "2026-10-16T08:00:00.000Z" }),
        // An offer's sale counts, as F counts it.
        talk({
          id: "conv-offer",
          status: "done",
          requestId: "r-001",
          requestTitle: "A lamp",
          completedAt: "2026-10-16T08:00:00.000Z",
        }),
        talk({ sellerGone: true, status: "done", completedAt: "2026-10-16T08:00:00.000Z" }),
      ],
      LISTINGS,
    );
    expect(queue.sales.map((sale) => [sale.conversationId, sale.listingId, sale.title])).toEqual([
      ["conv-confirmed", "q-avail", "Desk lamp"],
      ["conv-done", "q-avail", "Desk lamp"],
      ["conv-offer", "q-avail", "Desk lamp"],
    ]);
  });

  it("counts drafts, Hub-hidden and paused listings, each with its oldest, and the listings by state", () => {
    const queue = queueOver([], LISTINGS);
    expect(queue.drafts).toEqual({ count: 1, oldest: { id: "q-draft", title: "Bike", at: "2026-10-05T08:00:00.000Z", state: "draft" } });
    expect(queue.hidden).toEqual({
      count: 1,
      oldest: { id: "q-hidden", title: "Exam papers", at: "2026-10-17T08:00:00.000Z", state: "available" },
    });
    expect(queue.paused.oldest?.id).toBe("q-paused");
    expect(queue.listings).toEqual({ available: 4, paused: 1, sold: 1, drafts: 1 });
    expect(queue.everReplied).toBe(false);
  });

  it("reads Tech corner's own rows from the store: the seed's calculator sale waits to be marked sold", async () => {
    const queue = await sellerQueue("tech-corner");
    // conv-s2 (data/fixtures/messages.ts:25) was marked done on 13 October; l-001 last changed on 12 October.
    expect(queue.sales.map((sale) => sale.conversationId)).toEqual(["conv-s2"]);
    expect(queue.replies.count).toBe(0);
    expect(queue.everReplied).toBe(true);
    sampleStore().listings.get("l-001")!.state = "sold";
    expect((await sellerQueue("tech-corner")).sales).toEqual([]);
  });

  it("reads nothing of another shop's", async () => {
    sampleStore().conversations.set("conv-x", talk({ id: "conv-x", sellerSlug: "hair-studio" }));
    expect((await sellerQueue("tech-corner")).replies.count).toBe(0);
  });
});
