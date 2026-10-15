import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { getNotifications } from "@/lib/data/notifications";
import { createReport } from "@/lib/data/reports";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import {
  addPoint,
  approveSeller,
  assignMentor,
  declineSeller,
  dismissReport,
  hideReportedListing,
  pauseReportedShop,
  pauseSeller,
  pinSeller,
  renamePoint,
  restorePoint,
  resumeSeller,
  retirePoint,
  unpinSeller,
  verifySeller,
} from "./admin-actions";
import { declineForm, dismissForm, PIN_FORM, pointAddForm, STAFF_NOTICE } from "./form-state";

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
});

const asAdmin = () => signedInAs(request, "acc-admin");
const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;
const lastAudit = async () => (await listAudit({ staff: null, kind: null }))[0];
const newest = async (accountId: string) => (await getNotifications(accountId, 1))[0];

function report(reporterId: string, target: ReportTarget, targetTitle: string) {
  return createReport({ reporterId, target, targetTitle, reason: "scam", detail: "", now: STAFF_NOW });
}

describe("the gate on every admin action (staff tools spec 2.1, plan decision 1)", () => {
  it("sends a signed-out visitor to sign in, and gives anyone but an admin the 404, changing nothing", async () => {
    expect(await redirectOf(() => approveSeller(form({ shop: "crochet-corner" })))).toBe(
      "/login?next=%2Fadmin%2Fsellers%2Fcrochet-corner",
    );
    await signedInAs(request, "acc-mentor");
    await expect(approveSeller(form({ shop: "crochet-corner" }))).rejects.toThrow("notFound");
    await expect(pinSeller(form({ seller: "nail-bar", campus: "all", day: "2026-10-14" }))).rejects.toThrow("notFound");
    expect(sampleStore().sellerProfiles.get("acc-pending")?.status).toBe("pending");
    expect(sampleStore().auditLog.size).toBe(0);
  });
});

describe("sellers (staff tools spec 2.3)", () => {
  it("approves a waiting shop: one audit entry, the seller told, buyers' pages expired, and a notice", async () => {
    await asAdmin();
    const redirect = await redirectSignalOf(() => approveSeller(form({ shop: "crochet-corner" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/admin/sellers/crochet-corner", "replace", true]);
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({ status: "approved", sellerSlug: "crochet-corner" });
    expect(await lastAudit()).toMatchObject({
      staffName: "Pieter",
      action: "shop-approved",
      targetKind: "shop",
      targetName: "Crochet corner",
      detail: "",
    });
    expect(await newest("acc-pending")).toMatchObject({
      kind: "shop-approved",
      text: "The Hub approved Crochet corner. You can publish your listings now.",
      href: "/sell",
    });
    expect(request.updatedTags).toEqual(["sellers"]);
    expect(await notice()).toBe("approved");
  });

  it("says nothing changed on a second press, writing no entry and sending nothing (plan decision 23)", async () => {
    await asAdmin();
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner" })));
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner" })));
    expect(sampleStore().auditLog.size).toBe(1);
    expect(await getNotifications("acc-pending", 5)).toHaveLength(1);
    expect(await notice()).toBe("nothing");
    expect(await redirectOf(() => approveSeller(form({ shop: "Not a slug!" })))).toBe("/admin/sellers");
  });

  it("asks for the reason before declining, keeping what was typed and changing nothing", async () => {
    await asAdmin();
    expect(await redirectOf(() => declineSeller(form({ shop: "crochet-corner", reason: " " })))).toBe(
      "/admin/sellers/crochet-corner/decline",
    );
    expect(await readFormState(declineForm("crochet-corner"))).toMatchObject({
      errors: ["reason-missing"],
      values: { reason: "" },
    });
    expect(sampleStore().sellerProfiles.get("acc-pending")?.declinedAt ?? null).toBeNull();
    expect(sampleStore().auditLog.size).toBe(0);
  });

  it("declines with the reason, which is recorded, and tells the seller where to see it", async () => {
    await asAdmin();
    expect(
      await redirectOf(() => declineSeller(form({ shop: "crochet-corner", reason: "Add a photo of your work." }))),
    ).toBe("/admin/sellers/crochet-corner");
    expect(sampleStore().sellerProfiles.get("acc-pending")).toMatchObject({
      declinedAt: STAFF_NOW.toISOString(),
      staffReason: "Add a photo of your work.",
    });
    expect(await lastAudit()).toMatchObject({ action: "shop-declined", detail: "Add a photo of your work." });
    expect(await newest("acc-pending")).toMatchObject({
      kind: "shop-update",
      text: "The Hub didn't approve Crochet corner yet. See why, and send it again.",
      href: "/sell",
    });
    expect(await readFormState(declineForm("crochet-corner"))).toBeNull();
    expect(await notice()).toBe("declined");
  });

  it("gives and takes Verified, telling an owner but not a sample shop, and expires buyers' pages", async () => {
    await asAdmin();
    await redirectOf(() => verifySeller(form({ shop: "tech-corner", verified: "yes" })));
    expect(sampleStore().sellers.get("tech-corner")?.verified).toBe(true);
    expect((await newest("acc-seller")).text).toBe("Tech corner is now Verified by the Hub.");
    await redirectOf(() => verifySeller(form({ shop: "hair-studio", verified: "no" })));
    expect(sampleStore().sellers.get("hair-studio")?.verified).toBe(false);
    expect((await listAudit({ staff: null, kind: null })).map((entry) => entry.action)).toEqual([
      "shop-unverified",
      "shop-verified",
    ]);
    expect(request.updatedTags).toEqual(["sellers", "sellers"]);
    expect(await notice()).toBe("unverified");
  });

  it("pauses a shop with the reason from its confirm page, and resumes it", async () => {
    await asAdmin();
    expect(await redirectOf(() => pauseSeller(form({ shop: "tech-corner", reason: "" })))).toBe(
      "/admin/sellers/tech-corner/pause",
    );
    expect(await redirectOf(() => pauseSeller(form({ shop: "tech-corner", reason: "Selling exam answers." })))).toBe(
      "/admin/sellers/tech-corner",
    );
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({ status: "paused", pausedBy: "staff" });
    expect((await newest("acc-seller")).text).toBe("The Hub paused Tech corner. See why on your dashboard.");
    // The clock is frozen, and notifications sort newest first by time, so move it on for the second one.
    vi.advanceTimersByTime(1000);
    await redirectOf(() => resumeSeller(form({ shop: "tech-corner" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.status).toBe("approved");
    expect((await newest("acc-seller")).text).toBe("The Hub resumed Tech corner. Buyers can see it again.");
    expect((await listAudit({ staff: null, kind: "shops" })).map((entry) => [entry.action, entry.detail])).toEqual([
      ["shop-resumed", ""],
      ["shop-paused", "Selling exam answers."],
    ]);
  });

  it("says the shop is still paused when the Hub lifts its pause over a seller's own", async () => {
    await asAdmin();
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "seller" });
    await redirectOf(() => pauseSeller(form({ shop: "tech-corner", reason: "Reported twice." })));
    vi.advanceTimersByTime(1000);
    await redirectOf(() => resumeSeller(form({ shop: "tech-corner" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({ status: "paused", pausedBy: "seller" });
    expect((await newest("acc-seller")).text).toBe(
      "The Hub lifted its pause on Tech corner. It's still paused as you set it: resume it from Sell when you're ready.",
    );
  });

  it("assigns a mentor, or none, only from the accounts with the mentor role", async () => {
    await asAdmin();
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-mentor" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
    expect((await listAudit({ staff: null, kind: "mentoring" })).map((entry) => [entry.action, entry.detail])).toEqual([
      ["mentor-assigned", "Naledi"],
      ["mentor-removed", ""],
    ]);
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-student" })));
    expect(await notice()).toBe("nothing");
  });
});

describe("reports (staff tools spec 2.3, plan decision 5)", () => {
  it("dismisses a report with a note, and tells the reporter in the spec's words", async () => {
    const id = await report("acc-student", { kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await asAdmin();
    expect(await redirectOf(() => dismissReport(form({ report: id, note: "" })))).toBe(`/admin/reports/${id}`);
    expect((await readFormState(dismissForm(id)))?.errors).toEqual(["note-missing"]);
    expect(await redirectOf(() => dismissReport(form({ report: id, note: "Looked fine." })))).toBe("/admin/reports");
    expect(sampleStore().reports.get(id)).toMatchObject({ status: "closed", outcome: "dismissed" });
    expect(await newest("acc-student")).toMatchObject({
      kind: "report-handled",
      text: "We looked at your report about Box braids, shoulder length and didn't find a problem.",
      href: "/account/privacy",
    });
    expect(await lastAudit()).toMatchObject({ action: "report-dismissed", targetKind: "report", detail: "Looked fine." });
  });

  it("hides a reported listing: every report on it closes, and the seller and each reporter are told", async () => {
    const title = "Casio fx-991ZA Plus calculator";
    const first = await report("acc-student", { kind: "listing", id: "l-001" }, title);
    await report("acc-mentor", { kind: "listing", id: "l-001" }, title);
    await asAdmin();
    expect(await redirectOf(() => hideReportedListing(form({ report: first, reason: "" })))).toBe(
      `/admin/reports/${first}/hide`,
    );
    expect(
      await redirectOf(() => hideReportedListing(form({ report: first, reason: "Exam papers aren't allowed." }))),
    ).toBe("/admin/reports");
    expect(sampleStore().listings.get("l-001")?.hiddenReason).toBe("Exam papers aren't allowed.");
    expect([...sampleStore().reports.values()].every((row) => row.outcome === "hidden")).toBe(true);
    expect(await newest("acc-seller")).toMatchObject({
      kind: "shop-update",
      text: `The Hub hid ${title}. See why in My listings.`,
      href: "/sell/listings",
    });
    for (const reporter of ["acc-student", "acc-mentor"]) {
      expect((await newest(reporter)).text, reporter).toBe(`Thanks, we've acted on your report about ${title}.`);
    }
    expect(request.updatedTags).toEqual(["listings"]);
    expect(await lastAudit()).toMatchObject({ action: "listing-hidden", targetKind: "listing", targetName: title });
  });

  it("pauses the shop behind a report, and can only dismiss a report about a request", async () => {
    const id = await report("acc-student", { kind: "seller", id: "tech-corner" }, "Tech corner");
    await asAdmin();
    await redirectOf(() => pauseReportedShop(form({ report: id, reason: "Asked buyers for deposits." })));
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({
      status: "paused",
      pausedBy: "staff",
      staffReason: "Asked buyers for deposits.",
    });
    expect(sampleStore().reports.get(id)?.outcome).toBe("paused");
    expect((await newest("acc-student")).text).toBe("Thanks, we've acted on your report about Tech corner.");
    expect(request.updatedTags).toEqual(["sellers"]);
    const aboutRequest = await report("acc-student", { kind: "request", id: "r-001" }, "A Looking For request");
    expect(await redirectOf(() => hideReportedListing(form({ report: aboutRequest, reason: "No." })))).toBe(
      "/admin/reports",
    );
    expect(await notice()).toBe("nothing");
    expect(sampleStore().reports.get(aboutRequest)?.status).toBe("open");
  });
});

describe("Featured pins (staff tools spec 2.8)", () => {
  it("pins a seller to a campus for a day, and takes the pin away", async () => {
    await asAdmin();
    expect(await redirectOf(() => pinSeller(form({ seller: "nail-bar", campus: "pretoria", day: "2026-10-14" })))).toBe(
      "/admin/featured",
    );
    const [pin] = [...sampleStore().featuredPins.values()];
    expect(pin).toMatchObject({ sellerSlug: "nail-bar", campusSlug: "pretoria", day: "2026-10-14", pinnedBy: "acc-admin" });
    expect(await lastAudit()).toMatchObject({ action: "featured-pinned", targetName: "Nail bar", detail: "Pretoria · 2026-10-14" });
    await redirectOf(() => unpinSeller(form({ pin: pin.id })));
    expect(sampleStore().featuredPins.size).toBe(0);
    expect(await lastAudit()).toMatchObject({ action: "featured-unpinned", targetName: "Nail bar" });
    expect(await notice()).toBe("unpinned");
  });

  it("says what's wrong with a pin, keeping what was chosen", async () => {
    await asAdmin();
    await redirectOf(() => pinSeller(form({ seller: "tech-corner", campus: "atlantis", day: "2026-10-13" })));
    expect(await readFormState(PIN_FORM)).toMatchObject({
      errors: ["campus-missing", "day-past"],
      values: { seller: "tech-corner", campus: "atlantis", day: "2026-10-13" },
    });
    await redirectOf(() => pinSeller(form({ seller: "tech-corner", campus: "all", day: "2026-10-14" })));
    expect((await readFormState(PIN_FORM))?.errors).toEqual(["seller-not-eligible"]);
    expect(sampleStore().featuredPins.size).toBe(0);
    expect(sampleStore().auditLog.size).toBe(0);
  });
});

describe("pickup points (staff tools spec 2.3, plan decision 10)", () => {
  it("adds a point to a campus, refusing a name it has, and expires the forms' points", async () => {
    await asAdmin();
    expect(await redirectOf(() => addPoint(form({ campus: "midrand", name: "library ENTRANCE" })))).toBe(
      "/admin/pickup-points#points-midrand",
    );
    expect(await readFormState(pointAddForm("midrand"))).toMatchObject({
      errors: ["point-name-taken"],
      values: { name: "library ENTRANCE" },
    });
    await redirectOf(() => addPoint(form({ campus: "midrand", name: "Student centre" })));
    expect([...sampleStore().pickupPoints.values()].at(-1)).toMatchObject({ campusSlug: "midrand", name: "Student centre" });
    expect(request.updatedTags).toEqual(["pickup-points"]);
    expect(await lastAudit()).toMatchObject({ action: "point-added", targetName: "Student centre", detail: "Midrand" });
    await redirectOf(() => addPoint(form({ campus: "online", name: "The hall" })));
    expect(await notice()).toBe("nothing");
  });

  it("renames, retires and uses a point again, each in the log", async () => {
    await asAdmin();
    await redirectOf(() => renamePoint(form({ point: "pp-midrand-library", name: "Library steps" })));
    await redirectOf(() => retirePoint(form({ point: "pp-midrand-library" })));
    expect(sampleStore().pickupPoints.get("pp-midrand-library")).toMatchObject({
      name: "Library steps",
      retiredAt: STAFF_NOW.toISOString(),
    });
    expect(await redirectOf(() => restorePoint(form({ point: "pp-midrand-library" })))).toBe(
      "/admin/pickup-points#points-midrand",
    );
    expect(sampleStore().pickupPoints.get("pp-midrand-library")?.retiredAt).toBeNull();
    expect(
      (await listAudit({ staff: null, kind: "pickup-points" })).map((entry) => [entry.action, entry.detail]),
    ).toEqual([
      ["point-restored", ""],
      ["point-retired", ""],
      ["point-renamed", "Was Library entrance"],
    ]);
  });
});
