import { ALL_CAMPUSES } from "./campus";
import { sastDate } from "./time";
import type { HubEvent, HubPost, HubPostKind } from "./types";

/**
 * The groups a post belongs to (Launchpad spec 4.2): "all" is Coming up with no `type`. Tips have their own section,
 * not a tab, so only `HUB_FEED_TABS` are tabs.
 */
export const HUB_FEED_TYPES = ["all", "events", "office-hours", "tips"] as const;
export type HubFeedType = (typeof HUB_FEED_TYPES)[number];

/** Coming up's tabs, as `?type=` names them. */
export const HUB_FEED_TABS = ["all", "events", "office-hours"] as const;
export type HubFeedTab = (typeof HUB_FEED_TABS)[number];

/** The groups' names, which the post page's breadcrumb uses too. */
export const HUB_FEED_LABELS: Record<HubFeedType, string> = {
  all: "All",
  events: "Events",
  "office-hours": "Office hours",
  tips: "Tips",
};

const FEED_KINDS: Record<HubFeedTab, readonly HubPostKind[]> = {
  all: ["event", "office-hours"],
  events: ["event"],
  "office-hours": ["office-hours"],
};

const FEED_TYPE_OF: Record<HubPostKind, Exclude<HubFeedType, "all">> = {
  event: "events",
  "office-hours": "office-hours",
  tip: "tips",
};

/** Coming up's `?type=`. Anything it doesn't know, an old `?type=tips` link included, shows everything. */
export function readHubFeedType(raw: string | string[] | undefined): HubFeedTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return HUB_FEED_TABS.find((type) => type === value) ?? "all";
}

/** The kinds of dated post a tab shows in Coming up. Tips show under every tab. */
export function feedKinds(type: HubFeedTab): readonly HubPostKind[] {
  return FEED_KINDS[type];
}

/** The group that holds a kind of post, for a post page's breadcrumb. */
export function feedTypeOf(kind: HubPostKind): Exclude<HubFeedType, "all"> {
  return FEED_TYPE_OF[kind];
}

/** A group's link. A tab lands on Coming up, so a tap below the intro keeps it in view; Tips lands on its section. */
export function hubFeedHref(type: HubFeedType): string {
  if (type === "tips") return "/hub#hub-tips";
  return type === "all" ? "/hub#hub-coming-up" : `/hub?type=${type}#hub-coming-up`;
}

/** The South African date (YYYY-MM-DD) an event or office hours fall on; null for a tip. */
export function postDate(post: Pick<HubPost, "startsAt">): string | null {
  return post.startsAt === null ? null : sastDate(new Date(post.startsAt));
}

/**
 * Whether an event or office hours are over (community spec 5.2, decision 6): their date is before `today`, the SAST
 * date. Today's still count as upcoming, as on the feed and the homepage. A tip never passes.
 */
export function hasPassed(post: Pick<HubPost, "startsAt">, today: string): boolean {
  const date = postDate(post);
  return date !== null && date < today;
}

/**
 * The feed's order (community spec 5.1): events and office hours on or after `from` (the SAST date), soonest first,
 * then tips, newest first. Past events and office hours drop off.
 */
export function orderHubPosts(posts: readonly HubPost[], from: string): HubPost[] {
  const dated: HubPost[] = [];
  const tips: HubPost[] = [];
  for (const post of posts) {
    const date = postDate(post);
    if (date === null) tips.push(post);
    else if (date >= from) dated.push(post);
  }
  // ISO times in UTC sort as text.
  dated.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  tips.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return [...dated, ...tips];
}

/** What's on's row on the homepage (community spec 5.3): the SAST date, and RSVP for an event or Book otherwise. */
export function toHubEvent(post: HubPost): HubEvent | null {
  const date = postDate(post);
  if (date === null) return null;
  return {
    id: post.id,
    date,
    title: post.title,
    campusSlug: post.campusSlug,
    action: post.kind === "event" ? "rsvp" : "book",
  };
}

/** Where a post is for: "All campuses", or the campus's name (community spec 5.1). */
export function hubCampusName(campusSlug: string, campusNames: ReadonlyMap<string, string>): string {
  return campusSlug === ALL_CAMPUSES ? "All campuses" : (campusNames.get(campusSlug) ?? "");
}
