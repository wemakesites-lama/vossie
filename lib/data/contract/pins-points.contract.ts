import { afterEach, beforeEach, expect, it } from "vitest";
import { getPickupPoints } from "@/lib/data";
import { addPin, featuredChoices, featuredFor, getPin, listPins, removePin } from "@/lib/data/featured";
import { getOwnListing } from "@/lib/data/own-listings";
import {
  addPickupPoint,
  isPointNameTaken,
  listPickupPoints,
  renamePickupPoint,
  restorePickupPoint,
  retirePickupPoint,
} from "@/lib/data/pickup-points";
import { isRefused } from "@/lib/data/refused";
import { getShopOf, updateShop } from "@/lib/data/shops";
import { setVerified } from "@/lib/data/staff-shops";
import { addDays } from "@/lib/staff/rules";
import { sastDate } from "@/lib/time";
import type { World } from "@/tests/contract/world";

// Featured pins and pickup point writes in both backends (C4/C5 plan Task 17): pins as the admin, with the day's row
// forgotten so it's drawn again; the four point writes; and a pickup listing keeping a point that has been retired when
// its seller edits the shop (the sample's rule, which update_shop now follows: the controller's ruling after C2).
// Days are in the coming week, and every row and pin on them goes in cleanup. pins-points.test.ts runs it on the sample
// store, pins-points.db.test.ts on the local stack.

const NOW = () => new Date();
const inDays = (days: number) => addDays(sastDate(new Date()), days);

export function pinsPointsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyPickupPoints();
    await world.tidyCommunity();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const asStaff = <T>(read: (staffId: string) => Promise<T>) => world.asViewer("staff", read);

  it("pins a Verified, open seller with a listing; taken, full and not-eligible otherwise; 'all' round-trips", async () => {
    const day = inDays(3);
    await world.forgetFeaturedDays([day]);
    const choices = await asStaff((staffId) => featuredChoices(staffId));
    expect(choices.length).toBeGreaterThanOrEqual(5);
    const pin = (sellerSlug: string) =>
      asStaff((staffId) => addPin({ sellerSlug, campusSlug: "all", day, staffId, now: NOW() }));
    const staffId = await world.signedIn("staff");
    const first = await pin(choices[0].slug);
    expect(first).toMatchObject({ sellerSlug: choices[0].slug, campusSlug: "all", day, pinnedBy: staffId });
    expect(await pin(choices[0].slug)).toBe("taken");
    for (const seller of choices.slice(1, 4)) expect(typeof (await pin(seller.slug))).toBe("object");
    expect(await pin(choices[4].slug)).toBe("full");
    const unverified = await world.openShop("shopper");
    await world.addListing(unverified, { title: "Contract unverified lamp" });
    expect(await asStaff((id) => addPin({ sellerSlug: unverified, campusSlug: "pretoria", day, staffId: id, now: NOW() }))).toBe(
      "not-eligible",
    );
  });

  it("forgets that campus's row for the day when a pin is added or removed, so it's drawn again", async () => {
    const day = inDays(4);
    await world.forgetFeaturedDays([day]);
    const choices = await asStaff((staffId) => featuredChoices(staffId));
    const [drawn, pinned] = [choices[0].slug, choices[1].slug];
    await world.recordDraw("all", day, [drawn]);
    expect((await featuredFor("all", day)).map((seller) => seller.slug)).toEqual([drawn]);
    const pin = await asStaff((staffId) => addPin({ sellerSlug: pinned, campusSlug: "all", day, staffId, now: NOW() }));
    if (typeof pin === "string") throw new Error(`Not pinned: ${pin}`);
    const redrawn = (await featuredFor("all", day)).map((seller) => seller.slug);
    expect(redrawn[0]).toBe(pinned);
    expect(redrawn.length).toBeGreaterThan(1);
    expect(await asStaff(() => removePin(pin.id))).toEqual(pin);
    expect((await featuredFor("all", day)).map((seller) => seller.slug)).not.toContain(undefined);
    expect(await asStaff(() => removePin(pin.id))).toBeNull();
    expect(await asStaff(() => getPin(pin.id))).toBeNull();
  });

  it("lists pins with names and marks the admin's own shop, which featuredChoices leaves out", async () => {
    const day = inDays(5);
    await world.forgetFeaturedDays([day]);
    const own = await world.openShop("staff");
    await world.addListing(own, { title: "Contract staff's featured lamp" });
    // Another admin verifies it: an admin never decides about their own shop.
    await world.setRoles("asker", ["admin"]);
    expect(await world.asViewer("asker", () => setVerified(own, true))).not.toBeNull();
    const staffId = await world.signedIn("staff");
    expect((await asStaff(() => featuredChoices(null))).map((seller) => seller.slug)).toContain(own);
    expect((await asStaff((id) => featuredChoices(id))).map((seller) => seller.slug)).not.toContain(own);
    await world.addPin("all", day, own);
    const other = (await asStaff((id) => featuredChoices(id)))[0];
    const pinned = await asStaff((id) => addPin({ sellerSlug: other.slug, campusSlug: "pretoria", day, staffId: id, now: NOW() }));
    if (typeof pinned === "string") throw new Error(`Not pinned: ${pinned}`);
    const pins = (await asStaff((id) => listPins(sastDate(new Date()), id))).filter((pin) => pin.day === day);
    expect(pins.map(({ sellerSlug, campusSlug, sellerName, pinnedByName, own: mine }) => ({ sellerSlug, campusSlug, sellerName, pinnedByName, mine }))).toEqual([
      { sellerSlug: own, campusSlug: "all", sellerName: "Contract Staff's shop", pinnedByName: "Staff", mine: true },
      { sellerSlug: other.slug, campusSlug: "pretoria", sellerName: other.name, pinnedByName: "Staff", mine: false },
    ]);
    expect(await asStaff(() => getPin(pinned.id))).toEqual({
      id: pinned.id,
      sellerSlug: other.slug,
      campusSlug: "pretoria",
      day,
      pinnedBy: staffId,
      createdAt: pinned.createdAt,
    });
    expect((await asStaff(() => listPins(sastDate(new Date()), null))).every((pin) => pin.own === false)).toBe(true);
  });

  it("refuses a pin on the admin's own shop and a day gone by on Supabase, pinning nothing", async () => {
    if (world.name !== "supabase") return;
    const day = inDays(6);
    await world.forgetFeaturedDays([day, inDays(-1)]);
    const own = await world.openShop("staff");
    const before = await world.auditCount();
    const refusal = async (pin: Promise<unknown>) => pin.then(() => null, (error: unknown) => error);
    expect(
      isRefused(await refusal(asStaff((id) => addPin({ sellerSlug: own, campusSlug: "all", day, staffId: id, now: NOW() }))), "own-shop"),
    ).toBe(true);
    const other = (await asStaff((id) => featuredChoices(id)))[0];
    expect(
      isRefused(
        await refusal(asStaff((id) => addPin({ sellerSlug: other.slug, campusSlug: "all", day: inDays(-1), staffId: id, now: NOW() }))),
        "day-past",
      ),
    ).toBe(true);
    expect(await world.auditCount()).toBe(before);
    expect((await asStaff(() => listPins(inDays(-1), null))).filter((pin) => pin.day === day || pin.day === inDays(-1))).toEqual([]);
  });

  it("adds, renames, retires and restores a point, each once; Eduvos Online has none", async () => {
    const added = await asStaff(() => addPickupPoint("pretoria", "Contract gate", NOW()));
    expect(added).toEqual({
      id: expect.any(String),
      campusSlug: "pretoria",
      name: "Contract gate",
      retiredAt: null,
      createdAt: expect.any(String),
    });
    const id = added!.id;
    expect(await asStaff(() => addPickupPoint("pretoria", "CONTRACT GATE", NOW()))).toBeNull();
    expect(await asStaff(() => addPickupPoint("online", "Contract gate", NOW()))).toBeNull();
    expect(await isPointNameTaken("pretoria", "contract gate", null)).toBe(true);
    expect(await isPointNameTaken("pretoria", "contract gate", id)).toBe(false);
    expect(await isPointNameTaken("midrand", "contract gate", null)).toBe(false);
    expect(await asStaff(() => renamePickupPoint(id, "Contract main gate"))).toEqual({ before: "Contract gate" });
    expect(await asStaff(() => renamePickupPoint(id, "Contract main gate"))).toBeNull();
    const retired = await asStaff(() => retirePickupPoint(id, NOW()));
    expect(retired).toMatchObject({ id, name: "Contract main gate", retiredAt: expect.any(String) });
    expect(await asStaff(() => retirePickupPoint(id, NOW()))).toBeNull();
    expect((await listPickupPoints()).find((row) => row.id === id)).toMatchObject({ retiredAt: expect.any(String) });
    expect((await getPickupPoints()).some((point) => point.id === id)).toBe(false);
    expect(await asStaff(() => restorePickupPoint(id))).toMatchObject({ id, retiredAt: null });
    expect(await asStaff(() => restorePickupPoint(id))).toBeNull();
  });

  it("keeps a pickup listing on a point that has since been retired when its seller edits the shop", async () => {
    const slug = await world.openShop("shopper");
    const shopperId = await world.signedIn("shopper");
    const own = (await world.asViewer("shopper", (id) => getShopOf(id)))!.shop;
    const [retiring] = own.pickupPointIds;
    const kept = (await getPickupPoints()).find((point) => point.campusSlug === "pretoria" && point.id !== retiring)!;
    const dropped = (await asStaff(() => addPickupPoint("pretoria", "Contract dropped gate", NOW())))!;
    expect(kept).toBeDefined();
    const onRetired = await world.addListing(slug, { title: "Contract retired-point lamp", pickupPointId: retiring });
    const onDropped = await world.addListing(slug, { title: "Contract dropped-point lamp", pickupPointId: dropped.id });
    await world.retirePickupPoint(retiring);
    const saved = await world.asViewer("shopper", () =>
      updateShop(
        shopperId,
        {
          name: own.name,
          tagline: own.tagline,
          categorySlug: own.categorySlug,
          about: own.about,
          image: own.image,
          campusSlug: own.campusSlug,
          pickupPointIds: [kept.id],
        },
        NOW(),
      ),
    );
    expect(saved).not.toBeNull();
    const read = (id: string) => world.asViewer("shopper", () => getOwnListing(slug, id));
    // A retired point isn't the seller's to remove: the listing keeps it (selling amendment 13.6).
    expect(await read(onRetired)).toMatchObject({ handover: "pickup", pickupPointId: retiring });
    // A point the seller stops using moves its listings to the shop's first point.
    expect(await read(onDropped)).toMatchObject({ handover: "pickup", pickupPointId: kept.id });
  });
}
