import { describe, expect, it } from "vitest";
import { staffNoticeText } from "./notices";

describe("what a page says after a staff action (spec 4, plan decision 23)", () => {
  it("words a known code, and says nothing for an unknown one", () => {
    expect(staffNoticeText("approved")).toBe("Approved. The shop is live, and its owner has been told.");
    expect(staffNoticeText("nothing")).toBe("Nothing changed. It was already done.");
    expect(staffNoticeText("rsvp")).toBe("You're going. See you there.");
    expect(staffNoticeText("toString")).toBeNull();
    expect(staffNoticeText(null)).toBeNull();
  });
});
