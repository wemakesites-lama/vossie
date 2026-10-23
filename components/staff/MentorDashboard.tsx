import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import { CheckIcon, StoreIcon } from "@/components/icons";
import { Card } from "@/components/kit/Card";
import { EmptyState } from "@/components/kit/EmptyState";
import { ListRow } from "@/components/kit/ListRow";
import { Pill } from "@/components/kit/Pill";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { dayMonth } from "@/lib/format";
import {
  caseloadDetail,
  caseloadSummary,
  checkInDue,
  checkInWords,
  needsYou,
  sharedMax,
  sparkSummary,
} from "@/lib/staff/mentor";
import { HUB_MANAGE_PATH, MENTOR_PATH, mentorShopPath } from "@/lib/staff/paths";
import type { MentoredShop } from "@/lib/types";

export type CaseloadView = "needs" | "all";

type MentorDashboardProps = {
  /** The whole caseload, most in need first (mentoredShops). */
  rows: readonly MentoredShop[];
  view: CaseloadView;
  /** An admin sees every assigned shop, with its mentor (plan decision 15). */
  showMentor: boolean;
  campusNames: ReadonlyMap<string, string>;
  /** Slot requests waiting (openBookingCount), or null when they couldn't be counted. */
  slotRequests: number | null;
  /** Enquiries a day by shop, oldest first (dailyEnquiriesFor), or null when the read failed. */
  daily: ReadonlyMap<string, readonly (number | null)[]> | null;
  /** The days `daily` covers, YYYY-MM-DD in SAST, for the numbers tables. */
  days: readonly string[];
  /** Today in SAST, for the check-in chips. */
  today: string;
};

const ALL_PATH = `${MENTOR_PATH}?view=all`;

/**
 * The mentor's caseload (role views spec 7.3): who needs you now, as rows that each open the shop's mentor page, and a
 * small chart per shop on one scale. Numbers, never messages; a check-in's age, never what was said. The words are
 * samples for Lama to change.
 */
export function MentorDashboard({
  rows,
  view,
  showMentor,
  campusNames,
  slotRequests,
  daily,
  days,
  today,
}: MentorDashboardProps) {
  const needing = rows.filter((row) => needsYou(row, today));
  const shown = view === "all" ? rows : needing;
  // One scale over the whole caseload, so switching views never rescales (N4 plan decision 8).
  const scale = daily ? sharedMax(daily.values()) : 0;
  const labels = days.map((day) => dayMonth(day));
  return (
    <div className="mentor-home">
      <Card title={showMentor ? "Every mentored shop" : "Your shops"} level={2}>
        <p className="mentor-summary">{caseloadSummary(needing.length, rows.length, slotRequests)}</p>
        {rows.length === 0 ? (
          <EmptyState
            icon={<StoreIcon />}
            title="No shops yet"
            line="An admin assigns shops to mentors on each shop's page. Meanwhile, students' slot requests wait in office hours."
            action={{ label: "Office hours", href: `${HUB_MANAGE_PATH}#hub-queue` }}
          />
        ) : (
          <>
            <LinkTabs
              label="Which shops"
              look="segmented"
              current={view}
              tabs={[
                { key: "needs", label: `Needs you (${needing.length})`, href: MENTOR_PATH },
                { key: "all", label: `All (${rows.length})`, href: ALL_PATH },
              ]}
            />
            {shown.length === 0 ? (
              <div>
                <p className="mentor-all-clear">
                  <CheckIcon /> All clear: no shop needs you today.
                </p>
                <Link href={ALL_PATH} prefetch={false} className="mentor-all-link">
                  See all {rows.length} {rows.length === 1 ? "shop" : "shops"}
                </Link>
              </div>
            ) : (
              <ul className="mentor-rows" aria-label={view === "all" ? "All shops" : "Shops that need you"}>
                {shown.map((row) => (
                  <ListRow
                    key={row.slug}
                    href={mentorShopPath(row.slug)}
                    lead={{ kind: "initials", text: row.name }}
                    title={row.name}
                    detail={caseloadDetail(row, showMentor)}
                    pill={
                      <Pill tone={checkInDue(row.lastCheckInOn, today) ? "warning" : "neutral"}>
                        <span className="sr-only">Check-in: </span>
                        {checkInWords(row.lastCheckInOn, today)}
                      </Pill>
                    }
                    meta={campusNames.get(row.campusSlug) ?? row.campusSlug}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
      {shown.length > 0 && (
        <Card title="Enquiries, 14 days" level={2}>
          {daily === null ? (
            <div className="section-error">
              <p>The enquiries chart didn&apos;t load.</p>
              <a href={view === "all" ? ALL_PATH : MENTOR_PATH} className="btn btn-outline text-navy">
                Try again
              </a>
            </div>
          ) : (
            <ul className="mentor-sparks">
              {shown.map((row) => {
                const points = daily.get(row.slug) ?? days.map(() => null);
                return (
                  <li key={row.slug}>
                    <h3 className="mentor-spark-name">{row.name}</h3>
                    <Sparkline
                      points={points}
                      labels={labels}
                      label={`Enquiries a day, ${row.name}`}
                      summary={sparkSummary(row.name, points)}
                      max={scale}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="staff-muted">
            One scale for every shop, so a taller line means more enquiries. Mentors see numbers, never messages.
          </p>
        </Card>
      )}
    </div>
  );
}
