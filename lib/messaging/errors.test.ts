import { describe, expect, it } from "vitest";
import { composerFields, messagingErrors, replyFields, reportFields, reportReasonId } from "./errors";

describe("messaging's error words (messaging spec 3.1 and 3.4, plan decision 26)", () => {
  it("words each error and links it to its field, whose id ends with its listing (plan amendment 5)", () => {
    const fields = composerFields({ kind: "listing", listingId: "l-007" });
    expect(messagingErrors(["message-missing", "swap-length"], fields)).toEqual([
      { message: "Write a message first.", fieldId: "composer-message-l-007" },
      { message: "Keep your swap offer under 200 characters.", fieldId: "composer-swap-l-007" },
    ]);
    expect(messagingErrors(["message-length"], fields)[0].message).toBe("Keep it under 1,000 characters.");
    expect(messagingErrors(["message-missing"], replyFields("conv-s1"))).toEqual([
      { message: "Write a message first.", fieldId: "thread-reply-conv-s1" },
    ]);
    expect(messagingErrors(["reason-missing", "detail-length"], reportFields({ kind: "listing", id: "l-001" }))).toEqual([
      { message: "Choose a reason.", fieldId: "report-reason-listing-l-001-scam" },
      { message: "Keep it under 500 characters.", fieldId: "report-detail-listing-l-001" },
    ]);
  });

  it("names the item in each id: a listing, a shop's question, a conversation (plan amendment 5)", () => {
    expect(composerFields({ kind: "listing", listingId: "l-001" })).toEqual({
      body: "composer-message-l-001",
      swapOffer: "composer-swap-l-001",
    });
    expect(composerFields({ kind: "shop", sellerSlug: "tech-corner" })).toEqual({
      body: "composer-message-tech-corner",
      swapOffer: "composer-swap-tech-corner",
    });
    expect(replyFields("conv-s1")).toEqual({ body: "thread-reply-conv-s1" });
  });

  it("starts a report's ids with what's reported, so a shop's slug never meets a listing's id (plan amendment 5)", () => {
    // The reason's error links to the first radio button, so its id is that radio's.
    expect(reportFields({ kind: "seller", id: "tech-corner" })).toEqual({
      reason: "report-reason-seller-tech-corner-scam",
      reasonError: "report-reason-seller-tech-corner-error",
      detail: "report-detail-seller-tech-corner",
    });
    expect(reportFields({ kind: "request", id: "r-001" }).detail).toBe("report-detail-request-r-001");
    expect(reportReasonId({ kind: "listing", id: "l-001" }, "spam")).toBe("report-reason-listing-l-001-spam");
    // A seller whose slug is a listing's id still gets ids of its own.
    expect(reportFields({ kind: "seller", id: "l-001" })).not.toEqual(reportFields({ kind: "listing", id: "l-001" }));
  });

  it("leaves the report limit unlinked, and drops codes it doesn't know", () => {
    expect(
      messagingErrors(["report-rate", "nonsense", "toString"], reportFields({ kind: "listing", id: "l-001" })),
    ).toEqual([
      { message: "You've sent 10 reports in the last 24 hours. Try again later.", fieldId: null },
    ]);
  });
});
