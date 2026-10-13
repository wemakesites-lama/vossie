import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import type { Campus } from "@/lib/types";
import { BrowseToolbar } from "./BrowseToolbar";

const campus = (slug: string, name: string): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings: 1,
  image: { src: "/p.svg", alt: "" },
});

describe("BrowseToolbar (spec 4.4, 4.6)", () => {
  it("names the Filters button with how many filters are on (plan decision 2)", () => {
    const { container } = render(
      <BrowseToolbar query={makeBrowseQuery({ campus: "midrand", price: "free" })} campuses={[]} total={14} />,
    );
    const summary = container.querySelector(".tool-filters > summary");
    expect(summary).toHaveAttribute("aria-label", "Filters, 2 active");
    expect(summary).toHaveTextContent("Filters (2)");
  });

  it("says just Filters with none on, and shows the sort and the count", () => {
    const { container } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={36} />);
    expect(container.querySelector(".tool-filters > summary")).toHaveAttribute("aria-label", "Filters");
    expect(container.querySelector(".tool-sort > summary")).toHaveTextContent("Sort: Newest");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 24 of 36");
    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
  });

  it("starts fresh when the campus changes, so Filters never offers the old campus (plan decision 5)", () => {
    const campuses = [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")];
    const { container, rerender } = render(
      <BrowseToolbar query={makeBrowseQuery({ campus: "midrand" })} campuses={campuses} total={14} />,
    );
    container.querySelector<HTMLDetailsElement>(".tool-filters")!.open = true;
    // The campus picker refreshes the page: same link, new campus from the cookie.
    rerender(<BrowseToolbar query={makeBrowseQuery({ campus: "pretoria" })} campuses={campuses} total={5} />);
    expect(screen.getByRole("combobox", { name: "Campus" })).toHaveValue("pretoria");
    expect(container.querySelector<HTMLDetailsElement>(".tool-filters")!.open).toBe(false);
  });

  it("lets one menu open at a time where the browser supports it", () => {
    const { container } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={1} />);
    const menus = container.querySelectorAll("details");
    expect(menus).toHaveLength(2);
    for (const menu of menus) expect(menu).toHaveAttribute("name", "browse-tools");
  });

  it("keeps the count as a status message, hidden from view when nothing matches or the search failed", () => {
    const { rerender } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("No listings");
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    rerender(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={null} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
