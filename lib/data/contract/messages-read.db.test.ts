import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountActivity } from "@/lib/data/accounts";
import { forgetAccountInMessaging, getInbox, getThread, markThreadRead, unreadCounts } from "@/lib/data/messages";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { messagesReadContract } from "./messages-read.contract";

// Messages' reads on the local stack (C2/C3 plan Task 14): the contract, and what only Supabase has: another account's
// conversations never read, the account checked against the session (decision 2), ids that aren't uuids answered
// without a query, deletion's path in the database (decision 21, amendment 4), and the context strip's numbers
// (getAccountActivity, amendment 11), read without a write.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("messages, the reads, on the local stack (C2/C3 plan Task 14)", () => {
  messagesReadContract(supabaseWorld);
});

describe("the message read twins on the local stack (C2/C3 plan Task 14)", () => {
  let world: SupabaseWorld;
  let slug: string;
  let conversation: string;
  const DAY = 24 * 60 * 60 * 1000;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.tidySelling("seller");
    await world.tidyMessaging();
    slug = await world.openShop("seller", { name: "Contract corner" });
    conversation = await world.addConversation({
      buyer: "shopper",
      slug,
      messages: [
        { side: "buyer", body: "Do you deliver?", sentAt: new Date(Date.now() - 20 * 60 * 1000) },
        { side: "seller", body: "We do.", sentAt: new Date(Date.now() - 10 * 60 * 1000) },
      ],
    });
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("never reads another account's conversations", async () => {
    expect(await world.asViewer("asker", (id) => getInbox(id, "buying", new Date()))).toEqual([]);
    expect(await world.asViewer("asker", (id) => getInbox(id, "selling", new Date()))).toEqual([]);
    expect(await world.asViewer("asker", (id) => getThread(conversation, id, new Date()))).toBeNull();
    expect(await world.asViewer("asker", (id) => unreadCounts(id, new Date()))).toMatchObject({ conversations: 0, messages: 0 });
  });

  it("throws for an account that isn't the signed-in one", async () => {
    const shopper = await world.signedIn("shopper");
    await expect(world.asViewer("asker", () => getInbox(shopper, "buying", new Date()))).rejects.toThrow("isn't the signed-in one");
    await expect(world.asViewer("asker", () => getThread(conversation, shopper, new Date()))).rejects.toThrow("isn't the signed-in one");
    await expect(world.asViewer("asker", () => unreadCounts(shopper, new Date()))).rejects.toThrow("isn't the signed-in one");
  });

  it("answers an id that isn't a uuid without asking the database (a sample conversation's, or a forged one)", async () => {
    expect(await world.asViewer("shopper", (id) => getThread(`conv-${randomUUID()}`, id, new Date()))).toBeNull();
    await world.asViewer("shopper", (id) => markThreadRead("not-a-uuid", id, new Date()));
  });

  it("leaves deletion's path to the database (forget_account), with a plain Error", async () => {
    const shopper = await world.signedIn("shopper");
    await expect(world.asViewer("shopper", () => forgetAccountInMessaging(shopper, null))).rejects.toThrow(
      "forgetAccountInMessaging runs in the database on Supabase",
    );
  });

  it("gives the context strip's numbers from the same counts, writing nothing (getAccountActivity, amendment 11)", async () => {
    await world.markDone(conversation, new Date(Date.now() - 8 * DAY));
    const shopper = await world.signedIn("shopper");
    const activity = await world.asViewer("shopper", () => getAccountActivity(shopper, new Date()));
    expect(activity).toMatchObject({ newMessages: 1, salesToConfirm: 0 });
    expect(Object.keys(activity!).sort()).toEqual(["newMessages", "newNotifications", "salesToConfirm"]);
    // The header's numbers settle nothing: the sale is still stored as done until something reads the thread.
    const row = await world.admin.from("conversations").select("status").eq("id", conversation).single();
    expect(row.data?.status).toBe("done");
    await world.admin.from("conversations").update({ completed_at: new Date(Date.now() - DAY).toISOString() }).eq("id", conversation);
    expect(await world.asViewer("shopper", () => getAccountActivity(shopper, new Date()))).toMatchObject({ salesToConfirm: 1 });
  });
});
