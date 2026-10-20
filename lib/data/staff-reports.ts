import { ownsTarget, type OwnKind } from "@/lib/staff/own";
import type { ListingState, ReportOutcome, ReportReason, ReportTarget } from "@/lib/types";
import type { ReportRow } from "./rows";
import { isOwnListing, isOwnRequest } from "./staff-shops";
import { sampleStore } from "./store";

// The Hub's reports queue (staff tools spec 2.3, plan decision 5), over E's reports. A report names its reporter by
// first name only. Dismiss closes one report; hiding the listing closes every open report on that listing, and pausing
// the shop closes every open report on the shop and on its listings (amendment 14.1). A report about something that
// has gone can only be dismissed; a request can be hidden too (community actions plan decision 20).
// Closing writes; the action notifies (Task 10). Times come from the caller.

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
  closedByName: string | null;
  /** Whether the reported listing, shop or request is still there. */
  exists: boolean;
  /**
   * Why buyers can't see what exists: the Hub hid the listing or the request, or paused the shop (whose pages show the
   * 404 while the pause lasts, amendment 13.2). Null when they can, so the page may link it.
   */
  unseen: "hidden" | "paused" | null;
  /** The shop a pause would pause: the listing's, or the one reported. */
  shop: { slug: string; name: string } | null;
  /** What the Hub can still do, besides Dismiss (plan decision 5). Nothing once it's closed. */
  can: { hide: boolean; pause: boolean };
  /**
   * The viewing admin's own shop, listing or request, when it's one (stage L spec decisions 1 and 4): their page says
   * why in place of the controls, and `can` is all false. Null for anyone else's, for something that has gone, and
   * when no viewer is given (the queue, tests).
   */
  own: OwnKind | null;
};

const DELETED = "Deleted account";

const firstName = (accountId: string | null | undefined) =>
  (accountId ? sampleStore().accounts.get(accountId)?.firstName : undefined) ?? DELETED;

/** Whether the Hub can pause this shop: it has an owner, and it's open or paused by its seller (plan decision 3). */
function pausable(slug: string): boolean {
  const store = sampleStore();
  const ownerId = store.sellers.get(slug)?.ownerId;
  const profile = ownerId ? store.sellerProfiles.get(ownerId) : undefined;
  return Boolean(profile && (profile.status === "approved" || (profile.status === "paused" && profile.pausedBy !== "staff")));
}

function toView(row: ReportRow, viewerId: string | null): ReportView {
  const store = sampleStore();
  const open = row.status === "open";
  // A report about a deleted shop never reaches a new one on the same link (amendment 13.1).
  const gone = row.targetGone === true;
  const listing = row.targetKind === "listing" && !gone ? store.listings.get(row.targetId) : undefined;
  const shopSlug =
    row.targetKind === "listing" ? listing?.sellerSlug : row.targetKind === "seller" ? row.targetId : undefined;
  const shopRow = shopSlug && !gone ? store.sellers.get(shopSlug) : undefined;
  const requestRow = row.targetKind === "request" ? store.requests.get(row.targetId) : undefined;
  const exists =
    row.targetKind === "request" ? Boolean(requestRow) : row.targetKind === "listing" ? Boolean(listing) : Boolean(shopRow);
  let unseen: ReportView["unseen"] = null;
  if (exists && (listing?.hiddenAt || requestRow?.hiddenAt)) unseen = "hidden";
  else if (exists && shopRow) {
    const profile = shopRow.ownerId ? store.sellerProfiles.get(shopRow.ownerId) : undefined;
    if (profile?.status === "paused" && profile.pausedBy === "staff") unseen = "paused";
  }
  // What Hide can do depends on the kind of target (amendment 7): a listing or a Looking For request that's there and
  // not hidden yet (community actions plan decision 20); a shop is paused, not hidden.
  let canHide: boolean;
  switch (row.targetKind) {
    case "listing":
      canHide = open && Boolean(listing) && !listing?.hiddenAt;
      break;
    case "seller":
      canHide = false;
      break;
    case "request":
      canHide = open && Boolean(requestRow) && !requestRow?.hiddenAt;
      break;
  }
  // Whose it is (stage L spec decision 2): read now, from the store. Something that has gone is nobody's.
  const own = viewerId !== null && exists ? ownsTarget(viewerId, { kind: row.targetKind, id: row.targetId }) : null;
  return {
    id: row.id,
    reporterId: row.reporterId,
    reporterName: firstName(row.reporterId),
    target: { kind: row.targetKind, id: row.targetId },
    targetTitle: row.targetTitle,
    reason: row.reason,
    detail: row.detail,
    open,
    createdAt: row.createdAt,
    outcome: row.outcome ?? null,
    note: row.note ?? null,
    closedAt: row.closedAt ?? null,
    closedByName: row.closedAt ? firstName(row.closedBy) : null,
    exists,
    unseen,
    shop: shopRow ? { slug: shopRow.slug, name: shopRow.name } : null,
    can: {
      hide: own === null && canHide,
      pause: own === null && open && shopRow !== undefined && pausable(shopRow.slug),
    },
    own,
  };
}

/**
 * The queue (spec 2.3): open reports first, oldest first; then the 50 most recently closed. The queue has no controls,
 * so it names no owner (stage L plan decision 3).
 */
export async function listReports(): Promise<ReportView[]> {
  const rows = [...sampleStore().reports.values()];
  const open = rows.filter((row) => row.status === "open").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const closed = rows
    .filter((row) => row.status === "closed")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, 50);
  return [...open, ...closed].map((row) => toView(row, null));
}

/** A report for its page. `viewerId` is the signed-in admin, so the view knows when it's about their own (stage L). */
export async function getReport(id: string, viewerId: string | null = null): Promise<ReportView | null> {
  const row = sampleStore().reports.get(id);
  return row ? toView(row, viewerId) : null;
}

/** How many reports are open, for Overview (spec 2.3). */
export async function openReportCount(): Promise<number> {
  return [...sampleStore().reports.values()].filter((row) => row.status === "open").length;
}

function close(row: ReportRow, outcome: ReportOutcome, note: string, staffId: string, now: Date): void {
  Object.assign(row, { status: "closed", outcome, note, closedAt: now.toISOString(), closedBy: staffId });
}

/** A closed report, for its reporter's notification: the report, who sent it, and what it was about. */
export type ClosedReport = { id: string; reporterId: string; title: string };

/** Dismiss (spec 2.3): this report closes with its note. Null when it wasn't open. */
export async function closeReport(id: string, note: string, staffId: string, now: Date): Promise<ClosedReport | null> {
  const row = sampleStore().reports.get(id);
  if (!row || row.status !== "open") return null;
  close(row, "dismissed", note, staffId, now);
  return { id: row.id, reporterId: row.reporterId, title: row.targetTitle };
}

/**
 * Hide the listing (spec 2.3, plan decision 5): every open report on the same target closes with the outcome and the
 * reason, except ones about something that has gone (amendment 14.2). Each one, for its reporter's notification. Hide
 * the request (community actions plan decision 20) reuses this on the same confirm page, so it stays target-generic
 * (amendment 7). A pause closes the reports about a whole shop, listings included: `closeReportsAboutShop`.
 */
export async function closeReportsOn(
  target: ReportTarget,
  outcome: "hidden" | "paused",
  note: string,
  staffId: string,
  now: Date,
): Promise<ClosedReport[]> {
  const closed: ClosedReport[] = [];
  for (const row of sampleStore().reports.values()) {
    // A report about something that has gone never reaches a new one on the same link (amendments 13.1 and 14.2).
    if (row.status !== "open" || row.targetGone === true) continue;
    if (row.targetKind !== target.kind || row.targetId !== target.id) continue;
    close(row, outcome, note, staffId, now);
    closed.push({ id: row.id, reporterId: row.reporterId, title: row.targetTitle });
  }
  return closed;
}

/**
 * The Hub's pause (spec 2.3, amendment 14.1): every open report about the shop, and about any of its listings, closes
 * as "paused" with the reason, so no reporter is later told the Hub "didn't find a problem" with a shop it paused.
 * Whichever report or page the pause came from, they all close. Each one, for its reporter's notification.
 */
export async function closeReportsAboutShop(
  slug: string,
  note: string,
  staffId: string,
  now: Date,
): Promise<ClosedReport[]> {
  const store = sampleStore();
  const closed: ClosedReport[] = [];
  for (const row of store.reports.values()) {
    if (row.status !== "open" || row.targetGone === true) continue;
    const aboutShop = row.targetKind === "seller" && row.targetId === slug;
    const aboutListing = row.targetKind === "listing" && store.listings.get(row.targetId)?.sellerSlug === slug;
    if (!aboutShop && !aboutListing) continue;
    close(row, "paused", note, staffId, now);
    closed.push({ id: row.id, reporterId: row.reporterId, title: row.targetTitle });
  }
  return closed;
}

// --- Hidden listings and requests (stage J spec decision 14) -----------------------------------------------------

/** A listing or request the Hub has hidden, as /admin/hidden and its confirm pages show it. */
export type HiddenItem = {
  kind: "listing" | "request";
  id: string;
  title: string;
  /** The listing's shop's name; null for a request, which never names its asker. */
  shopName: string | null;
  campusSlug: string;
  hiddenAt: string;
  /** The Hub's reason, which the seller or asker saw. */
  reason: string;
  /** A listing's own state, which showing it again keeps (plan decision 16); null for a request. */
  listingState: ListingState | null;
  /** The listing's shop is paused by the Hub, so buyers won't see it until the shop is resumed. */
  shopPausedByHub: boolean;
  /** The request's asker had closed it, so it shows as closed. */
  requestClosed: boolean;
  /** The viewing admin's own listing or request: another admin must show it again (stage L spec decision 1). */
  own: boolean;
};

function hiddenListings(viewerId: string | null): HiddenItem[] {
  const store = sampleStore();
  return [...store.listings.values()].flatMap((row): HiddenItem[] => {
    if (!row.hiddenAt) return [];
    const shop = store.sellers.get(row.sellerSlug);
    const profile = shop?.ownerId ? store.sellerProfiles.get(shop.ownerId) : undefined;
    return [
      {
        kind: "listing",
        id: row.id,
        title: row.title,
        shopName: shop?.name ?? row.sellerSlug,
        campusSlug: row.campusSlug,
        hiddenAt: row.hiddenAt,
        reason: row.hiddenReason ?? "",
        listingState: row.state,
        shopPausedByHub: profile?.status === "paused" && profile.pausedBy === "staff",
        requestClosed: false,
        own: viewerId !== null && isOwnListing(viewerId, row.id),
      },
    ];
  });
}

function hiddenRequests(viewerId: string | null): HiddenItem[] {
  return [...sampleStore().requests.values()].flatMap((row): HiddenItem[] => {
    if (row.hiddenAt === null) return [];
    return [
      {
        kind: "request",
        id: row.id,
        title: row.title,
        shopName: null,
        campusSlug: row.campusSlug,
        hiddenAt: row.hiddenAt,
        reason: row.hiddenReason ?? "",
        listingState: null,
        shopPausedByHub: false,
        requestClosed: row.status === "closed",
        own: viewerId !== null && isOwnRequest(viewerId, row.id),
      },
    ];
  });
}

const newestHiddenFirst = (a: HiddenItem, b: HiddenItem) => b.hiddenAt.localeCompare(a.hiddenAt);

/**
 * Everything the Hub has hidden, newest hidden first (spec decision 14). The Reports queue keeps only the 50 most
 * recently closed reports, so this list is the only place an old hide stays reachable. `viewerId` marks the viewing
 * admin's own (stage L).
 */
export async function listHidden(
  viewerId: string | null = null,
): Promise<{ listings: HiddenItem[]; requests: HiddenItem[] }> {
  return {
    listings: hiddenListings(viewerId).sort(newestHiddenFirst),
    requests: hiddenRequests(viewerId).sort(newestHiddenFirst),
  };
}

/** One hidden listing or request, for its Show again page. Null when it's gone or isn't hidden. */
export async function getHidden(
  kind: "listing" | "request",
  id: string,
  viewerId: string | null = null,
): Promise<HiddenItem | null> {
  return (kind === "listing" ? hiddenListings(viewerId) : hiddenRequests(viewerId)).find((item) => item.id === id) ?? null;
}

/** How many of each are hidden, for Overview's line (plan decision 17). */
export async function countHidden(): Promise<{ listings: number; requests: number }> {
  return { listings: hiddenListings(null).length, requests: hiddenRequests(null).length };
}
