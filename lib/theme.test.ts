import { afterEach, describe, expect, it, vi } from "vitest";
import { getTheme, NIGHT_BAR, NIGHT_BAR_ID, setTheme, subscribeTheme, THEME_ATTR, THEME_KEY } from "./theme";

const nightBar = () => document.getElementById(NIGHT_BAR_ID) as HTMLMetaElement | null;

afterEach(() => {
  setTheme("system");
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("matches the phone by default", () => {
    expect(getTheme()).toBe("system");
  });

  it("switches the html attribute, remembers the choice and tells subscribers", () => {
    const listener = vi.fn();
    const stop = subscribeTheme(listener);
    setTheme("dark");
    expect(document.documentElement.getAttribute(THEME_ATTR)).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(getTheme()).toBe("dark");
    setTheme("system");
    expect(document.documentElement.hasAttribute(THEME_ATTR)).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it("gives Night its own browser bar colour, first in <head>, and takes it away again", () => {
    document.head.innerHTML = '<meta name="theme-color" content="#15305D">';
    setTheme("night");
    setTheme("night");
    expect(document.head.querySelectorAll(`#${NIGHT_BAR_ID}`)).toHaveLength(1);
    expect(document.head.firstElementChild).toBe(nightBar());
    expect(nightBar()?.content).toBe(NIGHT_BAR);
    setTheme("light");
    expect(nightBar()).toBeNull();
  });

  it("still switches for this visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    setTheme("night");
    expect(getTheme()).toBe("night");
  });

  it("ignores an attribute it doesn't know", () => {
    document.documentElement.setAttribute(THEME_ATTR, "sepia");
    expect(getTheme()).toBe("system");
  });
});
