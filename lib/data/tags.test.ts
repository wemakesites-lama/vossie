import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { hubChanged, hubChangedNow, pickupPointsChanged, requestsChangedNow, sellersChangedNow } from "./tags";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetRequest(request);
});

describe("the staff tools' cache tags (staff tools plan decisions 10 and 11)", () => {
  it("expires the Hub's posts and the pickup points after a staff write", () => {
    hubChanged();
    pickupPointsChanged();
    expect(request.updatedTags).toEqual(["hub", "pickup-points"]);
  });
});

describe("expiring the sellers tag from a Route Handler (stage K spec decision 4)", () => {
  it("calls revalidateTag with expire 0, never updateTag", () => {
    sellersChangedNow();
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);
    expect(request.updatedTags).toEqual([]);
  });
});

describe("expiring the Hub's and the board's tags from a Route Handler (account deletion ends in a page load)", () => {
  it("calls revalidateTag with expire 0, never updateTag", () => {
    hubChangedNow();
    requestsChangedNow();
    expect(request.revalidatedTags).toEqual([
      { tag: "hub", profile: { expire: 0 } },
      { tag: "requests", profile: { expire: 0 } },
    ]);
    expect(request.updatedTags).toEqual([]);
  });
});
