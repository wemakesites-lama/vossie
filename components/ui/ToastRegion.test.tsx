import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { showToast } from "@/lib/toast";
import { ToastRegion } from "./ToastRegion";

describe("ToastRegion", () => {
  it("announces a toast politely and clears it after four seconds", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => {
      showToast("Showing Midrand first");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Showing Midrand first");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("gives a newer toast its own full time", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => {
      showToast("One");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
      showToast("Two");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Two");
  });
});
