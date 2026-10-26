import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { readFormState } from "@/lib/auth/form-state";
import { errorFor, type FormError } from "@/lib/auth/messages";
import { requireAccount } from "@/lib/auth/session";
import { getHubPost } from "@/lib/data";
import { latestBooking } from "@/lib/data/hub-posts";
import { hasPassed } from "@/lib/hub";
import { sendSlotRequest } from "@/lib/hub-actions";
import { isId } from "@/lib/messaging/paths";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { HUB_NOTICE, slotForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { bookSlotPath } from "@/lib/staff/paths";
import { HELP_MAX, TIME_MAX } from "@/lib/staff/rules";
import { sastDateTime, sastToday } from "@/lib/time";
import type { HubBooking, HubPost } from "@/lib/types";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

type BookSlotViewProps = {
  post: Pick<HubPost, "id" | "title" | "startsAt" | "place">;
  passed: boolean;
  /** The student's newest request for these office hours, or null. */
  latest: HubBooking | null;
  values: Readonly<Record<string, string>>;
  errors: readonly FormError[];
  notice: string | null;
};

/**
 * Request a slot (spec 2.5, plan decision 13): what you'd like help with (up to 300 characters) and a time that suits
 * (up to 100, optional). With an open or accepted request, it says where it stands instead; after a decline, the form
 * comes back. The words are samples for Lama to change.
 */
export function BookSlotView({ post, passed, latest, values, errors, notice }: BookSlotViewProps) {
  const ids = staffFieldIds(`book-${post.id}`);
  const helpError = errorFor(errors, ids.help);
  const timeError = errorFor(errors, ids.time);
  const standing = latest && latest.status !== "declined" ? latest : null;
  const canAsk = !passed && !standing;
  return (
    <div className="hub-book-body">
      <Trail crumbs={trailFor("/hub/[id]/book", { params: { id: post.id }, names: { "/hub/[id]": post.title } })} />
      <h1 className="hub-book-title">Request a slot</h1>
      <p className="hub-book-post">
        {post.title}
        {post.startsAt && (
          <>
            {" · "}
            <time dateTime={post.startsAt}>{sastDateTime(post.startsAt)}</time>
          </>
        )}
        {post.place && ` · ${post.place}`}
      </p>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      {standing && (
        <section aria-labelledby={`book-${post.id}-request-title`} className="hub-book-request">
          <h2 id={`book-${post.id}-request-title`} className="hub-book-heading">
            Your request
          </h2>
          <p className="hub-book-status">
            {standing.status === "open"
              ? "Waiting for a mentor. You'll get a notification when one answers."
              : "A mentor accepted it. See you there."}
          </p>
          <dl className="hub-book-facts">
            <div>
              <dt>What you&apos;d like help with</dt>
              <dd className="staff-prewrap">{standing.help}</dd>
            </div>
            <div>
              <dt>A time that suits</dt>
              <dd>{standing.time || "Any time"}</dd>
            </div>
          </dl>
        </section>
      )}
      {latest?.status === "declined" && !passed && (
        <p>A mentor couldn&apos;t fit in your last request. You can ask again.</p>
      )}
      {passed && <p className="hub-post-passed">These office hours have passed</p>}
      {canAsk && (
        <>
          <ErrorSummary id={`book-${post.id}-summary`} errors={errors} />
          <form action={sendSlotRequest} noValidate className="form-stack">
            <input type="hidden" name="post" value={post.id} />
            <div className="form-field">
              <label htmlFor={ids.help} className="form-label">
                What you&apos;d like help with
              </label>
              <p id={`${ids.help}-hint`} className="form-hint">
                Up to {HELP_MAX} characters.
              </p>
              <FieldError id={`${ids.help}-error`} message={helpError} />
              <textarea
                id={ids.help}
                name="help"
                rows={4}
                required
                defaultValue={values.help ?? ""}
                aria-invalid={helpError ? true : undefined}
                aria-describedby={describedBy(`${ids.help}-hint`, helpError && `${ids.help}-error`)}
                className="form-input staff-textarea"
              />
            </div>
            <div className="form-field">
              <label htmlFor={ids.time} className="form-label">
                A time that suits (optional)
              </label>
              <p id={`${ids.time}-hint`} className="form-hint">
                Up to {TIME_MAX} characters, like After 13:30.
              </p>
              <FieldError id={`${ids.time}-error`} message={timeError} />
              <input
                id={ids.time}
                name="time"
                type="text"
                defaultValue={values.time ?? ""}
                aria-invalid={timeError ? true : undefined}
                aria-describedby={describedBy(`${ids.time}-hint`, timeError && `${ids.time}-error`)}
                className="form-input"
              />
            </div>
            <button type="submit" className="btn btn-primary form-submit">
              Send request
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/**
 * The request page for this visitor (spec 2.5). Request-time: it reads the session (signed out, sign in and come
 * back here), the clock and the form state. Anything but published office hours is the 404.
 */
export async function BookSlot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount(bookSlotPath(id));
  const post = isId(id) ? await getHubPost(id) : null;
  if (!post || post.kind !== "office-hours") notFound();
  // Whether they've passed reads the clock (decision 26).
  await connection();
  const [latest, state, notice] = await Promise.all([
    latestBooking(post.id, account.id),
    readFormState(slotForm(post.id)),
    takeNotice(HUB_NOTICE),
  ]);
  return (
    <BookSlotView
      post={post}
      passed={hasPassed(post, sastToday())}
      latest={latest}
      values={state?.values ?? {}}
      errors={staffErrors(state?.errors ?? [], staffFieldIds(`book-${post.id}`))}
      notice={staffNoticeText(notice)}
    />
  );
}

/** The request page's shape while it streams in. */
export function BookSlotSkeleton() {
  return (
    <div className="hub-book-body" aria-hidden="true">
      <span className="skeleton hub-book-skeleton-crumb" />
      <span className="skeleton hub-book-skeleton-title" />
      <span className="skeleton hub-book-skeleton-form" />
    </div>
  );
}
