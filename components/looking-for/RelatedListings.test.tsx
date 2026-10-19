import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCampuses, getRequest } from "@/lib/data";
import { resetSampleStore } from "@/lib/data/store";
import { RelatedListings } from "./RelatedListings";

const load = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getRelatedListings: async (query: Parameters<typeof actual.getRelatedListings>[0]) => {
      if (load.mode === "failing") throw new Error("Didn't load");
      return load.mode === "empty" ? [] : actual.getRelatedListings(query);
    },
  };
});

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  load.mode = "real";
});

async function show(id: string, categoryName: string) {
  const [request, campuses] = await Promise.all([getRequest(id), getCampuses()]);
  return render(
    await RelatedListings({
      request: request!,
      categoryName,
      campusNames: new Map(campuses.map((campus) => [campus.slug, campus.name])),
    }),
  );
}

describe("RelatedListings (community spec 4.2, decision 4)", () => {
  it("shows up to 4 listings in the request's category, its campus first, 4 across on desktop", async () => {
    await show("r-001", "Tutoring");
    const region = screen.getByRole("region", { name: "Already on Vossie" });
    const grid = within(region).getByRole("list");
    expect(grid).toHaveAttribute("data-columns", "four");
    expect(within(grid).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/listings/l-005",
      "/listings/l-013",
      "/listings/l-031",
      "/listings/l-025",
    ]);
    expect(within(grid).getAllByText("Midrand")).toHaveLength(1);
  });

  it("links to the rest of the category in browse", async () => {
    await show("r-001", "Tutoring");
    expect(screen.getByRole("link", { name: "See all in Tutoring" })).toHaveAttribute("href", "/browse?cat=tutoring");
  });

  it("hides when nothing in the category is listed", async () => {
    load.mode = "empty";
    const { container } = await show("r-001", "Tutoring");
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its own error, with a way back to this request", async () => {
    load.mode = "failing";
    await show("r-001", "Tutoring");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/looking-for/r-001?retry=already-on-vossie#already-on-vossie",
    );
  });
});
