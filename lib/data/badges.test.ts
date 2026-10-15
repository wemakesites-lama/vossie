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
    answeredEnquiry();
    expect(await recalculateBadges(NOW)).toEqual([]);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("responsive");
  });

  it("leaves the sample shops no account owns, and a shop waiting for approval, as they are", async () => {
    sampleStore().sellers.get("crochet-corner")!.badge = "trusted";
    await recalculateBadges(NOW);
    expect(sampleStore().sellers.get("hair-studio")?.badge).toBe("trusted");
    expect(sampleStore().sellers.get("crochet-corner")?.badge).toBe("trusted");
  });

  it("works out a paused shop's badge too", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    sampleStore().sellerProfiles.get("acc-seller")!.pausedBy = "staff";
    expect(await recalculateBadges(NOW)).toEqual(["tech-corner"]);
  });

  it("works out the badge of a conversation's shop, after a reply or a confirmed sale", async () => {
    expect(await recalculateBadgeFor("conv-s1", NOW)).toBe(true);
    expect(sampleStore().sellers.get("tech-corner")?.badge).toBe("new-seller");
    expect(await recalculateBadgeFor("conv-s1", NOW)).toBe(false);
    expect(await recalculateBadgeFor("conv-nope", NOW)).toBe(false);
  });

  it("writes nothing when the shop changes while its numbers are counted (amendment 19)", async () => {
    const store = sampleStore();
    // The shop goes back to waiting while the count runs: it isn't given a badge.
    const [pending] = await Promise.all([
      recalculateBadgeFor("conv-s1", NOW),
      (async () => {
        store.sellerProfiles.get("acc-seller")!.status = "pending";
      })(),
    ]);
    expect(pending).toBe(false);
    expect(store.sellers.get("tech-corner")?.badge).toBe("responsive");
    store.sellerProfiles.get("acc-seller")!.status = "approved";

    // The shop's row is replaced while the count runs: neither the old row nor the new one is written.
    const old = store.sellers.get("tech-corner")!;
    const [replaced] = await Promise.all([
      recalculateBadgeFor("conv-s1", NOW),
      (async () => {
        store.sellers.set("tech-corner", { ...structuredClone(old), badge: "trusted" });
      })(),
    ]);
    expect(replaced).toBe(false);
    expect(old.badge).toBe("responsive");
    expect(store.sellers.get("tech-corner")?.badge).toBe("trusted");
  });
});
