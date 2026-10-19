import { describe, expect, it } from "vitest";
import { sellingErrors } from "@/lib/selling/errors";
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

  it("words a missing reason for a request as one its asker reads (community actions plan decision 20)", () => {
    expect(staffErrors(["reason-missing-asker"], staffFieldIds("hide-rep-1"))).toEqual([
      { message: "Give a reason. The asker sees it.", fieldId: "hide-rep-1-reason" },
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

  it("words a form that has run out of its one-time token, linked to no field (amendment 15.7)", () => {
    const words = {
      message: "This form is out of date, so nothing was saved. What you typed is kept: check it and send it again.",
      fieldId: null,
    };
    expect(staffErrors(["once-expired"], staffFieldIds("note-tech-corner"))).toEqual([words]);
    expect(staffErrors(["once-expired"], postFieldIds("new-post"))).toEqual([words]);
  });

  it("says it once on the post editor's page, which reads selling's words for the cover as well", () => {
    const ids = postFieldIds("new-post");
    const codes = ["once-expired", "photo-type"];
    const all = [...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })];
    expect(all.map((error) => error.message)).toEqual([
      expect.stringMatching(/^This form is out of date/),
      "Use a JPG, PNG or WebP photo.",
    ]);
  });
});
