import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuAccount, MenuAccountLinks } from "./MenuAccount";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
// The form only needs something to post to; the action has its own test.

afterEach(() => {
  viewer.account = null;
});

describe("the menu's account rows (accounts spec 3.4)", () => {
  it("offers Sign in when signed out", () => {
    render(
      <ul>
        <MenuAccountLinks signedIn={false} />
      </ul>,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("offers Your account and a Sign out button when signed in", () => {
    render(
      <ul>
        <MenuAccountLinks signedIn />
      </ul>,
    );
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(signOut).toHaveAttribute("type", "submit");
    expect(signOut.closest("form")).not.toBeNull();
    // A plain post to /logout, which answers with a full page load (stage K plan decision 2).
    expect(signOut.closest("form")).toHaveAttribute("action", "/logout");
    expect(signOut.closest("form")).toHaveAttribute("method", "post");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("follows the session", async () => {
    viewer.account = { id: "acc-student" };
    render(<ul>{await MenuAccount()}</ul>);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
