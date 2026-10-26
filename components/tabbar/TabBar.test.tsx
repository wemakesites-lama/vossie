import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedCookieString } from "@/lib/saved";
import { AccountTab, RoleTabs, StudentTail, TabBar } from "./TabBar";

type Viewer = { id: string; roles: string[]; seller: { status: string; sellerSlug: string | null } | null };
const viewer = vi.hoisted(() => ({ account: null as Viewer | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

// For you's reader (role views N5): the tab's badge is the sum of what it lists.
const forYou = vi.hoisted(() => ({ counts: [] as number[], keys: [] as string[], failing: false }));
vi.mock("@/lib/you/read", () => ({
  readForYou: async () => {
    if (forYou.failing) throw new Error("The store didn't answer");
    return {
      items: forYou.counts.map((count, i) => ({ key: forYou.keys[i] ?? `item-${i}`, count, title: `Item ${i}`, href: "/account" })),
      conversations: 0,
      newNotifications: 0,
    };
  },
}));

// The pills' readers (role bars spec 7): the seller's queue, slot requests, shops waiting and open reports.
// `failing` fails every reader ("all") or just one, so a single failed read is seen to hide its badge.
type Reader = "queue" | "slots" | "shops" | "reports";
const counts = vi.hoisted(() => ({
  needs: 3,
  slots: 2,
  shops: 1,
  reports: 1,
  failing: false as false | "all" | Reader,
}));
const maybeFail = vi.hoisted(
  () =>
    <T,>(reader: Reader, value: T) =>
      counts.failing === "all" || counts.failing === reader
        ? Promise.reject(new Error("The store didn't answer"))
        : Promise.resolve(value),
);
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/selling/queue", () => ({ queueFor: () => maybeFail("queue", {}) }));
vi.mock("@/lib/selling/home", () => ({ sellerNeeds: () => [{ key: "replies", count: counts.needs }] }));
vi.mock("@/lib/data/hub-posts", () => ({ openBookingCount: () => maybeFail("slots", counts.slots) }));
vi.mock("@/lib/data/staff-shops", () => ({ countWaitingShops: () => maybeFail("shops", counts.shops) }));
vi.mock("@/lib/data/staff-reports", () => ({ openReportCount: () => maybeFail("reports", counts.reports) }));

afterEach(() => {
  viewer.account = null;
  forYou.counts = [];
  forYou.keys = [];
  forYou.failing = false;
  Object.assign(counts, { needs: 3, slots: 2, shops: 1, reports: 1, failing: false });
});

const student = (): Viewer => ({ id: "acc-student", roles: [], seller: null });

function renderBar(tail = <StudentTail />) {
  render(<TabBar tail={tail} />);
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
    viewer.account = student();
    forYou.counts = [1, 0, 2];
    const bar = renderBar(await RoleTabs());
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
    viewer.account = student();
    forYou.failing = true;
    const { unmount } = render(<TabBar tail={await RoleTabs()} />);
    const you = screen.getByRole("link", { name: "You" });
    expect(you).toHaveAttribute("href", "/account");
    expect(you.querySelector(".hdr-badge")).toBeNull();
    unmount();
    render(<AccountTab signedIn={false} forYou={4} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toBeNull();
  });

  it("streams the student's tail when signed out, linking You to sign-in", async () => {
    const bar = renderBar(await RoleTabs());
    const links = within(bar).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Shop", "Sell", "Saved", "You"]);
    expect(within(bar).getByRole("link", { name: "You" })).toHaveAttribute("href", "/login");
  });
});

describe("the role bars (role bars spec 3, 5 and 7)", () => {
  const hrefs = (bar: HTMLElement) => within(bar).getAllByRole("link").map((link) => link.getAttribute("href"));

  it("keeps Sell and Saved for a student", async () => {
    viewer.account = student();
    const bar = renderBar(await RoleTabs());
    expect(hrefs(bar)).toEqual(["/", "/browse", "/sell", "/saved", "/account"]);
    expect(within(bar).getByRole("link", { name: "Sell" })).toHaveClass("tab", "tab-sell");
  });

  it("gives a seller My shop, badged with Needs you, and Messages in place of Saved", async () => {
    viewer.account = { id: "acc-seller", roles: [], seller: { status: "approved", sellerSlug: "thandis-books" } };
    const bar = renderBar(await RoleTabs());
    expect(hrefs(bar)).toEqual(["/", "/browse", "/sell", "/messages", "/account"]);
    const pill = within(bar).getByRole("link", { name: "My shop" });
    expect(pill).toHaveClass("tab", "tab-sell");
    expect(pill).toHaveAccessibleDescription("3 things need you");
  });

  it("shows no badge on a pending shop's My shop", async () => {
    viewer.account = { id: "acc-seller", roles: [], seller: { status: "pending", sellerSlug: null } };
    const bar = renderBar(await RoleTabs());
    const pill = within(bar).getByRole("link", { name: "My shop" });
    expect(pill).toHaveAccessibleDescription("");
    expect(pill.querySelector(".hdr-badge")).toBeNull();
  });

  it("gives a mentor Mentoring, badged with slot requests waiting", async () => {
    viewer.account = { id: "acc-mentor", roles: ["mentor"], seller: null };
    const bar = renderBar(await RoleTabs());
    const pill = within(bar).getByRole("link", { name: "Mentoring" });
    expect(pill).toHaveAttribute("href", "/mentor");
    expect(pill).toHaveAccessibleDescription("2 slot requests waiting");
  });

  it("gives an admin Today, badged with everything waiting", async () => {
    viewer.account = { id: "acc-admin", roles: ["admin"], seller: null };
    const bar = renderBar(await RoleTabs());
    const pill = within(bar).getByRole("link", { name: "Today" });
    expect(pill).toHaveAttribute("href", "/admin");
    expect(pill).toHaveAccessibleDescription("4 waiting");
  });

  it("counts new messages under Messages and only the rest under You", async () => {
    viewer.account = { id: "acc-mentor", roles: ["mentor"], seller: null };
    forYou.keys = ["messages", "matches"];
    forYou.counts = [2, 1];
    const bar = renderBar(await RoleTabs());
    expect(within(bar).getByRole("link", { name: "Messages" })).toHaveAccessibleDescription("2 new messages");
    expect(within(bar).getByRole("link", { name: "You" })).toHaveAccessibleDescription("1 other thing for you");
  });

  it("shows no pill badge when a count fails, never a guess", async () => {
    viewer.account = { id: "acc-admin", roles: ["admin"], seller: null };
    counts.failing = "all";
    const bar = renderBar(await RoleTabs());
    const pill = within(bar).getByRole("link", { name: "Today" });
    expect(pill).toHaveAccessibleDescription("");
    expect(pill.querySelector(".hdr-badge")).toBeNull();
  });

  it("shows no Today badge when only the reports count fails", async () => {
    viewer.account = { id: "acc-admin", roles: ["admin"], seller: null };
    counts.failing = "reports";
    const bar = renderBar(await RoleTabs());
    const pill = within(bar).getByRole("link", { name: "Today" });
    expect(pill).toHaveAccessibleDescription("");
    expect(pill.querySelector(".hdr-badge")).toBeNull();
  });

  it("shows no My shop badge when the seller's queue fails", async () => {
    viewer.account = { id: "acc-seller", roles: [], seller: { status: "approved", sellerSlug: "thandis-books" } };
    counts.failing = "queue";
    const bar = renderBar(await RoleTabs());
    const pill = within(bar).getByRole("link", { name: "My shop" });
    expect(pill).toHaveAccessibleDescription("");
    expect(pill.querySelector(".hdr-badge")).toBeNull();
  });

  it("shows no Messages or You badge when For you fails", async () => {
    viewer.account = { id: "acc-mentor", roles: ["mentor"], seller: null };
    forYou.keys = ["messages", "matches"];
    forYou.counts = [2, 1];
    forYou.failing = true;
    const bar = renderBar(await RoleTabs());
    for (const name of ["Messages", "You"]) {
      const tab = within(bar).getByRole("link", { name });
      expect(tab).toHaveAccessibleDescription("");
      expect(tab.querySelector(".hdr-badge")).toBeNull();
    }
  });
});
