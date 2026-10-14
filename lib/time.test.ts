import { describe, expect, it, vi } from "vitest";
import { longSastDate, sastDate, sastDateTime, sastToday, shortSastDate } from "./time";

describe("sastDate", () => {
  it("gives the date in South Africa (UTC+2), whatever the server's timezone", () => {
    expect(sastDate(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
    expect(sastDate(new Date("2026-10-12T21:59:00Z"))).toBe("2026-10-12");
    expect(sastDate(new Date("2026-10-12T22:00:00Z"))).toBe("2026-10-13");
  });
});

describe("sastToday", () => {
  it("reads the clock and gives today's date in South Africa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T22:30:00Z"));
    expect(sastToday()).toBe("2026-10-12");
  });
});

describe("longSastDate", () => {
  it("writes the date in South Africa in words (spec 5.1)", () => {
    expect(longSastDate("2026-10-12T07:40:00Z")).toBe("12 October 2026");
  });

  it("uses South African time, so 22:30 UTC is already the next day", () => {
    expect(longSastDate("2026-10-11T22:30:00Z")).toBe("12 October 2026");
  });
});

describe("shortSastDate", () => {
  it("writes a stored UTC time as a short date in South Africa (community spec 4.1)", () => {
    expect(shortSastDate("2026-10-13T07:30:00Z")).toBe("13 Oct");
  });

  it("uses South African time, so 22:40 UTC is already the next day", () => {
    expect(shortSastDate("2026-10-10T22:40:00Z")).toBe("11 Oct");
  });
});

describe("sastDateTime", () => {
  it("writes the day, date and time in South Africa (community spec 5.3)", () => {
    expect(sastDateTime("2026-10-14T16:00:00Z")).toBe("Wed 14 Oct · 18:00");
    expect(sastDateTime("2026-10-15T11:00:00Z")).toBe("Thu 15 Oct · 13:00");
    expect(sastDateTime("2027-02-11T16:00:00Z")).toBe("Thu 11 Feb · 18:00");
  });

  it("moves to the next day after 22:00 UTC, writing midnight as 00:00", () => {
    expect(sastDateTime("2026-10-14T22:30:00Z")).toBe("Thu 15 Oct · 00:30");
    expect(sastDateTime("2026-10-14T22:00:00Z")).toBe("Thu 15 Oct · 00:00");
  });
});
