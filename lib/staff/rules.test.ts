import { describe, expect, it } from "vitest";
import {
  addDays,
  checkCheckInDay,
  checkDismissNote,
  checkHelp,
  checkMentorNote,
  checkPinDay,
  checkPointName,
  checkReason,
  checkTime,
  parseDay,
} from "./rules";

describe("the staff forms' limits (plan decisions 10, 13, 16 and 18)", () => {
  it("asks for a reason of up to 500 characters, tidied", () => {
    expect(checkReason("  Photos show someone else's work.  ")).toEqual({
      value: "Photos show someone else's work.",
      error: null,
    });
    expect(checkReason(" \n ").error).toBe("reason-missing");
    expect(checkReason("x".repeat(501)).error).toBe("reason-length");
    expect(checkReason("é".repeat(500)).error).toBeNull();
  });

  it("asks for a dismissal's note, and a mentor's note of up to 1,000 characters, keeping line breaks", () => {
    expect(checkDismissNote("").error).toBe("note-missing");
    expect(checkDismissNote("x".repeat(501)).error).toBe("note-length");
    expect(checkMentorNote("Line one\r\nLine two")).toEqual({ value: "Line one\nLine two", error: null });
    expect(checkMentorNote("").error).toBe("mentor-note-missing");
    expect(checkMentorNote("x".repeat(1001)).error).toBe("mentor-note-length");
  });

  it("names a pickup point in 2 to 60 characters on one line", () => {
    expect(checkPointName("  Student\ncentre  ")).toEqual({ value: "Student centre", error: null });
    expect(checkPointName("").error).toBe("point-name-missing");
    expect(checkPointName("A").error).toBe("point-name-length");
    expect(checkPointName("x".repeat(61)).error).toBe("point-name-length");
  });

  it("asks a slot request for help of up to 300 characters, and an optional time of up to 100", () => {
    expect(checkHelp("").error).toBe("help-missing");
    expect(checkHelp("x".repeat(301)).error).toBe("help-length");
    expect(checkTime("")).toEqual({ value: "", error: null });
    expect(checkTime("x".repeat(101)).error).toBe("time-length");
  });

  it("reads a date as YYYY-MM-DD, only when it's a real day", () => {
    expect(parseDay("2026-10-14")).toBe("2026-10-14");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("14/10/2026")).toBeNull();
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-14", -6)).toBe("2026-10-08");
  });

  it("pins from today to 60 days ahead (plan decision 9)", () => {
    expect(checkPinDay("2026-10-14", "2026-10-14")).toEqual({ value: "2026-10-14", error: null });
    expect(checkPinDay("", "2026-10-14").error).toBe("day-missing");
    expect(checkPinDay("2026-10-13", "2026-10-14").error).toBe("day-past");
    expect(checkPinDay("2026-12-13", "2026-10-14").error).toBeNull();
    expect(checkPinDay("2026-12-14", "2026-10-14").error).toBe("day-far");
  });

  it("dates a check-in today or earlier", () => {
    expect(checkCheckInDay("2026-10-14", "2026-10-14").error).toBeNull();
    expect(checkCheckInDay("2026-10-15", "2026-10-14").error).toBe("check-in-day-future");
    expect(checkCheckInDay("nope", "2026-10-14").error).toBe("check-in-day-missing");
  });
});
