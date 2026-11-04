import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReport, fileListingCheckReport } from "@/lib/data/reports";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { makeFirstRead } from "./first-read";

// Making a report's first read (AI stage C, plan Task 4), on the sample store with the fake provider.

const NOW = new Date("2026-11-05T08:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
  vi.stubEnv("VOSSIE_AI_REPORT_READ", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const report = (target: ReportTarget, detail = "Looks fake") =>
  createReport({ reporterId: "acc-student", target, targetTitle: "Reported", reason: "prohibited", detail, now: NOW });

describe("makeFirstRead (AI features spec 4.3)", () => {
  it("reads a student's report on a listing and stores the read once", async () => {
    sampleStore().listings.get("l-001")!.title = "Fake Casio calculator";
    const id = await report({ kind: "listing", id: "l-001" });
    expect(await makeFirstRead(id, NOW)).toBe("saved");
    expect(sampleStore().reports.get(id)?.firstRead).toEqual({
      summary: "A report about Fake Casio calculator.",
      concern: "counterfeit",
      agrees: true,
    });
    expect(await makeFirstRead(id, NOW)).toBe("skipped");
  });

  it("reads a shop's and a request's own words", async () => {
    const shop = await report({ kind: "seller", id: "tech-corner" });
    expect(await makeFirstRead(shop, NOW)).toBe("saved");
    expect(sampleStore().reports.get(shop)?.firstRead).toMatchObject({ concern: "none", agrees: false });
    const request = await report({ kind: "request", id: "r-001" });
    expect(await makeFirstRead(request, NOW)).toBe("saved");
  });

  it("does nothing with the switch off", async () => {
    vi.stubEnv("VOSSIE_AI_REPORT_READ", "");
    const id = await report({ kind: "listing", id: "l-001" });
    expect(await makeFirstRead(id, NOW)).toBe("off");
    expect(sampleStore().reports.get(id)?.firstRead).toBeUndefined();
  });

  it("fails on a bad reply, and on a target that's gone, storing nothing", async () => {
    const id = await report({ kind: "listing", id: "l-001" }, "[no read]");
    expect(await makeFirstRead(id, NOW)).toBe("failed");
    expect(sampleStore().reports.get(id)?.firstRead).toBeUndefined();
    const gone = await report({ kind: "listing", id: "l-002" });
    sampleStore().listings.delete("l-002");
    expect(await makeFirstRead(gone, NOW)).toBe("failed");
  });

  it("skips the listing check's reports, a closed report and one that isn't there", async () => {
    const listing = sampleStore().listings.get("l-001")!;
    const ownerId = sampleStore().sellers.get(listing.sellerSlug)!.ownerId!;
    expect(await fileListingCheckReport({ listingId: "l-001", ownerId, concern: "counterfeit", now: NOW })).toBe("filed");
    const checked = [...sampleStore().reports.values()].find((row) => row.reporterId === null)!;
    expect(await makeFirstRead(checked.id, NOW)).toBe("skipped");
    const closed = await report({ kind: "listing", id: "l-001" });
    sampleStore().reports.get(closed)!.status = "closed";
    expect(await makeFirstRead(closed, NOW)).toBe("skipped");
    expect(await makeFirstRead("rep-nope", NOW)).toBe("skipped");
  });
});
