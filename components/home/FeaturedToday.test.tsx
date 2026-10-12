import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturedTodayContent, FeaturedTodaySkeleton } from "./FeaturedToday";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const featured = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

// connection() needs Next's request context, which tests don't have.
vi.mock("next/server", () => ({ connection: async () => undefined }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getFeatured: async (query: Parameters<typeof actual.getFeatured>[0]) => {
      if (featured.mode === "failing") throw new Error("The draw didn't load");
      return featured.mode === "empty" ? [] : actual.getFeatured(query);
    },
  };
});

afterEach(() => {
  featured.mode = "real";
});

describe("Featured today (spec 7.10)", () => {
  it("features four verified sellers from the chosen campus", async () => {
    viewer.campus = "midrand";
    render(await FeaturedTodayContent());
    expect(screen.getByRole("heading", { level: 2, name: "Hustles at Midrand" })).toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByRole("link")).toHaveAttribute("href", expect.stringMatching(/^\/sellers\//));
    expect(within(cards[0]).getByText("Featured")).toBeInTheDocument();
    expect(screen.getAllByText("Verified seller.")).toHaveLength(4);
    expect(screen.getAllByText(/· Midrand$/)).toHaveLength(4);
    expect(screen.getByRole("link", { name: "How we pick featured sellers" })).toHaveAttribute("href", "/how-it-works");
  });

  it("features sellers from every campus when none is chosen", async () => {
    viewer.campus = "all";
    render(await FeaturedTodayContent());
    expect(screen.getByRole("heading", { level: 2, name: "Hustles on every campus" })).toBeInTheDocument();
  });

  it("hides when nobody is featured", async () => {
    featured.mode = "empty";
    const { container } = render(await FeaturedTodayContent());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error state when the draw doesn't load", async () => {
    featured.mode = "failing";
    render(await FeaturedTodayContent());
    expect(screen.getByText("Featured today didn't load.")).toBeInTheDocument();
  });

  it("keeps its heading while it streams in", () => {
    render(<FeaturedTodaySkeleton />);
    expect(screen.getByRole("heading", { level: 2, name: "Hustles on campus" })).toBeInTheDocument();
  });
});
