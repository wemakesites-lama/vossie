import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountLink, HeaderAccount } from "./AccountLink";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null, failing: false }));

vi.mock("@/lib/auth/session", () => ({
  getViewer: async () => {
    if (viewer.failing) throw new Error("The session store didn't answer");
    return viewer.account;
  },
}));

afterEach(() => {
  viewer.account = null;
  viewer.failing = false;
});

describe("the header's account icon (accounts spec 3.4)", () => {
  it("says Sign in and goes to sign-in when signed out", () => {
    render(<AccountLink signedIn={false} />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
    // Fourth in the header's reveal stagger (spec section 6.2).
    expect(link.style.getPropertyValue("--i")).toBe("3");
  });

  it("says Your account and goes to the account when signed in", () => {
    render(<AccountLink signedIn />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
  });

  it("follows the session", async () => {
    viewer.account = { id: "acc-student" };
    render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).toBeInTheDocument();
  });

  it("counts a failed session lookup as signed out", async () => {
    viewer.failing = true;
    render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
