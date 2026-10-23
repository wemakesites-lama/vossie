import "server-only";
import { sastDate } from "@/lib/time";
import type { BookingStatus, HubBooking, HubPost, HubPostKind } from "@/lib/types";
import type * as Sample from "../hub-posts";
import { HUB_BANNER_IMAGE, ownBookingsFrom, toHubPost } from "../hub-posts";
import { Refused, type RefusalCode } from "../refused";
import type { HubBookingRow, HubPostRow } from "../rows";
import { tagHub } from "../tags";
import { forPublic, forViewer, type DbClient } from "./clients";
import { dbPhotoId, removePhotoFiles } from "./photos";
import { type AsyncTwin, campusFromDb, campusToDb, iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// The Hub's public posts on Supabase (2b plan Task 16): the sample module's public reads, over the hub_cards view,
// which shows published posts only, with an event's count and its RSVPs added (going_now), and no author. Staff's
// reads and writes, RSVPs and slot requests follow (C4/C5 plan Task 18).

/**
 * Every published post as buyers see it, by id (the samples' h-001 to h-018 come out in the store's order), through
 * the cookieless client. Cached, tagged `hub`.
 * - A cover photo is served at /photos/<uuid> (C2 serves covers, and refuses a draft's: step 2 review M4); otherwise
 *   the post's placeholder art, or the Hub's banner.
 * - The campus is "all" where the database has null (spec amendment 12.2).
 */
export async function publishedPostRows(): Promise<HubPost[]> {
  "use cache";
  tagHub();
  const rows = await selectAll(
    () =>
      forPublic()
        .from("hub_cards")
        .select(
          "id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going_now, image_src, image_alt, cover_photo_id, published_at, created_at",
        ),
    ["id"],
  );
  return rows.flatMap((row) => {
    if (!row.id || !row.kind || !row.title || row.summary === null || row.body === null || !row.created_at) return [];
    const image = row.cover_photo_id
      ? { src: `/photos/${row.cover_photo_id}`, alt: "" }
      : { src: row.image_src ?? HUB_BANNER_IMAGE.src, alt: row.image_alt ?? "" };
    return [
      toHubPost(
        {
          id: row.id,
          kind: row.kind as HubPostKind,
          title: row.title,
          summary: row.summary,
          place: row.place,
          body: row.body,
          campusSlug: campusFromDb(row.campus_slug),
          startsAt: iso(row.starts_at),
          capacity: row.capacity,
          image,
          publishedAt: iso(row.published_at ?? row.created_at),
          createdAt: iso(row.created_at),
        },
        row.going_now,
      ),
    ];
  });
}

/** The published posts, for the feed, the homepage's What's on and post pages. */
export const publishedPosts: AsyncTwin<typeof Sample.publishedPosts> = async () => publishedPostRows();

/** A published post's page; null for a draft or an unknown id, which answer 404. */
export const publishedPost: AsyncTwin<typeof Sample.publishedPost> = async (id) =>
  (await publishedPostRows()).find((post) => post.id === id) ?? null;

// --- Staff's posts, RSVPs and slot requests (C4/C5 plan Task 18; decisions 2, 3, 6 and 18) ----------------------------
//
// Staff read every post, drafts and authors included, through staff_hub_posts with their own session; first names
// come from profiles (staff read every one). Saving is save_hub_post with the saver's session: it checks the role and
// whose post it is, takes a new post's one-time token, makes a new cover the post's and writes the audit entry in one
// transaction (decision 3), and gives back the files of a replaced cover, which go from Storage after it commits
// (C2's removePhotoFiles, which never throws: a file it misses is the daily sweep's). RSVPs and slot requests are the
// student's own (rsvp, cancel_rsvp, request_slot, hub_rsvps and hub_bookings through their session); Accept and
// Decline are answer_booking with the staff member's, which tells the student. Results the sample's shapes can't carry
// throw Refused. Request-time only, never cached.

const STAFF_POST_COLUMNS =
  "id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going, image_src, image_alt, cover_photo_id, published, published_at, author_id, created_at, updated_at";

/** What a sample post's author, or a deleted one, is called (as the sample module). */
const THE_HUB = "The Hub";
const DELETED = "Deleted account";
const REMOVED_OFFICE_HOURS = "Office hours that were removed";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type StaffPostRecord = {
  id: string | null;
  kind: string | null;
  title: string | null;
  summary: string | null;
  place: string | null;
  body: string | null;
  campus_slug: string | null;
  starts_at: string | null;
  capacity: number | null;
  going: number | null;
  image_src: string | null;
  image_alt: string | null;
  cover_photo_id: string | null;
  published: boolean | null;
  published_at: string | null;
  author_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** A staff_hub_posts row as the store's HubPostRow: a cover is /photos/<id>, no cover the post's art or the banner. */
function postRowFrom(row: StaffPostRecord): HubPostRow {
  const image = row.cover_photo_id
    ? { src: `/photos/${row.cover_photo_id}`, alt: "" }
    : { src: row.image_src ?? HUB_BANNER_IMAGE.src, alt: row.image_alt ?? "" };
  return {
    id: row.id!,
    kind: row.kind as HubPostKind,
    title: row.title!,
    campusSlug: campusFromDb(row.campus_slug),
    startsAt: iso(row.starts_at),
    place: row.place,
    capacity: row.capacity,
    going: row.going,
    summary: row.summary!,
    body: row.body!,
    image,
    published: row.published === true,
    publishedAt: iso(row.published_at),
    authorId: row.author_id,
    createdAt: iso(row.created_at!),
    updatedAt: iso(row.updated_at!),
  };
}

/** First names by account id, a hundred ids a request. */
async function firstNames(client: DbClient, ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await client.from("profiles").select("id, first_name").in("id", unique.slice(from, from + 100));
    if (error) failed("profiles", error);
    for (const row of data) names.set(row.id, row.first_name);
  }
  return names;
}

/** Every post, drafts included, most recently changed first; the samples' ties newest id first, as the store's. */
export const listPostsForStaff: typeof Sample.listPostsForStaff = async () => {
  const client = await forViewer();
  const rows = (await selectAll(() => client.from("staff_hub_posts").select(STAFF_POST_COLUMNS), ["id"])).map(postRowFrom);
  const names = await firstNames(
    client,
    rows.map((row) => row.authorId),
  );
  return rows
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id))
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
      authorName: (row.authorId ? names.get(row.authorId) : undefined) ?? THE_HUB,
    }));
};

async function staffPost(client: DbClient, id: string): Promise<HubPostRow | null> {
  const { data, error } = await client.from("staff_hub_posts").select(STAFF_POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) failed("staff_hub_posts", error);
  return data ? postRowFrom(data) : null;
}

/** A post's row, drafts included, for the editor. */
export const getPostRow: typeof Sample.getPostRow = async (id) => staffPost(await forViewer(), id);

/** save_hub_post's answers that the sample's shape has no room for (decision 2). */
const SAVE_REFUSALS: readonly RefusalCode[] = ["forbidden", "date-past", "cover-invalid", "once-expired", "once-taken"];

/**
 * Saves a post with the saver's session (decisions 6 and 18): a new cover is one of the Hub's waiting photos, sent by
 * its id; the post's own cover, or none, keeps what it has. A new post's one-time token is taken in the same
 * transaction. 'created' and 'changed' give the post read back, published now when it had never been and is now;
 * 'nothing' the post as it is; 'not-found' null. The files of a replaced cover go after the save, and a failed removal
 * never undoes it.
 */
export const saveHubPost: typeof Sample.saveHubPost = async (save) => {
  const client = await forViewerAs(save.authorId);
  const before = save.id ? await staffPost(client, save.id) : null;
  const { fields } = save;
  const coverId = save.cover ? dbPhotoId(save.cover.src) : null;
  const { data, error } = await client.rpc("save_hub_post", {
    p_id: save.id as string,
    p_kind: fields.kind,
    p_title: fields.title,
    p_campus: campusToDb(fields.campusSlug) as string,
    p_starts_at: fields.startsAt as string,
    p_place: fields.place as string,
    p_capacity: fields.capacity as number,
    p_summary: fields.summary,
    p_body: fields.body,
    p_published: fields.published,
    ...(coverId ? { p_cover_photo_id: coverId } : {}),
    ...(save.id === null && save.onceToken ? { p_once_token: save.onceToken } : {}),
  });
  if (error) failed("save_hub_post", error);
  const answer = data as { result: string; id?: string; removed_paths?: string[] };
  if (answer.result === "not-found") return null;
  if (SAVE_REFUSALS.includes(answer.result as RefusalCode)) throw new Refused(answer.result as RefusalCode);
  if (answer.result !== "created" && answer.result !== "changed" && answer.result !== "nothing") {
    throw new Error(`save_hub_post answered ${answer.result}`);
  }
  // The replaced cover's files: after the commit, and never a reason to fail the save (amendment 12).
  await removePhotoFiles(answer.removed_paths ?? []).catch(() => 0);
  const row = await staffPost(client, answer.id!);
  if (!row) throw new Error("save_hub_post's post can't be read back");
  const created = answer.result === "created";
  const changed = answer.result !== "nothing";
  return {
    row,
    created,
    publishedNow: changed && row.publishedAt !== null && (created || before?.publishedAt === null),
    changed,
  };
};

/** RSVP with the student's session: rsvp's answer is the sample's. */
export const addRsvp: typeof Sample.addRsvp = async (postId, accountId) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("rsvp", { p_post: postId });
  if (error) failed("rsvp", error);
  return data as Sample.RsvpResult;
};

export const removeRsvp: typeof Sample.removeRsvp = async (postId, accountId) => {
  const { data, error } = await (await forViewerAs(accountId)).rpc("cancel_rsvp", { p_post: postId });
  if (error) failed("cancel_rsvp", error);
  return data === "changed";
};

export const hasRsvp: typeof Sample.hasRsvp = async (postId, accountId) => {
  const { data, error } = await (await forViewerAs(accountId))
    .from("hub_rsvps")
    .select("post_id")
    .eq("post_id", postId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) failed("hub_rsvps", error);
  return data !== null;
};

const BOOKING_COLUMNS = "id, post_id, account_id, help, time, status, created_at, answered_at, answered_by";

type BookingRecord = {
  id: string;
  post_id: string;
  account_id: string;
  help: string;
  time: string;
  status: string;
  created_at: string;
  answered_at: string | null;
  answered_by: string | null;
};

function bookingRowFrom(row: BookingRecord): HubBookingRow {
  return {
    id: row.id,
    postId: row.post_id,
    accountId: row.account_id,
    help: row.help,
    time: row.time,
    status: row.status as BookingStatus,
    createdAt: iso(row.created_at),
    answeredAt: iso(row.answered_at),
    answeredBy: row.answered_by,
  };
}

type PostTitle = { id: string | null; title: string | null; starts_at: string | null };

/**
 * The office hours bookings name: hub staff read every post (staff_hub_posts); a student reads published ones
 * (hub_posts), and a post put back to draft is "removed" to them.
 */
async function postTitles(client: DbClient, ids: readonly string[], staff: boolean): Promise<PostTitle[]> {
  const unique = [...new Set(ids)];
  const { data, error } = staff
    ? await client.from("staff_hub_posts").select("id, title, starts_at").in("id", unique)
    : await client.from("hub_posts").select("id, title, starts_at").in("id", unique);
  if (error) failed(staff ? "staff_hub_posts" : "hub_posts", error);
  return data;
}

/** Bookings as the queue and the request page show them: the office hours' title and start, the student's name. */
async function bookingViews(client: DbClient, rows: readonly BookingRecord[], staff: boolean): Promise<HubBooking[]> {
  if (rows.length === 0) return [];
  const [posts, names] = await Promise.all([
    postTitles(
      client,
      rows.map((row) => row.post_id),
      staff,
    ),
    firstNames(
      client,
      rows.map((row) => row.account_id),
    ),
  ]);
  const postOf = new Map(posts.map((post) => [post.id, post]));
  return rows.map((row) => {
    const post = postOf.get(row.post_id);
    return {
      id: row.id,
      postId: row.post_id,
      postTitle: post?.title ?? REMOVED_OFFICE_HOURS,
      startsAt: iso(post?.starts_at ?? null),
      studentName: names.get(row.account_id) ?? DELETED,
      help: row.help,
      time: row.time,
      status: row.status as BookingStatus,
      createdAt: iso(row.created_at),
    };
  });
}

/**
 * Request a slot with the student's session (request_slot tells the post's author itself, decision 3, so `authorId`
 * is null here and the action tells nobody). The new request, read back, and the office hours' title.
 */
export const requestSlot: typeof Sample.requestSlot = async ({ postId, accountId, help, time }) => {
  const client = await forViewerAs(accountId);
  const { data, error } = await client.rpc("request_slot", { p_post: postId, p_help: help, p_time: time });
  if (error) failed("request_slot", error);
  if (data === "open-already" || data === "closed") return data;
  if (data !== "requested") throw new Error(`request_slot answered ${String(data)}`);
  const [booking, post] = await Promise.all([
    client
      .from("hub_bookings")
      .select(BOOKING_COLUMNS)
      .eq("post_id", postId)
      .eq("account_id", accountId)
      .eq("status", "open")
      .single(),
    client.from("hub_posts").select("title").eq("id", postId).single(),
  ]);
  if (booking.error) failed("hub_bookings", booking.error);
  if (post.error) failed("hub_posts", post.error);
  return { booking: bookingRowFrom(booking.data), authorId: null, postTitle: post.data.title };
};

/** The student's newest request for these office hours, with their own session. */
export const latestBooking: typeof Sample.latestBooking = async (postId, accountId) => {
  const client = await forViewerAs(accountId);
  const { data, error } = await client
    .from("hub_bookings")
    .select(BOOKING_COLUMNS)
    .eq("post_id", postId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) failed("hub_bookings", error);
  return (await bookingViews(client, data, false))[0] ?? null;
};

/**
 * The student's upcoming RSVPs and slot requests (role views N5, plan decision 9), with their own session: hub_rsvps
 * and hub_bookings let a student read only their own rows, and hub_posts only published posts, so a post taken back
 * to a draft drops out as it does in the sample.
 */
export const listOwnBookings: typeof Sample.listOwnBookings = async (accountId, now) => {
  const client = await forViewerAs(accountId);
  const [rsvps, requests] = await Promise.all([
    selectAll(() => client.from("hub_rsvps").select("post_id").eq("account_id", accountId), ["post_id"]),
    selectAll(
      () => client.from("hub_bookings").select("id, post_id, status, created_at").eq("account_id", accountId),
      ["id"],
    ),
  ]);
  const ids = [...rsvps.map((row) => row.post_id), ...requests.map((row) => row.post_id)];
  const posts = ids.length === 0 ? [] : await postTitles(client, ids, false);
  return ownBookingsFrom({
    rsvpPostIds: rsvps.map((row) => row.post_id),
    requests: requests.map((row) => ({
      id: row.id,
      postId: row.post_id,
      status: row.status as BookingStatus,
      createdAt: iso(row.created_at),
    })),
    posts: new Map(
      posts.flatMap((post) =>
        post.id && post.title ? [[post.id, { id: post.id, title: post.title, startsAt: iso(post.starts_at) }] as const] : [],
      ),
    ),
    today: sastDate(now),
  });
};

/** The office-hours queue: open requests oldest first (role views spec 6), then the 30 most recently answered (hub staff read every one). */
export const listBookings: typeof Sample.listBookings = async () => {
  const client = await forViewer();
  const [open, answered] = await Promise.all([
    selectAll(
      () =>
        client
          .from("hub_bookings")
          .select(BOOKING_COLUMNS)
          .eq("status", "open")
          .order("created_at", { ascending: true }),
      ["id"],
    ),
    client
      .from("hub_bookings")
      .select(BOOKING_COLUMNS)
      .neq("status", "open")
      .order("answered_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
  ]);
  if (answered.error) failed("hub_bookings", answered.error);
  const oldestFirst = [...open].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  return bookingViews(client, [...oldestFirst, ...answered.data], true);
};

export const openBookingCount: typeof Sample.openBookingCount = async () => {
  const { count, error } = await (await forViewer())
    .from("hub_bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) failed("hub_bookings", error);
  return count ?? 0;
};

/**
 * Accept or Decline with the staff member's session: answer_booking answers an open request once, writes the entry
 * and tells the student (decision 3). The student and the office hours, read back; null when it wasn't open.
 */
export const answerBooking: typeof Sample.answerBooking = async (id, answer, staffId) => {
  if (!UUID.test(id)) return null;
  const client = await forViewerAs(staffId);
  const { data, error } = await client.rpc("answer_booking", { p_booking: id, p_accept: answer === "accepted" });
  if (error) failed("answer_booking", error);
  if (data === "nothing") return null;
  if (data === "forbidden") throw new Refused("forbidden");
  if (data !== "changed") throw new Error(`answer_booking answered ${String(data)}`);
  const booking = await client.from("hub_bookings").select(BOOKING_COLUMNS).eq("id", id).single();
  if (booking.error) failed("hub_bookings", booking.error);
  const [view] = await bookingViews(client, [booking.data], true);
  return { accountId: booking.data.account_id, postId: booking.data.post_id, postTitle: view.postTitle, studentName: view.studentName };
};
