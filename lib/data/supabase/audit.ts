import "server-only";
import { actionsOf } from "@/lib/staff/audit-words";
import type { AuditAction, AuditTargetKind } from "@/lib/types";
import type * as Sample from "../audit";
import { forViewer } from "./clients";
import { iso, selectAll } from "./rows";

// The audit log on Supabase (C4/C5 plan Task 13; decision 3). Each staff function writes its own entry in the same
// transaction as its change (private.record_audit), so there's no TypeScript writer: recordAudit throws, and a
// follow-up left outside sampleFollowUps fails loudly. The reads are the admin's, through audit_log's policy (anyone
// else reads no row) and the columns granted to them; who the entry was about (subject_id, related_id) isn't granted.
// Request-time only, never cached.

const COLUMNS = "id, at, staff_id, staff_name, action, target_kind, target_name, detail";

export const recordAudit: typeof Sample.recordAudit = async () => {
  throw new Error("recordAudit: on Supabase the staff function writes the audit row (C4/C5 plan decision 3)");
};

/** The log, newest first (by time, then id: each staff function writes one entry), filtered and limited in SQL. */
export const listAudit: typeof Sample.listAudit = async (filter, limit = 200) => {
  let query = (await forViewer()).from("audit_log").select(COLUMNS);
  if (filter.staff) query = query.eq("staff_id", filter.staff);
  if (filter.kind) query = query.in("action", actionsOf(filter.kind));
  const { data, error } = await query.order("at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(`audit_log failed (${error.code ?? "unknown"})`);
  return data.map((row) => ({
    id: row.id,
    at: iso(row.at),
    staffId: row.staff_id,
    staffName: row.staff_name,
    action: row.action as AuditAction,
    targetKind: row.target_kind as AuditTargetKind,
    targetName: row.target_name,
    detail: row.detail,
  }));
};

/**
 * Every staff member in the log, by first name: each one's name in their latest entry, as the sample's map keeps the
 * last it meets. A deleted account's entries have no staff id, so they aren't listed.
 */
export const auditStaff: typeof Sample.auditStaff = async () => {
  const client = await forViewer();
  const rows = await selectAll(
    () => client.from("audit_log").select("id, at, staff_id, staff_name").not("staff_id", "is", null),
    ["at", "id"],
  );
  const names = new Map<string, string>();
  for (const row of rows) if (row.staff_id) names.set(row.staff_id, row.staff_name);
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
};
