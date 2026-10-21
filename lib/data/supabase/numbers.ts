import "server-only";
import { MEASURES, type Measure, type Period, type RawColumn, sastWeeks } from "@/lib/staff/numbers";
import type * as Sample from "../numbers";
import { forServer } from "./clients";

// The admin's numbers on Supabase (C4/C5 plan Task 21; decision 9; stage J spec decisions 10 to 13). The raw counts are
// public.admin_weekly_counts (20261020120800_numbers.sql), which only the service role may run: the admin client,
// request-time, called only from the numbers page after requireStaff('admin'), which passes what this returns straight
// to protectCounts (lib/staff/numbers.ts) before anything reaches the page (CLAUDE.md: private counts only through
// protectCounts). Nothing here names, links or ids anything counted, and saved searches are never counted. The weeks
// and their labels are sastWeeks(now), from the same `now` the function is given.
//
// The function's shape: (measure, period, campus_slug, count), one row per non-zero count. A Measure with period
// 'last', 'before' or 'since', or 'open-shops' with 'now'; campus_slug null for a campus that has gone. Folded here
// into RawCounts: { campuses: { [slug]: count }, gone: count with no campus }, a missing row being 0.

type Column = { campuses: Record<string, number>; gone: number };

const emptyColumn = (): Column => ({ campuses: {}, gone: 0 });

const MEASURE_KEYS: ReadonlySet<string> = new Set(MEASURES.map(({ measure }) => measure));
const PERIODS: ReadonlySet<string> = new Set(["last", "before", "since"]);

function add(column: Column, campus: string | null, count: number): void {
  if (campus === null) column.gone += count;
  else column.campuses[campus] = (column.campuses[campus] ?? 0) + count;
}

export const countByWeek: typeof Sample.countByWeek = async (now) => {
  const weeks = sastWeeks(now);
  const { data, error } = await forServer().rpc("admin_weekly_counts", { p_now: now.toISOString() });
  if (error) throw new Error(`admin_weekly_counts failed (${error.code ?? "unknown"})`);
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: emptyColumn(), before: emptyColumn(), since: emptyColumn() }]),
  ) as Record<Measure, Record<Period, Column>>;
  const openShops = emptyColumn();
  for (const row of data) {
    const count = Number(row.count);
    if (row.measure === "open-shops" && row.period === "now") add(openShops, row.campus_slug, count);
    else if (MEASURE_KEYS.has(row.measure) && PERIODS.has(row.period)) {
      add(counts[row.measure as Measure][row.period as Period], row.campus_slug, count);
    } else throw new Error("admin_weekly_counts answered a measure the app doesn't know");
  }
  return { weeks, raw: { counts: counts as Record<Measure, Record<Period, RawColumn>>, openShops } };
};
