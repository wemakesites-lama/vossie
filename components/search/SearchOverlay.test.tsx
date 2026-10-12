import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { openOverlay } from "@/lib/overlays";
import { addRecentSearch, getRecentSearches } from "@/lib/recent-searches";
import type { Campus, Category, TrendingSearches } from "@/lib/types";
import { SearchOverlay } from "./SearchOverlay";

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "pretoria", name: "Pretoria", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];
const categories: Category[] = [{ slug: "tech", name: "Tech", image: { src: "/p.svg", alt: "" } }];
const trending: TrendingSearches = {
  all: ["Scientific calculator", "Laptop charger", "Statistics notes"],
  midrand: ["Braids", "Desk lamp", "Gaming headset"],
};

function openSearch() {
  render(
    <>
      <button type="button">Search trigger</button>
      <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Search trigger" });
  act(() => openOverlay("search", trigger));
  return screen.getByRole("dialog", { name: "Search Vossie" });
}

/** jsdom can't navigate and reports it on every link click. Cancel the click's default once React has handled it. */
function swallowNavigation() {
  document.addEventListener("click", (event) => event.preventDefault(), { once: true });
}

describe("SearchOverlay", () => {
  it("opens with the search box focused and shows trending searches for all campuses", () => {
    const dialog = openSearch();
    expect(within(dialog).getByRole("searchbox", { name: "Search Vossie" })).toHaveFocus();
    expect(within(dialog).getByRole("heading", { name: "Trending on Vossie" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Laptop charger" })).toHaveAttribute(
      "href",
      "/browse?q=Laptop%20charger",
    );
  });

  it("shows trending searches for the chosen campus", () => {
    setCampusChoice("midrand");
    const dialog = openSearch();
    expect(within(dialog).getByRole("heading", { name: "Trending at Midrand" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Braids" })).toBeInTheDocument();
  });

  it("falls back to all-campus terms when the campus has none of its own", () => {
    setCampusChoice("pretoria");
    const dialog = openSearch();
    expect(within(dialog).getByRole("heading", { name: "Trending at Pretoria" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Scientific calculator" })).toBeInTheDocument();
  });

  it("falls back to all-campus terms when the campus list is empty", () => {
    setCampusChoice("pretoria");
    render(
      <>
        <button type="button">Search trigger</button>
        <SearchOverlay campuses={campuses} categories={categories} trending={{ ...trending, pretoria: [] }} />
      </>,
    );
    act(() => openOverlay("search", screen.getByRole("button", { name: "Search trigger" })));
    const dialog = screen.getByRole("dialog", { name: "Search Vossie" });
    expect(within(dialog).getByRole("link", { name: "Scientific calculator" })).toBeInTheDocument();
  });

  it("remembers a submitted search and closes", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    await user.type(within(dialog).getByRole("searchbox", { name: "Search Vossie" }), "  calculator {enter}");
    expect(getRecentSearches()).toEqual(["calculator"]);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("ignores an empty search", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    await user.type(within(dialog).getByRole("searchbox", { name: "Search Vossie" }), "   {enter}");
    expect(getRecentSearches()).toEqual([]);
    expect(dialog).toHaveAttribute("open");
  });

  it("lists recent searches and clears them", async () => {
    const user = userEvent.setup();
    addRecentSearch("Mini fridge");
    const dialog = openSearch();
    expect(within(dialog).getByRole("link", { name: "Mini fridge" })).toHaveAttribute(
      "href",
      "/browse?q=Mini%20fridge",
    );
    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    expect(getRecentSearches()).toEqual([]);
    expect(within(dialog).getByRole("heading", { name: "Trending on Vossie" })).toHaveFocus();
  });

  it("links every category", () => {
    const dialog = openSearch();
    expect(within(dialog).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/categories/tech");
  });

  it("remembers a chip's term and closes when the chip is followed", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    swallowNavigation();
    await user.click(within(dialog).getByRole("link", { name: "Laptop charger" }));
    expect(getRecentSearches()).toEqual(["Laptop charger"]);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("closes without remembering anything when a category is followed", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    swallowNavigation();
    await user.click(within(dialog).getByRole("link", { name: "Tech" }));
    expect(getRecentSearches()).toEqual([]);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("stays open and remembers nothing on a click that opens a new tab", () => {
    const dialog = openSearch();
    swallowNavigation();
    fireEvent.click(within(dialog).getByRole("link", { name: "Laptop charger" }), { metaKey: true });
    expect(getRecentSearches()).toEqual([]);
    expect(dialog).toHaveAttribute("open");
  });

  it("reopens with the last query selected, so typing replaces it", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    const box = within(dialog).getByRole<HTMLInputElement>("searchbox", { name: "Search Vossie" });
    await user.type(box, "calc");
    await user.click(within(dialog).getByRole("button", { name: "Close search" }));
    act(() => openOverlay("search", screen.getByRole("button", { name: "Search trigger" })));
    expect(box).toHaveFocus();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, 4]);
  });

  it("limits a query to 100 characters", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    const box = within(dialog).getByRole<HTMLInputElement>("searchbox", { name: "Search Vossie" });
    await user.paste("x".repeat(120));
    expect(box.value).toHaveLength(100);
  });
});
