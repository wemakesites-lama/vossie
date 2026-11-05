import { describe, expect, it } from "vitest";
import { asCoachActions, planWeek } from "./plan";
import type { Candidate } from "./types";

const c = (id: string): Candidate => ({ id, kind: id.split(":")[0] as Candidate["kind"], target: { type: "listing", id: id.split(":")[1] }, name: "Lamp", evidence: { photos: 1, chars: 10, available: 1, more: 2 }, href: "/x" });
const AS_OF = "2026-11-10T08:00:00.000Z";

describe("planWeek, the fixed week (spec 4; planning decision 2)", () => {
  it("takes the first candidate of each kind, in the catalogue's order, three at most", () => {
    const week = planWeek([c("add-photos:l-1"), c("add-photos:l-2"), c("say-more:l-1"), c("list-more:shop"), c("read-tip:t-1")], AS_OF);
    expect(week.map((a) => a.id)).toEqual(["add-photos:l-1", "say-more:l-1", "list-more:shop"]);
    expect(week.every((a) => a.asOf === AS_OF && a.title.length > 0 && a.why.length > 0)).toBe(true);
  });
  it("is empty with no candidates", () => {
    expect(planWeek([], AS_OF)).toEqual([]);
  });
  it("reads stored actions back, refusing anything malformed", () => {
    const week = planWeek([c("say-more:l-1")], AS_OF);
    expect(asCoachActions(JSON.parse(JSON.stringify(week)))).toEqual(week);
    expect(asCoachActions([{ ...week[0], kind: "write-poem" }])).toBeNull();
    expect(asCoachActions([...week, ...week, ...week, ...week])).toBeNull();
    expect(asCoachActions({})).toBeNull();
  });
});
