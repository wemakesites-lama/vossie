import { describe, expect, it } from "vitest";
import { waitAge } from "./age";

// 2026-10-22 10:00 UTC (12:00 SAST).
const NOW = new Date("2026-10-22T10:00:00.000Z");

describe("waitAge (role views N3 plan decision 1)", () => {
  it("is in hours under a day", () => {
    expect(waitAge("2026-10-22T09:30:00.000Z", NOW)).toEqual({ label: "Under 1h", tone: "info" });
    expect(waitAge("2026-10-22T05:00:00.000Z", NOW)).toEqual({ label: "5h", tone: "info" });
  });

  it("is in whole days from a day on", () => {
    expect(waitAge("2026-10-21T10:00:00.000Z", NOW)).toEqual({ label: "1 day", tone: "info" });
    expect(waitAge("2026-10-10T12:20:00.000Z", NOW)).toEqual({ label: "11 days", tone: "warning" });
  });

  it("turns warning only once it's waited more than 2 days", () => {
    expect(waitAge("2026-10-20T10:00:00.000Z", NOW)).toEqual({ label: "2 days", tone: "info" });
    expect(waitAge("2026-10-20T09:59:00.000Z", NOW)).toEqual({ label: "2 days", tone: "warning" });
  });

  it("takes another threshold (N2's 24 hours)", () => {
    expect(waitAge("2026-10-21T09:00:00.000Z", NOW, 24)).toEqual({ label: "1 day", tone: "warning" });
  });

  it("is null without a time, and never negative", () => {
    expect(waitAge(null, NOW)).toBeNull();
    expect(waitAge("not a date", NOW)).toBeNull();
    expect(waitAge("2026-10-23T10:00:00.000Z", NOW)).toEqual({ label: "Under 1h", tone: "info" });
  });
});
