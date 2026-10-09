import { describe, expect, it, vi } from "vitest";
import { getLowData, LOW_DATA_ATTR, LOW_DATA_KEY, setLowData, subscribeLowData } from "./low-data";

describe("data saver", () => {
  it("is off by default", () => {
    expect(getLowData()).toBe(false);
  });

  it("switches the html attribute, remembers the choice and tells subscribers", () => {
    const listener = vi.fn();
    subscribeLowData(listener);
    setLowData(true);
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
    expect(localStorage.getItem(LOW_DATA_KEY)).toBe("1");
    expect(getLowData()).toBe(true);
    setLowData(false);
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(false);
    expect(localStorage.getItem(LOW_DATA_KEY)).toBe("0");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
