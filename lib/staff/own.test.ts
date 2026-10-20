import { beforeEach, describe, expect, it } from "vitest";
import { createRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { ownsTarget } from "./own";

beforeEach(() => {
  resetSampleStore();
});

describe("whose a report's target is (stage L spec decisions 1 and 2)", () => {
  it("names what's the admin's own: their shop, a listing of it, their request; nothing else", async () => {
    const { id } = await createRequest({
      askerId: "acc-seller",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    expect(ownsTarget("acc-seller", { kind: "seller", id: "tech-corner" })).toBe("shop");
    expect(ownsTarget("acc-seller", { kind: "listing", id: "l-001" })).toBe("listing");
    expect(ownsTarget("acc-seller", { kind: "request", id })).toBe("request");
    expect(ownsTarget("acc-admin", { kind: "seller", id: "tech-corner" })).toBeNull();
    expect(ownsTarget("acc-admin", { kind: "listing", id: "l-001" })).toBeNull();
    expect(ownsTarget("acc-admin", { kind: "request", id })).toBeNull();
    // A sample shop and a sample request are nobody's.
    expect(ownsTarget("acc-seller", { kind: "seller", id: "hair-studio" })).toBeNull();
    expect(ownsTarget("acc-seller", { kind: "request", id: "r-001" })).toBeNull();
  });
});
