import { describe, expect, it } from "vitest";
import { coachWeekOf, lazyAllowed, previousWeek, weeksBack } from "./week";

describe("the coach's SAST weeks (spec 4: one row per shop per SAST week, starting Monday)", () => {
  it("is the Monday of the South African week", () => {
    // Sunday 2026-11-08 21:59 UTC is 23:59 SAST, still Sunday's week.
    expect(coachWeekOf(new Date("2026-11-08T21:59:00Z"))).toBe("2026-11-02");
    // Sunday 22:00 UTC is Monday 00:00 SAST: the new week.
    expect(coachWeekOf(new Date("2026-11-08T22:00:00Z"))).toBe("2026-11-09");
  });
  it("steps back by weeks", () => {
    expect(previousWeek("2026-11-09")).toBe("2026-11-02");
    expect(weeksBack("2026-11-09", 12)).toBe("2026-08-17");
  });
  it("makes a row at request time always in sample mode, and on Supabase from Monday 06:00 SAST (decision 11)", () => {
    const mondayFive = new Date("2026-11-09T03:59:00Z"); // 05:59 SAST
    const mondaySix = new Date("2026-11-09T04:00:00Z"); // 06:00 SAST
    expect(lazyAllowed(mondayFive, false)).toBe(true);
    expect(lazyAllowed(mondayFive, true)).toBe(false);
    expect(lazyAllowed(mondaySix, true)).toBe(true);
    expect(lazyAllowed(new Date("2026-11-11T01:00:00Z"), true)).toBe(true);
  });
});
