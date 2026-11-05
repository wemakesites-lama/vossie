import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARK, starPath } from "@/lib/brand/cart-mark";
import { CartMark } from "./CartMark";

describe("CartMark", () => {
  it("is decorative and draws the full mark from the geometry module", () => {
    const { container } = render(<CartMark className="extra" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("viewBox", "0 0 200 175");
    expect(svg).toHaveClass("cart-mark", "extra");
    expect(svg).not.toHaveClass("cart-mark--sky");
    const paths = [...svg.querySelectorAll("path")].map((path) => path.getAttribute("d"));
    expect(paths).toEqual([
      MARK.full.handle,
      MARK.full.rim,
      MARK.full.smallStars.map(starPath).join(""),
      starPath(MARK.full.bigStar),
    ]);
    expect(svg.querySelectorAll("circle")).toHaveLength(2);
  });

  it("asks for the sky star only when told to", () => {
    const { container } = render(<CartMark sky />);
    expect(container.querySelector("svg")).toHaveClass("cart-mark--sky");
    expect(container.querySelectorAll(".cart-mark-star")).toHaveLength(1);
  });
});
