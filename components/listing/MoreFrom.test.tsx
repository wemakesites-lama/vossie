import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getListingDetail } from "@/lib/data";
import { MoreFrom } from "./MoreFrom";

const more = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getMoreFrom: async (...args: Parameters<typeof actual.getMoreFrom>) => {
      if (more.mode === "failing") throw new Error("Didn't load");
      if (more.mode === "empty") return { from: "seller" as const, items: [] };
      return actual.getMoreFrom(...args);
    },
  };
});

afterEach(() => {
  more.mode = "real";
});

const names = new Map([["midrand", "Midrand"]]);

async function forCalculator() {
  const listing = (await getListingDetail("l-001"))!.listing;
  return MoreFrom({ listing, sellerName: "Tech corner", categoryName: "Tech", campusNames: names });
}

describe("MoreFrom (spec 5.7)", () => {
  it("shows more from the seller", async () => {
    render((await forCalculator())!);
    expect(screen.getByRole("heading", { level: 2, name: "More from Tech corner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gaming headset, barely used" })).toHaveAttribute("href", "/listings/l-007");
  });

  it("is hidden when there's nothing to show", async () => {
    more.mode = "empty";
    expect(await forCalculator()).toBeNull();
  });

  it("shows its own error, with a way back to this listing", async () => {
    more.mode = "failing";
    render((await forCalculator())!);
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/listings/l-001?retry=more-from#more-from");
  });
});
