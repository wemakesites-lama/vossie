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
});
