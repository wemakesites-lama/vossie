import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "./accounts";
import {
  confirmSale,
  countConversationsStartedSince,
  countMessagesSentSince,
  exportConversations,
  findConversation,
  forgetAccountInMessaging,
  getInbox,
  getThread,
  markCompleted,
  markThreadRead,
  type NewOffer,
  rejectSale,
  sendMessage,
  startConversation,
  startOffer,
  unreadCounts,
} from "./messages";
import { getNotifications } from "./notifications";
import { createRequest, getOwnRequest, hideRequest, updateRequest } from "./requests";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-14T08:42:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const CALCULATOR = { id: "l-001", title: "Casio fx-991ZA Plus calculator" };
const LAMP = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

beforeEach(() => {
  resetSampleStore();
});

/** A new buyer, as a first sign-in makes one (D Task 3). */
async function newBuyer(firstName = "Ayanda") {
  return createAccount({ email: `${firstName.toLowerCase()}@eduvos.com`, firstName, campusSlug: "pretoria", now: NOW });
}

/** Ayanda asks Tech corner about the calculator. */
async function ayandaAsks(body = "Hi! Is it still available?") {
  const buyer = await newBuyer();
  const { conversationId } = await startConversation({
    buyerId: buyer.id,
    listing: CALCULATOR,
    sellerSlug: "tech-corner",
    body,
    swapOffer: null,
    now: NOW,
  });
  return { buyer, conversationId };
}

describe("starting a conversation (messaging spec 2.1, 2.2 and 2.4)", () => {
  it("makes an Asked conversation with the message and its swap offer, and tells the shop's owner", async () => {
    const buyer = await newBuyer();
    const result = await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-007", title: "Gaming headset, barely used" },
      sellerSlug: "tech-corner",
      body: "Would you swap?",
      swapOffer: "A mechanical keyboard",
      now: NOW,
    });
    expect(result.created).toBe(true);
    expect(result.conversationId).toMatch(/^conv-[0-9a-f-]{36}$/);
    expect(sampleStore().conversations.get(result.conversationId)).toMatchObject({
      listingId: "l-007",
      listingTitle: "Gaming headset, barely used",
      sellerSlug: "tech-corner",
      buyerId: buyer.id,
      status: "asked",
      createdAt: NOW.toISOString(),
      lastMessageAt: NOW.toISOString(),
      firstReplyAt: null,
    });
    const thread = await getThread(result.conversationId, buyer.id, NOW);
    expect(thread?.messages).toMatchObject([{ fromViewer: true, body: "Would you swap?", swapOffer: "A mechanical keyboard" }]);
    expect((await getNotifications("acc-seller", 50))[0]).toMatchObject({
      kind: "message",
      text: "Ayanda asked about Gaming headset, barely used",
      href: `/messages/${result.conversationId}`,
      isNew: true,
    });
  });

  it("adds a second first message to the same listing's conversation (plan decision 5)", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    const again = await startConversation({
      buyerId: buyer.id,
      listing: CALCULATOR,
      sellerSlug: "tech-corner",
      body: "Hello?",
      swapOffer: null,
      now: later(5),
    });
    expect(again).toEqual({ conversationId, created: false });
    expect((await getThread(conversationId, buyer.id, NOW))?.messages.map((message) => message.body)).toEqual([
      "Hi! Is it still available?",
      "Hello?",
    ]);
    const other = await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-007", title: "Gaming headset, barely used" },
      sellerSlug: "tech-corner",
      body: "And this?",
      swapOffer: null,
      now: NOW,
    });
    expect(other.created).toBe(true);
  });

  it("keeps one question-to-the-shop conversation per buyer and shop, apart from its listings (plan decision 2)", async () => {
    const buyer = await newBuyer();
    const question = { buyerId: buyer.id, listing: null, sellerSlug: "tech-corner", swapOffer: null, now: NOW };
    const first = await startConversation({ ...question, body: "Do you fix screens?" });
    const second = await startConversation({ ...question, body: "Or batteries?" });
    expect(second).toEqual({ conversationId: first.conversationId, created: false });
    expect(await findConversation(buyer.id, { kind: "shop", sellerSlug: "tech-corner" })).toBe(first.conversationId);
    expect(await findConversation(buyer.id, { kind: "listing", listingId: "l-001" })).toBeNull();
    // Nobody has replied yet, so the second question is still a question (messaging plan amendment 3, fix 4).
    expect((await getNotifications("acc-seller", 50))[0].text).toBe("Ayanda asked your shop a question");
    await sendMessage({ conversationId: first.conversationId, accountId: "acc-seller", body: "Yes we do.", now: later(1) });
    await startConversation({ ...question, body: "And batteries?", now: later(2) });
    expect((await getNotifications("acc-seller", 50))[0].text).toBe("Ayanda replied");
  });

  it("stores a message to a shop with no owner yet, and tells no one (plan decision 1)", async () => {
    const buyer = await newBuyer();
    const before = sampleStore().notifications.size;
    const { conversationId } = await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-002", title: "Intro to Financial Accounting, 4th edition" },
      sellerSlug: "book-swap",
      body: "Is it the 4th edition?",
      swapOffer: null,
      now: NOW,
    });
    expect(sampleStore().conversations.has(conversationId)).toBe(true);
    expect(sampleStore().notifications.size).toBe(before);
  });
});

describe("replies and the sale's status (messaging spec 2.5, plan decision 30)", () => {
  it("moves Asked to Replied on the seller's first reply, keeps its time, and tells the buyer", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    expect(await sendMessage({ conversationId, accountId: buyer.id, body: "Anyone there?", now: later(1) })).toBe("sent");
    expect(sampleStore().conversations.get(conversationId)?.status).toBe("asked");
    expect(await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(30) })).toBe("sent");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Still here.", now: later(40) });
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({
      status: "replied",
      firstReplyAt: later(30).toISOString(),
      lastMessageAt: later(40).toISOString(),
    });
    expect(await getNotifications(buyer.id, 50)).toMatchObject([
      { text: "Tech corner replied about Casio fx-991ZA Plus calculator", isNew: true, createdAt: later(40).toISOString() },
    ]);
  });

  it("says the buyer \"asked\" until someone has replied, then \"replied\" (messaging plan amendment 3, fix 4)", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    await sendMessage({ conversationId, accountId: buyer.id, body: "Anyone there?", now: later(1) });
    expect((await getNotifications("acc-seller", 50))[0]).toMatchObject({
      text: "Ayanda asked about Casio fx-991ZA Plus calculator",
      createdAt: later(1).toISOString(),
    });
    await startConversation({
      buyerId: buyer.id,
      listing: CALCULATOR,
      sellerSlug: "tech-corner",
      body: "Hello?",
      swapOffer: null,
      now: later(2),
    });
    expect((await getNotifications("acc-seller", 50))[0].text).toBe("Ayanda asked about Casio fx-991ZA Plus calculator");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(3) });
    await sendMessage({ conversationId, accountId: buyer.id, body: "Great, thanks.", now: later(4) });
    expect((await getNotifications("acc-seller", 50))[0].text).toBe("Ayanda replied about Casio fx-991ZA Plus calculator");
  });

  it("lets only the buyer and the shop's owner write, and no one write to a side that has left", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    expect(await sendMessage({ conversationId, accountId: "acc-mentor", body: "Hi", now: NOW })).toBe("not-found");
    expect(await sendMessage({ conversationId: "conv-nope", accountId: buyer.id, body: "Hi", now: NOW })).toBe("not-found");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await forgetAccountInMessaging(buyer.id, null);
    expect(await sendMessage({ conversationId, accountId: "acc-seller", body: "Hi", now: later(2) })).toBe("closed");
  });

  it("lets only the seller mark it completed, once there's been a reply, and asks the buyer to confirm", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(1) })).toBe("not-allowed");
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes.", now: later(2) });
    expect(await markCompleted({ conversationId, accountId: buyer.id, now: later(3) })).toBe("not-allowed");
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(4) })).toBe("done");
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(5) })).toBe("not-allowed");
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({
      status: "done",
      completedAt: later(4).toISOString(),
    });
    expect((await getNotifications(buyer.id, 50))[0]).toMatchObject({
      kind: "sale-to-confirm",
      text: "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
    });
  });

  it("lets only the buyer confirm a sale marked done", async () => {
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-seller", now: NOW })).toBe("not-allowed");
    expect(await confirmSale({ conversationId: "conv-s1", accountId: "acc-student", now: NOW })).toBe("not-allowed");
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: NOW })).toBe("done");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      status: "confirmed",
      confirmedAt: NOW.toISOString(),
      confirmedBy: "buyer",
    });
  });

  it("reopens it as Replied when the buyer says it didn't happen, and it can be marked again", async () => {
    expect(await rejectSale({ conversationId: "conv-s2", accountId: "acc-student", now: NOW })).toBe("done");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({ status: "replied", completedAt: null });
    expect(await rejectSale({ conversationId: "conv-s2", accountId: "acc-student", now: NOW })).toBe("not-allowed");
    expect(await markCompleted({ conversationId: "conv-s2", accountId: "acc-seller", now: later(1) })).toBe("done");
  });

  it("confirms a sale itself 7 days after it was marked done, when it's next read", async () => {
    const due = new Date("2026-10-20T15:00:00.000Z");
    await getThread("conv-s2", "acc-student", new Date(due.getTime() - 60_000));
    expect(sampleStore().conversations.get("conv-s2")?.status).toBe("done");
    expect((await getInbox("acc-student", "buying", due)).find((row) => row.id === "conv-s2")?.status).toBe("confirmed");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      confirmedAt: due.toISOString(),
      confirmedBy: "auto",
    });
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: due })).toBe("not-allowed");
  });

  it("marks the sale-to-confirm notification read when the buyer confirms, and no message notification (amendment 3, fix 3)", async () => {
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBeNull();
    await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: later(5) });
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBe(later(5).toISOString());
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBeNull();
    expect((await unreadCounts("acc-student", later(5))).notifications).toBe(1);
  });

  it("marks the sale-to-confirm notification read when the buyer says it didn't happen, and asks again if it's marked again", async () => {
    await rejectSale({ conversationId: "conv-s2", accountId: "acc-student", now: later(5) });
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBe(later(5).toISOString());
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBeNull();
    await markCompleted({ conversationId: "conv-s2", accountId: "acc-seller", now: later(10) });
    const [newest] = await getNotifications("acc-student", 50);
    expect(newest).toMatchObject({ kind: "sale-to-confirm", isNew: true, createdAt: later(10).toISOString() });
    expect(newest.id).not.toBe("note-s2");
    expect((await unreadCounts("acc-student", later(10))).notifications).toBe(2);
  });

  it("marks the sale-to-confirm notification read when the sale confirms itself, wherever that's noticed", async () => {
    const due = new Date("2026-10-20T15:00:00.000Z");
    await getThread("conv-s2", "acc-student", new Date(due.getTime() - 60_000));
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBeNull();
    expect(await unreadCounts("acc-student", due)).toMatchObject({ notifications: 1, salesToConfirm: 0 });
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBe(due.toISOString());
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBeNull();
  });

  it("marks it read when the inbox, the thread or a reply is what notices the sale confirmed itself", async () => {
    const due = new Date("2026-10-20T15:00:00.000Z");
    await getInbox("acc-student", "buying", due);
    expect(sampleStore().notifications.get("note-s2")?.readAt).not.toBeNull();
    resetSampleStore();
    await getThread("conv-s2", "acc-seller", due);
    expect(sampleStore().notifications.get("note-s2")?.readAt).not.toBeNull();
    resetSampleStore();
    await sendMessage({ conversationId: "conv-s2", accountId: "acc-seller", body: "Thanks!", now: due });
    expect(sampleStore().notifications.get("note-s2")?.readAt).not.toBeNull();
  });
});

describe("the inbox (messaging spec 2.10, 2.11 and 3.2)", () => {
  it("lists the buyer's conversations, newest first, with the shop's name, the listing and what's new", async () => {
    expect(await getInbox("acc-student", "buying", NOW)).toEqual([
      {
        id: "conv-s1",
        role: "buyer",
        otherName: "Tech corner",
        listingTitle: "Gaming headset, barely used",
        requestTitle: null,
        image: { src: "/placeholders/listing/tech.svg", alt: "Gaming headset, barely used" },
        preview: "Hi Thandi, it is. Can I see the speaker first?",
        lastFromViewer: false,
        lastMessageAt: "2026-10-13T09:05:00.000Z",
        status: "replied",
        unread: true,
      },
      {
        id: "conv-s2",
        role: "buyer",
        otherName: "Tech corner",
        listingTitle: "Casio fx-991ZA Plus calculator",
        requestTitle: null,
        image: { src: "/placeholders/listing/tech.svg", alt: "Casio fx-991ZA Plus calculator" },
        preview: "Perfect, see you there.",
        lastFromViewer: true,
        lastMessageAt: "2026-10-12T16:30:00.000Z",
        status: "done",
        unread: false,
      },
    ]);
    expect(await getInbox("acc-student", "selling", NOW)).toEqual([]);
  });

  it("shows the seller the buyer's first name, never their email (spec 2.11)", async () => {
    const selling = await getInbox("acc-seller", "selling", NOW);
    expect(selling.map((row) => [row.id, row.otherName, row.unread])).toEqual([
      ["conv-s1", "Thandi", false],
      ["conv-s2", "Thandi", false],
    ]);
    expect(JSON.stringify(selling)).not.toContain("@");
    expect(await getInbox("acc-seller", "buying", NOW)).toEqual([]);
  });

  it("shows a question to the shop with the shop's photo and no listing (plan decision 2)", async () => {
    const buyer = await newBuyer();
    await startConversation({
      buyerId: buyer.id,
      listing: null,
      sellerSlug: "tech-corner",
      body: "Do you fix screens?",
      swapOffer: null,
      now: NOW,
    });
    const [row] = await getInbox(buyer.id, "buying", NOW);
    expect(row).toMatchObject({ listingTitle: null, preview: "Do you fix screens?", lastFromViewer: true });
    expect(row.image?.src).toBe("/placeholders/seller/tech-corner.svg");
  });
});

describe("a thread (messaging spec 3.3 and section 5)", () => {
  it("gives the messages oldest first, each with who wrote it, and the listing and shop", async () => {
    const thread = (await getThread("conv-s1", "acc-student", NOW))!;
    expect(thread).toMatchObject({
      id: "conv-s1",
      role: "buyer",
      otherName: "Tech corner",
      otherPresent: true,
      shop: { slug: "tech-corner", name: "Tech corner", campusSlug: "midrand" },
      listingTitle: "Gaming headset, barely used",
      listing: { id: "l-007", payMode: "both" },
      status: "replied",
    });
    expect(thread.messages.map((message) => [message.author, message.fromViewer, message.swapOffer])).toEqual([
      ["You", true, "A JBL Go 3 Bluetooth speaker, about a year old"],
      ["Tech corner", false, null],
    ]);
    expect((await getThread("conv-s1", "acc-seller", NOW))?.messages.map((message) => message.author)).toEqual([
      "Thandi",
      "You",
    ]);
  });

  it("is only for the buyer and the shop's owner: anyone else, or an unknown id, gets nothing (spec 3.3)", async () => {
    expect(await getThread("conv-s1", "acc-mentor", NOW)).toBeNull();
    expect(await getThread("conv-s1", "acc-pending", NOW)).toBeNull();
    expect(await getThread("conv-nope", "acc-student", NOW)).toBeNull();
  });

  it("marks the other side's messages and the thread's notifications read when it's opened", async () => {
    await markThreadRead("conv-s1", "acc-student", NOW);
    expect(sampleStore().messages.get("msg-s2")?.readAt).toBe(NOW.toISOString());
    expect(sampleStore().messages.get("msg-s1")?.readAt).toBe("2026-10-13T09:01:00.000Z");
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBe(NOW.toISOString());
    expect(sampleStore().notifications.get("note-s2")?.readAt).toBeNull();
    await markThreadRead("conv-s1", "acc-mentor", NOW);
  });
});

describe("what needs attention (messaging spec section 4)", () => {
  it("counts new notifications, unread conversations and messages, and sales to confirm", async () => {
    expect(await unreadCounts("acc-student", NOW)).toEqual({
      notifications: 2,
      conversations: 1,
      messages: 1,
      salesToConfirm: 1,
    });
    expect(await unreadCounts("acc-seller", NOW)).toEqual({
      notifications: 0,
      conversations: 0,
      messages: 0,
      salesToConfirm: 0,
    });
    await markThreadRead("conv-s1", "acc-student", NOW);
    expect(await unreadCounts("acc-student", NOW)).toMatchObject({ notifications: 1, conversations: 0, messages: 0 });
  });
});

describe("deleting an account (plan decision 14)", () => {
  it("removes a buyer's messages and keeps the seller's side, which no one can reply to", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await forgetAccountInMessaging(buyer.id, null);
    const thread = (await getThread(conversationId, "acc-seller", NOW))!;
    expect(thread).toMatchObject({ otherName: "Deleted account", otherPresent: false });
    expect(thread.messages.map((message) => message.body)).toEqual(["Yes, it is."]);
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({ buyerId: null, firstReplyAt: later(1).toISOString() });
    expect([...sampleStore().notifications.values()].some((row) => row.subjectId === conversationId)).toBe(false);
  });

  it("won't let the seller mark it completed once the buyer has left (messaging plan amendment 3, fix 1)", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await forgetAccountInMessaging(buyer.id, null);
    expect(await markCompleted({ conversationId, accountId: "acc-seller", now: later(2) })).toBe("not-allowed");
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({ status: "replied", completedAt: null });
    expect([...sampleStore().notifications.values()].some((row) => row.subjectId === conversationId)).toBe(false);
  });

  it("puts a sale waiting for the deleted buyer back to Replied, forgets the completion and never confirms it", async () => {
    await forgetAccountInMessaging("acc-student", null);
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      buyerId: null,
      status: "replied",
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    });
    const afterTheSevenDays = new Date("2026-11-01T10:00:00.000Z");
    expect((await getThread("conv-s2", "acc-seller", afterTheSevenDays))?.status).toBe("replied");
    expect((await getInbox("acc-seller", "selling", afterTheSevenDays)).map((row) => [row.id, row.status])).toEqual([
      ["conv-s1", "replied"],
      ["conv-s2", "replied"],
    ]);
    expect(await markCompleted({ conversationId: "conv-s2", accountId: "acc-seller", now: afterTheSevenDays })).toBe(
      "not-allowed",
    );
  });

  it("leaves a sale that is already confirmed, and the conversation's times, as they were", async () => {
    await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: later(5) });
    await forgetAccountInMessaging("acc-student", null);
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      buyerId: null,
      status: "confirmed",
      completedAt: "2026-10-13T15:00:00.000Z",
      confirmedAt: later(5).toISOString(),
      confirmedBy: "buyer",
      firstReplyAt: "2026-10-12T10:48:00.000Z",
    });
  });

  it("clears when the other side read what's left, which was when the deleted person read it (fix 8)", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await markThreadRead(conversationId, buyer.id, later(2));
    const [reply] = [...sampleStore().messages.values()].filter((row) => row.from === "seller" && row.conversationId === conversationId);
    expect(reply.readAt).toBe(later(2).toISOString());
    await forgetAccountInMessaging(buyer.id, null);
    expect(sampleStore().messages.get(reply.id)).toMatchObject({ from: "seller", readAt: null });
  });

  it("clears the buyer's remaining messages' readAt when the seller is the one who leaves", async () => {
    for (const id of ["msg-s1", "msg-s3", "msg-s5"]) {
      expect(sampleStore().messages.get(id)?.readAt, id).not.toBeNull();
    }
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect([...sampleStore().messages.values()].map((row) => [row.id, row.readAt])).toEqual([
      ["msg-s1", null],
      ["msg-s3", null],
      ["msg-s5", null],
    ]);
  });

  it("removes a seller's messages and keeps the buyer's side", async () => {
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    const thread = (await getThread("conv-s1", "acc-student", NOW))!;
    expect(thread).toMatchObject({ otherName: "Deleted account", otherPresent: false });
    expect(thread.messages.map((message) => message.author)).toEqual(["You"]);
    expect(await getNotifications("acc-student", 50)).toEqual([]);
  });

  it("puts a Done sale back to Replied when the seller leaves, and it never confirms itself (messaging plan amendment 6, fix 2)", async () => {
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({ status: "done", sellerGone: false });
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      sellerGone: true,
      status: "replied",
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    });
    const afterTheSevenDays = new Date("2026-11-01T10:00:00.000Z");
    expect((await getThread("conv-s2", "acc-student", afterTheSevenDays))?.status).toBe("replied");
    expect(await unreadCounts("acc-student", afterTheSevenDays)).toMatchObject({ salesToConfirm: 0 });
    expect(await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: afterTheSevenDays })).toBe(
      "not-allowed",
    );
  });

  it("leaves a sale that is already confirmed, and the conversation's times, when the seller leaves", async () => {
    await confirmSale({ conversationId: "conv-s2", accountId: "acc-student", now: later(5) });
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      sellerGone: true,
      status: "confirmed",
      completedAt: "2026-10-13T15:00:00.000Z",
      confirmedAt: later(5).toISOString(),
      confirmedBy: "buyer",
      firstReplyAt: "2026-10-12T10:48:00.000Z",
    });
  });

  it("leaves a Replied or Asked conversation's status alone when the seller leaves", async () => {
    const { buyer, conversationId } = await ayandaAsks();
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    expect(sampleStore().conversations.get(conversationId)).toMatchObject({ buyerId: buyer.id, status: "asked" });
    expect(sampleStore().conversations.get("conv-s1")).toMatchObject({ status: "replied" });
  });

  it("won't let the buyer confirm or reject a sale once the seller has left (messaging plan amendment 6, fix 2)", async () => {
    // Deleting the seller already undoes a Done sale; this is the rule behind it, for a Done sale that got here some other way.
    sampleStore().conversations.get("conv-s2")!.sellerGone = true;
    const change = { conversationId: "conv-s2", accountId: "acc-student", now: later(1) };
    expect(await confirmSale(change)).toBe("not-allowed");
    expect(await rejectSale(change)).toBe("not-allowed");
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({ status: "done", confirmedAt: null });
    expect(await getNotifications("acc-student", 50)).toContainEqual(
      expect.objectContaining({ kind: "sale-to-confirm", isNew: true }),
    );
  });

  it("removes a conversation once neither side is left, or nothing is left in it", async () => {
    await forgetAccountInMessaging("acc-seller", "tech-corner");
    await forgetAccountInMessaging("acc-student", null);
    expect(sampleStore().conversations.size).toBe(0);
    expect(sampleStore().messages.size).toBe(0);
    const buyer = await newBuyer();
    await startConversation({
      buyerId: buyer.id,
      listing: { id: "l-002", title: "Intro to Financial Accounting, 4th edition" },
      sellerSlug: "book-swap",
      body: "Hello",
      swapOffer: null,
      now: NOW,
    });
    await forgetAccountInMessaging(buyer.id, null);
    expect(sampleStore().conversations.size).toBe(0);
  });
});

describe("the data export (plan decision 15)", () => {
  it("gives each conversation with who, about what, its status and both sides' messages, oldest first, with no ids", async () => {
    const data = await exportConversations("acc-student", NOW);
    expect(data.map((row) => [row.with, row.about, row.status])).toEqual([
      ["Tech corner", "Casio fx-991ZA Plus calculator", "done"],
      ["Tech corner", "Gaming headset, barely used", "replied"],
    ]);
    expect(data[1].messages).toEqual([
      {
        from: "you",
        text: "Hi! Is the headset still available? I'd like to swap for it if you're open to that.",
        swapOffer: "A JBL Go 3 Bluetooth speaker, about a year old",
        sentAt: "2026-10-13T08:12:00.000Z",
      },
      {
        from: "them",
        text: "Hi Thandi, it is. Can I see the speaker first?\nI'm at the library entrance after 12:00 most days.",
        swapOffer: null,
        sentAt: "2026-10-13T09:05:00.000Z",
      },
    ]);
    expect(JSON.stringify(data)).not.toMatch(/conv-|msg-|acc-/);
    expect(await exportConversations("acc-mentor", NOW)).toEqual([]);
  });

  it("settles the 7-day auto-confirm first, so a sale that has confirmed itself isn't exported as done (fix 10)", async () => {
    const due = new Date("2026-10-20T15:00:00.000Z");
    expect((await exportConversations("acc-student", new Date(due.getTime() - 60_000))).map((row) => row.status)).toEqual([
      "done",
      "replied",
    ]);
    expect((await exportConversations("acc-student", due)).map((row) => row.status)).toEqual(["confirmed", "replied"]);
    expect(sampleStore().conversations.get("conv-s2")).toMatchObject({
      status: "confirmed",
      confirmedAt: due.toISOString(),
      confirmedBy: "auto",
    });
    expect((await exportConversations("acc-seller", due)).map((row) => row.status)).toEqual(["confirmed", "replied"]);
  });
});

describe("offers on Looking For requests (community actions spec 2.7 to 2.12)", () => {
  /** A posted request's fields as the edit form would send them back, for a change of one of them. */
  const requestFields = async (id: string) => {
    const request = (await getOwnRequest("acc-student", id))!.request;
    return {
      title: request.title,
      categorySlug: request.categorySlug,
      campusSlug: request.campusSlug,
      details: request.details,
      budgetZar: request.budgetZar,
      swapWelcome: request.swapWelcome,
      neededBy: request.neededBy,
    };
  };
  const OFFER_NOW = new Date("2026-10-14T08:42:00.000Z");
  const offer = (overrides: Partial<NewOffer> = {}) =>
    startOffer({
      askerId: "acc-student",
      request: { id: "r-001", title: "Accounting 1 tutor this week" },
      sellerSlug: "tech-corner",
      listing: null,
      body: "I passed Accounting 1 with 78%. Evenings work.",
      now: OFFER_NOW,
      ...overrides,
    });
  const messagesIn = (id: string) => [...sampleStore().messages.values()].filter((row) => row.conversationId === id);

  it("starts an Offered thread holding the shop's message, and tells the asker", async () => {
    const id = await offer();
    expect(sampleStore().conversations.get(id)).toMatchObject({
      status: "offered",
      buyerId: "acc-student",
      sellerSlug: "tech-corner",
      listingId: null,
      requestId: "r-001",
      requestTitle: "Accounting 1 tutor this week",
    });
    const thread = await getThread(id, "acc-student", OFFER_NOW);
    expect(thread).toMatchObject({
      role: "buyer",
      otherName: "Tech corner",
      status: "offered",
      request: { id: "r-001", title: "Accounting 1 tutor this week", live: true, hidden: false },
    });
    expect(thread?.messages).toMatchObject([
      { fromViewer: false, author: "Tech corner", body: "I passed Accounting 1 with 78%. Evenings work." },
    ]);
    expect((await getNotifications("acc-student", 1))[0]).toMatchObject({
      kind: "offer",
      text: "Tech corner offered to help with Accounting 1 tutor this week",
      href: `/messages/${id}`,
    });
  });

  it("makes one per shop per request: a second offer changes nothing", async () => {
    const id = await offer();
    expect(await offer({ body: "Me again." })).toBe(id);
    expect(messagesIn(id)).toHaveLength(1);
  });

  // Amendment 7: the find and the insert run with no await between them, so two sends at once make one thread.
  it("makes one even when it's sent twice at once", async () => {
    const [first, second] = await Promise.all([offer(), offer({ body: "Me again." })]);
    expect(second).toBe(first);
    expect([...sampleStore().conversations.values()].filter((row) => row.requestId === "r-001")).toHaveLength(1);
    expect(messagesIn(first)).toHaveLength(1);
    expect((await getNotifications("acc-student", 50)).filter((note) => note.kind === "offer")).toHaveLength(1);
  });

  it("can point to one of the shop's listings, shown as the thread's listing", async () => {
    const id = await offer({ listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" } });
    expect((await getThread(id, "acc-student", OFFER_NOW))?.listing?.id).toBe("l-001");
  });

  it("keeps the asker unnamed to the shop until they write, then uses their first name (spec 2.10)", async () => {
    const id = await offer();
    expect((await getThread(id, "acc-seller", OFFER_NOW))?.otherName).toBe("The student who asked");
    expect((await getInbox("acc-seller", "selling", OFFER_NOW)).find((row) => row.id === id)).toMatchObject({
      otherName: "The student who asked",
      requestTitle: "Accounting 1 tutor this week",
      status: "offered",
    });
    expect(await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes please!", now: OFFER_NOW })).toBe(
      "sent",
    );
    expect((await getThread(id, "acc-seller", OFFER_NOW))?.otherName).toBe("Thandi");
  });

  it("makes the shop wait for a reply, which moves Offered to Replied; only then can it be marked completed", async () => {
    const id = await offer();
    // Each step is a minute later, so "the newest notification" is the one that step made.
    const shop = (minutes: number) => ({ conversationId: id, accountId: "acc-seller", now: later(minutes) });
    expect(await sendMessage({ ...shop(1), body: "Still keen?" })).toBe("waiting");
    expect(messagesIn(id)).toHaveLength(1);
    expect(await markCompleted(shop(2))).toBe("not-allowed");
    await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes, Thursday.", now: later(3) });
    expect(sampleStore().conversations.get(id)?.status).toBe("replied");
    expect((await getNotifications("acc-seller", 1))[0].text).toBe("Thandi replied about Accounting 1 tutor this week");
    expect(await sendMessage({ ...shop(4), body: "Great, 18:00 at the library." })).toBe("sent");
    expect(await markCompleted(shop(5))).toBe("done");
    expect((await getNotifications("acc-student", 1))[0].text).toBe(
      "Tech corner marked Accounting 1 tutor this week as done. Did the sale happen?",
    );
  });

  it("is never found as an enquiry or a shop question (spec 2.9)", async () => {
    await offer({ askerId: "acc-mentor", listing: { id: "l-001", title: "Casio fx-991ZA Plus calculator" } });
    expect(await findConversation("acc-mentor", { kind: "listing", listingId: "l-001" })).toBeNull();
    expect(await findConversation("acc-mentor", { kind: "shop", sellerSlug: "tech-corner" })).toBeNull();
  });

  it("says when the request has gone, keeping its title", async () => {
    const id = await offer({ askerId: "acc-mentor" });
    sampleStore().requests.delete("r-001");
    expect((await getThread(id, "acc-mentor", OFFER_NOW))?.request).toEqual({
      id: "r-001",
      title: "Accounting 1 tutor this week",
      live: false,
      hidden: false,
    });
  });

  it("names the request in both sides' data exports, and the asker not at all", async () => {
    await offer();
    expect(
      (await exportConversations("acc-seller", OFFER_NOW)).find((row) => row.about === "Request: Accounting 1 tutor this week"),
    ).toMatchObject({ with: "The student who asked", status: "offered" });
    expect(
      (await exportConversations("acc-student", OFFER_NOW)).find(
        (row) => row.about === "Your request: Accounting 1 tutor this week",
      ),
    ).toMatchObject({ with: "Tech corner" });
  });

  // Plan amendment 17.4: the asker can rename a request, so the thread and the inbox read its title while it's up.
  it("shows the request's current title in the thread and both inboxes while it's up, the kept one once it isn't", async () => {
    const posted = await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: null,
      },
      now: OFFER_NOW,
    });
    const id = await offer({ request: { id: posted.id, title: posted.title } });
    const renamed = { ...(await requestFields(posted.id)), title: "Clip-on desk lamp" };
    expect(await updateRequest("acc-student", posted.id, renamed, later(5))).not.toBeNull();
    expect((await getThread(id, "acc-student", later(6)))?.request).toEqual({
      id: posted.id,
      title: "Clip-on desk lamp",
      live: true,
      hidden: false,
    });
    expect((await getInbox("acc-student", "buying", later(6))).find((row) => row.id === id)?.requestTitle).toBe(
      "Clip-on desk lamp",
    );
    expect((await getInbox("acc-seller", "selling", later(6))).find((row) => row.id === id)?.requestTitle).toBe(
      "Clip-on desk lamp",
    );
    // Once the Hub hides it (or it's deleted) its page is gone, and the thread keeps the title it had when it went up.
    await hideRequest(posted.id, "Not allowed.", later(7));
    expect((await getThread(id, "acc-student", later(8)))?.request).toEqual({
      id: posted.id,
      title: "Desk lamp for res",
      live: false,
      hidden: true,
    });
    expect((await getInbox("acc-student", "buying", later(8))).find((row) => row.id === id)?.requestTitle).toBe(
      "Desk lamp for res",
    );
  });

  // Plan amendment 17.5: in an offer thread the shop that has gone is "A closed shop", whoever's account it was.
  it("calls a shop that has gone 'A closed shop' in an offer thread everywhere, and keeps 'Deleted account' elsewhere", async () => {
    const id = await offer();
    // The asker answers, so the thread outlives the shop's owner (messaging plan decision 14).
    await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes please.", now: later(1) });
    // An ordinary enquiry to the same shop, which the same account deleting keeps as "Deleted account".
    const { buyer, conversationId } = await ayandaAsks();
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(2) });
    await sendMessage({ conversationId, accountId: buyer.id, body: "Great!", now: later(3) });
    await forgetAccountInMessaging("acc-seller", "tech-corner");

    expect(await getThread(id, "acc-student", later(4))).toMatchObject({ otherName: "A closed shop", otherPresent: false });
    expect((await getThread(id, "acc-student", later(4)))?.messages.map((message) => message.author)).toEqual(["You"]);
    expect((await getInbox("acc-student", "buying", later(4))).find((row) => row.id === id)?.otherName).toBe(
      "A closed shop",
    );
    expect((await exportConversations("acc-student", later(4))).find((row) => row.about?.startsWith("Your request"))?.with).toBe(
      "A closed shop",
    );

    expect(await getThread(conversationId, buyer.id, later(4))).toMatchObject({
      otherName: "Deleted account",
      otherPresent: false,
    });
    expect((await getInbox(buyer.id, "buying", later(4))).find((row) => row.id === conversationId)?.otherName).toBe(
      "Deleted account",
    );
  });

  // Plan amendment 19.3: a shop the Hub paused is still a shop with a name; only one that has gone is "A closed shop".
  it("uses the name of a shop the Hub paused in offer threads, the inbox, the export and the notifications", async () => {
    const id = await offer();
    await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes please.", now: later(1) });
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff" });
    expect(await sendMessage({ conversationId: id, accountId: "acc-seller", body: "Thursday?", now: later(2) })).toBe("sent");
    expect(await getThread(id, "acc-student", later(3))).toMatchObject({
      otherName: "Tech corner",
      otherPresent: true,
      shop: { slug: "tech-corner", name: "Tech corner" },
    });
    expect((await getInbox("acc-student", "buying", later(3))).find((row) => row.id === id)?.otherName).toBe("Tech corner");
    expect((await exportConversations("acc-student", later(3))).find((row) => row.about?.startsWith("Your request"))?.with).toBe(
      "Tech corner",
    );
    expect((await getNotifications("acc-student", 1))[0].text).toBe(
      "Tech corner replied about Accounting 1 tutor this week",
    );
    // It is the same shop in an ordinary enquiry.
    const { buyer, conversationId } = await ayandaAsks();
    expect((await getThread(conversationId, buyer.id, later(3)))?.otherName).toBe("Tech corner");
  });

  // Plan amendment 19.4: the Hub hid it, which is not the same as the asker taking it down.
  it("says a request is hidden, as against gone, so the thread can tell the asker the Hub hid it", async () => {
    const id = await offer({ askerId: "acc-mentor" });
    expect((await getThread(id, "acc-mentor", later(1)))?.request).toMatchObject({ live: true, hidden: false });
    await hideRequest("r-001", "Not allowed.", later(2));
    expect((await getThread(id, "acc-mentor", later(3)))?.request).toEqual({
      id: "r-001",
      title: "Accounting 1 tutor this week",
      live: false,
      hidden: true,
    });
    expect((await getThread(id, "acc-seller", later(3)))?.request).toMatchObject({ live: false, hidden: true });
    sampleStore().requests.delete("r-001");
    expect((await getThread(id, "acc-mentor", later(4)))?.request).toMatchObject({ live: false, hidden: false });
  });

  // Plan amendment 19.5: the notifications and the export read the request's title as the inbox and the thread do.
  it("names the request by its current title in reply and sale notifications and in both sides' exports", async () => {
    const posted = await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: 150,
        swapWelcome: false,
        neededBy: null,
      },
      now: OFFER_NOW,
    });
    const id = await offer({ request: { id: posted.id, title: posted.title } });
    const renamed = { ...(await requestFields(posted.id)), title: "Clip-on desk lamp" };
    expect(await updateRequest("acc-student", posted.id, renamed, later(1))).not.toBeNull();
    await sendMessage({ conversationId: id, accountId: "acc-student", body: "Yes, Thursday.", now: later(2) });
    expect((await getNotifications("acc-seller", 1))[0].text).toBe("Thandi replied about Clip-on desk lamp");
    await sendMessage({ conversationId: id, accountId: "acc-seller", body: "18:00 at the library.", now: later(3) });
    expect((await getNotifications("acc-student", 1))[0].text).toBe("Tech corner replied about Clip-on desk lamp");
    expect(await markCompleted({ conversationId: id, accountId: "acc-seller", now: later(4) })).toBe("done");
    expect((await getNotifications("acc-student", 1))[0].text).toBe(
      "Tech corner marked Clip-on desk lamp as done. Did the sale happen?",
    );
    const aboutOf = async (account: string, start: string) =>
      (await exportConversations(account, later(5))).map((row) => row.about).filter((about) => about?.startsWith(start));
    expect(await aboutOf("acc-student", "Your request")).toEqual(["Your request: Clip-on desk lamp"]);
    expect(await aboutOf("acc-seller", "Request")).toEqual(["Request: Clip-on desk lamp"]);
    // Once the request has gone, the title it had when it went up is the one that is left.
    sampleStore().requests.delete(posted.id);
    expect(await aboutOf("acc-student", "Your request")).toEqual(["Your request: Desk lamp for res"]);
  });
});

describe("counting what an account started and sent (stage K spec 4)", () => {
  const DAY_AGO = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
  const HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000);

  it("counts the conversations a buyer started after since: enquiries and shop questions, never offers", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    await startConversation({ buyerId: buyer.id, listing: null, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    // Joining the conversation it already has about the calculator starts nothing (messaging spec 2.2).
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Again", swapOffer: null, now: later(1) });
    const request = await createRequest({ askerId: buyer.id, fields: LAMP, now: NOW });
    await startOffer({ askerId: buyer.id, request: { id: request.id, title: request.title }, sellerSlug: "tech-corner", listing: null, body: "I can help.", now: NOW });
    expect(await countConversationsStartedSince(buyer.id, DAY_AGO)).toBe(2);
  });

  it("counts only conversations after since, strictly (the 24 hours slide)", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: DAY_AGO });
    expect(await countConversationsStartedSince(buyer.id, DAY_AGO)).toBe(0);
    expect(await countConversationsStartedSince(buyer.id, new Date(DAY_AGO.getTime() - 1))).toBe(1);
  });

  it("forgets a deleted buyer's conversations", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    await forgetAccountInMessaging(buyer.id, null);
    expect(await countConversationsStartedSince(buyer.id, DAY_AGO)).toBe(0);
  });

  it("counts a buyer's messages and a seller's messages through their shop, never the other side's", async () => {
    const buyer = await newBuyer();
    const { conversationId } = await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: NOW });
    await sendMessage({ conversationId, accountId: "acc-seller", body: "Yes, it is.", now: later(1) });
    await sendMessage({ conversationId, accountId: buyer.id, body: "Great.", now: later(2) });
    expect(await countMessagesSentSince(buyer.id, null, HOUR_AGO)).toBe(2);
    // The sample seller's own fixture conversations are older than the hour.
    expect(await countMessagesSentSince("acc-seller", "tech-corner", HOUR_AGO)).toBe(1);
    // The same account, asked about without its shop, counts only what it sent as a buyer.
    expect(await countMessagesSentSince("acc-seller", null, HOUR_AGO)).toBe(0);
  });

  it("counts an offer's first message for the shop that sent it", async () => {
    const asker = await newBuyer();
    const request = await createRequest({ askerId: asker.id, fields: LAMP, now: NOW });
    await startOffer({ askerId: asker.id, request: { id: request.id, title: request.title }, sellerSlug: "tech-corner", listing: null, body: "I can help.", now: NOW });
    expect(await countMessagesSentSince("acc-seller", "tech-corner", HOUR_AGO)).toBe(1);
    expect(await countMessagesSentSince(asker.id, null, HOUR_AGO)).toBe(0);
  });

  it("counts only messages after since, strictly (the hour slides)", async () => {
    const buyer = await newBuyer();
    await startConversation({ buyerId: buyer.id, listing: CALCULATOR, sellerSlug: "tech-corner", body: "Hi", swapOffer: null, now: HOUR_AGO });
    expect(await countMessagesSentSince(buyer.id, null, HOUR_AGO)).toBe(0);
    expect(await countMessagesSentSince(buyer.id, null, new Date(HOUR_AGO.getTime() - 1))).toBe(1);
  });
});
