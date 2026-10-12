import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComingSoon } from "./ComingSoon";

describe("ComingSoon", () => {
  it("titles the page, explains it and links home", () => {
    render(<ComingSoon title="Browse">Filters arrive later.</ComingSoon>);
    expect(screen.getByRole("heading", { level: 1, name: "Browse" })).toBeInTheDocument();
    expect(screen.getByText("Coming in the next stage")).toBeInTheDocument();
    expect(screen.getByText("Filters arrive later.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("href", "/");
  });
});
