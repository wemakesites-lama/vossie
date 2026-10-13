import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getListingDetail } from "@/lib/data";
import { ListingView } from "./ListingView";

// Async parts are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./MoreFrom", () => ({ MoreFrom: () => <section aria-label="More from, stood in" /> }));
vi.mock("./CampusNote", () => ({ CampusNote: () => null }));

const names = new Map([["midrand", "Midrand"]]);

async function show(id: string) {
  render(<ListingView detail={(await getListingDetail(id))!} campusNames={names} />);
}

describe("ListingView (spec 5.1)", () => {
  it("leads with the breadcrumb, title, price and actions", async () => {
    await show("l-001");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
    expect(within(crumbs).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/browse?cat=tech");
    expect(screen.getByRole("heading", { level: 1, name: "Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
    expect(screen.getByText("R250")).toHaveClass("listing-page-price");
    expect(screen.getByRole("link", { name: "Message seller" })).toBeInTheDocument();
  });

  it("shows where to collect it, who's selling, the description and the facts", async () => {
    await show("l-001");
    expect(screen.getByText("Collect at Midrand · Library entrance")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See their shop" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.getByRole("heading", { level: 2, name: "About this" })).toBeInTheDocument();
    expect(screen.getByText(/Approved for Eduvos maths and stats exams/)).toBeInTheDocument();
    expect(screen.getByText("Like new")).toBeInTheDocument();
    expect(screen.getByText("12 October 2026")).toHaveAttribute("datetime", "2026-10-12T07:40:00Z");
    expect(screen.getByRole("link", { name: "Safety tips" })).toHaveAttribute("href", "/safety");
  });

  it("shows the photos, more from the seller and the report link", async () => {
    await show("l-001");
    expect(within(screen.getByRole("region", { name: "Photos" })).getAllByRole("img")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "More from, stood in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report this listing" })).toHaveAttribute(
      "href",
      "/login?next=%2Flistings%2Fl-001",
    );
  });

  it("shows swap terms and the cash-or-swap price", async () => {
    await show("l-007");
    expect(screen.getByText("R450 or swap")).toBeInTheDocument();
    expect(screen.getByText(/a mechanical keyboard or a Bluetooth speaker/)).toBeInTheDocument();
  });

  it("marks a sold listing and offers similar items", async () => {
    await show("l-026");
    expect(screen.getByText("Sold")).toHaveClass("availability-banner");
    expect(screen.getByRole("link", { name: "See similar items" })).toHaveAttribute("href", "/browse?cat=tech");
  });

  it("says when a seller is verified by the Hub, and only then", async () => {
    await show("l-004");
    expect(screen.getByText("Verified by the Hub")).toBeInTheDocument();
  });

  it("leaves Verified out for a seller who isn't", async () => {
    await show("l-001");
    expect(screen.queryByText("Verified by the Hub")).not.toBeInTheDocument();
  });

  it("leaves the condition out for a service", async () => {
    await show("l-004");
    expect(screen.queryByText("Condition")).not.toBeInTheDocument();
    expect(screen.getByText("On campus at Midrand")).toBeInTheDocument();
  });
});
