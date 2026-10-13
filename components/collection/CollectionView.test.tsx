import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCampuses, getCategories, getCollection, getCollectionListings, getCollections } from "@/lib/data";
import type { Listing } from "@/lib/types";
import { CollectionView } from "./CollectionView";

async function show(slug: string, listings?: readonly Listing[] | null) {
  const [collection, collections, categories, campuses] = await Promise.all([
    getCollection(slug),
    getCollections(),
    getCategories(),
    getCampuses(),
  ]);
  render(
    <CollectionView
      collection={collection!}
      listings={listings === undefined ? await getCollectionListings(slug) : listings}
      others={collections.filter((item) => item.slug !== slug)}
      categories={categories}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />,
  );
}

describe("CollectionView (shopping spec 7.2)", () => {
  it("shows the matching listings from every campus, each with its campus, 5 across on desktop", async () => {
    await show("moving-in");
    const grid = within(screen.getByRole("region", { name: "Listings in Res setup under R500" })).getByRole("list");
    expect(grid).toHaveAttribute("data-columns", "five");
    expect(within(grid).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/listings/l-014",
      "/listings/l-006",
      "/listings/l-027",
      "/listings/fs-003",
      "/listings/fs-005",
    ]);
    expect(within(grid).getByText("Pretoria")).toBeInTheDocument();
    expect(within(grid).getAllByText("Midrand").length).toBeGreaterThan(0);
  });

  it("links on to browse, keeping the price cap", async () => {
    await show("moving-in");
    const browse = screen.getByRole("region", { name: "More in browse" });
    expect(within(browse).getByRole("link", { name: "More in Res & living under R500" })).toHaveAttribute(
      "href",
      "/browse?cat=res-living&max=500",
    );
  });

  it("links one browse category per rule category", async () => {
    await show("skills-for-hire");
    const browse = screen.getByRole("region", { name: "More in browse" });
    expect(within(browse).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "More in Services",
      "More in Tutoring",
      "More in Hair & beauty",
    ]);
  });

  it("offers the Hub's other collections, each with its eyebrow and title", async () => {
    await show("moving-in");
    const hub = screen.getByRole("region", { name: "More from the Hub" });
    const links = within(hub).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/collections/start-of-semester",
      "/collections/exam-season",
      "/collections/skills-for-hire",
    ]);
    expect(links[0]).toHaveAccessibleName("Start of semester Back-to-campus essentials");
  });

  it("says when nothing matches, and still links on to browse", async () => {
    await show("moving-in", []);
    expect(screen.getByText("Nothing here right now")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "More in browse" })).toBeInTheDocument();
  });

  it("shows its own error when the listings didn't load, with a way back to this page", async () => {
    await show("moving-in", null);
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/collections/moving-in?retry=collection-listings#collection-listings",
    );
  });
});
