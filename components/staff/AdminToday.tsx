import { BarList } from "@/components/charts/BarList";
import { SectionError } from "@/components/home/SectionError";
import { Card } from "@/components/kit/Card";
import { NeedsYouList, type NeedsYouItem } from "@/components/kit/NeedsYouList";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import { ADMIN_NUMBERS_PATH, ADMIN_PATH } from "@/lib/staff/paths";
import type { CampusBars, LastWeekTile } from "@/lib/staff/today-numbers";

type Week = { label: string; beforeLabel: string; tiles: readonly LastWeekTile[]; campuses: CampusBars };

type AdminTodayProps = {
  /** The queue's rows (lib/staff/queue.ts), or null when its lists didn't load. */
  waiting: readonly NeedsYouItem[] | null;
  /** Last week through protectCounts (lib/staff/today-numbers.ts), or null when the numbers didn't load. */
  week: Week | null;
  /** How many shops' badges the calculation just changed, or null when it failed. */
  badgesChanged: number | null;
};

function badgesLine(changed: number | null): string {
  if (changed === null) {
    return "The trust badges couldn't be worked out just now. They're worked out again next time this page opens.";
  }
  const result = changed === 0 ? "None changed." : `${changed} ${changed === 1 ? "shop's badge" : "shops' badges"} changed.`;
  return `Worked out just now from each shop's conversations, by the rules on the trust page. ${result} Buyers see a change within 15 minutes. Sample shops no account owns keep their sample badges.`;
}

/**
 * The admin's Today (role views spec 7.2): what waits on the Hub, oldest first, each row opening its oldest item; last
 * week's numbers against the week before, only through protectCounts; listings by campus; and the trust badges worked
 * out as the page rendered, below the fold (staff tools spec 2.7). Each card fails on its own (spec 8). Server-only,
 * and the words are samples for Lama to change.
 */
export function AdminToday({ waiting, week, badgesChanged }: AdminTodayProps) {
  return (
    <div className="today">
      <Card title="Waiting" level={2}>
        {waiting ? (
          <NeedsYouList label="Waiting" items={waiting} allClear="All clear: nothing is waiting for the Hub." />
        ) : (
          <div id="today-waiting">
            <SectionError id="today-waiting" title="What's waiting" path={ADMIN_PATH} />
          </div>
        )}
      </Card>
      <Card title="Last week" level={2} action={{ label: "All numbers", href: ADMIN_NUMBERS_PATH }}>
        {week ? (
          <>
            <p className="chart-summary">
              {week.label}, against the week before ({week.beforeLabel}).
            </p>
            <StatRow label="Last week's numbers">
              {week.tiles.map((tile) => (
                <StatTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  delta={{ previous: tile.previous, period: "the week before" }}
                />
              ))}
            </StatRow>
          </>
        ) : (
          <div id="today-week">
            <SectionError id="today-week" title="Last week's numbers" path={ADMIN_PATH} />
          </div>
        )}
      </Card>
      <Card title="Listings by campus" level={2}>
        {!week ? (
          <div id="today-campuses">
            <SectionError id="today-campuses" title="Listings by campus" path={ADMIN_PATH} />
          </div>
        ) : week.campuses.tooSmall ? (
          <p className="chart-summary">{week.campuses.summary}</p>
        ) : (
          <BarList rows={week.campuses.rows} label="Listings published last week" summary={week.campuses.summary} rowHeader="Campus" />
        )}
      </Card>
      <Card title="Trust badges" level={2}>
        <p>{badgesLine(badgesChanged)}</p>
      </Card>
    </div>
  );
}
