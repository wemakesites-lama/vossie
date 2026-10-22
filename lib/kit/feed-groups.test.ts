import { describe, expect, it } from "vitest";
import { groupBySastDay } from "./feed-groups";

// 2026-10-22 10:00 SAST.
const now = new Date("2026-10-22T08:00:00Z");

describe("groupBySastDay", () => {
  it("groups by SAST day into Today, Yesterday and This week, then Earlier, newest first", () => {
    const groups = groupBySastDay(
      [
        { id: "a", at: "2026-10-22T06:00:00Z" },
        { id: "b", at: "2026-10-21T21:59:00Z" }, // 23:59 SAST on the 21st
        { id: "c", at: "2026-10-21T22:01:00Z" }, // 00:01 SAST on the 22nd
        { id: "d", at: "2026-10-18T10:00:00Z" },
        { id: "e", at: "2026-10-01T10:00:00Z" },
      ],
      now,
    );
    expect(groups.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ["Today", ["a", "c"]],
      ["Yesterday", ["b"]],
      ["This week", ["d"]],
      ["Earlier", ["e"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupBySastDay([{ id: "a", at: "2026-10-22T06:00:00Z" }], now).map((group) => group.label)).toEqual(["Today"]);
  });
});
