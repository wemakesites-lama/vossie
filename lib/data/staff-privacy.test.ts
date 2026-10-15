import { beforeEach, describe, expect, it } from "vitest";
import { recordAudit } from "./audit";
import { exportStaffToolsData, forgetAccountInStaffTools } from "./staff-privacy";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("deleting an account, in the staff tools (POPIA; plan decisions 6, 11, 13 and 16)", () => {
  it("keeps every audit entry, signing the account's own as Deleted account and stripping it from those about it", async () => {
    const staff = { id: "acc-admin", firstName: "Pieter" };
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff, action: "shop-paused", target: shop, detail: "Reported.", subjectId: "acc-seller", now: NOW });
    await recordAudit({ staff, action: "shop-verified", target: { ...shop, id: "hair-studio", name: "Hair studio" }, now: NOW });
    await forgetAccountInStaffTools("acc-seller");
    await forgetAccountInStaffTools("acc-admin");
    const rows = [...sampleStore().auditLog.values()];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      staffId: null,
      staffName: "Deleted account",
      targetId: "",
      targetName: "Deleted account",
      detail: "",
      subjectId: null,
    });
    expect(rows[1]).toMatchObject({ staffName: "Deleted account", targetName: "Hair studio" });
  });

  it("deletes the notes about a seller, and keeps a deleted mentor's notes, unsigned", async () => {
    await forgetAccountInStaffTools("acc-mentor");
    expect([...sampleStore().mentorNotes.values()].map((note) => [note.authorId, note.authorName])).toEqual([
      [null, "Deleted account"],
      [null, "Deleted account"],
    ]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(sampleStore().hubPosts.get("h-002")?.authorId).toBeNull();
    await forgetAccountInStaffTools("acc-seller");
    expect(sampleStore().mentorNotes.size).toBe(0);
  });

  it("deletes a student's RSVPs and slot requests, and unsigns the answers, pins and reports staff left", async () => {
    const store = sampleStore();
    store.hubRsvps.set("h-001:acc-student", { key: "h-001:acc-student", postId: "h-001", accountId: "acc-student", createdAt: NOW.toISOString() });
    store.hubBookings.set("bk-2", { ...store.hubBookings.get("bk-s1")!, id: "bk-2", accountId: "acc-seller", status: "accepted", answeredBy: "acc-admin" });
    store.featuredPins.set("pin-1", { id: "pin-1", sellerSlug: "nail-bar", campusSlug: "all", day: "2026-10-14", pinnedBy: "acc-admin", createdAt: NOW.toISOString() });
    // A booking notification for the post's author names the student (plan amendment 2).
    store.notifications.set("n-bk", {
      id: "n-bk",
      accountId: "acc-mentor",
      kind: "booking",
      subjectId: "bk-s1",
      text: "Thandi asked for a slot",
      href: "/hub/manage",
      createdAt: NOW.toISOString(),
      readAt: null,
    });
    await forgetAccountInStaffTools("acc-student");
    expect(store.hubRsvps.size).toBe(0);
    expect([...store.hubBookings.keys()]).toEqual(["bk-2"]);
    expect(store.notifications.has("n-bk")).toBe(false);
    await forgetAccountInStaffTools("acc-admin");
    expect(store.hubBookings.get("bk-2")?.answeredBy).toBeNull();
    expect(store.featuredPins.get("pin-1")?.pinnedBy).toBeNull();
  });
});

describe("the data export, in the staff tools (plan decision 16)", () => {
  it("holds the account's RSVPs and slot requests, with no ids, and never a mentor's notes", async () => {
    sampleStore().hubRsvps.set("h-001:acc-student", {
      key: "h-001:acc-student",
      postId: "h-001",
      accountId: "acc-student",
      createdAt: NOW.toISOString(),
    });
    expect(await exportStaffToolsData("acc-student")).toEqual({
      hubRsvps: [{ event: "Pitch night", at: NOW.toISOString() }],
      slotRequests: [
        {
          officeHours: "Office hours: your first listing",
          help: "I want to sell my braiding on Vossie and don't know how to write the listing or what to charge.",
          time: "Any time after 13:30",
          status: "open",
          at: "2026-10-13T10:15:00.000Z",
        },
      ],
    });
    expect(JSON.stringify(await exportStaffToolsData("acc-seller"))).not.toContain("Replies fast");
  });
});
