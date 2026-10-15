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

const notifications = vi.hoisted(() => ({ count: 0, failing: false }));

vi.mock("@/lib/data/notifications", () => ({
  countNewNotifications: async () => {
    if (notifications.failing) throw new Error("The store didn't answer");
    return notifications.count;
  },
}));

afterEach(() => {
  viewer.account = null;
  viewer.failing = false;
  notifications.count = 0;
  notifications.failing = false;
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

  it("shows a red badge with the number of new notifications, keeping the name (messaging plan decision 10)", () => {
    render(<AccountLink signedIn unread={2} />);
    const link = screen.getByRole("link", { name: "Your account" });
    expect(link).toHaveAccessibleDescription("2 new notifications");
    expect(link.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
  });

  it("says one notification, caps the number at 99+, and has no badge signed out or with nothing new", () => {
    const { unmount } = render(<AccountLink signedIn unread={1} />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("1 new notification");
    unmount();
    const many = render(<AccountLink signedIn unread={120} />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("99+ new notifications");
    many.unmount();
    const none = render(<AccountLink signedIn unread={0} />);
    expect(none.container.querySelector(".hdr-badge")).toBeNull();
    none.unmount();
    render(<AccountLink signedIn={false} unread={3} />);
    expect(screen.getByRole("link", { name: "Sign in" })).not.toHaveAttribute("aria-describedby");
  });

  it("counts the session's new notifications, and shows no badge when the count fails", async () => {
    viewer.account = { id: "acc-student" };
    notifications.count = 2;
    const { unmount } = render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("2 new notifications");
    unmount();
    notifications.failing = true;
    render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).not.toHaveAttribute("aria-describedby");
  });
});
