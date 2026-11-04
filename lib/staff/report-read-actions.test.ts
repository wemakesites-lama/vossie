import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { createReport, fileListingCheckReport } from "@/lib/data/reports";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { STAFF_NOTICE } from "./form-state";
import { readReportAgain } from "./report-read-actions";

// Read again (AI features spec 4.3, AI stage C planning decision 4), on the sample store with the fake provider.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
  vi.stubEnv("VOSSIE_AI_REPORT_READ", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;
const report = (target: ReportTarget, detail = "") =>
  createReport({ reporterId: "acc-student", target, targetTitle: "Reported", reason: "prohibited", detail, now: STAFF_NOW });

describe("Read again (AI features spec 4.3)", () => {
  it("gives anyone but an admin the 404, reading nothing", async () => {
    const id = await report({ kind: "listing", id: "l-001" });
    await signedInAs(request, "acc-mentor");
    await expect(readReportAgain(form({ report: id }))).rejects.toThrow("notFound");
    expect(sampleStore().reports.get(id)?.firstRead).toBeUndefined();
  });

  it("reads an open student's report with no read, back on its page with no notice", async () => {
    const id = await report({ kind: "listing", id: "l-001" });
    await signedInAs(request, "acc-admin");
    expect(await redirectOf(() => readReportAgain(form({ report: id })))).toBe(`/admin/reports/${id}`);
    expect(sampleStore().reports.get(id)?.firstRead).toMatchObject({ concern: "none" });
    expect(await notice()).toBeNull();
    expect(sampleStore().auditLog.size).toBe(0);
  });

  it("leaves the notice when the read fails", async () => {
    const id = await report({ kind: "listing", id: "l-001" }, "[no read]");
    await signedInAs(request, "acc-admin");
    expect(await redirectOf(() => readReportAgain(form({ report: id })))).toBe(`/admin/reports/${id}`);
    expect(await notice()).toBe("first-read-failed");
    expect(sampleStore().reports.get(id)?.firstRead).toBeUndefined();
  });

  it("changes nothing on a report already read, the admin's own, the listing check's, or with the switch off", async () => {
    await signedInAs(request, "acc-admin");
    const read = await report({ kind: "listing", id: "l-001" });
    const first = { summary: "Already read.", concern: "none", agrees: false } as const;
    sampleStore().reports.get(read)!.firstRead = first;
    await redirectOf(() => readReportAgain(form({ report: read })));
    expect(sampleStore().reports.get(read)?.firstRead).toEqual(first);

    sampleStore().sellers.get("tech-corner")!.ownerId = "acc-admin";
    const own = await report({ kind: "seller", id: "tech-corner" });
    await redirectOf(() => readReportAgain(form({ report: own })));
    expect(sampleStore().reports.get(own)?.firstRead).toBeUndefined();

    expect(await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-admin", concern: "stolen", now: STAFF_NOW })).toBe(
      "filed",
    );
    const checked = [...sampleStore().reports.values()].find((row) => row.reporterId === null)!;
    await redirectOf(() => readReportAgain(form({ report: checked.id })));
    expect(checked.firstRead).toBeUndefined();

    // A hidden listing can't be read through the public readers, so Read again doesn't try (final review).
    const hidden = await report({ kind: "listing", id: "l-003" });
    sampleStore().listings.get("l-003")!.hiddenAt = STAFF_NOW.toISOString();
    await redirectOf(() => readReportAgain(form({ report: hidden })));
    expect(sampleStore().reports.get(hidden)?.firstRead).toBeUndefined();

    vi.stubEnv("VOSSIE_AI_REPORT_READ", "");
    const off =await report({ kind: "listing", id: "l-002" });
    await redirectOf(() => readReportAgain(form({ report: off })));
    expect(sampleStore().reports.get(off)?.firstRead).toBeUndefined();
    expect(await notice()).toBeNull();
  });

  it("goes back to the reports for a bad or unknown id", async () => {
    await signedInAs(request, "acc-admin");
    expect(await redirectOf(() => readReportAgain(form({ report: "nope!" })))).toBe("/admin/reports");
    expect(await redirectOf(() => readReportAgain(form({ report: "rep-gone" })))).toBe("/admin/reports");
  });
});
