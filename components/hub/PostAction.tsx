import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { hasPassed } from "@/lib/hub";
import { signInHref } from "@/lib/next-path";
import { sastToday } from "@/lib/time";
import type { HubPost } from "@/lib/types";

/**
 * RSVP for an event, or Request a slot for office hours, both through the sign-in page (community spec 5.2, decision
 * 1). Once the day has passed in SAST it says so instead (decision 6, plan decision 10). That depends on today's date,
 * so this small part renders per request; the rest of the post is prerendered.
 */
export async function PostAction({ post }: { post: Pick<HubPost, "id" | "kind" | "startsAt"> }) {
  // The clock is read only after connection() (decision 26).
  await connection();
  const passed = hasPassed(post, sastToday());
  const signIn = signInHref(`/hub/${post.id}`);

  let content: ReactNode;
  if (post.kind === "event") {
    content = passed ? (
      <p className="hub-post-passed">This event has passed</p>
    ) : (
      <Link href={signIn} prefetch={false} className="btn btn-primary hub-post-cta">
        RSVP
      </Link>
    );
  } else if (passed) {
    content = <p className="hub-post-passed">These office hours have passed</p>;
  } else {
    content = (
      <>
        <Link href={signIn} prefetch={false} className="btn btn-primary hub-post-cta">
          Request a slot
        </Link>
        <p className="hub-post-note">Tell the mentor what you&apos;d like help with when you sign in.</p>
      </>
    );
  }

  return (
    <div className="hub-post-action" data-kind={post.kind === "office-hours" ? "office-hours" : undefined}>
      {content}
    </div>
  );
}

/** The action's room while it streams in, the same height as its tallest state, so the page doesn't move. */
export function PostActionSkeleton({ kind }: { kind: HubPost["kind"] }) {
  return (
    <div
      className="hub-post-action"
      data-kind={kind === "office-hours" ? "office-hours" : undefined}
      aria-hidden="true"
    >
      <span className="skeleton hub-post-action-skeleton" />
    </div>
  );
}
