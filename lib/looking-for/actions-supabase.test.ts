import { beforeEach, describe, expect, it, vi } from "vitest";
import { Refused } from "@/lib/data/refused";
import type { LookingForRequest } from "@/lib/types";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";

// The Looking For actions on Supabase (C4/C5 plan Task 6; decisions 6 and 7, amendment 11), with lib/data mocked:
// save_request takes the one-time token itself, so saveMyRequest passes it on instead of taking it, and reads the
// database's refusals as takeOnceToken's answers and the limits' errors; Reopen and Send offer show a race past their
// own counts as their own checks would. The sample backend's behaviour is actions.test.ts's.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const ACCOUNT = { id: "user-1", email: "a@vossie.net", firstName: "A", campusSlug: "pretoria", roles: [], seller: null, createdAt: "" };
const mocks = vi.hoisted(() => ({
  states: [] as { form: string; errors: string[]; values: Record<string, string>; notice: string | null }[],
  createRequest: vi.fn(),
  setRequestOpen: vi.fn(),
  getOwnRequest: vi.fn(),
  takeOnceToken: vi.fn(),
  sentOnceToken: vi.fn(),
  leaveOnceToken: vi.fn(),
  startOffer: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireAccount: async () => ACCOUNT }));
vi.mock("@/lib/auth/form-state", () => ({
  writeFormState: async (form: string, state: { errors: string[]; values: Record<string, string>; notice: string | null }) => {
    mocks.states.push({ form, ...state });
  },
}));
vi.mock("@/lib/messaging/form-state", () => ({ clearOwnFormState: async () => {} }));
vi.mock("@/lib/data", () => ({
  getCategories: async () => [{ slug: "tech", name: "Tech" }],
  getCampuses: async () => [{ slug: "pretoria", name: "Pretoria" }],
}));
vi.mock("@/lib/data/requests", () => ({
  settleRequests: async () => 0,
  countOpenRequests: async () => 0,
  countRequestsSince: async () => 0,
  createRequest: mocks.createRequest,
  updateRequest: vi.fn(),
  getOwnRequest: mocks.getOwnRequest,
  setRequestOpen: mocks.setRequestOpen,
  deleteRequest: vi.fn(),
}));
vi.mock("@/lib/staff/once", async (original) => ({
  ...(await original<typeof import("@/lib/staff/once")>()),
  takeOnceToken: mocks.takeOnceToken,
  sentOnceToken: mocks.sentOnceToken,
  leaveOnceToken: mocks.leaveOnceToken,
}));
vi.mock("@/lib/data/messages", () => ({ startOffer: mocks.startOffer }));
vi.mock("@/lib/data/offers", () => ({ countOffersSince: async () => 0 }));
vi.mock("@/lib/messaging/limits", () => ({ messageLimitErrors: async () => [] }));
vi.mock("./subjects", () => ({
  offerSubject: async () => ({ request: { id: "r-1", title: "A desk lamp" }, campusName: "Pretoria" }),
  offerStatus: async () => ({ kind: "open", askerId: "asker-1", shopSlug: "lamps", listings: [] }),
}));

const { closeMyRequest, reopenMyRequest, saveMyRequest, sendOffer } = await import("./actions");

const TOKEN = "0b6f1c1e-7c1a-4e55-9c5e-2f2b7d0f9a11";
const FORM = {
  title: "Desk lamp for res",
  category: "tech",
  campus: "pretoria",
  details: "A lamp that clips onto a desk, by the weekend.",
  budget: "R150",
  neededBy: "",
  once: TOKEN,
};
const POSTED = { id: "r-new" } as LookingForRequest;

beforeEach(() => {
  vi.stubEnv("VOSSIE_BACKEND", "supabase");
  resetRequest(request);
  mocks.states.length = 0;
  for (const fn of [mocks.createRequest, mocks.setRequestOpen, mocks.getOwnRequest, mocks.takeOnceToken, mocks.sentOnceToken, mocks.leaveOnceToken, mocks.startOffer]) {
    fn.mockReset();
  }
  mocks.sentOnceToken.mockResolvedValue(null);
});

describe("Post request on Supabase (C4/C5 plan decision 6)", () => {
  it("doesn't take the token itself, and passes it to createRequest", async () => {
    mocks.createRequest.mockResolvedValue(POSTED);
    expect((await redirectSignalOf(() => saveMyRequest(form(FORM)))).url).toBe("/looking-for/r-new");
    expect(mocks.takeOnceToken).not.toHaveBeenCalled();
    expect(mocks.createRequest).toHaveBeenCalledWith(expect.objectContaining({ askerId: "user-1", onceToken: TOKEN }));
    expect(mocks.leaveOnceToken).toHaveBeenCalledWith(TOKEN, { path: "/looking-for/r-new", notice: "posted" }, expect.any(Date));
  });

  it("goes where the first post went when the database says the token was taken", async () => {
    mocks.createRequest.mockRejectedValue(new Refused("once-taken"));
    mocks.sentOnceToken.mockResolvedValueOnce(null).mockResolvedValueOnce({ path: "/looking-for/r-first", notice: "posted" });
    expect((await redirectSignalOf(() => saveMyRequest(form(FORM)))).url).toBe("/looking-for/r-first");
    expect(mocks.states).toEqual([]);
  });

  it("or to Your requests while the first is still saving", async () => {
    mocks.createRequest.mockRejectedValue(new Refused("once-taken"));
    expect((await redirectSignalOf(() => saveMyRequest(form(FORM)))).url).toBe("/account/requests");
  });

  it("gives a made-up or run-out token the form's form-expired error, with what was typed", async () => {
    mocks.createRequest.mockRejectedValue(new Refused("once-expired"));
    expect((await redirectSignalOf(() => saveMyRequest(form(FORM)))).url).toBe("/looking-for/new");
    expect(mocks.states).toEqual([
      expect.objectContaining({ errors: ["form-expired"], values: expect.objectContaining({ title: "Desk lamp for res" }) }),
    ]);
  });

  it("shows a limit the database met first as the form's own error", async () => {
    for (const code of ["open-limit", "daily-limit"] as const) {
      mocks.states.length = 0;
      mocks.createRequest.mockRejectedValue(new Refused(code));
      expect((await redirectSignalOf(() => saveMyRequest(form(FORM)))).url).toBe("/looking-for/new");
      expect(mocks.states).toEqual([expect.objectContaining({ errors: [code] })]);
    }
  });

  it("rethrows anything else", async () => {
    mocks.createRequest.mockRejectedValue(new Refused("forbidden"));
    await expect(saveMyRequest(form(FORM))).rejects.toThrow("Refused: forbidden");
    mocks.createRequest.mockRejectedValue(new Error("save_request failed (500)"));
    await expect(saveMyRequest(form(FORM))).rejects.toThrow("save_request failed");
  });
});

describe("Close and Reopen on Supabase (C4/C5 plan decision 7)", () => {
  it("leaves the reopen-limit note when the database counts 5 open first", async () => {
    mocks.getOwnRequest.mockResolvedValue({ state: "closed" });
    mocks.setRequestOpen.mockRejectedValue(new Refused("reopen-limit"));
    expect((await redirectSignalOf(() => reopenMyRequest(form({ request: "r-1" })))).url).toBe("/looking-for/r-1");
    expect(mocks.states).toEqual([expect.objectContaining({ form: "request-note:r-1", notice: "reopen-limit" })]);
  });

  it("rethrows any other refusal", async () => {
    mocks.setRequestOpen.mockRejectedValue(new Refused("forbidden"));
    await expect(closeMyRequest(form({ request: "r-1" }))).rejects.toThrow("Refused: forbidden");
  });
});

describe("Send offer on Supabase (C4/C5 plan amendment 11)", () => {
  it("shows the database's offer-rate or message-rate as the form's own error, with what was typed", async () => {
    for (const code of ["offer-rate", "message-rate"] as const) {
      mocks.states.length = 0;
      mocks.startOffer.mockRejectedValue(new Refused(code));
      expect((await redirectSignalOf(() => sendOffer(form({ request: "r-1", body: "I have one, R120." })))).url).toBe(
        "/looking-for/r-1/offer",
      );
      expect(mocks.states).toEqual([
        expect.objectContaining({ form: "offer:r-1", errors: [code], values: { body: "I have one, R120.", listing: "" } }),
      ]);
    }
  });

  it("rethrows any other refusal", async () => {
    mocks.startOffer.mockRejectedValue(new Refused("closed"));
    await expect(sendOffer(form({ request: "r-1", body: "I have one, R120." }))).rejects.toThrow("Refused: closed");
  });
});
