import { randomUUID } from "node:crypto";
import { reasonLabel } from "@/lib/messaging/rules";
import type { ReportReason, ReportSummary, ReportTarget } from "@/lib/types";
import type { ReportRow } from "./rows";
import { sampleStore } from "./store";

// Reports (messaging spec 2.8 and 3.4), for stage G's queue. A Server Action makes them (only it makes ids); stage G
// closes them. Times come from the caller.

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
  const id = `rep-${randomUUID()}`;
  sampleStore().reports.set(id, {
    id,
    reporterId,
    targetKind: target.kind,
    targetId: target.id,
    targetTitle,
    reason,
    detail,
    status: "open",
    createdAt: now.toISOString(),
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
  return byReporter(reporterId).some(
    (row) =>
      row.status === "open" && row.targetGone !== true && row.targetKind === target.kind && row.targetId === target.id,
  );
}

/** How many reports the account has sent since `since`, for the daily limit (plan decision 17). */
export async function countReportsSince(reporterId: string, since: Date): Promise<number> {
  return byReporter(reporterId).filter((row) => Date.parse(row.createdAt) > since.getTime()).length;
}

/** The account's own reports, newest first, for privacy settings (plan decision 18). */
export async function listReportsBy(reporterId: string): Promise<ReportSummary[]> {
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
  const { reports } = sampleStore();
  for (const [id, row] of reports) {
    if (row.reporterId === reporterId) reports.delete(id);
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
  return byReporter(reporterId).map((row) => ({
    about: row.targetTitle,
    kind: row.targetKind,
    reason: reasonLabel(row.reason),
    detail: row.detail,
    at: row.createdAt,
    status: row.status,
  }));
}
