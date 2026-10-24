import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { ListingCard } from "./ListingCard";

const braids = makeListing({
  id: "l-004",
  title: "Box braids, shoulder length",
  priceZar: 400,
  priceIsFrom: true,
  image: { src: "/placeholders/listing/hair-beauty.svg", alt: "Box braids, shoulder length" },
  badge: "trusted",
  kind: "service",
  categorySlug: "hair-beauty",
  sellerSlug: "hair-studio",
  sellerName: "Hair studio",
  condition: null,
  handover: "on-campus",
  pickupPointId: null,
});

describe("ListingCard (spec 7.8)", () => {
  it("links its title to the listing page and shows price, shop, campus and trust badge", () => {
    render(<ListingCard listing={braids} campusName="Midrand" />);
    expect(screen.getByRole("heading", { level: 3, name: "Box braids, shoulder length" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Box braids, shoulder length" })).toHaveAttribute("href", "/listings/l-004");
    expect(screen.getByText("From R400")).toBeInTheDocument();
    expect(screen.getByText("Hair studio")).toHaveClass("listing-shop");
    expect(screen.getByText("Midrand")).toBeInTheDocument();
    expect(screen.getByText("Trusted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Box braids, shoulder length" })).toBeInTheDocument();
  });

  it("keeps the photo out of the reading order, since the title follows it", () => {
    const { container } = render(<ListingCard listing={braids} campusName="Midrand" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("shows Swap for a swap-only item and no badge when there is none", () => {
    render(<ListingCard listing={{ ...braids, priceZar: null, payMode: "swap", badge: null }} campusName="Midrand" />);
    expect(screen.getByText("Swap")).toBeInTheDocument();
    expect(screen.queryByText("Trusted")).not.toBeInTheDocument();
  });

  it("tags a sold or paused listing (only Saved shows them, shopping spec 7.1)", () => {
    const { unmount } = render(<ListingCard listing={{ ...braids, availability: "sold" }} campusName="Midrand" />);
    expect(screen.getByText("Sold")).toHaveClass("listing-tag");
    unmount();
    render(<ListingCard listing={{ ...braids, availability: "paused" }} campusName="Midrand" />);
    expect(screen.getByText("Not taking orders")).toHaveClass("listing-tag");
  });

  it("has no tag when the listing is available", () => {
    const { container } = render(<ListingCard listing={braids} campusName="Midrand" />);
    expect(container.querySelector(".listing-tags")).toBeNull();
  });

  it("on Saved, starts its heart pressed and carries a hidden Removed tag for CSS to show (shopping spec 5.3)", () => {
    const html = renderToString(<ListingCard listing={braids} campusName="Midrand" saved />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toMatch(/<p class="listing-tag listing-removed" aria-hidden="true">Removed<\/p>/);
    expect(renderToString(<ListingCard listing={braids} campusName="Midrand" />)).not.toContain("Removed");
  });
});
