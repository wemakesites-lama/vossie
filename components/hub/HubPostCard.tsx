import Link from "next/link";
import type { ReactNode } from "react";
import { hubKindLabel, placesLabel } from "@/lib/format";
import { sastDateTime, shortSastDate } from "@/lib/time";
import type { HubPost } from "@/lib/types";

/**
 * A post in the Hub's feed (community spec 5.1): the kind as an eyebrow and the title; for events and office hours,
 * when (in SAST), where and for which campus, and for events how many are going; for tips, the date and a one-line
 * summary. The title's link covers the whole card. `campusName` is "All campuses" or the campus's name.
 */
export function HubPostCard({ post, campusName }: { post: HubPost; campusName: string }) {
  let details: ReactNode;
  if (post.startsAt === null) {
    details = (
      <>
        <p className="hub-card-when">
          <time dateTime={post.publishedAt}>{shortSastDate(post.publishedAt)}</time>
        </p>
        <p className="hub-card-summary">{post.summary}</p>
      </>
    );
  } else {
    details = (
      <>
        <p className="hub-card-when">
          <time dateTime={post.startsAt}>{sastDateTime(post.startsAt)}</time>
        </p>
        <p className="hub-card-where">
          {post.place} · {campusName}
        </p>
        {post.capacity !== null && post.going !== null && (
          <p className="hub-card-going">{placesLabel(post.going, post.capacity)}</p>
        )}
      </>
    );
  }

  return (
    <article className="hub-card">
      <p className="eyebrow hub-card-kind">{hubKindLabel(post.kind)}</p>
      <h3 className="hub-card-title">
        {/* No prefetch: a feed of posts, most of which won't be opened (decision 28). */}
        <Link href={`/hub/${post.id}`} prefetch={false} className="hub-card-link">
          {post.title}
        </Link>
      </h3>
      {details}
    </article>
  );
}
