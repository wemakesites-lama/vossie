import { campuses } from "@/data/fixtures/campuses";
import { onSupabase } from "@/lib/backend";
import {
  MEASURES,
  sastWeeks,
  type Measure,
  type Period,
  type RawColumn,
  type RawCounts,
  type SastWeeks,
} from "@/lib/staff/numbers";
import { listedListings, liveSellerRows } from "./catalog";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// The admin's numbers from the sample store (stage J spec decision 10), worked out by looping over the store as the
// page renders: fine for sample mode's few hundred rows. Each thing counts at its moment and on its campus. Things
// deleted since aren't in the store, so they aren't counted; something whose campus has gone (an enquiry to a deleted
// shop, a report on something deleted) is kept under `gone`, which only totals use. Saved searches are never read
// (spec decision 10: their promise). On Supabase (C4/C5 plan Task 21) the counts are public.admin_weekly_counts', through
// lib/data/supabase/numbers.ts, picked by the first line through import(); a weekly roll-up can follow (spec section 8).

/** The fixtures' 13 campuses (plan decision 13). Any other slug is a campus that has gone. */
const KNOWN = new Set(campuses.map((campus) => campus.slug));

type Column = { campuses: Record<string, number>; gone: number };

const emptyColumn = (): Column => ({ campuses: {}, gone: 0 });

function add(column: Column, campus: string | null | undefined): void {
  if (campus && KNOWN.has(campus)) column.campuses[campus] = (column.campuses[campus] ?? 0) + 1;
  else column.gone += 1;
}

/**
 * Counts one thing that happened `at` on `campus`: into Since the start when it's before the end of last week, and
 * into last week or the week before when it falls in one. Something from this week isn't counted yet.
 */
function tally(
  counter: Record<Measure, Record<Period, Column>>,
  measure: Measure,
  weeks: SastWeeks,
  at: string | null | undefined,
  campus: string | null | undefined,
): void {
  if (!at) return;
  const moment = Date.parse(at);
  if (!(moment < Date.parse(weeks.last.end))) return;
  add(counter[measure].since, campus);
  if (moment >= Date.parse(weeks.last.start)) add(counter[measure].last, campus);
  else if (moment >= Date.parse(weeks.before.start)) add(counter[measure].before, campus);
}

/** A report's campus: its listing's, shop's or request's as the page renders, or null once that has gone. */
function reportCampus(row: ReportRow): string | null {
  if (row.targetGone === true) return null;
  const { listings, sellers, requests } = sampleStore();
  switch (row.targetKind) {
    case "listing":
      return listings.get(row.targetId)?.campusSlug ?? null;
    case "seller":
      return sellers.get(row.targetId)?.campusSlug ?? null;
    case "request":
      return requests.get(row.targetId)?.campusSlug ?? null;
  }
}

/**
 * Raw counts by measure, week and campus, and the weeks they're counted in (spec decisions 10 and 11). `now` comes
 * from the caller, which reads the clock only after `await connection()`.
 */
export async function countByWeek(now: Date): Promise<{ weeks: SastWeeks; raw: RawCounts }> {
  if (onSupabase()) return (await import("./supabase/numbers")).countByWeek(now);
  const weeks = sastWeeks(now);
  const store = sampleStore();
  const counter = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: emptyColumn(), before: emptyColumn(), since: emptyColumn() }]),
  ) as Record<Measure, Record<Period, Column>>;

  // A listing counts once, at its first publish, hidden or not (plan decision 13).
  for (const row of store.listings.values()) tally(counter, "listings", weeks, row.firstPublishedAt, row.campusSlug);
  // A student's shop at its first approval; a sample shop no account owns has always been open, so at its createdAt.
  for (const row of store.sellers.values()) {
    const approvedAt = row.ownerId === null ? row.createdAt : store.sellerProfiles.get(row.ownerId)?.approvedAt;
    tally(counter, "shops", weeks, approvedAt, row.campusSlug);
  }
  for (const row of store.requests.values()) tally(counter, "requests", weeks, row.createdAt, row.campusSlug);
  // Offers on a request (requestId set) aren't enquiries, as selling's counting has it. A conversation whose shop has
  // gone is on a gone campus, so a new shop on the same link never takes it.
  for (const row of store.conversations.values()) {
    if (row.requestId) continue;
    const campus = row.sellerGone ? null : store.sellers.get(row.sellerSlug)?.campusSlug;
    tally(counter, "enquiries", weeks, row.createdAt, campus);
  }
  for (const row of store.reports.values()) {
    const campus = reportCampus(row);
    tally(counter, "reports-made", weeks, row.createdAt, campus);
    tally(counter, "reports-closed", weeks, row.status === "closed" ? row.closedAt : null, campus);
  }
  for (const row of store.follows.values()) {
    tally(counter, "follows", weeks, row.createdAt, store.sellers.get(row.sellerSlug)?.campusSlug);
  }

  // Open shops now (plan decision 12): approved and not paused, with something listed that the Hub hasn't hidden.
  const openShops = emptyColumn();
  const listed = new Set(listedListings().map((listing) => listing.sellerSlug));
  for (const row of liveSellerRows()) {
    if (listed.has(row.slug)) add(openShops, row.campusSlug);
  }

  return { weeks, raw: { counts: counter as Record<Measure, Record<Period, RawColumn>>, openShops } };
}
