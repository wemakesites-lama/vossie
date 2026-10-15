import { beforeEach, describe, expect, it } from "vitest";
import { addNote, getMentoredShop, listNotes, mentoredShops } from "./mentors";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const naledi = { id: "acc-mentor", roles: ["mentor"] as const };
const pieter = { id: "acc-admin", roles: ["admin"] as const };
const zanele = { id: "acc-zanele", roles: ["mentor"] as const };

beforeEach(() => {
  resetSampleStore();
});

describe("the mentor dashboard (staff tools spec 2.6, plan decision 15)", () => {
  it("gives a mentor their shops with the last 14 days' numbers and flags, never messages", async () => {
    expect(await mentoredShops(naledi, NOW)).toEqual([
      {
        slug: "tech-corner",
        name: "Tech corner",
        campusSlug: "midrand",
        ownerName: "Sipho",
        ownerId: "acc-seller",
        badge: "responsive",
        status: "approved",
        mentorId: "acc-mentor",
        mentorName: "Naledi",
        counts: { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 },
        flags: [],
      },
    ]);
  });

  it("gives an admin every assigned shop, and another mentor only theirs", async () => {
    expect((await mentoredShops(pieter, NOW)).map((row) => row.slug)).toEqual(["tech-corner"]);
    expect(await mentoredShops(zanele, NOW)).toEqual([]);
  });

  it("flags a paused shop, and one with no enquiries in the 14 days", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    const later = new Date("2026-11-14T10:00:00.000Z");
    expect((await mentoredShops(naledi, later))[0].flags).toEqual(["no-enquiries", "paused"]);
  });

  it("leaves out a shop with no mentor, or one waiting for approval", async () => {
    sampleStore().sellerProfiles.get("acc-pending")!.mentorId = "acc-mentor";
    sampleStore().sellerProfiles.get("acc-seller")!.mentorId = null;
    expect(await mentoredShops(pieter, NOW)).toEqual([]);
  });

  it("opens a shop's mentor page only for its mentor or an admin", async () => {
    expect((await getMentoredShop("tech-corner", naledi, NOW))?.name).toBe("Tech corner");
    expect((await getMentoredShop("tech-corner", pieter, NOW))?.mentorName).toBe("Naledi");
    expect(await getMentoredShop("tech-corner", zanele, NOW)).toBeNull();
    expect(await getMentoredShop("hair-studio", pieter, NOW)).toBeNull();
  });
});

describe("notes and check-ins (staff tools spec 2.6, plan decision 16)", () => {
  it("lists what's been written about the owner, newest first, and adds to it", async () => {
    expect((await listNotes("acc-seller")).map((note) => [note.id, note.kind, note.authorName])).toEqual([
      ["mn-s2", "note", "Naledi"],
      ["mn-s1", "check-in", "Naledi"],
    ]);
    const id = await addNote({
      ownerId: "acc-seller",
      kind: "check-in",
      checkInOn: "2026-10-14",
      text: "Called him about photos.",
      author: { id: "acc-admin", firstName: "Pieter" },
      now: NOW,
    });
    expect(id).toMatch(/^mn-[0-9a-f-]{36}$/);
    expect((await listNotes("acc-seller"))[0]).toEqual({
      id,
      kind: "check-in",
      checkInOn: "2026-10-14",
      text: "Called him about photos.",
      authorName: "Pieter",
      createdAt: NOW.toISOString(),
    });
    expect(await listNotes("acc-student")).toEqual([]);
  });
});
