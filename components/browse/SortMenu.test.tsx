import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { SortMenu } from "./SortMenu";

describe("SortMenu (spec 4.4)", () => {
  it("lists the sorts as links, the current one marked, each starting from the top", () => {
    render(<SortMenu query={makeBrowseQuery({ category: "tech", shown: 48 })} />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Newest",
      "Price: low to high",
      "Price: high to low",
    ]);
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Price: low to high" })).toHaveAttribute(
      "href",
      "/browse?cat=tech&sort=price-low",
    );
  });

  it("offers Best match first, and only with a search", () => {
    render(<SortMenu query={makeBrowseQuery({ q: "lamp", sort: "match" })} />);
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Best match");
    expect(screen.getByRole("link", { name: "Best match" })).toHaveAttribute("href", "/browse?q=lamp");
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute("href", "/browse?q=lamp&sort=new");
  });
});
