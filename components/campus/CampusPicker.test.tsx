import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
