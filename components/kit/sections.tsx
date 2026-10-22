import {
  BagIcon,
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  FlagIcon,
  GridIcon,
  HomeIcon,
  InfoIcon,
  MenuIcon,
  MessageIcon,
  PlusSquareIcon,
  ShieldIcon,
  StoreIcon,
} from "@/components/icons";
import { getViewer } from "@/lib/auth/session";
import { openBookingCount } from "@/lib/data/hub-posts";
import { getShopOf } from "@/lib/data/shops";
import { signInHref } from "@/lib/next-path";
import { onboardingPath } from "@/lib/selling/paths";
import { openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import { queueFor } from "@/lib/selling/queue";
import {
  ADMIN_MORE_PATH,
  ADMIN_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_SELLERS_PATH,
  HUB_MANAGE_PATH,
  MENTOR_EXPORT_PATH,
  MENTOR_PATH,
} from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
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
    href: "/messages?tab=selling",
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

/** The Hub console: admins only. Badges from the same counters the Overview shows (plan decision 3). */
export async function AdminBar() {
  const account = await getViewer().catch(() => null);
  if (!canUse(account, "admin")) return null;
  const [waiting, reports, slots] = await Promise.all([
    orNull(countWaitingShops()),
    orNull(openReportCount()),
    orNull(openBookingCount()),
  ]);
  const tabs: SectionTab[] = [
    { key: "today", href: ADMIN_PATH, label: "Today", icon: <GridIcon />, prefetch: false },
    {
      key: "shops",
      href: ADMIN_SELLERS_PATH,
      label: "Shops",
      icon: <StoreIcon />,
      match: "section",
      prefetch: false,
      badge: badge(waiting, "shop waiting", "shops waiting"),
    },
    {
      key: "reports",
      href: ADMIN_REPORTS_PATH,
      label: "Reports",
      icon: <FlagIcon />,
      match: "section",
      prefetch: false,
      badge: badge(reports, "open report", "open reports"),
    },
    {
      key: "hub",
      href: HUB_MANAGE_PATH,
      label: "Hub",
      icon: <CalendarIcon />,
      prefetch: false,
      badge: badge(slots, "slot request waiting", "slot requests waiting"),
    },
    { key: "more", href: ADMIN_MORE_PATH, label: "More", icon: <MenuIcon />, prefetch: false },
  ];
  return <SectionBar label="Hub console" tabs={tabs} />;
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
    { key: "posts", href: HUB_MANAGE_PATH, label: "Posts", icon: <PlusSquareIcon />, prefetch: false },
    { key: "export", href: MENTOR_EXPORT_PATH, label: "Export", icon: <DownloadIcon />, download: true },
    EXIT,
  ];
  return <SectionBar label="Mentoring" tabs={tabs} />;
}
