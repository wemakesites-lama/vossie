import { afterEach, beforeEach, expect, it } from "vitest";
import { countConversationsStartedSince, countMessagesSentSince } from "@/lib/data/messages";
import { messageLimitErrors } from "@/lib/messaging/limits";
import { CONVERSATIONS_PER_DAY, DAY_MS, HOUR_MS, MESSAGES_PER_HOUR } from "@/lib/messaging/rules";
import type { Account } from "@/lib/types";
import type { World, WorldAccountName } from "@/tests/contract/world";

// The message limits' first look in both backends (C2/C3 plan Task 15, decision 18; stage K spec 4, decisions 8 to
// 10): the counts messageLimitErrors makes before the scam words. On Supabase they are my_conversations_started_since and
// my_messages_sent_since, which count as the database's own check does under the sender's lock (limits.db.test.ts
// checks that one). limits.test.ts runs it on the sample store, limits.db.test.ts on the local stack.

const MINUTE = 60 * 1000;

export function limitsContract(makeWorld: () => World): void {
  let world: World;
  let slug: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    slug = await world.openShop("seller", { name: "Contract corner" });
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** The account as messageLimitErrors takes it: none of the world's accounts is a sample account. */
  const accountOf = async (name: WorldAccountName, sellerSlug: string | null = null): Promise<Pick<Account, "id" | "email" | "seller">> => ({
    id: await world.signedIn(name),
    email: `contract-${name}@vossie.test`,
    seller: sellerSlug ? { status: "approved", sellerSlug } : null,
  });
  const question = (sentAt: Date) =>
    world.addConversation({ buyer: "shopper", slug, messages: [{ side: "buyer", body: "Do you deliver?", sentAt }] });

  it("counts the hour's messages, and refuses the 121st", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * MINUTE);
    const id = await question(new Date(Date.now() - 2 * HOUR_MS));
    await world.addMessages(id, "buyer", MESSAGES_PER_HOUR, tenMinutesAgo);
    const shopper = await accountOf("shopper");
    const now = new Date();
    const hourAgo = new Date(now.getTime() - HOUR_MS);
    expect(await world.asViewer("shopper", () => countMessagesSentSince(shopper.id, null, hourAgo))).toBe(MESSAGES_PER_HOUR);
    expect(await world.asViewer("shopper", () => messageLimitErrors(shopper, { newConversation: false }, now))).toEqual([
      "message-rate",
    ]);
  });

  it("counts the day's new conversations, and refuses a 41st, but not a message into one that exists", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * MINUTE);
    for (let n = 0; n < CONVERSATIONS_PER_DAY; n += 1) {
      // About listings that have gone, so none clashes with another (one open thread per listing or shop).
      await world.addConversation({
        buyer: "shopper",
        slug,
        listingTitle: `Contract gone thing ${n + 1}`,
        messages: [{ side: "buyer", body: "Hello", sentAt: tenMinutesAgo }],
      });
    }
    const shopper = await accountOf("shopper");
    const now = new Date();
    const dayAgo = new Date(now.getTime() - DAY_MS);
    expect(await world.asViewer("shopper", () => countConversationsStartedSince(shopper.id, dayAgo))).toBe(CONVERSATIONS_PER_DAY);
    expect(await world.asViewer("shopper", () => messageLimitErrors(shopper, { newConversation: true }, now))).toEqual([
      "conversation-rate",
    ]);
    expect(await world.asViewer("shopper", () => messageLimitErrors(shopper, { newConversation: false }, now))).toEqual([]);
  });

  it("leaves offers out of the conversations a buyer started", async () => {
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: a kettle", neededBy: null });
    await world.addConversation({
      buyer: "asker",
      slug,
      offerOn: requestId,
      messages: [{ side: "seller", body: "We have one.", sentAt: new Date(Date.now() - MINUTE) }],
    });
    const asker = await accountOf("asker");
    const dayAgo = new Date(Date.now() - DAY_MS);
    expect(await world.asViewer("asker", () => countConversationsStartedSince(asker.id, dayAgo))).toBe(0);
  });

  it("counts a seller's messages in their shop's conversations, an offer's first included, until the seller has gone", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * MINUTE);
    const id = await question(new Date(Date.now() - 2 * HOUR_MS));
    await world.addMessages(id, "seller", 3, tenMinutesAgo);
    const requestId = await world.addRequest({ asker: "asker", title: "Contract wanted: a kettle", neededBy: null });
    await world.addConversation({
      buyer: "asker",
      slug,
      offerOn: requestId,
      messages: [{ side: "seller", body: "We have one.", sentAt: tenMinutesAgo }],
    });
    const seller = await accountOf("seller", slug);
    const hourAgo = new Date(Date.now() - HOUR_MS);
    const count = () => world.asViewer("seller", () => countMessagesSentSince(seller.id, slug, hourAgo));
    expect(await count()).toBe(4);
    // The buyer's messages are the buyer's, not the shop's.
    expect(await world.asViewer("shopper", async (shopper) => countMessagesSentSince(shopper, null, hourAgo))).toBe(0);
    await world.sellerGone(id);
    expect(await count()).toBe(1);
  });
}
