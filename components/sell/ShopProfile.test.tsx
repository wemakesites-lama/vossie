import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf } from "@/tests/helpers/next-request";
import { ShopProfile } from "./ShopProfile";
import { ShopProfileView } from "./ShopProfileView";

const viewer = vi.hoisted(() => ({ id: null as string | null }));

vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
// The session is the sample account named here; requireAccount sends anyone else to sign in, as D's does.
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  const { redirect } = await import("next/navigation");
  const { signInHref } = await import("@/lib/next-path");
  const getViewer = async () => (viewer.id ? getAccount(viewer.id) : null);
  return {
    getViewer,
    getSessionKey: async () => null,
    requireAccount: async (next: string) => (await getViewer()) ?? redirect(signInHref(next)),
  };
});
vi.mock("@/lib/selling/shop-actions", () => ({ saveShopProfile: async () => {} }));

const row = (slug: string) => structuredClone(sampleSellerRows.find((item) => item.slug === slug)!);

const show = (overrides: Partial<Parameters<typeof ShopProfileView>[0]> = {}) =>
  render(
    <ShopProfileView
      shop={row("tech-corner")}
      status="approved"
      typed={null}
      errors={[]}
      notice={null}
      campuses={campuses}
      categories={categories}
      pickupPoints={pickupPoints}
      host="vossie.test"
      {...overrides}
    />,
  );

beforeEach(() => {
  resetSampleStore();
  viewer.id = null;
});

describe("Edit shop (selling spec 2.11)", () => {
  it("fills the wizard's fields from the shop, all on one page", () => {
    show();
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Tech corner");
    expect(screen.getByRole("combobox", { name: "Main category" })).toHaveValue("tech");
    expect((screen.getByRole("textbox", { name: "About your shop" }) as HTMLTextAreaElement).value).toMatch(
      /^I test every calculator/,
    );
    const spots = screen.getByRole("group", { name: "Pickup points at Midrand" });
    expect(within(spots).getByRole("checkbox", { name: "Library entrance" })).toBeChecked();
    expect(within(spots).getByRole("checkbox", { name: "Main reception" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Remove the photo and use my category's picture" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute("type", "submit");
  });

  it("lets an approved shop change its link once, warning that old links stop working", () => {
    const { unmount } = show();
    const slug = screen.getByRole("textbox", { name: "Your shop's link" });
    expect(slug).toHaveValue("tech-corner");
    expect(slug).toHaveAccessibleDescription(/Links to the old address stop working/);
    // A link is lower case: phones mustn't capitalise or correct it.
    expect(slug).toHaveAttribute("autocapitalize", "none");
    expect(slug).toHaveAttribute("spellcheck", "false");
    // The link the form shows goes with the post, so a change from a tab drawn before another change is caught.
    expect(document.querySelector('input[type="hidden"][name="slugWas"]')).toHaveValue("tech-corner");
    unmount();
    show({ shop: { ...row("tech-corner"), slugChanged: true } });
    expect(screen.queryByRole("textbox", { name: "Your shop's link" })).toBeNull();
    expect(screen.getByText("vossie.test/sellers/tech-corner")).toBeInTheDocument();
    expect(screen.getByText("You've already changed your link once.")).toBeInTheDocument();
  });

  it("tells a shop waiting for approval that its link comes with approval", () => {
    show({ shop: row("crochet-corner"), status: "pending" });
    expect(screen.queryByRole("textbox", { name: "Your shop's link" })).toBeNull();
    expect(screen.getByText(/Your shop's link is set when the Hub approves it/)).toBeInTheDocument();
  });

  it("shows what was typed and the errors after a save that went wrong, and the notice after one that worked", () => {
    const failed = show({
      typed: { name: "", tagline: "", category: "tech", about: "Hi", campus: "pretoria", points: "", slug: "tech-corner" },
      errors: [{ message: "Your campus changed, so choose your pickup points there.", fieldId: "profile-points" }],
    });
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("");
    expect(screen.getByRole("group", { name: "Pickup points at Pretoria" })).toBeInTheDocument();
    expect(screen.getByRole("alert", { name: "There's a problem" })).toHaveAttribute("id", "profile-summary");
    failed.unmount();
    show({ notice: "Your shop is saved." });
    expect(screen.getByRole("status")).toHaveTextContent("Your shop is saved.");
  });

  it("links a spent change of link's error to the link, which can no longer be typed", () => {
    show({
      shop: { ...row("tech-corner"), slug: "gadgets", slugChanged: true },
      typed: { name: "Tech corner", category: "tech", about: "Hi", campus: "midrand", points: "", slug: "gizmos" },
      errors: [{ message: "You've already changed your link once, so it can't change again.", fieldId: "profile-slug" }],
    });
    const summary = screen.getByRole("alert", { name: "There's a problem" });
    expect(within(summary).getByRole("link")).toHaveAttribute("href", "#profile-slug");
    const link = document.getElementById("profile-slug")!;
    expect(link).toHaveTextContent("vossie.test/sellers/gadgets");
    expect(link).toHaveAccessibleDescription(/can't change again/);
  });

  it("says when a saved pickup point has been retired, naming only the shown campus's (staff tools amendment 13)", async () => {
    const { pickupPoints: points } = sampleStore();
    points.get("pp-midrand-library")!.retiredAt = "2026-10-14T08:00:00.000Z";
    viewer.id = "acc-seller";
    const { unmount } = render(await ShopProfile());
    const spots = screen.getByRole("group", { name: "Pickup points at Midrand" });
    expect(spots).toHaveAccessibleDescription(/Choose at least one\. Library entrance is no longer used: choose another\.$/);
    expect(within(spots).queryByRole("checkbox", { name: "Library entrance" })).toBeNull();
    expect(within(spots).getByRole("checkbox", { name: "Main reception" })).toBeChecked();
    unmount();
    points.get("pp-midrand-reception")!.retiredAt = "2026-10-14T08:00:00.000Z";
    points.set("pp-midrand-hall", { ...points.get("pp-midrand-library")!, id: "pp-midrand-hall", name: "Hall", retiredAt: null });
    const both = render(await ShopProfile());
    expect(screen.getByRole("group", { name: "Pickup points at Midrand" })).toHaveAccessibleDescription(
      /Library entrance and Main reception are no longer used: choose others\.$/,
    );
    both.unmount();
    // Another campus shown after a save that went wrong: Midrand's retired points aren't its business.
    show({
      typed: { name: "Tech corner", category: "tech", about: "Hi", campus: "pretoria", points: "", slug: "tech-corner" },
      retired: [{ id: "pp-midrand-library", campusSlug: "midrand", name: "Library entrance", retired: true }],
    });
    expect(screen.getByRole("group", { name: "Pickup points at Pretoria" })).toHaveAccessibleDescription(
      "Where buyers can meet you. Choose at least one.",
    );
  });

  it("shows the signed-in seller's own shop, and sends anyone without one to /sell", async () => {
    viewer.id = "acc-seller";
    render(await ShopProfile());
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Tech corner");
    viewer.id = "acc-student";
    expect(await redirectOf(() => ShopProfile())).toBe("/sell");
  });
});
