import { beforeEach, describe, expect, it } from "vitest";
import type { PostFields } from "@/lib/staff/post-rules";
import {
  addRsvp,
  answerBooking,
  canEditPost,
  getPostRow,
  hasRsvp,
  HUB_BANNER_IMAGE,
  latestBooking,
  listBookings,
  listPostsForStaff,
  openBookingCount,
  publishedPost,
  publishedPosts,
  removeRsvp,
  requestSlot,
  saveHubPost,
} from "./hub-posts";
import { resetSampleStore, sampleStore } from "./store";

const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const LATER = new Date("2026-10-15T09:00:00.000Z");

const event: PostFields = {
  kind: "event",
  title: "Market day at the Hub",
  campusSlug: "midrand",
  startsAt: "2026-11-20T16:00:00.000Z",
  place: "The Hub, Block C",
  capacity: 30,
  summary: "Bring what you sell.",
  body: "Tables are free.",
  published: true,
};

const save = (overrides: Partial<Parameters<typeof saveHubPost>[0]> = {}) =>
  saveHubPost({ id: null, fields: event, cover: null, authorId: "acc-mentor", now: NOW, ...overrides });

const slot = (accountId: string, postId = "h-002") =>
  requestSlot({ postId, accountId, help: "Pricing my cakes.", time: "After 13:30", today: TODAY, now: NOW });

beforeEach(() => {
  resetSampleStore();
});

describe("the public pages' posts (staff tools spec 2.4, plan decisions 11 and 13)", () => {
  it("gives only published posts, as part B's shape, with RSVPs added to an event's count", async () => {
    sampleStore().hubPosts.get("h-013")!.published = false;
    expect(publishedPosts()).toHaveLength(21);
    expect(publishedPost("h-013")).toBeNull();
    expect(publishedPost("h-001")).toMatchObject({ id: "h-001", going: 12, capacity: 80 });
    expect(publishedPost("h-001")).not.toHaveProperty("authorId");
    await addRsvp("h-001", "acc-student", TODAY, NOW);
    expect(publishedPost("h-001")?.going).toBe(13);
    expect(publishedPost("h-nope")).toBeNull();
  });
});

describe("staff writing posts (staff tools spec 2.4, plan decisions 11 and 12)", () => {
  it("lists every post for staff, drafts too, newest change first, naming who wrote it", async () => {
    const draft = (await save({ fields: { ...event, published: false } }))!;
    const rows = await listPostsForStaff();
    expect(rows).toHaveLength(23);
    expect(rows[0]).toMatchObject({ id: draft.row.id, published: false, authorName: "Naledi" });
    expect(rows.find((row) => row.id === "h-002")?.authorName).toBe("Naledi");
    expect(rows.find((row) => row.id === "h-001")?.authorName).toBe("The Hub");
  });

  it("saves a new post with an h- id, the Hub's banner for a cover, and nobody going yet", async () => {
    const saved = (await save())!;
    expect(saved).toMatchObject({ created: true, publishedNow: true });
    expect(saved.row).toMatchObject({
      id: expect.stringMatching(/^h-[0-9a-f-]{36}$/),
      image: HUB_BANNER_IMAGE,
      going: 0,
      published: true,
      publishedAt: NOW.toISOString(),
      authorId: "acc-mentor",
      createdAt: NOW.toISOString(),
    });
    expect(publishedPost(saved.row.id)?.title).toBe("Market day at the Hub");
  });

  it("keeps a draft from the public until it's published, and dates it from then", async () => {
    const draft = (await save({ fields: { ...event, published: false } }))!;
    expect(draft.row.publishedAt).toBeNull();
    expect(publishedPost(draft.row.id)).toBeNull();
    const published = (await save({ id: draft.row.id, now: LATER }))!;
    expect(published).toMatchObject({ created: false, publishedNow: true, row: { publishedAt: LATER.toISOString() } });
    const edited = (await save({ id: draft.row.id, now: new Date("2026-10-16T09:00:00.000Z") }))!;
    expect(edited).toMatchObject({ publishedNow: false, row: { publishedAt: LATER.toISOString() } });
  });

  it("edits a post, keeping its cover and author unless a new cover comes, and fits `going` to its kind", async () => {
    const tip = { ...event, kind: "tip" as const, campusSlug: "all", startsAt: null, place: null, capacity: null };
    const edited = (await save({ id: "h-001", fields: tip, authorId: "acc-admin" }))!;
    expect(edited.row).toMatchObject({ kind: "tip", going: null, image: { src: "/placeholders/hub/h-001.svg" }, authorId: null });
    const cover = { src: "/photos/ph-00000000-0000-4000-8000-000000000000", alt: "" };
    expect((await save({ id: "h-001", cover }))!.row).toMatchObject({ kind: "event", going: 0, image: cover });
    expect(await save({ id: "h-nope" })).toBeNull();
    expect((await getPostRow("h-001"))?.title).toBe("Market day at the Hub");
  });

  it("lets a mentor edit their own posts, and an admin any", async () => {
    const naledis = (await getPostRow("h-002"))!;
    const hubs = (await getPostRow("h-001"))!;
    expect(canEditPost({ id: "acc-mentor", roles: ["mentor"] }, naledis)).toBe(true);
    expect(canEditPost({ id: "acc-mentor", roles: ["mentor"] }, hubs)).toBe(false);
    expect(canEditPost({ id: "acc-admin", roles: ["admin"] }, hubs)).toBe(true);
  });
});

describe("RSVP (staff tools spec 2.5, plan decision 13)", () => {
  it("adds a student once to an upcoming event, and cancels", async () => {
    expect(await addRsvp("h-001", "acc-student", TODAY, NOW)).toBe("going");
    expect(await addRsvp("h-001", "acc-student", TODAY, NOW)).toBe("already");
    expect(await hasRsvp("h-001", "acc-student")).toBe(true);
    expect(await removeRsvp("h-001", "acc-student")).toBe(true);
    expect(await removeRsvp("h-001", "acc-student")).toBe(false);
    expect(await hasRsvp("h-001", "acc-student")).toBe(false);
  });

  it("refuses a full event, a past one, a draft, and anything that isn't an event", async () => {
    sampleStore().hubPosts.get("h-003")!.going = 40;
    expect(await addRsvp("h-003", "acc-student", TODAY, NOW)).toBe("full");
    expect(await addRsvp("h-011", "acc-student", TODAY, NOW)).toBe("closed");
    expect(await addRsvp("h-002", "acc-student", TODAY, NOW)).toBe("closed");
    expect(await addRsvp("h-013", "acc-student", TODAY, NOW)).toBe("closed");
    sampleStore().hubPosts.get("h-005")!.published = false;
    expect(await addRsvp("h-005", "acc-student", TODAY, NOW)).toBe("closed");
  });
});

describe("slot requests (staff tools spec 2.4 and 2.5, plan decisions 13 and 14)", () => {
  it("takes one open request per student per office hours, and tells the caller who wrote the post", async () => {
    const made = await slot("acc-seller");
    expect(made).toMatchObject({
      authorId: "acc-mentor",
      postTitle: "Office hours: pricing your hustle",
      booking: { id: expect.stringMatching(/^bk-[0-9a-f-]{36}$/), status: "open", help: "Pricing my cakes." },
    });
    expect(await slot("acc-seller")).toBe("open-already");
    expect(await slot("acc-student", "h-007")).toBe("open-already");
    expect(await slot("acc-seller", "h-012")).toBe("closed");
    expect(await slot("acc-seller", "h-001")).toBe("closed");
  });

  it("shows the student where their latest request stands", async () => {
    expect(await latestBooking("h-007", "acc-student")).toMatchObject({
      id: "bk-s1",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
      status: "open",
    });
    expect(await latestBooking("h-002", "acc-student")).toBeNull();
  });

  it("lists open requests first, oldest first, then answered ones; an answer is given once (role views spec 6)", async () => {
    const made = (await slot("acc-seller")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    expect((await listBookings()).map((booking) => booking.id)).toEqual(["bk-s1", made.booking.id]);
    expect(await openBookingCount()).toBe(2);
    expect(await answerBooking("bk-s1", "accepted", "acc-mentor", LATER)).toEqual({
      accountId: "acc-student",
      postId: "h-007",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
    });
    expect(await answerBooking("bk-s1", "declined", "acc-mentor", LATER)).toBeNull();
    expect((await listBookings()).map((booking) => [booking.id, booking.status])).toEqual([
      [made.booking.id, "open"],
      ["bk-s1", "accepted"],
    ]);
    expect(sampleStore().hubBookings.get("bk-s1")).toMatchObject({ answeredAt: LATER.toISOString(), answeredBy: "acc-mentor" });
  });

  it("lets a student ask again once their request is answered", async () => {
    await answerBooking("bk-s1", "declined", "acc-mentor", LATER);
    expect(typeof (await slot("acc-student", "h-007"))).toBe("object");
  });
});
