import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FreeAndSwapsContent, FreeAndSwapsSkeleton } from "./FreeAndSwaps";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const items = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getFreeAndSwaps: async (query: Parameters<typeof actual.getFreeAndSwaps>[0]) => {
      if (items.mode === "failing") throw new Error("The items didn't load");
      return items.mode === "empty" ? [] : actual.getFreeAndSwaps(query);
    },
  };
});

afterEach(() => {
  items.mode = "real";
});

describe("Free & swaps (spec 7.12)", () => {
  it("is a pale panel of stamped items, the campus's own first", async () => {
    viewer.campus = "midrand";
    render(await FreeAndSwapsContent());
    expect(screen.getByRole("region", { name: "Pass it on" })).toBeInTheDocument();
    expect(screen.getByText("Free & swaps")).toHaveClass("text-navy");
    const cards = within(screen.getByRole("region", { name: "Free and swap items" })).getAllByRole("article");
    expect(cards).toHaveLength(8);
    // The denim jacket is swap-only, so it's here too, and it's Midrand's newest (plan decision 6).
    expect(within(cards[0]).getByText("Swap")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Denim jacket, size M" })).toHaveAttribute("href", "/listings/l-010");
    expect(within(cards[1]).getByText("Free")).toBeInTheDocument();
    expect(within(cards[1]).getByRole("link", { name: "Business Management 1 notes" })).toHaveAttribute(
      "href",
      "/listings/fs-001",
    );
    expect(within(cards[1]).getByText("Midrand")).toBeInTheDocument();
    expect(screen.getAllByText("Swap")).toHaveLength(4);
  });

  it("opens every campus from See all, because the panel tops up from other campuses", async () => {
    render(await FreeAndSwapsContent());
    expect(screen.getByRole("link", { name: "See all free and swap items" })).toHaveAttribute(
      "href",
      "/browse?deals=free-and-swaps&campus=all",
    );
  });

  it("hides when there's nothing to give away or swap", async () => {
    items.mode = "empty";
    const { container } = render(await FreeAndSwapsContent());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error state when the items don't load", async () => {
    items.mode = "failing";
    render(await FreeAndSwapsContent());
    expect(screen.getByText("Free & swaps didn't load.")).toBeInTheDocument();
  });

  it("keeps its heading while it streams in", () => {
    render(<FreeAndSwapsSkeleton />);
    expect(screen.getByRole("heading", { level: 2, name: "Pass it on" })).toBeInTheDocument();
  });
});
