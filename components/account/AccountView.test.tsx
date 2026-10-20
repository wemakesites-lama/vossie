import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import type { FormStateRow } from "@/lib/data/rows";
import type { Account } from "@/lib/types";
import { AccountView, detailsForm } from "./AccountView";

// next/link draws a plain <a> in jsdom; this one shows `prefetch` as data, for the test that checks the staff rows.
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/auth/actions", () => ({ updateDetails: async () => {} }));

const account: Account = {
  id: "acc-student",
  email: "student@eduvos.com",
  firstName: "Thandi",
  campusSlug: "midrand",
  roles: [],
  seller: null,
  createdAt: "2026-09-01T07:30:00.000Z",
};

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "session-key:details",
  sessionKey: "session-key",
  form: "details",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

function renderAccount(
  who: Account = account,
  formState: FormStateRow | null = null,
  counts = { conversations: 0, notifications: 0 },
) {
  return render(
    <AccountView account={who} campuses={campuses} details={detailsForm(who, formState)} counts={counts} />,
  );
}

describe("Your account (accounts spec 3.2)", () => {
  it("shows the first name, the email, the campus and when they joined", () => {
    renderAccount();
    expect(screen.getByRole("heading", { level: 2, name: "Thandi" })).toBeInTheDocument();
    expect(screen.getByText("Email").nextElementSibling).toHaveTextContent("student@eduvos.com");
    expect(screen.getByText("Campus").nextElementSibling).toHaveTextContent("Midrand");
    expect(screen.getByText("Member since September 2026")).toBeInTheDocument();
    expect(screen.queryByText("Hub role")).toBeNull();
  });

  it("starts Edit details on the account's details", () => {
    renderAccount();
    const edit = screen.getByRole("region", { name: "Edit details" });
    expect(within(edit).getByLabelText("Your first name")).toHaveValue("Thandi");
    expect(within(edit).getByRole("combobox", { name: "Your campus" })).toHaveValue("midrand");
    expect(within(edit).getByRole("button", { name: "Save changes" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the details were saved (plan decision 13)", () => {
    renderAccount(account, state({ notice: "saved" }));
    expect(screen.getByRole("status")).toHaveTextContent("Your details are saved.");
  });

  it("shows what was typed and what's wrong after a failed save", () => {
    renderAccount(account, state({ errors: ["first-name-length", "campus-missing"], values: { firstName: "T", campus: "" } }));
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    const name = screen.getByLabelText("Your first name");
    expect(name).toHaveValue("T");
    expect(name).toHaveAccessibleDescription(
      "Sellers see it when you message them. 2 to 40 characters. Error: Your first name must be 2 to 40 characters.",
    );
    expect(screen.getByRole("combobox", { name: "Your campus" })).toHaveValue("");
  });

  it("links to messages, notifications, Saved, Your requests, selling and privacy settings, and offers Sign out (messaging spec 3.6; community actions amendment 11)", () => {
    renderAccount();
    const pages = screen.getByRole("navigation", { name: "Your account's pages" });
    expect(within(pages).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Messages", "/messages"],
      ["Notifications", "/notifications"],
      ["Saved", "/saved"],
      ["Your requests", "/account/requests"],
      ["Start selling", "/sell"],
      ["Privacy settings", "/account/privacy"],
    ]);
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Sign out" }).closest("form")).toHaveAttribute("action", "/logout");
  });

  it("points a seller at their shop's pages, and says when it's waiting or paused (selling plan decision 21)", () => {
    const approved = renderAccount({ ...account, seller: { status: "approved", sellerSlug: "tech-corner" } });
    expect(screen.getByRole("link", { name: "Your shop" })).toHaveAttribute("href", "/sell");
    approved.unmount();
    const pending = renderAccount({ ...account, seller: { status: "pending", sellerSlug: null } });
    expect(screen.getByRole("link", { name: /^Your shop\s*,\s*Waiting for the Hub's approval$/ })).toHaveAttribute(
      "href",
      "/sell",
    );
    pending.unmount();
    renderAccount({ ...account, seller: { status: "paused", sellerSlug: "tech-corner" } });
    expect(screen.getByRole("link", { name: /^Your shop\s*,\s*Paused$/ })).toHaveAttribute("href", "/sell");
  });

  it("names a mentor's or an admin's Hub role (plan decision 16)", () => {
    renderAccount({ ...account, roles: ["admin"] });
    expect(screen.getByText("Hub role").nextElementSibling).toHaveTextContent("Admin");
  });

  it("links staff to the tools their roles open (staff tools plan decision 19)", () => {
    renderAccount({ ...account, roles: ["admin"] });
    const rows = screen.getByRole("navigation", { name: "Your account's pages" });
    expect(within(rows).getByRole("link", { name: "Admin console" })).toHaveAttribute("href", "/admin");
    expect(within(rows).getByRole("link", { name: "Hub posts and office hours" })).toHaveAttribute("href", "/hub/manage");
    expect(within(rows).getByRole("link", { name: "Mentor dashboard" })).toHaveAttribute("href", "/mentor");
  });

  it("gives a mentor the Hub's tools and the dashboard, and a student no staff rows", () => {
    const { unmount } = renderAccount({ ...account, roles: ["mentor"] });
    expect(screen.queryByRole("link", { name: "Admin console" })).toBeNull();
    expect(screen.getByRole("link", { name: "Hub posts and office hours" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mentor dashboard" })).toBeInTheDocument();
    unmount();
    renderAccount();
    expect(screen.queryByRole("link", { name: "Hub posts and office hours" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Mentor dashboard" })).toBeNull();
  });

  it("lists the staff rows after Your shop and before Privacy settings, in a fixed order", () => {
    renderAccount({ ...account, roles: ["admin"] });
    const pages = screen.getByRole("navigation", { name: "Your account's pages" });
    expect(within(pages).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Messages",
      "Notifications",
      "Saved",
      "Your requests",
      "Start selling",
      "Admin console",
      "Hub posts and office hours",
      "Mentor dashboard",
      "Privacy settings",
    ]);
  });

  it("never prefetches the staff rows: every staff page reads the session (staff tools plan decision 19)", () => {
    renderAccount({ ...account, roles: ["admin"] });
    for (const name of ["Admin console", "Hub posts and office hours", "Mentor dashboard"]) {
      expect(screen.getByRole("link", { name }).dataset.prefetch, name).toBe("false");
    }
  });

  it("links to Your requests, with no prefetch: the page reads the session (community actions spec 2.13)", () => {
    renderAccount();
    const rows = screen.getByRole("navigation", { name: "Your account's pages" });
    const link = within(rows).getByRole("link", { name: "Your requests" });
    expect(link).toHaveAttribute("href", "/account/requests");
    expect(link.dataset.prefetch).toBe("false");
  });

  it("says how many conversations are unread and how many notifications are new (messaging spec 3.6)", () => {
    renderAccount(account, null, { conversations: 2, notifications: 3 });
    expect(screen.getByRole("link", { name: /^Messages\s*,\s*2 unread$/ })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: /^Notifications\s*,\s*3 new$/ })).toHaveAttribute("href", "/notifications");
  });
});
