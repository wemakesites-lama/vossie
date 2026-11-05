import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrestLoader } from "./CrestLoader";

describe("CrestLoader", () => {
  it("draws the CampusCart mark as decoration, with no sky star, and says Loading in a status", () => {
    const { container } = render(<CrestLoader />);
    const mark = container.querySelector("svg.cart-mark");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveClass("crest-loader-mark");
    // On the page's surface, which is white in Light: sky never sits on white (logo spec 2.3).
    expect(mark).not.toHaveClass("cart-mark--sky");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
