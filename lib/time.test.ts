import { describe, expect, it, vi } from "vitest";
import { longSastDate, sastDate, sastToday } from "./time";

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
