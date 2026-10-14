import { ALL_CAMPUSES } from "./campus";
import { sastDate } from "./time";
import type { HubEvent, HubPost, HubPostKind } from "./types";

/** The feed's tabs (community spec 5.1), as `?type=` names them. "all" is the feed with no `type`. */
export const HUB_FEED_TYPES = ["all", "events", "office-hours", "tips"] as const;
export type HubFeedType = (typeof HUB_FEED_TYPES)[number];

/** The tabs' names, which the post page's breadcrumb uses too. */
export const HUB_FEED_LABELS: Record<HubFeedType, string> = {
  all: "All",
  events: "Events",
  "office-hours": "Office hours",
  tips: "Tips",
};

const FEED_KINDS: Record<HubFeedType, readonly HubPostKind[]> = {
  all: ["event", "office-hours", "tip"],
  events: ["event"],
  "office-hours": ["office-hours"],
  tips: ["tip"],
};

const FEED_TYPE_OF: Record<HubPostKind, Exclude<HubFeedType, "all">> = {
  event: "events",
  "office-hours": "office-hours",
  tip: "tips",
};

/** The feed's `?type=`. Anything it doesn't know shows everything. */
export function readHubFeedType(raw: string | string[] | undefined): HubFeedType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return HUB_FEED_TYPES.find((type) => type === value) ?? "all";
}

/** The kinds of post a tab shows. */
export function feedKinds(type: HubFeedType): readonly HubPostKind[] {
  return FEED_KINDS[type];
}

/** The tab that holds a kind of post, for a post page's breadcrumb. */
export function feedTypeOf(kind: HubPostKind): Exclude<HubFeedType, "all"> {
  return FEED_TYPE_OF[kind];
}

/** A tab's link. It lands on the feed, so a tap below the story keeps the feed in view (plan decision 6). */
export function hubFeedHref(type: HubFeedType): string {
  return type === "all" ? "/hub#hub-feed" : `/hub?type=${type}#hub-feed`;
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
