import { randomUUID } from "node:crypto";
import { auditKindOf, FORMER_STAFF } from "@/lib/staff/audit-words";
import type { AuditAction, AuditEntry, AuditKind, AuditTargetKind } from "@/lib/types";
import type { AuditRow } from "./rows";
import { sampleStore } from "./store";

// The audit log (staff tools spec 2.2, plan decision 6): one entry per staff action that changed something, written
// after the change has gone through. recordAudit is its only writer, and there's no function, page or action that
// changes or removes an entry. The one exception is POPIA: deleting an account forgets the person an entry names, and
// a deleted staff member shows as "Former staff member" (lib/data/staff-privacy.ts; amendments 17 and 21). Times come
// from the caller.

export type NewAuditEntry = {
  /** Who acted: their account and their first name now. */
  staff: { id: string; firstName: string };
  action: AuditAction;
  /** What it was done to, and its name now, kept in case it changes or goes. */
  target: { kind: AuditTargetKind; id: string; name: string };
  /** The reason or note, when the action asked for one. */
  detail?: string;
  /**
   * The person the entry names, so their deletion can forget them in it (amendment 21): a shop's owner (for a report,
   * the owner of the reported shop or listing's shop; for a pin, the pinned shop's owner) or a slot request's student.
   * Never a reporter. Null or absent when there's none (a sample shop, a request, a pickup point, a post).
   */
  subjectId?: string | null;
  now: Date;
};

export async function recordAudit(entry: NewAuditEntry): Promise<void> {
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
  // Newest added first, then by time: entries made in the same millisecond keep the order they were made in, reversed.
  return [...sampleStore().auditLog.values()]
    .reverse()
    .filter((row) => !filter.staff || row.staffId === filter.staff)
    .filter((row) => !filter.kind || auditKindOf(row.action) === filter.kind)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(toEntry);
}

/**
 * Every staff member in the log, for its filter links (spec 2.3): by first name, then anyone whose account has gone,
 * as "Former staff member" (amendments 17 and 31). Their entries keep their id, so the filter still finds them.
 */
export async function auditStaff(): Promise<{ id: string; name: string }[]> {
  const { accounts, auditLog } = sampleStore();
  const ids = new Set([...auditLog.values()].map((row) => row.staffId));
  const current: { id: string; name: string }[] = [];
  const former: { id: string; name: string }[] = [];
  for (const id of ids) {
    const account = accounts.get(id);
    if (account) current.push({ id, name: account.firstName });
    else former.push({ id, name: FORMER_STAFF });
  }
  current.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  former.sort((a, b) => a.id.localeCompare(b.id));
  return [...current, ...former];
}
