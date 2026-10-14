import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getSeller } from "@/lib/data";
import { SellerView } from "./SellerView";

// The async listings are tested on their own; here they stand in (jsdom can't render async components in a tree).
vi.mock("./SellerListings", () => ({ SellerListings: () => <section aria-label="Listings, stood in" /> }));

// The session's links are async Server Components; here they're the signed-out links (messaging plan, Task 7).
vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);

async function show(slug: string) {
  render(<SellerView seller={(await getSeller(slug))!} campusNames={new Map([["midrand", "Midrand"]])} />);
}

describe("SellerView (shopping spec 4.1)", () => {
  it("leads with the band, then About in the seller's own words and the month they started", async () => {
    await show("tech-corner");
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeInTheDocument();
    expect(screen.getByText(/I test every calculator, headset and charger/)).toHaveClass("seller-about-text");
    expect(screen.getByText("Selling since March 2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Listings, stood in" })).toBeInTheDocument();
  });

  it("ends with a report link through the sign-in page", async () => {
    await show("tech-corner");
    expect(screen.getByRole("link", { name: "Report this seller" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport%3Fseller%3Dtech-corner",
    );
  });
});
