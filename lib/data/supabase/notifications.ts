import "server-only";
import type { NotificationKind } from "@/lib/types";
import type * as Sample from "../notifications";
import { groupNewByKind } from "../notifications";
import { iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";

// Notifications on Supabase (C2/C3 plan Task 12, decision 17). The reads are the account's own, through its own client
// (forViewerAs: the id is checked against the session, decision 2), never cached (decision 4): the notifications
// policy lets an account read only its own. `now` is unused: the database stamps the time.
//
// Every notification is written inside the database function that needs it, in the same transaction as the action:
// - a message: start_conversation and send_message (private.tell_other_side, private.notify_message), start_offer;
// - a sale to confirm: mark_completed; read by confirm_sale, reject_sale and the settle (private.read_sale_notes);
// - opening a thread: mark_thread_read;
// - a followed shop's new listings: save_listing (private.tell_followers, through private.notify_once_per_day);
// - a saved search's matches: record_search_matches;
// - the staff tools' and requests' words: their own functions;
// - deleting an account or a listing: forget_account and delete_listing.
// So the TypeScript writers throw a plain Error here (amendment 4): a missed path fails loudly, and no form error can
// hide it.

const COLUMNS = "id, kind, text, href, created_at, read_at";

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

function inTheDatabase(fn: string): never {
  throw new Error(`${fn} runs in the database on Supabase`);
}

export const getNotifications: typeof Sample.getNotifications = async (accountId, limit) => {
  const { data, error } = await (await forViewerAs(accountId))
    .from("notifications")
    .select(COLUMNS)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) failed("notifications", error);
  return data.map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    text: row.text,
    href: row.href,
    createdAt: iso(row.created_at),
    isNew: row.read_at === null,
  }));
};

export const countNewNotifications: typeof Sample.countNewNotifications = async (accountId) => {
  const { count, error } = await (await forViewerAs(accountId))
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .is("read_at", null);
  if (error) failed("notifications", error);
  return count ?? 0;
};

/**
 * For you's unread notifications of some kinds, with the account's own session (the notifications policy lets it read
 * only its own). Every unread row of those kinds, a page at a time, grouped as the sample groups them.
 */
export const newNotificationsByKind: typeof Sample.newNotificationsByKind = async (accountId, kinds) => {
  if (kinds.length === 0) return {};
  const client = await forViewerAs(accountId);
  const rows = await selectAll(
    () =>
      client
        .from("notifications")
        .select("id, kind, text, href, created_at")
        .eq("account_id", accountId)
        .is("read_at", null)
        .in("kind", [...kinds]),
    ["id"],
  );
  return groupNewByKind(
    rows.map((row) => ({
      id: row.id,
      kind: row.kind as NotificationKind,
      text: row.text,
      href: row.href,
      createdAt: iso(row.created_at),
    })),
  );
};

export const markNotificationsRead: typeof Sample.markNotificationsRead = async (accountId) => {
  const { error } = await (await forViewerAs(accountId)).rpc("mark_notifications_read");
  if (error) failed("mark_notifications_read", error);
};

export const exportNotifications: typeof Sample.exportNotifications = async (accountId) => {
  const { data, error } = await (await forViewerAs(accountId))
    .from("notifications")
    .select("text, created_at, read_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) failed("notifications", error);
  return data.map((row) => ({ text: row.text, at: iso(row.created_at), read: row.read_at !== null }));
};

export const notify: typeof Sample.notify = async () => inTheDatabase("notify");
export const notifyAboutMessage: typeof Sample.notifyAboutMessage = async () => inTheDatabase("notifyAboutMessage");
export const markSaleNotificationsRead: typeof Sample.markSaleNotificationsRead = async () =>
  inTheDatabase("markSaleNotificationsRead");
export const markConversationNotificationsRead: typeof Sample.markConversationNotificationsRead = async () =>
  inTheDatabase("markConversationNotificationsRead");
export const deleteNotifications: typeof Sample.deleteNotifications = async () => inTheDatabase("deleteNotifications");
export const deleteNotificationsAbout: typeof Sample.deleteNotificationsAbout = async () =>
  inTheDatabase("deleteNotificationsAbout");
export const notifyNewListing: typeof Sample.notifyNewListing = async () => inTheDatabase("notifyNewListing");
export const notifySearchMatch: typeof Sample.notifySearchMatch = async () => inTheDatabase("notifySearchMatch");
