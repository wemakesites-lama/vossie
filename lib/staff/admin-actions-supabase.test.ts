import { beforeEach, describe, expect, it, vi } from "vitest";
import { Refused } from "@/lib/data/refused";
import { sastDate } from "@/lib/time";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";

// The admin actions on Supabase (C4/C5 plan Task 16; decisions 2 to 4), with lib/data mocked: the staff functions write
// the audit entry, close the reports and send the notifications themselves, so the actions never call recordAudit,
// notify, closeReportsOn or closeReportsAboutShop there; a "forbidden" from the database is the 404; an own-shop or
// own-request refusal from it is the same notice as the action's own gate; and a pin's day refused by the database (a
// race past the form's own check) is the form's day error. The sample backend's behaviour is admin-actions.test.ts's.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const ADMIN = { id: "admin-1", email: "a@vossie.net", firstName: "Ama", campusSlug: "pretoria", roles: ["admin"], seller: null, createdAt: "" };
const mocks = vi.hoisted(() => ({
  states: [] as { form: string; errors: string[]; notice: string | null }[],
  notices: [] as string[],
  tags: [] as string[],
  recordAudit: vi.fn(),
  notify: vi.fn(),
  closeReportsOn: vi.fn(),
  closeReportsAboutShop: vi.fn(),
  getReport: vi.fn(),
  staffPauseShop: vi.fn(),
  setVerified: vi.fn(),
  approveShop: vi.fn(),
  hideListing: vi.fn(),
  hideRequest: vi.fn(),
  addPin: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireLiveAccount: async () => ADMIN, getViewer: async () => ADMIN }));
vi.mock("@/lib/auth/form-state", () => ({
  writeFormState: async (form: string, state: { errors: string[]; notice: string | null }) => {
    mocks.states.push({ form, errors: state.errors, notice: state.notice });
  },
}));
vi.mock("./form-state", async (original) => ({
  ...(await original<typeof import("./form-state")>()),
  leaveNotice: async (code: string) => {
    mocks.notices.push(code);
  },
  clearStaffForm: async () => {},
}));
vi.mock("@/lib/data", () => ({
  getCampuses: async () => [{ slug: "pretoria", name: "Pretoria" }],
  getSeller: async () => null,
}));
vi.mock("@/lib/data/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/data/notifications", () => ({ notify: mocks.notify }));
vi.mock("@/lib/data/featured", () => ({ addPin: mocks.addPin, getPin: vi.fn(), removePin: vi.fn() }));
vi.mock("@/lib/data/pickup-points", () => ({}));
vi.mock("@/lib/data/requests", () => ({
  hideRequest: mocks.hideRequest,
  settleRequests: async () => 0,
  showRequest: vi.fn(),
}));
vi.mock("@/lib/data/staff-reports", () => ({
  closeReport: vi.fn(),
  closeReportsAboutShop: mocks.closeReportsAboutShop,
  closeReportsOn: mocks.closeReportsOn,
  getReport: mocks.getReport,
}));
vi.mock("@/lib/data/staff-shops", () => ({
  approveShop: mocks.approveShop,
  declineShop: vi.fn(),
  hideListing: mocks.hideListing,
  ownsListing: async () => false,
  ownsRequest: async () => false,
  ownsShop: async () => false,
  setShopMentor: vi.fn(),
  setVerified: mocks.setVerified,
  showListing: vi.fn(),
  staffPauseShop: mocks.staffPauseShop,
  staffResumeShop: vi.fn(),
}));
vi.mock("@/lib/data/tags", () => ({
  listingsChanged: () => mocks.tags.push("listings"),
  pickupPointsChanged: () => mocks.tags.push("pickup-points"),
  requestsChanged: () => mocks.tags.push("requests"),
  sellersChanged: () => mocks.tags.push("sellers"),
}));

const { approveSeller, hideReportedListing, hideReportedRequest, pauseSeller, pinSeller, verifySeller } = await import(
  "./admin-actions"
);

const REASON = "A reason the Hub gives, long enough to keep.";
const REPORT = "0b6f1c1e-7c1a-4e55-9c5e-2f2b7d0f9a11";
const DECISION = { slug: "lamps", name: "Lamps", ownerId: "owner-1" };

/** A report's view with Hide open: a listing's, or a request's. */
const reportOn = (kind: "listing" | "request") => ({
  id: REPORT,
  target: { kind, id: "target-1" },
  own: null,
  can: { hide: true, pause: false },
  shop: null,
});

beforeEach(() => {
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  resetRequest(request);
  mocks.states.length = 0;
  mocks.notices.length = 0;
  mocks.tags.length = 0;
  vi.clearAllMocks();
});

describe("the admin actions on Supabase (C4/C5 plan Task 16, decision 3)", () => {
  it("leave the audit entry, the report closes and the notifications to the staff function", async () => {
    mocks.staffPauseShop.mockResolvedValue(DECISION);
    expect((await redirectSignalOf(() => pauseSeller(form({ shop: "lamps", reason: REASON })))).url).toBe("/admin/sellers/lamps");
    mocks.getReport.mockResolvedValue(reportOn("listing"));
    mocks.hideListing.mockResolvedValue({ id: "target-1", title: "Lamp", sellerSlug: "lamps", state: "available", ownerId: "owner-1" });
    expect((await redirectSignalOf(() => hideReportedListing(form({ report: REPORT, reason: REASON })))).url).toBe("/admin/reports");
    for (const followUp of [mocks.recordAudit, mocks.notify, mocks.closeReportsOn, mocks.closeReportsAboutShop]) {
      expect(followUp).not.toHaveBeenCalled();
    }
    expect(mocks.tags).toEqual(["sellers", "listings"]);
    expect(mocks.notices).toEqual(["paused", "hidden"]);
  });

  it("turn the database's forbidden into the 404, writing nothing", async () => {
    mocks.approveShop.mockRejectedValue(new Refused("forbidden"));
    await expect(approveSeller(form({ shop: "lamps", owner: "owner-1" }))).rejects.toThrow("notFound");
    expect(mocks.notices).toEqual([]);
    expect(mocks.tags).toEqual([]);
  });

  it("turn the database's own-shop and own-request into the action's own refusal, expiring nothing", async () => {
    mocks.setVerified.mockRejectedValue(new Refused("own-shop"));
    expect((await redirectSignalOf(() => verifySeller(form({ shop: "lamps", verified: "yes" })))).url).toBe("/admin/sellers/lamps");
    mocks.getReport.mockResolvedValue(reportOn("request"));
    mocks.hideRequest.mockRejectedValue(new Refused("own-request"));
    expect((await redirectSignalOf(() => hideReportedRequest(form({ report: REPORT, reason: REASON })))).url).toBe(
      `/admin/reports/${REPORT}`,
    );
    expect(mocks.notices).toEqual(["own-shop", "own-request"]);
    expect(mocks.tags).toEqual([]);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("rethrow any other refusal", async () => {
    mocks.setVerified.mockRejectedValue(new Refused("message-rate"));
    await expect(verifySeller(form({ shop: "lamps", verified: "yes" }))).rejects.toThrow("Refused: message-rate");
  });

  it("show a pin day the database refuses as the form's day error", async () => {
    const day = sastDate(new Date());
    for (const code of ["day-past", "day-far"] as const) {
      mocks.states.length = 0;
      mocks.addPin.mockRejectedValue(new Refused(code));
      expect((await redirectSignalOf(() => pinSeller(form({ seller: "lamps", campus: "all", day })))).url).toBe("/admin/featured");
      expect(mocks.states).toEqual([{ form: "featured-pin", errors: [code], notice: null }]);
    }
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
