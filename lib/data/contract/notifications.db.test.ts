import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteNotifications,
  deleteNotificationsAbout,
  getNotifications,
  markConversationNotificationsRead,
  markSaleNotificationsRead,
  notify,
  notifyAboutMessage,
  notifyNewListing,
  notifySearchMatch,
} from "@/lib/data/notifications";
import { supabaseWorld, type SupabaseWorld } from "@/tests/db/supabase-world";
import { notificationsContract } from "./notifications.contract";

// Notifications on the local stack (C2/C3 plan Task 12): the contract, and what only Supabase has: the TypeScript
// writers throw, since the database writes every notification inside the action that needs it (decision 17,
// amendment 4: a plain Error, never a refusal a form could show), and another account's are never read.
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

describe("notifications on the local stack (C2/C3 plan Task 12)", () => {
  notificationsContract(supabaseWorld);
});

describe("the notification twins on the local stack (C2/C3 plan Task 12)", () => {
  let world: SupabaseWorld;
  beforeEach(async () => {
    world = supabaseWorld();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("throws for every TypeScript writer: the database writes notifications (decision 17)", async () => {
    const shopper = await world.signedIn("shopper");
    const now = new Date();
    const note = { accountId: shopper, kind: "booking" as const, subjectId: "x", text: "x", href: "/x", now };
    const listing = { id: "l-001", title: "A thing" };
    const calls: [string, () => Promise<unknown>][] = [
      ["notify", () => notify(note)],
      ["notifyAboutMessage", () => notifyAboutMessage({ accountId: shopper, conversationId: "c", text: "x", href: "/x", now })],
      ["markSaleNotificationsRead", () => markSaleNotificationsRead(shopper, "c", now)],
      ["markConversationNotificationsRead", () => markConversationNotificationsRead(shopper, "c", now)],
      ["deleteNotifications", () => deleteNotifications({ accountId: shopper, subjectIds: new Set(["c"]) })],
      ["deleteNotificationsAbout", () => deleteNotificationsAbout("new-listing", new Set(["s"]))],
      ["notifyNewListing", () => notifyNewListing({ accountId: shopper, sellerSlug: "s", shopName: "S", listing, now })],
      [
        "notifySearchMatch",
        () => notifySearchMatch({ accountId: shopper, savedSearchId: "s", label: "S", resultsHref: "/browse", listing, now }),
      ],
    ];
    for (const [name, call] of calls) {
      await expect(world.asViewer("shopper", call)).rejects.toThrow(`${name} runs in the database on Supabase`);
    }
    expect(await world.notificationsOf("shopper")).toEqual([]);
  });

  it("never reads another account's notifications, nor for an account that isn't the viewer", async () => {
    await world.addNotification("asker", { kind: "booking", subjectId: "contract-a", text: "For the asker", href: "/hub" });
    expect(await world.asViewer("shopper", (id) => getNotifications(id, 10))).toEqual([]);
    const asker = await world.signedIn("asker");
    await expect(world.asViewer("shopper", () => getNotifications(asker, 10))).rejects.toThrow("isn't the signed-in one");
  });
});
