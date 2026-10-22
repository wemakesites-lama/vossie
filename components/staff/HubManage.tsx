import Link from "next/link";
import type { StaffPostSummary } from "@/lib/data/hub-posts";
import { hubKindLabel } from "@/lib/format";
import { hubCampusName } from "@/lib/hub";
import { answerSlot } from "@/lib/staff/hub-actions";
import { editPostPath, HUB_NEW_PATH } from "@/lib/staff/paths";
import { sastDateTime } from "@/lib/time";
import type { HubBooking } from "@/lib/types";
import { StaffTable } from "./StaffTable";

type HubManageProps = {
  /** The posts this account may edit: its own, or every post for an admin (plan decision 11). */
  posts: readonly StaffPostSummary[];
  everyPost: boolean;
  bookings: readonly HubBooking[];
  campusNames: ReadonlyMap<string, string>;
};

function AnswerButton({ booking, answer }: { booking: HubBooking; answer: "accepted" | "declined" }) {
  return (
    <form action={answerSlot}>
      <input type="hidden" name="booking" value={booking.id} />
      <input type="hidden" name="answer" value={answer} />
      <button
        type="submit"
        className={answer === "accepted" ? "staff-row-action" : "staff-row-action staff-row-action-danger"}
      >
        {answer === "accepted" ? "Accept" : "Decline"}{" "}
        <span className="sr-only">
          {booking.studentName}&apos;s request for {booking.postTitle}
        </span>
      </button>
    </form>
  );
}

/**
 * /hub/manage (spec 3): the posts this account may edit, drafts included, with Write a post; then the office-hours
 * queue that every mentor and admin shares (plan decision 14), open requests first, oldest first, each answered with
 * Accept or Decline. Neither removes anything, so neither has a confirm page.
 */
export function HubManage({ posts, everyPost, bookings, campusNames }: HubManageProps) {
  const caption = `${everyPost ? "Every post" : "Your posts"}, most recently changed first`;
  return (
    <>
      <section aria-labelledby="hub-posts-title" className="staff-section">
        <h2 id="hub-posts-title" className="staff-section-title">
          {everyPost ? "Every post" : "Your posts"}
        </h2>
        <p>
          <Link href={HUB_NEW_PATH} prefetch={false} className="btn btn-primary">
            Write a post
          </Link>
        </p>
        <StaffTable
          caption={caption}
          columns={["Title", "Kind", "Campus", "When", "Status", "Author", "Edit"]}
          rows={posts.map((post) => ({
            key: post.id,
            cells: [
              post.title,
              hubKindLabel(post.kind),
              hubCampusName(post.campusSlug, campusNames),
              post.startsAt ? (
                <time key="when" dateTime={post.startsAt}>
                  {sastDateTime(post.startsAt)}
                </time>
              ) : (
                "No date"
              ),
              post.published ? "Published" : "Draft",
              post.authorName,
              <Link key="edit" href={editPostPath(post.id)} prefetch={false} className="staff-row-action">
                Edit <span className="sr-only">{post.title}</span>
              </Link>,
            ],
          }))}
          empty="No posts yet."
        />
      </section>
      <section id="hub-queue" aria-labelledby="hub-queue-title" className="staff-section">
        <h2 id="hub-queue-title" className="staff-section-title">
          Office-hours requests
        </h2>
        <StaffTable
          caption="Slot requests, open first, oldest first"
          columns={["Office hours", "Student", "What they'd like help with", "A time that suits", "Answer"]}
          rows={bookings.map((booking) => ({
            key: booking.id,
            cells: [
              booking.startsAt ? `${booking.postTitle}, ${sastDateTime(booking.startsAt)}` : booking.postTitle,
              booking.studentName,
              <span key="help" className="staff-prewrap">
                {booking.help}
              </span>,
              booking.time || "Any time",
              booking.status === "open" ? (
                <div key="answer" className="staff-row-actions">
                  <AnswerButton booking={booking} answer="accepted" />
                  <AnswerButton booking={booking} answer="declined" />
                </div>
              ) : booking.status === "accepted" ? (
                "Accepted"
              ) : (
                "Declined"
              ),
            ],
          }))}
          empty="No slot requests yet."
        />
      </section>
    </>
  );
}
