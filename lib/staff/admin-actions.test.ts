import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { deleteAccountData } from "@/lib/data/accounts";
import { listAudit } from "@/lib/data/audit";
import { addPin } from "@/lib/data/featured";
import { getNotifications } from "@/lib/data/notifications";
import { createReport } from "@/lib/data/reports";
import { createRequest } from "@/lib/data/requests";
import { createShop } from "@/lib/data/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import type { ReportTarget } from "@/lib/types";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import * as adminActions from "./admin-actions";
import {
  addPoint,
  approveSeller,
  assignMentor,
  declineSeller,
  dismissReport,
  hideReportedListing,
  hideReportedRequest,
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
import { declineForm, dismissForm, hideForm, PIN_FORM, pointAddForm, STAFF_NOTICE } from "./form-state";

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

// Amendment 14.8: every exported admin action, one valid form each. An admin's form does something (an audit entry); the
// same form from a mentor or a student gets the 404 and leaves the store exactly as it was.
type Arranged = { report: string; pin: string };
type GateCase = {
  /** What the form needs to be valid and to change something. */
  setup?: (arranged: Arranged) => void | Promise<void>;
  fields: (arranged: Arranged) => Record<string, string>;
};

const REASON = "Selling exam answers.";
const GATE_CASES: Readonly<Record<string, GateCase>> = {
  approveSeller: { fields: () => ({ shop: "crochet-corner", owner: "acc-pending" }) },
  declineSeller: { fields: () => ({ shop: "crochet-corner", owner: "acc-pending", reason: REASON }) },
  verifySeller: { fields: () => ({ shop: "tech-corner", verified: "yes" }) },
  pauseSeller: { fields: () => ({ shop: "tech-corner", reason: REASON }) },
  resumeSeller: {
    setup: () => {
      Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff", staffReason: REASON });
    },
    fields: () => ({ shop: "tech-corner" }),
  },
  assignMentor: { fields: () => ({ shop: "tech-corner", mentor: "" }) },
  dismissReport: { fields: ({ report }) => ({ report, note: "Looked fine." }) },
  hideReportedListing: { fields: ({ report }) => ({ report, reason: REASON }) },
  // Hide the request acts on a report about a request, so its setup reports one (community actions plan decision 20).
  hideReportedRequest: {
    setup: async (arranged) => {
      arranged.report = await report("acc-student", { kind: "request", id: "r-002" }, "Graphic calculator to borrow for exams");
    },
    fields: ({ report }) => ({ report, reason: REASON }),
  },
  pauseReportedShop: { fields: ({ report }) => ({ report, reason: REASON }) },
  pinSeller: { fields: () => ({ seller: "nail-bar", campus: "pretoria", day: "2026-10-14" }) },
  unpinSeller: {
    setup: async (arranged) => {
      const pin = await addPin({
        sellerSlug: "nail-bar",
        campusSlug: "pretoria",
        day: "2026-10-14",
        staffId: "acc-admin",
        now: STAFF_NOW,
      });
      if (typeof pin === "string") throw new Error(`The pin wasn't made: ${pin}`);
      arranged.pin = pin.id;
    },
    fields: ({ pin }) => ({ pin }),
  },
  addPoint: { fields: () => ({ campus: "midrand", name: "Student centre" }) },
  renamePoint: { fields: () => ({ point: "pp-midrand-library", name: "Library steps" }) },
  retirePoint: { fields: () => ({ point: "pp-midrand-library" }) },
  restorePoint: {
    setup: () => {
      sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = STAFF_NOW.toISOString();
    },
    fields: () => ({ point: "pp-midrand-library" }),
  },
};

const ADMIN_ACTIONS: Readonly<Record<string, (formData: FormData) => Promise<void>>> = { ...adminActions };

/** A fresh store with a report on a Tech corner listing, and the case's setup done. Its form. */
async function arrange(name: string): Promise<FormData> {
  resetSampleStore();
  resetRequest(request);
  const arranged: Arranged = {
    report: await report("acc-student", { kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator"),
    pin: "",
  };
  await GATE_CASES[name].setup?.(arranged);
  return form(GATE_CASES[name].fields(arranged));
}

describe("the gate on every exported admin action (staff tools amendment 14.8)", () => {
  it("has a case for every exported action, so a new action can't skip the gate's test", () => {
    expect(Object.keys(ADMIN_ACTIONS).length).toBeGreaterThan(0);
    expect(Object.keys(GATE_CASES).sort()).toEqual(Object.keys(ADMIN_ACTIONS).sort());
  });

  it.each(Object.keys(GATE_CASES))("%s works for an admin, and gives a mentor or a student the 404", async (name) => {
    // The form is a good one: an admin's post changes something and is logged.
    const forAdmin = await arrange(name);
    await asAdmin();
    await redirectOf(() => ADMIN_ACTIONS[name](forAdmin));
    expect(sampleStore().auditLog.size, `${name} with a valid form`).toBe(1);
    for (const accountId of ["acc-mentor", "acc-student"]) {
      const forOthers = await arrange(name);
      await signedInAs(request, accountId);
      const before = structuredClone(sampleStore());
      await expect(ADMIN_ACTIONS[name](forOthers), `${name} as ${accountId}`).rejects.toThrow("notFound");
      expect(sampleStore(), `${name} as ${accountId}`).toEqual(before);
      expect([request.refreshed, request.updatedTags], `${name} as ${accountId}`).toEqual([false, []]);
    }
  });
});

describe("sellers (staff tools spec 2.3)", () => {
  it("approves a waiting shop: one audit entry, the seller told, buyers' pages expired, and a notice", async () => {
    await asAdmin();
    const redirect = await redirectSignalOf(() => approveSeller(form({ shop: "crochet-corner", owner: "acc-pending" })));
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
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner", owner: "acc-pending" })));
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner", owner: "acc-pending" })));
    expect(sampleStore().auditLog.size).toBe(1);
    expect(await getNotifications("acc-pending", 5)).toHaveLength(1);
    expect(await notice()).toBe("nothing");
    expect(await redirectOf(() => approveSeller(form({ shop: "Not a slug!" })))).toBe("/admin/sellers");
  });

  it("acts only on the shop that was reviewed: a new shop on the same link is neither approved nor declined (amendment 14.6)", async () => {
    await asAdmin();
    // The page was drawn for Lerato's shop; she deletes her account, and a student starts a new shop on the same link.
    await deleteAccountData("acc-pending");
    await createShop(
      "acc-student",
      {
        name: "Crochet corner",
        tagline: "A different shop on the old link.",
        categorySlug: "tech",
        about: "",
        image: null,
        campusSlug: "midrand",
        pickupPointIds: [],
      },
      STAFF_NOW,
    );
    expect(sampleStore().sellers.get("crochet-corner")?.ownerId).toBe("acc-student");
    const attempts = [
      () => approveSeller(form({ shop: "crochet-corner", owner: "acc-pending" })),
      () => approveSeller(form({ shop: "crochet-corner" })),
      () => declineSeller(form({ shop: "crochet-corner", owner: "acc-pending", reason: "Add a photo of your work." })),
    ];
    for (const attempt of attempts) {
      expect(await redirectOf(attempt)).toMatch(/^\/admin\/sellers/);
      expect(await notice()).toBe("nothing");
    }
    expect(sampleStore().sellerProfiles.get("acc-student")).toMatchObject({ status: "pending", sellerSlug: null });
    expect(sampleStore().sellerProfiles.get("acc-student")?.declinedAt ?? null).toBeNull();
    expect(sampleStore().auditLog.size).toBe(0);
    const told = (await getNotifications("acc-student", 20)).filter((item) => item.kind.startsWith("shop-"));
    expect(told).toEqual([]);
    // The page for the shop that's there now posts its own owner, and works.
    await redirectOf(() => approveSeller(form({ shop: "crochet-corner", owner: "acc-student" })));
    expect(sampleStore().sellerProfiles.get("acc-student")?.status).toBe("approved");
  });

  it("asks for the reason before declining, keeping what was typed and changing nothing", async () => {
    await asAdmin();
    expect(await redirectOf(() => declineSeller(form({ shop: "crochet-corner", owner: "acc-pending", reason: " " })))).toBe(
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
      await redirectOf(() => declineSeller(form({ shop: "crochet-corner", owner: "acc-pending", reason: "Add a photo of your work." }))),
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

  it("won't make a shop's owner its mentor: it says nothing changed and logs nothing (amendment 15.3)", async () => {
    await asAdmin();
    sampleStore().accounts.get("acc-seller")!.roles.push("mentor");
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-seller" })));
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
    expect(await notice()).toBe("nothing");
    expect(await listAudit({ staff: null, kind: "mentoring" })).toEqual([]);
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
      // The heading of "Reports you've made" (amendment 8).
      href: "/account/privacy#account-privacy-reports-title",
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

  // Amendment 14.1: whichever way the Hub pauses a shop, no reporter is later told "didn't find a problem" about it.
  it.each([
    ["its page", "page"],
    ["a report about the shop", "shop"],
    ["a report about one of its listings", "listing"],
  ] as const)("closes every open report on the shop and its listings when it's paused from %s", async (_from, via) => {
    const title = "Casio fx-991ZA Plus calculator";
    const aboutShop = await report("acc-student", { kind: "seller", id: "tech-corner" }, "Tech corner");
    const aboutListing = await report("acc-mentor", { kind: "listing", id: "l-001" }, title);
    const elsewhere = await report("acc-student", { kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await asAdmin();
    const reason = "Selling exam answers.";
    await redirectOf(() => {
      if (via === "page") return pauseSeller(form({ shop: "tech-corner", reason }));
      return pauseReportedShop(form({ report: via === "shop" ? aboutShop : aboutListing, reason }));
    });
    expect(sampleStore().sellerProfiles.get("acc-seller")).toMatchObject({ status: "paused", pausedBy: "staff" });
    for (const id of [aboutShop, aboutListing]) {
      expect(sampleStore().reports.get(id), id).toMatchObject({
        status: "closed",
        outcome: "paused",
        note: "Selling exam answers.",
        closedBy: "acc-admin",
      });
    }
    expect(sampleStore().reports.get(elsewhere)?.status).toBe("open");
    expect((await newest("acc-student")).text).toBe("Thanks, we've acted on your report about Tech corner.");
    expect((await newest("acc-mentor")).text).toBe(`Thanks, we've acted on your report about ${title}.`);
    expect((await newest("acc-mentor")).href).toBe("/account/privacy#account-privacy-reports-title");
    expect([...sampleStore().notifications.values()].filter((row) => row.text.includes("didn't find a problem"))).toEqual([]);
    expect((await listAudit({ staff: null, kind: "shops" })).map((entry) => entry.action)).toEqual(["shop-paused"]);
  });

  it("pauses the shop behind a report, and hideReportedListing won't act on a report about a request", async () => {
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

describe("hiding a reported request (community actions spec 2.14, plan decision 20)", () => {
  const postedRequest = () =>
    createRequest({
      askerId: "acc-student",
      fields: {
        title: "Exam answers wanted",
        categorySlug: "textbooks-notes",
        campusSlug: "midrand",
        details: "Looking for the answers to Friday's exam paper.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: STAFF_NOW,
    });

  it("hides it: every open report closes, the asker and the reporters are told, it's logged, the board expires", async () => {
    const posted = await postedRequest();
    const first = await report("acc-mentor", { kind: "request", id: posted.id }, posted.title);
    const second = await report("acc-seller", { kind: "request", id: posted.id }, posted.title);
    await asAdmin();
    expect(
      await redirectOf(() => hideReportedRequest(form({ report: first, reason: "Selling exam answers isn't allowed." }))),
    ).toBe("/admin/reports");
    expect(sampleStore().requests.get(posted.id)).toMatchObject({ hiddenReason: "Selling exam answers isn't allowed." });
    expect([sampleStore().reports.get(first)?.outcome, sampleStore().reports.get(second)?.outcome]).toEqual([
      "hidden",
      "hidden",
    ]);
    expect(await lastAudit()).toMatchObject({
      staffName: "Pieter",
      action: "request-hidden",
      targetKind: "request",
      targetName: "Exam answers wanted",
      detail: "Selling exam answers isn't allowed.",
    });
    expect(await newest("acc-student")).toMatchObject({
      kind: "request-update",
      text: "The Hub hid your request Exam answers wanted. See why in Your requests.",
      href: "/account/requests",
    });
    expect((await newest("acc-mentor")).text).toBe("Thanks, we've acted on your report about Exam answers wanted.");
    expect((await newest("acc-seller")).text).toBe("Thanks, we've acted on your report about Exam answers wanted.");
    expect(request.updatedTags).toEqual(["requests"]);
    expect(await notice()).toBe("request-hidden");
  });

  it("hides a sample request, which has no asker to tell", async () => {
    const id = await report("acc-student", { kind: "request", id: "r-002" }, "Graphic calculator to borrow for exams");
    await asAdmin();
    await redirectOf(() => hideReportedRequest(form({ report: id, reason: "Not allowed." })));
    expect(sampleStore().requests.get("r-002")?.hiddenReason).toBe("Not allowed.");
    expect([...sampleStore().notifications.values()].filter((row) => row.kind === "request-update")).toEqual([]);
    expect((await newest("acc-student")).text).toBe(
      "Thanks, we've acted on your report about Graphic calculator to borrow for exams.",
    );
  });

  it("asks for the reason first, and changes nothing on a second press or for a listing's report", async () => {
    const posted = await postedRequest();
    const id = await report("acc-mentor", { kind: "request", id: posted.id }, posted.title);
    await asAdmin();
    expect(await redirectOf(() => hideReportedRequest(form({ report: id, reason: "" })))).toBe(
      `/admin/reports/${id}/hide`,
    );
    // The reason is read by the asker, not a seller, so the missing-reason error says so.
    expect((await readFormState(hideForm(id)))?.errors).toEqual(["reason-missing-asker"]);
    expect(sampleStore().requests.get(posted.id)?.hiddenAt).toBeNull();
    await redirectOf(() => hideReportedRequest(form({ report: id, reason: "Not allowed." })));
    await redirectOf(() => hideReportedRequest(form({ report: id, reason: "Again." })));
    expect(await notice()).toBe("nothing");
    expect(sampleStore().auditLog.size).toBe(1);
    const aboutListing = await report("acc-mentor", { kind: "listing", id: "l-004" }, "Box braids, shoulder length");
    await redirectOf(() => hideReportedRequest(form({ report: aboutListing, reason: "No." })));
    expect(sampleStore().listings.get("l-004")?.hiddenAt ?? null).toBeNull();
    expect(sampleStore().reports.get(aboutListing)?.status).toBe("open");
  });

  it("gives anyone but an admin the 404, changing nothing", async () => {
    const posted = await postedRequest();
    const id = await report("acc-mentor", { kind: "request", id: posted.id }, posted.title);
    await signedInAs(request, "acc-mentor");
    await expect(hideReportedRequest(form({ report: id, reason: "No." }))).rejects.toThrow("notFound");
    expect(sampleStore().requests.get(posted.id)?.hiddenAt).toBeNull();
  });
});
