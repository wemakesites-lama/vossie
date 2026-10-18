import type { ReportOutcome, ReportReason, ReportTarget } from "@/lib/types";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// The Hub's reports queue (staff tools spec 2.3, plan decision 5), over E's reports. A report names its reporter by
// first name only. Dismiss closes one report; hiding the listing or pausing the account closes every open report on
// the same target. A report about something that has gone, or about a Looking For request, can only be dismissed.
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
  /** Whether the reported listing or shop is still there (a request always is). */
  exists: boolean;
  /**
   * Why buyers can't see what exists: the Hub hid the listing, or paused the shop (whose pages show the 404 while the
   * pause lasts, amendment 13.2). Null when they can, so the page may link it.
   */
  unseen: "hidden" | "paused" | null;
  /** The shop a pause would pause: the listing's, or the one reported. */
  shop: { slug: string; name: string } | null;
  /** What the Hub can still do, besides Dismiss (plan decision 5). Nothing once it's closed. */
  can: { hide: boolean; pause: boolean };
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

function toView(row: ReportRow): ReportView {
  const store = sampleStore();
  const open = row.status === "open";
  // A report about a deleted shop never reaches a new one on the same link (amendment 13.1).
  const gone = row.targetGone === true;
  const listing = row.targetKind === "listing" && !gone ? store.listings.get(row.targetId) : undefined;
  const shopSlug =
    row.targetKind === "listing" ? listing?.sellerSlug : row.targetKind === "seller" ? row.targetId : undefined;
  const shopRow = shopSlug && !gone ? store.sellers.get(shopSlug) : undefined;
  const exists = row.targetKind === "request" || (row.targetKind === "listing" ? Boolean(listing) : Boolean(shopRow));
  let unseen: ReportView["unseen"] = null;
  if (exists && listing?.hiddenAt) unseen = "hidden";
  else if (exists && shopRow) {
    const profile = shopRow.ownerId ? store.sellerProfiles.get(shopRow.ownerId) : undefined;
    if (profile?.status === "paused" && profile.pausedBy === "staff") unseen = "paused";
  }
  // What Hide can do depends on the kind of target (amendment 7): a listing, as now; a shop is paused, not hidden; a
  // Looking For request is only dismissed here until stage H adds Hide the request.
  let canHide: boolean;
  switch (row.targetKind) {
    case "listing":
      canHide = open && Boolean(listing) && !listing?.hiddenAt;
      break;
    case "seller":
      canHide = false;
      break;
    case "request":
      canHide = false; // stage H
      break;
  }
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
      hide: canHide,
      pause: open && shopRow !== undefined && pausable(shopRow.slug),
    },
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
 * Hide the listing or Pause the account (spec 2.3, plan decision 5): every open report on the same target closes with
 * the outcome and the reason. Each one, for its reporter's notification. Stage H adds Hide the request on the same
 * confirm page and reuses this, so it stays target-generic (amendment 7).
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
    if (row.status !== "open" || row.targetKind !== target.kind || row.targetId !== target.id) continue;
    close(row, outcome, note, staffId, now);
    closed.push({ id: row.id, reporterId: row.reporterId, title: row.targetTitle });
  }
  return closed;
}
