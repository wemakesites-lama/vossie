import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import { reportForm, ReportView } from "./ReportView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/messaging/actions", () => ({ sendReport: async () => {} }));

const LISTING = { kind: "listing", id: "l-001" } as const;
const SUBJECT = { title: "Casio fx-991ZA Plus calculator", href: "/listings/l-001", backLabel: "Back to the listing" };

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "s:report:listing:l-001",
  sessionKey: "s",
  form: "report:listing:l-001",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

describe("the report form (messaging spec 3.4)", () => {
  it("names what's reported, and asks why with seven reasons and an optional detail", () => {
    const { container } = render(<ReportView target={LISTING} subject={SUBJECT} already={false} form={reportForm(null)} />);
    expect(screen.getByRole("heading", { level: 1, name: "Report this listing" })).toBeInTheDocument();
    expect(screen.getByText("Casio fx-991ZA Plus calculator")).toHaveClass("report-subject");
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listings/l-001");
    const reasons = screen.getByRole("group", { name: "Why are you reporting it?" });
    expect(within(reasons).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "scam",
      "prohibited",
      "misleading",
      "offensive",
      "harassment",
      "spam",
      "other",
    ]);
    expect(within(reasons).getByRole("radio", { name: "Scam or fraud" })).not.toBeChecked();
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveAccessibleDescription(/^Up to 500 characters\./);
    expect(screen.getByRole("button", { name: "Send report" })).toHaveAttribute("type", "submit");
    expect(
      [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => [input.name, input.value]),
    ).toEqual([
      ["kind", "listing"],
      ["id", "l-001"],
    ]);
  });

  it("says what's wrong after a failed post, keeping the reason and the detail", () => {
    render(
      <ReportView
        target={LISTING}
        subject={SUBJECT}
        already={false}
        form={reportForm(state({ errors: ["detail-length"], values: { reason: "spam", detail: "z".repeat(501) } }))}
      />,
    );
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveAttribute("id", "report-summary");
    expect(summary).toHaveTextContent("Keep it under 500 characters.");
    expect(screen.getByRole("radio", { name: "Spam" })).toBeChecked();
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveValue("z".repeat(501));
  });

  it("links a missing reason to the first reason, and marks the group", () => {
    render(
      <ReportView
        target={{ kind: "seller", id: "tech-corner" }}
        subject={{ title: "Tech corner", href: "/sellers/tech-corner", backLabel: "Back to the shop" }}
        already={false}
        form={reportForm(state({ errors: ["reason-missing", "report-rate"] }))}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Report this seller" })).toBeInTheDocument();
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getByRole("link", { name: "Choose a reason." })).toHaveAttribute("href", "#report-reason-scam");
    // The limit says what it counts (amendment 3.7).
    expect(within(summary).getByText("You've sent 10 reports in the last 24 hours. Try again later.").tagName).toBe("LI");
    expect(screen.getByRole("group", { name: "Why are you reporting it?" })).toHaveAccessibleDescription(
      "Error: Choose a reason.",
    );
  });

  it("says when the visitor has reported it already, with no form (plan decision 17)", () => {
    render(<ReportView target={LISTING} subject={SUBJECT} already form={reportForm(null)} />);
    expect(
      screen.getByText("You've reported this listing already. The Hub reviews reports within two working days."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  });
});
