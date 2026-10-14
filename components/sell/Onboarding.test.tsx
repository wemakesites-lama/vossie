import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveFormState } from "@/lib/data/form-states";
import { resetSampleStore } from "@/lib/data/store";
import { onboardingForm } from "@/lib/selling/form-state";
import { redirectOf } from "@/tests/helpers/next-request";
import { Onboarding } from "./Onboarding";

const viewer = vi.hoisted(() => ({ id: null as string | null, sessionKey: null as string | null }));

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
    getSessionKey: async () => viewer.sessionKey,
    requireAccount: async (next: string) => (await getViewer()) ?? redirect(signInHref(next)),
  };
});
vi.mock("@/lib/selling/shop-actions", () => ({ saveOnboardingStep: async () => {}, sendForApproval: async () => {} }));

const at = (step: string) => ({ searchParams: Promise.resolve({ step }) });

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
  viewer.sessionKey = null;
});

/** What the last post to `step` left in this browser's form state. */
const leave = (step: 1 | 2 | 3 | 4 | 5, errors: string[]) =>
  saveFormState(
    { sessionKey: "s", form: onboardingForm(step), errors, values: {}, notice: null, expiresAt: "2099-01-01T00:00:00.000Z" },
    new Date("2026-10-14T08:00:00.000Z"),
  );

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

  it("shows the errors the step's last post left, linked to their fields", async () => {
    viewer.id = "acc-student";
    viewer.sessionKey = "s";
    await leave(1, ["name-length", "category-missing"]);
    render(await Onboarding(at("1")));
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveAttribute("id", "onb-step-1-summary");
    expect(screen.getByRole("link", { name: "Your shop's name must be 2 to 60 characters." })).toHaveAttribute(
      "href",
      "#onb-name",
    );
    expect(screen.getByRole("combobox", { name: "Main category" })).toHaveAttribute("aria-invalid", "true");
  });

  it("shows only the errors of the step it is on", async () => {
    viewer.id = "acc-student";
    viewer.sessionKey = "s";
    await leave(1, ["name-length"]);
    render(await Onboarding(at("2")));
    expect(screen.queryByRole("alert", { name: "There's a problem" })).toBeNull();
  });

  it("shows step 5 the error Send for approval leaves when no shop was made, with no link", async () => {
    viewer.id = "acc-student";
    viewer.sessionKey = "s";
    await leave(5, ["send-failed"]);
    render(await Onboarding(at("5")));
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveAttribute("id", "onb-step-5-summary");
    expect(summary).toHaveTextContent("Something went wrong, so your application wasn't sent. Try again.");
    expect(screen.queryByRole("link", { name: /Something went wrong/ })).toBeNull();
  });

  it("reads a link that names no step as step 1", async () => {
    viewer.id = "acc-student";
    render(await Onboarding({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Step 1 of 5: Basics")).toBeInTheDocument();
  });
});
