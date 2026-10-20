import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavLink } from "./NavLink";

describe("NavLink", () => {
  it("marks the link to the current page", () => {
    render(<NavLink href="/">Home</NavLink>);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves other links unmarked and passes the class through", () => {
    render(
      <NavLink href="/sell" className="menu-link">
        Sell
      </NavLink>,
    );
    const link = screen.getByRole("link", { name: "Sell" });
    expect(link).not.toHaveAttribute("aria-current");
    expect(link).toHaveAttribute("href", "/sell");
    expect(link).toHaveClass("menu-link");
  });

  it("marks a section's pages when asked, and not its neighbours", () => {
    render(
      <>
        <NavLink href="/" match="section">
          Home
        </NavLink>
        <NavLink href="/sel" match="section">
          Not sell
        </NavLink>
      </>,
    );
    // The tests' page is /, so only the exact match counts; a section never matches a longer word.
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Not sell" })).not.toHaveAttribute("aria-current");
  });

  it("passes prefetch through", () => {
    render(
      <NavLink href="/browse" prefetch={false}>
        Shop
      </NavLink>,
    );
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/browse");
  });
});
