import { beforeEach, describe, expect, it } from "vitest";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { recordAudit } from "./audit";
import { HUB_PHOTO_OWNER, hubCoverUse } from "./hub-posts";
import { notify } from "./notifications";
import { storePhotos } from "./photos";
import { exportStaffToolsData, forgetAccountInStaffTools } from "./staff-privacy";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("deleting an account, in the staff tools (POPIA; plan decisions 6, 11, 13 and 16, amendments 17 and 21)", () => {
  it("keeps every audit entry: a staff member's own keep their id as Former staff member, and those about the account forget it", async () => {
    const staff = { id: "acc-admin", firstName: "Pieter" };
    const shop = { kind: "shop" as const, id: "tech-corner", name: "Tech corner" };
    await recordAudit({ staff, action: "shop-paused", target: shop, detail: "Reported.", subjectId: "acc-seller", now: NOW });
    await recordAudit({ staff, action: "shop-verified", target: { ...shop, id: "hair-studio", name: "Hair studio" }, now: NOW });
    await forgetAccountInStaffTools("acc-seller");
    await forgetAccountInStaffTools("acc-admin");
    const rows = [...sampleStore().auditLog.values()];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      staffId: "acc-admin",
      staffName: "Former staff member",
      action: "shop-paused",
      targetId: "",
      targetName: "Deleted account",
      detail: "",
      subjectId: null,
    });
    expect(rows[1]).toMatchObject({
      staffId: "acc-admin",
      staffName: "Former staff member",
      targetId: "hair-studio",
      targetName: "Hair studio",
    });
    expect(JSON.stringify(rows)).not.toContain("Pieter");
  });

  it("leaves entries about someone else as they were", async () => {
    const staff = { id: "acc-admin", firstName: "Pieter" };
    await recordAudit({
      staff,
      action: "booking-accepted",
      target: { kind: "booking", id: "bk-s1", name: "Office hours: your first listing" },
      subjectId: "acc-student",
      now: NOW,
    });
    await forgetAccountInStaffTools("acc-seller");
    expect([...sampleStore().auditLog.values()][0]).toMatchObject({
      staffName: "Pieter",
      targetId: "bk-s1",
      subjectId: "acc-student",
    });
  });

  it("deletes the notes about a seller, and keeps a deleted mentor's notes as Former staff member", async () => {
    await forgetAccountInStaffTools("acc-mentor");
    expect([...sampleStore().mentorNotes.values()].map((note) => [note.authorId, note.authorName])).toEqual([
      [null, "Former staff member"],
      [null, "Former staff member"],
    ]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(sampleStore().hubPosts.get("h-002")?.authorId).toBeNull();
    await forgetAccountInStaffTools("acc-seller");
    expect(sampleStore().mentorNotes.size).toBe(0);
  });

  it("deletes a student's RSVPs, slot requests and the authors' notifications about them, and unsigns the answers, pins and reports staff left", async () => {
    const store = sampleStore();
    store.hubRsvps.set("h-001:acc-student", { key: "h-001:acc-student", postId: "h-001", accountId: "acc-student", createdAt: NOW.toISOString() });
    store.hubBookings.set("bk-2", { ...store.hubBookings.get("bk-s1")!, id: "bk-2", accountId: "acc-seller", status: "accepted", answeredBy: "acc-admin" });
    store.featuredPins.set("pin-1", { id: "pin-1", sellerSlug: "nail-bar", campusSlug: "all", day: "2026-10-14", pinnedBy: "acc-admin", createdAt: NOW.toISOString() });
    store.reports.set("rep-x", {
      id: "rep-x",
      reporterId: "acc-seller",
      targetKind: "seller",
      targetId: "hair-studio",
      targetTitle: "Hair studio",
      reason: "scam",
      detail: "",
      status: "closed",
      createdAt: NOW.toISOString(),
      outcome: "dismissed",
      note: "Looked fine.",
      closedAt: NOW.toISOString(),
      closedBy: "acc-admin",
    });
    const request = { accountId: "acc-mentor", kind: "booking" as const, href: "/hub/manage", now: NOW };
    await notify({ ...request, subjectId: "bk-s1", text: "Thandi asked for a slot at Office hours: your first listing." });
    await notify({ ...request, subjectId: "bk-2", text: "Sipho asked for a slot at Office hours: your first listing." });
    await forgetAccountInStaffTools("acc-student");
    expect(store.hubRsvps.size).toBe(0);
    expect([...store.hubBookings.keys()]).toEqual(["bk-2"]);
    expect([...store.notifications.values()].map((row) => row.subjectId)).not.toContain("bk-s1");
    expect([...store.notifications.values()].map((row) => row.subjectId)).toContain("bk-2");
    await forgetAccountInStaffTools("acc-admin");
    expect(store.hubBookings.get("bk-2")?.answeredBy).toBeNull();
    expect(store.featuredPins.get("pin-1")?.pinnedBy).toBeNull();
    expect(store.reports.get("rep-x")?.closedBy).toBeNull();
  });

  it("forgets a deleted owner's shop in Featured: its pins go, and it leaves the rows recorded (plan amendment 11)", async () => {
    const store = sampleStore();
    const pin = { campusSlug: "midrand", day: "2026-10-14", pinnedBy: "acc-admin", createdAt: NOW.toISOString() };
    store.featuredPins.set("pin-1", { ...pin, id: "pin-1", sellerSlug: "tech-corner" });
    store.featuredPins.set("pin-2", { ...pin, id: "pin-2", sellerSlug: "hair-studio" });
    store.featuredDraws.set("midrand:2026-10-14", {
      key: "midrand:2026-10-14",
      campusSlug: "midrand",
      day: "2026-10-14",
      sellerSlugs: ["tech-corner", "hair-studio"],
    });
    await forgetAccountInStaffTools("acc-seller");
    expect([...store.featuredPins.keys()]).toEqual(["pin-2"]);
    expect(store.featuredDraws.get("midrand:2026-10-14")?.sellerSlugs).toEqual(["hair-studio"]);
  });

  it("keeps the Hub's covers when a staff member's account goes (plan amendment 41)", async () => {
    const [cover] = await storePhotos("acc-mentor", [{ type: "image/png", bytes: pngBytes() }], NOW);
    const id = cover.replace("/photos/", "");
    Object.assign(sampleStore().photos.get(id)!, { ownerId: HUB_PHOTO_OWNER, use: hubCoverUse("h-002") });
    await forgetAccountInStaffTools("acc-mentor");
    expect(sampleStore().photos.has(id)).toBe(true);
  });
});

describe("the data export, in the staff tools (plan decision 16, amendments 16 and 25)", () => {
  it("holds the account's RSVPs and slot requests, with no ids", async () => {
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
      mentorNotes: [],
    });
  });

  it("gives a seller the mentors' notes and check-ins about them, newest first, with no ids (amendment 16)", async () => {
    const data = await exportStaffToolsData("acc-seller");
    expect(data.mentorNotes).toEqual([
      {
        kind: "note",
        checkInOn: null,
        text: "Replies fast. Next: photos on a plain background, and a listing for the headset's case.",
        by: "Naledi",
        at: "2026-10-13T15:10:00.000Z",
      },
      {
        kind: "check-in",
        checkInOn: "2026-10-06",
        text: "Met Sipho at the Hub. We priced his calculators against new ones, and he'll list two more by Friday.",
        by: "Naledi",
        at: "2026-10-06T12:30:00.000Z",
      },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/acc-|mn-s/);
    // The mentor who wrote them gets none of them in theirs.
    expect((await exportStaffToolsData("acc-mentor")).mentorNotes).toEqual([]);
  });
});
