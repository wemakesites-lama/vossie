import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAccounts } from "@/data/fixtures/accounts";
import { sampleConversations } from "@/data/fixtures/messages";
import { sampleRequestRows } from "@/data/fixtures/request-rows";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { sampleHubPostRows } from "@/data/fixtures/staff";
import { resetSampleStore, sampleStore, STORE_VERSION } from "./store";

beforeEach(() => {
  resetSampleStore();
});

describe("the sample store (accounts spec 2.1)", () => {
  it("is seeded with the sample accounts, their consents, their shops, the sample conversations, the sample listings, the staff tools' seeds and the sample requests, no saved searches, and nothing else", () => {
    const store = sampleStore();
    expect([...store.accounts.keys()]).toEqual(sampleAccounts.map(({ account }) => account.id));
    expect(store.consents.size).toBe(5);
    expect([...store.sellerProfiles.keys()]).toEqual(["acc-seller", "acc-pending"]);
    expect(store.sessions.size).toBe(0);
    expect(store.signInAttempts.size).toBe(0);
    expect(store.codeSends.size).toBe(0);
    expect(store.photoFills.size).toBe(0);
    expect(store.sampleEmails.size).toBe(0);
    expect(store.formStates.size).toBe(0);
    expect([...store.conversations.keys()]).toEqual(["conv-s1", "conv-s2"]);
    expect(store.messages.size).toBe(5);
    expect(store.notifications.size).toBe(4);
    expect(store.reports.size).toBe(0);
    expect(store.sellers.size).toBe(30);
    expect(store.listings.size).toBe(38);
    // Every sample listing has been published already (selling plan amendment 9.2).
    expect([...store.listings.values()].every((row) => row.firstPublishedAt === row.createdAt)).toBe(true);
    expect(store.photos.size).toBe(0);
    expect(store.onboardingDrafts.size).toBe(0);
    expect(store.auditLog.size).toBe(0);
    expect(store.featuredPins.size).toBe(0);
    expect(store.featuredDraws.size).toBe(0);
    expect(store.pickupPoints.size).toBe(24);
    expect([...store.mentorNotes.keys()]).toEqual(["mn-s1", "mn-s2"]);
    expect(store.hubPosts.size).toBe(22);
    expect(store.hubRsvps.size).toBe(0);
    expect([...store.hubBookings.keys()]).toEqual(["bk-s1"]);
    expect([...store.requests.keys()]).toEqual(sampleRequestRows.map((row) => row.id));
    expect(store.follows.size).toBe(0);
    expect(store.savedSearches.size).toBe(0);
  });

  it("is one store for the whole process, so a module loaded again still shares it", async () => {
    const first = sampleStore();
    vi.resetModules();
    const again = await import("./store");
    expect(again.sampleStore()).toBe(first);
  });

  it("copies the fixtures, so a write never changes them", () => {
    sampleStore().accounts.get("acc-student")!.firstName = "Changed";
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(sampleAccounts[0].account.firstName).toBe("Thandi");
    expect(sampleAccounts[3].account.roles).toEqual(["mentor"]);
  });

  it("copies the sample conversations too (messaging plan, Task 1)", () => {
    sampleStore().conversations.get("conv-s1")!.status = "confirmed";
    sampleStore().messages.get("msg-s2")!.readAt = "2026-10-14T08:00:00.000Z";
    expect(sampleConversations[0].status).toBe("replied");
    expect(resetAndRead().messages.get("msg-s2")?.readAt).toBeNull();
  });

  it("copies the sample shops and listings too (selling plan, Task 1)", () => {
    sampleStore().sellers.get("tech-corner")!.pickupPointIds.push("pp-pretoria-library");
    sampleStore().listings.get("l-001")!.photos.pop();
    expect(sampleSellerRows.find((row) => row.slug === "tech-corner")?.pickupPointIds).toEqual([
      "pp-midrand-library",
      "pp-midrand-reception",
    ]);
    expect(resetAndRead().listings.get("l-001")?.photos).toHaveLength(3);
  });

  it("copies the staff tools' seeds too (staff tools plan, Task 1)", () => {
    sampleStore().hubPosts.get("h-001")!.title = "Changed";
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = "2026-10-14T08:00:00.000Z";
    expect(sampleHubPostRows[0].title).toBe("Pitch night");
    expect(resetAndRead().pickupPoints.get("pp-midrand-library")?.retiredAt).toBeNull();
    expect(sampleStore().hubPosts.get("h-001")?.title).toBe("Pitch night");
  });

  it("copies the sample requests too (community actions plan, Task 1)", () => {
    sampleStore().requests.get("r-001")!.title = "Changed";
    expect(sampleRequestRows[0].title).toBe("Accounting 1 tutor this week");
    expect(resetAndRead().requests.get("r-001")?.title).toBe("Accounting 1 tutor this week");
  });

  it("starts again from the fixtures when reset", () => {
    sampleStore().accounts.delete("acc-student");
    resetSampleStore();
    expect(sampleStore().accounts.has("acc-student")).toBe(true);
  });

  it("reseeds a store left behind by an older version, as next dev keeps globalThis across reloads", () => {
    const old = sampleStore();
    old.version = STORE_VERSION - 1;
    old.accounts.clear();
    expect(sampleStore().version).toBe(STORE_VERSION);
    expect(sampleStore().accounts.size).toBe(5);
  });
});

function resetAndRead() {
  resetSampleStore();
  return sampleStore();
}
