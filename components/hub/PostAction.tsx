import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth/session";
import { hasRsvp, latestBooking } from "@/lib/data/hub-posts";
import { hasPassed } from "@/lib/hub";
import { cancelRsvp, rsvpToEvent } from "@/lib/hub-actions";
import { signInHref } from "@/lib/next-path";
import { HUB_NOTICE, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { bookSlotPath } from "@/lib/staff/paths";
import { sastToday } from "@/lib/time";
import type { HubPost } from "@/lib/types";

type ActionPost = Pick<HubPost, "id" | "kind" | "startsAt" | "capacity" | "going">;

async function eventAction(post: ActionPost, accountId: string | null): Promise<ReactNode> {
  if (!accountId) {
    return (
      <Link href={signInHref(`/hub/${post.id}`)} prefetch={false} className="btn btn-primary hub-post-cta">
        RSVP
      </Link>
    );
  }
  if (await hasRsvp(post.id, accountId)) {
    return (
      <div className="hub-rsvp-going">
        <p className="hub-rsvp-badge">You&apos;re going</p>
        <form action={cancelRsvp}>
          <input type="hidden" name="post" value={post.id} />
          <button type="submit" className="link-button">
            Cancel my RSVP
          </button>
        </form>
      </div>
    );
  }
  if (post.capacity !== null && (post.going ?? 0) >= post.capacity) {
    return <p className="hub-post-passed">This event is full.</p>;
  }
  return (
    <form action={rsvpToEvent}>
      <input type="hidden" name="post" value={post.id} />
      <button type="submit" className="btn btn-primary hub-post-cta">
        RSVP
      </button>
    </form>
  );
}

async function officeHoursAction(post: ActionPost, accountId: string | null): Promise<ReactNode> {
  if (!accountId) {
    return (
      <>
        <Link href={signInHref(bookSlotPath(post.id))} prefetch={false} className="btn btn-primary hub-post-cta">
          Request a slot
        </Link>
        <p className="hub-post-note">Tell the mentor what you&apos;d like help with when you sign in.</p>
      </>
    );
  }
  const latest = await latestBooking(post.id, accountId);
  if (latest && latest.status !== "declined") {
    return (
      <>
        <p className="hub-rsvp-badge">
          {latest.status === "open" ? "Your request is waiting for a mentor." : "A mentor accepted your request."}
        </p>
        <Link href={bookSlotPath(post.id)} prefetch={false} className="link-button">
          See your request
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href={bookSlotPath(post.id)} prefetch={false} className="btn btn-primary hub-post-cta">
        Request a slot
      </Link>
      <p className="hub-post-note">Tell the mentor what you&apos;d like help with.</p>
    </>
  );
}

/**
 * RSVP for an event, or Request a slot for office hours (community spec 5.2; staff tools spec 2.5, plan decision 13).
 * Signed out, both go through the sign-in page, Request a slot coming back to its request page. Signed in, RSVP is a
 * button, then "You're going" with Cancel my RSVP, and a full event says so; office hours link to their request page,
 * or say where the student's request stands. Once the day has passed in SAST it says so instead. It reads the clock
 * and the session, so this small part renders per request; the rest of the post is prerendered.
 */
export async function PostAction({ post }: { post: ActionPost }) {
  // The clock is read only after connection() (decision 26).
  await connection();
  const passed = hasPassed(post, sastToday());
  const account = passed ? null : await getViewer().catch(() => null);
  const notice = account ? staffNoticeText(await takeNotice(HUB_NOTICE)) : null;

  let content: ReactNode;
  if (post.kind === "event") {
    content = passed ? <p className="hub-post-passed">This event has passed</p> : await eventAction(post, account?.id ?? null);
  } else if (passed) {
    content = <p className="hub-post-passed">These office hours have passed</p>;
  } else {
    content = await officeHoursAction(post, account?.id ?? null);
  }

  return (
    <div className="hub-post-action" data-kind={post.kind === "office-hours" ? "office-hours" : undefined}>
      {notice && (
        <p role="status" className="hub-post-note">
          {notice}
        </p>
      )}
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
