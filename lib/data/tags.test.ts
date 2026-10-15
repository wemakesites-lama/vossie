import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { hubChanged, pickupPointsChanged } from "./tags";

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
