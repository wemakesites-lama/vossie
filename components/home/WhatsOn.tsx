import Link from "next/link";
import { connection } from "next/server";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses, getHubEvents } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import { eventDate } from "@/lib/format";
import { sastToday } from "@/lib/time";
import { SectionError } from "./SectionError";

/** The next three upcoming Hub events for the visitor's campus, every-campus events included (spec 7.13). */
export async function WhatsOnEvents() {
  const { campus } = await getViewerContext();
  // The cookie read isn't enough for Next to allow a clock read (it still logs "unstable value new Date()" with
  // partial prefetching on). connection() defers the rest of this render to the request, as Next's docs ask.
  await connection();
  const today = sastToday();
  const data = await Promise.all([getHubEvents({ campus, limit: 3, from: today }), getCampuses()]).catch(() => null);
  if (!data) return <SectionError id="whats-on" title="What’s on" />;

  const [events, campuses] = data;
  if (events.length === 0) {
    return (
      <p className="whats-on-empty">
        No events this week. <Link href="/hub">See what the Hub is planning</Link>
      </p>
    );
  }
  const names = new Map(campuses.map((item) => [item.slug, item.name]));

  return (
    <ul className="events">
      {events.map((event) => {
        const { day, month } = eventDate(event.date);
        const action = event.action === "rsvp" ? "RSVP" : "Book";
        return (
          <li key={event.id} className="event">
            <time dateTime={event.date} className="event-date">
              <span className="event-day">{day}</span>{" "}
              <span className="event-month">{month}</span>
            </time>
            <span className="event-text">
              <span className="event-title">{event.title}</span>{" "}
              <span className="event-where">
                {event.campusSlug === ALL_CAMPUSES ? "All campuses" : names.get(event.campusSlug)}
              </span>
            </span>
            {/* Each event opens its own post, where RSVP and booking go through sign-in (community spec 5.3). No
                prefetch: three different pages (plan decision 12, decision 28). */}
            <Link href={`/hub/${event.id}`} prefetch={false} className="event-action">
              {/* The space sits outside the hidden span: name computation trims each element's own text. */}
              {action}{" "}
              <span className="sr-only">for {event.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The event rows' shape while they stream in (spec section 9). */
export function EventsSkeleton() {
  return (
    <ul className="events" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <li key={n} className="event">
          <span className="skeleton event-skeleton-date" />
          <span className="skeleton event-skeleton-text" />
        </li>
      ))}
    </ul>
  );
}
