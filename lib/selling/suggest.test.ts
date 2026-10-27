// lib/selling/suggest.test.ts
import { describe, expect, it } from "vitest";
import { checkSuggestion, mergeSuggestion, suggestionSchema, type Suggestion } from "./suggest";

const SLUGS = ["textbooks-notes", "tech"];
const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Financial Accounting, 3rd edition",
    categorySlug: "textbooks-notes",
    condition: "good",
    description: "A clean copy with a few highlighted pages.",
    alt: "The cover of Financial Accounting, 3rd edition",
    isTextbook: true,
    moduleCode: "fac 1501",
    personIsSubject: false,
    confidence: "high",
    ...overrides,
  });

describe("checkSuggestion (spec decision 10)", () => {
  it("accepts a good reply, trimming text and tidying the module code", () => {
    expect(checkSuggestion(reply({ title: "  Financial   Accounting, 3rd edition " }), SLUGS)).toEqual({
      title: "Financial Accounting, 3rd edition",
      categorySlug: "textbooks-notes",
      condition: "good",
      description: "A clean copy with a few highlighted pages.",
      alt: "The cover of Financial Accounting, 3rd edition",
      moduleCode: "FAC1501",
    });
  });

  it("refuses bad JSON, a missing or extra field, and a wrong type", () => {
    expect(checkSuggestion("not json", SLUGS)).toBe("bad-output");
    expect(checkSuggestion(JSON.stringify({ title: "x" }), SLUGS)).toBe("bad-output");
    expect(checkSuggestion(reply({ price: 200 }), SLUGS)).toBe("bad-output");
    expect(checkSuggestion(reply({ isTextbook: "yes" }), SLUGS)).toBe("bad-output");
  });

  it("refuses a category or condition the form doesn't offer, and an empty title", () => {
    expect(checkSuggestion(reply({ categorySlug: "cars" }), SLUGS)).toBe("bad-output");
    expect(checkSuggestion(reply({ condition: "broken" }), SLUGS)).toBe("bad-output");
    expect(checkSuggestion(reply({ title: "   " }), SLUGS)).toBe("bad-output");
  });

  it("says why when a person is the subject or the read is unsure", () => {
    expect(checkSuggestion(reply({ personIsSubject: true }), SLUGS)).toBe("person");
    expect(checkSuggestion(reply({ confidence: "low" }), SLUGS)).toBe("low-confidence");
  });

  it("cuts text to the form's limits, and drops a module code that isn't one", () => {
    const long = checkSuggestion(reply({ title: "a".repeat(90), description: "b".repeat(1200), alt: "c".repeat(200) }), SLUGS);
    expect(long).toMatchObject({ title: "a".repeat(70), description: "b".repeat(1000), alt: "c".repeat(125) });
    expect(checkSuggestion(reply({ moduleCode: "chapter one" }), SLUGS)).toMatchObject({ moduleCode: null });
    expect(checkSuggestion(reply({ isTextbook: false }), SLUGS)).toMatchObject({ moduleCode: null });
  });

  it("builds a schema whose categories are the form's", () => {
    const schema = suggestionSchema(SLUGS);
    expect(schema.properties.categorySlug.enum).toEqual(SLUGS);
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
  });
});

describe("mergeSuggestion (spec decisions 5 and 6)", () => {
  const suggestion: Suggestion = {
    title: "Financial Accounting, 3rd edition",
    categorySlug: "textbooks-notes",
    condition: "good",
    description: "A clean copy.",
    alt: "The cover",
    moduleCode: "FAC1501",
  };

  it("fills only empty fields, and lists what it filled", () => {
    const merged = mergeSuggestion({ kind: "item", title: "My own title", category: "", description: " " }, suggestion, "/photos/p1");
    expect(merged.values).toMatchObject({
      title: "My own title",
      category: "textbooks-notes",
      condition: "good",
      description: "Module FAC1501. A clean copy.",
      "alt:/photos/p1": "The cover",
    });
    expect(merged.suggested).toEqual(["category", "condition", "description", "alt:/photos/p1"]);
  });

  it("leaves a service's condition alone and fills no photo description without a cover", () => {
    const merged = mergeSuggestion({ kind: "service" }, { ...suggestion, moduleCode: null }, null);
    expect(merged.values.condition).toBeUndefined();
    expect(merged.values.description).toBe("A clean copy.");
    expect(merged.suggested).toEqual(["title", "category", "description"]);
  });
});
