import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedCookieString } from "@/lib/saved";
import { AccountTab, TabAccount, TabBar } from "./TabBar";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

// For you's reader (role views N5): the tab's badge is the sum of what it lists.
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
  forYou.counts = [];
  forYou.failing = false;
});

function renderBar(account = <AccountTab signedIn={false} />) {
  render(<TabBar account={account} />);
  return screen.getByRole("navigation", { name: "Main" });
}

describe("the phone tab bar (spec section 6.2)", () => {
  it("has Home, Shop, Sell, Saved and You, in that order, each with a visible label", () => {
    const bar = renderBar();
    const links = within(bar).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Shop", "Sell", "Saved", "You"]);
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

  it("goes to sign-in signed out, and to You with a red badge that sums For you (role views spec 4.3)", async () => {
    viewer.account = { id: "acc-student" };
    forYou.counts = [1, 0, 2];
    const bar = renderBar(await TabAccount());
    const you = within(bar).getByRole("link", { name: "You" });
    expect(you).toHaveAttribute("href", "/account");
    expect(you).toHaveAccessibleDescription("3 things for you");
    expect(you.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
  });

  it("says one thing, caps the number at 99+, and shows no badge with nothing for you", () => {
    const one = render(<AccountTab signedIn forYou={1} />);
    expect(screen.getByRole("link", { name: "You" })).toHaveAccessibleDescription("1 thing for you");
    one.unmount();
    const many = render(<AccountTab signedIn forYou={140} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toHaveTextContent(/^99\+ /);
    many.unmount();
    render(<AccountTab signedIn forYou={0} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toBeNull();
  });

  it("shows no badge when the count fails, and none signed out", async () => {
    viewer.account = { id: "acc-student" };
    forYou.failing = true;
    const { unmount } = render(await TabAccount());
    const you = screen.getByRole("link", { name: "You" });
    expect(you).toHaveAttribute("href", "/account");
    expect(you.querySelector(".hdr-badge")).toBeNull();
    unmount();
    render(<AccountTab signedIn={false} forYou={4} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toBeNull();
  });
});
