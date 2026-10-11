import { describe, expect, it, vi } from "vitest";
import { setScrollY } from "@/tests/helpers/dom";
import { createHeaderStore } from "./header-store";

describe("header store", () => {
  it("follows window scrolling while subscribed", () => {
    const store = createHeaderStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.getSnapshot()).toBe("expanded");
    setScrollY(400);
    expect(store.getSnapshot()).toBe("crest");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setScrollY(0);
    expect(store.getSnapshot()).toBe("crest");
  });

  it("starts from the current scroll position when it subscribes", () => {
    setScrollY(500);
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    expect(store.getSnapshot()).toBe("crest");
    unsubscribe();
  });

  it("reveals, and a hold stops it hiding again", () => {
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    setScrollY(500);
    store.reveal();
    expect(store.getSnapshot()).toBe("revealed");
    store.setHold(() => true);
    setScrollY(900);
    expect(store.getSnapshot()).toBe("revealed");
    store.setHold(() => false);
    setScrollY(901);
    expect(store.getSnapshot()).toBe("crest");
    unsubscribe();
  });

  it("renders expanded on the server", () => {
    expect(createHeaderStore().getServerSnapshot()).toBe("expanded");
  });

  it("moves the reveal anchor up as the page scrolls up", () => {
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    setScrollY(500);
    store.reveal();
    setScrollY(300);
    setScrollY(459);
    expect(store.getSnapshot()).toBe("revealed");
    setScrollY(460);
    expect(store.getSnapshot()).toBe("crest");
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
    expect(store.getSnapshot()).toBe("crest");
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

  it("ignores a reveal unless the header is crest only", () => {
    const store = createHeaderStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.reveal();
    expect(store.getSnapshot()).toBe("expanded");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
