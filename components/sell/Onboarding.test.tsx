import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft, saveOnboardingDraft } from "@/lib/data/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf } from "@/tests/helpers/next-request";
import { Onboarding } from "./Onboarding";

const viewer = vi.hoisted(() => ({ id: null as string | null }));

vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
// The session is the sample account named here; requireAccount sends anyone else to sign in, as D's does.
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  const { redirect } = await import("next/navigation");
  const { signInHref } = await import("@/lib/next-path");
  const getViewer = async () => (viewer.id ? getAccount(viewer.id) : null);
  return {
    getViewer,
    getSessionKey: async () => null,
    requireAccount: async (next: string) => (await getViewer()) ?? redirect(signInHref(next)),
  };
});
vi.mock("@/lib/selling/shop-actions", () => ({ saveOnboardingStep: async () => {}, sendForApproval: async () => {} }));

const at = (step: string) => ({ searchParams: Promise.resolve({ step }) });

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
});

describe("the wizard's request-time part (selling spec 2.6 and section 3)", () => {
  it("sends a signed-out visitor to sign in, coming back to the same step", async () => {
    expect(await redirectOf(() => Onboarding(at("3")))).toBe("/login?next=%2Fsell%2Fonboarding%3Fstep%3D3");
  });

  it("sends anyone who already has a shop to /sell", async () => {
    viewer.id = "acc-pending";
    expect(await redirectOf(() => Onboarding(at("1")))).toBe("/sell");
  });

  it("starts a new application on the account's campus", async () => {
    viewer.id = "acc-student";
    render(await Onboarding(at("4")));
    expect(screen.getByRole("group", { name: "Pickup points at Midrand" })).toBeInTheDocument();
  });

  it("says when a point the draft saved has been retired since (staff tools plan amendment 13)", async () => {
    viewer.id = "acc-student";
    const now = new Date("2026-10-14T08:00:00.000Z");
    await saveOnboardingDraft({ ...emptyDraft("acc-student", "midrand", now), pickupPointIds: ["pp-midrand-library"] });
    sampleStore().pickupPoints.get("pp-midrand-library")!.retiredAt = now.toISOString();
    render(await Onboarding(at("4")));
    const spots = screen.getByRole("group", { name: "Pickup points at Midrand" });
    expect(spots).toHaveAccessibleDescription(/Library entrance is no longer used: choose another\.$/);
    expect(within(spots).getAllByRole("checkbox").map((box) => box.getAttribute("value"))).toEqual(["pp-midrand-reception"]);
  });
});
