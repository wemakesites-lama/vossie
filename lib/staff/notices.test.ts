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

describe("staff accounts and Show again (stage J spec decisions 7 and 14)", () => {
  it("words a role given or removed, and a listing or request shown again", () => {
    expect(staffNoticeText("role-given")).toBe("Role given. They've been told, and their tools are on their account page.");
    expect(staffNoticeText("role-removed")).toBe("Role removed. They've been told.");
    expect(staffNoticeText("listing-shown")).toBe("Showing again. Its seller has been told.");
    expect(staffNoticeText("request-shown")).toBe("Showing again. The asker has been told.");
  });
});
