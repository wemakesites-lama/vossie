import { beforeEach, describe, expect, it } from "vitest";
import { recalculateBadgeFor, recalculateBadges } from "./badges";
import type { ConversationRow } from "./rows";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T10:00:00.000Z");

/** A third enquiry for Tech corner, answered half an hour after it came in. */
function answeredEnquiry(): void {
  const row: ConversationRow = {
    id: "conv-t1",
    listingId: "l-001",
    listingTitle: "Casio fx-991ZA Plus calculator",
    sellerSlug: "tech-corner",
    buyerId: "acc-mentor",
    sellerGone: false,
    status: "replied",
    createdAt: "2026-10-14T07:00:00.000Z",
    lastMessageAt: "2026-10-14T07:30:00.000Z",
    firstReplyAt: "2026-10-14T07:30:00.000Z",
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  };
  sampleStore().conversations.set(row.id, row);
}

beforeEach(() => {
  resetSampleStore();
});

describe("trust badges from the store (staff tools spec 2.7, plan decision 8)", () => {
  it("gives Tech corner the badge its conversations earn: New seller with only 2 enquiries", async () => {
    expect(await recalculateBadges(NOW)).toEqual(["tech-corner"]);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(await recalculateBadges(NOW)).toEqual([]);
  });

  it("gives Responsive once a third enquiry is answered within 48 hours", async () => {
    // Start from the badge two enquiries earn, so the upgrade is a real change (amendment 13.7).
    sampleStore().sellers.get("tech-corner")!.badge = "new-seller";
    answeredEnquiry();
    expect(await recalculateBadges(NOW)).toEqual(["tech-corner"]);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("responsive");
    expect(await recalculateBadges(NOW)).toEqual([]);
  });

  it("leaves the sample shops no account owns, and a shop waiting for approval, as they are", async () => {
    sampleStore().sellers.get("crochet-corner")!.badge = "trusted";
    await recalculateBadges(NOW);
    expect(sampleStore().sellers.get("hair-studio")?.badge).toBe("trusted");
    expect(sampleStore().sellers.get("crochet-corner")?.badge).toBe("trusted");
  });

  it("works out the badge of a conversation's shop, after a reply or a confirmed sale", async () => {
    expect(await recalculateBadgeFor("conv-s1", NOW)).toBe(true);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(await recalculateBadgeFor("conv-s1", NOW)).toBe(false);
    expect(await recalculateBadgeFor("conv-nope", NOW)).toBe(false);
  });
});
