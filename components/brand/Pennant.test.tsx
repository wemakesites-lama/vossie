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
    expect(pennant).not.toHaveClass("pennant-mini");
    expect(pennant.querySelector("img")).toHaveAttribute("loading", "eager");
  });

  it("has the footer lockup from the mockup: a white pennant with the navy crest", () => {
    const { container } = render(<Pennant size="small" />);
    const lockup = container.firstElementChild!;
    expect(lockup).toHaveAttribute("aria-hidden", "true");
    expect(lockup).toHaveClass("pennant-mini");
    expect(lockup).not.toHaveClass("pennant");
    const crest = lockup.querySelector("img");
    expect(crest).toHaveAttribute("alt", "");
    expect(crest?.getAttribute("src")).toMatch(/crest-navy/);
    expect(crest).toHaveAttribute("loading", "lazy");
  });

  it("passes a class through on both sizes", () => {
    const { container: header } = render(<Pennant className="extra" />);
    expect(header.firstElementChild).toHaveClass("pennant", "extra");
    const { container: footer } = render(<Pennant size="small" className="extra" />);
    expect(footer.firstElementChild).toHaveClass("pennant-mini", "extra");
  });
});
