import { describe, expect, it } from "vitest";
import type { StaffRole } from "@/lib/types";
import { barFor, ROLE_PILLS } from "./bar";

const account = (roles: StaffRole[], seller: "open" | "pending" | null = null) => ({
  roles,
  seller:
    seller === null
      ? null
      : { status: seller === "open" ? ("approved" as const) : ("pending" as const), sellerSlug: seller === "open" ? "tech-corner" : null },
});

describe("barFor (role bars spec 4)", () => {
  it("gives the student bar to anyone signed out or without a shop or role", () => {
    expect(barFor(null)).toBe("student");
    expect(barFor(account([]))).toBe("student");
  });

  it("gives the seller bar to any account with a shop, pending included", () => {
    expect(barFor(account([], "open"))).toBe("seller");
    expect(barFor(account([], "pending"))).toBe("seller");
  });

  it("puts the highest role first: admin, then mentor, then seller", () => {
    expect(barFor(account(["mentor"]))).toBe("mentor");
    expect(barFor(account(["mentor"], "open"))).toBe("mentor");
    expect(barFor(account(["admin"]))).toBe("admin");
    expect(barFor(account(["admin", "mentor"], "open"))).toBe("admin");
  });

  it("opens each role's workspace from its pill", () => {
    expect(ROLE_PILLS.seller).toMatchObject({ label: "My shop", href: "/sell" });
    expect(ROLE_PILLS.mentor).toMatchObject({ label: "Mentoring", href: "/mentor" });
    expect(ROLE_PILLS.admin).toMatchObject({ label: "Today", href: "/admin" });
  });
});
