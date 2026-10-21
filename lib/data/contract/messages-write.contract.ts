import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getPickupPoints } from "@/lib/data";
import {
  confirmSale,
  getThread,
  markCompleted,
  rejectSale,
  sendMessage,
  startConversation,
} from "@/lib/data/messages";
import { getNotifications } from "@/lib/data/notifications";
import { saveOwnListing } from "@/lib/data/own-listings";
import { messageNoteText, saleNoteText } from "@/lib/messaging/notification-text";
import { threadPath } from "@/lib/messaging/paths";
import type { World } from "@/tests/contract/world";

// Messages in both backends, the writes (C2/C3 plan Task 15, decisions 3 and 18; messaging spec 2.1 to 2.5 and 3.3,
// plan decisions 5, 12, 21 and 30; community actions spec 2.9): starting a conversation or joining the buyer's own,
// the one unread message notification per conversation, a reply and its refusals, and the sale's three buttons. The
// notifications' words are built with the TypeScript functions (the wording rule). "shopper" buys from "seller"'s
// shop. messages-write.test.ts runs it on the sample store, messages-write.db.test.ts on the local stack.

const MINUTE = 60 * 1000;
const SHOP = "Contract corner";

export function messagesWriteContract(makeWorld: () => World): void {
  let world: World;
  let seller: string;
  let slug: string;
  let listing: { id: string; title: string };
  let base: number;
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

  const start = (body: string, about: "listing" | "shop" = "listing") =>
    world.asViewer("shopper", (buyerId) =>
      startConversation({
        buyerId,
        listing: about === "listing" ? listing : null,
        sellerSlug: slug,
        body,
        swapOffer: null,
        now: new Date(),
      }),
    );
  const send = (name: "shopper" | "seller" | "asker", conversationId: string, body: string) =>
    world.asViewer(name, (accountId) => sendMessage({ conversationId, accountId, body, now: new Date() }));
  const sale = (name: "shopper" | "seller", move: typeof markCompleted, conversationId: string) =>
    world.asViewer(name, (accountId) => move({ conversationId, accountId, now: new Date() }));
  const thread = (name: "shopper" | "seller", id: string) =>
    world.asViewer(name, (accountId) => getThread(id, accountId, new Date()));
  /** The seller's notifications about one conversation. */
  const sellerNotes = async (id: string) => (await world.notificationsOf("seller")).filter((note) => note.subjectId === id);

  /** A conversation about the listing the seller has replied in. */
  const replied = () =>
    world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing.id,
      messages: [
        { side: "buyer", body: "Is it still available?", sentAt: at(1), readAt: at(2) },
        { side: "seller", body: "Yes.", sentAt: at(3) },
      ],
    });

  it("starts a conversation, and a second first message joins it; a question to the shop is its own", async () => {
    const first = await start("Is it still available?");
    expect(first).toEqual({ conversationId: expect.any(String), created: true });
    expect(await start("And the price?")).toEqual({ conversationId: first.conversationId, created: false });
    const question = await start("Do you deliver?", "shop");
    expect(question.created).toBe(true);
    expect(question.conversationId).not.toBe(first.conversationId);
    expect((await thread("shopper", first.conversationId))!.messages.map((m) => m.body)).toEqual([
      "Is it still available?",
      "And the price?",
    ]);
  });

  it("keeps one unread message notification per conversation for the shop, asking until it replies", async () => {
    const { conversationId } = await start("Is it still available?");
    const asked = { kind: "message", subjectId: conversationId, href: threadPath(conversationId) };
    const words = messageNoteText({ sender: "Shopper", listingTitle: listing.title, first: true });
    expect(await sellerNotes(conversationId)).toEqual([{ ...asked, text: words }]);
    await start("And the price?");
    expect(await sellerNotes(conversationId)).toEqual([{ ...asked, text: words }]);
    const question = await start("Do you deliver?", "shop");
    expect(await sellerNotes(question.conversationId)).toEqual([
      {
        kind: "message",
        subjectId: question.conversationId,
        href: threadPath(question.conversationId),
        text: messageNoteText({ sender: "Shopper", listingTitle: null, first: true }),
      },
    ]);
  });

  it("sends the seller's first reply, which moves Asked to Replied and tells the buyer", async () => {
    const { conversationId } = await start("Is it still available?");
    expect(await send("seller", conversationId, "Yes, it is.")).toBe("sent");
    expect(await thread("shopper", conversationId)).toMatchObject({ status: "replied" });
    const notes = await world.asViewer("shopper", (id) => getNotifications(id, 10));
    expect(notes.map((note) => [note.text, note.href, note.isNew])).toEqual([
      [messageNoteText({ sender: SHOP, listingTitle: listing.title, first: false }), threadPath(conversationId), true],
    ]);
  });

  it("refuses a message where it can't go: waiting on the asker, the other side gone, or not the account's", async () => {
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: a kettle", neededBy: null });
    const offer = await world.addConversation({
      buyer: "asker",
      slug,
      offerOn: requestId,
      messages: [{ side: "seller", body: "We have one.", sentAt: at(1) }],
    });
    expect(await send("seller", offer, "Still there?")).toBe("waiting");
    const enquiry = await replied();
    expect(await send("asker", enquiry, "Hello")).toBe("not-found");
    expect(await send("shopper", randomUUID(), "Hello")).toBe("not-found");
    await world.buyerGone(enquiry);
    expect(await send("seller", enquiry, "Are you there?")).toBe("closed");
  });

  it("marks a sale done for the seller, asking the buyer to confirm, and confirms it for the buyer", async () => {
    const id = await replied();
    expect(await sale("seller", markCompleted, id)).toBe("done");
    expect(await thread("shopper", id)).toMatchObject({ status: "done", completedAt: expect.any(String) });
    const asked = await world.asViewer("shopper", (account) => getNotifications(account, 10));
    expect(asked.map((note) => [note.kind, note.text, note.href, note.isNew])).toEqual([
      ["sale-to-confirm", saleNoteText({ shop: SHOP, listingTitle: listing.title }), threadPath(id), true],
    ]);
    expect(await sale("shopper", confirmSale, id)).toBe("done");
    expect(await thread("shopper", id)).toMatchObject({ status: "confirmed", confirmedBy: "buyer", confirmedAt: expect.any(String) });
    expect((await world.asViewer("shopper", (account) => getNotifications(account, 10))).map((note) => note.isNew)).toEqual([false]);
  });

  it("takes a sale the buyer says didn't happen back to Replied, with no completion", async () => {
    const id = await replied();
    await sale("seller", markCompleted, id);
    expect(await sale("shopper", rejectSale, id)).toBe("done");
    expect(await thread("shopper", id)).toMatchObject({ status: "replied", completedAt: null });
  });

  it("allows each button only to its side and in its state", async () => {
    const id = await replied();
    expect(await sale("shopper", markCompleted, id)).toBe("not-allowed");
    expect(await sale("seller", confirmSale, id)).toBe("not-allowed");
    expect(await sale("shopper", confirmSale, id)).toBe("not-allowed");
    expect(await sale("shopper", rejectSale, id)).toBe("not-allowed");
    await sale("seller", markCompleted, id);
    expect(await sale("seller", markCompleted, id)).toBe("not-allowed");
    expect(await sale("seller", rejectSale, id)).toBe("not-allowed");
    const asked = await start("Do you deliver?", "shop");
    expect(await sale("seller", markCompleted, asked.conversationId)).toBe("not-allowed");
    expect(await sale("seller", markCompleted, randomUUID())).toBe("not-allowed");
  });
}
