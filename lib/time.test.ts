import { describe, expect, it, vi } from "vitest";
import {
  inboxTime,
  lastSastDays,
  longSastDate,
  messageTime,
  sastClock,
  sastDate,
  sastDateTime,
  sastMonthYear,
  sastToday,
  shortSastDate,
} from "./time";

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

describe("sastMonthYear", () => {
  it("gives the month in South Africa, in words, for \"Member since\" (accounts spec 3.2)", () => {
    expect(sastMonthYear("2026-10-14T08:00:00Z")).toBe("October 2026");
    expect(sastMonthYear("2026-09-30T22:30:00Z")).toBe("October 2026");
  });
});

describe("sastClock", () => {
  it("gives the time of day in South Africa on the 24-hour clock (accounts spec 3.3)", () => {
    expect(sastClock("2026-10-14T08:42:00Z")).toBe("10:42");
    expect(sastClock("2026-10-14T22:05:00Z")).toBe("00:05");
  });
});

describe("inboxTime (messaging spec 3.2, plan decision 28)", () => {
  // Wednesday 14 October 2026, 15:00 in South Africa.
  const now = new Date("2026-10-14T13:00:00Z");

  it("gives the time today, the weekday this past week, then the date", () => {
    expect(inboxTime("2026-10-14T12:05:00Z", now)).toBe("14:05");
    expect(inboxTime("2026-10-12T08:00:00Z", now)).toBe("Mon");
    expect(inboxTime("2026-10-08T08:00:00Z", now)).toBe("Thu");
    expect(inboxTime("2026-10-07T08:00:00Z", now)).toBe("7 Oct");
    expect(inboxTime("2025-12-30T08:00:00Z", now)).toBe("30 Dec 2025");
  });

  it("counts days in South Africa, so 22:30 UTC the night before is already today", () => {
    expect(inboxTime("2026-10-13T22:30:00Z", now)).toBe("00:30");
    expect(inboxTime("2026-10-13T21:59:00Z", now)).toBe("Tue");
  });
});

describe("messageTime (messaging spec 3.3)", () => {
  it("gives the time today, and the date and time otherwise", () => {
    const now = new Date("2026-10-14T13:00:00Z");
    expect(messageTime("2026-10-14T06:42:00Z", now)).toBe("08:42");
    expect(messageTime("2026-10-12T08:00:00Z", now)).toBe("12 Oct, 10:00");
    expect(messageTime("2025-12-30T08:00:00Z", now)).toBe("30 Dec 2025, 10:00");
  });
});

describe("the unit tests' own clock (staff tools plan amendment 12.3)", () => {
  it("runs in UTC, so a test can't pass only because this machine is set to South African time", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
    // 00:30 in South Africa on the 15th is 22:30 UTC on the 14th: the machine's own date would say the 15th.
    expect(new Date("2026-10-14T22:30:00Z").getDate()).toBe(14);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });
});

describe("lastSastDays (role views N2)", () => {
  it("gives the last days by South African date, oldest first, across a month end", () => {
    // 00:30 on 1 November in South Africa is still 31 October in UTC.
    expect(lastSastDays(3, new Date("2026-10-31T22:30:00.000Z"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("gives today alone for one day", () => {
    expect(lastSastDays(1, new Date("2026-10-14T10:00:00.000Z"))).toEqual(["2026-10-14"]);
  });
});
