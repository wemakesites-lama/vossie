import { onSupabase } from "@/lib/backend";
import { autoConfirmAt, DAY_MS } from "@/lib/messaging/rules";
import { lastSastDays, sastDate } from "@/lib/time";
import type { EnquiryCounts, RecentCounts, ShopStats } from "@/lib/types";
import type { ConversationRow } from "./rows";
import { sampleStore } from "./store";

// The dashboard's numbers (selling spec 2.8, plan decision 18), from messaging's conversations. The trust page's
// rules: an enquiry is a buyer's first message about a listing; one still inside its 48 hours doesn't count yet; a
// sale counts once the buyer confirms it, or 7 days after the seller marks it done. A conversation whose shop's owner
// has deleted their account (`sellerGone`) is nobody's now, so it counts for no shop, even one that later gets the
// same link (selling plan amendment 9.1). Nothing here writes.

const REPLY_WINDOW_MS = 2 * DAY_MS;
const WEEK_MS = 7 * DAY_MS;
const RECORD_MS = 90 * DAY_MS;

/**
 * What the counting reads of a conversation (2b plan Task 19: the Supabase twin maps its rows to it). Only whether
 * `requestId` is set matters: an offer thread.
 */
export type CountedConversation = Pick<
  ConversationRow,
  "listingId" | "requestId" | "createdAt" | "firstReplyAt" | "status" | "completedAt" | "confirmedAt"
>;

/** When the sale counts from (E's 7-day rule, applied without writing), or null while it doesn't. */
export function soldAt(row: CountedConversation, now: Date): string | null {
  if (row.status === "confirmed") return row.confirmedAt;
  if (row.status !== "done" || !row.completedAt) return null;
  const due = autoConfirmAt(row.completedAt);
  return Date.parse(due) <= now.getTime() ? due : null;
}

export function counts(
  rows: readonly CountedConversation[],
  enquiriesSince: number,
  salesSince: number,
  now: Date,
  before: number = Number.POSITIVE_INFINITY,
): EnquiryCounts {
  // An offer thread isn't an enquiry: the shop wrote first (community actions spec 2.12). Its sale still counts.
  const enquiries = rows.filter((row) => {
    const at = Date.parse(row.createdAt);
    return row.listingId !== null && !row.requestId && at >= enquiriesSince && at < before;
  });
  const inTime = enquiries.filter(
    (row) => row.firstReplyAt !== null && Date.parse(row.firstReplyAt) - Date.parse(row.createdAt) <= REPLY_WINDOW_MS,
  );
  const due = enquiries.filter(
    (row) => inTime.includes(row) || now.getTime() - Date.parse(row.createdAt) >= REPLY_WINDOW_MS,
  );
  const sales = rows.filter((row) => {
    const at = soldAt(row, now);
    return at !== null && Date.parse(at) >= salesSince && Date.parse(at) < before;
  });
  return { enquiries: enquiries.length, due: due.length, repliedInTime: inTime.length, salesConfirmed: sales.length };
}

/** A shop's last 7 days, and its record for the badges, from its conversations (either backend's). */
export function statsOver(rows: readonly CountedConversation[], now: Date): ShopStats {
  const weekStart = now.getTime() - WEEK_MS;
  return {
    week: counts(rows, weekStart, weekStart, now),
    record: counts(rows, now.getTime() - RECORD_MS, Number.NEGATIVE_INFINITY, now),
  };
}

/**
 * A shop's enquiries and sales over the last `days` days, and over the `days` before those (role views spec 6), from
 * its conversations (either backend's). One pass over the same rows, so the comparison costs no second read.
 */
export function recentOver(rows: readonly CountedConversation[], days: number, now: Date): RecentCounts {
  const since = now.getTime() - days * DAY_MS;
  const before = since - days * DAY_MS;
  return { ...counts(rows, since, since, now), previous: counts(rows, before, before, now, since) };
}

/** The current window alone, for readers that show no comparison yet (the mentor's, until N4). */
export function currentOf({ enquiries, due, repliedInTime, salesConfirmed }: RecentCounts): EnquiryCounts {
  return { enquiries, due, repliedInTime, salesConfirmed };
}

/**
 * Enquiries per SAST day over the last `days` days, oldest first (role views spec 6). A day before the shop existed
 * (`createdAt`, null for no shop) has no number. Offers and questions to the shop aren't enquiries.
 */
export function dailyOver(
  rows: readonly CountedConversation[],
  createdAt: string | null,
  days: number,
  now: Date,
): (number | null)[] {
  const first = createdAt === null ? null : sastDate(new Date(createdAt));
  const perDay = new Map<string, number>();
  for (const row of rows) {
    if (row.listingId === null || row.requestId) continue;
    const day = sastDate(new Date(row.createdAt));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return lastSastDays(days, now).map((day) => (first === null || day < first ? null : (perDay.get(day) ?? 0)));
}

/** The shop's conversations as the counting reads them: its own, while its owner is there (amendment 9.1). */
function rowsOf(sellerSlug: string): ConversationRow[] {
  return [...sampleStore().conversations.values()].filter((row) => row.sellerSlug === sellerSlug && !row.sellerGone);
}

/** A shop's last 7 days, and its record for the badges: 90 days of enquiries, and every sale. */
export async function shopStats(sellerSlug: string, now: Date): Promise<ShopStats> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).shopStats(sellerSlug, now);
  return statsOver(rowsOf(sellerSlug), now);
}

/**
 * A shop's enquiries and sales over the last `days` days and the `days` before (role views spec 6): the seller home's
 * 7 and the mentor dashboard's 14 (staff tools plan decision 15). It reads the same rows as shopStats, so a
 * conversation whose owner has gone counts for no shop (amendment 11).
 */
export async function recentCounts(sellerSlug: string, days: number, now: Date): Promise<RecentCounts> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).recentCounts(sellerSlug, days, now);
  return recentOver(rowsOf(sellerSlug), days, now);
}

/** A shop's enquiries per SAST day over the last `days` days, null before it existed (role views spec 6). */
export async function dailyEnquiries(sellerSlug: string, days: number, now: Date): Promise<(number | null)[]> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).dailyEnquiries(sellerSlug, days, now);
  return dailyOver(rowsOf(sellerSlug), sampleStore().sellers.get(sellerSlug)?.createdAt ?? null, days, now);
}
