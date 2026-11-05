import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachOnHub } from "./CoachOnHub";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/coach/actions", () => ({ tickCoachAction: async () => {} }));

const state = vi.hoisted(() => ({
  account: null as { id: string } | null,
  shop: null as object | null,
  view: null as unknown,
  failing: false,
}));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => state.account }));
vi.mock("@/lib/data/shops", () => ({ getShopOf: async () => state.shop }));
vi.mock("@/lib/coach/this-week", () => ({
  readThisWeek: async () => {
    if (state.failing) throw new Error("The store didn't answer");
    return state.view;
  },
}));

const VIEW = { week: "2026-10-12", items: [], progress: { done: 0, total: 0 }, lastWeek: null };

beforeEach(() => {
  vi.stubEnv("VOSSIE_AI_SHOP_COACH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
});

afterEach(() => {
  vi.unstubAllEnvs();
  state.account = null;
  state.shop = null;
  state.view = null;
  state.failing = false;
});

describe("the Coach card on the Launchpad (AI stage I1, Task 10)", () => {
  it("reads nothing with the switch off", async () => {
    vi.stubEnv("VOSSIE_AI_SHOP_COACH", "");
    state.account = { id: "acc-seller" };
    state.shop = {};
    state.view = VIEW;
    expect(await CoachOnHub()).toBeNull();
  });

  it("is nothing signed out or without a shop", async () => {
    expect(await CoachOnHub()).toBeNull();
    state.account = { id: "acc-student" };
    expect(await CoachOnHub()).toBeNull();
  });

  it("is nothing when the week isn't there, or its read fails", async () => {
    state.account = { id: "acc-seller" };
    state.shop = { status: "approved" };
    expect(await CoachOnHub()).toBeNull();
    state.view = VIEW;
    state.failing = true;
    expect(await CoachOnHub()).toBeNull();
  });

  it("draws Your week for a seller with a view", async () => {
    state.account = { id: "acc-seller" };
    state.shop = { status: "approved" };
    state.view = VIEW;
    render((await CoachOnHub())!);
    expect(screen.getByRole("region", { name: "Your week" })).toBeInTheDocument();
  });
});
