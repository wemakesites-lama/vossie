import { beforeEach, describe, expect, it } from "vitest";
import {
  countNewNotifications,
  deleteNotifications,
  deleteNotificationsAbout,
  exportNotifications,
  getNotifications,
  markConversationNotificationsRead,
  markNotificationsRead,
  markSaleNotificationsRead,
  notify,
  notifyAboutMessage,
  notifyNewListing,
} from "./notifications";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

describe("reading notifications (messaging spec 3.5)", () => {
  it("lists an account's notifications, newest first, saying which are new, and no one else's", async () => {
    expect(await getNotifications("acc-student", 50)).toEqual([
      {
        id: "note-s2",
        kind: "sale-to-confirm",
        text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
        href: "/messages/conv-s2",
        createdAt: "2026-10-13T15:00:00.000Z",
        isNew: true,
      },
      {
        id: "note-s1",
        kind: "message",
        text: "Tech corner replied about Gaming headset, barely used",
        href: "/messages/conv-s1",
        createdAt: "2026-10-13T09:05:00.000Z",
        isNew: true,
      },
    ]);
    expect((await getNotifications("acc-seller", 50)).map((item) => item.isNew)).toEqual([false, false]);
    expect(await getNotifications("acc-mentor", 50)).toEqual([]);
  });

  it("shows at most the number asked for (plan decision 12)", async () => {
    expect((await getNotifications("acc-student", 1)).map((item) => item.id)).toEqual(["note-s2"]);
  });

  it("counts the new ones, for the header's badge (spec 2.9)", async () => {
    expect(await countNewNotifications("acc-student")).toBe(2);
    expect(await countNewNotifications("acc-seller")).toBe(0);
    expect(await countNewNotifications("acc-nope")).toBe(0);
  });

  it("hands out copies", async () => {
    const [first] = await getNotifications("acc-student", 50);
    first.text = "Changed";
    expect(sampleStore().notifications.get("note-s2")?.text).toMatch(/^Tech corner marked/);
  });
});

describe("making notifications (plan decisions 12 and 13)", () => {
  it("updates the conversation's unread message notification instead of adding another", async () => {
    await notifyAboutMessage({
      accountId: "acc-student",
      conversationId: "conv-s1",
      text: "Tech corner replied about Gaming headset, barely used",
      href: "/messages/conv-s1",
      now: NOW,
    });
    expect(await countNewNotifications("acc-student")).toBe(2);
    expect(sampleStore().notifications.get("note-s1")?.createdAt).toBe(NOW.toISOString());
    expect((await getNotifications("acc-student", 50))[0].id).toBe("note-s1");
  });

  it("adds a new one once the last has been read", async () => {
    await notifyAboutMessage({
      accountId: "acc-seller",
      conversationId: "conv-s1",
      text: "Thandi replied about Gaming headset, barely used",
      href: "/messages/conv-s1",
      now: NOW,
    });
    const [newest] = await getNotifications("acc-seller", 50);
    expect(newest).toMatchObject({ kind: "message", text: "Thandi replied about Gaming headset, barely used", isNew: true });
    expect(newest.id).toMatch(/^note-[0-9a-f-]{36}$/);
    expect(sampleStore().notifications.size).toBe(5);
  });

  it("adds a notification of any kind with its own link", async () => {
    await notify({
      accountId: "acc-mentor",
      kind: "sale-to-confirm",
      subjectId: "conv-x",
      text: "A sentence",
      href: "/messages/conv-x",
      now: NOW,
    });
    expect(await getNotifications("acc-mentor", 50)).toMatchObject([
      { kind: "sale-to-confirm", text: "A sentence", href: "/messages/conv-x", createdAt: NOW.toISOString(), isNew: true },
    ]);
  });
});

describe("marking notifications read (messaging spec 2.9)", () => {
  it("marks every one of the account's read when /notifications opens, and no one else's", async () => {
    await notify({ accountId: "acc-seller", kind: "message", subjectId: "conv-x", text: "x", href: "/messages/conv-x", now: NOW });
    await markNotificationsRead("acc-student", NOW);
    expect(await countNewNotifications("acc-student")).toBe(0);
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBe(NOW.toISOString());
    expect(await countNewNotifications("acc-seller")).toBe(1);
  });

  it("marks only a conversation's sale-to-confirm notification read when its sale is settled (amendment 3)", async () => {
    await notify({ accountId: "acc-student", kind: "message", subjectId: "conv-s2", text: "x", href: "/messages/conv-s2", now: NOW });
    await markSaleNotificationsRead("acc-seller", "conv-s2", NOW);
    await markSaleNotificationsRead("acc-student", "conv-s1", NOW);
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBeNull();
    await markSaleNotificationsRead("acc-student", "conv-s2", NOW);
    expect((await getNotifications("acc-student", 50)).map((item) => [item.kind, item.href, item.isNew])).toEqual([
      ["message", "/messages/conv-s2", true],
      ["sale-to-confirm", "/messages/conv-s2", false],
      ["message", "/messages/conv-s1", true],
    ]);
  });

  it("marks one conversation's read when its thread opens", async () => {
    await markConversationNotificationsRead("acc-student", "conv-s1", NOW);
    expect((await getNotifications("acc-student", 50)).map((item) => [item.id, item.isNew])).toEqual([
      ["note-s2", true],
      ["note-s1", false],
    ]);
  });
});

describe("deleting and exporting (plan decisions 14 and 15)", () => {
  it("deletes an account's notifications, and everyone's about the conversations it was in", async () => {
    await notify({ accountId: "acc-mentor", kind: "message", subjectId: "conv-x", text: "x", href: "/messages/conv-x", now: NOW });
    await deleteNotifications({ accountId: "acc-student", subjectIds: new Set(["conv-s1", "conv-s2"]) });
    expect([...sampleStore().notifications.values()].map((row) => row.subjectId)).toEqual(["conv-x"]);
  });

  it("exports the account's notifications as sentences and times, newest first, with no ids", async () => {
    const data = await exportNotifications("acc-student");
    expect(data).toEqual([
      {
        text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
        at: "2026-10-13T15:00:00.000Z",
        read: false,
      },
      { text: "Tech corner replied about Gaming headset, barely used", at: "2026-10-13T09:05:00.000Z", read: false },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/note-|acc-|conv-/);
  });
});

describe("notifications about things that have gone (community actions plan decisions 6 and 21)", () => {
  it("deletes everyone's of one kind about those things, and nothing else", async () => {
    const at = new Date("2026-10-14T08:42:00.000Z");
    await notify({ accountId: "acc-student", kind: "request-update", subjectId: "r-a", text: "A", href: "/", now: at });
    await notify({ accountId: "acc-mentor", kind: "request-update", subjectId: "r-a", text: "B", href: "/", now: at });
    await notify({ accountId: "acc-student", kind: "request-update", subjectId: "r-b", text: "C", href: "/", now: at });
    await notify({ accountId: "acc-student", kind: "offer", subjectId: "r-a", text: "D", href: "/", now: at });
    await deleteNotificationsAbout("request-update", new Set(["r-a"]));
    expect((await getNotifications("acc-student", 50)).map((item) => item.text)).toEqual(
      expect.arrayContaining(["C", "D"]),
    );
    expect((await getNotifications("acc-student", 50)).map((item) => item.text)).not.toContain("A");
    expect((await getNotifications("acc-mentor", 50)).map((item) => item.text)).not.toContain("B");
  });
});

describe("a followed shop's new listings (community actions spec 2.19, plan decision 15)", () => {
  const SHOP = { accountId: "acc-mentor", sellerSlug: "tech-corner", shopName: "Tech corner" };
  // 10:00 and 18:00 on Wednesday 14 October in SAST, then 00:01 on Thursday.
  const morning = new Date("2026-10-14T08:00:00.000Z");
  const evening = new Date("2026-10-14T16:00:00.000Z");
  const nextDay = new Date("2026-10-14T22:01:00.000Z");
  const newListings = async () =>
    (await getNotifications("acc-mentor", 50)).filter((item) => item.kind === "new-listing");

  it("names the first new listing of the day, linking to it", async () => {
    await notifyNewListing({ ...SHOP, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" }, now: morning });
    expect(await newListings()).toMatchObject([
      { text: "Tech corner listed Casio fx-991ZA Plus calculator", href: "/listings/l-001", isNew: true },
    ]);
  });

  it("updates it while it's unread, linking to the shop and moving it to the top", async () => {
    await notifyNewListing({ ...SHOP, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" }, now: morning });
    await notifyNewListing({ ...SHOP, listing: { id: "l-007", title: "Gaming headset, barely used" }, now: evening });
    await notifyNewListing({ ...SHOP, listing: { id: "l-016", title: "Desk lamp" }, now: evening });
    expect(await newListings()).toMatchObject([
      { text: "Tech corner listed 3 new things", href: "/sellers/tech-corner", createdAt: evening.toISOString() },
    ]);
  });

  it("makes no more that day once it's read, and a new one the next SAST day", async () => {
    await notifyNewListing({ ...SHOP, listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" }, now: morning });
    await markNotificationsRead("acc-mentor", morning);
    await notifyNewListing({ ...SHOP, listing: { id: "l-007", title: "Gaming headset, barely used" }, now: evening });
    expect(await newListings()).toHaveLength(1);
    await notifyNewListing({ ...SHOP, listing: { id: "l-016", title: "Desk lamp" }, now: nextDay });
    expect((await newListings()).map((item) => item.text)).toEqual([
      "Tech corner listed Desk lamp",
      "Tech corner listed Casio fx-991ZA Plus calculator",
    ]);
  });
});
