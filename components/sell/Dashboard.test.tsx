import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShopStats } from "@/lib/types";
import { Dashboard } from "./Dashboard";

// The form only needs something to post to; the actions have their own tests.
vi.mock("@/lib/selling/shop-actions", () => ({ pauseShop: async () => {}, resumeShop: async () => {} }));

const none = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };
const stats: ShopStats = { week: none, record: none };
const shop = { name: "Tech corner", slug: "tech-corner", badge: "responsive" as const };

describe("the dashboard (selling spec 2.8)", () => {
  it("links to every part of the shop, and says when no enquiry is due yet", () => {
    render(<Dashboard shop={shop} paused={false} stats={stats} badgeLine="3 more enquiries for Trusted." notice={null} />);
    const links = within(screen.getByRole("navigation", { name: "Your shop's pages" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["New listing", "/sell/listings/new"],
      ["My listings", "/sell/listings"],
      ["Messages from buyers", "/messages?tab=selling"],
      ["Edit shop", "/sell/profile"],
      ["View your shop", "/sellers/tech-corner"],
    ]);
    expect(screen.getByText("Replied within 48 hours").nextElementSibling).toHaveTextContent("None due yet");
    expect(screen.getByText("Responsive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause my shop" })).toHaveAttribute("type", "submit");
  });

  it("shows the last action's notice as a status line", () => {
    render(<Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice="Your shop is live again." />);
    expect(screen.getByRole("status")).toHaveTextContent("Your shop is live again.");
  });

  it("leaves the Pause form out when the Hub paused the shop (staff tools plan decision 3)", () => {
    render(<Dashboard shop={shop} paused stats={stats} badgeLine="" notice={null} hubPause="Selling exam answers." />);
    expect(screen.getByText("Paused by the Hub: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.getByText(/Only the Hub can resume it/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers no link to the storefront of a shop the Hub paused, since it answers 404 (amendment 13.2)", () => {
    render(<Dashboard shop={shop} paused stats={stats} badgeLine="" notice={null} hubPause="Selling exam answers." />);
    const links = within(screen.getByRole("navigation", { name: "Your shop's pages" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["New listing", "My listings", "Messages from buyers", "Edit shop"]);
  });

  it("keeps the Resume form and the storefront link for a shop the seller paused", () => {
    render(<Dashboard shop={shop} paused stats={stats} badgeLine="" notice={null} hubPause={null} />);
    expect(screen.getByText("Paused: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume my shop" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your shop" })).toHaveAttribute("href", "/sellers/tech-corner");
  });

  it("keeps a Hub reason that is empty as a Hub pause all the same", () => {
    render(<Dashboard shop={shop} paused stats={stats} badgeLine="" notice={null} hubPause="" />);
    expect(screen.getByText("Paused by the Hub: buyers can't see your listings")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says how many follow the shop, never who (community actions spec 2.18)", () => {
    const { unmount } = render(
      <Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice={null} followers={12} />,
    );
    expect(screen.getByText("12 people follow your shop")).toBeInTheDocument();
    unmount();
    const one = render(<Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice={null} followers={1} />);
    expect(screen.getByText("1 person follows your shop")).toBeInTheDocument();
    one.unmount();
    render(<Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice={null} />);
    expect(screen.getByText("No one follows your shop yet")).toBeInTheDocument();
  });

  it("says it under the shop's status, in the header", () => {
    render(<Dashboard shop={shop} paused={false} stats={stats} badgeLine="" notice={null} followers={3} />);
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Your shop is live")).toBeInTheDocument();
    expect(within(header).getByText("3 people follow your shop")).toBeInTheDocument();
  });
});
