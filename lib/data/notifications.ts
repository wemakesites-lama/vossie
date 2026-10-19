import { randomUUID } from "node:crypto";
import { newListingsText, newListingText } from "@/lib/following/rules";
import { sastDate } from "@/lib/time";
import type { NotificationItem, NotificationKind } from "@/lib/types";
import type { NotificationRow } from "./rows";
import { sampleStore } from "./store";

// Notifications (messaging spec 2.9 and 3.5; plan decisions 12 and 13): one row per thing that needs an account's
// attention, its sentence and link fixed when it's made. Server Actions make them (only they make ids); pages read
// them and mark them read. Times come from the caller. A busy conversation keeps one unread *message* notification
// per person (plan decision 12); a sale to confirm is its own notification, read once the sale is settled (messaging
// plan amendment 3).

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
  return ofAccount(accountId).filter((row) => row.readAt === null).length;
}

/** Opening /notifications marks them all read (spec 2.9). */
export async function markNotificationsRead(accountId: string, now: Date): Promise<void> {
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
  const { notifications } = sampleStore();
  for (const [id, row] of notifications) {
    if (row.accountId === accountId || subjectIds.has(row.subjectId)) notifications.delete(id);
  }
}

/** An account's notifications in its data export (plan decision 15): no ids. */
export type NotificationExport = { text: string; at: string; read: boolean };

export async function exportNotifications(accountId: string): Promise<NotificationExport[]> {
  return ofAccount(accountId).map((row) => ({ text: row.text, at: row.createdAt, read: row.readAt !== null }));
}

/**
 * Everyone's notifications of one kind about things that have gone (community actions plan decisions 6 and 21): a
 * deleted request's update, or the new listings of a shop that has gone. They would only lead to a page that 404s.
 */
export async function deleteNotificationsAbout(kind: NotificationKind, subjectIds: ReadonlySet<string>): Promise<void> {
  const { notifications } = sampleStore();
  for (const [id, row] of notifications) {
    if (row.kind === kind && subjectIds.has(row.subjectId)) notifications.delete(id);
  }
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
  const today = sastDate(now);
  for (const row of sampleStore().notifications.values()) {
    if (row.accountId !== accountId || row.kind !== "new-listing" || row.subjectId !== sellerSlug) continue;
    if (sastDate(new Date(row.createdAt)) !== today) continue;
    if (row.readAt !== null) return;
    const count = (row.count ?? 1) + 1;
    row.count = count;
    row.text = newListingsText(shopName, count);
    row.href = `/sellers/${sellerSlug}`;
    row.createdAt = now.toISOString();
    return;
  }
  add({
    accountId,
    kind: "new-listing",
    subjectId: sellerSlug,
    text: newListingText(shopName, listing.title),
    href: `/listings/${listing.id}`,
    now,
  });
}
