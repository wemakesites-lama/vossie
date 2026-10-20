import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignInView } from "@/lib/auth/sign-in-view";
import { SignIn } from "./SignIn";

const STEP_1: SignInView = { step: "email", email: "", consented: false, errors: [] };
const view = vi.hoisted(() => ({ current: null as SignInView | null }));

vi.mock("@/lib/auth/sign-in-view", () => ({ getSignInView: async () => view.current }));

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/auth/actions", () => ({
  cancelSignIn: async () => {},
  resendCode: async () => {},
  startSignIn: async () => {},
}));

afterEach(() => {
  view.current = null;
  vi.unstubAllEnvs();
});

describe("SignIn (accounts spec 3.1)", () => {
  it("shows step 1 with the five sample accounts in sample mode", async () => {
    view.current = STEP_1;
    render(await SignIn({ next: "/saved" }));
    expect(screen.getByLabelText("Your Eduvos email address")).toBeInTheDocument();
    const samples = screen.getByRole("region", { name: "Sign in as a sample account" });
    expect(within(samples).getAllByRole("button")).toHaveLength(5);
  });

  it("leaves the sample accounts out with sample mode off", async () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    view.current = STEP_1;
    render(await SignIn({ next: null }));
    expect(screen.queryByRole("region", { name: "Sign in as a sample account" })).toBeNull();
  });

  it("shows the step the attempt is on", async () => {
    view.current = { step: "code", maskedEmail: "t•••@eduvos.com", errors: [], resent: false, sampleCode: "042137" };
    const { unmount } = render(await SignIn({ next: null }));
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
    unmount();
    view.current = { step: "profile", firstName: "", campus: "", errors: [] };
    render(await SignIn({ next: null }));
    expect(screen.getByRole("combobox", { name: "Your campus" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(14);
  });

  it("says who's signed in, or that sign-in isn't available", async () => {
    view.current = { step: "signed-in", email: "student@eduvos.com" };
    const { unmount } = render(await SignIn({ next: "/looking-for/new" }));
    expect(screen.getByText(/You're signed in as/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/looking-for/new");
    unmount();
    view.current = { step: "unavailable" };
    render(await SignIn({ next: null }));
    expect(screen.getByText(/Sign-in isn't available yet/)).toBeInTheDocument();
  });
});
