import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeSeller } from "@/tests/helpers/fakes";
import { SellerHero } from "./SellerHero";

// The session's links are async Server Components; here they're the signed-out links (messaging plan, Task 7).
vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);

// Follow's session part is an async Server Component; here it's the signed-out link (community actions plan, Task 17).
vi.mock("@/components/seller/ViewerFollow", async () => (await import("@/tests/helpers/viewer-follow")).signedOutViewerFollow);

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

  it("sends Message through the sign-in page and on to the shop's composer, and offers Share", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsellers%2Ftech-corner%2Fmessage",
    );
    expect(screen.getByRole("button", { name: "Share" })).toHaveClass("seller-share");
  });

  it("has Follow in a row of its own, through sign-in when signed out (community actions spec 2.16)", () => {
    render(<SellerHero seller={techCorner} campusName="Midrand" />);
    const follow = screen.getByRole("link", { name: "Follow Tech corner" });
    expect(follow).toHaveAttribute("href", "/login?next=%2Fsellers%2Ftech-corner");
    // Its own row: it sits in the band's actions, after Message and Share, in its own box.
    expect(follow.closest(".seller-follow")?.parentElement).toHaveClass("seller-hero-actions");
  });
});
