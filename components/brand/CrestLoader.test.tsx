import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrestLoader } from "./CrestLoader";

describe("CrestLoader", () => {
  it("draws the navy crest as decoration and says Loading in a status", () => {
    const { container } = render(<CrestLoader />);
    const crest = container.querySelector("img");
    expect(crest).toHaveAttribute("alt", "");
    expect(crest?.getAttribute("src")).toMatch(/crest-navy/);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
