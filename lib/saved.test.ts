import { describe, expect, it, vi } from "vitest";
import { getSavedCount, isSaved, readSavedIds, SAVED_KEY, subscribeSaved, toggleSaved } from "./saved";

describe("saved items on this device", () => {
  it("starts empty and survives corrupt storage", () => {
    expect(readSavedIds()).toEqual([]);
    localStorage.setItem(SAVED_KEY, "{not json");
    expect(getSavedCount()).toBe(0);
  });

  it("toggles an id, newest first, and tells subscribers", () => {
    const listener = vi.fn();
    subscribeSaved(listener);
    expect(toggleSaved("a")).toBe(true);
    expect(toggleSaved("b")).toBe(true);
    expect(readSavedIds()).toEqual(["b", "a"]);
    expect(isSaved("a")).toBe(true);
    expect(toggleSaved("a")).toBe(false);
    expect(readSavedIds()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("hears saves made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: SAVED_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something_else" }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
