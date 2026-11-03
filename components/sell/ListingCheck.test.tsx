import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingCheck } from "./ListingCheck";

describe("ListingCheck (AI features spec 3)", () => {
  it("names the guideline, links to the rules and the title, and posts the concern with Publish anyway", () => {
    render(
      <form>
        <ListingCheck concern="counterfeit" prefix="new-listing" />
      </form>,
    );
    const alert = screen.getByRole("alert", { name: "Check this before you publish" });
    expect(alert).toHaveTextContent(
      "This may break the seller guidelines: counterfeit goods. If it doesn't, publish it anyway and the Hub will take a look.",
    );
    expect(screen.getByRole("link", { name: "Edit listing" })).toHaveAttribute("href", "#new-listing-title");
    expect(screen.getByRole("link", { name: "What can't be sold" })).toHaveAttribute(
      "href",
      "/seller-guidelines#guidelines-banned",
    );
    const anyway = screen.getByRole("button", { name: "Publish anyway" });
    expect(anyway).toHaveAttribute("name", "anyway");
    expect(anyway).toHaveAttribute("value", "counterfeit");
  });

  it("says save, not publish, for a paused or sold listing, which a save leaves as it is", () => {
    render(
      <form>
        <ListingCheck concern="stolen" prefix="edit-l-001" saving />
      </form>,
    );
    expect(screen.getByRole("alert", { name: "Check this before you save" })).toHaveTextContent("save it anyway");
    expect(screen.getByRole("button", { name: "Save anyway" })).toHaveAttribute("value", "stolen");
  });
});
