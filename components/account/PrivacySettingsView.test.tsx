import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacySettingsView } from "./PrivacySettingsView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/auth/actions", () => ({ deleteAccount: async () => {} }));

const consent = { version: "2026-10-draft", agreedAt: "2026-10-14T08:42:00.000Z" };

describe("Privacy settings (accounts spec 3.3)", () => {
  it("says when the privacy policy was agreed to, in South African time", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const section = screen.getByRole("region", { name: "Your consent" });
    expect(within(section).getByText(/You agreed to the/)).toHaveTextContent(
      "You agreed to the privacy policy (draft of October 2026) on 14 October 2026 at 10:42.",
    );
    expect(within(section).getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("says so when there's no record of consent", () => {
    render(<PrivacySettingsView consent={null} deleteErrors={[]} reports={[]} />);
    expect(screen.getByText(/no record of you agreeing/)).toBeInTheDocument();
  });

  it("links to the download (spec 3.3)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const link = screen.getByRole("link", { name: "Download your data" });
    expect(link).toHaveAttribute("href", "/account/privacy/export");
    expect(link).toHaveAttribute("download", "vossie-data.json");
  });

  it("says what deleting does, and asks for the box before the red button (spec 2.13)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(5);
    expect(within(section).getByRole("checkbox", { name: "I understand this can't be undone" })).not.toBeChecked();
    const button = within(section).getByRole("button", { name: "Delete my account" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("btn-danger");
  });

  it("shows the box's error in the summary and beside the box", () => {
    render(
      <PrivacySettingsView
        consent={consent}
        deleteErrors={[{ message: "Tick the box to confirm you understand.", fieldId: "delete-confirm" }]}
        reports={[]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Tick the box to confirm you understand.");
    const box = screen.getByRole("checkbox", { name: "I understand this can't be undone" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Error: Tick the box to confirm you understand.");
  });

  it("says the download holds your conversations, reports and notifications (messaging plan decision 15)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const section = screen.getByRole("region", { name: "Download your data" });
    expect(within(section).getByText(/your conversations, your reports and your notifications/)).toBeInTheDocument();
  });

  it("lists the reports you've made, newest first, or says there are none (messaging plan decision 18)", () => {
    const { unmount } = render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    expect(
      within(screen.getByRole("region", { name: "Reports you've made" })).getByText("You haven't reported anything."),
    ).toBeInTheDocument();
    unmount();
    render(
      <PrivacySettingsView
        consent={consent}
        deleteErrors={[]}
        reports={[
          { kind: "seller", title: "Tech corner", reason: "spam", createdAt: "2026-10-14T08:42:00.000Z", open: true },
          {
            kind: "listing",
            title: "Casio fx-991ZA Plus calculator",
            reason: "misleading",
            createdAt: "2026-10-01T08:00:00.000Z",
            open: false,
          },
        ]}
      />,
    );
    const items = within(screen.getByRole("region", { name: "Reports you've made" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Tech corner Spam · 14 Oct · Open",
      "Casio fx-991ZA Plus calculator Misleading listing · 1 Oct · Closed",
    ]);
  });

  it("says the download and the deletion take in your shop, its listings and photos (selling plan, Task 15)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const download = screen.getByRole("region", { name: "Download your data" });
    expect(within(download).getByText(/If you sell, it holds your shop and your listings too/)).toBeInTheDocument();
    const deletion = screen.getByRole("region", { name: "Delete your account" });
    expect(within(deletion).getByText(/every photo you uploaded go too/)).toBeInTheDocument();
    expect(screen.queryByText(/once selling opens/i)).toBeNull();
  });
});
