import { describe, expect, it } from "vitest";
import {
  autoConfirmAt,
  characterCount,
  checkMessage,
  checkReportDetail,
  checkSwapOffer,
  cleanText,
  firstLine,
  keepTyped,
  parseReason,
  REPORT_REASONS,
  statusLabel,
} from "./rules";

describe("clean text (messaging spec 2.12, plan decision 29)", () => {
  it("keeps line breaks and tabs, makes every line break \\n, drops other control characters and trims", () => {
    expect(cleanText("  Hi!\r\nStill there?\rYes\u0000\u0007 \tok \n\n")).toBe("Hi!\nStill there?\nYes \tok");
  });

  it("leaves markup as the characters it is, for the page to show as text", () => {
    expect(cleanText("<b>hi</b> javascript:alert(1)")).toBe("<b>hi</b> javascript:alert(1)");
  });

  it("counts each letter or emoji once, where a string's length counts an emoji twice", () => {
    expect(characterCount("Hi 👍")).toBe(4);
    expect("Hi 👍".length).toBe(5);
  });
});

describe("messages, swap offers and report detail (FUNCTION-MAP section 6)", () => {
  it("asks for a message, and takes up to 1,000 characters", () => {
    expect(checkMessage(" \n ")).toEqual({ value: "", error: "message-missing" });
    expect(checkMessage("a".repeat(1000)).error).toBeNull();
    expect(checkMessage("a".repeat(1001))).toEqual({ value: "a".repeat(1001), error: "message-length" });
    expect(checkMessage(` ${"😀".repeat(1000)} `).error).toBeNull();
  });

  it("takes an optional swap offer of up to 200 characters", () => {
    expect(checkSwapOffer("   ")).toEqual({ value: "", error: null });
    expect(checkSwapOffer("b".repeat(200)).error).toBeNull();
    expect(checkSwapOffer("b".repeat(201)).error).toBe("swap-length");
  });

  it("takes an optional report detail of up to 500 characters", () => {
    expect(checkReportDetail("").error).toBeNull();
    expect(checkReportDetail("c".repeat(500)).error).toBeNull();
    expect(checkReportDetail("c".repeat(501)).error).toBe("detail-length");
  });

  it("keeps at most 4,000 typed characters for a form to show again (plan decision 8)", () => {
    expect(characterCount(keepTyped("d".repeat(5000)))).toBe(4000);
    expect(keepTyped("short")).toBe("short");
  });
});

describe("previews and statuses (messaging spec 2.5 and 3.2)", () => {
  it("previews a message by its first line, cut at 80 characters", () => {
    expect(firstLine("Is it still available?\nI can collect today.")).toBe("Is it still available?");
    expect(firstLine(`${"x".repeat(100)}\nmore`)).toBe(`${"x".repeat(79)}…`);
  });

  it("names each status in words", () => {
    expect((["asked", "replied", "done", "confirmed"] as const).map((status) => statusLabel(status))).toEqual([
      "Asked",
      "Replied",
      "Done",
      "Confirmed",
    ]);
  });

  it("confirms a sale itself 7 days after it was marked done", () => {
    expect(autoConfirmAt("2026-10-13T15:00:00.000Z")).toBe("2026-10-20T15:00:00.000Z");
  });
});

describe("report reasons (messaging spec 2.8)", () => {
  it("has the seven reasons, in order, and reads back only those", () => {
    expect(REPORT_REASONS.map((reason) => reason.label)).toEqual([
      "Scam or fraud",
      "Prohibited item",
      "Misleading listing",
      "Offensive content",
      "Harassment",
      "Spam",
      "Something else",
    ]);
    expect(parseReason("scam")).toBe("scam");
    for (const raw of ["", "Scam", "toString", "fake-profile"]) expect(parseReason(raw), raw).toBeNull();
  });
});
