import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { Card } from "@/components/kit/Card";
import { Feed } from "@/components/kit/Feed";
import { PendingButton } from "@/components/kit/PendingButton";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { MentorNoteView } from "@/lib/data/mentors";
import { badgeLabel } from "@/lib/format";
import { staffFieldIds } from "@/lib/staff/errors";
import { FLAG_WORDS, MENTOR_WINDOW_DAYS, repliesInTime, shopStanding } from "@/lib/staff/mentor";
import { addCheckIn, addMentorNote } from "@/lib/staff/mentor-actions";
import { longSastDate, shortSastDate } from "@/lib/time";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";

type FormView = { values: Readonly<Record<string, string>>; errors: readonly FormError[] };

type MentorShopProps = {
  shop: MentoredShop;
  campusName: string;
  notes: readonly MentorNoteView[];
  noteForm: FormView;
  checkInForm: FormView;
  /** The one-time tokens that make a note, and a check-in, once however many times its form is sent (amendment 15.7). */
  noteOnce: string | null;
  checkInOnce: string | null;
  /** Today's SAST date, the check-in's default and latest. */
  today: string;
  /** The 14 days before the last 14 (N2's RecentCounts.previous), or null when they couldn't be read (N4 plan decision 10). */
  previous: Pick<EnquiryCounts, "enquiries" | "salesConfirmed"> | null;
  /** The request's time, for the history's Today, Yesterday and This week. */
  now: Date;
};

const BEFORE = `the ${MENTOR_WINDOW_DAYS} days before`;

/**
 * A shop's mentor page (staff tools spec 2.6; role views spec 7.3): its facts and numbers against the 14 days before,
 * what its flags mean, the forms to add a note or a check-in, then what's been written, grouped by day. Notes are
 * about the shop's owner, shared with every mentor and admin who can open this page, and never shown to the seller.
 * The words are samples for Lama to change.
 */
export function MentorShop({
  shop,
  campusName,
  notes,
  noteForm,
  checkInForm,
  noteOnce,
  checkInOnce,
  today,
  previous,
  now,
}: MentorShopProps) {
  const note = staffFieldIds(`note-${shop.slug}`);
  const checkIn = staffFieldIds(`check-in-${shop.slug}`);
  const noteError = errorFor(noteForm.errors, note.text);
  const dayError = errorFor(checkInForm.errors, checkIn.day);
  const checkInError = errorFor(checkInForm.errors, checkIn.text);
  return (
    <>
      <Card title="This shop" level={2}>
        <dl className="staff-facts">
          <div>
            <dt>Owner</dt>
            <dd>{shop.ownerName}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          <div>
            <dt>Mentor</dt>
            <dd>{shop.mentorName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{shopStanding(shop.status, shop.pausedBy)}</dd>
          </div>
          <div>
            <dt>Badge</dt>
            <dd>{shop.badge ? badgeLabel(shop.badge) : "None"}</dd>
          </div>
          <div>
            <dt>Last check-in</dt>
            <dd>{shop.lastCheckInOn ? longSastDate(`${shop.lastCheckInOn}T10:00:00Z`) : "None yet"}</dd>
          </div>
        </dl>
        <StatRow label={`Last ${MENTOR_WINDOW_DAYS} days`}>
          <StatTile
            label="Enquiries"
            value={shop.counts.enquiries}
            delta={{ previous: previous?.enquiries ?? null, period: BEFORE }}
          />
          <div className="stat-tile">
            <span className="stat-tile-label">Replied within 48 hours</span>{" "}
            <span className="stat-tile-value" data-masked="">
              {repliesInTime(shop.counts)}
            </span>
          </div>
          <StatTile
            label="Sales confirmed"
            value={shop.counts.salesConfirmed}
            delta={{ previous: previous?.salesConfirmed ?? null, period: BEFORE }}
          />
        </StatRow>
        {shop.flags.length === 0 ? (
          <p>No flags.</p>
        ) : (
          <dl className="staff-flags">
            {shop.flags.map((flag) => (
              <div key={flag}>
                <dt>{FLAG_WORDS[flag].label}</dt>
                <dd>{FLAG_WORDS[flag].explanation}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="staff-muted">
          Worked out from the shop&apos;s conversations: mentors see its numbers, never their messages.{" "}
          {/* A shop the Hub has paused has no storefront for anyone, as on the admin pages (amendment 15.5). */}
          {shop.status === "paused" && shop.pausedBy === "staff" ? (
            <>The Hub has paused {shop.name}, so buyers can&apos;t see it.</>
          ) : (
            <Link href={`/sellers/${shop.slug}`} prefetch={false}>
              See {shop.name}&apos;s storefront
            </Link>
          )}
        </p>
      </Card>

      <section id={`mentor-${shop.slug}-add-note`} aria-labelledby={`mentor-${shop.slug}-add-note-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-add-note-title`} className="staff-section-title">
          Add a note
        </h2>
        <ErrorSummary id={`note-${shop.slug}-summary`} errors={noteForm.errors} />
        <form action={addMentorNote} noValidate className="form-stack staff-inline-form">
          <input type="hidden" name="shop" value={shop.slug} />
          {noteOnce && <input type="hidden" name="once" value={noteOnce} />}
          <div className="form-field">
            <label htmlFor={note.text} className="form-label">
              Note
            </label>
            <p id={`${note.text}-hint`} className="form-hint">
              Only mentors and admins see it, never the seller. Up to 1,000 characters.
            </p>
            <FieldError id={`${note.text}-error`} message={noteError} />
            <textarea
              id={note.text}
              name="text"
              rows={4}
              required
              defaultValue={noteForm.values.text ?? ""}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={describedBy(`${note.text}-hint`, noteError && `${note.text}-error`)}
              className="form-input staff-textarea"
            />
          </div>
          <PendingButton className="btn btn-primary form-submit" pendingLabel="Saving the note…">
            Add a note <span className="sr-only">about {shop.name}</span>
          </PendingButton>
        </form>
      </section>

      <section
        id={`mentor-${shop.slug}-add-check-in`}
        aria-labelledby={`mentor-${shop.slug}-add-check-in-title`}
        className="staff-section"
      >
        <h2 id={`mentor-${shop.slug}-add-check-in-title`} className="staff-section-title">
          Add a check-in
        </h2>
        <ErrorSummary id={`check-in-${shop.slug}-summary`} errors={checkInForm.errors} />
        <form action={addCheckIn} noValidate className="form-stack staff-inline-form">
          <input type="hidden" name="shop" value={shop.slug} />
          {checkInOnce && <input type="hidden" name="once" value={checkInOnce} />}
          <div className="form-field">
            <label htmlFor={checkIn.day} className="form-label">
              Date of the check-in
            </label>
            <FieldError id={`${checkIn.day}-error`} message={dayError} />
            <input
              id={checkIn.day}
              name="day"
              type="date"
              required
              max={today}
              defaultValue={checkInForm.values.day ?? today}
              aria-invalid={dayError ? true : undefined}
              aria-describedby={describedBy(dayError && `${checkIn.day}-error`)}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label htmlFor={checkIn.text} className="form-label">
              What you talked about
            </label>
            <p id={`${checkIn.text}-hint`} className="form-hint">
              Only mentors and admins see it, never the seller. Up to 1,000 characters.
            </p>
            <FieldError id={`${checkIn.text}-error`} message={checkInError} />
            <textarea
              id={checkIn.text}
              name="text"
              rows={4}
              required
              defaultValue={checkInForm.values.text ?? ""}
              aria-invalid={checkInError ? true : undefined}
              aria-describedby={describedBy(`${checkIn.text}-hint`, checkInError && `${checkIn.text}-error`)}
              className="form-input staff-textarea"
            />
          </div>
          <PendingButton className="btn btn-outline text-navy form-submit" pendingLabel="Saving the check-in…">
            Add a check-in <span className="sr-only">for {shop.name}</span>
          </PendingButton>
        </form>
      </section>

      <section id={`mentor-${shop.slug}-notes`} aria-labelledby={`mentor-${shop.slug}-notes-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-notes-title`} className="staff-section-title">
          Notes and check-ins
        </h2>
        {notes.length === 0 ? (
          <p className="staff-empty">Nothing written yet.</p>
        ) : (
          <Feed
            label="Notes and check-ins by day"
            now={now}
            items={notes.map((item) => ({
              id: item.id,
              at: item.createdAt,
              content: (
                <div className="staff-note">
                  <p className="staff-note-kind">
                    {item.kind === "check-in" && item.checkInOn
                      ? `Check-in on ${longSastDate(`${item.checkInOn}T10:00:00Z`)}`
                      : "Note"}
                  </p>
                  <p className="staff-prewrap">{item.text}</p>
                  <p className="staff-muted">
                    {item.authorName}, <time dateTime={item.createdAt}>{shortSastDate(item.createdAt)}</time>
                  </p>
                </div>
              ),
            }))}
          />
        )}
      </section>
    </>
  );
}
