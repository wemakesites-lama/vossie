import { beforeEach, describe, expect, it } from "vitest";
import type { PostFields } from "@/lib/staff/post-rules";
import { pngBytes } from "@/tests/helpers/image-bytes";
import {
  addRsvp,
  answerBooking,
  canEditPost,
  getPostRow,
  hasRsvp,
  HUB_BANNER_IMAGE,
  HUB_PHOTO_OWNER,
  hubCoverUse,
  latestBooking,
  listBookings,
  listPostsForStaff,
  openBookingCount,
  postTaken,
  publishedPost,
  publishedPosts,
  removeRsvp,
  requestSlot,
  saveHubPost,
  type PostSave,
  type PostSaved,
} from "./hub-posts";
import { photoSrcsOf, storePhotos } from "./photos";
import { resetSampleStore, sampleStore } from "./store";

const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T08:42:00.000Z");
const LATER = new Date("2026-10-15T09:00:00.000Z");
/** After Thandi's office hours (h-007, 19 Nov 2026) are over. */
const AFTER_H007 = "2026-11-20";

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

const tip: PostFields = { ...event, kind: "tip", campusSlug: "all", startsAt: null, place: null, capacity: null };

const attempt = (overrides: Partial<PostSave> = {}) =>
  saveHubPost({ id: null, fields: event, cover: null, authorId: "acc-mentor", now: NOW, ...overrides });

/** A save that went through: its row, whether it made the post, and whether it published it just now. */
async function save(overrides: Partial<PostSave> = {}): Promise<PostSaved> {
  const result = await attempt(overrides);
  if (!result || "locked" in result) throw new Error(`Not saved: ${JSON.stringify(result)}`);
  return result;
}

const slot = (accountId: string, postId = "h-002") =>
  requestSlot({ postId, accountId, help: "Pricing my cakes.", time: "After 13:30", today: TODAY, now: NOW });

/** A cover picked on the editor: a photo waiting under the staff member's own account (plan amendment 24). */
async function waitingCover(ownerId = "acc-mentor"): Promise<string> {
  return (await storePhotos(ownerId, [{ type: "image/png", bytes: pngBytes() }], NOW))[0];
}

beforeEach(() => {
  resetSampleStore();
});

describe("the public pages' posts (staff tools spec 2.4, plan decisions 11 and 13)", () => {
  it("gives only published posts, as part B's shape, with RSVPs added to an event's count", async () => {
    sampleStore().hubPosts.get("h-013")!.published = false;
    expect(publishedPosts()).toHaveLength(17);
    expect(publishedPost("h-013")).toBeNull();
    expect(publishedPost("h-001")).toMatchObject({ id: "h-001", going: 12, capacity: 80 });
    expect(publishedPost("h-001")).not.toHaveProperty("authorId");
    await addRsvp("h-001", "acc-student", TODAY, NOW);
    expect(publishedPost("h-001")?.going).toBe(13);
    expect(publishedPost("h-nope")).toBeNull();
  });

  it("hands out copies, so a caller can't change the store", () => {
    publishedPost("h-001")!.image.src = "/changed.svg";
    expect(sampleStore().hubPosts.get("h-001")?.image.src).toBe("/placeholders/hub/h-001.svg");
  });
});

describe("staff writing posts (staff tools spec 2.4, plan decisions 11 and 12)", () => {
  it("lists every post for staff, drafts too, newest change first, naming who wrote it", async () => {
    const draft = await save({ fields: { ...event, published: false } });
    const rows = await listPostsForStaff();
    expect(rows).toHaveLength(19);
    expect(rows[0]).toMatchObject({ id: draft.row.id, published: false, authorName: "Naledi" });
    expect(rows.find((row) => row.id === "h-002")?.authorName).toBe("Naledi");
    expect(rows.find((row) => row.id === "h-001")?.authorName).toBe("The Hub");
  });

  it("saves a new post with an h- id, the Hub's banner for a cover, and nobody going yet", async () => {
    const saved = await save();
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
    const draft = await save({ fields: { ...event, published: false } });
    expect(draft.row.publishedAt).toBeNull();
    expect(publishedPost(draft.row.id)).toBeNull();
    const published = await save({ id: draft.row.id, now: LATER });
    expect(published).toMatchObject({ created: false, publishedNow: true, row: { publishedAt: LATER.toISOString() } });
    const edited = await save({ id: draft.row.id, now: new Date("2026-10-16T09:00:00.000Z") });
    expect(edited).toMatchObject({ publishedNow: false, row: { publishedAt: LATER.toISOString() } });
  });

  it("edits a post, keeping its cover and author, and fits `going` to its kind", async () => {
    const edited = await save({ id: "h-001", fields: tip, authorId: "acc-admin" });
    expect(edited.row).toMatchObject({
      kind: "tip",
      going: null,
      image: { src: "/placeholders/hub/h-001.svg" },
      authorId: null,
    });
    expect((await save({ id: "h-001" })).row).toMatchObject({ kind: "event", going: 0 });
    expect(await attempt({ id: "h-nope" })).toBeNull();
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

describe("a post's cover (plan decision 11, amendment 24)", () => {
  it("takes the staff member's own waiting photo and gives it to the Hub, so it outlasts their account", async () => {
    const cover = await waitingCover();
    const saved = await save({ cover: { src: cover } });
    expect(saved.row.image).toEqual({ src: cover, alt: "" });
    expect(await photoSrcsOf(HUB_PHOTO_OWNER, hubCoverUse(saved.row.id))).toEqual(new Set([cover]));
    expect(await photoSrcsOf("acc-mentor", null)).toEqual(new Set());
  });

  it("refuses anyone else's photo, a used one and a placeholder, keeping the cover it had", async () => {
    const someoneElses = await waitingCover("acc-admin");
    expect((await save({ cover: { src: someoneElses } })).row.image).toEqual(HUB_BANNER_IMAGE);
    expect(await photoSrcsOf("acc-admin", null)).toEqual(new Set([someoneElses]));
    const first = await save({ cover: { src: await waitingCover() } });
    const used = first.row.image.src;
    expect((await save({ id: "h-002", cover: { src: used } })).row.image.src).toBe("/placeholders/hub/h-002.svg");
    expect((await save({ id: "h-002", cover: { src: "/placeholders/hub/h-001.svg" } })).row.image.src).toBe(
      "/placeholders/hub/h-002.svg",
    );
    expect(await photoSrcsOf(HUB_PHOTO_OWNER, hubCoverUse(first.row.id))).toEqual(new Set([used]));
  });

  it("deletes the old cover when a new one comes, and when the cover is removed shows the Hub's banner", async () => {
    const first = await waitingCover();
    const saved = await save({ cover: { src: first } });
    const second = await waitingCover();
    expect((await save({ id: saved.row.id, cover: { src: second } })).row.image.src).toBe(second);
    expect(await photoSrcsOf(HUB_PHOTO_OWNER, hubCoverUse(saved.row.id))).toEqual(new Set([second]));
    expect((await save({ id: saved.row.id, cover: "remove" })).row.image).toEqual(HUB_BANNER_IMAGE);
    expect(await photoSrcsOf(HUB_PHOTO_OWNER, hubCoverUse(saved.row.id))).toEqual(new Set());
    expect((await save({ id: "h-001", cover: "remove" })).row.image).toEqual(HUB_BANNER_IMAGE);
  });
});

describe("what a post with RSVPs or requests can't change (amendments 19, 26 and 34)", () => {
  it("counts what a saved post has taken: RSVPs on Vossie, and open requests whose office hours haven't passed", async () => {
    expect(await postTaken("h-001", NOW)).toEqual({ kind: "event", rsvps: 0, going: 12, openRequests: 0 });
    await addRsvp("h-001", "acc-student", TODAY, NOW);
    expect(await postTaken("h-001", NOW)).toEqual({ kind: "event", rsvps: 1, going: 13, openRequests: 0 });
    expect(await postTaken("h-007", NOW)).toEqual({ kind: "office-hours", rsvps: 0, going: 0, openRequests: 1 });
    expect(await postTaken("h-007", new Date(`${AFTER_H007}T08:00:00.000Z`))).toMatchObject({ openRequests: 0 });
    expect(await postTaken("h-nope", NOW)).toBeNull();
  });

  it("refuses a change of kind once someone has signed up, and places below the RSVPs taken", async () => {
    const made = await save({ fields: { ...event, capacity: 2 } });
    await addRsvp(made.row.id, "acc-student", TODAY, NOW);
    await addRsvp(made.row.id, "acc-seller", TODAY, NOW);
    expect(await attempt({ id: made.row.id, fields: tip })).toEqual({ locked: ["post-kind-locked"] });
    expect(await attempt({ id: made.row.id, fields: { ...event, capacity: 1 } })).toEqual({
      locked: ["post-capacity-below"],
    });
    expect(sampleStore().hubPosts.get(made.row.id)).toMatchObject({ kind: "event", capacity: 2 });
    expect(await attempt({ id: "h-007", fields: tip })).toEqual({ locked: ["post-kind-locked"] });
    expect((await save({ id: made.row.id, fields: { ...event, capacity: 2, title: "Market day" } })).row.title).toBe(
      "Market day",
    );
  });

  it("keeps places for all the card shows going, a sample event's first number too (amendment 42)", async () => {
    // h-003 starts with 23 going and nobody on Vossie, so its kind may change, but not to fewer places than 23.
    expect(await attempt({ id: "h-003", fields: { ...event, capacity: 5 } })).toEqual({
      locked: ["post-capacity-below"],
    });
    expect(sampleStore().hubPosts.get("h-003")?.capacity).toBe(40);
    expect((await save({ id: "h-003", fields: { ...event, capacity: 23 } })).row.capacity).toBe(23);
    expect((await save({ id: "h-003", fields: tip })).row.kind).toBe("tip");
  });

  it("re-reads the count when the save runs, so an RSVP that arrives first still counts", async () => {
    const made = await save({ fields: { ...event, capacity: 5 } });
    const [rsvp, saved] = await Promise.all([
      addRsvp(made.row.id, "acc-student", TODAY, NOW),
      attempt({ id: made.row.id, fields: tip }),
    ]);
    expect(rsvp).toBe("going");
    expect(saved).toEqual({ locked: ["post-kind-locked"] });
  });

  it("checks and writes with no await between, so an RSVP sent with the save finds a tip (amendment 19)", async () => {
    const made = await save({ fields: { ...event, capacity: 5 } });
    const [saved, rsvp] = await Promise.all([
      attempt({ id: made.row.id, fields: tip }),
      addRsvp(made.row.id, "acc-student", TODAY, NOW),
    ]);
    expect(saved).toMatchObject({ row: { kind: "tip" } });
    expect(rsvp).toBe("closed");
    expect(await hasRsvp(made.row.id, "acc-student")).toBe(false);
  });

  it("leaves the stored cover alone when it refuses", async () => {
    const made = await save({ cover: { src: await waitingCover() } });
    await addRsvp(made.row.id, "acc-student", TODAY, NOW);
    const next = await waitingCover();
    expect(await attempt({ id: made.row.id, fields: tip, cover: { src: next } })).toEqual({
      locked: ["post-kind-locked"],
    });
    expect(sampleStore().hubPosts.get(made.row.id)?.image).toEqual(made.row.image);
    expect(await photoSrcsOf("acc-mentor", null)).toEqual(new Set([next]));
  });
});

describe("RSVP (staff tools spec 2.5, plan decision 13)", () => {
  it("adds a student once to an upcoming event, and cancels", async () => {
    expect(await addRsvp("h-001", "acc-student", TODAY, NOW)).toBe("going");
    expect(await addRsvp("h-001", "acc-student", TODAY, NOW)).toBe("already");
    expect(await hasRsvp("h-001", "acc-student")).toBe(true);
    expect(await removeRsvp("h-001", "acc-student", TODAY)).toBe(true);
    expect(await removeRsvp("h-001", "acc-student", TODAY)).toBe(false);
    expect(await hasRsvp("h-001", "acc-student")).toBe(false);
  });

  it("keeps an RSVP once the event has passed, so its count stays (amendment 42)", async () => {
    const made = await save();
    await addRsvp(made.row.id, "acc-student", TODAY, NOW);
    expect(await removeRsvp(made.row.id, "acc-student", "2026-11-21")).toBe(false);
    expect(await hasRsvp(made.row.id, "acc-student")).toBe(true);
    expect(publishedPost(made.row.id)?.going).toBe(1);
    // The event's own day still counts as ahead (SAST), as for addRsvp.
    expect(await removeRsvp(made.row.id, "acc-student", "2026-11-20")).toBe(true);
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

  it("gives the last place to one of two students pressing at once (amendment 19)", async () => {
    sampleStore().hubPosts.get("h-003")!.going = 39;
    const results = await Promise.all([
      addRsvp("h-003", "acc-student", TODAY, NOW),
      addRsvp("h-003", "acc-seller", TODAY, NOW),
    ]);
    expect(results).toEqual(["going", "full"]);
    expect(publishedPost("h-003")?.going).toBe(40);
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

  it("takes one of two requests sent at once (amendment 19)", async () => {
    const results = await Promise.all([slot("acc-seller"), slot("acc-seller")]);
    expect(results.filter((result) => typeof result === "object")).toHaveLength(1);
    expect(results).toContain("open-already");
  });

  it("shows the student where their latest request stands", async () => {
    expect(await latestBooking("h-007", "acc-student", TODAY)).toMatchObject({
      id: "bk-s1",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
      status: "open",
    });
    expect(await latestBooking("h-002", "acc-student", TODAY)).toBeNull();
  });

  it("lists open requests first, newest first, then answered ones; an answer is given once", async () => {
    const made = (await slot("acc-seller")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    expect((await listBookings(TODAY)).map((booking) => booking.id)).toEqual([made.booking.id, "bk-s1"]);
    expect(await openBookingCount(TODAY)).toBe(2);
    expect(await answerBooking("bk-s1", "accepted", "acc-mentor", LATER)).toEqual({
      accountId: "acc-student",
      postId: "h-007",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
    });
    expect(await answerBooking("bk-s1", "declined", "acc-mentor", LATER)).toBeNull();
    expect(await answerBooking("bk-nope", "declined", "acc-mentor", LATER)).toBeNull();
    expect((await listBookings(TODAY)).map((booking) => [booking.id, booking.status])).toEqual([
      [made.booking.id, "open"],
      ["bk-s1", "accepted"],
    ]);
    expect(sampleStore().hubBookings.get("bk-s1")).toMatchObject({
      answeredAt: LATER.toISOString(),
      answeredBy: "acc-mentor",
    });
  });

  it("answers a request once when Accept and Decline are pressed at once (amendment 19)", async () => {
    const results = await Promise.all([
      answerBooking("bk-s1", "accepted", "acc-mentor", LATER),
      answerBooking("bk-s1", "declined", "acc-admin", LATER),
    ]);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(results.filter((result) => typeof result === "object" && result !== null)).toHaveLength(1);
  });

  it("lets a student ask again once their request is answered", async () => {
    await answerBooking("bk-s1", "declined", "acc-mentor", LATER);
    expect(typeof (await slot("acc-student", "h-007"))).toBe("object");
  });
});

describe("requests for office hours that have passed (amendment 23)", () => {
  it("calls them passed: not counted, listed after open ones, and never answered", async () => {
    // h-002 (15 Oct) has passed by 16 Oct; h-007 (19 Nov) hasn't.
    const early = (await slot("acc-seller")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    await answerBooking("bk-s1", "accepted", "acc-mentor", LATER);
    const again = (await slot("acc-student", "h-007")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    const day = "2026-10-16";
    expect(await openBookingCount(day)).toBe(1);
    expect((await listBookings(day)).map((booking) => [booking.id, booking.status])).toEqual([
      [again.booking.id, "open"],
      [early.booking.id, "passed"],
      ["bk-s1", "accepted"],
    ]);
    expect(await latestBooking("h-002", "acc-seller", day)).toMatchObject({ status: "passed" });
    expect(await answerBooking(early.booking.id, "accepted", "acc-mentor", new Date("2026-10-16T08:00:00.000Z"))).toBe(
      "passed",
    );
    expect(sampleStore().hubBookings.get(early.booking.id)?.status).toBe("open");
  });

  it("counts the office hours' own day as still open (SAST)", async () => {
    expect(await openBookingCount("2026-11-19")).toBe(1);
    expect(await openBookingCount(AFTER_H007)).toBe(0);
    expect(await latestBooking("h-007", "acc-student", AFTER_H007)).toMatchObject({ status: "passed" });
  });

  it("keeps them passed when their past office hours become an event (amendment 42)", async () => {
    const early = (await slot("acc-seller")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    const day = "2026-10-16";
    const later = new Date("2026-10-16T08:00:00.000Z");
    // h-002 (15 Oct) has passed, so its request no longer locks its kind: an admin turns it into a coming event.
    expect(await attempt({ id: "h-002", fields: event, now: later })).toMatchObject({ row: { kind: "event" } });
    expect(await openBookingCount(day)).toBe(1);
    expect((await listBookings(day)).map((booking) => [booking.id, booking.status])).toEqual([
      ["bk-s1", "open"],
      [early.booking.id, "passed"],
    ]);
    expect(await latestBooking("h-002", "acc-seller", day)).toMatchObject({ status: "passed" });
    expect(await answerBooking(early.booking.id, "accepted", "acc-mentor", later)).toBe("passed");
    expect(await postTaken("h-002", later)).toMatchObject({ openRequests: 0 });
  });
});
