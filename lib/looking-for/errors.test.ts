import { describe, expect, it } from "vitest";
import { offerErrors, offerFieldIds, requestErrors, requestFieldIds } from "./errors";

describe("the request form's error words (community actions spec 2.3 and 2.4)", () => {
  it("links each to its field, by the form's own ids (plan decision 2)", () => {
    const ids = requestFieldIds("request-new");
    expect(ids).toEqual({
      title: "request-new-title",
      category: "request-new-category",
      campus: "request-new-campus",
      details: "request-new-details",
      budget: "request-new-budget",
      swap: "request-new-swap",
      neededBy: "request-new-needed-by",
    });
    expect(requestErrors(["title-contact", "needed-past", "open-limit"], ids)).toEqual([
      { message: "Take out the phone number or email. Shops will message you on Vossie.", fieldId: "request-new-title" },
      { message: "Choose today or a later date.", fieldId: "request-new-needed-by" },
      { message: "You have 5 open requests. Close one before you post another.", fieldId: null },
    ]);
    expect(requestFieldIds("request-r-001").title).toBe("request-r-001-title");
  });

  it("says a form with no good one-time token has expired, linked to no field (plan amendment 3)", () => {
    expect(requestErrors(["form-expired"], requestFieldIds("request-new"))).toEqual([
      { message: "This form has expired. Check it and send it again.", fieldId: null },
    ]);
  });

  it("drops a code it doesn't know", () => {
    expect(requestErrors(["toString", "made-up"], requestFieldIds("request-new"))).toEqual([]);
  });
});

describe("the offer composer's error words (community actions spec 2.9)", () => {
  it("uses E's words for the message, and says when the shop has offered enough today", () => {
    const ids = offerFieldIds("offer-r-001");
    expect(ids).toEqual({ body: "offer-r-001-body", listing: "offer-r-001-listing" });
    expect(offerErrors(["message-missing", "offer-rate"], ids)).toEqual([
      { message: "Write a message first.", fieldId: "offer-r-001-body" },
      { message: "Your shop has made 20 offers today. Try again tomorrow.", fieldId: null },
    ]);
  });
});
