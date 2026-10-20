import { describe, expect, it } from "vitest";
import {
  ALREADY_SAVED_LINE,
  alertsNoticeText,
  AT_LIMIT_LINE,
  MANAGE_SEARCHES,
  SAVE_SEARCH_BUTTON,
  SAVE_SEARCH_PROMPT,
  saveNoteText,
  savedSearchesCount,
  SEARCHES_NOTE,
  searchMatchesText,
  searchMatchText,
} from "./words";

describe("saved searches' words (search alerts spec 2.6 to 2.8 and 2.12)", () => {
  it("has the browse row's lines (spec 2.6)", () => {
    expect(SAVE_SEARCH_PROMPT).toBe("Hear when something new matches.");
    expect(SAVE_SEARCH_BUTTON).toBe("Save this search");
    expect(MANAGE_SEARCHES).toBe("Manage saved searches");
    expect(ALREADY_SAVED_LINE).toBe("You've saved this search.");
    expect(AT_LIMIT_LINE).toBe("You're at the 20-search limit.");
    expect(saveNoteText("saved")).toBe("Search saved.");
    expect(saveNoteText("already")).toBe("You've saved this search already.");
    expect(saveNoteText("limit")).toBe("You're at the 20-search limit.");
  });

  it("has the Searches tab's words (spec 2.7 and section 4)", () => {
    expect(SEARCHES_NOTE).toBe("Kept with your account. Each search sends at most one notification a day.");
    expect(savedSearchesCount(1)).toBe("1 saved search");
    expect(savedSearchesCount(3)).toBe("3 saved searches");
    expect(alertsNoticeText("paused", "“lamp” at Midrand")).toBe("Alerts paused for “lamp” at Midrand.");
    expect(alertsNoticeText("resumed", "“lamp” at Midrand")).toBe("Alerts on for “lamp” at Midrand.");
  });

  it("writes the notification, one match and then several (spec 2.12)", () => {
    expect(searchMatchText("Casio fx-991ZA Plus calculator", "“calculator” at Midrand")).toBe(
      "Casio fx-991ZA Plus calculator matches your search “calculator” at Midrand",
    );
    expect(searchMatchesText(3, "“calculator” at Midrand")).toBe(
      "3 new listings match your search “calculator” at Midrand",
    );
  });
});
