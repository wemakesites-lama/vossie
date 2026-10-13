import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShopByCategory } from "./ShopByCategory";

describe("ShopByCategory (spec 7.5)", () => {
  it("is a carousel of the ten categories under its heading", async () => {
    render(await ShopByCategory());
    expect(screen.getByRole("heading", { level: 2, name: "Shop by category" })).toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: "Categories" });
    const tiles = within(carousel).getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/browse?cat="));
    expect(tiles).toHaveLength(10);
    expect(within(carousel).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/browse?cat=tech");
    expect(screen.getByRole("link", { name: "All categories" })).toHaveAttribute("href", "/browse");
  });

  it("keeps the tile photos out of the reading order, since the name follows", async () => {
    const { container } = render(await ShopByCategory());
    for (const image of container.querySelectorAll(".category-tile img")) expect(image).toHaveAttribute("alt", "");
  });

  it("offers the budget filters as a labelled list", async () => {
    render(await ShopByCategory());
    const budgets = screen.getByRole("list", { name: "Shop by budget" });
    expect(within(budgets).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/browse?max=50",
      "/browse?max=100",
      "/browse?max=250",
      "/browse?price=free",
      "/browse?pay=swap",
    ]);
    expect(within(budgets).getByRole("link", { name: "Swaps" })).toBeInTheDocument();
  });
});
