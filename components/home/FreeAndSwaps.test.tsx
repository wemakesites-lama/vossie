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
    expect(cards).toHaveLength(7);
    expect(within(cards[0]).getByText("Free")).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Business Management 1 notes" })).toHaveAttribute(
      "href",
      "/listings/fs-001",
    );
    expect(within(cards[0]).getByText("Midrand")).toBeInTheDocument();
    expect(screen.getAllByText("Swap")).toHaveLength(3);
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
