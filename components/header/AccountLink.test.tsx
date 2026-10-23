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

const forYou = vi.hoisted(() => ({ counts: [] as number[], failing: false }));

vi.mock("@/lib/you/read", () => ({
  readForYou: async () => {
    if (forYou.failing) throw new Error("The store didn't answer");
    return {
      items: forYou.counts.map((count, i) => ({ key: `item-${i}`, count, title: `Item ${i}`, href: "/account" })),
      conversations: 0,
      newNotifications: 0,
    };
  },
}));

afterEach(() => {
  viewer.account = null;
  viewer.failing = false;
  forYou.counts = [];
  forYou.failing = false;
});

describe("the header's account icon (accounts spec 3.4)", () => {
  it("says Sign in and goes to sign-in when signed out", () => {
    render(<AccountLink signedIn={false} />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
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

  it("shows a red badge with the For you count, keeping the name (role views N5, plan decision 7)", () => {
    render(<AccountLink signedIn forYou={2} />);
    const link = screen.getByRole("link", { name: "Your account" });
    expect(link).toHaveAccessibleDescription("2 things for you");
    expect(link.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
  });

  it("says one thing, caps the number at 99+, and has no badge signed out or with nothing for you", () => {
    const { unmount } = render(<AccountLink signedIn forYou={1} />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("1 thing for you");
    unmount();
    const many = render(<AccountLink signedIn forYou={120} />);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("99+ things for you");
    many.unmount();
    const none = render(<AccountLink signedIn forYou={0} />);
    expect(none.container.querySelector(".hdr-badge")).toBeNull();
    none.unmount();
    render(<AccountLink signedIn={false} forYou={3} />);
    expect(screen.getByRole("link", { name: "Sign in" })).not.toHaveAttribute("aria-describedby");
  });

  it("counts the session's For you, the same sum as the You tab, and shows no badge when the read fails", async () => {
    viewer.account = { id: "acc-student" };
    forYou.counts = [1, 0, 1];
    const { unmount } = render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("2 things for you");
    unmount();
    forYou.failing = true;
    render(await HeaderAccount());
    expect(screen.getByRole("link", { name: "Your account" })).not.toHaveAttribute("aria-describedby");
  });
});
