import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { getCampusCookieValue, setCampusChoice } from "@/lib/campus";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { CampusPicker } from "./CampusPicker";

const campus = (slug: string, name: string, region: string): Campus => ({
  slug,
  name,
  region,
  liveListings: 5,
  image: { src: "/placeholder.svg", alt: "" },
});
const campuses = [
  campus("cape-town-mowbray", "Cape Town Mowbray", "Western Cape"),
  campus("cape-town-tyger-valley", "Cape Town Tyger Valley", "Western Cape"),
  campus("midrand", "Midrand", "Gauteng"),
  campus("online", "Eduvos Online", "Online, anywhere in SA"),
];

function openPicker(trigger: HTMLElement | null = null) {
  act(() => openOverlay("campus", trigger));
  return screen.getByRole("dialog", { name: "Choose your campus" });
}

describe("CampusPicker", () => {
  it("lists All campuses first, then each campus with its region", () => {
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(campuses.length + 1);
    expect(items[0]).toHaveTextContent("All campuses");
    expect(within(dialog).getByRole("button", { name: "Midrand, Gauteng" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Eduvos Online, Online, anywhere in SA" }),
    ).toBeInTheDocument();
  });

  it("filters by name or region, keeps All campuses, and says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    const search = within(dialog).getByRole("searchbox", { name: "Find your campus" });
    await user.type(search, "western");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
    expect(within(dialog).getByRole("status")).toHaveTextContent("No campus matches “zzz”.");
  });

  it("saves the choice, closes and confirms it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </>,
    );
    const dialog = openPicker();
    await user.click(within(dialog).getByRole("button", { name: "Midrand, Gauteng" }));
    expect(getCampusCookieValue()).toBe("midrand");
    expect(dialog).not.toHaveAttribute("open");
    expect(screen.getByRole("status")).toHaveTextContent("Showing Midrand first");
  });

  it("switches back to all campuses", async () => {
    const user = userEvent.setup();
    setCampusChoice("midrand");
    render(
      <>
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </>,
    );
    const dialog = openPicker();
    await user.click(within(dialog).getByRole("button", { name: "All campuses, Shop every campus" }));
    expect(getCampusCookieValue()).toBe("all");
    expect(screen.getByRole("status")).toHaveTextContent("Showing all campuses");
  });

  it("marks the current choice", () => {
    setCampusChoice("midrand");
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    expect(within(dialog).getByRole("button", { name: "Midrand, Gauteng" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      within(dialog).getByRole("button", { name: "All campuses, Shop every campus" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("gives focus back to the button that opened it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Open picker</button>
        <CampusPicker campuses={campuses} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open picker" });
    const dialog = openPicker(trigger);
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
  });

  it("focuses the search box when it opens on a larger screen", () => {
    mockMatchMedia((query) => query === "(min-width: 48rem) and (min-height: 30rem)");
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    expect(within(dialog).getByRole("searchbox", { name: "Find your campus" })).toHaveFocus();
  });

  it("opens under its trigger on a larger screen, and forgets that spot when opened without one", async () => {
    const user = userEvent.setup();
    mockMatchMedia((query) => query === "(min-width: 48rem) and (min-height: 30rem)");
    render(
      <>
        <button type="button">Open picker</button>
        <CampusPicker campuses={campuses} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open picker" });
    // jsdom has no layout: say where the trigger is. The popover sits 8px below it, level with its left edge.
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 200,
      y: 60,
      left: 200,
      top: 60,
      right: 360,
      bottom: 104,
      width: 160,
      height: 44,
      toJSON: () => ({}),
    });
    const dialog = openPicker(trigger);
    expect(dialog.style.getPropertyValue("--picker-top")).toBe("112px");
    expect(dialog.style.getPropertyValue("--picker-left")).toBe("200px");

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    openPicker();
    expect(dialog.style.getPropertyValue("--picker-top")).toBe("");
    expect(dialog.style.getPropertyValue("--picker-left")).toBe("");
  });

  it("closes when its handle is dragged down more than 80px", () => {
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    // The handle is hidden from assistive technology, so it has no role to look it up by.
    const handle = dialog.querySelector<HTMLElement>(".sheet-handle");
    if (!handle) throw new Error("The sheet has no drag handle");
    handle.setPointerCapture = vi.fn(); // jsdom has no pointer capture
    fireEvent.pointerDown(handle, { pointerId: 1, isPrimary: true, button: 0, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 150 });
    expect(dialog).toHaveAttribute("open");
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 200 });
    expect(dialog).not.toHaveAttribute("open");
  });
});
