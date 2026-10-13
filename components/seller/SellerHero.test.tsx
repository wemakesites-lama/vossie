import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeSeller } from "@/tests/helpers/fakes";
import { SellerHero } from "./SellerHero";

const techCorner = makeSeller({
  slug: "tech-corner",
  name: "Tech corner",
  tagline: "Calculators, headsets and chargers, tested before you buy.",
  badge: "responsive",
});

const stamps = () => within(screen.getByRole("list")).getAllByRole("listitem").map((item) => item.textContent);

describe("SellerHero (shopping spec 4.1)", () => {
  it("names the seller in the page's heading, with the tagline and their photo", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByText("Calculators, headsets and chargers, tested before you buy.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "The test seller at work" })).toBeInTheDocument();
  });

  it("stamps the campus, the category and the badge, and leaves Verified off an unverified seller", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(stamps()).toEqual(["Midrand", "Tech", "Responsive"]);
  });

  it("stamps Verified for a verified seller", () => {
    render(<SellerHero seller={{ ...techCorner, verified: true, badge: null }} campusName="Midrand" />);
    expect(stamps()).toEqual(["Midrand", "Tech", "Verified"]);
  });

  it("sends Message through the sign-in page, back to this shop, and offers Share", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner",
    );
    expect(screen.getByRole("button", { name: "Share" })).toHaveClass("seller-share");
  });
});
