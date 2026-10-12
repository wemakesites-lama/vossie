import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroCampusChip, HeroCampusChipFallback } from "./HeroCampusChip";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

describe("HeroCampusChip", () => {
  it("names the chosen campus and opens the picker", async () => {
    viewer.campus = "midrand";
    render(await HeroCampusChip());
    expect(screen.getByRole("button", { name: "Shopping at Midrand" })).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("says when the visitor shops every campus", async () => {
    viewer.campus = "all";
    render(await HeroCampusChip());
    expect(screen.getByRole("button", { name: "Shopping all campuses" })).toBeInTheDocument();
  });

  it("asks for a campus until the cookie has been read", () => {
    render(<HeroCampusChipFallback />);
    expect(screen.getByRole("button", { name: "Choose your campus" })).toBeInTheDocument();
  });
});
