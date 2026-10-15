import { describe, expect, it } from "vitest";
import { listingFieldIds, listingFieldPrefix, sellingErrors, shopFieldIds } from "./errors";

describe("selling's error words (plan decisions 24 and 27)", () => {
  it("words a listing's errors and links each to its field", () => {
    expect(sellingErrors(["title-missing", "price-high", "pickup-missing", "photo-size"], listingFieldIds("new"))).toEqual([
      { message: "Give your listing a title.", fieldId: "new-title" },
      { message: "The price can be up to R100,000.", fieldId: "new-price" },
      { message: "Choose one of your pickup points.", fieldId: "new-pickup" },
      { message: "Each photo must be 5 MB or less.", fieldId: "new-photos" },
    ]);
  });

  it("words a shop's errors, with the wizard's and Edit shop's own ids (plan decision 23)", () => {
    expect(sellingErrors(["name-taken", "points-missing"], shopFieldIds("onb"))).toEqual([
      { message: "Another shop on your campus has that name. Try another.", fieldId: "onb-name" },
      { message: "Choose at least one pickup point.", fieldId: "onb-points" },
    ]);
    expect(sellingErrors(["slug-taken"], shopFieldIds("profile"))[0].fieldId).toBe("profile-slug");
  });

  it("leaves an error unlinked when the form has no such field, and drops codes it doesn't know", () => {
    expect(sellingErrors(["guidelines-missing"], { name: "x" })).toEqual([
      { message: "Tick the box to say you've read the seller guidelines.", fieldId: null },
    ]);
    expect(sellingErrors(["nonsense", "toString"], shopFieldIds("onb"))).toEqual([]);
  });

  it("prefixes a listing's fields with the listing, so a kept page's form never shares an id (plan decision 23)", () => {
    expect(listingFieldPrefix(null)).toBe("new");
    expect(listingFieldPrefix("l-001")).toBe("edit-l-001");
    expect(listingFieldIds("edit-l-001").title).toBe("edit-l-001-title");
  });
});
