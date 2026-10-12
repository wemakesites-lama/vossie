import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Announcement } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { AnnouncementBar } from "./AnnouncementBar";

const messages: Announcement[] = [
  { id: "a", tag: "New", text: "First message", href: "/sell" },
  { id: "b", tag: "Safety", text: "Second message", href: "/safety" },
  { id: "c", tag: "Hub", text: "Third message", href: "/hub" },
];

const activeText = (container: HTMLElement) =>
  container.querySelector(".announce-item[data-active]")?.textContent;

// jsdom can't hide a tab, so redefine the property the component reads and fire the event it listens for.
function setTabVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("AnnouncementBar", () => {
  it("moves to the next message every six seconds and loops", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    expect(activeText(container)).toContain("First message");
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
  });

  it("makes the hidden messages inert", () => {
    const { container } = render(<AnnouncementBar messages={messages} />);
    const items = container.querySelectorAll(".announce-item");
    expect(items[0]).not.toHaveAttribute("inert");
    expect(items[1]).toHaveAttribute("inert");
    expect(items[2]).toHaveAttribute("inert");
  });

  it("stops when paused and starts again on play", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause announcements" }));
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    fireEvent.click(screen.getByRole("button", { name: "Play announcements" }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
  });

  it("holds still while a mouse is over it", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    const bar = screen.getByRole("region", { name: "Announcements" });
    fireEvent.pointerEnter(bar, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    fireEvent.pointerLeave(bar, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
  });

  it("isn't held by a touch tap", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    fireEvent.pointerEnter(screen.getByRole("region", { name: "Announcements" }), { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
  });

  it("keeps a focused message in place, even when a mouse passes over and leaves", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    const bar = screen.getByRole("region", { name: "Announcements" });
    act(() => screen.getByRole("link", { name: /First message/ }).focus());
    fireEvent.pointerEnter(bar, { pointerType: "mouse" });
    fireEvent.pointerLeave(bar, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
  });

  it("carries on once focus moves off the message", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    act(() => screen.getByRole("link", { name: /First message/ }).focus());
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    act(() => screen.getByRole("button", { name: "Pause announcements" }).focus());
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
  });

  it("holds still while the tab is hidden, and carries on when it is shown again", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    try {
      setTabVisibility("hidden");
      act(() => {
        vi.advanceTimersByTime(12000);
      });
      expect(activeText(container)).toContain("First message");
      setTabVisibility("visible");
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(activeText(container)).toContain("Second message");
    } finally {
      // Back to jsdom's own getter on Document.prototype.
      Reflect.deleteProperty(document, "visibilityState");
    }
  });

  it("does not rotate in a tab that was already hidden when the page loaded", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      const { container } = render(<AnnouncementBar messages={messages} />);
      act(() => {
        vi.advanceTimersByTime(12000);
      });
      expect(activeText(container)).toContain("First message");
      setTabVisibility("visible");
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(activeText(container)).toContain("Second message");
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }
  });

  it("starts paused with reduced motion", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query.includes("reduce"));
    const { container } = render(<AnnouncementBar messages={messages} />);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    expect(screen.getByRole("button", { name: "Play announcements" })).toBeInTheDocument();
  });

  it("shows a single message without a pause button, and nothing without messages", () => {
    const { rerender, container } = render(<AnnouncementBar messages={messages.slice(0, 1)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<AnnouncementBar messages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a message showing when the list gets shorter", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<AnnouncementBar messages={messages} />);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("Third message");
    rerender(<AnnouncementBar messages={messages.slice(0, 2)} />);
    expect(activeText(container)).toContain("First message");
  });
});
