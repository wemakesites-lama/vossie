import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import type { ReportTarget } from "@/lib/types";
import { reportForm, ReportView } from "./ReportView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/messaging/actions", () => ({ sendReport: async () => {} }));

const LISTING: ReportTarget = { kind: "listing", id: "l-001" };
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
    const { container } = render(
      <ReportView target={LISTING} subject={SUBJECT} already={false} form={reportForm(null, LISTING)} />,
    );
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

  it("starts every field's id with what's reported, so two kept report forms never share one (plan amendment 5)", () => {
    const { container } = render(
      <ReportView target={LISTING} subject={SUBJECT} already={false} form={reportForm(null, LISTING)} />,
    );
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((radio) => radio.id)).toEqual([
      "report-reason-listing-l-001-scam",
      "report-reason-listing-l-001-prohibited",
      "report-reason-listing-l-001-misleading",
      "report-reason-listing-l-001-offensive",
      "report-reason-listing-l-001-harassment",
      "report-reason-listing-l-001-spam",
      "report-reason-listing-l-001-other",
    ]);
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveAttribute("id", "report-detail-listing-l-001");
  });

  it("gives its error summary its own id (messaging plan amendment 1)", () => {
    render(
      <ReportView
        target={LISTING}
        subject={SUBJECT}
        already={false}
        form={reportForm(state({ errors: ["reason-missing"] }), LISTING)}
      />,
    );
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "report-summary");
  });

  it("says what's wrong after a failed post, keeping the reason and the detail", () => {
    render(
      <ReportView
        target={LISTING}
        subject={SUBJECT}
        already={false}
        form={reportForm(state({ errors: ["detail-length"], values: { reason: "spam", detail: "z".repeat(501) } }), LISTING)}
      />,
    );
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(summary).toHaveTextContent("Keep it under 500 characters.");
    expect(within(summary).getByRole("link")).toHaveAttribute("href", "#report-detail-listing-l-001");
    expect(screen.getByRole("radio", { name: "Spam" })).toBeChecked();
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveValue("z".repeat(501));
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveAttribute("aria-invalid", "true");
  });

  it("links a missing reason to the first reason, says the report limit in words, and marks the group", () => {
    const target: ReportTarget = { kind: "seller", id: "tech-corner" };
    render(
      <ReportView
        target={target}
        subject={{ title: "Tech corner", href: "/sellers/tech-corner", backLabel: "Back to the shop" }}
        already={false}
        form={reportForm(state({ errors: ["reason-missing", "report-rate"] }), target)}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Report this seller" })).toBeInTheDocument();
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getByRole("link", { name: "Choose a reason." })).toHaveAttribute(
      "href",
      "#report-reason-seller-tech-corner-scam",
    );
    // The limit says what it counts (messaging plan amendment 3, item 7).
    expect(within(summary).getByText("You've sent 10 reports in the last 24 hours. Try again later.").tagName).toBe("LI");
    expect(screen.getByRole("group", { name: "Why are you reporting it?" })).toHaveAccessibleDescription(
      "Error: Choose a reason.",
    );
  });

  it("starts empty for each thing reported, so one target's reason and detail never carry to the next (plan amendment 6)", async () => {
    // /report?listing=A and /report?seller=B are one page to Next's router, which keeps the form it has.
    const user = userEvent.setup();
    const seller: ReportTarget = { kind: "seller", id: "tech-corner" };
    const sellerSubject = { title: "Tech corner", href: "/sellers/tech-corner", backLabel: "Back to the shop" };
    const { rerender } = render(
      <ReportView target={LISTING} subject={SUBJECT} already={false} form={reportForm(null, LISTING)} />,
    );
    await user.click(screen.getByRole("radio", { name: "Spam" }));
    await user.type(screen.getByLabelText("Tell us more (optional)"), "Posted twice");
    expect(screen.getByRole("radio", { name: "Spam" })).toBeChecked();
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveValue("Posted twice");

    rerender(<ReportView target={seller} subject={sellerSubject} already={false} form={reportForm(null, seller)} />);
    expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toEqual([]);
    expect(screen.getByLabelText("Tell us more (optional)")).toHaveValue("");
  });

  it("says when the visitor has reported it already, with no form (plan decision 17)", () => {
    render(<ReportView target={LISTING} subject={SUBJECT} already form={reportForm(null, LISTING)} />);
    expect(
      screen.getByText("You've reported this listing already. The Hub reviews reports within two working days."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  });
});
