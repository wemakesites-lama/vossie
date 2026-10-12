import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { onOverlayOpen } from "@/lib/overlays";
import { SAVED_KEY } from "@/lib/saved";
import type { Campus } from "@/lib/types";
import { setScrollY } from "@/tests/helpers/dom";
import { SavedLink } from "./SavedLink";
import { SiteHeader } from "./SiteHeader";

const campus = (slug: string, name: string): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings: 10,
  image: { src: "/placeholder.svg", alt: "" },
});
const campuses = [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")];

function renderHeader() {
  render(<SiteHeader campuses={campuses} />);
  return screen.getByRole("banner");
}

describe("SiteHeader", () => {
  it("starts expanded, with the pennant as the home link", () => {
    const header = renderHeader();
    expect(header).toHaveAttribute("data-mode", "expanded");
    expect(screen.getByRole("link", { name: "Vossie home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
  });

  it("hides everything but the crest past 120px and makes the hidden items inert", () => {
    const header = renderHeader();
    act(() => setScrollY(400));
    expect(header).toHaveAttribute("data-mode", "crest");
    expect(screen.getByRole("button", { name: "Show navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(header.querySelector(".hdr-quick")).toHaveAttribute("inert");
    for (const group of header.querySelectorAll(".hdr-group")) {
      expect(group).toHaveAttribute("inert");
    }
  });

  it("reveals everything on a tap without moving the page, and focuses the first item", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    await user.click(screen.getByRole("button", { name: "Show navigation" }));
    expect(header).toHaveAttribute("data-mode", "revealed");
    expect(screen.getByRole("link", { name: "Vossie home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    expect(window.scrollTo).not.toHaveBeenCalled();
    for (const group of header.querySelectorAll(".hdr-group")) {
      expect(group).not.toHaveAttribute("inert");
    }
    expect(header.querySelector(".hdr-quick")).not.toHaveAttribute("inert");
  });

  it("hides again after another 160px down, and expands back near the top", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    await user.click(screen.getByRole("button", { name: "Show navigation" }));
    // A mouse user's focus isn't a visible focus ring; blur so the keyboard-focus hold doesn't apply.
    act(() => (document.activeElement as HTMLElement).blur());
    act(() => setScrollY(570));
    expect(header).toHaveAttribute("data-mode", "crest");
    act(() => setScrollY(40));
    expect(header).toHaveAttribute("data-mode", "expanded");
  });

  it("stays revealed while a header control has keyboard focus", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    // The keyboard, not user.click: after a pointer interaction jsdom stops reporting :focus-visible.
    act(() => screen.getByRole("button", { name: "Show navigation" }).focus());
    await user.keyboard("{Enter}");
    act(() => setScrollY(570));
    expect(header).toHaveAttribute("data-mode", "revealed");
    act(() => (document.activeElement as HTMLElement).blur());
    act(() => setScrollY(571));
    expect(header).toHaveAttribute("data-mode", "crest");
  });

  it("scrolls to the top instead of reloading when the home link is used on the homepage", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("link", { name: "Vossie home" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("opens the menu, search and campus picker through the overlay bus", async () => {
    const user = userEvent.setup();
    renderHeader();
    const menu = vi.fn();
    const search = vi.fn();
    const campusPicker = vi.fn();
    const unsubscribes = [
      onOverlayOpen("menu", menu),
      onOverlayOpen("search", search),
      onOverlayOpen("campus", campusPicker),
    ];
    const menuButton = screen.getByRole("button", { name: "Menu" });
    await user.click(menuButton);
    expect(menu).toHaveBeenCalledWith(menuButton);
    await user.click(screen.getAllByRole("button", { name: "Search" })[0]);
    expect(search).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /^Shopping at/ }));
    await user.click(screen.getByRole("button", { name: "Campuses" }));
    expect(campusPicker).toHaveBeenCalledTimes(2);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  });

  it("shows the chosen campus and the number of saved items on this device", () => {
    setCampusChoice("pretoria");
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));
    renderHeader();
    expect(screen.getByRole("button", { name: "Shopping at Pretoria" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved, 2 items" })).toBeInTheDocument();
  });

  it("lets a modified click on the home link through, so it can open a new tab", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("link", { name: "Vossie home" }), { metaKey: true });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps the pennant mounted when the header changes mode", () => {
    const header = renderHeader();
    const crest = header.querySelector(".pennant img");
    act(() => setScrollY(400));
    expect(header.querySelector(".pennant img")).toBe(crest);
  });

  it("says 1 item in the singular and caps the badge at 99+", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a"]));
    const { unmount } = render(<SavedLink />);
    expect(screen.getByRole("link", { name: "Saved, 1 item" })).toBeInTheDocument();
    unmount();
    localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from({ length: 120 }, (_, i) => `id${i}`)));
    render(<SavedLink />);
    expect(screen.getByRole("link", { name: "Saved, 120 items" })).toHaveTextContent("99+");
  });
});
