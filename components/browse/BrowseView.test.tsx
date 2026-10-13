import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowseView } from "./BrowseView";

const viewer = vi.hoisted(() => ({ campus: "all" }));
const search = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    searchListings: async (query: Parameters<typeof actual.searchListings>[0]) => {
      if (search.failing) throw new Error("The search didn't run");
      return actual.searchListings(query);
    },
  };
});

afterEach(() => {
  viewer.campus = "all";
  search.failing = false;
});

const view = async (params: Record<string, string> = {}) =>
  render(await BrowseView({ searchParams: Promise.resolve(params) }));

describe("BrowseView (spec 4.1 to 4.7)", () => {
  it("shows a category with its tab current and its listings", async () => {
    await view({ cat: "tech" });
    expect(screen.getByRole("heading", { level: 1, name: "Tech" })).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Categories" });
    expect(within(tabs).getByRole("link", { name: "Tech" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getByText("5 listings")).toBeInTheDocument();
  });

  it("starts on the viewer's campus, with a chip to see every campus", async () => {
    viewer.campus = "midrand";
    await view();
    expect(screen.getByRole("link", { name: "Remove filter: Midrand" })).toHaveAttribute("href", "/browse?campus=all");
    expect(screen.getAllByRole("article")).toHaveLength(14);
  });

  it("lets a campus in the link win over the viewer's", async () => {
    viewer.campus = "midrand";
    await view({ campus: "all" });
    expect(screen.queryByRole("link", { name: /^Remove filter/ })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 24 of 36")).toBeInTheDocument();
  });

  it("shows the first 24, and Show more lands on the 25th", async () => {
    await view();
    expect(screen.getAllByRole("article")).toHaveLength(24);
    expect(screen.getByRole("link", { name: "Show more" })).toHaveAttribute("href", "/browse?n=48#r-25");
  });

  it("finds a search across every campus, best match first", async () => {
    await view({ q: "calculator" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("“calculator”");
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("offers other campuses when the viewer's has nothing", async () => {
    viewer.campus = "mbombela";
    await view();
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "36 more at other campuses" })).toHaveAttribute("href", "/browse?campus=all");
  });

  it("says so when the search fails, with a link to try again", async () => {
    search.failing = true;
    await view({ cat: "food" });
    expect(screen.getByText("We couldn't load listings just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/browse?cat=food");
    expect(screen.getByRole("heading", { level: 1, name: "Food" })).toBeInTheDocument();
  });
});
