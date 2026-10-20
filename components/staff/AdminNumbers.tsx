import Link from "next/link";
import {
  HIDDEN,
  MEASURES,
  NO_CHANGE,
  NOT_BY_WEEK,
  UNDER_FIVE,
  type SastWeeks,
  type ShownColumn,
  type ShownCounts,
} from "@/lib/staff/numbers";
import { ADMIN_NUMBERS_PATH, numbersPath } from "@/lib/staff/paths";
import { StaffTable } from "./StaffTable";

type Place = { slug: string; name: string };

type AdminNumbersProps = {
  weeks: SastWeeks;
  /** Every figure, after the small-number rule (lib/staff/numbers.ts). */
  shown: ShownCounts;
  /** Every campus, Eduvos Online included, in the page's order. */
  campuses: readonly Place[];
  /** The campus view's campus, or null for the main page. */
  campus: Place | null;
  /** The preview's line (plan decision 25). */
  sampleMode: boolean;
};

/** A By campus link: 44px tall, sky-dark and underlined (utilities, stage J plan decision 3). */
const CAMPUS_LINK = "inline-flex min-h-11 items-center font-semibold text-sky-dark underline underline-offset-3";

/** One place's rows, measure by measure, then Open shops now: the All campuses table's, or one campus's. */
function placeRows(shown: ShownCounts, pick: (column: ShownColumn) => string) {
  return [
    ...MEASURES.map(({ measure, label }) => {
      const columns = shown.counts[measure];
      return {
        key: measure,
        cells: [label, pick(columns.last), pick(columns.before), pick(columns.change), pick(columns.since)],
      };
    }),
    { key: "open-shops", cells: ["Open shops now", NOT_BY_WEEK, NOT_BY_WEEK, NOT_BY_WEEK, pick(shown.openShops)] },
  ];
}

/** What each word means (spec decision 13 and section 7), under each table. Samples for Lama to change. */
function NumbersKey() {
  return (
    <ul className="staff-confirm-list staff-muted">
      <li>{`${UNDER_FIVE}: a private total from 1 to 4.`}</li>
      <li>
        {`${HIDDEN}: not shown by campus, because a campus had from 1 to 4 that week (or 1 to 9 since the start), so no one can be picked out.`}
      </li>
      <li>{`${NO_CHANGE}: no change is worked out, because one of the two weeks isn't shown.`}</li>
      <li>Under 10, 10+, 20+: private counts since the start, rounded down to tens, so two weeks&apos; pages can&apos;t be subtracted.</li>
      <li>{`${NOT_BY_WEEK}: open shops are counted as the page opens.`}</li>
      <li>
        Private counts are enquiries, reports and follows. Admins can still open each report in the Reports queue: these
        rules protect this page and what&apos;s copied from it.
      </li>
    </ul>
  );
}

/**
 * The admin's numbers (spec decisions 9 to 13): plain tables with captions and row headers, no charts and no client
 * code. Nothing counted is named, linked or identified; the only links are each campus's view.
 */
export function AdminNumbers({ weeks, shown, campuses, campus, sampleMode }: AdminNumbersProps) {
  const columns = [
    "Measure",
    `Last week (${weeks.last.label})`,
    `The week before (${weeks.before.label})`,
    "Change",
    "Since the start",
  ];
  return (
    <>
      <section aria-labelledby="admin-numbers-about-title" className="staff-section">
        <h2 id="admin-numbers-about-title" className="sr-only">
          How these are counted
        </h2>
        <p>
          Counted from Vossie&apos;s store as this page opens. Weeks run Monday to Sunday, South African time. Things
          deleted since aren&apos;t counted. Small numbers of private things show as &quot;Under 5&quot; so no one can be
          picked out.
        </p>
        <p className="staff-muted">
          Something whose campus has gone, such as an enquiry to a shop that has closed, counts only in the All campuses
          figures.
        </p>
        {sampleMode && <p className="staff-muted">In this preview the store starts again whenever the server restarts.</p>}
      </section>
      {campus ? (
        <section aria-labelledby="admin-numbers-campus-title" className="staff-section">
          <h2 id="admin-numbers-campus-title" className="staff-section-title">
            {campus.name}
          </h2>
          <p>
            <Link href={ADMIN_NUMBERS_PATH} prefetch={false}>
              All campuses
            </Link>
          </p>
          <StaffTable
            caption={`${campus.name}, by week`}
            columns={columns}
            rows={placeRows(shown, (column) => column.campuses[campus.slug] ?? "0")}
            empty=""
            rowHeader
          />
          <NumbersKey />
        </section>
      ) : (
        <>
          <section aria-labelledby="admin-numbers-all-title" className="staff-section">
            <h2 id="admin-numbers-all-title" className="staff-section-title">
              All campuses
            </h2>
            <StaffTable
              caption="All campuses, by week"
              columns={columns}
              rows={placeRows(shown, (column) => column.total)}
              empty=""
              rowHeader
            />
            <NumbersKey />
          </section>
          <section aria-labelledby="admin-numbers-by-campus-title" className="staff-section">
            <h2 id="admin-numbers-by-campus-title" className="staff-section-title">
              By campus, last week
            </h2>
            <StaffTable
              caption={`By campus, last week (${weeks.last.label})`}
              columns={["Campus", ...MEASURES.map((measure) => measure.label), "Open shops now"]}
              rows={[
                ...campuses.map((place) => ({
                  key: place.slug,
                  cells: [
                    <Link key="campus" href={numbersPath(place.slug)} prefetch={false} className={CAMPUS_LINK}>
                      {place.name}
                    </Link>,
                    ...MEASURES.map(({ measure }) => shown.counts[measure].last.campuses[place.slug] ?? "0"),
                    shown.openShops.campuses[place.slug] ?? "0",
                  ],
                })),
                {
                  key: "all",
                  cells: [
                    "All campuses",
                    ...MEASURES.map(({ measure }) => shown.counts[measure].last.total),
                    shown.openShops.total,
                  ],
                },
              ]}
              empty=""
              rowHeader
            />
            <NumbersKey />
          </section>
        </>
      )}
    </>
  );
}
