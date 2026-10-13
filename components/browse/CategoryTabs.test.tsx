import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import type { Category } from "@/lib/types";
import { CategoryTabs } from "./CategoryTabs";

const categories: Category[] = [
  { slug: "tech", name: "Tech", image: { src: "/p.svg", alt: "" } },
  { slug: "food", name: "Food", image: { src: "/p.svg", alt: "" } },
];

describe("CategoryTabs (spec 4.3)", () => {
  it("lists All and each category as links, the chosen one current", () => {
    render(<CategoryTabs query={makeBrowseQuery({ category: "tech" })} categories={categories} />);
    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["All", "Tech", "Food"]);
    expect(within(nav).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the search and filters, and starts the results from the top", () => {
    render(
      <CategoryTabs
        query={makeBrowseQuery({ q: "lamp", sort: "match", category: "tech", price: "under-250", shown: 48 })}
        categories={categories}
      />,
    );
    expect(screen.getByRole("link", { name: "Food" })).toHaveAttribute("href", "/browse?q=lamp&cat=food&price=under-250");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/browse?q=lamp&price=under-250");
  });

  it("marks All when no category is chosen", () => {
    render(<CategoryTabs query={makeBrowseQuery()} categories={categories} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });
});
