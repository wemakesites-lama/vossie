import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WIDE_QUERY } from "@/lib/breakpoints";
import { getCampusCookieValue, setCampusChoice } from "@/lib/campus";
import type { Campus } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { CampusChooser } from "./CampusChooser";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const campus = (slug: string, name: string, liveListings: number): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings,
  image: { src: `/placeholders/campus/${slug}.svg`, alt: `${name} campus` },
});

const campuses = [
  campus("bedfordview", "Bedfordview", 132),
  campus("bloemfontein", "Bloemfontein", 58),
  campus("midrand", "Midrand", 214),
  campus("pretoria", "Pretoria", 187),
  campus("online", "Eduvos Online", 63),
];

const scrollIntoView = vi.fn();

// jsdom has no IntersectionObserver. This stub reports the section as on screen when it starts watching, unless a test
// sets `onScreen` to false first. `report` lets a test move the section in or out of view afterwards.
const view = vi.hoisted(() => {
  const state: { onScreen: boolean; report: (onScreen: boolean) => void } = { onScreen: true, report: () => {} };
  return state;
});

class IntersectionObserverStub {
  private callback: (entries: Array<{ isIntersecting: boolean }>) => void;
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = callback;
    view.report = (onScreen) => callback([{ isIntersecting: onScreen }]);
  }
  observe() {
    this.callback([{ isIntersecting: view.onScreen }]);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  // jsdom can't scroll.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: scrollIntoView });
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
  view.onScreen = true;
  view.report = () => {};
});

/** The tablet and desktop layout, shown from the wide step. */
const wideLayout = (container: HTMLElement) => within(container.querySelector<HTMLElement>(".campus-chooser-wide")!);
const highlighted = (container: HTMLElement) => container.querySelector(".campus-name-on")?.firstChild?.textContent;

function renderChooser() {
  return render(
    <>
      <CampusChooser campuses={campuses} />
      <section id="just-listed">
        <h2 id="just-listed-title" tabIndex={-1}>
          New on all campuses
        </h2>
      </section>
    </>,
  );
}

describe("CampusChooser (spec 7.7)", () => {
  it("lists the campuses with their live counts, and Eduvos Online apart", () => {
    const { container } = renderChooser();
    const wide = wideLayout(container);
    expect(wide.getByRole("button", { name: "Midrand, 214 live listings" })).toBeInTheDocument();
    expect(wide.getByRole("button", { name: "All campuses" })).toBeInTheDocument();
    expect(wide.getByRole("button", { name: "Eduvos Online" })).toBeInTheDocument();
    expect(wide.queryByRole("button", { name: /^Eduvos Online, / })).not.toBeInTheDocument();
    const cards = within(screen.getByRole("region", { name: "Campuses" }));
    expect(cards.getByRole("button", { name: "All campuses, Every Eduvos campus" })).toBeInTheDocument();
    expect(cards.getByRole("button", { name: "Eduvos Online, 63 live listings" })).toBeInTheDocument();
  });

  it("cycles the highlight every four seconds on larger screens while no campus is chosen", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    const { container } = renderChooser();
    expect(highlighted(container)).toBe("Bedfordview");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
  });

  it("doesn't cycle while the section is off screen", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    // The stub reports the section out of view.
    view.onScreen = false;
    const { container } = renderChooser();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bedfordview");
    // The progress bar stands still and the Pause button stays: both follow whether the cycle can run here.
    expect(container.querySelector(".campus-progress")).not.toHaveAttribute("data-running");
    expect(screen.getByRole("button", { name: "Pause campus highlights" })).toBeInTheDocument();
  });

  it("starts cycling when the section scrolls into view, and stops when it scrolls out", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    view.onScreen = false;
    const { container } = renderChooser();
    act(() => view.report(true));
    expect(container.querySelector(".campus-progress")).toHaveAttribute("data-running");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
    act(() => view.report(false));
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
  });

  it("pauses and plays the cycle with its button", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    const { container } = renderChooser();
    fireEvent.click(screen.getByRole("button", { name: "Pause campus highlights" }));
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bedfordview");
    fireEvent.click(screen.getByRole("button", { name: "Play campus highlights" }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
  });

  it("holds while keyboard focus is on a campus name", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    const { container } = renderChooser();
    act(() => wideLayout(container).getByRole("button", { name: "Pretoria, 187 live listings" }).focus());
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bedfordview");
  });

  it("plays again from the toggle while the toggle has focus", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    const { container } = renderChooser();
    const toggle = screen.getByRole("button", { name: "Pause campus highlights" });
    act(() => toggle.focus());
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Play campus highlights" }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(highlighted(container)).toBe("Bloemfontein");
  });

  it("rests on the chosen campus", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY);
    setCampusChoice("pretoria");
    const { container } = renderChooser();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Pretoria");
    expect(wideLayout(container).getByRole("button", { name: "Pretoria, 187 live listings" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("doesn't cycle with reduced motion, or on phones", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query === WIDE_QUERY || query.includes("reduce"));
    const { container } = renderChooser();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(highlighted(container)).toBe("Bedfordview");
    expect(screen.queryByRole("button", { name: /campus highlights/ })).not.toBeInTheDocument();
  });

  it("chooses like the picker, then shows Just listed with focus on its heading", () => {
    const { container } = renderChooser();
    fireEvent.click(wideLayout(container).getByRole("button", { name: "Midrand, 214 live listings" }));
    expect(getCampusCookieValue()).toBe("midrand");
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "New on all campuses" })).toHaveFocus();
  });

  it("marks the chosen card on phones, straight after All campuses", () => {
    setCampusChoice("midrand");
    render(<CampusChooser campuses={campuses} />);
    const cards = within(screen.getByRole("region", { name: "Campuses" }));
    expect(cards.getByRole("button", { name: "Midrand, 214 live listings" })).toHaveAttribute("aria-current", "true");
    // The second card (after All campuses) is Midrand's; the others keep their order behind it.
    const [all, second, third, fourth] = cards.getAllByRole("listitem");
    expect(within(all).getByRole("button", { name: "All campuses, Every Eduvos campus" })).toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "Midrand, 214 live listings" })).toBeInTheDocument();
    expect(within(third).getByRole("button", { name: "Bedfordview, 132 live listings" })).toBeInTheDocument();
    expect(within(fourth).getByRole("button", { name: "Bloemfontein, 58 live listings" })).toBeInTheDocument();
  });

  it("keeps the cards in their usual order while no campus is chosen", () => {
    render(<CampusChooser campuses={campuses} />);
    const cards = within(screen.getByRole("region", { name: "Campuses" }));
    const [, second, third] = cards.getAllByRole("listitem");
    expect(within(second).getByRole("button", { name: "Bedfordview, 132 live listings" })).toBeInTheDocument();
    expect(within(third).getByRole("button", { name: "Bloemfontein, 58 live listings" })).toBeInTheDocument();
  });
});
