import { FORMER_STAFF } from "@/lib/staff/audit-words";
import type { ReportOutcome, ReportReason, ReportTarget } from "@/lib/types";
import { publicListing } from "./catalog";
import type { ListingRow, ReportRow, SellerRow } from "./rows";
import { hideListingNow, type ListingDecision, type ShopDecision, staffPauseShopNow } from "./staff-shops";
import { sampleStore } from "./store";

// The Hub's reports queue (staff tools spec 2.3, plan decision 5), over E's reports. A report names its reporter by
// first name only. Dismiss closes one report. Hiding the listing closes every open report on it; every Hub pause, from
// a report or from the Sellers page, closes every open report on the shop and its listings (amendment 20). A report
// about something that has gone, or about a Looking For request, can only be dismissed (amendment 29). Each writer
// checks and writes with no await between (amendment 19), so two presses at once decide once. The actions (Task 10)
// record, notify and expire the tags. Times come from the caller.

/** A report as the queue and its page show it (spec 2.3). */
export type ReportView = {
  id: string;
  reporterId: string;
  /** The reporter's first name only (spec 2.3). */
  reporterName: string;
  target: ReportTarget;
  /** What it was called when it was reported. */
  targetTitle: string;
  reason: ReportReason;
  detail: string;
  open: boolean;
  createdAt: string;
  outcome: ReportOutcome | null;
  note: string | null;
  closedAt: string | null;
  /** Who closed it: their first name, or "Former staff member" once their account has gone (amendment 17). */
  closedByName: string | null;
  /** Whether the reported listing or shop is still there (a request always is). */
  exists: boolean;
  /** The shop a pause would pause: the listing's, or the one reported. */
  shop: { slug: string; name: string } | null;
  /**
   * The reported listing as it is now, for the hide confirm page (amendment 29): its current title, and whether buyers
   * can open its page (not when it's hidden, a draft, or its shop is paused by the Hub). Null for other reports.
   */
  listing: { id: string; title: string; public: boolean } | null;
  /** What the Hub can still do, besides Dismiss (plan decision 5). Nothing once it's closed. */
  can: { hide: boolean; pause: boolean };
};

/**
 * A closed report, for its reporter's notification and the audit entry: the report, who sent it, what it was about,
 * and the owner of the reported listing's or shop's shop, the audit entry's `subjectId` (amendment 21; null for a
 * sample shop, a request or a target that has gone). Never the reporter as the subject.
 */
export type ClosedReport = { id: string; reporterId: string; title: string; ownerId: string | null };

/** What hiding a listing or pausing a shop from a report did, for the action's audit entry and notifications. */
export type ReportAction =
  | { act: "hide"; decision: ListingDecision; closed: ClosedReport[] }
  | { act: "pause"; decision: ShopDecision; closed: ClosedReport[] };

const DELETED = "Deleted account";

const firstName = (accountId: string | null | undefined, gone: string) =>
  (accountId ? sampleStore().accounts.get(accountId)?.firstName : undefined) ?? gone;

/** The reported listing (when it's there) and the shop behind the report (the listing's, or the one reported). */
function targetOf(row: ReportRow): { listing: ListingRow | undefined; shop: SellerRow | undefined } {
  const store = sampleStore();
  const listing = row.targetKind === "listing" ? store.listings.get(row.targetId) : undefined;
  const slug =
    row.targetKind === "listing" ? listing?.sellerSlug : row.targetKind === "seller" ? row.targetId : undefined;
  return { listing, shop: slug ? store.sellers.get(slug) : undefined };
}

/** Whether the Hub can pause this shop: it has an owner, and it's open or paused by its seller (plan decision 3). */
function pausable(shop: SellerRow): boolean {
  const profile = shop.ownerId ? sampleStore().sellerProfiles.get(shop.ownerId) : undefined;
  return Boolean(
    profile && (profile.status === "approved" || (profile.status === "paused" && profile.pausedBy !== "staff")),
  );
}

/** What the Hub can still do about the report, besides Dismiss (plan decision 5; amendment 29). */
function allowed(row: ReportRow): { hide: boolean; pause: boolean } {
  if (row.status !== "open") return { hide: false, pause: false };
  const { listing, shop } = targetOf(row);
  return { hide: Boolean(listing && !listing.hiddenAt), pause: Boolean(shop && pausable(shop)) };
}

function toView(row: ReportRow): ReportView {
  const { listing, shop } = targetOf(row);
  return {
    id: row.id,
    reporterId: row.reporterId,
    reporterName: firstName(row.reporterId, DELETED),
    target: { kind: row.targetKind, id: row.targetId },
    targetTitle: row.targetTitle,
    reason: row.reason,
    detail: row.detail,
    open: row.status === "open",
    createdAt: row.createdAt,
    outcome: row.outcome ?? null,
    note: row.note ?? null,
    closedAt: row.closedAt ?? null,
    closedByName: row.closedAt ? firstName(row.closedBy, FORMER_STAFF) : null,
    exists: row.targetKind === "request" || Boolean(row.targetKind === "listing" ? listing : shop),
    shop: shop ? { slug: shop.slug, name: shop.name } : null,
    listing: listing ? { id: listing.id, title: listing.title, public: publicListing(listing.id) !== null } : null,
    can: allowed(row),
  };
}

/** The queue (spec 2.3): open reports first, oldest first; then the 50 most recently closed. */
export async function listReports(): Promise<ReportView[]> {
  const rows = [...sampleStore().reports.values()];
  const open = rows.filter((row) => row.status === "open").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const closed = rows
    .filter((row) => row.status === "closed")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, 50);
  return [...open, ...closed].map(toView);
}

export async function getReport(id: string): Promise<ReportView | null> {
  const row = sampleStore().reports.get(id);
  return row ? toView(row) : null;
}

/** How many reports are open, for Overview (spec 2.3). */
export async function openReportCount(): Promise<number> {
  return [...sampleStore().reports.values()].filter((row) => row.status === "open").length;
}

function close(row: ReportRow, outcome: ReportOutcome, note: string, staffId: string, now: Date): ClosedReport {
  Object.assign(row, { status: "closed", outcome, note, closedAt: now.toISOString(), closedBy: staffId });
  const ownerId = targetOf(row).shop?.ownerId ?? null;
  return { id: row.id, reporterId: row.reporterId, title: row.targetTitle, ownerId };
}

/** Dismiss (spec 2.3): this report closes with its note. Null when it wasn't open. */
export async function closeReport(id: string, note: string, staffId: string, now: Date): Promise<ClosedReport | null> {
  const row = sampleStore().reports.get(id);
  if (!row || row.status !== "open") return null;
  return close(row, "dismissed", note, staffId, now);
}

/** Every open report whose target is `matches`, closed with the outcome and the reason. */
function closeOpen(
  matches: (row: ReportRow) => boolean,
  outcome: "hidden" | "paused",
  note: string,
  staffId: string,
  now: Date,
): ClosedReport[] {
  return [...sampleStore().reports.values()]
    .filter((row) => row.status === "open" && matches(row))
    .map((row) => close(row, outcome, note, staffId, now));
}

/**
 * The Hub's pause, closing every open report on the shop or one of its listings with outcome "paused" and the reason
 * (amendment 20). Synchronous, so the check and the writes happen in one run (amendment 19): actOnReport uses it, and
 * so does the Sellers page's Pause (Task 10's pauseSeller, in place of staffPauseShop). Null when the shop can't be
 * paused (staffPauseShopNow's rules), with no report closed.
 */
export function pauseShopClosingReports(
  slug: string,
  reason: string,
  staffId: string,
  now: Date,
): { decision: ShopDecision; closed: ClosedReport[] } | null {
  const decision = staffPauseShopNow(slug, reason);
  if (!decision) return null;
  const listings = sampleStore().listings;
  const onShop = (row: ReportRow) =>
    row.targetKind === "seller"
      ? row.targetId === slug
      : row.targetKind === "listing" && listings.get(row.targetId)?.sellerSlug === slug;
  return { decision, closed: closeOpen(onShop, "paused", reason, staffId, now) };
}

/**
 * Hide the listing or Pause the account, from a report (spec 2.3; plan decision 5; amendments 19 and 20). One
 * synchronous run: the report must still be open and allow the act; then the listing is hidden (every open report on
 * it closes, "hidden") or the shop is paused as the Hub's pause (every open report on the shop and its listings
 * closes, "paused"). Null when the report isn't open, doesn't allow it (a request, a sample shop's pause, a target
 * that has gone) or there was nothing to do.
 */
export function actOnReport(
  id: string,
  act: "hide" | "pause",
  reason: string,
  staffId: string,
  now: Date,
): ReportAction | null {
  const row = sampleStore().reports.get(id);
  if (!row || !allowed(row)[act]) return null;
  if (act === "pause") {
    const shop = targetOf(row).shop;
    const paused = shop ? pauseShopClosingReports(shop.slug, reason, staffId, now) : null;
    return paused ? { act, ...paused } : null;
  }
  const decision = hideListingNow(row.targetId, reason, now);
  if (!decision) return null;
  const onListing = (other: ReportRow) => other.targetKind === "listing" && other.targetId === row.targetId;
  return { act, decision, closed: closeOpen(onListing, "hidden", reason, staffId, now) };
}
