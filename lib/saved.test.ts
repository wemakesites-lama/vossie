import { describe, expect, it, vi } from "vitest";
import { blockCookies } from "@/tests/helpers/dom";
import {
  forgetSaved,
  getSavedCount,
  isSaved,
  parseSavedIds,
  readSavedIds,
  SAVED_COOKIE,
  SAVED_LIMIT,
  savedCookieString,
  subscribeSaved,
  toggleSaved,
} from "./saved";

/** `count` ids, newest first: l-0 is the newest, the last is the oldest. */
const many = (count: number) => Array.from({ length: count }, (_, n) => `l-${n}`);

describe("reading the saved cookie (shopping spec 5.1)", () => {
  it("splits the ids, newest first", () => {
    expect(parseSavedIds("l-003.l-001.fs-002")).toEqual(["l-003", "l-001", "fs-002"]);
  });

  it("treats a missing or empty cookie as nothing saved", () => {
    expect(parseSavedIds(undefined)).toEqual([]);
    expect(parseSavedIds(null)).toEqual([]);
    expect(parseSavedIds("")).toEqual([]);
  });

  it("drops bad values and repeats", () => {
    expect(parseSavedIds("l-001..L-002.l 3.l-001.%3Cb%3E.l-004")).toEqual(["l-001", "l-004"]);
    expect(parseSavedIds(`${"a".repeat(41)}.${"b".repeat(40)}`)).toEqual(["b".repeat(40)]);
  });

  it("keeps the first 100", () => {
    expect(parseSavedIds(many(120).join("."))).toEqual(many(SAVED_LIMIT));
  });

  it("writes the ids joined with dots, and deletes the cookie when there are none", () => {
    expect(savedCookieString(["l-002", "l-001"], false)).toBe(
      "vossie_saved=l-002.l-001; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(savedCookieString([], false)).toBe("vossie_saved=; Path=/; Max-Age=0; SameSite=Lax");
  });
});

describe("saved items on this device", () => {
  it("starts empty", () => {
    expect(readSavedIds()).toEqual([]);
    expect(getSavedCount()).toBe(0);
  });

  it("toggles an id, newest first, keeps it in the cookie and tells subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    expect(toggleSaved("a")).toBe(true);
    expect(toggleSaved("b")).toBe(true);
    expect(readSavedIds()).toEqual(["b", "a"]);
    expect(document.cookie).toContain(`${SAVED_COOKIE}=b.a`);
    expect(isSaved("a")).toBe(true);
    expect(toggleSaved("a")).toBe(false);
    expect(readSavedIds()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("drops the oldest when saving past 100", () => {
    document.cookie = savedCookieString(many(SAVED_LIMIT), false);
    expect(toggleSaved("newest")).toBe(true);
    expect(getSavedCount()).toBe(SAVED_LIMIT);
    expect(readSavedIds()[0]).toBe("newest");
    expect(isSaved(`l-${SAVED_LIMIT - 1}`)).toBe(false);
  });

  it("throws when cookies are blocked, telling no one", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    blockCookies();
    expect(() => toggleSaved("a")).toThrow();
    expect(readSavedIds()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("re-checks when the tab comes back into view, for saves made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("forgetting saved ids (listings that no longer exist)", () => {
  it("removes the ids from the cookie, keeps the others in order and tells subscribers", () => {
    document.cookie = savedCookieString(["l-3", "gone-1", "l-2", "gone-2", "l-1"], false);
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    forgetSaved(["gone-1", "gone-2"]);
    expect(readSavedIds()).toEqual(["l-3", "l-2", "l-1"]);
    expect(document.cookie).toContain(`${SAVED_COOKIE}=l-3.l-2.l-1`);
    expect(getSavedCount()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("deletes the cookie when every saved id is forgotten", () => {
    document.cookie = savedCookieString(["gone-1"], false);
    forgetSaved(["gone-1"]);
    expect(readSavedIds()).toEqual([]);
    expect(document.cookie).not.toContain(SAVED_COOKIE);
  });

  it("leaves the cookie and the subscribers alone when none of the ids are saved", () => {
    document.cookie = savedCookieString(["l-2", "l-1"], false);
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    forgetSaved(["gone-1"]);
    forgetSaved([]);
    expect(readSavedIds()).toEqual(["l-2", "l-1"]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does nothing, and doesn't throw, when cookies are blocked", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    blockCookies();
    expect(() => forgetSaved(["gone-1"])).not.toThrow();
    expect(readSavedIds()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("doesn't throw when the browser refuses the write", () => {
    // Some browsers throw (not just drop the write) when a page may not set cookies, such as in a sandboxed frame.
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => `${SAVED_COOKIE}=l-1.gone-1`,
      set: () => {
        throw new DOMException("Not allowed", "SecurityError");
      },
    });
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    expect(() => forgetSaved(["gone-1"])).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
