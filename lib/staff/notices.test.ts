import { describe, expect, it } from "vitest";
import { HUB_PAUSE_LINE, SELLER_PAUSE_LINE, staffNoticeText } from "./notices";

describe("what a page says after a staff action (spec 4, plan decision 23)", () => {
  it("words a known code, and says nothing for an unknown one", () => {
    expect(staffNoticeText("approved")).toBe("Approved. The shop is live, and its owner has been told.");
    expect(staffNoticeText("nothing")).toBe("Nothing changed. It was already done.");
    expect(staffNoticeText("rsvp")).toBe("You're going. See you there.");
    expect(staffNoticeText("toString")).toBeNull();
    expect(staffNoticeText(null)).toBeNull();
  });

  it("says what each kind of pause does (amendment 30)", () => {
    expect(SELLER_PAUSE_LINE).toBe(
      "Paused. Its listings are off every list and it takes no new messages. Its pages stay up, marked paused.",
    );
    expect(HUB_PAUSE_LINE).toBe("Paused by the Hub. Its pages are down for buyers and it can't send messages.");
    expect(staffNoticeText("paused")).toBe(HUB_PAUSE_LINE);
  });

  it("words the amendments' outcomes: a changed target, deletions, a listing shown again, a passed request", () => {
    expect(staffNoticeText("changed")).toBe("That has changed; open it again.");
    expect(staffNoticeText("note-deleted")).toBe("Note deleted.");
    expect(staffNoticeText("check-in-deleted")).toBe("Check-in deleted.");
    expect(staffNoticeText("listing-shown")).toBe("Shown again. Its seller has been told.");
    expect(staffNoticeText("booking-passed")).toBe("Those office hours have passed, so the request can't be answered.");
    expect(staffNoticeText("resumed-seller-pause")).toMatch(/^The Hub's pause is lifted/);
  });
});
