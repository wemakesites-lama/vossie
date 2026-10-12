import { describe, expect, it, vi } from "vitest";
import {
  getRecentlyViewed,
  recordRecentlyViewed,
  RECENTLY_VIEWED_KEY,
  subscribeRecentlyViewed,
  type ViewedItem,
} from "./recently-viewed";

const item = (id: string): ViewedItem => ({ id, title: `Item ${id}`, image: { src: `/placeholders/listing/${id}.svg`, alt: "" } });

describe("recently viewed on this device", () => {
  it("starts empty and survives broken storage", () => {
    expect(getRecentlyViewed()).toEqual([]);
    localStorage.setItem(RECENTLY_VIEWED_KEY, "{not json");
    expect(getRecentlyViewed()).toEqual([]);
  });

  it("keeps the newest first, moves a repeat to the front, and keeps six", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) recordRecentlyViewed(item(id));
    recordRecentlyViewed(item("c"));
    expect(getRecentlyViewed().map((viewed) => viewed.id)).toEqual(["c", "g", "f", "e", "d", "b"]);
  });

  it("returns the same array until storage changes, as useSyncExternalStore needs", () => {
    recordRecentlyViewed(item("a"));
    expect(getRecentlyViewed()).toBe(getRecentlyViewed());
  });

  it("drops anything that isn't one of our own images, since storage can be edited by hand", () => {
    localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify([item("a"), { id: "x", title: "X", image: { src: "https://evil.example/x.png", alt: "" } }, { id: 1 }]),
    );
    expect(getRecentlyViewed().map((viewed) => viewed.id)).toEqual(["a"]);
  });

  it("tells subscribers when something is recorded", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecentlyViewed(listener);
    recordRecentlyViewed(item("a"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
