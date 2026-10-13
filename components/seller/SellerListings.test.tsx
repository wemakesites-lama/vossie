import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSeller } from "@/lib/data";
import { SellerListings } from "./SellerListings";

const load = vi.hoisted(() => ({ failing: false }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getSellerListings: async (slug: string) => {
      if (load.failing) throw new Error("Didn't load");
      return actual.getSellerListings(slug);
    },
  };
});

afterEach(() => {
  load.failing = false;
});

const names = new Map([
  ["midrand", "Midrand"],
  ["pretoria", "Pretoria"],
]);

async function show(slug: string) {
  render(await SellerListings({ seller: (await getSeller(slug))!, campusNames: names }));
}

describe("SellerListings (shopping spec 4.1)", () => {
  it("counts the seller's listings and shows them newest first, 4 across on desktop", async () => {
    await show("tech-corner");
    expect(screen.getByRole("heading", { level: 2, name: "2 listings" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Casio fx-991ZA Plus calculator",
      "Gaming headset, barely used",
    ]);
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "four");
  });

  it("says 1 listing in the singular", async () => {
    await show("ticket-desk");
    expect(screen.getByRole("heading", { level: 2, name: "1 listing" })).toBeInTheDocument();
  });

  it("says when nothing is listed, and links to the seller's category (plan decision 5)", async () => {
    await show("lash-lounge");
    expect(screen.getByRole("heading", { level: 2, name: "Listings" })).toBeInTheDocument();
    expect(screen.getByText("Nothing listed right now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More in Hair & beauty" })).toHaveAttribute(
      "href",
      "/browse?cat=hair-beauty",
    );
  });

  it("shows its own error, with a way back to this shop", async () => {
    load.failing = true;
    await show("tech-corner");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/sellers/tech-corner?retry=seller-listings#seller-listings",
    );
  });
});
