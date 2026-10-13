import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import type { Campus } from "@/lib/types";
import { FiltersPanel } from "./FiltersPanel";

const campus = (slug: string, name: string): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings: 1,
  image: { src: "/p.svg", alt: "" },
});
const campuses = [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")];

const hiddenFields = (container: HTMLElement) =>
  Object.fromEntries(
    [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((input) => [input.name, input.value]),
  );

describe("FiltersPanel (spec 4.4)", () => {
  it("is a GET form to /browse that keeps the search, category, deals and a chosen sort", () => {
    const { container } = render(
      <FiltersPanel
        query={makeBrowseQuery({ q: "lamp", category: "res-living", deals: "free-and-swaps", sort: "price-low" })}
        campuses={campuses}
      />,
    );
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/browse");
    expect(form).not.toHaveAttribute("method", "post");
    expect(hiddenFields(container)).toEqual({ q: "lamp", cat: "res-living", deals: "free-and-swaps", sort: "price-low" });
  });

  it("leaves the default sort out", () => {
    const { container } = render(<FiltersPanel query={makeBrowseQuery({ q: "lamp", sort: "match" })} campuses={campuses} />);
    expect(hiddenFields(container)).toEqual({ q: "lamp" });
  });

  it("offers every campus, Every campus first, with the current one selected", () => {
    render(<FiltersPanel query={makeBrowseQuery({ campus: "midrand" })} campuses={campuses} />);
    const select = screen.getByRole("combobox", { name: "Campus" });
    expect(select).toHaveValue("midrand");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Every campus",
      "Midrand",
      "Pretoria",
    ]);
  });

  it("groups price and pay as radios, with the current ones checked", () => {
    render(<FiltersPanel query={makeBrowseQuery({ price: "under-100", pay: "swap" })} campuses={campuses} />);
    const price = screen.getByRole("group", { name: "Price" });
    expect(within(price).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Any",
      "Free",
      "Under R50",
      "Under R100",
      "Under R250",
      "Under R500",
    ]);
    expect(within(price).getByRole("radio", { name: "Under R100" })).toBeChecked();
    const pay = screen.getByRole("group", { name: "Paid with" });
    expect(within(pay).getByRole("radio", { name: "Swaps" })).toBeChecked();
    expect(within(pay).getByRole("radio", { name: "Any" })).not.toBeChecked();
  });

  it("checks Any when no price or pay is chosen", () => {
    render(<FiltersPanel query={makeBrowseQuery()} campuses={campuses} />);
    expect(within(screen.getByRole("group", { name: "Price" })).getByRole("radio", { name: "Any" })).toBeChecked();
    expect(within(screen.getByRole("group", { name: "Paid with" })).getByRole("radio", { name: "Any" })).toBeChecked();
  });

  it("shows results with a submit button, and clears to every campus with no filters", () => {
    render(<FiltersPanel query={makeBrowseQuery({ campus: "midrand", price: "free" })} campuses={campuses} />);
    expect(screen.getByRole("button", { name: "Show results" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/browse?campus=all");
  });
});
