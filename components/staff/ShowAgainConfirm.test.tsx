import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HiddenItem } from "@/lib/data/staff-reports";
import { ShowAgainConfirm, showAgainLines } from "./ShowAgainConfirm";

vi.mock("@/lib/staff/admin-actions", () => ({ showListingAgain: async () => {}, showRequestAgain: async () => {} }));

const listing: HiddenItem = {
  kind: "listing",
  id: "l-001",
  title: "Casio fx-991ZA Plus",
  shopName: "Tech corner",
  campusSlug: "midrand",
  hiddenAt: "2026-10-14T08:42:00.000Z",
  reason: "Checking it.",
  listingState: "available",
  shopPausedByHub: false,
  requestClosed: false,
  own: false,
};
const request: HiddenItem = {
  ...listing,
  kind: "request",
  id: "r-001",
  title: "Graphing calculator for MAT2",
  shopName: null,
  listingState: null,
};

describe("Show again's confirm page (stage J spec decision 14)", () => {
  it("says what showing a listing again does, with no reason field, and names its button", () => {
    render(<ShowAgainConfirm item={listing} />);
    expect(screen.getByText('Show "Casio fx-991ZA Plus" again?')).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Buyers will see it in browse, on Tech corner's shop and on its own page again.",
      "Its seller is told. The reports about it stay closed, and the people who made them aren't told.",
      "To hide it again, someone has to report it.",
    ]);
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Show Casio fx-991ZA Plus again" })).toHaveClass("btn-danger");
    expect(document.querySelector('input[name="listing"]')).toHaveValue("l-001");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/admin/hidden");
  });

  it("adds a line for a Hub-paused shop, and for a sold, paused or draft listing", () => {
    expect(showAgainLines({ ...listing, shopPausedByHub: true })).toContain(
      "Tech corner is paused by the Hub, so buyers won't see it until the shop is resumed.",
    );
    expect(showAgainLines({ ...listing, listingState: "sold" })).toContain("It's marked sold, so buyers will see it as sold.");
    expect(showAgainLines({ ...listing, listingState: "paused" })).toContain(
      "It's marked paused, so buyers will see it as paused.",
    );
    expect(showAgainLines({ ...listing, listingState: "draft" })).toContain("It's a draft, so only its seller sees it.");
  });

  it("says what showing a request again does, and that it stays closed if its asker had closed it", () => {
    render(<ShowAgainConfirm item={{ ...request, requestClosed: true }} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Students will see it on Looking For and on its own page again.",
      "The asker is told. The reports about it stay closed, and the people who made them aren't told.",
      "To hide it again, someone has to report it.",
      "Its asker had closed it, so it shows as closed.",
    ]);
    expect(document.querySelector('input[name="request"]')).toHaveValue("r-001");
    expect(screen.getByRole("button", { name: "Show Graphing calculator for MAT2 again" })).toBeInTheDocument();
  });
});
