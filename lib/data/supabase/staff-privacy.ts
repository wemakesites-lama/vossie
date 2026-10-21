import "server-only";
import type { BookingStatus } from "@/lib/types";
import type * as Sample from "../staff-privacy";
import { forViewerAs } from "./viewer";
import { iso } from "./rows";

// The staff tools' part of the data download, and of deletion, on Supabase (C4/C5 plan Task 21; decision 16). The
// account's own RSVPs and slot requests, read with its own session, each named by its post as buyers see it
// (hub_cards); a post put back to draft is "A removed post", since a student can't read a draft's title (open question
// 2, accepted). No ids, and never a mentor's notes: the export has no field for them, and the notes' policy never shows
// the owner a note about them. Deletion is forget_account's (phase B's deleteAccountData), so the forget twin throws.

const REMOVED = "A removed post";

export const exportStaffToolsData: typeof Sample.exportStaffToolsData = async (accountId) => {
  const client = await forViewerAs(accountId);
  const [rsvps, bookings] = await Promise.all([
    client.from("hub_rsvps").select("post_id, created_at").eq("account_id", accountId).order("created_at").order("post_id"),
    client
      .from("hub_bookings")
      .select("id, post_id, help, time, status, created_at")
      .eq("account_id", accountId)
      .order("created_at")
      .order("id"),
  ]);
  if (rsvps.error) throw new Error(`hub_rsvps failed (${rsvps.error.code ?? "unknown"})`);
  if (bookings.error) throw new Error(`hub_bookings failed (${bookings.error.code ?? "unknown"})`);
  const ids = [...new Set([...rsvps.data.map((row) => row.post_id), ...bookings.data.map((row) => row.post_id)])];
  const titles = new Map<string, string>();
  if (ids.length > 0) {
    const { data, error } = await client.from("hub_cards").select("id, title").in("id", ids);
    if (error) throw new Error(`hub_cards failed (${error.code ?? "unknown"})`);
    for (const row of data) if (row.id && row.title) titles.set(row.id, row.title);
  }
  const title = (postId: string) => titles.get(postId) ?? REMOVED;
  return {
    hubRsvps: rsvps.data.map((row) => ({ event: title(row.post_id), at: iso(row.created_at) })),
    slotRequests: bookings.data.map((row) => ({
      officeHours: title(row.post_id),
      help: row.help,
      time: row.time,
      status: row.status as BookingStatus,
      at: iso(row.created_at),
    })),
  };
};

export const forgetAccountInStaffTools: typeof Sample.forgetAccountInStaffTools = async () => {
  throw new Error("forgetAccountInStaffTools: forget_account does this on Supabase (phase B's deleteAccountData)");
};
