import { connection } from "next/server";
import type { ReactNode } from "react";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getCampuses, getHubPosts } from "@/lib/data";
import {
  HUB_FEED_LABELS,
  HUB_FEED_TYPES,
  feedKinds,
  hubCampusName,
  hubFeedHref,
  readHubFeedType,
  type HubFeedType,
} from "@/lib/hub";
import { sastToday } from "@/lib/time";
import type { HubPost } from "@/lib/types";
import { HubPostCard } from "./HubPostCard";

/** What screen readers call the events-and-office-hours list on each tab (plan decision 5). */
const DATED_LABELS: Record<Exclude<HubFeedType, "tips">, string> = {
  all: "Events and office hours",
  events: "Events",
  "office-hours": "Office hours",
};

type HubFeedProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The Hub's feed (community spec 5.1): the type tabs, then upcoming events and office hours, soonest first, then tips,
 * newest first, from every campus (community spec decision 7). It reads the link and today's date, so it renders per
 * request, inside the page's <Suspense>.
 */
export async function HubFeed({ searchParams }: HubFeedProps) {
  const type = readHubFeedType((await searchParams).type);
  // Reading the link isn't enough for Next to allow a clock read: connection() defers the rest of this render to the
  // request (decision 26), as What's on does.
  await connection();
  const [posts, campuses] = await Promise.all([
    getHubPosts({ kinds: feedKinds(type), from: sastToday() }).catch(() => null),
    getCampuses(),
  ]);
  const campusNames = new Map(campuses.map((campus) => [campus.slug, campus.name]));

  let body: ReactNode;
  if (posts === null) {
    body = (
      <div className="section-error">
        <p>We couldn&apos;t load the Hub&apos;s posts just now.</p>
        <a href={hubFeedHref(type)} className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  } else {
    const dated = posts.filter((post) => post.kind !== "tip");
    const tips = posts.filter((post) => post.kind === "tip");
    body = (
      <>
        {type !== "tips" && (
          <FeedList
            label={DATED_LABELS[type]}
            posts={dated}
            empty="Nothing planned right now. Check back soon."
            campusNames={campusNames}
          />
        )}
        {(type === "all" || type === "tips") && (
          <FeedList label="Tips" posts={tips} empty="No tips yet." campusNames={campusNames} />
        )}
      </>
    );
  }

  const tabs = HUB_FEED_TYPES.map((key) => ({ key, label: HUB_FEED_LABELS[key], href: hubFeedHref(key) }));
  return (
    <>
      <LinkTabs label="Post types" tabs={tabs} current={type} look="tabs" />
      {body}
    </>
  );
}

type FeedListProps = {
  label: string;
  posts: readonly HubPost[];
  empty: string;
  campusNames: ReadonlyMap<string, string>;
};

/** One of the feed's lists, named for screen readers, or its empty line (plan decision 5). */
function FeedList({ label, posts, empty, campusNames }: FeedListProps) {
  if (posts.length === 0) return <p className="hub-feed-empty">{empty}</p>;
  return (
    <ul aria-label={label} className="hub-feed-list">
      {posts.map((post) => (
        <li key={post.id}>
          <HubPostCard post={post} campusName={hubCampusName(post.campusSlug, campusNames)} />
        </li>
      ))}
    </ul>
  );
}
