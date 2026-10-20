import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HiddenItem } from "@/lib/data/staff-reports";
import { AdminHidden } from "./AdminHidden";

const listing: HiddenItem = {
  kind: "listing",
  id: "l-001",
  title: "Casio fx-991ZA Plus calculator",
  shopName: "Tech corner",
  campusSlug: "midrand",
  hiddenAt: "2026-10-14T08:42:00.000Z",
  reason: "Exam papers aren't allowed.",
  listingState: "available",
  shopPausedByHub: false,
  requestClosed: false,
};
const request: HiddenItem = {
  ...listing,
  kind: "request",
  id: "r-001",
  title: "Graphing calculator for MAT2",
  shopName: null,
  listingState: null,
};
const campusNames = new Map([["midrand", "Midrand"]]);

describe("hidden listings and requests (stage J spec decision 14)", () => {
  it("lists hidden listings with their shop, campus, date and reason, each with Show again", () => {
    render(<AdminHidden listings={[listing]} requests={[request]} campusNames={campusNames} />);
    const table = screen.getByRole("table", { name: "Hidden listings (1)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Listing",
      "Shop",
      "Campus",
      "Hidden on",
      "Reason",
      "Show again",
    ]);
    const row = within(table).getAllByRole("row")[1];
    expect(row).toHaveTextContent(/Casio fx-991ZA Plus calculator.*Tech corner.*Midrand.*14 Oct.*Exam papers aren't allowed\./);
    expect(within(row).getByRole("link", { name: "Show again: Casio fx-991ZA Plus calculator" })).toHaveAttribute(
      "href",
      "/admin/hidden/listings/l-001",
    );
    expect(within(row).getByText("14 Oct")).toHaveAttribute("datetime", "2026-10-14T08:42:00.000Z");
  });

  it("lists hidden requests without anyone's name", () => {
    render(<AdminHidden listings={[]} requests={[request]} campusNames={campusNames} />);
    const table = screen.getByRole("table", { name: "Hidden requests (1)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Request",
      "Campus",
      "Hidden on",
      "Reason",
      "Show again",
    ]);
    expect(within(table).getByRole("link", { name: "Show again: Graphing calculator for MAT2" })).toHaveAttribute(
      "href",
      "/admin/hidden/requests/r-001",
    );
  });

  it("says so when nothing is hidden", () => {
    render(<AdminHidden listings={[]} requests={[]} campusNames={campusNames} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No hidden listings.")).toBeInTheDocument();
    expect(screen.getByText("No hidden requests.")).toBeInTheDocument();
  });
});
