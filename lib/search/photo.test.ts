import { describe, expect, it } from "vitest";
import { browseHref } from "@/lib/browse/href";
import {
  checkPhotoSearch,
  isPhotoSearchNotice,
  noticeFor,
  PHOTO_SEARCH_NOTICES,
  photoSearchInstruction,
  photoSearchQuery,
  photoSearchSchema,
} from "./photo";

const slugs = ["tech", "textbooks-notes"];
const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    words: ["casio", "calculator"],
    categorySlug: "tech",
    moduleCode: null,
    personIsSubject: false,
    confidence: "high",
    ...over,
  });

describe("checkPhotoSearch (AI features spec 5.2)", () => {
  it("takes a good reply", () => {
    expect(checkPhotoSearch(reply(), slugs)).toEqual({
      words: ["casio", "calculator"],
      categorySlug: "tech",
      moduleCode: null,
      confidence: "high",
    });
  });

  it("a person as the subject, or low confidence, can't tell", () => {
    expect(checkPhotoSearch(reply({ personIsSubject: true }), slugs)).toBe("person");
    expect(checkPhotoSearch(reply({ confidence: "low" }), slugs)).toBe("low-confidence");
  });

  it("refuses anything off the schema", () => {
    const bad = [
      "not json",
      "[]",
      "null",
      reply({ extra: 1 }),
      reply({ words: "casio" }),
      reply({ categorySlug: "cars" }),
      reply({ confidence: "sure" }),
      reply({ words: [1] }),
      reply({ moduleCode: 1501 }),
      reply({ personIsSubject: "no" }),
    ];
    for (const text of bad) expect(checkPhotoSearch(text, slugs)).toBe("bad-output");
  });

  it("cleans the words: lower case, letters and digits, no repeats, at most 6, each at most 30 characters", () => {
    const words = ["Casio", "casio", " fx-991 ", "", "a".repeat(40), "b", "c", "d", "e", "f"];
    expect(checkPhotoSearch(reply({ words }), slugs)).toMatchObject({ words: ["casio", "fx-991", "b", "c", "d", "e"] });
  });

  it("splits an entry with spaces into its words, as Browse would", () => {
    expect(checkPhotoSearch(reply({ words: ["Casio fx-991", "calculator!"] }), slugs)).toMatchObject({
      words: ["casio", "fx-991", "calculator"],
    });
  });

  it("keeps a module code only in its shape", () => {
    expect(checkPhotoSearch(reply({ moduleCode: "fac 1501" }), slugs)).toMatchObject({ moduleCode: "FAC1501" });
    expect(checkPhotoSearch(reply({ moduleCode: "hello" }), slugs)).toMatchObject({ moduleCode: null });
  });

  it("no words and no module code can't tell", () => {
    expect(checkPhotoSearch(reply({ words: [] }), slugs)).toBe("low-confidence");
    expect(checkPhotoSearch(reply({ words: ["!!!"] }), slugs)).toBe("low-confidence");
  });
});

describe("photoSearchQuery (planning decision 2)", () => {
  const base = { words: ["casio", "calculator"], categorySlug: "tech", moduleCode: null, confidence: "high" as const };

  it("words, and the category at high confidence; never a campus", () => {
    expect(photoSearchQuery(base)).toMatchObject({
      q: "casio calculator",
      category: "tech",
      campus: "all",
      campusFromLink: false,
      sort: "match",
    });
  });

  it("no category at medium confidence", () => {
    expect(photoSearchQuery({ ...base, confidence: "medium" }).category).toBeNull();
  });

  it("the module code only when there are no words", () => {
    expect(photoSearchQuery({ ...base, words: [], moduleCode: "FAC1501" }).q).toBe("FAC1501");
    expect(photoSearchQuery({ ...base, moduleCode: "FAC1501" }).q).toBe("casio calculator");
  });

  it("becomes a Browse link holding only the search words (spec 5.3)", () => {
    expect(browseHref(photoSearchQuery(base))).toBe("/browse?q=casio+calculator&cat=tech");
    expect(browseHref(photoSearchQuery({ ...base, confidence: "medium" }))).toBe("/browse?q=casio+calculator");
  });
});

describe("the instruction and schema", () => {
  it("the schema asks for exactly the five fields, with the categories", () => {
    const schema = photoSearchSchema(slugs);
    expect(schema.required).toEqual(["words", "categorySlug", "moduleCode", "personIsSubject", "confidence"]);
    expect(schema.properties.categorySlug.enum).toEqual(slugs);
    expect(schema.additionalProperties).toBe(false);
  });

  it("uses no array or string limits structured outputs refuses (stage D review)", () => {
    expect(JSON.stringify(photoSearchSchema(slugs))).not.toMatch(/maxItems|minLength|maxLength|pattern/);
  });

  it("the instruction lists the categories, with their hints", () => {
    expect(photoSearchInstruction([{ slug: "other", name: "Other" }])).toContain("- other: Other");
    expect(photoSearchInstruction([{ slug: "tech", name: "Tech" }])).toContain("- tech: Tech, such as laptops");
  });
});

describe("the notices (spec 5.2, 5.4)", () => {
  it("a person or low confidence is 'couldn't tell'; anything else is 'failed'", () => {
    expect(noticeFor("person")).toBe("cant-tell");
    expect(noticeFor("low-confidence")).toBe("cant-tell");
    for (const failure of ["timeout", "rate-limited", "refusal", "bad-output", "model-gone", "api-error"] as const)
      expect(noticeFor(failure)).toBe("failed");
    expect(PHOTO_SEARCH_NOTICES["cant-tell"]).toBe("Couldn't tell what that is. Try a closer photo, or type it.");
  });

  it("knows its own notices only", () => {
    expect(isPhotoSearchNotice("limit")).toBe(true);
    expect(isPhotoSearchNotice("toString")).toBe(false);
    expect(isPhotoSearchNotice(undefined)).toBe(false);
  });
});
