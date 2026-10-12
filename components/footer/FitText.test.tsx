import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FitText } from "./FitText";

describe("FitText", () => {
  it("sizes the text to its parent's content width", () => {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1020);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 340,
      height: 80,
      top: 0,
      left: 0,
      right: 340,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    render(
      <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
        <FitText>VOSSIE</FitText>
      </div>,
    );
    // Content width 1000px; text measured at 340px when set to 100px, so 100 × 1000 / 340.
    expect(screen.getByText("VOSSIE")).toHaveStyle({ fontSize: "294.1px" });
  });
});
