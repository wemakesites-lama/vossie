import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRefused } from "@/lib/data/refused";
import { markCompleted, sendMessage, startConversation } from "@/lib/data/messages";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { messagesWriteContract } from "./messages-write.contract";

// Messages' writes on the local stack (C2/C3 plan Task 15): the contract, and what only Supabase has: the seller's
// first reply stamped for the trust badges, start_conversation's refusals as Refused (decision 3), and the account
// checked against the session (decision 2).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("messages, the writes, on the local stack (C2/C3 plan Task 15)", () => {
  messagesWriteContract(supabaseWorld);
});

describe("the message write twins on the local stack (C2/C3 plan Task 15)", () => {
  let world: SupabaseWorld;
  let slug: string;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    slug = await world.openShop("seller", { name: "Contract corner" });
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const ask = (name: "shopper" | "seller", sellerSlug = slug, buyer?: string) =>
    world.asViewer(name, (buyerId) =>
      startConversation({ buyerId: buyer ?? buyerId, listing: null, sellerSlug, body: "Do you deliver?", swapOffer: null, now: new Date() }),
    );

  it("stamps the seller's first reply once, for the trust badges", async () => {
    const { conversationId } = await ask("shopper");
    const replyAt = async () =>
      (await world.admin.from("conversations").select("first_reply_at").eq("id", conversationId).single()).data?.first_reply_at;
    expect(await replyAt()).toBeNull();
    await world.asViewer("seller", (accountId) => sendMessage({ conversationId, accountId, body: "We do.", now: new Date() }));
    const first = await replyAt();
    expect(first).not.toBeNull();
    await world.asViewer("seller", (accountId) => sendMessage({ conversationId, accountId, body: "Anywhere.", now: new Date() }));
    expect(await replyAt()).toBe(first);
  });

  it("throws Refused for start_conversation's refusals: the seller's own shop, or a shop that isn't there", async () => {
    const own = await ask("seller").catch((error: unknown) => error);
    expect(isRefused(own, "own-shop")).toBe(true);
    const gone = await ask("shopper", "contract-no-such-shop").catch((error: unknown) => error);
    expect(isRefused(gone, "not-found")).toBe(true);
  });

  it("throws for a buyer or an account that isn't the signed-in one", async () => {
    const asker = await world.signedIn("asker");
    await expect(ask("shopper", slug, asker)).rejects.toThrow("isn't the signed-in one");
    const { conversationId } = await ask("shopper");
    await expect(
      world.asViewer("seller", () => sendMessage({ conversationId, accountId: asker, body: "Hi", now: new Date() })),
    ).rejects.toThrow("isn't the signed-in one");
    await expect(
      world.asViewer("seller", () => markCompleted({ conversationId, accountId: asker, now: new Date() })),
    ).rejects.toThrow("isn't the signed-in one");
  });
});
