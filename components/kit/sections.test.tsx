import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBar, MentorBar, SellBar } from "./sections";

const viewer = vi.hoisted(() => ({ account: null as { id: string; roles: string[] } | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

const shop = vi.hoisted(() => ({ own: null as { status: string; shop: { slug: string } } | null }));
vi.mock("@/lib/data/shops", () => ({ getShopOf: async () => shop.own }));

const queue = vi.hoisted(() => ({ waiting: 2, failing: false, reads: 0 }));
vi.mock("@/lib/selling/queue", () => ({
  queueFor: async () => {
    queue.reads += 1;
    if (queue.failing) throw new Error("down");
    return { replies: { count: queue.waiting, oldest: null } };
  },
}));

const counts = vi.hoisted(() => ({ waiting: 3, reports: 2, slots: 1, failing: false }));
vi.mock("@/lib/data/staff-shops", () => ({
  countWaitingShops: async () => {
    if (counts.failing) throw new Error("down");
    return counts.waiting;
  },
}));
vi.mock("@/lib/data/staff-reports", () => ({ openReportCount: async () => counts.reports }));
vi.mock("@/lib/data/hub-posts", () => ({ openBookingCount: async () => counts.slots }));

afterEach(() => {
  viewer.account = null;
  shop.own = null;
  counts.failing = false;
  queue.failing = false;
  queue.reads = 0;
});

const labels = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole("link")
    .map((link) => link.querySelector(".section-tab-label")?.textContent);

describe("SellBar", () => {
  it("shows nothing to a visitor or a student without a shop: the main bar stays", async () => {
    const { container } = render(await SellBar());
    expect(container).toBeEmptyDOMElement();
    viewer.account = { id: "a", roles: [] };
    const second = render(await SellBar());
    expect(second.container).toBeEmptyDOMElement();
  });

  it("gives an open shop Overview, Listings, Messages, Shop and CampusCart", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "approved", shop: { slug: "tech-corner" } };
    render(await SellBar());
    const bar = screen.getByRole("navigation", { name: "Selling" });
    expect(labels(bar)).toEqual(["Overview", "Listings", "Messages", "Shop", "CampusCart"]);
    expect(within(bar).getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages?tab=selling");
  });

  it("drops the Messages badge when the queue fails, and never reads it for a waiting shop (spec 4.2)", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "approved", shop: { slug: "tech-corner" } };
    queue.failing = true;
    const failed = render(await SellBar());
    expect(within(failed.container).getByRole("link", { name: "Messages" })).not.toHaveAttribute("aria-describedby");
    failed.unmount();
    queue.reads = 0;
    shop.own = { status: "pending", shop: { slug: "crochet-corner" } };
    render(await SellBar());
    expect(queue.reads).toBe(0);
  });

  it("gives a waiting shop no Messages tab", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "pending", shop: { slug: "crochet-corner" } };
    render(await SellBar());
    expect(labels(screen.getByRole("navigation", { name: "Selling" }))).toEqual([
      "Overview",
      "Listings",
      "Shop",
      "CampusCart",
    ]);
  });
});

describe("AdminBar", () => {
  it("shows nothing without the admin role", async () => {
    viewer.account = { id: "m", roles: ["mentor"] };
    const { container } = render(await AdminBar());
    expect(container).toBeEmptyDOMElement();
  });

  it("gives an admin Today, Shops, Reports, Hub and More, with the Overview's counts as badges", async () => {
    viewer.account = { id: "x", roles: ["admin"] };
    render(await AdminBar());
    const bar = screen.getByRole("navigation", { name: "Hub console" });
    expect(labels(bar)).toEqual(["Today", "Shops", "Reports", "Hub", "More"]);
    expect(within(bar).getByRole("link", { name: "Shops" })).toHaveAccessibleDescription(/3\s+shops waiting/);
    expect(within(bar).getByRole("link", { name: "Reports" })).toHaveAccessibleDescription(/2\s+open reports/);
    expect(within(bar).getByRole("link", { name: "Hub" })).toHaveAccessibleDescription(/1\s+slot request waiting/);
  });

  it("drops a badge whose count failed, never guesses", async () => {
    viewer.account = { id: "x", roles: ["admin"] };
    counts.failing = true;
    render(await AdminBar());
    expect(screen.getByRole("link", { name: "Shops" })).not.toHaveAttribute("aria-describedby");
  });
});

describe("MentorBar", () => {
  it("gives a mentor Shops, Office hours, Posts, Export and CampusCart", async () => {
    viewer.account = { id: "m", roles: ["mentor"] };
    render(await MentorBar());
    const bar = screen.getByRole("navigation", { name: "Mentoring" });
    expect(labels(bar)).toEqual(["Shops", "Office hours", "Posts", "Export", "CampusCart"]);
    expect(within(bar).getByRole("link", { name: "Export" })).toHaveAttribute("download");
  });

  it("shows nothing to a student", async () => {
    viewer.account = { id: "s", roles: [] };
    const { container } = render(await MentorBar());
    expect(container).toBeEmptyDOMElement();
  });
});
