import type { BarRow } from "@/components/charts/BarList";
import { isTooSmallToChart } from "@/lib/charts/scale";
import { joinWords } from "@/lib/format";
import { MEASURES, UNDER_FIVE, type Measure, type ShownCounts } from "./numbers";

// The admin's numbers as the kit draws them (role views spec 7.2 and the N3 numbers fix). Everything here starts from
// protectCounts' words (ShownCounts), never from raw counts, so a masked figure stays masked: "Hidden" or "Under 5",
// never 0. Nothing counted is named, linked or identified: rows are campuses (CLAUDE.md, the admin's numbers).

export type ShownValue = number | "hidden" | "under5";

/** A shown figure as the kit takes it. "Hidden", and anything that isn't a plain figure or "Under 5", is hidden. */
export function shownCount(text: string | undefined): ShownValue {
  if (text !== undefined && /^\d+$/.test(text)) return Number(text);
  return text === UNDER_FIVE ? "under5" : "hidden";
}

/** Today's three (spec 7.2). */
export const TODAY_MEASURES: readonly Measure[] = ["listings", "shops", "reports-made"];

export type LastWeekTile = { key: Measure; label: string; value: ShownValue; previous: ShownValue };

/** Each measure's all-campus total last week, and the week before's for the change (plan decision 4). */
export function lastWeekTiles(shown: ShownCounts, measures: readonly Measure[] = TODAY_MEASURES): LastWeekTile[] {
  return measures.map((measure) => ({
    key: measure,
    label: MEASURES.find((entry) => entry.measure === measure)?.label ?? measure,
    value: shownCount(shown.counts[measure].last.total),
    previous: shownCount(shown.counts[measure].before.total),
  }));
}

export type CampusBars = {
  rows: BarRow[];
  /** The takeaway, one sentence; when `tooSmall`, the numbers themselves in words. */
  summary: string;
  /** No chart: fewer than 2 values, a largest of 3 or under, nothing at all, or every campus masked (spec 5.3). */
  tooSmall: boolean;
};

const words = (value: ShownValue) => (value === "hidden" ? "Hidden" : value === "under5" ? "Under 5" : String(value));
const rank = (value: ShownValue) => (typeof value === "number" ? value : -1);

/** One measure, last week, by campus (plan decision 5): campuses with something, largest first; masked ones hatched. */
export function campusBars(shown: ShownCounts, measure: Measure, campuses: readonly { slug: string; name: string }[]): CampusBars {
  const column = shown.counts[measure].last;
  const all = campuses.map((place) => ({ label: place.name, value: shownCount(column.campuses[place.slug]) }));
  if (all.length > 0 && all.every((row) => typeof row.value !== "number")) {
    return {
      rows: [],
      tooSmall: true,
      summary: "Hidden by campus: a campus had from 1 to 4 last week, so no one can be picked out.",
    };
  }
  // A stable sort: ties keep the campuses' order.
  const rows: BarRow[] = all
    .filter((row) => typeof row.value !== "number" || row.value > 0)
    .sort((a, b) => rank(b.value) - rank(a.value));
  if (rows.length === 0) return { rows: [], tooSmall: true, summary: "None at any campus last week." };
  const none = all.length - rows.length;
  const noneLine = none === 0 ? "" : ` ${none} ${none === 1 ? "campus" : "campuses"} had none.`;
  const values = rows.map((row) => (typeof row.value === "number" ? row.value : null));
  if (isTooSmallToChart(values)) {
    return { rows, tooSmall: true, summary: `${rows.map((row) => `${row.label} ${words(row.value)}`).join(", ")}.${noneLine}` };
  }
  const max = Math.max(...values.filter((value): value is number => value !== null));
  const top = rows.filter((row) => row.value === max).map((row) => row.label);
  return { rows, tooSmall: false, summary: `Most at ${joinWords(top)}: ${max}.${noneLine}` };
}
