import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  addRsvp,
  answerBooking,
  getPostRow,
  HUB_BANNER_IMAGE,
  hasRsvp,
  latestBooking,
  listBookings,
  listPostsForStaff,
  openBookingCount,
  removeRsvp,
  requestSlot,
  saveHubPost,
} from "@/lib/data/hub-posts";
import { isRefused } from "@/lib/data/refused";
import { addDays } from "@/lib/looking-for/rules";
import type { PostFields } from "@/lib/staff/post-rules";
import { sastDate } from "@/lib/time";
import type { World, WorldAccountName } from "@/tests/contract/world";

// The Hub's staff side in both backends (C4/C5 plan Task 18; decisions 2, 3 and 6): saving a post (once with its
// token, nothing on an unchanged save), RSVPs and slot requests, and Accept or Decline. On Supabase each write is the
// function of the same name with the signed-in session: save_hub_post writes its own audit entry, so the log grows on
// Supabase only at this level (the action writes it on the sample store, which lib/staff/contract/hub.contract.ts
// proves on both). hub-staff.test.ts runs it on the sample store, hub-staff.db.test.ts on the local stack.

/** A day a week ahead, at 10:00 in South Africa (08:00 UTC): never a start that has passed. */
const AHEAD = () => `${addDays(sastDate(new Date()), 7)}T08:00:00.000Z`;

const TIP: PostFields = {
  kind: "tip",
  title: "Contract tip on pricing",
  campusSlug: "all",
  startsAt: null,
  place: null,
  capacity: null,
  summary: "A tip the contract tests post and take away again.",
  body: "## Price by the hour\n- Materials\n- Transport",
  published: true,
};

export function hubStaffContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyStaffTools();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  /** A one-time token in the account's session, as the editor draws one. */
  const token = async (name: WorldAccountName) => {
    const value = randomUUID();
    await world.onceRow(name, `staff-once:${value}`);
    return value;
  };
  const save = (name: WorldAccountName, id: string | null, fields: PostFields, onceToken?: string) =>
    world.asViewer(name, (accountId) => saveHubPost({ id, fields, cover: null, authorId: accountId, now: new Date(), onceToken }));
  const newPost = async (fields: PostFields) => {
    const made = await save("staff", null, fields, await token("staff"));
    return made!.row.id;
  };
  /** The audit entries a save writes at this level: save_hub_post's own on Supabase, none on the sample store. */
  const logged = (n: number) => (world.name === "supabase" ? n : 0);

  it("makes a new post with its token, leaves an unchanged save alone, and changes an edit", async () => {
    const staffId = await world.signedIn("staff");
    const before = await world.auditCount();
    const made = await save("staff", null, TIP, await token("staff"));
    expect(made).toMatchObject({
      created: true,
      publishedNow: true,
      changed: true,
      row: { kind: "tip", title: TIP.title, campusSlug: "all", published: true, authorId: staffId, image: HUB_BANNER_IMAGE },
    });
    expect(made!.row.publishedAt).toEqual(expect.any(String));
    expect(await world.auditCount()).toBe(before + logged(1));
    const id = made!.row.id;

    const same = await save("staff", id, TIP);
    expect(same).toMatchObject({ created: false, publishedNow: false, changed: false, row: { id, title: TIP.title } });
    expect(same!.row.updatedAt).toBe(made!.row.updatedAt);
    expect(await world.auditCount()).toBe(before + logged(1));

    const edited = await save("staff", id, { ...TIP, title: "Contract tip on pricing, edited" });
    expect(edited).toMatchObject({ created: false, publishedNow: false, changed: true, row: { id, title: "Contract tip on pricing, edited" } });
    expect(await world.auditCount()).toBe(before + logged(2));
    expect(await world.asViewer("staff", () => getPostRow(id))).toEqual(edited!.row);
    expect((await world.asViewer("staff", () => listPostsForStaff()))[0]).toMatchObject({ id, authorId: staffId, authorName: "Staff" });
    expect(await save("staff", "h-no-such-post", TIP)).toBeNull();
  });

  it("dates a draft from its first publish", async () => {
    const draft = await save("staff", null, { ...TIP, published: false }, await token("staff"));
    expect(draft).toMatchObject({ created: true, publishedNow: false, row: { published: false, publishedAt: null } });
    const published = await save("staff", draft!.row.id, TIP);
    expect(published).toMatchObject({ changed: true, publishedNow: true, row: { published: true } });
    expect(published!.row.publishedAt).toEqual(expect.any(String));
    const again = await save("staff", draft!.row.id, { ...TIP, published: false });
    expect(again).toMatchObject({ changed: true, publishedNow: false, row: { published: false, publishedAt: published!.row.publishedAt } });
  });

  it("on Supabase takes a new post's token in the save, and refuses a mentor's edit of someone else's post", async () => {
    if (world.name !== "supabase") return;
    const once = await token("staff");
    const id = (await save("staff", null, TIP, once))!.row.id;
    const refusal = async (work: () => Promise<unknown>) => work().then(() => null, (error: unknown) => error);
    expect(isRefused(await refusal(() => save("staff", null, TIP, once)), "once-taken")).toBe(true);
    expect(isRefused(await refusal(() => save("staff", null, TIP, randomUUID())), "once-expired")).toBe(true);
    await world.setRoles("asker", ["mentor"]);
    const before = await world.auditCount();
    expect(isRefused(await refusal(() => save("asker", id, { ...TIP, title: "A mentor's change" })), "forbidden")).toBe(true);
    expect(await world.asViewer("staff", () => getPostRow(id))).toMatchObject({ title: TIP.title });
    expect(await world.auditCount()).toBe(before);
    expect((await world.asViewer("staff", () => listPostsForStaff())).filter((post) => post.title === TIP.title)).toHaveLength(1);
  });

  it("takes RSVPs to a published event until it's full, never to a tip, and cancels one", async () => {
    const event = await newPost({ ...TIP, kind: "event", title: "Contract market day", campusSlug: "pretoria", startsAt: AHEAD(), place: "The Hub", capacity: 1 });
    const tip = await newPost(TIP);
    const now = new Date();
    const rsvp = (name: WorldAccountName, postId: string) => world.asViewer(name, (id) => addRsvp(postId, id, sastDate(now), now));
    expect(await rsvp("asker", event)).toBe("going");
    expect(await rsvp("asker", event)).toBe("already");
    expect(await rsvp("shopper", event)).toBe("full");
    expect(await rsvp("asker", tip)).toBe("closed");
    expect(await world.asViewer("asker", (id) => hasRsvp(event, id))).toBe(true);
    expect(await world.asViewer("shopper", (id) => hasRsvp(event, id))).toBe(false);
    expect(await world.asViewer("asker", (id) => removeRsvp(event, id))).toBe(true);
    expect(await world.asViewer("asker", (id) => removeRsvp(event, id))).toBe(false);
    expect(await world.asViewer("asker", (id) => hasRsvp(event, id))).toBe(false);
    expect(await rsvp("shopper", event)).toBe("going");
  });

  it("takes one open slot request a student, shows it to them, and answers it once", async () => {
    const askerId = await world.signedIn("asker");
    const title = "Contract office hours";
    const post = await newPost({ ...TIP, kind: "office-hours", title, campusSlug: "pretoria", startsAt: AHEAD(), place: "The Hub" });
    const now = new Date();
    const ask = () =>
      world.asViewer("asker", (id) =>
        requestSlot({ postId: post, accountId: id, help: "How to price a braid.", time: "After 13:00", today: sastDate(now), now }),
      );
    const openBefore = await world.asViewer("staff", () => openBookingCount());
    const made = await ask();
    expect(made).toMatchObject({ postTitle: title, booking: { postId: post, accountId: askerId, help: "How to price a braid.", time: "After 13:00", status: "open" } });
    expect(await ask()).toBe("open-already");
    const booking = (made as Exclude<typeof made, string>).booking;
    expect(await world.asViewer("asker", (id) => latestBooking(post, id))).toMatchObject({
      id: booking.id,
      postId: post,
      postTitle: title,
      studentName: "Asker",
      status: "open",
      createdAt: booking.createdAt,
    });
    expect(await world.asViewer("staff", () => openBookingCount())).toBe(openBefore + 1);
    // Open requests come oldest first (role views spec 6), so the one just made is the last open one.
    const open = (await world.asViewer("staff", () => listBookings())).filter((row) => row.status === "open");
    expect(open.at(-1)).toMatchObject({ id: booking.id, studentName: "Asker", status: "open" });

    const answer = () => world.asViewer("staff", (id) => answerBooking(booking.id, "accepted", id, new Date()));
    expect(await answer()).toEqual({ accountId: askerId, postId: post, postTitle: title, studentName: "Asker" });
    expect(await answer()).toBeNull();
    expect(await world.asViewer("staff", () => openBookingCount())).toBe(openBefore);
    expect(await world.asViewer("asker", (id) => latestBooking(post, id))).toMatchObject({ id: booking.id, status: "accepted" });
    expect(await world.asViewer("staff", (id) => answerBooking("bk-no-such-booking", "declined", id, new Date()))).toBeNull();
  });

  it("lists open slot requests oldest first, before the answered ones (role views spec 6)", async () => {
    await world.signedIn("asker");
    await world.signedIn("shopper");
    const post = await newPost({ ...TIP, kind: "office-hours", title: "Contract queue order", campusSlug: "pretoria", startsAt: AHEAD(), place: "The Hub" });
    const ask = async (name: "asker" | "shopper") => {
      const now = new Date();
      const made = await world.asViewer(name, (id) =>
        requestSlot({ postId: post, accountId: id, help: "Pricing.", time: "Any time", today: sastDate(now), now }),
      );
      // Two requests never share a time on either backend.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return (made as Exclude<typeof made, string>).booking.id;
    };
    const first = await ask("asker");
    const second = await ask("shopper");
    const queue = await world.asViewer("staff", () => listBookings());
    const open = queue.filter((row) => row.status === "open");
    // Every open request comes before every answered one, in the order they were asked.
    expect(queue.slice(0, open.length).every((row) => row.status === "open")).toBe(true);
    expect(open.map((row) => row.createdAt)).toEqual([...open.map((row) => row.createdAt)].sort());
    expect(open.findIndex((row) => row.id === first)).toBeLessThan(open.findIndex((row) => row.id === second));
  });
}
