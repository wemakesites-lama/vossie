import type { AuditKind, StaffArea } from "@/lib/types";

// The staff pages' addresses (staff tools spec section 3). No public page links to them and robots.txt names none
// (spec 2.1, plan decision 19).

export const ADMIN_PATH = "/admin";
export const ADMIN_SELLERS_PATH = "/admin/sellers";
export const ADMIN_REPORTS_PATH = "/admin/reports";
export const ADMIN_FEATURED_PATH = "/admin/featured";
export const ADMIN_POINTS_PATH = "/admin/pickup-points";
export const ADMIN_AUDIT_PATH = "/admin/audit";
export const HUB_MANAGE_PATH = "/hub/manage";
export const HUB_NEW_PATH = "/hub/new";
export const MENTOR_PATH = "/mentor";
export const MENTOR_EXPORT_PATH = "/mentor/export";

export const adminSellerPath = (slug: string) => `/admin/sellers/${slug}`;
export const declineSellerPath = (slug: string) => `/admin/sellers/${slug}/decline`;
export const pauseSellerPath = (slug: string) => `/admin/sellers/${slug}/pause`;
export const adminReportPath = (id: string) => `/admin/reports/${id}`;
export const hideReportedPath = (id: string) => `/admin/reports/${id}/hide`;
export const pauseReportedPath = (id: string) => `/admin/reports/${id}/pause`;
export const editPostPath = (id: string) => `/hub/${id}/edit`;
export const bookSlotPath = (id: string) => `/hub/${id}/book`;
export const mentorShopPath = (slug: string) => `/mentor/${slug}`;

/** Each area's front page, as the account page names it (plan decision 19). */
export const AREA_HOME: Readonly<Record<StaffArea, { href: string; label: string }>> = {
  admin: { href: ADMIN_PATH, label: "Admin console" },
  hub: { href: HUB_MANAGE_PATH, label: "Hub posts and office hours" },
  mentor: { href: MENTOR_PATH, label: "Mentor dashboard" },
};

/**
 * The staff frame's row of section links (spec section 3): the admin console's six sections, then the Hub's tools and
 * the mentor dashboard. The frame shows the ones the account may use.
 */
export const STAFF_SECTIONS: ReadonlyArray<{ href: string; label: string; area: StaffArea }> = [
  { href: ADMIN_PATH, label: "Overview", area: "admin" },
  { href: ADMIN_SELLERS_PATH, label: "Sellers", area: "admin" },
  { href: ADMIN_REPORTS_PATH, label: "Reports", area: "admin" },
  { href: ADMIN_FEATURED_PATH, label: "Featured", area: "admin" },
  { href: ADMIN_POINTS_PATH, label: "Pickup points", area: "admin" },
  { href: ADMIN_AUDIT_PATH, label: "Audit log", area: "admin" },
  { href: HUB_MANAGE_PATH, label: "Hub posts", area: "hub" },
  { href: MENTOR_PATH, label: "Mentoring", area: "mentor" },
];

/** The audit log with its filters in the link (spec 2.3: by staff member and by kind, as links). */
export function auditPath(filter: { staff: string | null; kind: AuditKind | null }): string {
  const params = new URLSearchParams();
  if (filter.staff) params.set("staff", filter.staff);
  if (filter.kind) params.set("kind", filter.kind);
  const query = params.toString();
  return query ? `${ADMIN_AUDIT_PATH}?${query}` : ADMIN_AUDIT_PATH;
}
