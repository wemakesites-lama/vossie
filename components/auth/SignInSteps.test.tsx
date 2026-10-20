import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { SIGN_IN_POSTS } from "@/lib/auth/post-paths";
import { CodeStep, EmailStep, ProfileStep, SignedInNote, SignInUnavailable } from "./SignInSteps";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/auth/actions", () => ({
  cancelSignIn: async () => {},
  resendCode: async () => {},
  startSignIn: async () => {},
}));

const samples = [
  { email: "student@eduvos.com", label: "Student, Midrand" },
  { email: "admin@eduvos.com", label: "Admin" },
];

const hiddenNext = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="next"]')].map((input) => input.value);

describe("step 1, the email (accounts spec 3.1)", () => {
  it("asks for an Eduvos email and the privacy policy box, then Send code", () => {
    render(<EmailStep next={null} email="" consented={false} errors={[]} samples={null} />);
    const email = screen.getByLabelText("Your Eduvos email address");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAccessibleDescription("We'll send you a 6-digit code to sign in.");
    expect(screen.getByRole("checkbox", { name: "I agree to the privacy policy" })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("button", { name: "Send code" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("region", { name: "Sign in as a sample account" })).toBeNull();
  });

  it("shows errors in a summary and under their fields, keeping what was typed", () => {
    render(
      <EmailStep
        next={null}
        email="thandi@gmail.com"
        consented
        errors={[{ message: "Use your Eduvos email address.", fieldId: "signin-email" }]}
        samples={null}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    const email = screen.getByLabelText("Your Eduvos email address");
    expect(email).toHaveValue("thandi@gmail.com");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      "We'll send you a 6-digit code to sign in. Error: Use your Eduvos email address.",
    );
    expect(screen.getByRole("checkbox", { name: "I agree to the privacy policy" })).toBeChecked();
  });

  it("offers the sample accounts in sample mode (spec 2.8), each posting its email", () => {
    render(<EmailStep next={null} email="" consented={false} errors={[]} samples={samples} />);
    const buttons = within(screen.getByRole("region", { name: "Sign in as a sample account" })).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Student, Midrand", "Admin"]);
    expect(buttons[0]).toHaveAttribute("name", "email");
    expect(buttons[0]).toHaveAttribute("value", "student@eduvos.com");
    // A plain post to a Route Handler, which answers 303: a full page load (stage K spec decision 2).
    const list = buttons[0].closest("form")!;
    expect([list.getAttribute("action"), list.getAttribute("method")]).toEqual([SIGN_IN_POSTS.sample, "post"]);
  });

  it("carries next through both of its forms, and nothing when there's none", () => {
    const { container, unmount } = render(
      <EmailStep next="/listings/l-001" email="" consented={false} errors={[]} samples={samples} />,
    );
    expect(hiddenNext(container)).toEqual(["/listings/l-001", "/listings/l-001"]);
    unmount();
    const again = render(<EmailStep next={null} email="" consented={false} errors={[]} samples={samples} />);
    expect(hiddenNext(again.container)).toEqual([]);
  });
});

describe("step 2, the code (accounts spec 3.1)", () => {
  const props = { next: null, maskedEmail: "t•••@eduvos.com", errors: [], resent: false, sampleCode: null };
  const wrong = [{ message: "That code isn't right. 4 tries left.", fieldId: "signin-code" }];

  it("says where the code went, and asks for it", () => {
    render(<CodeStep {...props} />);
    const code = screen.getByLabelText("6-digit code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAccessibleDescription("We sent a code to t•••@eduvos.com. It lasts 10 minutes.");
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute("type", "submit");
    const signIn = screen.getByRole("button", { name: "Sign in" }).closest("form")!;
    expect([signIn.getAttribute("action"), signIn.getAttribute("method")]).toEqual([SIGN_IN_POSTS.code, "post"]);
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use a different email" })).toBeInTheDocument();
    expect(screen.queryByText(/Sample mode/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the code in sample mode (spec 2.3), and says when a new one was sent", () => {
    render(<CodeStep {...props} sampleCode="042137" resent />);
    expect(screen.getByText(/Sample mode: your code is/)).toHaveTextContent("Sample mode: your code is 042137");
    expect(screen.getByRole("status")).toHaveTextContent("We sent a new code.");
  });

  it("shows a wrong code's error under the field too", () => {
    render(<CodeStep {...props} errors={wrong} />);
    const code = screen.getByLabelText("6-digit code");
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription(
      "We sent a code to t•••@eduvos.com. It lasts 10 minutes. Error: That code isn't right. 4 tries left.",
    );
  });

  it("puts you in the code field, unless there's an error to read first (plan decision 11)", () => {
    expect(renderToString(<CodeStep {...props} />)).toMatch(/<input[^>]*id="signin-code"[^>]*autofocus=""/);
    const withError = renderToString(<CodeStep {...props} errors={wrong} />);
    expect(withError).not.toMatch(/<input[^>]*autofocus=""/);
    expect(withError).toMatch(/<div[^>]*role="alert"[^>]*autofocus=""/);
  });

  it("carries next through all three of its forms", () => {
    const { container } = render(<CodeStep {...props} next="/saved" />);
    expect(hiddenNext(container)).toEqual(["/saved", "/saved", "/saved"]);
  });
});

describe("step 3, first sign-in (accounts spec 3.1)", () => {
  it("asks for a first name and a campus, starting on the campus given", () => {
    render(<ProfileStep next={null} firstName="" campus="pretoria" campuses={campuses} errors={[]} />);
    const name = screen.getByLabelText("Your first name");
    expect(name).toHaveAttribute("autocomplete", "given-name");
    expect(name).toHaveAttribute("maxlength", "40");
    expect(name).toHaveAccessibleDescription("Sellers see it when you message them. 2 to 40 characters.");
    expect(screen.getByRole("combobox", { name: "Your campus" })).toHaveValue("pretoria");
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("type", "submit");
    const step3 = screen.getByRole("button", { name: "Continue" }).closest("form")!;
    expect([step3.getAttribute("action"), step3.getAttribute("method")]).toEqual([SIGN_IN_POSTS.profile, "post"]);
  });

  it("shows its errors and keeps what was typed", () => {
    render(
      <ProfileStep
        next={null}
        firstName="A"
        campus=""
        campuses={campuses}
        errors={[
          { message: "Your first name must be 2 to 40 characters.", fieldId: "signin-first-name" },
          { message: "Choose your campus.", fieldId: "signin-campus" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Your first name")).toHaveValue("A");
    const campus = screen.getByRole("combobox", { name: "Your campus" });
    expect(campus).toHaveValue("");
    expect(campus).toHaveAttribute("aria-invalid", "true");
    expect(campus).toHaveAccessibleDescription("Error: Choose your campus.");
    expect(within(screen.getByRole("alert")).getAllByRole("link")).toHaveLength(2);
  });
});

describe("the other states (accounts spec 2.1 and 3.1)", () => {
  it("says who's signed in, with plain links on to next and to the account (stage K spec decision 5)", () => {
    const { unmount } = render(<SignedInNote email="student@eduvos.com" next="/looking-for/new" />);
    expect(screen.getByText(/You're signed in as/)).toHaveTextContent("You're signed in as student@eduvos.com.");
    const onward = screen.getByRole("link", { name: "Continue" });
    expect(onward).toHaveAttribute("href", "/looking-for/new");
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
    // Plain anchors, not Next's Link: a full page load, so no kept redirect can catch them.
    expect(onward.tagName).toBe("A");
    expect(onward).not.toHaveAttribute("data-prefetch");
    unmount();
  });

  it("has no Continue without a next, under /login, the account itself or a public page (plan decision 12, amendment 8)", () => {
    for (const next of [null, "/login?next=%2Fsaved", "/account", "/sellers/tech-corner"]) {
      const { unmount } = render(<SignedInNote email="student@eduvos.com" next={next} />);
      expect(screen.queryByRole("link", { name: "Continue" })).toBeNull();
      expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
      unmount();
    }
  });

  it("says sign-in isn't available with sample mode off (plan decision 17)", () => {
    render(<SignInUnavailable />);
    expect(screen.getByText(/Sign-in isn't available yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
  });
});
