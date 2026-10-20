import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedCookieString } from "@/lib/saved";
import { AccountTab, TabAccount, TabBar } from "./TabBar";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

const notifications = vi.hoisted(() => ({ count: 0, failing: false }));
vi.mock("@/lib/data/notifications", () => ({
  countNewNotifications: async () => {
    if (notifications.failing) throw new Error("The store didn't answer");
    return notifications.count;
  },
}));

afterEach(() => {
  viewer.account = null;
  notifications.count = 0;
  notifications.failing = false;
});

function renderBar(account = <AccountTab signedIn={false} />) {
  render(<TabBar account={account} />);
  return screen.getByRole("navigation", { name: "Main" });
}

describe("the phone tab bar (spec section 6.2)", () => {
  it("has Home, Shop, Sell, Saved and Account, in that order, each with a visible label", () => {
    const bar = renderBar();
    const links = within(bar).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Shop", "Sell", "Saved", "Account"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/browse", "/sell", "/saved", "/login"]);
  });

  it("marks the current page's tab (the tests' page is /)", () => {
    const bar = renderBar();
    expect(within(bar).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("link", { name: "Shop" })).not.toHaveAttribute("aria-current");
  });

  it("gives Sell its own look", () => {
    const bar = renderBar();
    expect(within(bar).getByRole("link", { name: "Sell" })).toHaveClass("tab", "tab-sell");
  });

  it("badges the saved count on this device, and describes the tab with it", () => {
    document.cookie = savedCookieString(["a", "b"], false);
    const bar = renderBar();
    const saved = within(bar).getByRole("link", { name: "Saved" });
    expect(saved).toHaveAccessibleDescription("2 items");
    expect(saved.querySelector(".hdr-badge")).toHaveTextContent("2");
  });

  it("has no badge and an empty description with nothing saved", () => {
    const bar = renderBar();
    const saved = within(bar).getByRole("link", { name: "Saved" });
    expect(saved).toHaveAccessibleDescription("");
    expect(saved.querySelector(".hdr-badge")).toBeNull();
  });

  it("goes to sign-in signed out, and to the account with a red badge signed in", async () => {
    viewer.account = { id: "acc-student" };
    notifications.count = 3;
    const bar = renderBar(await TabAccount());
    const account = within(bar).getByRole("link", { name: "Account" });
    expect(account).toHaveAttribute("href", "/account");
    expect(account).toHaveAccessibleDescription("3 new notifications");
    expect(account.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
  });

  it("shows no badge when the count fails, and none signed out", async () => {
    viewer.account = { id: "acc-student" };
    notifications.failing = true;
    const { unmount } = render(await TabAccount());
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    unmount();
    render(<AccountTab signedIn={false} unread={4} />);
    expect(screen.getByRole("link", { name: "Account" }).querySelector(".hdr-badge")).toBeNull();
  });
});
