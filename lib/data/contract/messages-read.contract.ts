import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getListingsByIds, getPickupPoints, getSeller } from "@/lib/data";
import {
  exportConversations,
  findConversation,
  getInbox,
  getThread,
  markThreadRead,
  unreadCounts,
} from "@/lib/data/messages";
import { getNotifications } from "@/lib/data/notifications";
import { saveOwnListing } from "@/lib/data/own-listings";
import { offerAbout, UNNAMED_ASKER } from "@/lib/looking-for/words";
import { threadPath } from "@/lib/messaging/paths";
import { autoConfirmAt } from "@/lib/messaging/rules";
import type { World, WorldMessage } from "@/tests/contract/world";

// Messages in both backends, the reads (C2/C3 plan Task 14, decisions 19, 20 and 24; messaging spec 2.5, 2.10, 2.11,
// 3.2, 3.3 and 4; community actions spec 2.10 and 2.11): the inbox on either side, a thread, reading it, the counts, the
// 7-day auto-confirm on read, finding a buyer's conversation, the export, and message text kept exactly as sent.
// "shopper" buys from "seller"'s shop, which the world opens; "asker" posts a request the shop offers on.
// messages-read.test.ts runs it on the sample store, messages-read.db.test.ts on the local stack.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const SHOP = "Contract corner";

export function messagesReadContract(makeWorld: () => World): void {
  let world: World;
  let seller: string;
  let slug: string;
  let listing: { id: string; title: string };
  let base: number;
  /** A minute apart from an hour ago, so no two messages share a time (the plan's risk 5). */
  const at = (minutes: number) => new Date(base - 60 * MINUTE + minutes * MINUTE);

  beforeEach(async () => {
    base = Date.now();
    world = makeWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    seller = await world.signedIn("seller");
    slug = await world.openShop("seller", { name: SHOP });
    const point = (await getPickupPoints()).find((p) => p.campusSlug === "pretoria")!.id;
    const saved = await world.asViewer("seller", () =>
      saveOwnListing({
        sellerSlug: slug,
        ownerId: seller,
        id: null,
        fields: {
          kind: "item",
          title: "Contract kettle",
          categorySlug: "res-living",
          condition: "good",
          priceZar: 90,
          priceIsFrom: false,
          payMode: "cash",
          swapFor: null,
          description: "A kettle the contract tests list.",
          handover: "pickup",
          pickupPointId: point,
        },
        photos: [],
        intent: "publish",
        now: new Date(),
      }),
    );
    listing = { id: saved!.id, title: saved!.title };
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** shopper's conversation about the listing: a question, then the shop's reply, unread. */
  const aboutListing = (messages: readonly WorldMessage[] = [
    { side: "buyer", body: "Is it still available?\nThanks", sentAt: at(1), readAt: at(2) },
    { side: "seller", body: "Yes, it is.\nCome by.", sentAt: at(3) },
  ]) => world.addConversation({ buyer: "shopper", slug, listingId: listing.id, messages });

  /** shopper's question to the shop. */
  const question = (sentAt = at(10)) =>
    world.addConversation({ buyer: "shopper", slug, messages: [{ side: "buyer", body: "Do you deliver?", sentAt }] });

  /** asker's request, and the shop's offer on it. */
  async function offer(): Promise<{ requestId: string; conversationId: string }> {
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: a kettle", neededBy: null });
    const conversationId = await world.addConversation({
      buyer: "asker",
      slug,
      offerOn: requestId,
      messages: [{ side: "seller", body: "We have one.\nR90.", sentAt: at(5) }],
    });
    return { requestId, conversationId };
  }

  it("shows the buyer's inbox newest activity first: the shop, the listing, the last line and what's unread", async () => {
    const first = await aboutListing();
    const second = await question();
    const inbox = await world.asViewer("shopper", (id) => getInbox(id, "buying", new Date()));
    expect(inbox.map((row) => row.id)).toEqual([second, first]);
    const [image] = (await getListingsByIds([listing.id])).map((row) => row.image);
    expect(inbox[1]).toEqual({
      id: first,
      role: "buyer",
      otherName: SHOP,
      listingTitle: listing.title,
      requestTitle: null,
      image,
      preview: "Yes, it is.",
      lastFromViewer: false,
      lastMessageAt: at(3).toISOString(),
      status: "replied",
      unread: true,
    });
    expect(inbox[0]).toMatchObject({
      otherName: SHOP,
      listingTitle: null,
      image: (await getSeller(slug))!.image,
      preview: "Do you deliver?",
      lastFromViewer: true,
      status: "asked",
      unread: false,
    });
    expect(await world.asViewer("shopper", (id) => getInbox(id, "selling", new Date()))).toEqual([]);
  });

  it("shows the shop's inbox: the buyer's first name, an asker unnamed until they write, and a deleted buyer", async () => {
    const enquiry = await aboutListing();
    const { conversationId } = await offer();
    const names = async () =>
      new Map((await world.asViewer("seller", (id) => getInbox(id, "selling", new Date()))).map((row) => [row.id, row.otherName]));
    expect(await names()).toEqual(new Map([[enquiry, "Shopper"], [conversationId, UNNAMED_ASKER]]));
    await world.addMessages(conversationId, "buyer", 1, at(20));
    expect((await names()).get(conversationId)).toBe("Asker");
    await world.buyerGone(enquiry);
    expect((await names()).get(enquiry)).toBe("Deleted account");
    const inbox = await world.asViewer("seller", (id) => getInbox(id, "selling", new Date()));
    expect(inbox[0]).toMatchObject({ id: conversationId, role: "seller", requestTitle: "Contract wanted: a kettle", unread: true });
  });

  it("names a shop the Hub paused in the buyer's inbox and thread (amendment 6)", async () => {
    const id = await aboutListing();
    await world.pauseShop(slug, "staff");
    const inbox = await world.asViewer("shopper", (account) => getInbox(account, "buying", new Date()));
    expect(inbox[0]).toMatchObject({ id, otherName: SHOP });
    const thread = await world.asViewer("shopper", (account) => getThread(id, account, new Date()));
    expect(thread).toMatchObject({ otherName: SHOP, shop: { slug, name: SHOP } });
  });

  it("opens a thread only for its two sides: messages oldest first, with who wrote each", async () => {
    const id = await aboutListing();
    expect(await world.asViewer("asker", (account) => getThread(id, account, new Date()))).toBeNull();
    expect(await world.asViewer("shopper", (account) => getThread(randomUUID(), account, new Date()))).toBeNull();
    const thread = (await world.asViewer("shopper", (account) => getThread(id, account, new Date())))!;
    expect(thread).toMatchObject({
      id,
      role: "buyer",
      otherName: SHOP,
      otherPresent: true,
      shop: { slug, name: SHOP, campusSlug: "pretoria" },
      listingTitle: listing.title,
      listing: { id: listing.id, title: listing.title },
      request: null,
      status: "replied",
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    });
    expect(thread.messages).toEqual([
      { id: expect.any(String), fromViewer: true, author: "You", body: "Is it still available?\nThanks", swapOffer: null, sentAt: at(1).toISOString() },
      { id: expect.any(String), fromViewer: false, author: SHOP, body: "Yes, it is.\nCome by.", swapOffer: null, sentAt: at(3).toISOString() },
    ]);
    await world.sellerGone(id);
    expect(await world.asViewer("shopper", (account) => getThread(id, account, new Date()))).toMatchObject({
      otherName: "Deleted account",
      otherPresent: false,
    });
  });

  it("tells the asker an offer's request is up, and that the Hub hid it once it has", async () => {
    const { requestId, conversationId } = await offer();
    const read = () => world.asViewer("asker", (account) => getThread(conversationId, account, new Date()));
    expect((await read())!.request).toEqual({ id: requestId, title: "Contract wanted: a kettle", live: true, hidden: false });
    expect((await read())!.otherName).toBe(SHOP);
    await world.hideRequest(requestId, "Not allowed.");
    expect((await read())!.request).toEqual({ id: requestId, title: "Contract wanted: a kettle", live: false, hidden: true });
  });

  it("reads a thread: the other side's messages and the account's notifications about it", async () => {
    const id = await aboutListing();
    await world.addNotification("shopper", { kind: "message", subjectId: id, text: `${SHOP} replied about ${listing.title}`, href: threadPath(id) });
    await world.asViewer("shopper", (account) => markThreadRead(id, account, new Date()));
    const inbox = await world.asViewer("shopper", (account) => getInbox(account, "buying", new Date()));
    expect(inbox[0].unread).toBe(false);
    expect((await world.asViewer("shopper", (account) => getNotifications(account, 10))).map((note) => note.isNew)).toEqual([false]);
  });

  it("counts what needs the account's attention", async () => {
    await aboutListing([
      { side: "buyer", body: "Hello?", sentAt: at(1) },
      { side: "seller", body: "One", sentAt: at(2) },
      { side: "seller", body: "Two", sentAt: at(3) },
      { side: "seller", body: "Three", sentAt: at(4) },
    ]);
    const other = await question(at(5));
    await world.addMessages(other, "seller", 1, at(6));
    await world.addNotification("shopper", { kind: "booking", subjectId: "contract-b", text: "A booking", href: "/hub" });
    expect(await world.asViewer("shopper", (account) => unreadCounts(account, new Date()))).toEqual({
      notifications: 1,
      conversations: 2,
      messages: 4,
      salesToConfirm: 0,
    });
    expect(await world.asViewer("seller", (account) => unreadCounts(account, new Date()))).toEqual({
      notifications: 0,
      conversations: 2,
      messages: 2,
      salesToConfirm: 0,
    });
  });

  it("confirms a sale by itself 7 days after it was marked done, as soon as anything is read", async () => {
    const id = await aboutListing();
    const completedAt = new Date(Date.now() - 8 * DAY);
    await world.markDone(id, completedAt);
    expect(await world.asViewer("shopper", (account) => unreadCounts(account, new Date()))).toMatchObject({
      salesToConfirm: 0,
      notifications: 0,
    });
    const thread = (await world.asViewer("shopper", (account) => getThread(id, account, new Date())))!;
    expect(thread).toMatchObject({
      status: "confirmed",
      confirmedBy: "auto",
      completedAt: completedAt.toISOString(),
      confirmedAt: autoConfirmAt(completedAt.toISOString()),
    });
    const notes = await world.asViewer("shopper", (account) => getNotifications(account, 10));
    expect(notes.map((note) => [note.kind, note.isNew])).toEqual([["sale-to-confirm", false]]);
  });

  it("leaves a sale done 6 days ago for the buyer to confirm", async () => {
    const id = await aboutListing();
    await world.markDone(id, new Date(Date.now() - 6 * DAY));
    expect(await world.asViewer("shopper", (account) => unreadCounts(account, new Date()))).toMatchObject({
      salesToConfirm: 1,
      notifications: 1,
    });
    expect((await world.asViewer("shopper", (account) => getThread(id, account, new Date())))!.status).toBe("done");
    expect(await world.asViewer("seller", (account) => unreadCounts(account, new Date()))).toMatchObject({ salesToConfirm: 0 });
  });

  it("finds the buyer's conversation about a listing or with the shop, never an offer thread", async () => {
    const enquiry = await aboutListing();
    expect(await world.asViewer("shopper", (id) => findConversation(id, { kind: "shop", sellerSlug: slug }))).toBeNull();
    const asked = await question();
    expect(await world.asViewer("shopper", (id) => findConversation(id, { kind: "listing", listingId: listing.id }))).toBe(enquiry);
    expect(await world.asViewer("shopper", (id) => findConversation(id, { kind: "shop", sellerSlug: slug }))).toBe(asked);
    await offer();
    expect(await world.asViewer("asker", (id) => findConversation(id, { kind: "shop", sellerSlug: slug }))).toBeNull();
  });

  it("exports the account's conversations oldest first, a sale past its 7 days as confirmed", async () => {
    const enquiry = await aboutListing();
    await question();
    await world.markDone(enquiry, new Date(Date.now() - 8 * DAY));
    const exported = await world.asViewer("shopper", (id) => exportConversations(id, new Date()));
    expect(exported).toEqual([
      {
        with: SHOP,
        about: listing.title,
        status: "confirmed",
        startedAt: at(1).toISOString(),
        messages: [
          { from: "you", text: "Is it still available?\nThanks", swapOffer: null, sentAt: at(1).toISOString() },
          { from: "them", text: "Yes, it is.\nCome by.", swapOffer: null, sentAt: at(3).toISOString() },
        ],
      },
      {
        with: SHOP,
        about: null,
        status: "asked",
        startedAt: at(10).toISOString(),
        messages: [{ from: "you", text: "Do you deliver?", swapOffer: null, sentAt: at(10).toISOString() }],
      },
    ]);
    await offer();
    const asker = await world.asViewer("asker", (id) => exportConversations(id, new Date()));
    expect(asker).toMatchObject([{ with: SHOP, about: offerAbout("buyer", "Contract wanted: a kettle"), status: "offered" }]);
    const shop = await world.asViewer("seller", (id) => exportConversations(id, new Date()));
    // The offer started at its first message, between the two.
    expect(shop.map((row) => row.about)).toEqual([listing.title, offerAbout("seller", "Contract wanted: a kettle"), null]);
  });

  it("keeps message text exactly as sent: never HTML, and no link made of an address (decision 24)", async () => {
    const text = "<b>hi</b>\nhttps://example.test";
    const id = await world.addConversation({ buyer: "shopper", slug, listingId: listing.id, messages: [{ side: "buyer", body: text, sentAt: at(1) }] });
    const thread = (await world.asViewer("shopper", (account) => getThread(id, account, new Date())))!;
    expect(thread.messages[0].body).toBe(text);
    const exported = await world.asViewer("shopper", (account) => exportConversations(account, new Date()));
    expect(exported[0].messages[0].text).toBe(text);
    expect((await world.asViewer("seller", (account) => getInbox(account, "selling", new Date())))[0].preview).toBe("<b>hi</b>");
  });
}
