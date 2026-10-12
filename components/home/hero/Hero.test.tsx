import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

// The chip reads the cookie on the server; HeroCampusChip.test.tsx covers it.
vi.mock("./HeroCampusChip", () => ({
  HeroCampusChip: () => <button type="button">Shopping at Midrand</button>,
  HeroCampusChipFallback: () => <button type="button">Choose your campus</button>,
}));

describe("Hero", () => {
  it("is a section named by the one H1, built from the sample slides", async () => {
    render(await Hero());
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAccessibleName("Buy & sell textbooks, tech and services on campus");
    expect(screen.getByRole("region", { name: "Buy & sell textbooks, tech and services on campus" })).toContainElement(
      heading,
    );
    expect(screen.getByRole("link", { name: "Shop textbooks" })).toHaveAttribute("href", "/categories/textbooks-notes");
    expect(screen.getByRole("button", { name: "Shopping at Midrand" })).toBeInTheDocument();
  });
});
