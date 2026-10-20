import { describe, expect, it } from "vitest";
import {
  listingHiddenText,
  listingShownText,
  reportOutcomeText,
  requestShownText,
  shopApprovedText,
  shopDecisionText,
  slotAnswerText,
  slotRequestedText,
  staffRoleText,
} from "./notification-text";

describe("the sentences staff actions send (staff tools spec 2.3 and 2.4, plan decision 7)", () => {
  it("tells a seller about their shop, without the reason (it shows where the link goes)", () => {
    expect(shopApprovedText("Crochet corner")).toBe("The Hub approved Crochet corner. You can publish your listings now.");
    expect(shopDecisionText("declined", "Crochet corner")).toBe(
      "The Hub didn't approve Crochet corner yet. See why, and send it again.",
    );
    expect(shopDecisionText("paused", "Crochet corner")).toBe("The Hub paused Crochet corner. See why on your dashboard.");
    expect(shopDecisionText("resumed", "Crochet corner")).toBe("The Hub resumed Crochet corner. Buyers can see it again.");
    expect(shopDecisionText("lifted", "Crochet corner")).toBe(
      "The Hub lifted its pause on Crochet corner. It's still paused as you set it: resume it from Sell when you're ready.",
    );
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

describe("staff roles and Show again (stage J spec decisions 7 and 14)", () => {
  it("tells someone given a role where their tools are, and someone who lost one that it has ended", () => {
    expect(staffRoleText("given", "mentor")).toBe(
      "You're a Vossie mentor now. The Hub's tools and the mentor dashboard are on your account page.",
    );
    expect(staffRoleText("given", "admin")).toBe("You're a Vossie admin now. The admin console is on your account page.");
    expect(staffRoleText("removed", "mentor")).toBe(
      "Your mentor role on Vossie has ended. Thank you for helping student sellers.",
    );
    expect(staffRoleText("removed", "admin")).toBe("Your admin role on Vossie has ended.");
  });

  it("tells a seller or an asker the Hub is showing their listing or request again", () => {
    expect(listingShownText("Desk lamp")).toBe("The Hub is showing Desk lamp again. It's back in My listings.");
    expect(requestShownText("Lab coat")).toBe("The Hub is showing your request Lab coat again.");
  });
});
