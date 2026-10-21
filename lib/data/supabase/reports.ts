import "server-only";
import { reasonLabel } from "@/lib/messaging/rules";
import type { ReportReason, ReportTarget } from "@/lib/types";
import { Refused } from "../refused";
import type * as Sample from "../reports";
import { iso } from "./rows";
import { forViewerAs } from "./viewer";

// Students' reports on Supabase (C2/C3 plan Task 13, decision 22; amendment 12). Everything is the reporter's own,
// through their own client (forViewerAs: the id is checked against the session, decision 2), never cached (decision
// 4): the reports policy and column grant let a reporter read their own reports, without the Hub's note or closer.
// - createReport is create_report, which checks the target is public, keeps one open report per target and allows 10
//   in any 24 hours, under the reporter's lock. It answers no id, so the open report is read back; no caller uses the
//   id (sendReport ignores it), the read only keeps the signature. Its 'rate-limited' and 'not-found', which the
//   action's own checks normally catch first, throw Refused (decision 3); sendReport catches them.
// - A report about something gone doesn't count as open (create_report's rule): hasOpenReport and the read-back leave
//   target_gone out.
// - Deleting an account is forget_account's (phase B): deleteReportsBy and forgetReportOwner throw a plain Error
//   (decision 21, amendment 4). `now` is unused: the database stamps the time.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

type Db = Awaited<ReturnType<typeof forViewerAs>>;

/** The reporter's open report on the target, if there is one (one at most: reports_one_open_per_target). */
async function openReportId(db: Db, reporterId: string, target: ReportTarget): Promise<string | null> {
  const { data, error } = await db
    .from("reports")
    .select("id")
    .eq("reporter_id", reporterId)
    .eq("target_kind", target.kind)
    .eq("target_id", target.id)
    .eq("status", "open")
    .eq("target_gone", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) failed("reports", error);
  return data?.id ?? null;
}

export const createReport: typeof Sample.createReport = async ({ reporterId, target, targetTitle, reason, detail }) => {
  const db = await forViewerAs(reporterId);
  const { data, error } = await db.rpc("create_report", {
    p_target_kind: target.kind,
    p_target_id: target.id,
    p_target_title: targetTitle,
    p_reason: reason,
    p_detail: detail,
  });
  if (error) failed("create_report", error);
  if (data === "rate-limited" || data === "not-found") throw new Refused(data);
  if (data !== "created" && data !== "already-open") throw new Error(`create_report answered ${String(data)}`);
  const id = await openReportId(db, reporterId, target);
  if (!id) throw new Error("create_report's report can't be read back");
  return id;
};

export const hasOpenReport: typeof Sample.hasOpenReport = async (reporterId, target) =>
  (await openReportId(await forViewerAs(reporterId), reporterId, target)) !== null;

export const countReportsSince: typeof Sample.countReportsSince = async (reporterId, since) => {
  const { count, error } = await (await forViewerAs(reporterId))
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", reporterId)
    .gt("created_at", since.toISOString());
  if (error) failed("reports", error);
  return count ?? 0;
};

/** The reporter's own reports, newest first. */
async function ownReports(reporterId: string) {
  const { data, error } = await (await forViewerAs(reporterId))
    .from("reports")
    .select("target_kind, target_title, reason, detail, status, created_at")
    .eq("reporter_id", reporterId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) failed("reports", error);
  return data;
}

export const listReportsBy: typeof Sample.listReportsBy = async (reporterId) =>
  (await ownReports(reporterId)).map((row) => ({
    kind: row.target_kind as ReportTarget["kind"],
    title: row.target_title,
    reason: row.reason as ReportReason,
    createdAt: iso(row.created_at),
    open: row.status === "open",
  }));

export const exportReports: typeof Sample.exportReports = async (reporterId) =>
  (await ownReports(reporterId)).map((row) => ({
    about: row.target_title,
    kind: row.target_kind as ReportTarget["kind"],
    reason: reasonLabel(row.reason as ReportReason),
    detail: row.detail,
    at: iso(row.created_at),
    status: row.status as "open" | "closed",
  }));

export const deleteReportsBy: typeof Sample.deleteReportsBy = async () => {
  throw new Error("deleteReportsBy runs in the database on Supabase");
};

export const forgetReportOwner: typeof Sample.forgetReportOwner = async () => {
  throw new Error("forgetReportOwner runs in the database on Supabase");
};
