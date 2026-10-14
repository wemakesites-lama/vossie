import { describe, expect, it } from "vitest";
import { sampleConversations, sampleNotifications } from "@/data/fixtures/messages";
import { messageNoteText, saleNoteText } from "./notification-text";

describe("notification sentences (messaging spec 3.5, plan decisions 13 and 26)", () => {
  it("says who wrote, and about what", () => {
    const title = "Casio fx-991ZA Plus calculator";
    expect(messageNoteText({ sender: "Ayanda", listingTitle: title, first: true })).toBe(
      "Ayanda asked about Casio fx-991ZA Plus calculator",
    );
    expect(messageNoteText({ sender: "Tech corner", listingTitle: title, first: false })).toBe(
      "Tech corner replied about Casio fx-991ZA Plus calculator",
    );
    expect(messageNoteText({ sender: "Ayanda", listingTitle: null, first: true })).toBe("Ayanda asked your shop a question");
    expect(messageNoteText({ sender: "Tech corner", listingTitle: null, first: false })).toBe("Tech corner replied");
  });

  it("asks the buyer about a sale marked done", () => {
    expect(saleNoteText({ shop: "Tech corner", listingTitle: "Casio fx-991ZA Plus calculator" })).toBe(
      "Tech corner marked Casio fx-991ZA Plus calculator as done. Did the sale happen?",
    );
    expect(saleNoteText({ shop: "Tech corner", listingTitle: null })).toBe(
      "Tech corner marked your enquiry as done. Did the sale happen?",
    );
  });

  it("wrote the sample notifications' sentences (messaging plan, Task 1)", () => {
    const titles = new Map(sampleConversations.map((row) => [row.id, row.listingTitle]));
    const expected: Record<string, string> = {
      "note-s1": messageNoteText({ sender: "Tech corner", listingTitle: titles.get("conv-s1")!, first: false }),
      "note-s2": saleNoteText({ shop: "Tech corner", listingTitle: titles.get("conv-s2")! }),
      "note-s3": messageNoteText({ sender: "Thandi", listingTitle: titles.get("conv-s1")!, first: true }),
      "note-s4": messageNoteText({ sender: "Thandi", listingTitle: titles.get("conv-s2")!, first: false }),
    };
    for (const note of sampleNotifications) expect(note.text, note.id).toBe(expected[note.id]);
  });
});
