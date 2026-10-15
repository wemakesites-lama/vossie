import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { clearFormState, saveFormState } from "@/lib/data/form-states";
import { resetSampleStore } from "@/lib/data/store";
import { PROFILE_FORM } from "@/lib/selling/form-state";
import { redirectOf } from "@/tests/helpers/next-request";
import { ShopProfile } from "./ShopProfile";
import { ShopProfileView } from "./ShopProfileView";

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
vi.mock("@/lib/selling/shop-actions", () => ({ saveShopProfile: async () => {} }));
// next/link draws a plain <a> in jsdom and keeps `prefetch` to itself, so this one shows it as data.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      prefetch,
      children,
      ...rest
    }: {
      href: string;
      prefetch?: boolean | null;
      children?: React.ReactNode;
      className?: string;
    }) =>
      createElement(
        "a",
        { href, "data-prefetch": prefetch === undefined ? "auto" : String(prefetch), ...rest },
        children,
      ),
  };
});

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
  viewer.sessionKey = null;
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
    unmount();
    show({ shop: { ...row("tech-corner"), slugChanged: true } });
    expect(screen.queryByRole("textbox", { name: "Your shop's link" })).toBeNull();
    expect(screen.getByText("vossie.test/sellers/tech-corner")).toBeInTheDocument();
    expect(screen.getByText("You've already changed your link once.")).toBeInTheDocument();
  });

  it("lets a paused shop change its link too", () => {
    show({ status: "paused" });
    expect(screen.getByRole("textbox", { name: "Your shop's link" })).toHaveValue("tech-corner");
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

  it("brings Remove photo back ticked after a save that went wrong, and asks for a chosen photo again (amendment 13.6)", () => {
    const typed = { name: "", category: "tech", about: "Hi", campus: "midrand", points: "pp-midrand-library", slug: "tech-corner" };
    const box = () => screen.getByRole("checkbox", { name: "Remove the photo and use my category's picture" });
    const ticked = show({
      typed: { ...typed, removePhoto: "yes" },
      errors: [
        { message: "Enter your shop's name.", fieldId: "profile-name" },
        { message: "Choose your photo again.", fieldId: "profile-photo" },
      ],
    });
    expect(box()).toBeChecked();
    expect(screen.getByRole("link", { name: "Choose your photo again." })).toHaveAttribute("href", "#profile-photo");
    expect(screen.getByLabelText("A different photo (optional)")).toHaveAccessibleDescription(/Choose your photo again\.$/);
    ticked.unmount();
    show({ typed: { ...typed, removePhoto: "" } });
    expect(box()).not.toBeChecked();
  });

  it("shows a typed link and its error on the link's own field", () => {
    show({
      typed: { name: "Tech corner", category: "tech", about: "Hi", campus: "midrand", points: "pp-midrand-library", slug: "Bad Link!" },
      errors: [{ message: "Use 3 to 40 lower-case letters, numbers and single hyphens.", fieldId: "profile-slug" }],
    });
    const slug = screen.getByRole("textbox", { name: "Your shop's link" });
    expect(slug).toHaveValue("Bad Link!");
    expect(slug).toHaveAttribute("aria-invalid", "true");
    expect(slug).toHaveAccessibleDescription(/Use 3 to 40 lower-case letters/);
  });

  it("keeps every id unique and every reference inside the form, with an error on every field (amendment 3)", () => {
    const fields = ["name", "tagline", "category", "about", "photo", "campus", "points", "slug"];
    const { container } = show({
      errors: fields.map((name) => ({ message: `Fix ${name}.`, fieldId: `profile-${name}` })),
    });
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    expect(ids.filter((id) => !id.startsWith("profile-"))).toEqual([]);
    const missing: string[] = [];
    for (const label of container.querySelectorAll("label[for]")) {
      if (!container.querySelector(`#${label.getAttribute("for")}`)) missing.push(`for=${label.getAttribute("for")}`);
    }
    for (const link of container.querySelectorAll('a[href^="#"]')) {
      if (!container.querySelector(link.getAttribute("href")!)) missing.push(`href=${link.getAttribute("href")}`);
    }
    for (const element of container.querySelectorAll("[aria-describedby]")) {
      for (const id of element.getAttribute("aria-describedby")!.split(" ")) {
        if (!container.querySelector(`#${id}`)) missing.push(`aria-describedby=${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("never prefetches (plan decision 20)", () => {
    const { container } = show();
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/sell"]);
    expect(links.filter((link) => link.dataset.prefetch !== "false")).toEqual([]);
  });

  it("shows the signed-in seller's own shop, and sends anyone without one to /sell", async () => {
    viewer.id = "acc-seller";
    render(await ShopProfile());
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Tech corner");
    viewer.id = "acc-student";
    expect(await redirectOf(() => ShopProfile())).toBe("/sell");
  });

  it("sends a signed-out visitor to sign in, then back to Edit shop", async () => {
    expect(await redirectOf(() => ShopProfile())).toBe("/login?next=%2Fsell%2Fprofile");
  });

  it("shows the typed values and errors a failed save left, and the shop's own values once there are none", async () => {
    viewer.id = "acc-seller";
    viewer.sessionKey = "s";
    await saveFormState(
      {
        sessionKey: "s",
        form: PROFILE_FORM,
        errors: ["name-missing"],
        values: { name: "", tagline: "", category: "tech", about: "Hi", campus: "midrand", points: "", slug: "tech-corner" },
        notice: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      new Date("2026-10-14T08:00:00.000Z"),
    );
    const failed = render(await ShopProfile());
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("");
    expect(screen.getByRole("link", { name: "Enter your shop's name." })).toHaveAttribute("href", "#profile-name");
    failed.unmount();
    // Once that state has gone (a good save clears it; otherwise it lasts 10 minutes), the shop's own values are back.
    await clearFormState("s", PROFILE_FORM);
    render(await ShopProfile());
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Tech corner");
    expect(screen.getByRole("combobox", { name: "Your campus" })).toHaveValue("midrand");
    expect(screen.queryByRole("alert", { name: "There's a problem" })).toBeNull();
  });

  it("says that the shop is saved once: a second visit shows no notice (amendment 10.6)", async () => {
    viewer.id = "acc-seller";
    viewer.sessionKey = "s";
    await saveFormState(
      {
        sessionKey: "s",
        form: PROFILE_FORM,
        errors: [],
        values: {},
        notice: "shop-saved",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      new Date("2026-10-14T08:00:00.000Z"),
    );
    const first = render(await ShopProfile());
    expect(screen.getByRole("status")).toHaveTextContent("Your shop is saved.");
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Tech corner");
    first.unmount();
    render(await ShopProfile());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Shop name" })).toHaveValue("Tech corner");
  });
});
