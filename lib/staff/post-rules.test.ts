import { describe, expect, it } from "vitest";
import { checkPost, sastToUtc, utcToSastFields, type PostInput } from "./post-rules";

const CAMPUSES = ["midrand", "pretoria"];

const input = (overrides: Partial<PostInput> = {}): PostInput => ({
  kind: "event",
  title: "  Market day on the lawn ",
  campus: "pretoria",
  date: "2026-11-20",
  time: "18:00",
  place: "The lawn outside the library",
  capacity: "40",
  summary: "Bring what you sell and a table.",
  body: "## Bring\r\n- A table\n- A float",
  published: true,
  ...overrides,
});

describe("the Hub's post editor (staff tools spec 2.4)", () => {
  it("turns an event's SAST date and time into UTC, with its place and capacity", () => {
    expect(checkPost(input(), CAMPUSES)).toEqual({
      value: {
        kind: "event",
        title: "Market day on the lawn",
        campusSlug: "pretoria",
        startsAt: "2026-11-20T16:00:00.000Z",
        place: "The lawn outside the library",
        capacity: 40,
        summary: "Bring what you sell and a table.",
        body: "## Bring\n- A table\n- A float",
        published: true,
      },
      errors: [],
    });
  });

  it("keeps office hours without a capacity, and a tip for every campus with no date, place or capacity", () => {
    expect(checkPost(input({ kind: "office-hours", capacity: "" }), CAMPUSES).value).toMatchObject({
      kind: "office-hours",
      capacity: null,
      place: "The lawn outside the library",
    });
    expect(checkPost(input({ kind: "tip", campus: "", date: "", time: "", place: "", published: false }), CAMPUSES).value).toMatchObject({
      kind: "tip",
      campusSlug: "all",
      startsAt: null,
      place: null,
      capacity: null,
      published: false,
    });
  });

  it("takes All campuses for an event", () => {
    expect(checkPost(input({ campus: "all" }), CAMPUSES).value?.campusSlug).toBe("all");
  });

  it("lists every problem in the form's order, and keeps nothing", () => {
    const result = checkPost(
      input({ title: "", campus: "atlantis", date: "2026-02-30", time: "25:00", place: " ", capacity: "0", summary: "", body: "" }),
      CAMPUSES,
    );
    expect(result).toEqual({
      value: null,
      errors: [
        "post-title-missing",
        "post-campus-missing",
        "post-date-missing",
        "post-time-missing",
        "post-place-missing",
        "post-capacity-invalid",
        "post-summary-missing",
        "post-body-missing",
      ],
    });
  });

  it("limits the title to 70, the place to 80, the summary to 160 and the body to 4,000 characters", () => {
    const long = checkPost(
      input({ title: "t".repeat(71), place: "p".repeat(81), summary: "s".repeat(161), body: "b".repeat(4001) }),
      CAMPUSES,
    );
    expect(long.errors).toEqual(["post-title-length", "post-place-length", "post-summary-length", "post-body-length"]);
    const fits = checkPost(
      input({ title: "t".repeat(70), place: "p".repeat(80), summary: "s".repeat(160), body: "b".repeat(4000) }),
      CAMPUSES,
    );
    expect(fits.errors).toEqual([]);
    expect(checkPost(input({ capacity: "1001" }), CAMPUSES).errors).toEqual(["post-capacity-invalid"]);
  });

  it("asks for one of the three kinds", () => {
    expect(checkPost(input({ kind: "poll" }), CAMPUSES).errors).toEqual(["post-kind-missing"]);
  });

  it("reads SAST as UTC+2 both ways, across midnight", () => {
    expect(sastToUtc("2026-10-15", "01:00")).toBe("2026-10-14T23:00:00.000Z");
    expect(sastToUtc("2026-10-15", "1pm")).toBeNull();
    expect(utcToSastFields("2026-10-14T22:30:00.000Z")).toEqual({ date: "2026-10-15", time: "00:30" });
  });

  it("reads SAST across New Year's Eve, into the year before in UTC (amendment 12.3)", () => {
    expect(sastToUtc("2027-01-01", "00:30")).toBe("2026-12-31T22:30:00.000Z");
    expect(utcToSastFields("2026-12-31T22:30:00.000Z")).toEqual({ date: "2027-01-01", time: "00:30" });
  });
});
