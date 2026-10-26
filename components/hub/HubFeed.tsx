import { connection } from "next/server";
import type { ReactNode } from "react";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getCampuses, getHubPosts } from "@/lib/data";
import {
  HUB_FEED_LABELS,
  HUB_FEED_TABS,
  feedKinds,
  hubCampusName,
  hubFeedHref,
  readHubFeedType,
  type HubFeedTab,
} from "@/lib/hub";
import { sastToday } from "@/lib/time";
import { HubPostRow, HubTipRow } from "./HubPostRow";

/** What screen readers call Coming up's list on each tab (plan decision 5). */
const DATED_LABELS: Record<HubFeedTab, string> = {
  all: "Events and office hours",
  events: "Events",
  "office-hours": "Office hours",
};

type HubFeedProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Launchpad's posts (Launchpad spec 4.2 and 4.3): Coming up, with its type tabs and upcoming events and office hours,
 * soonest first, from every campus (community spec decision 7); then Tips, newest first, under every tab. One read
 * feeds both, so they share one error. It reads the link and today's date, so it renders per request, inside the
 * page's <Suspense>.
 */
export async function HubFeed({ searchParams }: HubFeedProps) {
  const type = readHubFeedType((await searchParams).type);
  // Reading the link isn't enough for Next to allow a clock read: connection() defers the rest of this render to the
  // request (decision 26), as What's on does.
  await connection();
  const [posts, campuses] = await Promise.all([
    getHubPosts({ kinds: [...feedKinds(type), "tip"], from: sastToday() }).catch(() => null),
    getCampuses(),
  ]);
  const campusNames = new Map(campuses.map((campus) => [campus.slug, campus.name]));
  const tabs = HUB_FEED_TABS.map((key) => ({ key, label: HUB_FEED_LABELS[key], href: hubFeedHref(key) }));

  let comingUp: ReactNode;
  let tips: ReactNode = null;
  if (posts === null) {
    comingUp = (
      <div className="section-error">
        <p>We couldn&apos;t load what&apos;s coming up just now.</p>
        <a href={hubFeedHref(type)} className="btn btn-outline text-navy">
          Try again
        </a>
      </div>
    );
  } else {
    const dated = posts.filter((post) => post.kind !== "tip");
    const tipPosts = posts.filter((post) => post.kind === "tip");
    comingUp =
      dated.length === 0 ? (
        <p className="hub-feed-empty">Nothing planned right now. Check back soon.</p>
      ) : (
        <ul aria-label={DATED_LABELS[type]} className="hub-rows">
          {dated.map((post) => (
            <li key={post.id}>
              <HubPostRow post={post} campusName={hubCampusName(post.campusSlug, campusNames)} />
            </li>
          ))}
        </ul>
      );
    tips = (
      <section id="hub-tips" aria-labelledby="hub-tips-title" className="hub-section">
        <h2 id="hub-tips-title" className="listing-section-title">
          Tips
        </h2>
        {tipPosts.length === 0 ? (
          <p className="hub-feed-empty">No tips yet.</p>
        ) : (
          <ul aria-label="Tips" className="hub-rows">
            {tipPosts.map((post) => (
              <li key={post.id}>
                <HubTipRow post={post} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <>
      {/* The tabs link to #hub-coming-up, so a tap keeps the list in view (plan decision 6). */}
      <section id="hub-coming-up" aria-labelledby="hub-coming-up-title" className="hub-section">
        <h2 id="hub-coming-up-title" className="listing-section-title">
          Coming up
        </h2>
        <LinkTabs label="Post types" tabs={tabs} current={type} look="tabs" />
        {/* Book office hours lands here, so the tab says what booking is (Lama, 2026-10-26). */}
        {type === "office-hours" && (
          <p className="hub-feed-note">
            Office hours are free 20-minute sessions with a Hub mentor, on your campus or online. Choose one, say what
            you&apos;d like help with, and the mentor replies with a time.
          </p>
        )}
        {comingUp}
      </section>
      {tips}
    </>
  );
}
