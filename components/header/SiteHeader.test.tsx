import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ALL_CAMPUSES, setCampusChoice } from "@/lib/campus";
import { onOverlayOpen } from "@/lib/overlays";
import { savedCookieString } from "@/lib/saved";
import type { Campus } from "@/lib/types";
import { setScrollY } from "@/tests/helpers/dom";
import { AccountLink } from "./AccountLink";
import { SavedLink } from "./SavedLink";
import { SiteHeader } from "./SiteHeader";

// AccountLink's own file reads the session; the header's tests only need the link itself.
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => null }));

const signedOut = <AccountLink signedIn={false} />;

const campus = (slug: string, name: string): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings: 10,
  image: { src: "/placeholder.svg", alt: "" },
});
const campuses = [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")];

function renderHeader() {
  render(<SiteHeader campuses={campuses} account={signedOut} />);
  return screen.getByRole("banner");
}

describe("SiteHeader", () => {
  it("starts expanded, with the pennant as the home link", () => {
    const header = renderHeader();
    expect(header).toHaveAttribute("data-mode", "expanded");
    expect(screen.getByRole("link", { name: "CampusCart home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
  });

  it("hides everything past 120px, crest included, and makes it inert", () => {
    const header = renderHeader();
    act(() => setScrollY(400));
    expect(header).toHaveAttribute("data-mode", "hidden");
    expect(header.querySelector(".hdr-quick")).toHaveAttribute("inert");
    expect(header.querySelector(".hdr-bar")).toHaveAttribute("inert");
    expect(header.querySelector(".hdr-pennant")?.closest("[inert]")).not.toBeNull();
    // The keyboard's way back is the one thing left.
    expect(screen.getByRole("button", { name: "Show navigation" })).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the whole header again when the page scrolls back up", () => {
    const header = renderHeader();
    act(() => setScrollY(900));
    act(() => setScrollY(850));
    expect(header).toHaveAttribute("data-mode", "shown");
    expect(header.querySelector(".hdr-bar")).not.toHaveAttribute("inert");
    expect(screen.getByRole("link", { name: "CampusCart home" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show navigation" })).not.toBeInTheDocument();
    act(() => setScrollY(930));
    expect(header).toHaveAttribute("data-mode", "hidden");
    act(() => setScrollY(40));
    expect(header).toHaveAttribute("data-mode", "expanded");
  });

  it("shows everything from the keyboard without moving the page, and focuses Menu", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    act(() => screen.getByRole("button", { name: "Show navigation" }).focus());
    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("data-mode", "shown");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("stays shown while a header control has keyboard focus", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    // The keyboard, not user.click: after a pointer interaction jsdom stops reporting :focus-visible.
    act(() => screen.getByRole("button", { name: "Show navigation" }).focus());
    await user.keyboard("{Enter}");
    act(() => setScrollY(900));
    expect(header).toHaveAttribute("data-mode", "shown");
    act(() => (document.activeElement as HTMLElement).blur());
    act(() => setScrollY(901));
    expect(header).toHaveAttribute("data-mode", "hidden");
  });

  it("scrolls to the top instead of reloading when the home link is used on the homepage", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("link", { name: "CampusCart home" }));
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
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(search).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /^Shopping at/ }));
    await user.click(screen.getByRole("button", { name: "Campuses" }));
    expect(campusPicker).toHaveBeenCalledTimes(2);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  });

  it("shows the chosen campus and the number of saved items on this device", () => {
    setCampusChoice("pretoria");
    document.cookie = savedCookieString(["a", "b"], false);
    renderHeader();
    expect(screen.getByRole("button", { name: "Shopping at Pretoria" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved, 2 items" })).toBeInTheDocument();
  });

  it("marks the campus pill once a campus is chosen, so it can be filled", () => {
    setCampusChoice("midrand");
    renderHeader();
    expect(screen.getByRole("button", { name: "Shopping at Midrand" })).toHaveAttribute("data-chosen");
  });

  it("leaves the campus pill plain with no choice, or with All campuses", () => {
    const { unmount } = render(<SiteHeader campuses={campuses} account={signedOut} />);
    expect(screen.getByRole("button", { name: /^Shopping at/ })).not.toHaveAttribute("data-chosen");
    unmount();
    setCampusChoice(ALL_CAMPUSES);
    render(<SiteHeader campuses={campuses} account={signedOut} />);
    expect(screen.getByRole("button", { name: "Shopping at All campuses" })).not.toHaveAttribute("data-chosen");
  });

  it("lets a modified click on the home link through, so it can open a new tab", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("link", { name: "CampusCart home" }), { metaKey: true });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps the pennant mounted when the header changes mode", () => {
    const header = renderHeader();
    const crest = header.querySelector(".pennant img");
    act(() => setScrollY(400));
    expect(header.querySelector(".pennant img")).toBe(crest);
  });

  it("says 1 item in the singular and caps the badge at 99+", () => {
    document.cookie = savedCookieString(["a"], false);
    const { unmount } = render(<SavedLink />);
    expect(screen.getByRole("link", { name: "Saved, 1 item" })).toBeInTheDocument();
    unmount();
    // 120 ids in the cookie: the store keeps 100 (shopping spec 5.1), and the badge shows 99+.
    document.cookie = savedCookieString(Array.from({ length: 120 }, (_, i) => `id${i}`), false);
    render(<SavedLink />);
    expect(screen.getByRole("link", { name: "Saved, 100 items" })).toHaveTextContent("99+");
  });

  it("shows the account icon it's given, among the items that go inert when hidden (accounts spec 3.4)", () => {
    render(<SiteHeader campuses={campuses} account={<AccountLink signedIn />} />);
    const link = screen.getByRole("link", { name: "Your account" });
    expect(link).toHaveAttribute("href", "/account");
    act(() => setScrollY(400));
    expect(link.closest(".hdr-bar")).toHaveAttribute("inert");
  });

  it("leaves Account and Saved to the tab bar on phones", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass("hidden", "wide:inline-grid");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveClass("hidden", "wide:inline-grid");
    expect(screen.getAllByRole("button", { name: "Search" })).toHaveLength(1);
  });
});
