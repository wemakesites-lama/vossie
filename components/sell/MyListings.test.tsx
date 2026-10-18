import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveFormState } from "@/lib/data/form-states";
import { setShopPaused } from "@/lib/data/shops";
import { staffPauseShop } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import { MY_LISTINGS_FORM } from "@/lib/selling/form-state";
import { redirectOf } from "@/tests/helpers/next-request";
import { DeleteListing } from "./DeleteListing";
import { MyListings } from "./MyListings";

const viewer = vi.hoisted(() => ({ id: null as string | null, sessionKey: null as string | null }));

vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  const { redirect } = await import("next/navigation");
  const { signInHref } = await import("@/lib/next-path");
  const getViewer = async () => (viewer.id ? getAccount(viewer.id) : null);
  return {
    getViewer,
    getSessionKey: async () => viewer.sessionKey,
    requireAccount: async (next: string) => (await getViewer()) ?? redirect(signInHref(next)),
  };
});
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {}, deleteListingForm: async () => {} }));

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
  viewer.sessionKey = null;
});

describe("My listings' and Delete listing's request-time parts (selling spec 2.9 and section 3)", () => {
  it("shows the signed-in seller's own listings on the tab asked for", async () => {
    viewer.id = "acc-seller";
    render(await MyListings({ searchParams: Promise.resolve({ tab: "available" }) }));
    // The title is also in each control's sr-only name, so look for the one in the listing's own line.
    expect(screen.getByText("Casio fx-991ZA Plus calculator", { selector: ".sell-item-title" })).toBeInTheDocument();
    expect(screen.queryByText("Box braids, shoulder length")).toBeNull();
  });

  it("says what the last action did once: a second visit shows no notice (amendment 10.6)", async () => {
    viewer.id = "acc-seller";
    viewer.sessionKey = "s";
    await saveFormState(
      {
        sessionKey: "s",
        form: MY_LISTINGS_FORM,
        errors: [],
        values: { listing: "l-001" },
        notice: "paused",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      new Date("2026-10-14T08:00:00.000Z"),
    );
    const first = render(await MyListings({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("status")).toHaveTextContent("Paused. Buyers can't see it until you resume it.");
    first.unmount();
    render(await MyListings({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells the owner of a paused shop that buyers can't see its listings (amendment 11.6)", async () => {
    viewer.id = "acc-seller";
    await setShopPaused("acc-seller", true);
    render(await MyListings({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/^Your shop is paused, so buyers can't see your listings/)).toBeInTheDocument();
  });

  it("tells the owner of a shop the Hub paused why, and doesn't say they can resume it (staff tools plan decision 3)", async () => {
    viewer.id = "acc-seller";
    await staffPauseShop("tech-corner", "Selling exam answers.");
    render(await MyListings({ searchParams: Promise.resolve({}) }));
    const banner = screen.getByText(/^Paused by the Hub: buyers can't see your listings\./);
    expect(banner).toHaveTextContent("The Hub said: Selling exam answers.");
    expect(screen.queryByText(/until you resume it/)).toBeNull();
  });

  it("sends a student without a shop to /sell, and a signed-out visitor to sign in", async () => {
    expect(await redirectOf(() => MyListings({ searchParams: Promise.resolve({ tab: "sold" }) }))).toBe(
      "/login?next=%2Fsell%2Flistings%3Ftab%3Dsold",
    );
    viewer.id = "acc-student";
    expect(await redirectOf(() => MyListings({ searchParams: Promise.resolve({}) }))).toBe("/sell");
  });

  it("asks before deleting one of the seller's listings, with Keep it back to its tab", async () => {
    viewer.id = "acc-seller";
    render(await DeleteListing({ params: Promise.resolve({ id: "l-001" }) }));
    expect(screen.getByText("Casio fx-991ZA Plus calculator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete listing" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Keep it" })).toHaveAttribute("href", "/sell/listings");
    expect(document.querySelector('input[name="listing"]')).toHaveValue("l-001");
  });

  it("is a 404 for another shop's listing, or one that doesn't exist", async () => {
    viewer.id = "acc-seller";
    await expect(DeleteListing({ params: Promise.resolve({ id: "l-004" }) })).rejects.toThrow("notFound");
    await expect(DeleteListing({ params: Promise.resolve({ id: "Nope!" }) })).rejects.toThrow("notFound");
  });
});
