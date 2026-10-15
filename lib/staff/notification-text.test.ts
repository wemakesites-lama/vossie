import { describe, expect, it } from "vitest";
import {
  listingHiddenText,
  reportOutcomeText,
  shopApprovedText,
  shopDecisionText,
  slotAnswerText,
  slotRequestedText,
} from "./notification-text";

describe("the sentences staff actions send (staff tools spec 2.3 and 2.4, plan decision 7)", () => {
  it("tells a seller about their shop, without the reason (it shows where the link goes)", () => {
    expect(shopApprovedText("Crochet corner")).toBe("The Hub approved Crochet corner. You can publish your listings now.");
    expect(shopDecisionText("declined", "Crochet corner")).toBe(
      "The Hub didn't approve Crochet corner yet. See why, and send it again.",
    );
    expect(shopDecisionText("paused", "Crochet corner")).toBe("The Hub paused Crochet corner. See why on your dashboard.");
    expect(shopDecisionText("resumed", "Crochet corner")).toBe("The Hub resumed Crochet corner. Buyers can see it again.");
    expect(shopDecisionText("verified", "Crochet corner")).toBe("Crochet corner is now Verified by the Hub.");
    expect(shopDecisionText("unverified", "Crochet corner")).toBe("Crochet corner is no longer Verified by the Hub.");
    expect(listingHiddenText("Desk lamp")).toBe("The Hub hid Desk lamp. See why in My listings.");
  });

  it("thanks a reporter in the spec's words", () => {
    expect(reportOutcomeText("acted", "Desk lamp")).toBe("Thanks, we've acted on your report about Desk lamp.");
    expect(reportOutcomeText("dismissed", "Desk lamp")).toBe(
      "We looked at your report about Desk lamp and didn't find a problem.",
    );
  });

  it("answers a slot request, and tells the office hours' author about a new one", () => {
    expect(slotAnswerText("accepted", "Office hours: your first listing")).toBe(
      "A mentor accepted your slot request for Office hours: your first listing.",
    );
    expect(slotAnswerText("declined", "Office hours: your first listing")).toBe(
      "A mentor couldn't fit in your slot request for Office hours: your first listing. You can ask again.",
    );
    expect(slotRequestedText("Thandi", "Office hours: your first listing")).toBe(
      "Thandi asked for a slot at Office hours: your first listing.",
    );
  });
});
