import { describe, expect, it } from "vitest";
import { listingFieldIds, listingFieldPrefix, sellingErrors, shopFieldIds } from "./errors";

describe("selling's error words (plan decisions 24 and 27)", () => {
  it("words a listing's errors and links each to its field", () => {
    expect(sellingErrors(["title-missing", "price-high", "pickup-missing", "photo-size"], listingFieldIds("new"))).toEqual([
      { message: "Give your listing a title.", fieldId: "new-title" },
      // Exactly R100,000 is allowed (amendment 8.8).
      { message: "Keep the price to R100,000 or less.", fieldId: "new-price" },
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
    // A photo chosen with an Edit shop save that failed isn't kept (amendment 13.6).
    expect(sellingErrors(["photo-again"], shopFieldIds("profile"))).toEqual([
      { message: "Choose your photo again.", fieldId: "profile-photo" },
    ]);
  });

  it("words a send that failed, and links it to no field (amendment 9.3)", () => {
    expect(sellingErrors(["send-failed"], shopFieldIds("onb"))).toEqual([
      { message: "Something went wrong, so your application wasn't sent. Try again.", fieldId: null },
    ]);
  });

  it("words a new-listing form that is out of date, and links it to no field (amendment 14.1)", () => {
    expect(sellingErrors(["form-expired"], listingFieldIds("new"))).toEqual([
      { message: "This form is out of date, so nothing was saved. Your answers are kept: check them and save again.", fieldId: null },
    ]);
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

  it("links a too-long description to the first photo whose description is too long, not the file input (amendment 11.5)", () => {
    expect(sellingErrors(["alt-length", "photo-size"], listingFieldIds("edit-l-001", 2))).toEqual([
      { message: "Keep each photo's description to 125 characters.", fieldId: "edit-l-001-alt-3" },
      // The other photo errors still go to the file input (plan decision 24).
      { message: "Each photo must be 5 MB or less.", fieldId: "edit-l-001-photos" },
    ]);
    // With no photo to point at, it goes to the file input, as before.
    expect(listingFieldIds("new").alt).toBe("new-photos");
  });
});
