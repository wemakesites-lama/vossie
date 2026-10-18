import { describe, expect, it } from "vitest";
import { postFieldIds, staffErrors, staffFieldIds } from "./errors";

describe("the staff forms' error words (plan decision 22)", () => {
  it("words each code and links it to its field on this form", () => {
    expect(staffErrors(["reason-missing"], staffFieldIds("decline-crochet-corner"))).toEqual([
      { message: "Give a reason. The seller sees it.", fieldId: "decline-crochet-corner-reason" },
    ]);
    expect(staffErrors(["post-title-length"], postFieldIds("new-post"))).toEqual([
      { message: "Keep the title to 70 characters.", fieldId: "new-post-title" },
    ]);
  });

  it("keeps the codes' order, and leaves out codes it doesn't know", () => {
    const errors = staffErrors(["help-missing", "toString", "time-length"], staffFieldIds("book-h-002"));
    expect(errors.map((error) => error.fieldId)).toEqual(["book-h-002-help", "book-h-002-time"]);
  });

  it("gives a radio group's error to its first radio", () => {
    expect(postFieldIds("edit-h-001").kind).toBe("edit-h-001-kind-tip");
  });

  it("words a date and time that have passed, at the date field (amendment 12.5)", () => {
    expect(staffErrors(["post-date-past"], postFieldIds("new-post"))).toEqual([
      { message: "Choose a date and time that hasn't passed.", fieldId: "new-post-date" },
    ]);
  });
});
