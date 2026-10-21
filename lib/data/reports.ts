import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { reasonLabel } from "@/lib/messaging/rules";
import type { ReportReason, ReportSummary, ReportTarget } from "@/lib/types";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// Reports (messaging spec 2.8 and 3.4), for stage G's queue. A Server Action makes them (only it makes ids); stage G
// closes them. Times come from the caller.
//
// On Supabase (C2/C3 plan Task 13, decision 22) each function's twin is lib/data/supabase/reports.ts, picked on its
// first line through import(): create_report and the reporter's own rows, through their own client.

const supabase = () => import("./supabase/reports");

/** A new, open report (spec 3.4). Its id, for stage G. */
export async function createReport({
  reporterId,
  target,
  targetTitle,
  reason,
  detail,
  now,
}: {
  reporterId: string;
  target: ReportTarget;
  targetTitle: string;
  reason: ReportReason;
  detail: string;
  now: Date;
}): Promise<string> {
  if (onSupabase()) return (await supabase()).createReport({ reporterId, target, targetTitle, reason, detail, now });
  const id = `rep-${randomUUID()}`;
  const store = sampleStore();
  const shopSlug = target.kind === "listing" ? store.listings.get(target.id)?.sellerSlug : target.id;
  const targetOwnerId =
    target.kind === "request"
      ? (store.requests.get(target.id)?.askerId ?? null)
      : ((shopSlug ? store.sellers.get(shopSlug)?.ownerId : null) ?? null);
  store.reports.set(id, {
    id,
    reporterId,
    targetKind: target.kind,
    targetId: target.id,
    targetTitle,
    reason,
    detail,
    status: "open",
    createdAt: now.toISOString(),
    targetOwnerId,
  });
  return id;
}

function byReporter(reporterId: string): ReportRow[] {
  return [...sampleStore().reports.values()]
    .filter((row) => row.reporterId === reporterId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/**
 * Whether the account already has an open report on this target (plan decision 17). A report about something that has
 * gone doesn't count: a new shop on the same link is a different shop (staff tools amendments 13.1 and 14.2).
 */
export async function hasOpenReport(reporterId: string, target: ReportTarget): Promise<boolean> {
  if (onSupabase()) return (await supabase()).hasOpenReport(reporterId, target);
  return byReporter(reporterId).some(
    (row) =>
      row.status === "open" && row.targetGone !== true && row.targetKind === target.kind && row.targetId === target.id,
  );
}

/** How many reports the account has sent since `since`, for the daily limit (plan decision 17). */
export async function countReportsSince(reporterId: string, since: Date): Promise<number> {
  if (onSupabase()) return (await supabase()).countReportsSince(reporterId, since);
  return byReporter(reporterId).filter((row) => Date.parse(row.createdAt) > since.getTime()).length;
}

/** The account's own reports, newest first, for privacy settings (plan decision 18). */
export async function listReportsBy(reporterId: string): Promise<ReportSummary[]> {
  if (onSupabase()) return (await supabase()).listReportsBy(reporterId);
  return byReporter(reporterId).map((row) => ({
    kind: row.targetKind,
    title: row.targetTitle,
    reason: row.reason,
    createdAt: row.createdAt,
    open: row.status === "open",
  }));
}

/** Deleting an account removes its reports (plan decision 14). */
export async function deleteReportsBy(reporterId: string): Promise<void> {
  if (onSupabase()) return (await supabase()).deleteReportsBy(reporterId);
  const { reports } = sampleStore();
  for (const [id, row] of reports) {
    if (row.reporterId === reporterId) reports.delete(id);
  }
}

/** Deleting an account takes its id off the reports about its things; the reports stay for the Hub (stage L review). */
export async function forgetReportOwner(accountId: string): Promise<void> {
  if (onSupabase()) return (await supabase()).forgetReportOwner(accountId);
  for (const row of sampleStore().reports.values()) {
    if (row.targetOwnerId === accountId) row.targetOwnerId = null;
  }
}

/** A report in the account's data export (plan decision 15). No ids. */
export type ReportExport = {
  about: string;
  kind: ReportTarget["kind"];
  reason: string;
  detail: string;
  at: string;
  status: "open" | "closed";
};

export async function exportReports(reporterId: string): Promise<ReportExport[]> {
  if (onSupabase()) return (await supabase()).exportReports(reporterId);
  return byReporter(reporterId).map((row) => ({
    about: row.targetTitle,
    kind: row.targetKind,
    reason: reasonLabel(row.reason),
    detail: row.detail,
    at: row.createdAt,
    status: row.status,
  }));
}
