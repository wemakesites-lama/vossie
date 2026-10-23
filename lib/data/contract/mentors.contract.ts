import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { addNote, getMentoredShop, lastCheckIns, listNotes, mentoredShops } from "@/lib/data/mentors";
import { isRefused } from "@/lib/data/refused";
import { addDays } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { World, WorldAccountName } from "@/tests/contract/world";

// The mentor dashboard's data in both backends (C4/C5 plan Task 19; decisions 6 and 16, amendment 17): the shops a
// mentor, or an admin, follows, never the viewer's own; notes and check-ins about a shop's owner, newest first, which
// the owner never reads, an admin who sells included. On Supabase the access rules decide (staff_seller_profiles,
// private.can_mentor), and add_mentor_note and add_check_in take the form's one-time token, so every note here carries
// one (the sample ignores it). mentors.test.ts runs it on the sample store, mentors.db.test.ts on the local stack.

export function mentorsContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyStaffTools();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const shopsFor = (name: WorldAccountName) =>
    world.asViewer(name, async () => mentoredShops(await world.viewerAccount(name), new Date()));
  const token = async (name: WorldAccountName) => {
    const value = randomUUID();
    await world.onceRow(name, `staff-once:${value}`);
    return value;
  };
  /** A note (or a check-in today) by `author` about `owner`'s shop, made `at`; its id. */
  const note = async (author: WorldAccountName, owner: WorldAccountName, text: string, at: Date, checkIn = false) => {
    const onceToken = await token(author);
    const ownerId = await world.signedIn(owner);
    return world.asViewer(author, async (id) =>
      addNote(
        {
          ownerId,
          kind: checkIn ? "check-in" : "note",
          checkInOn: checkIn ? sastDate(at) : null,
          text,
          author: { id, firstName: (await world.viewerAccount(author)).firstName },
          now: at,
        },
        onceToken,
      ),
    );
  };

  it("lists a mentor's shops for them, every assigned shop for an admin, and never the viewer's own", async () => {
    const [askerId, shopperId] = await Promise.all([world.signedIn("asker"), world.signedIn("shopper")]);
    await world.setRoles("asker", ["mentor"]);
    const slug = await world.openShop("shopper");
    await world.setMentor(slug, "asker");
    const mine = await shopsFor("asker");
    expect(mine).toEqual([
      {
        slug,
        name: "Contract Shopper's shop",
        campusSlug: "pretoria",
        ownerName: "Shopper",
        ownerId: shopperId,
        badge: "new-seller",
        status: "approved",
        pausedBy: null,
        mentorId: askerId,
        mentorName: "Asker",
        counts: expect.objectContaining({ enquiries: 0 }),
        flags: ["no-listings"],
        lastCheckInOn: null,
      },
    ]);
    expect((await shopsFor("staff")).map((shop) => shop.slug)).toContain(slug);
    expect(await world.asViewer("asker", async () => getMentoredShop(slug, await world.viewerAccount("asker"), new Date()))).toEqual(mine[0]);

    // An admin who sells never follows their own shop, though another mentor looks after it (amendment 15.3).
    const own = await world.openShop("staff");
    await world.setMentor(own, "asker");
    expect((await shopsFor("staff")).map((shop) => shop.slug)).not.toContain(own);
    expect((await shopsFor("asker")).map((shop) => shop.slug).sort()).toEqual([own, slug].sort());
    expect(await world.asViewer("staff", async () => getMentoredShop(own, await world.viewerAccount("staff"), new Date()))).toBeNull();
  });

  it("lists the notes about an owner newest first, for the mentor and an admin", async () => {
    const shopperId = await world.signedIn("shopper");
    await world.setRoles("asker", ["mentor"]);
    await world.setMentor(await world.openShop("shopper"), "asker");
    const now = Date.now();
    const first = await note("asker", "shopper", "Replies fast. Next: better photos.", new Date(now - 2_000));
    const second = await note("asker", "shopper", "Met at the Hub to price the calculators.", new Date(now - 1_000), true);
    const third = await note("staff", "shopper", "An admin's note about the shop.", new Date(now));
    const expected = [
      { id: third, kind: "note", checkInOn: null, text: "An admin's note about the shop.", authorName: "Staff" },
      { id: second, kind: "check-in", checkInOn: sastDate(new Date(now - 1_000)), text: "Met at the Hub to price the calculators.", authorName: "Asker" },
      { id: first, kind: "note", checkInOn: null, text: "Replies fast. Next: better photos.", authorName: "Asker" },
    ];
    expect(await world.asViewer("asker", () => listNotes(shopperId))).toMatchObject(expected);
    expect(await world.asViewer("staff", () => listNotes(shopperId))).toMatchObject(expected);
  });

  it("on Supabase never shows the owner the notes about them, an admin who sells included", async () => {
    if (world.name !== "supabase") return;
    const [shopperId, staffId] = await Promise.all([world.signedIn("shopper"), world.signedIn("staff")]);
    await world.setRoles("asker", ["mentor"]);
    await world.setMentor(await world.openShop("shopper"), "asker");
    await world.setMentor(await world.openShop("staff"), "asker");
    await note("asker", "shopper", "A note the seller never reads.", new Date());
    await note("asker", "staff", "A note the admin who sells never reads.", new Date());
    expect(await world.asViewer("shopper", () => listNotes(shopperId))).toEqual([]);
    expect(await world.asViewer("staff", () => listNotes(staffId))).toEqual([]);
    expect(await world.asViewer("asker", () => listNotes(staffId))).toHaveLength(1);
  });

  it("on Supabase refuses another shop's mentor, a used or made-up token and a check-in day still to come, writing nothing", async () => {
    if (world.name !== "supabase") return;
    const shopperId = await world.signedIn("shopper");
    await world.setRoles("asker", ["mentor"]);
    await world.setRoles("seller", ["mentor"]);
    await world.setMentor(await world.openShop("shopper"), "asker");
    const before = { audit: await world.auditCount(), notes: await world.asViewer("staff", () => listNotes(shopperId)) };
    const refusal = async (work: () => Promise<unknown>) => work().then(() => null, (error: unknown) => error);
    const write = async (author: WorldAccountName, onceToken: string, checkInOn: string | null = null) =>
      world.asViewer(author, (id) =>
        addNote(
          { ownerId: shopperId, kind: checkInOn ? "check-in" : "note", checkInOn, text: "A refused note.", author: { id, firstName: "X" }, now: new Date() },
          onceToken,
        ),
      );
    expect(isRefused(await refusal(async () => write("seller", await token("seller"))), "forbidden")).toBe(true);
    expect(isRefused(await refusal(() => write("asker", randomUUID())), "once-expired")).toBe(true);
    const tomorrow = addDays(sastDate(new Date()), 1);
    expect(isRefused(await refusal(async () => write("asker", await token("asker"), tomorrow)), "check-in-day-future")).toBe(true);
    expect({ audit: await world.auditCount(), notes: await world.asViewer("staff", () => listNotes(shopperId)) }).toEqual(before);
    const once = await token("asker");
    await write("asker", once);
    expect(isRefused(await refusal(() => write("asker", once)), "once-taken")).toBe(true);
    expect(await world.asViewer("staff", () => listNotes(shopperId))).toHaveLength(1);
    expect(await world.auditCount()).toBe(before.audit + 1);
  });

  it("gives the latest check-in day per owner, never text, and nothing about the viewer's own shop (role views spec 6)", async () => {
    const [shopperId, staffId] = await Promise.all([world.signedIn("shopper"), world.signedIn("staff")]);
    await world.setRoles("asker", ["mentor"]);
    await world.setMentor(await world.openShop("shopper"), "asker");
    await world.setMentor(await world.openShop("staff"), "asker");
    const DAY = 86_400_000;
    const now = Date.now();
    await note("asker", "shopper", "Talked about photos.", new Date(now - 3 * DAY), true);
    await note("asker", "shopper", "Priced the calculators.", new Date(now - DAY), true);
    await note("asker", "shopper", "A note, not a check-in.", new Date(now));
    await note("asker", "staff", "Met the admin who sells.", new Date(now - 2 * DAY), true);
    const seen = (name: WorldAccountName, owners: string[]) =>
      world.asViewer(name, async () => lastCheckIns(await world.viewerAccount(name), owners));
    const shopperDay = sastDate(new Date(now - DAY));
    const staffDay = sastDate(new Date(now - 2 * DAY));

    expect(await seen("asker", [shopperId, staffId])).toEqual(new Map([[shopperId, shopperDay], [staffId, staffDay]]));
    // An admin who sells learns nothing about their own shop; its owner nothing; another mentor nothing.
    expect(await seen("staff", [shopperId, staffId])).toEqual(new Map([[shopperId, shopperDay]]));
    expect(await seen("shopper", [shopperId])).toEqual(new Map());
    await world.setRoles("seller", ["mentor"]);
    expect(await seen("seller", [shopperId, staffId])).toEqual(new Map());
    // Days only.
    for (const day of (await seen("asker", [shopperId, staffId])).values()) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("puts the shops with the most flags first, then the longest without a check-in, then by name (role views spec 6)", async () => {
    await world.setRoles("asker", ["mentor"]);
    const shopper = await world.openShop("shopper");
    const seller = await world.openShop("seller");
    await world.setMentor(shopper, "asker");
    await world.setMentor(seller, "asker");
    const order = async () => (await shopsFor("asker")).map((shop) => shop.slug);
    // One flag each (no listings yet) and no check-ins: by name, "Contract Seller's shop" first.
    expect(await order()).toEqual([seller, shopper]);
    // A check-in at Seller's: Shopper's has gone longer without one.
    await note("asker", "seller", "Checked in about the first listing.", new Date(), true);
    expect(await order()).toEqual([shopper, seller]);
    // Seller's is paused by its seller: two flags beat one.
    await world.pauseShop(seller, "seller");
    expect(await order()).toEqual([seller, shopper]);
  });
}
