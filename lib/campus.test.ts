import { describe, expect, it, vi } from "vitest";
import {
  ALL_CAMPUSES,
  CAMPUS_COOKIE,
  campusCookieString,
  campusLabel,
  getCampusCookieValue,
  parseCampusChoice,
  readCampusCookie,
  setCampusChoice,
  subscribeCampus,
} from "./campus";

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("campus choice", () => {
  it("accepts known slugs and falls back to all campuses", () => {
    expect(parseCampusChoice("midrand", campuses)).toBe("midrand");
    expect(parseCampusChoice("atlantis", campuses)).toBe(ALL_CAMPUSES);
    expect(parseCampusChoice(null, campuses)).toBe(ALL_CAMPUSES);
  });

  it("reads the campus cookie out of a cookie string", () => {
    expect(readCampusCookie(`theme=dark; ${CAMPUS_COOKIE}=pretoria; other=1`)).toBe("pretoria");
    expect(readCampusCookie("theme=dark")).toBeNull();
  });

  it("builds a one-year Lax cookie, adding Secure only on https", () => {
    expect(campusCookieString("midrand", false)).toBe(
      "vossie_campus=midrand; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(campusCookieString("midrand", true)).toMatch(/; Secure$/);
  });

  it("labels the choice for the header and menu", () => {
    expect(campusLabel(null, campuses)).toBe("Campus");
    expect(campusLabel(ALL_CAMPUSES, campuses)).toBe("All campuses");
    expect(campusLabel("pretoria", campuses)).toBe("Pretoria");
  });

  it("saves the choice in the cookie and tells subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCampus(listener);
    setCampusChoice("midrand");
    expect(getCampusCookieValue()).toBe("midrand");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setCampusChoice("pretoria");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
