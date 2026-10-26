import Link from "next/link";
import { NavPending } from "@/components/ui/NavPending";
import { hubKindLabel, placesLabel } from "@/lib/format";
import { FORWARD } from "@/lib/motion";
import { sastDateTime, shortSastDate } from "@/lib/time";
import type { HubPost } from "@/lib/types";

/**
 * An event or office hours in Coming up (Launchpad spec 4.2): a date block, the kind, the title, when, where and for
 * which campus, and for events how many are going. The date block is decorative: the <time> says the date. The title's
 * link covers the whole row. `campusName` is "All campuses" or the campus's name.
 */
export function HubPostRow({ post, campusName }: { post: HubPost; campusName: string }) {
  const startsAt = post.startsAt ?? post.publishedAt;
  const [day, month] = shortSastDate(startsAt).split(" ");
  return (
    <article className="hub-row">
      <p className="hub-row-date" aria-hidden="true">
        <span className="hub-row-day">{day}</span>
        <span className="hub-row-month">{month}</span>
      </p>
      <div className="hub-row-body">
        <p className="hub-row-kind">{hubKindLabel(post.kind)}</p>
        <h3 className="hub-row-title">
          {/* No prefetch: a list of posts, most of which won't be opened (decision 28). */}
          <Link href={`/hub/${post.id}`} prefetch={false} className="hub-row-link" transitionTypes={FORWARD}>
            {post.title}
            <NavPending />
          </Link>
        </h3>
        <p className="hub-row-meta">
          <time dateTime={startsAt}>{sastDateTime(startsAt)}</time> · {post.place} · {campusName}
        </p>
        {post.capacity !== null && post.going !== null && (
          <p className="hub-row-meta">{placesLabel(post.going, post.capacity)}</p>
        )}
      </div>
    </article>
  );
}

/** A tip (Launchpad spec 4.3): the title, the date it was posted and its one-line summary, the title's link covering the row. */
export function HubTipRow({ post }: { post: HubPost }) {
  return (
    <article className="hub-row hub-row-tip">
      <div className="hub-row-body">
        <h3 className="hub-row-title">
          {/* No prefetch: a list of posts, most of which won't be opened (decision 28). */}
          <Link href={`/hub/${post.id}`} prefetch={false} className="hub-row-link" transitionTypes={FORWARD}>
            {post.title}
            <NavPending />
          </Link>
        </h3>
        <p className="hub-row-meta">
          <time dateTime={post.publishedAt}>{shortSastDate(post.publishedAt)}</time>
        </p>
        <p className="hub-row-summary">{post.summary}</p>
      </div>
    </article>
  );
}
