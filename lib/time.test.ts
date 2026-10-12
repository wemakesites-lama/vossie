import { describe, expect, it, vi } from "vitest";
import { sastDate, sastToday } from "./time";

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
