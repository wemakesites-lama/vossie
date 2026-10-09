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
    const unsubscribe = subscribeSaved(listener);
    expect(toggleSaved("a")).toBe(true);
    expect(toggleSaved("b")).toBe(true);
    expect(readSavedIds()).toEqual(["b", "a"]);
    expect(isSaved("a")).toBe(true);
    expect(toggleSaved("a")).toBe(false);
    expect(readSavedIds()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("throws when storage is blocked, changing nothing and telling no one", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => toggleSaved("a")).toThrow();
    expect(readSavedIds()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("hears saves made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: SAVED_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something_else" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
