import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { namedImports, parse, ROOT, sourceFiles } from "@/tests/helpers/action-sources";
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
    expect(await ownsTarget("acc-seller", { kind: "seller", id: "tech-corner" })).toBe("shop");
    expect(await ownsTarget("acc-seller", { kind: "listing", id: "l-001" })).toBe("listing");
    expect(await ownsTarget("acc-seller", { kind: "request", id })).toBe("request");
    expect(await ownsTarget("acc-admin", { kind: "seller", id: "tech-corner" })).toBeNull();
    expect(await ownsTarget("acc-admin", { kind: "listing", id: "l-001" })).toBeNull();
    expect(await ownsTarget("acc-admin", { kind: "request", id })).toBeNull();
    // A sample shop and a sample request are nobody's.
    expect(await ownsTarget("acc-seller", { kind: "seller", id: "hair-studio" })).toBeNull();
    expect(await ownsTarget("acc-seller", { kind: "request", id: "r-001" })).toBeNull();
  });
});

// A source check (C4/C5 plan Task 12, decision 5): the synchronous sample internals stay inside lib/data; everything else
// asks the async ownsShop, ownsListing, ownsRequest and ownShopMentor, which answer on either backend.
describe("only lib/data reads ownership synchronously (C4/C5 plan Task 12)", () => {
  it("no file outside lib/data imports isOwnShop, isOwnListing, isOwnRequest or ownShopMentorId", () => {
    const sync = new Set(["isOwnShop", "isOwnListing", "isOwnRequest", "ownShopMentorId"]);
    const importers = sourceFiles(["app", "components", "lib", "tests"])
      .filter((path) => !path.startsWith("lib/data/"))
      .filter((path) => [...sync].some((name) => readFileSync(join(ROOT, path), "utf8").includes(name)))
      .flatMap((path) => namedImports(parse(path)).filter((item) => sync.has(item.name)).map((item) => `${path}: ${item.name}`));
    expect(importers).toEqual([]);
  });
});
