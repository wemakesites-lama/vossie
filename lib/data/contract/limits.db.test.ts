import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { isRefused, refusalOf } from "@/lib/data/refused";
import { sendMessage, startConversation } from "@/lib/data/messages";
import { saveOwnListing } from "@/lib/data/own-listings";
import { messageLimitErrors } from "@/lib/messaging/limits";
import { CONVERSATIONS_PER_DAY, MESSAGES_PER_HOUR } from "@/lib/messaging/rules";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { limitsContract } from "./limits.contract";

// The message limits on the local stack (C2/C3 plan Task 15, decision 18; stage K spec decision 11): the first look's
// contract, and the look that counts: private.message_limit_error inside start_conversation and send_message, under the
// sender's lock, so posts at the same moment can't slip past, and with no exemption for the sample accounts, whatever
// the app's isSampleAccount says (step 2 decision 9).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
const samples = vi.hoisted(() => ({ exempt: false }));
vi.mock("@/lib/auth/sample-accounts", async (original) => ({
  ...(await original<typeof import("@/lib/auth/sample-accounts")>()),
  isSampleAccount: () => samples.exempt,
}));

describe("the message limits' first look on the local stack (C2/C3 plan Task 15)", () => {
  limitsContract(supabaseWorld);
});

describe("the message limits in the database (C2/C3 plan Task 15)", () => {
  const MINUTE = 60 * 1000;
  let world: SupabaseWorld;
  let slug: string;
  let conversation: string;
  beforeEach(async () => {
    samples.exempt = false;
    world = supabaseWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    slug = await world.openShop("seller", { name: "Contract corner" });
    conversation = await world.addConversation({
      buyer: "shopper",
      slug,
      messages: [{ side: "buyer", body: "Do you deliver?", sentAt: new Date(Date.now() - 2 * 60 * MINUTE) }],
    });
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const reply = (body = "One more") =>
    world.asViewer("shopper", (accountId) => sendMessage({ conversationId: conversation, accountId, body, now: new Date() }));
  const messageCount = async () =>
    (await world.admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation)).count;

  it("refuses the 121st message in an hour itself, with Refused, and adds nothing (whatever isSampleAccount says)", async () => {
    await world.addMessages(conversation, "buyer", MESSAGES_PER_HOUR, new Date(Date.now() - 10 * MINUTE));
    samples.exempt = true;
    const shopper = { id: await world.signedIn("shopper"), email: "contract-shopper@vossie.test", seller: null };
    expect(await world.asViewer("shopper", () => messageLimitErrors(shopper, { newConversation: false }, new Date()))).toEqual([]);
    const before = await messageCount();
    const refused = await reply().catch((error: unknown) => error);
    expect(isRefused(refused, "message-rate")).toBe(true);
    expect(await messageCount()).toBe(before);
  });

  it("lets exactly one of two messages sent at once through at 119, under the sender's lock", async () => {
    await world.addMessages(conversation, "buyer", MESSAGES_PER_HOUR - 1, new Date(Date.now() - 10 * MINUTE));
    const results = await world.asViewer("shopper", (accountId) =>
      Promise.all(
        ["First", "Second"].map((body) =>
          refusalOf(sendMessage({ conversationId: conversation, accountId, body, now: new Date() })),
        ),
      ),
    );
    expect(results).toEqual(expect.arrayContaining([{ ok: "sent" }, { refused: "message-rate" }]));
    expect(results).toHaveLength(2);
  });

  it("lets exactly one of two new conversations started at once through at 39 in a day", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * MINUTE);
    // The beforeEach's question is one; 38 more about listings that have gone make 39.
    for (let n = 0; n < CONVERSATIONS_PER_DAY - 2; n += 1) {
      await world.addConversation({
        buyer: "shopper",
        slug,
        listingTitle: `Contract gone thing ${n + 1}`,
        messages: [{ side: "buyer", body: "Hello", sentAt: tenMinutesAgo }],
      });
    }
    // Two listings, so each first message would start a conversation: the 40th and the 41st.
    const seller = await world.signedIn("seller");
    const point = (await getPickupPoints()).find((p) => p.campusSlug === "pretoria")!.id;
    const listings: { id: string; title: string }[] = [];
    for (const title of ["Contract kettle", "Contract toaster"]) {
      const made = await world.asViewer("seller", () =>
        saveOwnListing({
          sellerSlug: slug,
          ownerId: seller,
          id: null,
          fields: {
            kind: "item",
            title,
            categorySlug: "res-living",
            condition: "good",
            priceZar: 90,
            priceIsFrom: false,
            payMode: "cash",
            swapFor: null,
            description: "A thing the contract tests list.",
            handover: "pickup",
            pickupPointId: point,
          },
          photos: [],
          intent: "publish",
          now: new Date(),
        }),
      );
      listings.push({ id: made!.id, title: made!.title });
    }
    const results = await world.asViewer("shopper", (buyerId) =>
      Promise.all(
        listings.map((listing) =>
          refusalOf(
            startConversation({ buyerId, listing, sellerSlug: slug, body: "Hello again", swapOffer: null, now: new Date() }),
          ),
        ),
      ),
    );
    expect(results).toEqual(
      expect.arrayContaining([{ ok: { conversationId: expect.any(String), created: true } }, { refused: "conversation-rate" }]),
    );
    expect(results).toHaveLength(2);
  });
});
