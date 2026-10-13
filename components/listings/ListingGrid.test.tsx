import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { ListingGrid } from "./ListingGrid";

const items = [
  makeListing({ id: "l-a", title: "Kettle", campusSlug: "pretoria" }),
  makeListing({ id: "l-b", title: "Lamp", campusSlug: "midrand" }),
];
const names = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

describe("ListingGrid (shopping spec 7.1)", () => {
  it("lists one card per listing, in order, each with its campus", () => {
    render(<ListingGrid listings={items} campusNames={names} columns="five" />);
    const cards = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual(["Kettle", "Lamp"]);
    expect(within(cards[0]).getByText("Pretoria")).toBeInTheDocument();
  });

  it("names its column setting for CSS", () => {
    render(<ListingGrid listings={items} campusNames={names} columns="four" />);
    expect(screen.getByRole("list")).toHaveClass("card-grid");
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "four");
  });

  it("tells every card it's saved, on the Saved page", () => {
    const html = renderToString(<ListingGrid listings={items} campusNames={names} columns="five" saved />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });
});
