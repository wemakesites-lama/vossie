import { describe, expect, it } from "vitest";
import {
  FOLLOW_LIMIT,
  followersLine,
  followNoteKey,
  followNoticeText,
  newListingsText,
  newListingText,
  parseSavedTab,
  SAVED_SHOPS_FORM,
  savedTabPath,
} from "./rules";

describe("following shops (community actions spec 2.15 to 2.19)", () => {
  it("has a cap of 200", () => {
    expect(FOLLOW_LIMIT).toBe(200);
  });

  it("reads Saved's tab from the link: Shops only for ?tab=shops (plan decision 17)", () => {
    expect(parseSavedTab("shops")).toBe("shops");
    expect(parseSavedTab(["shops", "listings"])).toBe("shops");
    expect(parseSavedTab(undefined)).toBe("listings");
    expect(parseSavedTab("anything")).toBe("listings");
    expect(savedTabPath("listings")).toBe("/saved");
    expect(savedTabPath("shops")).toBe("/saved?tab=shops");
  });

  it("keeps the band's and Saved's status lines apart (plan decision 7)", () => {
    expect(followNoteKey("tech-corner")).toBe("follow:tech-corner");
    expect(SAVED_SHOPS_FORM).toBe("saved-shops");
    expect(followNoticeText("followed", "Tech corner")).toBe("You follow Tech corner.");
    expect(followNoticeText("unfollowed", "Tech corner")).toBe("You've unfollowed Tech corner.");
    expect(followNoticeText("follow-limit", "Tech corner")).toBe("You follow 200 shops. Unfollow one first.");
    expect(followNoticeText("toString", "Tech corner")).toBeNull();
  });

  it("writes the new-listing notification, one and then several (spec 2.19)", () => {
    expect(newListingText("Tech corner", "Casio fx-991ZA Plus calculator")).toBe(
      "Tech corner listed Casio fx-991ZA Plus calculator",
    );
    expect(newListingsText("Tech corner", 2)).toBe("Tech corner listed 2 new things");
  });

  it("tells a shop how many follow it, never who (spec 2.18)", () => {
    expect(followersLine(0)).toBe("No one follows your shop yet");
    expect(followersLine(1)).toBe("1 person follows your shop");
    expect(followersLine(12)).toBe("12 people follow your shop");
  });
});

describe("Saved's Searches tab (search alerts spec 2.7, plan decision 10)", () => {
  it("has an address of its own", () => {
    expect(savedTabPath("searches")).toBe("/saved?tab=searches");
  });

  it("opens for ?tab=searches", () => {
    expect(parseSavedTab("searches")).toBe("searches");
    expect(parseSavedTab(["searches", "shops"])).toBe("searches");
  });
});
