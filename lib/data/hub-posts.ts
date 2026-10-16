import { randomUUID } from "node:crypto";
import { hasPassed } from "@/lib/hub";
import { isAdmin } from "@/lib/staff/roles";
import { postLocks, type PostFields, type PostTaken } from "@/lib/staff/post-rules";
import { sastDate } from "@/lib/time";
import type { Account, HubBooking, HubPost, HubPostKind, ImageRef } from "@/lib/types";
import { deletePhotosUsedByNow, handOverPhotoNow } from "./photos";
import type { HubBookingRow, HubPostRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's posts (staff tools spec 2.4; plan decisions 11 to 14), moved from the fixture into the store so staff can
// write them: public pages read published posts only, as part B's HubPost, with an event's RSVPs added to its count;
// staff list, write and edit them, drafts included. RSVPs and slot requests live here too (spec 2.5). Only Server
// Actions write; pages read. Times and "today" (the SAST date) come from the caller. Each write checks and changes the
// store with no await in between (plan amendment 19): the real database does it in a transaction.

/** A post with no cover shows the Hub's banner art (plan decision 11). */
export const HUB_BANNER_IMAGE: ImageRef = { src: "/placeholders/hub/banner.svg", alt: "" };

/**
 * The owner of the Hub's cover photos (plan decision 11, amendment 24): not an account, so a staff member deleting
 * theirs doesn't take Hub content with it. A cover waits under the staff member's own account until the post is saved.
 */
export const HUB_PHOTO_OWNER = "hub";

/** What a post's cover photo is used for. */
export function hubCoverUse(postId: string): string {
  return `post:${postId}`;
}

/** What a sample post's author, or a deleted one, is called. */
const THE_HUB = "The Hub";
const DELETED = "Deleted account";

const rsvpKey = (postId: string, accountId: string) => `${postId}:${accountId}`;

/** RSVPs made on Vossie, not counting a sample event's starting number. */
function rsvpCount(postId: string): number {
  return [...sampleStore().hubRsvps.values()].filter((row) => row.postId === postId).length;
}

/** A published row as part B's HubPost: `going` is the count before Vossie's RSVPs, plus them (plan decision 13). */
function toHubPost(row: HubPostRow): HubPost {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    campusSlug: row.campusSlug,
    publishedAt: row.publishedAt ?? row.createdAt,
    startsAt: row.startsAt,
    place: row.place,
    capacity: row.capacity,
    going: row.going === null ? null : row.going + rsvpCount(row.id),
    summary: row.summary,
    body: row.body,
    image: { ...row.image },
  };
}

/** The published posts, for the feed, the homepage's What's on and post pages. A draft is staff's only (spec 2.4). */
export function publishedPosts(): HubPost[] {
  return [...sampleStore().hubPosts.values()].filter((row) => row.published).map(toHubPost);
}

/** A published post's page; null for a draft or an unknown id, which answer 404. */
export function publishedPost(id: string): HubPost | null {
  const row = sampleStore().hubPosts.get(id);
  return row?.published ? toHubPost(row) : null;
}

/** A post in the Hub's list (/hub/manage). */
export type StaffPostSummary = {
  id: string;
  kind: HubPostKind;
  title: string;
  campusSlug: string;
  startsAt: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  authorId: string | null;
  /** The author's first name, or "The Hub" for a sample post or one whose author has left. */
  authorName: string;
};

/** Every post, drafts included, most recently changed first (spec 3, /hub/manage). */
export async function listPostsForStaff(): Promise<StaffPostSummary[]> {
  const { hubPosts, accounts } = sampleStore();
  return [...hubPosts.values()]
    .reverse()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      campusSlug: row.campusSlug,
      startsAt: row.startsAt,
      published: row.published,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      authorId: row.authorId,
      authorName: (row.authorId ? accounts.get(row.authorId)?.firstName : undefined) ?? THE_HUB,
    }));
}

/** A post's row, drafts included, for the editor. A copy. */
export async function getPostRow(id: string): Promise<HubPostRow | null> {
  const row = sampleStore().hubPosts.get(id);
  return row ? structuredClone(row) : null;
}

/** Mentors edit their own posts; admins edit any, the samples included (plan decision 11). */
export function canEditPost(account: Pick<Account, "id" | "roles">, post: Pick<HubPostRow, "authorId">): boolean {
  return isAdmin(account) || post.authorId === account.id;
}

/** Open requests for these office hours that can still be answered (amendment 23: passed ones don't count). */
function liveRequestCount(post: HubPostRow, today: string): number {
  if (hasPassed(post, today)) return 0;
  return [...sampleStore().hubBookings.values()].filter((row) => row.postId === post.id && row.status === "open")
    .length;
}

/**
 * What a saved post has taken (amendment 26): its kind, the RSVPs made on Vossie (a sample event's starting number is
 * decoration, and nobody behind it is let down by a change) and its open requests that haven't passed.
 */
function takenNow(row: HubPostRow, today: string): PostTaken {
  return { kind: row.kind, rsvps: rsvpCount(row.id), openRequests: liveRequestCount(row, today) };
}

/** What a saved post has taken, for the editor's check (checkPost); null for an unknown id. */
export async function postTaken(id: string, now: Date): Promise<PostTaken | null> {
  const row = sampleStore().hubPosts.get(id);
  return row ? takenNow(row, sastDate(now)) : null;
}

export type PostSave = {
  /** Null for a new post. */
  id: string | null;
  fields: PostFields;
  /**
   * A new cover (the address of a photo waiting under the saver's own account, amendment 24), "remove" for the Hub's
   * banner, or null to keep the current one (the banner for a new post).
   */
  cover: { src: string } | "remove" | null;
  /** Who's saving: a new post's author, and whose waiting photo a new cover must be. An edit keeps the post's author. */
  authorId: string;
  now: Date;
};

/** A save that went through. */
export type PostSaved = { row: HubPostRow; created: boolean; publishedNow: boolean };

/** A save refused because RSVPs or requests came first (amendments 19 and 26), in the form's order. */
export type PostLocked = { locked: ReturnType<typeof postLocks> };

/** The cover a save leaves, handing a new one to the Hub and deleting the one it replaces (amendment 24). */
function coverFor(save: PostSave, postId: string, current: ImageRef | null): ImageRef {
  const use = hubCoverUse(postId);
  if (save.cover === "remove") {
    deletePhotosUsedByNow(HUB_PHOTO_OWNER, use);
    return { ...HUB_BANNER_IMAGE };
  }
  const src = save.cover?.src;
  if (src && src !== current?.src && handOverPhotoNow(save.authorId, src, HUB_PHOTO_OWNER, use)) {
    deletePhotosUsedByNow(HUB_PHOTO_OWNER, use, new Set([src]));
    return { src, alt: "" };
  }
  // No new cover, or one that isn't the saver's waiting photo any more: the post keeps what it had.
  return current ? { ...current } : { ...HUB_BANNER_IMAGE };
}

/**
 * Saves a post (spec 2.4): a new one with an id of "h-" and a UUID, or changes to an existing one. A post is dated from
 * when it's first published. An event's count starts at 0; a post that stops being an event has none. What the post
 * has taken is checked again here, at the moment it writes (amendments 19, 26 and 34): a change of kind once anyone
 * has signed up, or places below the RSVPs, is refused with nothing changed. A new cover becomes the Hub's
 * (amendment 24). Null when `id` isn't a post. Server Actions only: it makes ids.
 */
export async function saveHubPost(save: PostSave): Promise<PostSaved | PostLocked | null> {
  const { hubPosts } = sampleStore();
  const existing = save.id ? hubPosts.get(save.id) : undefined;
  if (save.id && !existing) return null;
  const at = save.now.toISOString();
  if (existing) {
    const locked = postLocks(save.fields, takenNow(existing, sastDate(save.now)));
    if (locked.length > 0) return { locked };
  }
  const { published, ...fields } = save.fields;
  const id = existing?.id ?? `h-${randomUUID()}`;
  const row: HubPostRow = {
    id,
    ...fields,
    going: fields.kind === "event" ? (existing?.going ?? 0) : null,
    image: coverFor(save, id, existing?.image ?? null),
    published,
    publishedAt: existing?.publishedAt ?? (published ? at : null),
    authorId: existing ? existing.authorId : save.authorId,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };
  hubPosts.set(id, row);
  return { row: structuredClone(row), created: !existing, publishedNow: published && !existing?.publishedAt };
}

// --- RSVP (staff tools spec 2.5, plan decision 13) -----------------------------------------------------------------
// Go-live note (amendment 29): every RSVP's action calls hubChanged(), which expires every cached Hub reader. Fine for
// the sample; with real traffic, count RSVPs outside the cache or tag each post on its own.

export type RsvpResult = "going" | "already" | "full" | "closed";

/** RSVP: a published event that hasn't passed (`today` is the SAST date), with a place left. */
export async function addRsvp(postId: string, accountId: string, today: string, now: Date): Promise<RsvpResult> {
  const { hubPosts, hubRsvps } = sampleStore();
  const row = hubPosts.get(postId);
  if (!row?.published || row.kind !== "event" || hasPassed(row, today)) return "closed";
  const key = rsvpKey(postId, accountId);
  if (hubRsvps.has(key)) return "already";
  if (row.capacity !== null && (row.going ?? 0) + rsvpCount(postId) >= row.capacity) return "full";
  hubRsvps.set(key, { key, postId, accountId, createdAt: now.toISOString() });
  return "going";
}

/** Cancel my RSVP. False when there was none. */
export async function removeRsvp(postId: string, accountId: string): Promise<boolean> {
  return sampleStore().hubRsvps.delete(rsvpKey(postId, accountId));
}

export async function hasRsvp(postId: string, accountId: string): Promise<boolean> {
  return sampleStore().hubRsvps.has(rsvpKey(postId, accountId));
}

// --- Slot requests (staff tools spec 2.4 and 2.5, plan decisions 13 and 14; amendment 23) --------------------------

/** Whether an open request can no longer be answered: its office hours' day is over (SAST), or they've gone. */
function requestPassed(row: HubBookingRow, today: string): boolean {
  const post = sampleStore().hubPosts.get(row.postId);
  return row.status === "open" && (!post || hasPassed(post, today));
}

function toBooking(row: HubBookingRow, today: string): HubBooking {
  const { hubPosts, accounts } = sampleStore();
  const post = hubPosts.get(row.postId);
  return {
    id: row.id,
    postId: row.postId,
    postTitle: post?.title ?? "Office hours that were removed",
    startsAt: post?.startsAt ?? null,
    studentName: accounts.get(row.accountId)?.firstName ?? DELETED,
    help: row.help,
    time: row.time,
    status: requestPassed(row, today) ? "passed" : row.status,
    createdAt: row.createdAt,
  };
}

/**
 * Request a slot (spec 2.5): published office hours that haven't passed. One open request per student per office
 * hours (plan decision 13). The new request, the post's author (to tell) and its title.
 */
export async function requestSlot({
  postId,
  accountId,
  help,
  time,
  today,
  now,
}: {
  postId: string;
  accountId: string;
  help: string;
  time: string;
  today: string;
  now: Date;
}): Promise<{ booking: HubBookingRow; authorId: string | null; postTitle: string } | "open-already" | "closed"> {
  const { hubPosts, hubBookings } = sampleStore();
  const post = hubPosts.get(postId);
  if (!post?.published || post.kind !== "office-hours" || hasPassed(post, today)) return "closed";
  for (const row of hubBookings.values()) {
    if (row.postId === postId && row.accountId === accountId && row.status === "open") return "open-already";
  }
  const booking: HubBookingRow = {
    id: `bk-${randomUUID()}`,
    postId,
    accountId,
    help,
    time,
    status: "open",
    createdAt: now.toISOString(),
    answeredAt: null,
    answeredBy: null,
  };
  hubBookings.set(booking.id, booking);
  return { booking: { ...booking }, authorId: post.authorId, postTitle: post.title };
}

/** The student's newest request for these office hours, for its page; null when they haven't asked. */
export async function latestBooking(postId: string, accountId: string, today: string): Promise<HubBooking | null> {
  const rows = [...sampleStore().hubBookings.values()]
    .filter((row) => row.postId === postId && row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.length > 0 ? toBooking(rows[0], today) : null;
}

/** How many answered or passed requests the queue shows, after the open ones. */
const QUEUE_HISTORY = 30;

/**
 * The office-hours queue (plan decision 14, amendment 23): open requests, newest first; then the newest 30 that have
 * passed unanswered, which can't be answered now; then the 30 most recently answered.
 */
export async function listBookings(today: string): Promise<HubBooking[]> {
  const rows = [...sampleStore().hubBookings.values()];
  const newest = (a: HubBookingRow, b: HubBookingRow) => b.createdAt.localeCompare(a.createdAt);
  const waiting = rows.filter((row) => row.status === "open");
  const open = waiting.filter((row) => !requestPassed(row, today)).sort(newest);
  const passed = waiting.filter((row) => requestPassed(row, today)).sort(newest).slice(0, QUEUE_HISTORY);
  const answered = rows
    .filter((row) => row.status !== "open")
    .sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""))
    .slice(0, QUEUE_HISTORY);
  return [...open, ...passed, ...answered].map((row) => toBooking(row, today));
}

/** How many requests wait for an answer, for Overview and the Hub's list. Passed ones don't (amendment 23). */
export async function openBookingCount(today: string): Promise<number> {
  return [...sampleStore().hubBookings.values()].filter((row) => row.status === "open" && !requestPassed(row, today))
    .length;
}

/**
 * Accept or Decline (spec 2.4): an open request is answered once (plan decision 23), and never once its office hours
 * have passed (amendment 23; `now` gives the SAST date). The student and the office hours, for the notification and
 * the audit entry; "passed" for an open request whose office hours are over (the "booking-passed" notice); null when
 * there's no open request (a second press, or an unknown id).
 */
export async function answerBooking(
  id: string,
  answer: "accepted" | "declined",
  staffId: string,
  now: Date,
): Promise<{ accountId: string; postId: string; postTitle: string; studentName: string } | "passed" | null> {
  const row = sampleStore().hubBookings.get(id);
  const today = sastDate(now);
  if (!row || row.status !== "open") return null;
  if (requestPassed(row, today)) return "passed";
  Object.assign(row, { status: answer, answeredAt: now.toISOString(), answeredBy: staffId });
  const view = toBooking(row, today);
  return { accountId: row.accountId, postId: row.postId, postTitle: view.postTitle, studentName: view.studentName };
}
