import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { auditKindOf } from "@/lib/staff/audit-words";
import type { AuditAction, AuditEntry, AuditKind, AuditTargetKind } from "@/lib/types";
import type { AuditRow } from "./rows";
import { sampleStore } from "./store";

// The audit log (staff tools spec 2.2, plan decision 6): one entry per staff action that changed something, written
// after the change has gone through. recordAudit is its only writer, and there's no function, page or action that
// changes or removes an entry. The one exception is POPIA: deleting an account forgets the person in it
// (lib/data/staff-privacy.ts). Times come from the caller. On Supabase the staff functions write the entry in their own
// transaction, so recordAudit's twin throws, and the reads are lib/data/supabase/audit.ts's (C4/C5 plan Task 13).

export type NewAuditEntry = {
  /** Who acted: their account and their first name now. */
  staff: { id: string; firstName: string };
  action: AuditAction;
  /** What it was done to, and its name now, kept in case it changes or goes. */
  target: { kind: AuditTargetKind; id: string; name: string };
  /** The reason or note, when the action asked for one. */
  detail?: string;
  /** The student it was about (a shop's owner, a reporter, a slot request's student), so their deletion can forget them. */
  subjectId?: string | null;
  /** The person the detail names, when they're neither the staff member nor the subject (a mentor-assigned entry's mentor), so their deletion can forget the name. */
  relatedId?: string | null;
  now: Date;
};

export async function recordAudit(entry: NewAuditEntry): Promise<void> {
  if (onSupabase()) return (await import("./supabase/audit")).recordAudit(entry);
  const id = `aud-${randomUUID()}`;
  sampleStore().auditLog.set(id, {
    id,
    at: entry.now.toISOString(),
    staffId: entry.staff.id,
    staffName: entry.staff.firstName,
    action: entry.action,
    targetKind: entry.target.kind,
    targetId: entry.target.id,
    targetName: entry.target.name,
    detail: entry.detail ?? "",
    subjectId: entry.subjectId ?? null,
    relatedId: entry.relatedId ?? null,
  });
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    at: row.at,
    staffId: row.staffId,
    staffName: row.staffName,
    action: row.action,
    targetKind: row.targetKind,
    targetName: row.targetName,
    detail: row.detail,
  };
}

/** The log, newest first (spec 2.3), by one staff member and of one kind when asked, at most `limit` entries. */
export async function listAudit(
  filter: { staff: string | null; kind: AuditKind | null },
  limit = 200,
): Promise<AuditEntry[]> {
  if (onSupabase()) return (await import("./supabase/audit")).listAudit(filter, limit);
  // Newest added first, then by time: entries made in the same millisecond keep the order they were made in, reversed.
  return [...sampleStore().auditLog.values()]
    .reverse()
    .filter((row) => !filter.staff || row.staffId === filter.staff)
    .filter((row) => !filter.kind || auditKindOf(row.action) === filter.kind)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(toEntry);
}

/** Every staff member in the log, by first name, for its filter links (spec 2.3). Deleted accounts aren't listed. */
export async function auditStaff(): Promise<{ id: string; name: string }[]> {
  if (onSupabase()) return (await import("./supabase/audit")).auditStaff();
  const names = new Map<string, string>();
  for (const row of sampleStore().auditLog.values()) {
    if (row.staffId) names.set(row.staffId, row.staffName);
  }
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
