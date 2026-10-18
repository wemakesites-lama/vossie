import Link from "next/link";
import { AUDIT_KINDS, auditLabel } from "@/lib/staff/audit-words";
import { auditPath } from "@/lib/staff/paths";
import { sastDateTime } from "@/lib/time";
import type { AuditEntry, AuditKind } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type AdminAuditProps = {
  entries: readonly AuditEntry[];
  /** Everyone in the log, for the filter's links. */
  staff: readonly { id: string; name: string }[];
  filter: { staff: string | null; kind: AuditKind | null };
};

function FilterLink({ href, chosen, label }: { href: string; chosen: boolean; label: string }) {
  return (
    <li>
      <Link href={href} prefetch={false} aria-current={chosen ? "true" : undefined} className="staff-nav-link">
        {label}
      </Link>
    </li>
  );
}

/**
 * The audit log (spec 2.2 and 2.3, plan decision 6): every staff action, newest first, with when (in SAST), who, what,
 * what it was about then, and the reason or note. Filtered by staff member and by kind, as links, so a filter is an
 * address. Nothing here edits an entry: there's no way to.
 */
export function AdminAudit({ entries, staff, filter }: AdminAuditProps) {
  return (
    <>
      <nav aria-label="Filter the log" className="staff-filters">
        <p id="audit-staff-label" className="staff-filter-label">
          By staff member
        </p>
        <ul aria-labelledby="audit-staff-label">
          <FilterLink href={auditPath({ staff: null, kind: filter.kind })} chosen={filter.staff === null} label="Everyone" />
          {staff.map((person) => (
            <FilterLink
              key={person.id}
              href={auditPath({ staff: person.id, kind: filter.kind })}
              chosen={filter.staff === person.id}
              label={person.name}
            />
          ))}
        </ul>
        <p id="audit-kind-label" className="staff-filter-label">
          By kind
        </p>
        <ul aria-labelledby="audit-kind-label">
          <FilterLink href={auditPath({ staff: filter.staff, kind: null })} chosen={filter.kind === null} label="Every kind" />
          {AUDIT_KINDS.map((item) => (
            <FilterLink
              key={item.kind}
              href={auditPath({ staff: filter.staff, kind: item.kind })}
              chosen={filter.kind === item.kind}
              label={item.label}
            />
          ))}
        </ul>
      </nav>
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
