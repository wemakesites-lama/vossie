import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseEmpty } from "./BrowseEmpty";

describe("BrowseEmpty (spec 4.7)", () => {
  it("always offers Looking For", () => {
    render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for it on Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(screen.queryByText(/spelling/)).not.toBeInTheDocument();
  });

  it("suggests checking the spelling after a search", () => {
    render(<BrowseEmpty query={makeBrowseQuery({ q: "zebra", sort: "match" })} elsewhere={0} />);
    expect(screen.getByText("Check the spelling, or try a shorter word.")).toBeInTheDocument();
  });

  it("points to other campuses that have matches", () => {
    const { rerender } = render(<BrowseEmpty query={makeBrowseQuery({ campus: "mbombela" })} elsewhere={36} />);
    expect(screen.getByRole("link", { name: "36 more at other campuses" })).toHaveAttribute("href", "/browse?campus=all");
    rerender(<BrowseEmpty query={makeBrowseQuery({ campus: "mbombela" })} elsewhere={1} />);
    expect(screen.getByRole("link", { name: "1 more at another campus" })).toBeInTheDocument();
  });

  it("offers to clear the filters, keeping the campus", () => {
    render(
      <BrowseEmpty
        query={makeBrowseQuery({ campus: "midrand", campusFromLink: true, price: "free" })}
        elsewhere={0}
      />,
    );
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/browse?campus=midrand");
  });
});
