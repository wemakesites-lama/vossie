import { afterEach, beforeEach, expect, it } from "vitest";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { countByWeek } from "@/lib/data/numbers";
import { MEASURES, protectCounts, type RawCounts, sastWeeks } from "@/lib/staff/numbers";
import type { World } from "@/tests/contract/world";

// The admin's numbers in both backends (C4/C5 plan Task 21; decision 9; stage J spec decisions 10 to 13): the same
// things move the same cells. On Supabase the counts are admin_weekly_counts', through the admin client; on the sample
// store countByWeek's loop. Something from this week is never counted. numbers.test.ts runs it on the sample store,
// numbers.db.test.ts on the local stack (with the seed's parity).

const SHOP = "tech-corner";

/** Every cell that changed between two counts: "measure period campus" (or "gone") and by how much. */
export function movedCells(before: RawCounts, after: RawCounts): Record<string, number> {
  const moved: Record<string, number> = {};
  const compare = (key: string, a: { campuses: Readonly<Record<string, number>>; gone: number }, b: typeof a) => {
    for (const campus of new Set([...Object.keys(a.campuses), ...Object.keys(b.campuses)])) {
      const delta = (b.campuses[campus] ?? 0) - (a.campuses[campus] ?? 0);
      if (delta !== 0) moved[`${key} ${campus}`] = delta;
    }
    if (b.gone !== a.gone) moved[`${key} gone`] = b.gone - a.gone;
  };
  for (const { measure } of MEASURES) {
    for (const period of ["last", "before", "since"] as const) {
      compare(`${measure} ${period}`, before.counts[measure][period], after.counts[measure][period]);
    }
  }
  compare("open-shops now", before.openShops, after.openShops);
  return moved;
}

export function numbersContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("counts last week's request, follow and closed report on their campus, and nothing from this week", async () => {
    const now = new Date();
    const weeks = sastWeeks(now);
    const before = await world.asViewer("staff", () => countByWeek(now));
    expect(before.weeks).toEqual(weeks);
    const at = new Date(Date.parse(weeks.last.start) + 24 * 60 * 60 * 1000);
    await world.addPastActivity(SHOP, at, new Date(at.getTime() + 60 * 60 * 1000));
    // This week's: never counted.
    await world.addRequest({ asker: "asker", title: "A contract request from this week", neededBy: null });
    const after = await world.asViewer("staff", () => countByWeek(now));
    const shopCampus = sampleSellerRows.find((row) => row.slug === SHOP)!.campusSlug;
    const expected: Record<string, number> = {
      "requests last pretoria": 1,
      "requests since pretoria": 1,
      "reports-made last pretoria": 1,
      "reports-made since pretoria": 1,
      "reports-closed last pretoria": 1,
      "reports-closed since pretoria": 1,
    };
    expected[`follows last ${shopCampus}`] = 1;
    expected[`follows since ${shopCampus}`] = 1;
    expect(movedCells(before.raw, after.raw)).toEqual(expected);
  });

  it("gives protectCounts nothing that names or links anything: only counts by campus", async () => {
    const now = new Date();
    const { raw } = await world.asViewer("staff", () => countByWeek(now));
    expect(Object.keys(raw)).toEqual(["counts", "openShops"]);
    expect(Object.keys(raw.counts).sort()).toEqual(MEASURES.map(({ measure }) => measure).sort());
    for (const { measure } of MEASURES) {
      for (const column of Object.values(raw.counts[measure])) {
        expect(Object.keys(column).sort()).toEqual(["campuses", "gone"]);
        for (const value of [...Object.values(column.campuses), column.gone]) expect(Number.isInteger(value)).toBe(true);
      }
    }
    expect(protectCounts(raw, Object.keys(raw.openShops.campuses))).toBeTruthy();
  });
}
