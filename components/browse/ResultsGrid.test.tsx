import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBrowseQuery, makeListing } from "@/tests/helpers/fakes";
import { ResultsGrid } from "./ResultsGrid";

// ScrollToResult renders nothing, so a marker stands in for it. Its own behaviour is tested in ScrollToResult.test.tsx.
vi.mock("./ScrollToResult", async () => {
  const { createElement } = await import("react");
  return { ScrollToResult: () => createElement("span", { "data-testid": "scroll-to-result" }) };
});

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

  it("finishes the scroll to the new card only once Show more has been used", () => {
    const { rerender } = render(
      <ResultsGrid items={listings(24)} total={36} query={makeBrowseQuery()} campusNames={names} />,
    );
    expect(screen.queryByTestId("scroll-to-result")).not.toBeInTheDocument();
    rerender(<ResultsGrid items={listings(36)} total={36} query={makeBrowseQuery({ shown: 48 })} campusNames={names} />);
    expect(screen.getByTestId("scroll-to-result")).toBeInTheDocument();
  });
});
