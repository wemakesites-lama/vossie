import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { notify } from "@/lib/data/notifications";
import { resetSampleStore } from "@/lib/data/store";
import { forYouTotal } from "./model";
import { readForYou, readYourStuff } from "./read";

// The saved cookie is the browser's; here it's whatever the test says.
const saved = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("@/lib/data/saved", () => ({ getSavedIds: async () => saved.ids }));

// The fixtures' day: Thandi (acc-student) has one unread conversation and two new notifications.
const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  saved.ids = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

describe("You's readers on the seed (role views spec 7.4)", () => {
  it("For you counts Thandi's unread conversation and her new match, never another account's", async () => {
    await notify({
      accountId: "acc-student",
      kind: "search-match",
      subjectId: "ss-1",
      text: "Casio calculator matches your search",
      href: "/listings/l-001",
      now: NOW,
    });
    await notify({ accountId: "acc-seller", kind: "offer", subjectId: "c-1", text: "Offer", href: "/messages/c-1", now: NOW });
    const forYou = await readForYou("acc-student");
    expect(forYou.items.map((item) => [item.key, item.count])).toEqual([
      ["messages", 1],
      ["offers", 0],
      ["matches", 1],
      ["listings", 0],
    ]);
    expect(forYou.conversations).toBe(1);
    expect(forYou.newNotifications).toBe(3);
    expect(forYouTotal(forYou.items)).toBe(2);
  });

  it("Your stuff counts the device's saved listings, her follows and her Hub booking", async () => {
    saved.ids = ["l-001", "l-026"];
    await addFollow("acc-student", "tech-corner", NOW);
    const stuff = await readYourStuff("acc-student", NOW);
    expect(stuff).toMatchObject({
      savedListings: 2,
      followedShops: 1,
      requests: { open: 0, closed: 0, hidden: 0 },
      closingSoon: null,
      searches: { count: 0, alertsOn: 0 },
    });
    expect(stuff.bookings.map((booking) => booking.postId)).toEqual(["h-007"]);
  });
});
