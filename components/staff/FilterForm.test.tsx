import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampusFilter } from "./CampusFilter";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("the staff filters (wayfinding spec 3.4)", () => {
  it("is a GET form to the list with a labelled select, every campus first, and a Filter button", () => {
    render(<CampusFilter path="/admin/reports" campuses={CAMPUSES} chosen={null} />);
    const form = screen.getByRole("form", { name: "Filter by campus" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/reports");
    const select = screen.getByRole("combobox", { name: "Campus" });
    expect(select).toHaveAttribute("name", "campus");
    expect([...(select as HTMLSelectElement).options].map((option) => [option.value, option.text])).toEqual([
      ["", "All campuses"],
      ["midrand", "Midrand"],
      ["pretoria", "Pretoria"],
    ]);
    expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("type", "submit");
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing All campuses");
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });

  it("keeps the chosen campus selected, says so in words, and offers Clear", () => {
    render(<CampusFilter path="/admin/reports" campuses={CAMPUSES} chosen={CAMPUSES[1]} />);
    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("pretoria");
    expect(screen.getByText(/^Showing/)).toHaveTextContent("Showing Pretoria · Clear filters");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/admin/reports");
  });
});
