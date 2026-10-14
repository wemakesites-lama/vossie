import { describe, expect, it } from "vitest";
import { COMPOSER_FIELDS, messagingErrors, REPORT_FIELDS } from "./errors";

describe("messaging's error words (messaging spec 3.1 and 3.4, plan decision 26)", () => {
  it("words each error and links it to its field", () => {
    expect(messagingErrors(["message-missing", "swap-length"], COMPOSER_FIELDS)).toEqual([
      { message: "Write a message first.", fieldId: "composer-body" },
      { message: "Keep your swap offer under 200 characters.", fieldId: "composer-swap" },
    ]);
    expect(messagingErrors(["message-length"], COMPOSER_FIELDS)[0].message).toBe("Keep it under 1,000 characters.");
    expect(messagingErrors(["reason-missing", "detail-length"], REPORT_FIELDS)).toEqual([
      { message: "Choose a reason.", fieldId: "report-reason-scam" },
      { message: "Keep it under 500 characters.", fieldId: "report-detail" },
    ]);
  });

  it("leaves the report limit unlinked, and drops codes it doesn't know", () => {
    expect(messagingErrors(["report-rate", "nonsense", "toString"], REPORT_FIELDS)).toEqual([
      { message: "You've sent 10 reports today. Try again tomorrow.", fieldId: null },
    ]);
  });
});
