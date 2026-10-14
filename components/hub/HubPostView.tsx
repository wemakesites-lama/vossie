import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Photo } from "@/components/listings/Photo";
import { hubKindLabel, placesLabel } from "@/lib/format";
import { HUB_FEED_LABELS, feedTypeOf, hubCampusName, hubFeedHref } from "@/lib/hub";
import { longSastDate, sastDateTime } from "@/lib/time";
import type { HubPost } from "@/lib/types";
import { Markdown } from "./Markdown";
import { PostAction, PostActionSkeleton } from "./PostAction";
import { UpcomingPosts, UpcomingPostsSkeleton } from "./UpcomingPosts";

/**
 * A Hub post's page (community spec 5.2): the breadcrumb, the cover (decorative), the kind and title; for events and
 * office hours the facts, the body and then RSVP or Request a slot; for tips the posted date and the body. More from
 * the Hub follows. Only the action and More from the Hub render per request (plan decision 9).
 */
export function HubPostView({ post, campusNames }: { post: HubPost; campusNames: ReadonlyMap<string, string> }) {
  const feedType = feedTypeOf(post.kind);

  let when: ReactNode;
  if (post.startsAt === null) {
    when = (
      <p className="hub-post-date">
        Posted <time dateTime={post.publishedAt}>{longSastDate(post.publishedAt)}</time>
      </p>
    );
  } else {
    when = (
      <ul className="fact-pills hub-post-facts">
        <li>
          <time dateTime={post.startsAt}>{sastDateTime(post.startsAt)}</time>
        </li>
        <li>{post.place}</li>
        <li>{hubCampusName(post.campusSlug, campusNames)}</li>
        {post.capacity !== null && post.going !== null && <li>{placesLabel(post.going, post.capacity)}</li>}
      </ul>
    );
  }

  return (
    <div className="page hub-post-page">
      <nav aria-label="Breadcrumb" className="listing-crumbs">
        <ol>
          <li>
            <Link href="/hub">The Hub</Link>
          </li>
          <li>
            <Link href={hubFeedHref(feedType)} prefetch={false}>
              {HUB_FEED_LABELS[feedType]}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="hub-post">
        <Photo
          image={{ src: post.image.src, alt: "" }}
          sizes="(min-width: 48rem) and (min-height: 30rem) 736px, 100vw"
          className="hub-post-cover"
          priority
        />
        <p className="eyebrow hub-post-kind">{hubKindLabel(post.kind)}</p>
        <h1 className="hub-post-title">{post.title}</h1>
        {when}
        <Markdown source={post.body} className="hub-post-body" />
        {post.startsAt !== null && (
          <Suspense fallback={<PostActionSkeleton kind={post.kind} />}>
            <PostAction post={post} />
          </Suspense>
        )}
      </article>

      <Suspense fallback={<UpcomingPostsSkeleton />}>
        <UpcomingPosts postId={post.id} campusNames={campusNames} />
      </Suspense>
    </div>
  );
}
