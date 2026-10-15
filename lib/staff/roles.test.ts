import { describe, expect, it } from "vitest";
import { canUse, isAdmin, staffAreasOf } from "./roles";

const student = { roles: [] as const };
const mentor = { roles: ["mentor"] as const };
const admin = { roles: ["admin"] as const };

describe("who may use the staff areas (staff tools spec 2.1)", () => {
  it("lets only an admin into the admin console", () => {
    expect(canUse(admin, "admin")).toBe(true);
    expect(canUse(mentor, "admin")).toBe(false);
    expect(canUse(student, "admin")).toBe(false);
  });

  it("lets a mentor or an admin into the Hub's tools and the mentor dashboard", () => {
    for (const area of ["hub", "mentor"] as const) {
      expect(canUse(mentor, area), area).toBe(true);
      expect(canUse(admin, area), area).toBe(true);
      expect(canUse(student, area), area).toBe(false);
    }
  });

  it("never lets a signed-out visitor in", () => {
    expect(canUse(null, "hub")).toBe(false);
  });

  it("lists an account's areas in the account page's order", () => {
    expect(staffAreasOf(admin)).toEqual(["admin", "hub", "mentor"]);
    expect(staffAreasOf(mentor)).toEqual(["hub", "mentor"]);
    expect(staffAreasOf(student)).toEqual([]);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(mentor)).toBe(false);
  });
});
