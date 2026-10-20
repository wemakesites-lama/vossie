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
    expect(within(section).getAllByRole("listitem")).toHaveLength(7);
    // The other side keeps its own messages, and sees the deleted side as "Deleted account" (plan amendment 3.9).
    expect(within(section).getByText(/with your name shown as "Deleted account"/)).toBeInTheDocument();
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
    // The wizard's answers so far are in the file too (selling plan, amendment 9.6).
    expect(within(download).getByText(/set up your shop but not sent it, it holds your answers so far too/)).toBeInTheDocument();
    const deletion = screen.getByRole("region", { name: "Delete your account" });
    expect(within(deletion).getByText(/every photo you uploaded go too/)).toBeInTheDocument();
    expect(within(deletion).getByText(/any shop answers you haven't sent/)).toBeInTheDocument();
    expect(screen.queryByText(/once selling opens/i)).toBeNull();
  });

  it("says the download holds your RSVPs and slot requests, and that mentors' notes about your shop aren't in it (staff tools plan decisions 13 and 16)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const download = screen.getByRole("region", { name: "Download your data" });
    // The earlier wording still holds, with the new item inside the list.
    expect(within(download).getByText(/your RSVPs and slot requests, your conversations, your reports and your notifications/)).toBeInTheDocument();
    // The policy says notes can be asked for from the Information Officer; the page where the file is says it too.
    expect(within(download).getByText(/Mentors' notes about your shop aren't in it: you can ask the Information Officer for them\./)).toBeInTheDocument();
  });

  it("says the download and the deletion take in requests and follows (community actions spec 2.23)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    expect(screen.getByText(/your Looking For requests and the shops you follow/)).toBeInTheDocument();
    expect(screen.getByText(/your requests and follows go too/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Download your data" })).getByText(/your Looking For requests/)).toBeInTheDocument();
  });

  it("says deleting removes your RSVPs and slot requests, and a seller's mentors' notes about the shop (staff tools plan decision 16)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const deletion = screen.getByRole("region", { name: "Delete your account" });
    expect(within(deletion).getAllByRole("listitem")).toHaveLength(7);
    expect(within(deletion).getByText(/^your RSVPs and slot requests, messages, reports and notifications go/)).toBeInTheDocument();
    // The other side still keeps its own messages and sees "Deleted account".
    expect(within(deletion).getByText(/with your name shown as "Deleted account"/)).toBeInTheDocument();
    // Notes are about a shop, so they sit with the seller's part of the list.
    expect(within(deletion).getByText(/any shop answers you haven't sent and mentors' notes about your shop, and your shop's link stops working/)).toBeInTheDocument();
  });

  it("says the download holds your saved searches, and deleting removes them (search alerts spec 2.15)", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    expect(screen.getByText(/your saved searches and their notifications go too/)).toBeInTheDocument();
    expect(screen.getAllByText(/your saved searches/)).toHaveLength(2);
  });
});

describe("deleting a staff account (stage J spec decision 8)", () => {
  const STAFF_LINE =
    "You're Hub staff. Your Hub posts stay with no author, your notes and check-ins stay as \"Deleted account\", the shops you mentor lose their mentor, and the audit log keeps your entries, and those naming you as a mentor, without your name.";
  const ONLY_ADMIN = "You're Vossie's only admin. Give someone else the admin role first, or no one can use the admin console.";

  it("says nothing about staff work to a student", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).queryByText(/Hub staff/)).toBeNull();
    expect(within(section).getAllByRole("listitem")).toHaveLength(7);
  });

  it("tells staff what happens to their work, without blocking the delete", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} staff={{ onlyAdmin: false }} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).getByText(STAFF_LINE)).toBeInTheDocument();
    expect(within(section).queryByText(/only admin/)).toBeNull();
    expect(within(section).getAllByRole("listitem")).toHaveLength(7);
    expect(within(section).getByRole("button", { name: "Delete my account" })).toBeEnabled();
  });

  it("warns Vossie's only admin to give the role to someone else first", () => {
    render(<PrivacySettingsView consent={consent} deleteErrors={[]} reports={[]} staff={{ onlyAdmin: true }} />);
    const section = screen.getByRole("region", { name: "Delete your account" });
    expect(within(section).getByText(STAFF_LINE)).toBeInTheDocument();
    expect(within(section).getByText(/^You're Vossie's only admin\./).closest("p")).toHaveTextContent(ONLY_ADMIN);
    expect(within(section).getByRole("button", { name: "Delete my account" })).toBeEnabled();
  });
});
