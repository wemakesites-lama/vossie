import { describe, expect, it } from "vitest";
import {
  checkInstruction,
  checkNeeded,
  checkReportDetail,
  checkSchema,
  CONCERNS,
  CONCERN_WORDS,
  parseConcern,
  parseVerdict,
  stopsPublish,
} from "./listing-check";

const LIVE = { state: "available", title: "Desk fan", description: "Quiet.", photos: [{ src: "/a.jpg" }] };

describe("the listing check's rules (AI features spec 3)", () => {
  it("has the seven kinds of 'What can't be sold', each in words", () => {
    expect(CONCERNS).toEqual([
      "weapons",
      "alcohol-or-tobacco",
      "medicines",
      "counterfeit",
      "academic-dishonesty",
      "stolen",
      "illegal",
    ]);
    for (const concern of CONCERNS) expect(CONCERN_WORDS[concern]).toMatch(/\S/);
  });

  it("tells the model tutoring and study notes are welcome, and writing an assignment isn't", () => {
    const instruction = checkInstruction();
    expect(instruction).toContain("FAC1501 tutoring");
    expect(instruction).toContain("I'll write your FAC1501 assignment");
    expect(instruction).toContain("Prices are never a reason");
  });

  it("asks for one concern from the list or none, and a confidence", () => {
    expect(checkSchema()).toMatchObject({
      properties: { concern: { enum: [...CONCERNS, "none"] }, confidence: { enum: ["high", "medium", "low"] } },
      required: ["concern", "confidence"],
      additionalProperties: false,
    });
  });

  it("reads a reply, and refuses one that isn't JSON or has values off the lists", () => {
    expect(parseVerdict('{"concern":"counterfeit","confidence":"high"}')).toEqual({
      concern: "counterfeit",
      confidence: "high",
    });
    expect(parseVerdict("not json")).toBeNull();
    expect(parseVerdict('{"concern":"drugs","confidence":"high"}')).toBeNull();
    expect(parseVerdict('{"concern":"none","confidence":"sure"}')).toBeNull();
    expect(parseVerdict("null")).toBeNull();
  });

  it("stops a publish only for a concern held with high confidence", () => {
    expect(stopsPublish({ concern: "weapons", confidence: "high" })).toBe("weapons");
    expect(stopsPublish({ concern: "weapons", confidence: "medium" })).toBeNull();
    expect(stopsPublish({ concern: "none", confidence: "high" })).toBeNull();
  });

  it("takes a posted concern only when it's one of the seven", () => {
    expect(parseConcern("stolen")).toBe("stolen");
    expect(parseConcern("none")).toBeNull();
    expect(parseConcern("")).toBeNull();
    expect(parseConcern("yes")).toBeNull();
  });

  it("checks a new listing or a draft, and a live one only when its title, description or photos changed", () => {
    const same = { title: "Desk fan", description: "Quiet." };
    expect(checkNeeded(null, same, ["/a.jpg"])).toBe(true);
    expect(checkNeeded({ ...LIVE, state: "draft" }, same, ["/a.jpg"])).toBe(true);
    expect(checkNeeded(LIVE, same, ["/a.jpg"])).toBe(false);
    expect(checkNeeded({ ...LIVE, state: "paused" }, same, ["/a.jpg"])).toBe(false);
    expect(checkNeeded(LIVE, { ...same, title: "Desk fan, white" }, ["/a.jpg"])).toBe(true);
    expect(checkNeeded(LIVE, { ...same, description: "Loud." }, ["/a.jpg"])).toBe(true);
    expect(checkNeeded(LIVE, same, ["/b.jpg", "/a.jpg"])).toBe(true);
  });

  it("writes the report's detail for the Hub in words", () => {
    expect(checkReportDetail("counterfeit")).toBe(
      "The listing check thought this may be counterfeit goods. The seller published it anyway.",
    );
  });
});
