import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { newListingsText, newListingText } from "@/lib/following/rules";
import { searchMatchesText, searchMatchText } from "@/lib/saved-searches/words";
import { sastDate } from "@/lib/time";
import type { NotificationItem, NotificationKind } from "@/lib/types";
import type { NotificationRow } from "./rows";
import { sampleStore } from "./store";

// Notifications (messaging spec 2.9 and 3.5; plan decisions 12 and 13): one row per thing that needs an account's
// attention, its sentence and link fixed when it's made. Server Actions make them (only they make ids); pages read
// them and mark them read. Times come from the caller. A busy conversation keeps one unread *message* notification
// per person (plan decision 12); a sale to confirm is its own notification, read once the sale is settled (messaging
// plan amendment 3).
//
// On Supabase (C2/C3 plan Task 12, decision 17) the reads' twins are lib/data/supabase/notifications.ts, picked on each
// function's first line through import(). Every notification is written inside a database function there (its comment
// names which), so the writers below throw on Supabase; their sample bodies are unchanged.

const supabase = () => import("./supabase/notifications");

type NewNotification = {
  accountId: string;
  kind: NotificationKind;
  subjectId: string;
  text: string;
  href: string;
  now: Date;
};

function add({ accountId, kind, subjectId, text, href, now }: NewNotification): void {
  const id = `note-${randomUUID()}`;
  sampleStore().notifications.set(id, {
    id,
    accountId,
    kind,
    subjectId,
    text,
    href,
    createdAt: now.toISOString(),
    readAt: null,
  });
}

/**
 * A notification of any kind: a sale to confirm here; report outcomes, shop approvals and bookings in stage G; an offer,
 * the Hub's word about a request and a followed shop's new listing in stage H (see NotificationKind).
 */
export async function notify(notification: NewNotification): Promise<void> {
  if (onSupabase()) return (await supabase()).notify(notification);
  add(notification);
}

/**
 * Tells `accountId` about a message in a conversation (plan decision 12). While the last such *message*
 * notification is unread, it's brought up to date (its sentence and time) rather than a second one added, so a busy
 * thread doesn't flood the list. Other kinds, a sale to confirm among them, are never folded into it.
 */
export async function notifyAboutMessage({
  accountId,
  conversationId,
  text,
  href,
  now,
}: {
  accountId: string;
  conversationId: string;
  text: string;
  href: string;
  now: Date;
}): Promise<void> {
  if (onSupabase()) return (await supabase()).notifyAboutMessage({ accountId, conversationId, text, href, now });
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId !== accountId || row.kind !== "message" || row.subjectId !== conversationId) continue;
    if (row.readAt !== null) continue;
    row.text = text;
    row.createdAt = now.toISOString();
    return;
  }
  add({ accountId, kind: "message", subjectId: conversationId, text, href, now });
}

function ofAccount(accountId: string): NotificationRow[] {
  return [...sampleStore().notifications.values()]
    .filter((row) => row.accountId === accountId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** The account's newest `limit` notifications, newest first, saying which were new (spec 3.5). Copies. */
export async function getNotifications(accountId: string, limit: number): Promise<NotificationItem[]> {
  if (onSupabase()) return (await supabase()).getNotifications(accountId, limit);
  return ofAccount(accountId)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      text: row.text,
      href: row.href,
      createdAt: row.createdAt,
      isNew: row.readAt === null,
    }));
}

/** How many of the account's notifications are new: the header's badge (spec 2.9). */
export async function countNewNotifications(accountId: string): Promise<number> {
  if (onSupabase()) return (await supabase()).countNewNotifications(accountId);
  return ofAccount(accountId).filter((row) => row.readAt === null).length;
}

/** Opening /notifications marks them all read (spec 2.9). */
export async function markNotificationsRead(accountId: string, now: Date): Promise<void> {
  if (onSupabase()) return (await supabase()).markNotificationsRead(accountId, now);
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId === accountId && row.readAt === null) row.readAt = now.toISOString();
  }
}

/**
 * A sale is settled, by the buyer saying yes or no or by the 7 days passing: the buyer's "sale to confirm"
 * notification for that conversation is read, whether or not they opened it (messaging plan amendment 3). Message
 * notifications are left as they are.
 */
export async function markSaleNotificationsRead(accountId: string, conversationId: string, now: Date): Promise<void> {
  if (onSupabase()) return (await supabase()).markSaleNotificationsRead(accountId, conversationId, now);
  for (const row of sampleStore().notifications.values()) {
    if (
      row.accountId === accountId &&
      row.kind === "sale-to-confirm" &&
      row.subjectId === conversationId &&
      row.readAt === null
    ) {
      row.readAt = now.toISOString();
    }
  }
}

/** Opening a thread marks its notifications read (plan decision 12). */
export async function markConversationNotificationsRead(
  accountId: string,
  conversationId: string,
  now: Date,
): Promise<void> {
  if (onSupabase()) return (await supabase()).markConversationNotificationsRead(accountId, conversationId, now);
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId === accountId && row.subjectId === conversationId && row.readAt === null) {
      row.readAt = now.toISOString();
    }
  }
}

/**
 * Deleting an account (plan decision 14): its own notifications, and everyone's about `subjectIds` (the conversations
 * it was in), which name it.
 */
export async function deleteNotifications({
  accountId,
  subjectIds,
}: {
  accountId: string;
  subjectIds: ReadonlySet<string>;
}): Promise<void> {
  if (onSupabase()) return (await supabase()).deleteNotifications({ accountId, subjectIds });
  const { notifications } = sampleStore();
  for (const [id, row] of notifications) {
    if (row.accountId === accountId || subjectIds.has(row.subjectId)) notifications.delete(id);
  }
}

/** An account's notifications in its data export (plan decision 15): no ids. */
export type NotificationExport = { text: string; at: string; read: boolean };

export async function exportNotifications(accountId: string): Promise<NotificationExport[]> {
  if (onSupabase()) return (await supabase()).exportNotifications(accountId);
  return ofAccount(accountId).map((row) => ({ text: row.text, at: row.createdAt, read: row.readAt !== null }));
}

/**
 * Everyone's notifications of one kind about things that have gone (community actions plan decisions 6 and 21): a
 * deleted request's update, or the new listings of a shop that has gone. They would only lead to a page that 404s.
 */
export async function deleteNotificationsAbout(kind: NotificationKind, subjectIds: ReadonlySet<string>): Promise<void> {
  if (onSupabase()) return (await supabase()).deleteNotificationsAbout(kind, subjectIds);
  const { notifications } = sampleStore();
  for (const [id, row] of notifications) {
    if (row.kind === kind && subjectIds.has(row.subjectId)) notifications.delete(id);
  }
}

/** What a once-a-day notification says, and where it leads. */
type NoteWords = { text: string; href: string };

/**
 * One notification a SAST day about one thing (community actions plan decision 15; search alerts spec 2.12, plan
 * decision 12). The day's first says `first`. Another that day, while it's unread, says `more(count)` and moves to the
 * top. Once it's been read, `reopenWhenRead` decides: off, the day's later ones make none (a followed shop's new
 * listings); on, the next one makes it unread again and moves it to the top, counting from one, so nothing is missed
 * (a saved search's matches). True when it made or changed a notification.
 */
async function notifyOncePerDay({
  accountId,
  kind,
  subjectId,
  first,
  more,
  reopenWhenRead,
  now,
}: {
  accountId: string;
  kind: NotificationKind;
  subjectId: string;
  first: NoteWords;
  more: (count: number) => NoteWords;
  reopenWhenRead: boolean;
  now: Date;
}): Promise<boolean> {
  const today = sastDate(now);
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId !== accountId || row.kind !== kind || row.subjectId !== subjectId) continue;
    if (sastDate(new Date(row.createdAt)) !== today) continue;
    if (row.readAt !== null) {
      if (!reopenWhenRead) return false;
      // Unread again, counting only what came after it was read: this one, so it names it.
      row.count = 1;
      row.text = first.text;
      row.href = first.href;
      row.readAt = null;
    } else {
      const count = (row.count ?? 1) + 1;
      const words = more(count);
      row.count = count;
      row.text = words.text;
      row.href = words.href;
    }
    row.createdAt = now.toISOString();
    return true;
  }
  add({ accountId, kind, subjectId, text: first.text, href: first.href, now });
  return true;
}

/**
 * A followed shop's new listing (community actions spec 2.19, plan decision 15): one notification per shop per
 * follower per SAST day. The first names the listing and links to it. Another listing that day, while it's unread,
 * updates it ("Tech corner listed 2 new things", linking to the shop) and brings it to the top. Once it's read, the
 * shop's other listings that day make none.
 */
export async function notifyNewListing({
  accountId,
  sellerSlug,
  shopName,
  listing,
  now,
}: {
  accountId: string;
  sellerSlug: string;
  shopName: string;
  listing: { id: string; title: string };
  now: Date;
}): Promise<void> {
  if (onSupabase()) return (await supabase()).notifyNewListing({ accountId, sellerSlug, shopName, listing, now });
  await notifyOncePerDay({
    accountId,
    kind: "new-listing",
    subjectId: sellerSlug,
    first: { text: newListingText(shopName, listing.title), href: `/listings/${listing.id}` },
    more: (count) => ({ text: newListingsText(shopName, count), href: `/sellers/${sellerSlug}` }),
    reopenWhenRead: false,
    now,
  });
}

/**
 * A saved search's new match (search alerts spec 2.12, plan decisions 12 and 14): one notification per saved search
 * per SAST day. The first names the listing and links to it. More while it's unread make "3 new listings match your
 * search …", linking to the search's results, Newest first. A match after it's been read makes it unread again,
 * counting from that match. True when it made or changed one.
 */
export async function notifySearchMatch({
  accountId,
  savedSearchId,
  label,
  resultsHref,
  listing,
  now,
}: {
  accountId: string;
  savedSearchId: string;
  /** The saved search's label (spec 2.3), fixed in the sentence when it's written. */
  label: string;
  /** Its results, Newest first. */
  resultsHref: string;
  listing: { id: string; title: string };
  now: Date;
}): Promise<boolean> {
  if (onSupabase()) return (await supabase()).notifySearchMatch({ accountId, savedSearchId, label, resultsHref, listing, now });
  return notifyOncePerDay({
    accountId,
    kind: "search-match",
    subjectId: savedSearchId,
    first: { text: searchMatchText(listing.title, label), href: `/listings/${listing.id}` },
    more: (count) => ({ text: searchMatchesText(count, label), href: resultsHref }),
    reopenWhenRead: true,
    now,
  });
}
