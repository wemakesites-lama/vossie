import { describe, expect, it } from "vitest";
import {
  offerAbout,
  offerNoteText,
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
