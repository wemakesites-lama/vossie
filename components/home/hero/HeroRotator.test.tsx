import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LOW_DATA_ATTR } from "@/lib/low-data";
import type { HeroSlide } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { HeroRotator } from "./HeroRotator";

const slide = (word: string): HeroSlide => ({
  id: word,
  word,
  body: `All about ${word}.`,
  cta: { label: `Shop ${word}`, href: `/categories/${word}` },
  image: { src: `/placeholders/hero/${word}.svg`, alt: `A photo about ${word}` },
});

const slides = [slide("textbooks"), slide("tech"), slide("services")];

const hero = (
  <HeroRotator
    slides={slides}
    sentence="Buy & sell textbooks, tech and services on campus"
    chip={<button type="button">Shopping at Midrand</button>}
  />
);

const activeWord = (container: HTMLElement) => container.querySelector(".hero-word[data-active]")?.textContent;
const photos = (container: ParentNode) => container.querySelectorAll(".hero-photo");

describe("HeroRotator (spec 7.3)", () => {
  it("gives screen readers one stable headline and shows one word at a time", () => {
    const { container } = render(hero);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "Buy & sell textbooks, tech and services on campus",
    );
    expect(activeWord(container)).toBe("textbooks");
    expect(screen.getByRole("link", { name: "Shop textbooks" })).toHaveAttribute("href", "/categories/textbooks");
    // The other slides' copy is there, so the panel keeps its height, but nobody can reach it.
    expect(screen.getByText("All about tech.").closest(".hero-copy")).toHaveAttribute("inert");
  });

  it("moves to the next slide every seven seconds and loops", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(activeWord(container)).toBe("tech");
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("stops when paused, and a thumbnail shows its slide and stops autoplay", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    fireEvent.click(screen.getByRole("button", { name: "Pause slides" }));
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");

    fireEvent.click(screen.getByRole("button", { name: "Play slides" }));
    const third = screen.getByRole("button", { name: "Show slide 3 of 3: services" });
    fireEvent.click(third);
    expect(activeWord(container)).toBe("services");
    expect(third).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Play slides" })).toBeInTheDocument();
  });

  it("never autoplays with reduced motion", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query.includes("reduce"));
    const { container } = render(hero);
    act(() => {
      vi.advanceTimersByTime(21000);
    });
    expect(activeWord(container)).toBe("textbooks");
    expect(screen.getByRole("button", { name: "Play slides" })).toBeInTheDocument();
  });

  it("holds while a mouse is over it", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    fireEvent.pointerEnter(container.querySelector(".hero")!, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("holds while keyboard focus is on a call to action", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    act(() => screen.getByRole("link", { name: "Shop textbooks" }).focus());
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("plays again from the toggle while the toggle has focus", () => {
    vi.useFakeTimers();
    const { container } = render(hero);
    const toggle = screen.getByRole("button", { name: "Pause slides" });
    act(() => toggle.focus());
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Play slides" }));
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(activeWord(container)).toBe("tech");
  });

  it("holds while the tab is hidden", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const { container } = render(hero);
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(activeWord(container)).toBe("textbooks");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("changes slide with a sideways swipe, but not with a mostly vertical one", () => {
    const { container } = render(hero);
    const media = container.querySelector(".hero-media")!;
    fireEvent.pointerDown(media, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(media, { pointerType: "touch", clientX: 200, clientY: 110 });
    expect(activeWord(container)).toBe("tech");
    // A swipe stops autoplay, like choosing a thumbnail.
    expect(screen.getByRole("button", { name: "Play slides" })).toBeInTheDocument();
    fireEvent.pointerDown(media, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(media, { pointerType: "touch", clientX: 160, clientY: 260 });
    expect(activeWord(container)).toBe("tech");
    fireEvent.pointerDown(media, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(media, { pointerType: "touch", clientX: 220, clientY: 100 });
    expect(activeWord(container)).toBe("textbooks");
  });

  it("puts only the first photo in the server's HTML", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(hero);
    expect(photos(host)).toHaveLength(1);
  });

  it("mounts the other photos once the page has loaded, for the cross-fade", () => {
    const { container } = render(hero);
    expect(photos(container)).toHaveLength(3);
  });

  it("with reduced motion, still loads the other photos once the page has loaded", () => {
    mockMatchMedia((query) => query.includes("reduce"));
    const { container } = render(hero);
    expect(photos(container)).toHaveLength(3);
  });

  it("with data saver on, loads only the photo on show", () => {
    document.documentElement.setAttribute(LOW_DATA_ATTR, "");
    const { container } = render(hero);
    expect(photos(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2 of 3: tech" }));
    // The first stays: it's already loaded, and it's the server's photo.
    expect(photos(container)).toHaveLength(2);
  });
});
