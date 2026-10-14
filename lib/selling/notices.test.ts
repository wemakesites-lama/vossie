import { describe, expect, it } from "vitest";
import { noticeText } from "./notices";

describe("notices after an action (plan decision 27)", () => {
  it("words each code", () => {
    expect(noticeText("published")).toBe("Published. Buyers can find it now.");
    expect(noticeText("shop-paused")).toBe("Your shop is paused. Buyers can't see your listings until you resume it.");
  });

  it("shows nothing for anything else, so form state can never put its own words on the page", () => {
    for (const code of [null, undefined, "", "toString", "<b>hi</b>"]) expect(noticeText(code)).toBeNull();
  });
});
