import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WordsSearch } from "@/lib/data/words-search";
import type { BrowseQuery } from "@/lib/types";
import { BrowseView } from "./BrowseView";

const viewer = vi.hoisted(() => ({ campus: "all" }));
const search = vi.hoisted(() => ({ failing: false }));
// The words search (AI stage E): the words as typed unless a test reads them into filters.
const words = vi.hoisted(() => ({ read: null as null | ((typed: BrowseQuery) => WordsSearch) }));

vi.mock("@/lib/data/words-search", () => ({
  wordsSearchFor: async (typed: BrowseQuery): Promise<WordsSearch> =>
    words.read ? words.read(typed) : { query: typed, line: null, typed },
}));

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

// Save this search's session part is an async Server Component; here it's the signed-out row (search alerts plan,
// Task 4). The actions only need something to post to.
vi.mock("@/components/browse/ViewerSaveSearch", async () =>
  (await import("@/tests/helpers/viewer-save-search")).signedOutViewerSaveSearch,
);
vi.mock("@/lib/saved-searches/actions", () => ({ saveThisSearch: async () => {} }));

afterEach(() => {
  viewer.campus = "all";
  search.failing = false;
  words.read = null;
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

  it("offers Save this search for a search, through sign-in, and not on plain browse (search alerts spec 2.4 and 2.5)", async () => {
    const { unmount } = await view({ q: "calculator" });
    expect(screen.getByRole("link", { name: "Save this search" })).toHaveAttribute(
      "href",
      "/login?next=%2Fbrowse%3Fq%3Dcalculator",
    );
    unmount();
    viewer.campus = "midrand";
    await view();
    expect(screen.queryByRole("link", { name: "Save this search" })).toBeNull();
  });

  it("offers it above the empty state too, when nothing matches yet (search alerts spec 2.5)", async () => {
    await view({ q: "xylophone", campus: "midrand" });
    const save = screen.getByRole("link", { name: "Save this search" });
    const empty = screen.getByRole("heading", { level: 2, name: "Nothing here yet" });
    expect(save.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("BrowseView's words search (AI features spec 6)", () => {
  const parsed = (typed: BrowseQuery): WordsSearch => ({
    query: { ...typed, q: "calculator", price: "under-500", campus: "midrand", campusFromLink: true, exact: true },
    line: "Showing calculator under R500 at Midrand.",
    typed,
  });

  it("shows the filters a sentence asked for, the line above the results and a link to the exact words", async () => {
    words.read = parsed;
    await view({ q: "calculator under R300 at Midrand" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("“calculator”");
    const line = screen.getByText(/^Showing calculator under R500 at Midrand\./);
    expect(screen.getByRole("link", { name: "Search for exactly what I typed" })).toHaveAttribute(
      "href",
      "/browse?q=calculator+under+R300+at+Midrand&exact=1",
    );
    const card = screen.getAllByRole("article")[0];
    expect(line.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The chips keep exact=1, so following one never reads the words again.
    expect(screen.getByRole("link", { name: "Remove filter: Under R500" })).toHaveAttribute(
      "href",
      "/browse?q=calculator&campus=midrand&exact=1",
    );
  });

  it("shows no line when the words are searched as typed", async () => {
    const { container } = await view({ q: "calculator" });
    expect(container.querySelector(".browse-words")).toBeNull();
    expect(screen.queryByRole("link", { name: "Search for exactly what I typed" })).toBeNull();
  });
});
