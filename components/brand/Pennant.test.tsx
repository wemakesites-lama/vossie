import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pennant } from "./Pennant";

describe("Pennant", () => {
  it("is decorative and draws the crest", () => {
    const { container } = render(<Pennant />);
    const pennant = container.firstElementChild!;
    expect(pennant).toHaveAttribute("aria-hidden", "true");
    expect(pennant).toHaveClass("pennant");
    expect(pennant.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("has a small variant for the footer", () => {
    const { container } = render(<Pennant size="small" />);
    expect(container.firstElementChild).toHaveClass("pennant", "pennant--small");
  });
});
