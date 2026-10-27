import type { StaffArea } from "@/lib/types";
import {
  ADMIN_AUDIT_PATH,
  ADMIN_FEATURED_PATH,
  ADMIN_HIDDEN_PATH,
  ADMIN_NUMBERS_PATH,
  ADMIN_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_SELLERS_PATH,
  ADMIN_STAFF_PATH,
  HUB_MANAGE_PATH,
  MENTOR_PATH,
} from "./paths";

// The Hub console's sections (wayfinding spec 3.3): one list for the sidebar, the phone's More, each section's purpose
// line under its title and the trail's names. Grouped by what the admin is there to do.

export type StaffGroupKey = "needs" | "hub" | "insight" | "setup";

export const STAFF_GROUPS: ReadonlyArray<{ key: StaffGroupKey; label: string }> = [
  { key: "needs", label: "Needs you" },
  { key: "hub", label: "Hub" },
  { key: "insight", label: "Insight" },
  { key: "setup", label: "Set up" },
];

export type StaffSection = {
  key: string;
  href: string;
  label: string;
  group: StaffGroupKey;
  /** One line under the section's title and beside its row in More: what the section is for. */
  purpose: string;
  /** Who may open it: an admin may open every area. */
  area: StaffArea;
  /** On the phone's bottom bar (with this shorter label); the rest are in More. */
  phone?: string;
  /** "section": also current on the pages below href (a shop's review under Shops). */
  match?: "section";
  /** Other paths whose pages also make it current: Posts on Write a post and Edit a post. */
  also?: readonly string[];
};

/**
 * The Hub's staff pages (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`). Only staff pages show a staff bar, so "/hub"
 * there means these, never Launchpad's own pages.
 */
export const HUB_TOOLS_ALSO: readonly string[] = ["/hub"];

export const STAFF_SECTIONS: readonly StaffSection[] = [
  {
    key: "today",
    href: ADMIN_PATH,
    label: "Today",
    group: "needs",
    purpose: "Everything waiting for the Hub, oldest first.",
    area: "admin",
    phone: "Today",
  },
  {
    key: "shops",
    href: ADMIN_SELLERS_PATH,
    label: "Shops",
    group: "needs",
    purpose: "Approve new shops, and pause any that break the rules.",
    area: "admin",
    phone: "Shops",
    match: "section",
  },
  {
    key: "reports",
    href: ADMIN_REPORTS_PATH,
    label: "Reports",
    group: "needs",
    purpose: "Decide what happens to what students report.",
    area: "admin",
    phone: "Reports",
    match: "section",
  },
  {
    key: "hidden",
    href: ADMIN_HIDDEN_PATH,
    label: "Hidden",
    group: "needs",
    purpose: "Listings and requests the Hub has hidden, and showing them again.",
    area: "admin",
    match: "section",
  },
  {
    key: "posts",
    href: HUB_MANAGE_PATH,
    label: "Posts and office hours",
    group: "hub",
    purpose: "Write tips and events, and answer office-hours requests.",
    area: "hub",
    phone: "Hub",
    also: HUB_TOOLS_ALSO,
  },
  {
    key: "mentoring",
    href: MENTOR_PATH,
    label: "Mentoring",
    group: "hub",
    purpose: "Check in with the shops you mentor, the ones needing help first.",
    area: "mentor",
    match: "section",
  },
  {
    key: "numbers",
    href: ADMIN_NUMBERS_PATH,
    label: "Last week",
    group: "insight",
    purpose: "How the marketplace did last week, by campus.",
    area: "admin",
  },
  {
    key: "audit",
    href: ADMIN_AUDIT_PATH,
    label: "Audit log",
    group: "insight",
    purpose: "Every staff action, newest first. Nothing in it can be changed.",
    area: "admin",
  },
  {
    key: "featured",
    href: ADMIN_FEATURED_PATH,
    label: "Featured",
    group: "setup",
    purpose: "The shops pinned to each campus.",
    area: "admin",
  },
  {
    key: "points",
    href: ADMIN_POINTS_PATH,
    label: "Pickup points",
    group: "setup",
    purpose: "The safe places to meet on each campus.",
    area: "admin",
  },
  {
    key: "staff",
    href: ADMIN_STAFF_PATH,
    label: "Staff",
    group: "setup",
    purpose: "Who has the Admin or Mentor role, and giving or removing one.",
    area: "admin",
    match: "section",
  },
];

/**
 * The pages the admin bar's More holds on phones: every section without a phone tab. On these, and the pages below
 * them, More is the current tab (through NavLink's `also`).
 */
export const ADMIN_MORE_SECTIONS: readonly string[] = STAFF_SECTIONS.filter((section) => !section.phone).map(
  (section) => section.href,
);

/** The section whose front page is `route`, if it is one. */
export function sectionAt(route: string): StaffSection | undefined {
  return STAFF_SECTIONS.find((section) => section.href === route);
}
