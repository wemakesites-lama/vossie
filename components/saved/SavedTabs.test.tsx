import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { SavedTabs } from "./SavedTabs";

// The lists are async and tested on their own; here they stand in.
vi.mock("./SavedList", () => ({ SavedList: () => <p>The saved listings</p> }));
vi.mock("./FollowedShops", () => ({ FollowedShops: () => <p>The shops you follow</p> }));
vi.mock("./SavedSearches", () => ({ SavedSearches: () => <p>Your saved searches</p> }));

const tabs = async (params: Record<string, string>) => render(await SavedTabs({ searchParams: Promise.resolve(params) }));

describe("Saved's tabs (community actions spec 2.17, plan decision 17)", () => {
  it("opens on Listings, with the device note", async () => {
    await tabs({});
    const nav = screen.getByRole("navigation", { name: "What's saved" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: "Shops" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText(/^Saved on this device\./)).toBeInTheDocument();
    expect(screen.getByText("The saved listings")).toBeInTheDocument();
  });

  it("opens Shops for ?tab=shops, kept with the account", async () => {
    await tabs({ tab: "shops" });
    expect(screen.getByRole("link", { name: "Shops" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Shops" })).toHaveAttribute("href", "/saved?tab=shops");
    expect(screen.getByText("Kept with your account.")).toBeInTheDocument();
    expect(screen.queryByText(/Saved on this device/)).toBeNull();
    expect(screen.getByText("The shops you follow")).toBeInTheDocument();
  });

  it("treats any other tab as Listings", async () => {
    await tabs({ tab: "nonsense" });
    expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("The saved listings")).toBeInTheDocument();
  });

  it("keys its <Suspense> by tab, so a client-side switch shows the skeleton, not the other tab (amendment 14)", async () => {
    const listings = await SavedTabs({ searchParams: Promise.resolve({}) });
    const shops = await SavedTabs({ searchParams: Promise.resolve({ tab: "shops" }) });
    expect(listings.type).toBe(Suspense);
    expect(shops.type).toBe(Suspense);
    expect(listings.key).toBe("listings");
    expect(shops.key).toBe("shops");
  });

  it("opens Searches for ?tab=searches: kept with the account, one notification a day (search alerts spec 2.7)", async () => {
    await tabs({ tab: "searches" });
    expect(screen.getByRole("link", { name: "Searches" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Searches" })).toHaveAttribute("href", "/saved?tab=searches");
    expect(screen.getByRole("link", { name: "Shops" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Kept with your account. Each search sends at most one notification a day.")).toBeInTheDocument();
    expect(screen.getByText("Your saved searches")).toBeInTheDocument();
    expect(screen.queryByText("The shops you follow")).toBeNull();
    expect(screen.queryByText(/Saved on this device/)).toBeNull();
  });

  it("keys the Searches tab's <Suspense> as \"searches\"", async () => {
    const searches = await SavedTabs({ searchParams: Promise.resolve({ tab: "searches" }) });
    expect(searches.key).toBe("searches");
  });
});
