import { isId } from "@/lib/messaging/paths";
import type { AuditAction, AuditKind } from "@/lib/types";

// The audit log's words (staff tools spec 2.2) and its filter by kind (spec 2.3). Plain values and functions.

/** Each action's words in the log, and the kind it's filed under. */
const ACTIONS: Readonly<Record<AuditAction, { label: string; kind: AuditKind }>> = {
  "shop-approved": { label: "Approved a shop", kind: "shops" },
  "shop-declined": { label: "Declined a shop", kind: "shops" },
  "shop-verified": { label: "Verified a shop", kind: "shops" },
  "shop-unverified": { label: "Took Verified away", kind: "shops" },
  "shop-paused": { label: "Paused a shop", kind: "shops" },
  "shop-resumed": { label: "Resumed a shop", kind: "shops" },
  "mentor-assigned": { label: "Assigned a mentor", kind: "mentoring" },
  "mentor-removed": { label: "Removed a mentor", kind: "mentoring" },
  "report-dismissed": { label: "Dismissed a report", kind: "reports" },
  "listing-hidden": { label: "Hid a listing", kind: "reports" },
  "request-hidden": { label: "Hid a request", kind: "reports" },
  "featured-pinned": { label: "Pinned to Featured", kind: "featured" },
  "featured-unpinned": { label: "Removed a Featured pin", kind: "featured" },
  "point-added": { label: "Added a pickup point", kind: "pickup-points" },
  "point-renamed": { label: "Renamed a pickup point", kind: "pickup-points" },
  "point-retired": { label: "Retired a pickup point", kind: "pickup-points" },
  "point-restored": { label: "Used a pickup point again", kind: "pickup-points" },
  "post-created": { label: "Wrote a Hub post", kind: "posts" },
  "post-updated": { label: "Changed a Hub post", kind: "posts" },
  "booking-accepted": { label: "Accepted a slot request", kind: "office-hours" },
  "booking-declined": { label: "Declined a slot request", kind: "office-hours" },
  "note-added": { label: "Added a mentor's note", kind: "mentoring" },
  "check-in-added": { label: "Added a check-in", kind: "mentoring" },
  // Stage J: staff accounts (spec decision 7), and Show again beside the hides (spec decision 14).
  "role-given": { label: "Gave a staff role", kind: "staff" },
  "role-removed": { label: "Removed a staff role", kind: "staff" },
  "listing-shown": { label: "Showed a listing again", kind: "reports" },
  "request-shown": { label: "Showed a request again", kind: "reports" },
};

/** The log's kinds, in the filter's order. */
export const AUDIT_KINDS: ReadonlyArray<{ kind: AuditKind; label: string }> = [
  { kind: "shops", label: "Shops" },
  { kind: "reports", label: "Reports" },
  { kind: "featured", label: "Featured" },
  { kind: "pickup-points", label: "Pickup points" },
  { kind: "posts", label: "Hub posts" },
  { kind: "office-hours", label: "Office hours" },
  { kind: "mentoring", label: "Mentoring" },
  { kind: "staff", label: "Staff accounts" },
];

export function auditLabel(action: AuditAction): string {
  return ACTIONS[action].label;
}

export function auditKindOf(action: AuditAction): AuditKind {
  return ACTIONS[action].kind;
}

/** Every action filed under a kind, in the log's own order: the inverse of auditKindOf, for a database filter (C5). */
export function actionsOf(kind: AuditKind): AuditAction[] {
  return (Object.keys(ACTIONS) as AuditAction[]).filter((action) => ACTIONS[action].kind === kind);
}

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw) ?? "";

/** The log's filters from the link (`?staff=…&kind=…`). A staff id that isn't an id, or a kind it doesn't know, is no filter. */
export function parseAuditFilter(params: Readonly<Record<string, string | string[] | undefined>>): {
  staff: string | null;
  kind: AuditKind | null;
} {
  const staff = first(params.staff);
  const kind = first(params.kind);
  return {
    staff: isId(staff) ? staff : null,
    kind: AUDIT_KINDS.find((item) => item.kind === kind)?.kind ?? null,
  };
}
