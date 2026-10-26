import type { StaffArea, StaffRole } from "@/lib/types";

// The staff pages' addresses (staff tools spec section 3). No public page links to them and robots.txt names none
// (spec 2.1, plan decision 19).

export const ADMIN_PATH = "/admin";
export const ADMIN_SELLERS_PATH = "/admin/sellers";
export const ADMIN_REPORTS_PATH = "/admin/reports";
export const ADMIN_FEATURED_PATH = "/admin/featured";
export const ADMIN_POINTS_PATH = "/admin/pickup-points";
export const ADMIN_AUDIT_PATH = "/admin/audit";
export const ADMIN_NUMBERS_PATH = "/admin/numbers";
export const ADMIN_STAFF_PATH = "/admin/staff";
export const ADMIN_HIDDEN_PATH = "/admin/hidden";
/** The admin bar's More (role views spec 4.1): everything the five tabs don't hold. */
export const ADMIN_MORE_PATH = "/admin/more";
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
/** A role's confirm page (stage J spec decision 4). */
export const removeRolePath = (accountId: string, role: StaffRole) => `/admin/staff/${accountId}/remove-${role}`;
/** Show again's confirm pages (stage J spec decision 14). */
export const showListingPath = (id: string) => `/admin/hidden/listings/${id}`;
export const showRequestPath = (id: string) => `/admin/hidden/requests/${id}`;

/** The numbers, or one campus's view of them (stage J spec decision 12): a query, not a route. */
export function numbersPath(campusSlug: string | null): string {
  return campusSlug ? `${ADMIN_NUMBERS_PATH}?campus=${encodeURIComponent(campusSlug)}` : ADMIN_NUMBERS_PATH;
}

/** Each area's front page, as the account page names it (plan decision 19). */
export const AREA_HOME: Readonly<Record<StaffArea, { href: string; label: string }>> = {
  admin: { href: ADMIN_PATH, label: "Hub console" },
  hub: { href: HUB_MANAGE_PATH, label: "Hub posts and office hours" },
  mentor: { href: MENTOR_PATH, label: "Mentor dashboard" },
};

/**
 * The staff pages' eyebrow (role views spec 7.2: one name for the console). A test reads the staff folders for it.
 * `hubTools` is what a mentor without the admin role sees on the Hub's pages and Mentoring: they have no console.
 */
export const STAFF_EYEBROW = {
  admin: "Hub console",
  hub: "Hub console",
  hubTools: "Hub tools",
} as const;

/** The Hub pages' eyebrow: "Hub console" for an admin, "Hub tools" for a mentor, who has no console (Lama, N3 build). */
export function hubEyebrow(account: { roles: readonly StaffRole[] }): string {
  return account.roles.includes("admin") ? STAFF_EYEBROW.hub : STAFF_EYEBROW.hubTools;
}
