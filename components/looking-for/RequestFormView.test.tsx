import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { RequestLocked, RequestFormView, requestForm, startValues } from "./RequestFormView";

vi.mock("@/lib/looking-for/actions", () => ({ saveMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const EMPTY = startValues(null, "midrand");
const TODAY = "2026-10-14";
const TOKEN = "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55";

describe("the request form (community actions spec 2.3 and section 4)", () => {
  it("labels every field, with its limits as text, and starts on the account's campus", () => {
    render(
      <RequestFormView
        requestId={null}
        once={TOKEN}
        form={{ values: EMPTY, errors: [] }}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Ask for what you need" })).toBeInTheDocument();
    expect(screen.getByLabelText("What you need")).toHaveAccessibleDescription(
      'Between 5 and 70 characters, like "Accounting 1 tutor this week".',
    );
    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(screen.getByLabelText("Campus")).toHaveValue("midrand");
    expect(screen.getByLabelText("Details")).toHaveAccessibleDescription(
      "Say what you need and when. Shops will message you on Vossie. Between 20 and 600 characters.",
    );
    expect(screen.getByLabelText("Budget in rand (optional)")).toHaveAccessibleDescription(
      "Whole rand, like 300. Leave it empty for Open to offers.",
    );
    expect(screen.getByLabelText("A swap is welcome")).not.toBeChecked();
    const date = screen.getByLabelText("Needed by (optional)");
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveAttribute("min", "2026-10-14");
    expect(date).toHaveAttribute("max", "2027-01-12");
    expect(screen.getByRole("button", { name: "Post request" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Back to Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(document.querySelector('input[name="request"]')).toBeNull();
  });

  it("carries a new request's one-time token, so it's made once however many times the form is sent (amendment 3)", () => {
    render(
      <RequestFormView
        requestId={null}
        once={TOKEN}
        form={{ values: EMPTY, errors: [] }}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    expect(document.querySelector('input[name="once"]')).toHaveAttribute("type", "hidden");
    expect(document.querySelector('input[name="once"]')).toHaveValue(TOKEN);
  });

  it("has no token field without a token, and none on an edit, which needs none", () => {
    const { unmount } = render(
      <RequestFormView
        requestId={null}
        once={null}
        form={{ values: EMPTY, errors: [] }}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    expect(document.querySelector('input[name="once"]')).toBeNull();
    unmount();
    render(
      <RequestFormView
        requestId="r-abc"
        once={TOKEN}
        form={{ values: EMPTY, errors: [] }}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    expect(document.querySelector('input[name="once"]')).toBeNull();
  });

  it("fills an edit with the request, and posts its id", () => {
    const values = startValues(
      {
        id: "r-abc",
        title: "Desk lamp for res",
        campusSlug: "pretoria",
        offers: 0,
        details: "A lamp that clips onto a desk.\nBy the weekend.",
        categorySlug: "res-living",
        budgetZar: 150,
        swapWelcome: true,
        neededBy: "2026-10-20",
        createdAt: "2026-10-14T08:42:00.000Z",
        status: "open",
      },
      "midrand",
    );
    render(
      <RequestFormView
        requestId="r-abc"
        once={null}
        form={{ values, errors: [] }}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Edit your request" })).toBeInTheDocument();
    expect(screen.getByLabelText("What you need")).toHaveValue("Desk lamp for res");
    expect(screen.getByLabelText("Category")).toHaveValue("res-living");
    expect(screen.getByLabelText("Campus")).toHaveValue("pretoria");
    expect(screen.getByLabelText("Details")).toHaveValue("A lamp that clips onto a desk.\nBy the weekend.");
    expect(screen.getByLabelText("Budget in rand (optional)")).toHaveValue("150");
    expect(screen.getByLabelText("A swap is welcome")).toBeChecked();
    expect(screen.getByLabelText("Needed by (optional)")).toHaveValue("2026-10-20");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(document.querySelector('input[name="request"]')).toHaveValue("r-abc");
    expect(screen.getByLabelText("What you need")).toHaveAttribute("id", "request-r-abc-title");
  });

  it("shows what was typed and what's wrong after a failed post, each error linked to its field", () => {
    const form = requestForm(
      {
        key: "s:request:new",
        sessionKey: "s",
        form: "request:new",
        errors: ["title-contact", "budget-invalid"],
        values: { title: "Call 0821234567", category: "tech", campus: "midrand", details: "", budget: "lots", swap: "yes", neededBy: "" },
        notice: null,
        expiresAt: "2026-10-14T08:52:00.000Z",
      },
      EMPTY,
      "request-new",
    );
    render(
      <RequestFormView
        requestId={null}
        once={TOKEN}
        form={form}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveAttribute("id", "request-new-summary");
    expect(within(summary).getByRole("link", { name: /Take out the phone number or email/ })).toHaveAttribute(
      "href",
      "#request-new-title",
    );
    expect(screen.getByLabelText("What you need")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("What you need")).toHaveValue("Call 0821234567");
    expect(screen.getByLabelText("Budget in rand (optional)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("A swap is welcome")).toBeChecked();
    expect(screen.getByLabelText("Category")).toHaveValue("tech");
  });

  it("lists an expired form's error in the summary, linked to no field, and keeps what was typed (amendment 3)", () => {
    const form = requestForm(
      {
        key: "s:request:new",
        sessionKey: "s",
        form: "request:new",
        errors: ["form-expired"],
        values: { title: "Desk lamp for res", category: "res-living", campus: "pretoria", details: "", budget: "", swap: "", neededBy: "" },
        notice: null,
        expiresAt: "2026-10-14T08:52:00.000Z",
      },
      EMPTY,
      "request-new",
    );
    render(
      <RequestFormView
        requestId={null}
        once={TOKEN}
        form={form}
        campuses={campuses}
        categories={categories}
        today={TODAY}
      />,
    );
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getByText("This form has expired. Check it and send it again.")).toBeInTheDocument();
    expect(within(summary).queryByRole("link")).toBeNull();
    expect(screen.getByLabelText("What you need")).toHaveValue("Desk lamp for res");
    expect(screen.getByLabelText("What you need")).not.toHaveAttribute("aria-invalid");
    expect(document.querySelector('input[name="once"]')).toHaveValue(TOKEN);
  });

  it("starts from the request, not old form state, when the last post went through", () => {
    expect(requestForm(null, EMPTY, "request-new")).toEqual({ values: EMPTY, errors: [] });
  });

  it("says why a closed or hidden request can't be changed", () => {
    const { unmount } = render(<RequestLocked requestId="r-abc" title="Desk lamp for res" state="closed" />);
    expect(screen.getByText("This request is closed. Reopen it to change it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).toHaveAttribute("type", "submit");
    unmount();
    render(<RequestLocked requestId="r-abc" title="Desk lamp for res" state="hidden" />);
    expect(screen.getByText(/The Hub hid this request, so it can't be changed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your requests" })).toHaveAttribute("href", "/account/requests");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
