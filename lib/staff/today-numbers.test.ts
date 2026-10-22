import { describe, expect, it } from "vitest";
import { MEASURES, protectCounts, type Measure, type Period, type RawColumn, type RawCounts } from "./numbers";
import { campusBars, lastWeekTiles, shownCount } from "./today-numbers";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
  { slug: "durban-umhlanga", name: "Durban Umhlanga" },
];
const column = (campuses: Record<string, number> = {}, gone = 0): RawColumn => ({ campuses, gone });

function shown(overrides: Partial<Record<Measure, Partial<Record<Period, RawColumn>>>> = {}) {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: column(), before: column(), since: column(), ...overrides[measure] }]),
  ) as Record<Measure, Record<Period, RawColumn>>;
  const raw: RawCounts = { counts, openShops: column() };
  return protectCounts(raw, CAMPUSES.map((campus) => campus.slug));
}

describe("shownCount (role views N3 plan decision 4)", () => {
  it("keeps figures and turns the masks into the kit's words, never 0", () => {
    expect(shownCount("12")).toBe(12);
    expect(shownCount("0")).toBe(0);
    expect(shownCount("Under 5")).toBe("under5");
    expect(shownCount("Hidden")).toBe("hidden");
    // Anything else (a change's "—", Since the start's tens, a missing campus) is hidden, never a number.
    expect(shownCount("—")).toBe("hidden");
    expect(shownCount("Under 10")).toBe("hidden");
    expect(shownCount(undefined)).toBe("hidden");
  });
});

describe("lastWeekTiles (spec 7.2)", () => {
  it("gives listings published, shops approved and reports made, last week against the week before", () => {
    const tiles = lastWeekTiles(
      shown({
        listings: { last: column({ midrand: 6, pretoria: 2 }), before: column({ midrand: 4 }) },
        "reports-made": { last: column({ midrand: 2 }), before: column() },
      }),
    );
    expect(tiles).toEqual([
      { key: "listings", label: "Listings published", value: 8, previous: 4 },
      { key: "shops", label: "Shops approved", value: 0, previous: 0 },
      // Private and from 1 to 4: "Under 5", so the change can't be worked out.
      { key: "reports-made", label: "Reports made", value: "under5", previous: 0 },
    ]);
  });
});

describe("campusBars (spec 7.2; N3 plan decision 5)", () => {
  it("draws campuses with something, largest first, and counts the ones with none", () => {
    const bars = campusBars(shown({ listings: { last: column({ pretoria: 4, midrand: 9 }) } }), "listings", CAMPUSES);
    expect(bars).toEqual({
      rows: [
        { label: "Midrand", value: 9 },
        { label: "Pretoria", value: 4 },
      ],
      summary: "Most at Midrand: 9. 1 campus had none.",
      tooSmall: false,
    });
  });

  it("names every campus tied for most", () => {
    const bars = campusBars(shown({ listings: { last: column({ pretoria: 5, midrand: 5 }) } }), "listings", CAMPUSES);
    expect(bars.summary).toBe("Most at Midrand and Pretoria: 5. 1 campus had none.");
  });

  it("writes small numbers as words instead of a chart", () => {
    const bars = campusBars(shown({ listings: { last: column({ midrand: 2, pretoria: 1 }) } }), "listings", CAMPUSES);
    expect(bars).toMatchObject({ tooSmall: true, summary: "Midrand 2, Pretoria 1. 1 campus had none." });
  });

  it("says when there was nothing", () => {
    expect(campusBars(shown(), "shops", CAMPUSES)).toEqual({ rows: [], tooSmall: true, summary: "None at any campus last week." });
  });

  it("draws nothing when every campus is masked, and never a 0 for a masked campus", () => {
    const bars = campusBars(shown({ enquiries: { last: column({ midrand: 3, pretoria: 12 }) } }), "enquiries", CAMPUSES);
    expect(bars.rows).toEqual([]);
    expect(bars.tooSmall).toBe(true);
    expect(bars.summary).toBe("Hidden by campus: a campus had from 1 to 4 last week, so no one can be picked out.");
  });
});
