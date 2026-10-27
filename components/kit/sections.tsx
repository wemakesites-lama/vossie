import type { ReactNode } from "react";
import {
  AlertIcon,
  BagIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  DownloadIcon,
  FlagIcon,
  GridIcon,
  HomeIcon,
  InfoIcon,
  MapPinIcon,
  MenuIcon,
  MessageIcon,
  PlusSquareIcon,
  ShieldIcon,
  StoreIcon,
  TrendingIcon,
  UserIcon,
} from "@/components/icons";
import { getViewer } from "@/lib/auth/session";
import { openBookingCount } from "@/lib/data/hub-posts";
import { getShopOf } from "@/lib/data/shops";
import { inboxPath } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import { onboardingPath } from "@/lib/selling/paths";
import { openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import { queueFor } from "@/lib/selling/queue";
import { ADMIN_MORE_PATH, HUB_MANAGE_PATH, MENTOR_EXPORT_PATH, MENTOR_PATH } from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
import { ADMIN_MORE_SECTIONS, HUB_TOOLS_ALSO, STAFF_GROUPS, STAFF_SECTIONS } from "@/lib/staff/sections";
import { SectionBar, type SectionTab } from "./SectionBar";

// The three sections' bars (role views spec 4.1). Each reads the session itself, inside the layout's <Suspense>, and
// renders nothing for anyone the section isn't for, so the main bar stays (spec 8). Request-time.

const EXIT: SectionTab = { key: "exit", href: "/", label: "CampusCart", icon: <HomeIcon />, exit: true };

/** A count, or null when it failed: a failed badge shows nothing (spec 4.2). */
const orNull = (count: Promise<number>) => count.catch(() => null);

function badge(count: number | null, one: string, many: string): SectionTab["badge"] {
  return count === null ? null : { count, words: count === 1 ? one : many };
}

/**
 * Selling for anyone without a shop: a side panel in the column the shell reserves from the tablet step (hidden on
 * phones, where the main bar stays), so the pitch doesn't move when this arrives. Not a section bar: the phone rules
 * that hide the main bar and slim the footer never apply. A student without a shop starts at step 1; the wizard
 * itself picks up a draft.
 */
function sellSide(signedIn: boolean) {
  const start = onboardingPath(1);
  const tabs: SectionTab[] = [
    {
      key: "start",
      href: signedIn ? start : signInHref(start),
      label: "Start selling",
      icon: <PlusSquareIcon />,
      prefetch: false,
    },
    { key: "how", href: "/how-it-works", label: "How selling works", icon: <InfoIcon />, prefetch: false },
    { key: "guidelines", href: "/seller-guidelines", label: "Seller guidelines", icon: <ShieldIcon />, prefetch: false },
    EXIT,
  ];
  return <SectionBar label="Selling" tabs={tabs} side />;
}

/**
 * Selling: the bar only for an account that has a shop; the side panel for everyone else. A pending shop (waiting, or declined: still "pending" with the Hub's
 * reason, SellHome.tsx) has no Messages yet. Messages carries the buyers waiting for a reply, from the queue the home's
 * Needs you reads in the same request (role views N2 plan decision 8); a failed read shows no badge (spec 4.2).
 */
export async function SellBar() {
  const account = await getViewer().catch(() => null);
  if (!account) return sellSide(false);
  const own = await getShopOf(account.id).catch(() => null);
  if (!own) return sellSide(true);
  const open = own.status !== "pending";
  const waiting = open ? await queueFor(own.shop.slug).then((queue) => queue.replies.count, () => null) : null;
  const messages: SectionTab = {
    key: "messages",
    href: inboxPath("selling"),
    label: "Messages",
    icon: <MessageIcon />,
    prefetch: false,
    badge: badge(waiting, "buyer waiting for a reply", "buyers waiting for a reply"),
  };
  const tabs: SectionTab[] = [
    { key: "overview", href: "/sell", label: "Overview", icon: <GridIcon /> },
    { key: "listings", href: "/sell/listings", label: "Listings", icon: <BagIcon />, match: "section", prefetch: false },
    ...(open ? [messages] : []),
    { key: "shop", href: "/sell/profile", label: "Shop", icon: <StoreIcon />, prefetch: false },
    EXIT,
  ];
  return <SectionBar label="Selling" tabs={tabs} />;
}

const SECTION_ICONS: Readonly<Record<string, ReactNode>> = {
  today: <GridIcon />,
  shops: <StoreIcon />,
  reports: <FlagIcon />,
  hidden: <AlertIcon />,
  posts: <CalendarIcon />,
  mentoring: <UserIcon />,
  numbers: <ChartIcon />,
  audit: <ClockIcon />,
  featured: <TrendingIcon />,
  points: <MapPinIcon />,
  staff: <ShieldIcon />,
};

/**
 * The Hub console: admins only (wayfinding spec 3.3). Every section from lib/staff/sections.ts under its group's heading
 * in the sidebar; on phones the five tabs (Today, Shops, Reports, Hub, More), the rest in More. Badges from the same
 * counters Today's queue reads (plan decision 3).
 */
export async function AdminBar() {
  const account = await getViewer().catch(() => null);
  if (!canUse(account, "admin")) return null;
  const [waiting, reports, slots] = await Promise.all([
    orNull(countWaitingShops()),
    orNull(openReportCount()),
    orNull(openBookingCount()),
  ]);
  const badges: Partial<Record<string, SectionTab["badge"]>> = {
    shops: badge(waiting, "shop waiting", "shops waiting"),
    reports: badge(reports, "open report", "open reports"),
    posts: badge(slots, "slot request waiting", "slot requests waiting"),
  };
  const groupLabel = new Map(STAFF_GROUPS.map((group) => [group.key, group.label]));
  const tabs: SectionTab[] = STAFF_SECTIONS.map((section) => ({
    key: section.key,
    href: section.href,
    label: section.label,
    icon: SECTION_ICONS[section.key],
    group: groupLabel.get(section.group),
    match: section.match,
    also: section.also,
    prefetch: false,
    only: section.phone ? undefined : "wide",
    short: section.phone && section.phone !== section.label ? section.phone : undefined,
    badge: badges[section.key],
  }));
  const more: SectionTab = {
    key: "more",
    href: ADMIN_MORE_PATH,
    label: "More",
    icon: <MenuIcon />,
    prefetch: false,
    also: ADMIN_MORE_SECTIONS,
    only: "phone",
  };
  return <SectionBar label="Hub console" tabs={[...tabs, more, { ...EXIT, only: "wide" }]} />;
}

/** The staff pages outside /admin (the Hub's tools, Mentoring): the console's bar for an admin, else Mentoring's. */
export async function StaffBar() {
  const account = await getViewer().catch(() => null);
  return canUse(account, "admin") ? <AdminBar /> : <MentorBar />;
}

/** Mentoring: mentors and admins (staff tools spec 2.1). */
export async function MentorBar() {
  const account = await getViewer().catch(() => null);
  if (!canUse(account, "mentor")) return null;
  const slots = await orNull(openBookingCount());
  const tabs: SectionTab[] = [
    { key: "shops", href: MENTOR_PATH, label: "Shops", icon: <StoreIcon />, match: "section", prefetch: false },
    {
      key: "office-hours",
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      label: "Office hours",
      icon: <ClockIcon />,
      prefetch: false,
      badge: badge(slots, "slot request waiting", "slot requests waiting"),
    },
    { key: "posts", href: HUB_MANAGE_PATH, label: "Posts", icon: <PlusSquareIcon />, also: HUB_TOOLS_ALSO, prefetch: false },
    { key: "export", href: MENTOR_EXPORT_PATH, label: "Export", icon: <DownloadIcon />, download: true },
    EXIT,
  ];
  return <SectionBar label="Mentoring" tabs={tabs} />;
}
