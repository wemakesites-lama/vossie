import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { ActiveFilters } from "./ActiveFilters";

const names = new Map([["midrand", "Midrand"]]);

describe("ActiveFilters (spec 4.5)", () => {
  it("shows nothing with no filters on", () => {
    const { container } = render(<ActiveFilters query={makeBrowseQuery()} campusNames={names} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("makes each filter a link that removes it", () => {
    render(<ActiveFilters query={makeBrowseQuery({ campus: "midrand" })} campusNames={names} />);
    const chip = screen.getByRole("link", { name: "Remove filter: Midrand" });
    expect(chip).toHaveAttribute("href", "/browse?campus=all");
    expect(chip).toHaveTextContent("Midrand");
    expect(screen.queryByRole("link", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("adds Clear all with two or more chips", () => {
    render(<ActiveFilters query={makeBrowseQuery({ campus: "midrand", price: "free" })} campusNames={names} />);
    expect(screen.getByRole("list", { name: "Active filters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", "/browse?campus=all");
  });
});
