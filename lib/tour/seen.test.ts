import { afterEach, describe, expect, it, vi } from "vitest";
import { markTourSeen, TOUR_SEEN_ATTR, TOUR_SEEN_KEY } from "./seen";

afterEach(() => {
  localStorage.removeItem(TOUR_SEEN_KEY);
  document.documentElement.removeAttribute(TOUR_SEEN_ATTR);
  vi.restoreAllMocks();
});

describe("markTourSeen (guided tour spec 3.5)", () => {
  it("remembers the tour and hides Home's invitation at once", () => {
    markTourSeen();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(true);
  });

  it("still hides the invitation for this visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => markTourSeen()).not.toThrow();
    expect(document.documentElement.hasAttribute(TOUR_SEEN_ATTR)).toBe(true);
  });

  it("is named vossie_…, so the privacy page must list it", () => {
    expect(TOUR_SEEN_KEY).toBe("vossie_tour_seen");
  });
});
