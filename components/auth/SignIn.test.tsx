import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formErrors, SIGN_IN_FIELDS } from "@/lib/auth/messages";
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

  it("leaves the sample accounts out on Supabase, whatever VOSSIE_SAMPLE_MODE says (Supabase phase B, decision 1)", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "1");
    view.current = STEP_1;
    render(await SignIn({ next: null }));
    expect(screen.getByLabelText("Your Eduvos email address")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sign in as a sample account" })).toBeNull();
  });

  it("shows step 2 with no sample line when the view has no sample code (Supabase)", async () => {
    view.current = { step: "code", maskedEmail: "t•••@vossie.net", errors: [], resent: false, sampleCode: null };
    render(await SignIn({ next: null }));
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
    expect(screen.queryByText(/Sample mode/)).toBeNull();
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

describe("the sign-in card on Supabase (Supabase phase B, Task 8)", () => {
  const REFUSALS = ["code-soon", "ip-rate", "send-failed"];
  const WORDS = [
    "We sent you a code less than a minute ago. Wait a minute, then ask again.",
    "Too many sign-ins from your network just now. Try again in a few minutes.",
    "We couldn't send the code just now. Try again in a few minutes.",
  ];

  it("has nothing about sample accounts or sample codes on any step", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    for (const current of [
      STEP_1,
      { step: "code", maskedEmail: "t•••@vossie.net", errors: [], resent: true, sampleCode: null },
      { step: "profile", firstName: "", campus: "", errors: [] },
    ] satisfies SignInView[]) {
      view.current = current;
      const { container, unmount } = render(await SignIn({ next: "/saved" }));
      expect(container.innerHTML).not.toMatch(/sample/i);
      unmount();
    }
  });

  it("lists Supabase's refusals on step 1, each linked to the email field", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    view.current = { ...STEP_1, email: "thandi@vossie.net", consented: true, errors: formErrors(REFUSALS, SIGN_IN_FIELDS) };
    render(await SignIn({ next: null }));
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      WORDS.map((words) => [words, `#${SIGN_IN_FIELDS.email}`]),
    );
  });

  it("lists them at the top of step 2, which has no email field, without links", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    view.current = {
      step: "code",
      maskedEmail: "t•••@vossie.net",
      errors: formErrors(REFUSALS, { code: SIGN_IN_FIELDS.code }),
      resent: false,
      sampleCode: null,
    };
    render(await SignIn({ next: null }));
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).queryAllByRole("link")).toEqual([]);
    expect(within(summary).getAllByRole("listitem").map((item) => item.textContent)).toEqual(WORDS);
    expect(screen.getByLabelText("6-digit code")).not.toHaveAttribute("aria-invalid", "true");
  });
});
