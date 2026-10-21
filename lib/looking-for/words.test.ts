import { describe, expect, it } from "vitest";
import {
  AUTO_CLOSE_WHY,
  CLOSES_BY_ITSELF_HINT,
  offerAbout,
  offerNoteText,
  REOPEN_CLEARS_DATE_HINT,
  requestAutoClosedText,
  requestCloseReminderText,
  requestHiddenText,
  requestNoticeText,
  requestStateLabel,
  UNNAMED_ASKER,
} from "./words";

describe("Looking For's words (community actions spec 2.10, 2.13, 2.14 and section 4)", () => {
  it("says what each action did, once (plan decision 7), and nothing for a code it doesn't know", () => {
    expect(requestNoticeText("posted")).toBe("Your request is up.");
    expect(requestNoticeText("saved")).toBe("Your changes are saved.");
    expect(requestNoticeText("closed")).toBe("Request closed.");
    expect(requestNoticeText("reopened")).toBe("Request reopened.");
    expect(requestNoticeText("deleted")).toBe("Request deleted.");
    expect(requestNoticeText("reopen-limit")).toBe("You have 5 open requests. Close one before you reopen this one.");
    expect(requestNoticeText("toString")).toBeNull();
    expect(requestNoticeText(null)).toBeNull();
  });

  it("writes the notifications' sentences (plan decision 14)", () => {
    expect(offerNoteText("Tech corner", "Accounting 1 tutor this week")).toBe(
      "Tech corner offered to help with Accounting 1 tutor this week",
    );
    expect(requestHiddenText("Kettle for res")).toBe("The Hub hid your request Kettle for res. See why in Your requests.");
  });

  it("names an offer thread by its request, and the asker not at all (plan decisions 8 and 9)", () => {
    expect(offerAbout("buyer", "Kettle for res")).toBe("Your request: Kettle for res");
    expect(offerAbout("seller", "Kettle for res")).toBe("Request: Kettle for res");
    expect(UNNAMED_ASKER).toBe("The student who asked");
  });

  it("says where a request stands", () => {
    expect(["open", "closed", "hidden"].map((state) => requestStateLabel(state as "open"))).toEqual([
      "Open",
      "Closed",
      "Hidden by the Hub",
    ]);
  });
});

describe("requests that close themselves (stage L spec section 4, Words)", () => {
  it("tells the asker once, in the app, why it closed and that they can reopen it", () => {
    expect(requestAutoClosedText("Kettle for res", "needed-by")).toBe(
      "Your request Kettle for res closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it.",
    );
    expect(requestAutoClosedText("Kettle for res", "idle")).toBe(
      "Your request Kettle for res closed automatically after 30 days with no changes. Reopen it in Your requests if you still need it.",
    );
  });

  it("gives the asker's lines their reasons, the reopen hint and notice, and the form's hint", () => {
    expect(AUTO_CLOSE_WHY).toEqual({
      "needed-by": "3 days after the date you needed it by",
      idle: "after 30 days with no changes",
    });
    expect(REOPEN_CLEARS_DATE_HINT).toBe("Reopening removes the needed-by date, which has passed.");
    expect(requestNoticeText("reopened-date-cleared")).toBe(
      "Request reopened. Its needed-by date had passed, so it's been removed. Add a new one with Edit.",
    );
    expect(CLOSES_BY_ITSELF_HINT).toBe(
      "Your request closes automatically 3 days after this date. Without one, it closes after 30 days with no changes.",
    );
  });
});

describe("the reminder before a request closes itself (stage M spec section 5, Words)", () => {
  it("names the closing day and why, and what keeps the request up", () => {
    expect(requestCloseReminderText("Kettle for res", "2026-10-20", "needed-by")).toBe(
      "Your request Kettle for res closes automatically on 20 Oct, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests.",
    );
    expect(requestCloseReminderText("Kettle for res", "2026-11-12", "idle")).toBe(
      "Your request Kettle for res closes automatically on 12 Nov, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more.",
    );
  });
});

// The settle's words in SQL (supabase step 2b plan, Task 3): private.request_auto_closed_note_text and
// private.request_close_reminder_note_text (supabase/tests/26_requests_settle.test.sql) pin these same strings.
describe("the words the database's settle writes (step 2b plan, Task 3)", () => {
  it("matches the auto-close notification, by reason", () => {
    expect(requestAutoClosedText("Calculator", "needed-by")).toBe(
      "Your request Calculator closed automatically 3 days after the date you needed it by. Reopen it in Your requests if you still need it.",
    );
    expect(requestAutoClosedText("Calculator", "idle")).toBe(
      "Your request Calculator closed automatically after 30 days with no changes. Reopen it in Your requests if you still need it.",
    );
  });

  it("matches the reminder, by reason, with a one-digit day unpadded", () => {
    expect(requestCloseReminderText("Calculator", "2026-10-20", "needed-by")).toBe(
      "Your request Calculator closes automatically on 20 Oct, 3 days after the date you needed it by. Still need it? Give it a new date in Your requests.",
    );
    expect(requestCloseReminderText("Calculator", "2026-11-05", "idle")).toBe(
      "Your request Calculator closes automatically on 5 Nov, after 30 days with no changes. Still need it? Edit it in Your requests and it stays up for 30 days more.",
    );
  });
});
