import { describe, expect, it } from "vitest";
import {
  deleteListingPath,
  editListingPath,
  myListingsPath,
  onboardingPath,
  parseListingsTab,
  parseStep,
  tabFor,
} from "./paths";

describe("selling's addresses (selling spec 2.2 and 3)", () => {
  it("puts the wizard's step in the link, and reads it back safely", () => {
    expect(onboardingPath(1)).toBe("/sell/onboarding");
    expect(onboardingPath(4)).toBe("/sell/onboarding?step=4");
    expect(parseStep("3")).toBe(3);
    expect(parseStep(["2", "4"])).toBe(2);
    for (const bad of [undefined, "", "0", "6", "2.5", "two", ["9"]]) expect(parseStep(bad)).toBe(1);
  });

  it("reads My listings' tab, and links to each", () => {
    expect(parseListingsTab("drafts")).toBe("drafts");
    expect(parseListingsTab("nope")).toBe("available");
    expect(parseListingsTab(undefined)).toBe("available");
    expect(myListingsPath()).toBe("/sell/listings");
    expect(myListingsPath("sold")).toBe("/sell/listings?tab=sold");
  });

  it("knows which tab each state belongs to", () => {
    expect([tabFor("available"), tabFor("paused"), tabFor("sold"), tabFor("draft")]).toEqual([
      "available",
      "paused",
      "sold",
      "drafts",
    ]);
  });

  it("links to a listing's form and its delete page", () => {
    expect(editListingPath("l-001")).toBe("/sell/listings/l-001/edit");
    expect(deleteListingPath("l-001")).toBe("/sell/listings/l-001/delete");
  });
});
