import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseToolbar } from "./BrowseToolbar";

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
    expect(screen.getByText("Showing 24 of 36")).toBeInTheDocument();
  });

  it("lets one menu open at a time where the browser supports it", () => {
    const { container } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={1} />);
    const menus = container.querySelectorAll("details");
    expect(menus).toHaveLength(2);
    for (const menu of menus) expect(menu).toHaveAttribute("name", "browse-tools");
  });

  it("hides the count when nothing matches or the search failed", () => {
    const { rerender } = render(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={0} />);
    expect(screen.queryByText(/listing/)).not.toBeInTheDocument();
    rerender(<BrowseToolbar query={makeBrowseQuery()} campuses={[]} total={null} />);
    expect(screen.queryByText(/listing/)).not.toBeInTheDocument();
  });
});
