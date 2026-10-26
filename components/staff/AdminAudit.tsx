import { AUDIT_KINDS, auditLabel } from "@/lib/staff/audit-words";
import { ADMIN_AUDIT_PATH } from "@/lib/staff/paths";
import { sastDateTime } from "@/lib/time";
import type { AuditEntry, AuditKind } from "@/lib/types";
import { FilterForm } from "./FilterForm";
import { StaffTable } from "./StaffTable";

type AdminAuditProps = {
  entries: readonly AuditEntry[];
  /** Everyone in the log, for the staff filter. */
  staff: readonly { id: string; name: string }[];
  filter: { staff: string | null; kind: AuditKind | null };
};

/**
 * The audit log (spec 2.2 and 2.3, plan decision 6): every staff action, newest first, with when (in SAST), who, what,
 * what it was about then, and the reason or note. Filtered by staff member and by kind through a GET form, so a filter
 * is an address. Nothing here edits an entry: there's no way to.
 */
export function AdminAudit({ entries, staff, filter }: AdminAuditProps) {
  return (
    <>
      <FilterForm
        id="audit-filter"
        path={ADMIN_AUDIT_PATH}
        label="Filter the log"
        fields={[
          {
            name: "staff",
            label: "Staff member",
            options: [{ value: "", label: "Everyone" }, ...staff.map((person) => ({ value: person.id, label: person.name }))],
            chosen: filter.staff ?? "",
          },
          {
            name: "kind",
            label: "Kind",
            options: [{ value: "", label: "Every kind" }, ...AUDIT_KINDS.map((item) => ({ value: item.kind, label: item.label }))],
            chosen: filter.kind ?? "",
          },
        ]}
      />
      <section aria-labelledby="admin-log-title" className="staff-section">
        <h2 id="admin-log-title" className="sr-only">
          Entries
        </h2>
        <StaffTable
          caption="The audit log, newest first"
          columns={["When", "Who", "What", "About", "Detail"]}
          rows={entries.map((entry) => ({
            key: entry.id,
            cells: [
              <time key="when" dateTime={entry.at}>
                {sastDateTime(entry.at)}
              </time>,
              entry.staffName,
              auditLabel(entry.action),
              entry.targetName,
              entry.detail || "None",
            ],
          }))}
          empty="Nothing in the log matches."
        />
      </section>
    </>
  );
}
