import { connection } from "next/server";
import { SectionError } from "@/components/home/SectionError";
import { getHubPosts } from "@/lib/data";
import { hubCampusName } from "@/lib/hub";
import { sastToday } from "@/lib/time";
import { HubPostCard } from "./HubPostCard";

type UpcomingPostsProps = {
  /** The post this page shows, which is left out. */
  postId: string;
  campusNames: ReadonlyMap<string, string>;
};

/**
 * More from Launchpad (community spec 5.2): up to 3 other upcoming events and office hours, as the feed's cards. What
 * counts as upcoming depends on today's date, so this renders per request (plan decision 9). Hidden when nothing else
 * is planned.
 */
export async function UpcomingPosts({ postId, campusNames }: UpcomingPostsProps) {
  // The clock is read only after connection() (decision 26).
  await connection();
  const posts = await getHubPosts({ kinds: ["event", "office-hours"], from: sastToday() }).catch(() => null);
  const others = posts ? posts.filter((post) => post.id !== postId).slice(0, 3) : null;
  if (others && others.length === 0) return null;

  return (
    <section id="hub-upcoming" aria-labelledby="hub-upcoming-title" className="hub-upcoming">
      <h2 id="hub-upcoming-title" className="listing-section-title">
        More from Launchpad
      </h2>
      {others ? (
        <ul className="hub-feed-list">
          {others.map((post) => (
            <li key={post.id}>
              <HubPostCard post={post} campusName={hubCampusName(post.campusSlug, campusNames)} />
            </li>
          ))}
        </ul>
      ) : (
        <SectionError id="hub-upcoming" title="More from Launchpad" path={`/hub/${postId}`} />
      )}
    </section>
  );
}

/** More from Launchpad's room while it streams in: the heading and three cards. */
export function UpcomingPostsSkeleton() {
  return (
    <div className="hub-upcoming" aria-hidden="true">
      <span className="skeleton hub-upcoming-skeleton-title" />
      <ul className="hub-feed-list">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <span className="skeleton hub-card-skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}
