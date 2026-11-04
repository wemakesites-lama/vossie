import { describe, expect, it } from "vitest";
import { asFirstRead, firstReadLines, parseFirstRead, readSchema, SUMMARY_MAX, type FirstRead } from "./report-read";

describe("the report read (AI features spec section 4)", () => {
  const good: FirstRead = { summary: "A watch sold as a Rolex for R300.", concern: "counterfeit", agrees: true };

  it("accepts a well-formed reply and collapses the summary to one line", () => {
    expect(parseFirstRead(JSON.stringify(good))).toEqual(good);
    expect(parseFirstRead(JSON.stringify({ ...good, summary: "  Two\n lines  " }))?.summary).toBe("Two lines");
  });

  it("refuses a bad reply", () => {
    for (const bad of [
      "not json",
      "null",
      JSON.stringify({ ...good, summary: "" }),
      JSON.stringify({ ...good, summary: "x".repeat(SUMMARY_MAX + 1) }),
      JSON.stringify({ ...good, concern: "rude" }),
      JSON.stringify({ ...good, agrees: "yes" }),
    ]) {
      expect(parseFirstRead(bad)).toBeNull();
    }
  });

  it("reads a stored value back, or null", () => {
    expect(asFirstRead(good)).toEqual(good);
    expect(asFirstRead(null)).toBeNull();
    expect(asFirstRead({ summary: "x" })).toBeNull();
  });

  it("asks for exactly the three fields", () => {
    expect(readSchema()).toMatchObject({ required: ["summary", "concern", "agrees"], additionalProperties: false });
  });

  it("says what staff read", () => {
    expect(firstReadLines(good, "prohibited")).toEqual({
      summary: "A watch sold as a Rolex for R300.",
      guideline: "May break: counterfeit goods",
      agreement: "Agrees with the reporter's reason (Prohibited item)",
    });
    expect(firstReadLines({ ...good, concern: "none", agrees: false }, "scam")).toMatchObject({
      guideline: "No guideline clearly broken",
      agreement: "Doesn't match the reporter's reason (Scam or fraud)",
    });
  });
});
