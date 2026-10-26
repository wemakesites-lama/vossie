import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { onOverlayOpen, openOverlay } from "@/lib/overlays";
import type { Campus, Category } from "@/lib/types";
import { MenuDrawer } from "./MenuDrawer";

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "pretoria", name: "Pretoria", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];
const categories: Category[] = [
  { slug: "textbooks-notes", name: "Textbooks & notes", image: { src: "/p.svg", alt: "" } },
  { slug: "tech", name: "Tech", image: { src: "/p.svg", alt: "" } },
];

/** The menu as the layout fills it for a signed-out visitor, unless the test gives other account rows. */
function renderMenu(
  account: ReactNode = (
    <li>
      <a href="/login">Sign in</a>
    </li>
  ),
) {
  render(
    <>
      <button type="button">Menu trigger</button>
      <MenuDrawer campuses={campuses} categories={categories} account={account} />
    </>,
  );
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: "Menu trigger" });
  act(() => openOverlay("menu", trigger));
  return { trigger, menu: screen.getByRole("dialog", { name: "Menu" }) };
}

/** jsdom can't navigate and reports it on every link click. Cancel the click's default once React has handled it. */
function swallowNavigation() {
  document.addEventListener("click", (event) => event.preventDefault(), { once: true });
}

describe("MenuDrawer", () => {
  it("shows the main links", () => {
    renderMenu();
    const { menu } = openMenu();
    expect(within(menu).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/browse");
    for (const name of ["Sell", "Launchpad", "Looking For", "How it works", "Safety", "Sign in"]) {
      expect(within(menu).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(menu).getByRole("link", { name: "Looking For" })).toHaveAttribute("href", "/looking-for");
    const names = within(menu).getAllByRole("link").map((link) => link.textContent);
    expect(names.indexOf("Looking For")).toBe(names.indexOf("Launchpad") + 1);
    expect(within(menu).getByRole("button", { name: "Campuses" })).toBeInTheDocument();
  });

  it("drills into categories and back, moving focus with you", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu } = openMenu();
    await user.click(within(menu).getByRole("button", { name: "Shop by category" }));
    expect(within(menu).getByRole("heading", { name: "Shop by category" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/browse?cat=tech");
    const back = within(menu).getByRole("button", { name: "Back" });
    expect(back).toHaveFocus();
    await user.click(back);
    expect(within(menu).getByRole("button", { name: "Shop by category" })).toHaveFocus();
  });

  it("drills into campuses with a link to each campus", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu } = openMenu();
    await user.click(within(menu).getByRole("button", { name: "Campuses" }));
    expect(within(menu).getByRole("heading", { name: "Campuses" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "All campuses" })).toHaveAttribute("href", "/browse?campus=all");
    // Chromium names the row "Midrand , Gauteng" (blockified flex children get spaces); jsdom has no space.
    expect(within(menu).getByRole("link", { name: /^Midrand\s*,\s*Gauteng$/ })).toHaveAttribute("href", "/browse?campus=midrand");
  });

  it("shows the current campus, then closes itself and opens the campus picker", async () => {
    const user = userEvent.setup();
    setCampusChoice("midrand");
    const picker = vi.fn();
    const unsubscribe = onOverlayOpen("campus", picker);
    renderMenu();
    const { menu, trigger } = openMenu();
    await user.click(within(menu).getByRole("button", { name: /Shopping at Midrand/ }));
    // The menu closes first, so the picker's confirmation isn't hidden behind it (Lama, 2026-10-12).
    expect(menu).not.toHaveAttribute("open");
    // Focus goes back to whatever opened the menu once the picker closes.
    expect(picker).toHaveBeenCalledWith(trigger);
    unsubscribe();
  });

  it("switches data saver on", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu } = openMenu();
    const toggle = within(menu).getByRole("switch", { name: "Data saver" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-low-data");
  });

  it("describes what the data saver switch does", () => {
    renderMenu();
    const { menu } = openMenu();
    expect(within(menu).getByRole("switch", { name: "Data saver" })).toHaveAccessibleDescription(
      "Pauses autoplay and animation, and loads lighter photos.",
    );
  });

  it("closes when a link is followed, but not on a click that opens a new tab", () => {
    renderMenu();
    const { menu } = openMenu();
    const sell = within(menu).getByRole("link", { name: "Sell" });
    swallowNavigation();
    fireEvent.click(sell, { metaKey: true });
    expect(menu).toHaveAttribute("open");
    swallowNavigation();
    fireEvent.click(sell);
    expect(menu).not.toHaveAttribute("open");
  });

  it("closes when a form button such as Sign out is pressed, so its toast can be seen (accounts plan decision 14)", () => {
    renderMenu(
      <li>
        <form onSubmit={(event) => event.preventDefault()}>
          <button type="submit">Sign out</button>
        </form>
      </li>,
    );
    const { menu } = openMenu();
    fireEvent.click(within(menu).getByRole("button", { name: "Sign out" }));
    expect(menu).not.toHaveAttribute("open");
  });

  it("closes with the Close button, returns focus, and reopens on the main view", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu, trigger } = openMenu();
    await user.click(within(menu).getByRole("button", { name: "Shop by category" }));
    await user.click(within(menu).getByRole("button", { name: "Close" }));
    expect(menu).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
    act(() => openOverlay("menu", trigger));
    expect(within(menu).getByRole("button", { name: "Shop by category" })).toBeInTheDocument();
  });
});
