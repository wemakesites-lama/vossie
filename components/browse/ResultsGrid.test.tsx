import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery, makeListing } from "@/tests/helpers/fakes";
import { ResultsGrid } from "./ResultsGrid";

const names = new Map([["midrand", "Midrand"]]);
const listings = (count: number) =>
  Array.from({ length: count }, (_, n) => makeListing({ id: `l-${n + 1}`, title: `Listing ${n + 1}` }));

describe("ResultsGrid (spec 4.6)", () => {
  it("lists the cards under a hidden Results heading, each with a numbered id", () => {
    const { container } = render(
      <ResultsGrid items={listings(3)} total={3} query={makeBrowseQuery()} campusNames={names} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Results" })).toHaveClass("sr-only");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(container.querySelector("li#r-3")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("offers Show more when there are more, landing on the first new card", () => {
    render(
      <ResultsGrid items={listings(24)} total={36} query={makeBrowseQuery({ category: "tech" })} campusNames={names} />,
    );
    expect(screen.getByRole("link", { name: "Show more" })).toHaveAttribute("href", "/browse?cat=tech&n=48#r-25");
  });
});
