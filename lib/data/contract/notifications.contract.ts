import { afterEach, beforeEach, expect, it } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { notifyFollowers } from "@/lib/data/follows";
import {
  countNewNotifications,
  exportNotifications,
  getNotifications,
  markNotificationsRead,
} from "@/lib/data/notifications";
import { saveOwnListing } from "@/lib/data/own-listings";
import { newListingsText, newListingText } from "@/lib/following/rules";
import type { World } from "@/tests/contract/world";

// Notifications in both backends (C2/C3 plan Task 12, decision 17; messaging spec 2.9 and 3.5; community actions plan
// decision 15): the list newest first with what's new, the count, reading them all, the export, and a followed shop's
// new listings once a SAST day (notifyOncePerDay). On Supabase the database writes every notification (here
// save_listing's tell_followers); in the sample, notifyFollowers does, as saveListingForm calls it.
// notifications.test.ts runs it on the sample store, notifications.db.test.ts on the local stack.

const MINUTE = 60 * 1000;

export function notificationsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    for (const name of ["seller", "shopper"] as const) await world.tidySelling(name);
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** Three notifications for shopper, a minute apart, the newest last. */
  async function three(): Promise<void> {
    const start = Date.now() - 10 * MINUTE;
    for (const [i, word] of ["one", "two", "three"].entries()) {
      await world.addNotification(
        "shopper",
        { kind: "booking", subjectId: `contract-${word}`, text: `Contract note ${word}`, href: `/hub/${word}` },
        new Date(start + i * MINUTE),
      );
    }
  }

  it("lists the account's notifications newest first, says which are new, and cuts at the limit", async () => {
    await three();
    const all = await world.asViewer("shopper", (id) => getNotifications(id, 10));
    expect(all.map((note) => note.text)).toEqual(["Contract note three", "Contract note two", "Contract note one"]);
    expect(all[0]).toMatchObject({ kind: "booking", href: "/hub/three", isNew: true });
    expect(all[0].createdAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(await world.asViewer("shopper", (id) => getNotifications(id, 2))).toHaveLength(2);
    expect(await world.asViewer("shopper", (id) => countNewNotifications(id))).toBe(3);
  });

  it("marks them all read, after which none is new", async () => {
    await three();
    await world.asViewer("shopper", (id) => markNotificationsRead(id, new Date()));
    expect(await world.asViewer("shopper", (id) => countNewNotifications(id))).toBe(0);
    const all = await world.asViewer("shopper", (id) => getNotifications(id, 10));
    expect(all.every((note) => !note.isNew)).toBe(true);
  });

  it("exports them with no ids: the sentence, when and whether read", async () => {
    await three();
    const exported = await world.asViewer("shopper", (id) => exportNotifications(id));
    expect(exported).toHaveLength(3);
    expect(exported[0]).toEqual({ text: "Contract note three", at: expect.any(String), read: false });
    expect(Object.keys(exported[0]).sort()).toEqual(["at", "read", "text"]);
  });

  it("gives a follower one notification a SAST day about a followed shop's new listings (notifyOncePerDay)", async () => {
    const seller = await world.signedIn("seller");
    const slug = await world.openShop("seller", { name: "Contract kettles" });
    await world.follow("shopper", slug);
    const point = (await getPickupPoints()).find((p) => p.campusSlug === "pretoria")!.id;
    let ticks = 0;
    async function publish(title: string) {
      const now = new Date(Date.now() + 1_000 * ++ticks);
      const saved = await world.asViewer("seller", () =>
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
            description: "A kettle the contract tests list.",
            handover: "pickup",
            pickupPointId: point,
          },
          photos: [],
          intent: "publish",
          now,
        }),
      );
      // As saveListingForm does after a first publish. On Supabase the database told the followers already.
      await notifyFollowers({ sellerSlug: slug, shopName: "Contract kettles", listing: { id: saved!.id, title }, now });
      return saved!;
    }
    const first = await publish("Contract kettle");
    const once = await world.asViewer("shopper", (id) => getNotifications(id, 10));
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({
      kind: "new-listing",
      text: newListingText("Contract kettles", "Contract kettle"),
      href: `/listings/${first.id}`,
      isNew: true,
    });

    await publish("Contract toaster");
    const twice = await world.asViewer("shopper", (id) => getNotifications(id, 10));
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({
      kind: "new-listing",
      text: newListingsText("Contract kettles", 2),
      href: `/sellers/${slug}`,
      isNew: true,
    });

    await world.asViewer("shopper", (id) => markNotificationsRead(id, new Date()));
    await publish("Contract iron");
    const after = await world.asViewer("shopper", (id) => getNotifications(id, 10));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ text: newListingsText("Contract kettles", 2), isNew: false });
  });
}
