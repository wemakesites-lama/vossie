import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { hasPassed } from "@/lib/hub";
import { isAdmin } from "@/lib/staff/roles";
import type { PostFields } from "@/lib/staff/post-rules";
import { sastDate } from "@/lib/time";
import type { Account, BookingStatus, HubBooking, HubPost, HubPostKind, ImageRef, OwnBooking } from "@/lib/types";
import type { HubBookingRow, HubPostRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's posts (staff tools spec 2.4; plan decisions 11 to 14), moved from the fixture into the store so staff can
// write them: public pages read published posts only, as part B's HubPost, with an event's RSVPs added to its count;
// staff list, write and edit them, drafts included. RSVPs and slot requests live here too (spec 2.5). Only Server
// Actions write; pages read. Times and "today" come from the caller.
//
// On Supabase (C4/C5 plan Task 18) each staff read and write, RSVP and slot request is lib/data/supabase/hub-posts.ts's,
// picked by its first line through import(), so sample mode never loads Supabase code.

const supabase = () => import("./supabase/hub-posts");

/** A post with no cover shows the Hub's banner art (plan decision 11). */
export const HUB_BANNER_IMAGE: ImageRef = { src: "/placeholders/hub/banner.svg", alt: "" };

/** What a sample post's author, or a deleted one, is called. */
const THE_HUB = "The Hub";
const DELETED = "Deleted account";

const rsvpKey = (postId: string, accountId: string) => `${postId}:${accountId}`;

function rsvpCount(postId: string): number {
  return [...sampleStore().hubRsvps.values()].filter((row) => row.postId === postId).length;
}

/** What toHubPost reads of a row: everything buyers see, and when it was made. */
export type HubPostCard = Omit<HubPostRow, "published" | "authorId" | "updatedAt" | "going">;

/**
 * A published row as part B's HubPost, with `going` given: the count before Vossie's RSVPs, plus them (plan decision
 * 13), or null for office hours and tips. Pure, so the Supabase twin (lib/data/supabase/hub-posts.ts) shares it.
 */
export function toHubPost(row: HubPostCard, going: number | null): HubPost {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    campusSlug: row.campusSlug,
    publishedAt: row.publishedAt ?? row.createdAt,
    startsAt: row.startsAt,
    place: row.place,
    capacity: row.capacity,
    going,
    summary: row.summary,
    body: row.body,
    image: { ...row.image },
  };
}

/** A store row as buyers see it, its RSVPs counted. */
function sampleHubPost(row: HubPostRow): HubPost {
  return toHubPost(row, row.going === null ? null : row.going + rsvpCount(row.id));
}

/** The published posts, for the feed, the homepage's What's on and post pages. A draft is staff's only (spec 2.4). */
export function publishedPosts(): HubPost[] {
  return [...sampleStore().hubPosts.values()].filter((row) => row.published).map(sampleHubPost);
}

/** A published post's page; null for a draft or an unknown id, which answer 404. */
export function publishedPost(id: string): HubPost | null {
  const row = sampleStore().hubPosts.get(id);
  return row?.published ? sampleHubPost(row) : null;
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
  if (onSupabase()) return (await supabase()).listPostsForStaff();
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
  if (onSupabase()) return (await supabase()).getPostRow(id);
  const row = sampleStore().hubPosts.get(id);
  return row ? structuredClone(row) : null;
}

/** Mentors edit their own posts; admins edit any, the samples included (plan decision 11). */
export function canEditPost(account: Pick<Account, "id" | "roles">, post: Pick<HubPostRow, "authorId">): boolean {
  return isAdmin(account) || post.authorId === account.id;
}

export type PostSave = {
  /** Null for a new post. */
  id: string | null;
  fields: PostFields;
  /** A new cover (one of the Hub's stored photos), or null to keep the current one (the banner for a new post). */
  cover: ImageRef | null;
  /** Who's saving: a new post's author. An edit keeps the post's author. */
  authorId: string;
  now: Date;
  /**
   * A new post's one-time token (C4/C5 plan decision 6): on Supabase save_hub_post takes it in the same transaction as
   * the insert. The sample ignores it: its action takes the token itself (takeOnceToken).
   */
  onceToken?: string;
};

/**
 * Whether saving `fields` and `cover` would change the post. The same moment is the same time, however it is written:
 * stored times may omit the milliseconds. No new cover (null) keeps the one it has.
 */
function unchanged(row: HubPostRow, fields: PostFields, cover: ImageRef | null): boolean {
  const sameStart =
    row.startsAt === fields.startsAt ||
    (row.startsAt !== null && fields.startsAt !== null && Date.parse(row.startsAt) === Date.parse(fields.startsAt));
  return (
    sameStart &&
    row.kind === fields.kind &&
    row.title === fields.title &&
    row.campusSlug === fields.campusSlug &&
    (row.place ?? null) === fields.place &&
    (row.capacity ?? null) === fields.capacity &&
    row.summary === fields.summary &&
    row.body === fields.body &&
    row.published === fields.published &&
    (cover === null || (cover.src === row.image.src && cover.alt === row.image.alt))
  );
}

/**
 * Saves a post (spec 2.4): a new one with an id of "h-" and a UUID, or changes to an existing one. A post is dated from
 * when it's first published. An event's count starts at 0; a post that stops being an event has none. Null when `id`
 * isn't a post. An existing post saved with every field and its cover as they are is left alone (`changed` false, its
 * updated time kept), so a second press logs nothing (staff tools amendment 15.7). Server Actions only: it makes ids.
 */
export async function saveHubPost(
  save: PostSave,
): Promise<{ row: HubPostRow; created: boolean; publishedNow: boolean; changed: boolean } | null> {
  if (onSupabase()) return (await supabase()).saveHubPost(save);
  const { hubPosts } = sampleStore();
  const existing = save.id ? hubPosts.get(save.id) : undefined;
  if (save.id && !existing) return null;
  if (existing && unchanged(existing, save.fields, save.cover)) {
    return { row: structuredClone(existing), created: false, publishedNow: false, changed: false };
  }
  const at = save.now.toISOString();
  const { published, ...fields } = save.fields;
  const publishedNow = published && !existing?.publishedAt;
  const going = fields.kind === "event" ? (existing?.going ?? 0) : null;
  const row: HubPostRow = {
    id: existing?.id ?? `h-${randomUUID()}`,
    ...fields,
    going,
    image: save.cover ? { ...save.cover } : (existing?.image ?? { ...HUB_BANNER_IMAGE }),
    published,
    publishedAt: existing?.publishedAt ?? (published ? at : null),
    authorId: existing ? existing.authorId : save.authorId,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };
  hubPosts.set(row.id, row);
  return { row: structuredClone(row), created: !existing, publishedNow, changed: true };
}

// --- RSVP (staff tools spec 2.5, plan decision 13) -----------------------------------------------------------------

export type RsvpResult = "going" | "already" | "full" | "closed";

/** RSVP: a published event that hasn't passed (`today` is the SAST date), with a place left. */
export async function addRsvp(postId: string, accountId: string, today: string, now: Date): Promise<RsvpResult> {
  if (onSupabase()) return (await supabase()).addRsvp(postId, accountId, today, now);
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
  if (onSupabase()) return (await supabase()).removeRsvp(postId, accountId);
  return sampleStore().hubRsvps.delete(rsvpKey(postId, accountId));
}

export async function hasRsvp(postId: string, accountId: string): Promise<boolean> {
  if (onSupabase()) return (await supabase()).hasRsvp(postId, accountId);
  return sampleStore().hubRsvps.has(rsvpKey(postId, accountId));
}

// --- Slot requests (staff tools spec 2.4 and 2.5, plan decisions 13 and 14) -----------------------------------------

function toBooking(row: HubBookingRow): HubBooking {
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
    status: row.status,
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
  if (onSupabase()) return (await supabase()).requestSlot({ postId, accountId, help, time, today, now });
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
export async function latestBooking(postId: string, accountId: string): Promise<HubBooking | null> {
  if (onSupabase()) return (await supabase()).latestBooking(postId, accountId);
  const rows = [...sampleStore().hubBookings.values()]
    .filter((row) => row.postId === postId && row.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.length > 0 ? toBooking(rows[0]) : null;
}

// --- The student's own bookings (role views N5, spec 6) -------------------------------------------------------------

/** What ownBookingsFrom needs of a published post. */
export type BookedPost = { id: string; title: string; startsAt: string | null };

/**
 * The student's upcoming bookings (role views spec 6, plan decision 9): an item per RSVP, and one per office hours for
 * its newest slot request, whatever its answer. Only published posts whose SAST day hasn't passed on `today` (today's
 * still count, as on the feed). Soonest first, then by title. Pure, so the Supabase twin shares it.
 */
export function ownBookingsFrom({
  rsvpPostIds,
  requests,
  posts,
  today,
}: {
  rsvpPostIds: readonly string[];
  requests: readonly { id: string; postId: string; status: BookingStatus; createdAt: string }[];
  posts: ReadonlyMap<string, BookedPost>;
  today: string;
}): OwnBooking[] {
  const upcoming = (postId: string): (BookedPost & { startsAt: string }) | null => {
    const post = posts.get(postId);
    if (!post || post.startsAt === null || hasPassed(post, today)) return null;
    return { ...post, startsAt: post.startsAt };
  };
  const items: OwnBooking[] = [];
  for (const postId of new Set(rsvpPostIds)) {
    const post = upcoming(postId);
    if (post) items.push({ kind: "rsvp", postId, title: post.title, startsAt: post.startsAt, status: "going" });
  }
  const newest = new Map<string, (typeof requests)[number]>();
  for (const request of requests) {
    const kept = newest.get(request.postId);
    const later =
      !kept ||
      Date.parse(request.createdAt) > Date.parse(kept.createdAt) ||
      (request.createdAt === kept.createdAt && request.id > kept.id);
    if (later) newest.set(request.postId, request);
  }
  for (const request of newest.values()) {
    const post = upcoming(request.postId);
    if (post) items.push({ kind: "slot", postId: post.id, title: post.title, startsAt: post.startsAt, status: request.status });
  }
  return items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.title.localeCompare(b.title));
}

/** The student's upcoming RSVPs and slot requests, for You (role views spec 6). Only their own. */
export async function listOwnBookings(accountId: string, now: Date): Promise<OwnBooking[]> {
  if (onSupabase()) return (await supabase()).listOwnBookings(accountId, now);
  const { hubPosts, hubRsvps, hubBookings } = sampleStore();
  const posts = new Map<string, BookedPost>();
  for (const row of hubPosts.values()) {
    if (row.published) posts.set(row.id, { id: row.id, title: row.title, startsAt: row.startsAt });
  }
  return ownBookingsFrom({
    rsvpPostIds: [...hubRsvps.values()].filter((row) => row.accountId === accountId).map((row) => row.postId),
    requests: [...hubBookings.values()].filter((row) => row.accountId === accountId),
    posts,
    today: sastDate(now),
  });
}

/**
 * The office-hours queue (plan decision 14; role views spec 6): open requests oldest first, so the one that has waited
 * longest is answered first and the admin's Today can link to it; then the 30 most recently answered.
 */
export async function listBookings(): Promise<HubBooking[]> {
  if (onSupabase()) return (await supabase()).listBookings();
  const rows = [...sampleStore().hubBookings.values()];
  const open = rows
    .filter((row) => row.status === "open")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const answered = rows
    .filter((row) => row.status !== "open")
    .sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""))
    .slice(0, 30);
  return [...open, ...answered].map(toBooking);
}

/** How many requests wait for an answer, for Overview and the Hub's list. */
export async function openBookingCount(): Promise<number> {
  if (onSupabase()) return (await supabase()).openBookingCount();
  return [...sampleStore().hubBookings.values()].filter((row) => row.status === "open").length;
}

/**
 * Accept or Decline (spec 2.4): an open request is answered once (plan decision 23). The student and the office
 * hours, for the notification and the audit entry; null when it wasn't open.
 */
export async function answerBooking(
  id: string,
  answer: "accepted" | "declined",
  staffId: string,
  now: Date,
): Promise<{ accountId: string; postId: string; postTitle: string; studentName: string } | null> {
  if (onSupabase()) return (await supabase()).answerBooking(id, answer, staffId, now);
  const row = sampleStore().hubBookings.get(id);
  if (!row || row.status !== "open") return null;
  Object.assign(row, { status: answer, answeredAt: now.toISOString(), answeredBy: staffId });
  const view = toBooking(row);
  return { accountId: row.accountId, postId: row.postId, postTitle: view.postTitle, studentName: view.studentName };
}
