import { describe, expect, it } from "vitest";
import { checkPost, postLocks, sastToUtc, utcToSastFields, type PostInput } from "./post-rules";

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

  it("keeps office hours without a capacity, and a tip with no date, place or capacity", () => {
    expect(checkPost(input({ kind: "office-hours", capacity: "" }), CAMPUSES).value).toMatchObject({
      kind: "office-hours",
      capacity: null,
      place: "The lawn outside the library",
    });
    expect(
      checkPost(input({ kind: "tip", campus: "all", date: "", time: "", place: "", published: false }), CAMPUSES).value,
    ).toMatchObject({
      kind: "tip",
      campusSlug: "all",
      startsAt: null,
      place: null,
      capacity: null,
      published: false,
    });
  });

  it("lets a tip be for one campus or all, and ignores a tip's date, place and capacity (amendment 29)", () => {
    expect(checkPost(input({ kind: "tip", campus: "midrand", capacity: "0" }), CAMPUSES).value).toMatchObject({
      kind: "tip",
      campusSlug: "midrand",
      startsAt: null,
      place: null,
      capacity: null,
    });
    expect(checkPost(input({ kind: "tip", campus: "" }), CAMPUSES).errors).toEqual(["post-campus-missing"]);
  });

  it("takes All campuses for an event", () => {
    expect(checkPost(input({ campus: "all" }), CAMPUSES).value?.campusSlug).toBe("all");
  });

  it("refuses a year outside this century, so a mistyped one isn't saved", () => {
    for (const date of ["0999-01-01", "1999-12-31", "2101-01-01"]) {
      expect(checkPost(input({ date }), CAMPUSES).errors, date).toContain("post-date-missing");
    }
    expect(checkPost(input({ date: "2026-11-19" }), CAMPUSES).errors).not.toContain("post-date-missing");
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
    expect(checkPost(input({ capacity: "1000" }), CAMPUSES).value?.capacity).toBe(1000);
    expect(checkPost(input({ capacity: "2.5" }), CAMPUSES).errors).toEqual(["post-capacity-invalid"]);
  });

  it("asks for one of the three kinds", () => {
    expect(checkPost(input({ kind: "poll" }), CAMPUSES).errors).toEqual(["post-kind-missing"]);
  });

  it("reads SAST as UTC+2 both ways, across midnight", () => {
    expect(sastToUtc("2026-10-15", "01:00")).toBe("2026-10-14T23:00:00.000Z");
    expect(sastToUtc("2026-10-15", "1pm")).toBeNull();
    expect(utcToSastFields("2026-10-14T22:30:00.000Z")).toEqual({ date: "2026-10-15", time: "00:30" });
  });
});

describe("a saved post with RSVPs or slot requests (amendment 26)", () => {
  const event = { kind: "event" as const, rsvps: 12, going: 12, openRequests: 0 };
  const officeHours = { kind: "office-hours" as const, rsvps: 0, going: 0, openRequests: 1 };
  /** A sample event: 23 going before Vossie, nobody on Vossie yet. */
  const sample = { kind: "event" as const, rsvps: 0, going: 23, openRequests: 0 };

  it("refuses fewer places than the RSVPs it has taken", () => {
    expect(checkPost(input({ capacity: "11" }), CAMPUSES, event)).toEqual({
      value: null,
      errors: ["post-capacity-below"],
    });
    expect(checkPost(input({ capacity: "12" }), CAMPUSES, event).value?.capacity).toBe(12);
  });

  it("holds places for everyone going, but locks the kind only for Vossie's RSVPs (amendment 42)", () => {
    expect(checkPost(input({ capacity: "5" }), CAMPUSES, sample).errors).toEqual(["post-capacity-below"]);
    expect(checkPost(input({ capacity: "23" }), CAMPUSES, sample).value?.capacity).toBe(23);
    expect(checkPost(input({ kind: "tip", campus: "all" }), CAMPUSES, sample).errors).toEqual([]);
  });

  it("says the capacity is invalid, not below, when it isn't a number of places", () => {
    expect(checkPost(input({ capacity: "0" }), CAMPUSES, event).errors).toEqual(["post-capacity-invalid"]);
  });

  it("refuses a change of kind once anyone has RSVP'd or asked for a slot, straight after the kind", () => {
    expect(checkPost(input({ kind: "tip", campus: "all", title: "" }), CAMPUSES, event).errors).toEqual([
      "post-kind-locked",
      "post-title-missing",
    ]);
    expect(checkPost(input({ kind: "event" }), CAMPUSES, officeHours).errors).toEqual(["post-kind-locked"]);
    expect(checkPost(input({ kind: "office-hours", capacity: "" }), CAMPUSES, officeHours).errors).toEqual([]);
  });

  it("lets a post with nobody signed up change kind, and leaves a new post alone", () => {
    expect(checkPost(input({ kind: "tip", campus: "all" }), CAMPUSES, { ...event, rsvps: 0, going: 0 }).errors).toEqual(
      [],
    );
    expect(checkPost(input({ capacity: "1" }), CAMPUSES, null).errors).toEqual([]);
  });

  it("is a check the save can repeat at the moment it writes (amendment 19)", () => {
    expect(postLocks({ kind: "event", capacity: 5 }, event)).toEqual(["post-capacity-below"]);
    expect(postLocks({ kind: "tip", capacity: null }, event)).toEqual(["post-kind-locked"]);
    expect(postLocks({ kind: "event", capacity: 40 }, event)).toEqual([]);
    expect(postLocks({ kind: "event", capacity: 22 }, sample)).toEqual(["post-capacity-below"]);
    expect(postLocks({ kind: "event", capacity: 1 }, null)).toEqual([]);
  });
});
