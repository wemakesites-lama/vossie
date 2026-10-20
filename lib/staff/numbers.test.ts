import { describe, expect, it } from "vitest";
import {
  changeText,
  HIDDEN,
  MEASURES,
  NO_CHANGE,
  parseNumbersCampus,
  protectCounts,
  sastWeeks,
  sinceText,
  UNDER_FIVE,
  type Measure,
  type Period,
  type RawColumn,
  type RawCounts,
} from "./numbers";

const SLUGS = ["a", "b", "c"];

const column = (campuses: Record<string, number> = {}, gone = 0): RawColumn => ({ campuses, gone });

/** Raw counts that are 0 everywhere but the columns given. */
function raw(
  set: Partial<Record<Measure, Partial<Record<Period, RawColumn>>>> = {},
  openShops: RawColumn = column(),
): RawCounts {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [
      measure,
      { last: column(), before: column(), since: column(), ...set[measure] },
    ]),
  ) as Record<Measure, Record<Period, RawColumn>>;
  return { counts, openShops };
}

describe("fixed SAST weeks, Monday to Sunday (stage J spec decision 11)", () => {
  it("ends last week at Sunday 24:00 in South Africa: 21:59:59 UTC is still the week before's Sunday", () => {
    const weeks = sastWeeks(new Date("2026-10-18T21:59:59.000Z"));
    expect(weeks.last).toEqual({
      start: "2026-10-04T22:00:00.000Z",
      end: "2026-10-11T22:00:00.000Z",
      label: "5 to 11 Oct",
    });
    expect(weeks.before).toEqual({
      start: "2026-09-27T22:00:00.000Z",
      end: "2026-10-04T22:00:00.000Z",
      label: "28 Sep to 4 Oct",
    });
  });

  it("starts a new week at 22:00 UTC on Sunday, which is Monday 00:00 in South Africa", () => {
    const weeks = sastWeeks(new Date("2026-10-18T22:00:00.000Z"));
    expect(weeks.last).toEqual({
      start: "2026-10-11T22:00:00.000Z",
      end: "2026-10-18T22:00:00.000Z",
      label: "12 to 18 Oct",
    });
    expect(weeks.before.label).toBe("5 to 11 Oct");
  });

  it("gives the same weeks all through a week, Monday to Sunday", () => {
    const monday = sastWeeks(new Date("2026-10-19T08:00:00.000Z"));
    const sunday = sastWeeks(new Date("2026-10-25T12:00:00.000Z"));
    expect(monday).toEqual(sunday);
    expect(monday.last.label).toBe("12 to 18 Oct");
  });
});

describe("the measures (stage J spec decision 10)", () => {
  it("lists the seven, public ones first, and never saved searches", () => {
    expect(MEASURES.map(({ label, isPrivate }) => [label, isPrivate])).toEqual([
      ["Listings published", false],
      ["Shops approved", false],
      ["Looking For requests posted", false],
      ["Enquiries started", true],
      ["Reports made", true],
      ["Reports closed", true],
      ["Shops followed", true],
    ]);
    expect(JSON.stringify(MEASURES)).not.toMatch(/search/i);
  });
});

describe("the small-number rule (stage J spec decision 13, as amended on review)", () => {
  it("shows a private week by campus, exactly, when no campus is from 1 to 4", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 0, b: 12, c: 7 }) } }), SLUGS);
    expect(shown.counts.enquiries.last).toEqual({ campuses: { a: "0", b: "12", c: "7" }, total: "19" });
  });

  it("hides every campus in a private week, zeros too, when any campus is from 1 to 4, and keeps the total", () => {
    const shown = protectCounts(raw({ "reports-made": { last: column({ a: 3, b: 20, c: 0 }) } }), SLUGS);
    expect(shown.counts["reports-made"].last).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: "23" });
  });

  it("hides every campus when the small number is on a campus that has gone", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 7 }, 2) } }), SLUGS);
    expect(shown.counts.enquiries.last).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: "9" });
  });

  it("shows a private total from 1 to 4 as Under 5, and 0 as 0", () => {
    const shown = protectCounts(raw({ "reports-closed": { last: column({ a: 1, b: 1 }) } }), SLUGS);
    expect(shown.counts["reports-closed"].last).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: UNDER_FIVE });
    expect(shown.counts["reports-closed"].before).toEqual({ campuses: { a: "0", b: "0", c: "0" }, total: "0" });
  });

  it("shows Change only where both weeks show a figure, signed", () => {
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 12, c: 9 }), before: column({ a: 3, c: 11 }) } }), SLUGS);
    expect(shown.counts.enquiries.change).toEqual({ campuses: { a: NO_CHANGE, b: NO_CHANGE, c: NO_CHANGE }, total: "+7" });
    const both = protectCounts(raw({ enquiries: { last: column({ a: 12 }), before: column({ a: 5 }) } }), SLUGS);
    expect(both.counts.enquiries.change).toEqual({ campuses: { a: "+7", b: "0", c: "0" }, total: "+7" });
  });

  it("rounds a private Since the start down to tens, by campus only when both weeks are by campus and nothing is under 10", () => {
    const shown = protectCounts(raw({ follows: { since: column({ a: 0, b: 17, c: 23 }) } }), SLUGS);
    expect(shown.counts.follows.since).toEqual({ campuses: { a: "0", b: "10+", c: "20+" }, total: "40+" });
    const small = protectCounts(raw({ follows: { since: column({ a: 0, b: 7, c: 23 }) } }), SLUGS);
    expect(small.counts.follows.since).toEqual({ campuses: { a: HIDDEN, b: HIDDEN, c: HIDDEN }, total: "30+" });
    const weekHidden = protectCounts(raw({ follows: { last: column({ a: 2, b: 8 }), since: column({ a: 12, b: 18, c: 20 }) } }), SLUGS);
    expect(weekHidden.counts.follows.since.campuses).toEqual({ a: HIDDEN, b: HIDDEN, c: HIDDEN });
  });

  it("hides the Since the start total when either week's total is Under 5", () => {
    // 8 last week and "Under 10" since the start would leave the week before only 1.
    const shown = protectCounts(raw({ enquiries: { last: column({ a: 8 }), before: column({ a: 1 }), since: column({ a: 9 }) } }), SLUGS);
    expect(shown.counts.enquiries.before.total).toBe(UNDER_FIVE);
    expect(shown.counts.enquiries.since.total).toBe(HIDDEN);
  });

  it("shows public counts exactly, with their change, and open shops exactly", () => {
    const shown = protectCounts(
      raw({ listings: { last: column({ a: 1, b: 2 }), before: column({ a: 4 }), since: column({ a: 9, b: 2 }, 1) } }, column({ a: 2, c: 1 })),
      SLUGS,
    );
    expect(shown.counts.listings.last).toEqual({ campuses: { a: "1", b: "2", c: "0" }, total: "3" });
    expect(shown.counts.listings.change).toEqual({ campuses: { a: "−3", b: "+2", c: "0" }, total: "−1" });
    expect(shown.counts.listings.since).toEqual({ campuses: { a: "9", b: "2", c: "0" }, total: "12" });
    expect(shown.openShops).toEqual({ campuses: { a: "2", b: "0", c: "1" }, total: "3" });
  });
});

describe("no small figure can be worked out (a brute-force check of the week rule)", () => {
  it("leaves every campus in a hidden week at least two possible values, for three campuses at 0 to 20 and a gone campus at 0 to 2", () => {
    const groups = new Map<string, number[][]>();
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) for (let c = 0; c <= 20; c++) for (const gone of [0, 1, 2]) {
      const shown = protectCounts(raw({ enquiries: { last: column({ a, b, c }, gone) } }), SLUGS).counts.enquiries.last;
      // A reader is assumed to know what's counted on a campus that has gone.
      const key = `${JSON.stringify(shown)}|${gone}`;
      groups.set(key, [...(groups.get(key) ?? []), [a, b, c]]);
    }
    for (const [key, members] of groups) {
      if (!key.includes(HIDDEN)) continue;
      // Leave out the grid's edge, where a value can't be larger only because the loop stops at 20.
      if (members.some((member) => member.some((value) => value > 12))) continue;
      SLUGS.forEach((slug, index) => {
        expect(new Set(members.map((member) => member[index])).size, `${key} at ${slug}`).toBeGreaterThan(1);
      });
    }
  });
});

describe("the words for a figure", () => {
  it("signs a change with a plus or a minus sign, and 0 as 0", () => {
    expect(changeText(3)).toBe("+3");
    expect(changeText(-2)).toBe("−2");
    expect(changeText(0)).toBe("0");
  });

  it("rounds down to tens", () => {
    expect(sinceText(0)).toBe("0");
    expect(sinceText(1)).toBe("Under 10");
    expect(sinceText(9)).toBe("Under 10");
    expect(sinceText(10)).toBe("10+");
    expect(sinceText(19)).toBe("10+");
    expect(sinceText(120)).toBe("120+");
  });
});

describe("the campus view's link (stage J spec decision 12)", () => {
  it("reads a known campus from the link, and anything else as the main page", () => {
    expect(parseNumbersCampus({ campus: "b" }, SLUGS)).toBe("b");
    expect(parseNumbersCampus({ campus: ["c", "a"] }, SLUGS)).toBe("c");
    expect(parseNumbersCampus({ campus: "nowhere" }, SLUGS)).toBeNull();
    expect(parseNumbersCampus({}, SLUGS)).toBeNull();
  });
});
