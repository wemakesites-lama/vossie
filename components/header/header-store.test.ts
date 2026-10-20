import { afterEach, describe, expect, it, vi } from "vitest";
import { setScrollY } from "@/tests/helpers/dom";
import { createHeaderStore } from "./header-store";

function setPageHeight(height: number) {
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: height });
}

afterEach(() => {
  Reflect.deleteProperty(document.documentElement, "scrollHeight");
});

describe("header store", () => {
  it("follows window scrolling while subscribed", () => {
    const store = createHeaderStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.getSnapshot()).toBe("expanded");
    setScrollY(400);
    expect(store.getSnapshot()).toBe("hidden");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setScrollY(0);
    expect(store.getSnapshot()).toBe("hidden");
  });

  it("starts from the current scroll position when it subscribes", () => {
    setScrollY(500);
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    expect(store.getSnapshot()).toBe("hidden");
    unsubscribe();
  });

  it("shows when scrolled back up, and a hold stops it hiding again", () => {
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    setScrollY(500);
    setScrollY(450);
    expect(store.getSnapshot()).toBe("shown");
    store.setHold(() => true);
    setScrollY(900);
    expect(store.getSnapshot()).toBe("shown");
    store.setHold(() => false);
    setScrollY(901);
    expect(store.getSnapshot()).toBe("hidden");
    unsubscribe();
  });

  it("shows on the keyboard's button", () => {
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    setScrollY(500);
    store.show();
    expect(store.getSnapshot()).toBe("shown");
    unsubscribe();
  });

  it("renders expanded on the server", () => {
    expect(createHeaderStore().getServerSnapshot()).toBe("expanded");
  });

  it("doesn't take iOS's bounce at the bottom of the page for scrolling up", () => {
    // 768px screen (jsdom's innerHeight), 2000px page: the bottom is at 1232.
    setPageHeight(2000);
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    setScrollY(1232);
    setScrollY(1300);
    setScrollY(1232);
    expect(store.getSnapshot()).toBe("hidden");
    unsubscribe();
  });

  it("lets a hold stop hiding, but never the return to the full header", () => {
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    store.setHold(() => true);
    setScrollY(400);
    expect(store.getSnapshot()).toBe("expanded");
    store.setHold(() => false);
    setScrollY(401);
    expect(store.getSnapshot()).toBe("hidden");
    store.setHold(() => true);
    setScrollY(50);
    expect(store.getSnapshot()).toBe("expanded");
    unsubscribe();
  });

  it("tells subscribers only when the mode changes", () => {
    const store = createHeaderStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    setScrollY(400);
    setScrollY(500);
    setScrollY(600);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("ignores a show unless the header is hidden", () => {
    const store = createHeaderStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.show();
    expect(store.getSnapshot()).toBe("expanded");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
