import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacySettingsView } from "./PrivacySettingsView";

// The form only needs something to post to; the action has its own test.
vi.mock("@/lib/auth/actions", () => ({ deleteAccount: async () => {} }));

const consent = { version: "2026-10-draft", agreedAt: "2026-10-14T08:42:00.000Z" };

describe("Privacy settings (accounts spec 3.3)", () => {
  it("says when the privacy policy was agreed to, in South African time", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} />);
    const section = screen.getByRole("region", { name: "Your consent" });
    expect(within(section).getByText(/You agreed to the/)).toHaveTextContent(
      "You agreed to the privacy policy (draft of October 2026) on 14 October 2026 at 10:42.",
    );
    expect(within(section).getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("says so when there's no record of consent", () => {
    render(<PrivacySettingsView consent={null} deleteErrors={[]} />);
    expect(screen.getByText(/no record of you agreeing/)).toBeInTheDocument();
  });

  it("links to the download (spec 3.3)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} />);
    const link = screen.getByRole("link", { name: "Download your data" });
    expect(link).toHaveAttribute("href", "/account/privacy/export");
    expect(link).toHaveAttribute("download", "vossie-data.json");
  });

  it("says what deleting does, and asks for the box before the red button (spec 2.13)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(4);
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
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Tick the box to confirm you understand.");
    const box = screen.getByRole("checkbox", { name: "I understand this can't be undone" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Error: Tick the box to confirm you understand.");
  });
});
