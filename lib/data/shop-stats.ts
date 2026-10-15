import { autoConfirmAt, DAY_MS } from "@/lib/messaging/rules";
import type { EnquiryCounts, ShopStats } from "@/lib/types";
import type { ConversationRow } from "./rows";
import { sampleStore } from "./store";

// The dashboard's numbers (selling spec 2.8, plan decision 18), from messaging's conversations. The trust page's
// rules: an enquiry is a buyer's first message about a listing; one still inside its 48 hours doesn't count yet; a
// sale counts once the buyer confirms it, or 7 days after the seller marks it done. Nothing here writes.

const REPLY_WINDOW_MS = 2 * DAY_MS;
const WEEK_MS = 7 * DAY_MS;
const RECORD_MS = 90 * DAY_MS;

/** When the sale counts from (E's 7-day rule, applied without writing), or null while it doesn't. */
function soldAt(row: ConversationRow, now: Date): string | null {
  if (row.status === "confirmed") return row.confirmedAt;
  if (row.status !== "done" || !row.completedAt) return null;
  const due = autoConfirmAt(row.completedAt);
  return Date.parse(due) <= now.getTime() ? due : null;
}

function counts(rows: readonly ConversationRow[], enquiriesSince: number, salesSince: number, now: Date): EnquiryCounts {
  const enquiries = rows.filter((row) => row.listingId !== null && Date.parse(row.createdAt) >= enquiriesSince);
  const inTime = enquiries.filter(
    (row) => row.firstReplyAt !== null && Date.parse(row.firstReplyAt) - Date.parse(row.createdAt) <= REPLY_WINDOW_MS,
  );
  const due = enquiries.filter(
    (row) => inTime.includes(row) || now.getTime() - Date.parse(row.createdAt) >= REPLY_WINDOW_MS,
  );
  const sales = rows.filter((row) => {
    const at = soldAt(row, now);
    return at !== null && Date.parse(at) >= salesSince;
  });
  return { enquiries: enquiries.length, due: due.length, repliedInTime: inTime.length, salesConfirmed: sales.length };
}

/** The shop's conversations. One whose shop was deleted (`sellerGone`) belongs to no shop, whatever link it names. */
function conversationsOf(sellerSlug: string): ConversationRow[] {
  return [...sampleStore().conversations.values()].filter((row) => row.sellerSlug === sellerSlug && !row.sellerGone);
}

/**
 * A shop's last 7 days, and its record for the badges: 90 days of enquiries, and every sale. A conversation whose shop
 * was deleted (`sellerGone`) belongs to no shop, whatever link it names.
 */
export async function shopStats(sellerSlug: string, now: Date): Promise<ShopStats> {
  const rows = conversationsOf(sellerSlug);
  const weekStart = now.getTime() - WEEK_MS;
  return {
    week: counts(rows, weekStart, weekStart, now),
    record: counts(rows, now.getTime() - RECORD_MS, Number.NEGATIVE_INFINITY, now),
  };
}

/**
 * A shop's enquiries and sales over the last `days` days: the mentor dashboard's 14 (staff tools plan decision 15).
 * Like shopStats, it leaves out conversations whose shop was deleted (amendment 5).
 */
export async function recentCounts(sellerSlug: string, days: number, now: Date): Promise<EnquiryCounts> {
  const since = now.getTime() - days * DAY_MS;
  return counts(conversationsOf(sellerSlug), since, since, now);
}
