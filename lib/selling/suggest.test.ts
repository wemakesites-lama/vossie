// lib/selling/suggest.test.ts
import { describe, expect, it } from "vitest";
import { categories } from "@/data/fixtures/categories";
import {
  CATEGORY_HINTS,
  checkSuggestion,
  keepSuggestedTags,
  mergeSuggestion,
  PHOTO_TIP_MAX,
  photoTipValues,
  shownPhotoTip,
  suggestionInstruction,
  suggestionSchema,
  type Suggestion,
} from "./suggest";

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
    expect(checkSuggestion(reply({ title: "  Financial   Accounting, 3rd edition " }), SLUGS, 1)).toEqual({
      title: "Financial Accounting, 3rd edition",
      categorySlug: "textbooks-notes",
      condition: "good",
      description: "A clean copy with a few highlighted pages.",
      alt: "The cover of Financial Accounting, 3rd edition",
      moduleCode: "FAC1501",
      photoTip: null,
    });
  });

  it("refuses bad JSON, a missing or extra field, and a wrong type", () => {
    expect(checkSuggestion("not json", SLUGS, 1)).toBe("bad-output");
    expect(checkSuggestion(JSON.stringify({ title: "x" }), SLUGS, 1)).toBe("bad-output");
    expect(checkSuggestion(reply({ price: 200 }), SLUGS, 1)).toBe("bad-output");
    expect(checkSuggestion(reply({ isTextbook: "yes" }), SLUGS, 1)).toBe("bad-output");
  });

  it("refuses a category or condition the form doesn't offer, and an empty title", () => {
    expect(checkSuggestion(reply({ categorySlug: "cars" }), SLUGS, 1)).toBe("bad-output");
    expect(checkSuggestion(reply({ condition: "broken" }), SLUGS, 1)).toBe("bad-output");
    expect(checkSuggestion(reply({ title: "   " }), SLUGS, 1)).toBe("bad-output");
  });

  it("says why when a person is the subject or the read is unsure", () => {
    expect(checkSuggestion(reply({ personIsSubject: true }), SLUGS, 1)).toBe("person");
    expect(checkSuggestion(reply({ confidence: "low" }), SLUGS, 1)).toBe("low-confidence");
  });

  it("cuts text to the form's limits, and drops a module code that isn't one", () => {
    const long = checkSuggestion(reply({ title: "a".repeat(90), description: "b".repeat(1200), alt: "c".repeat(200) }), SLUGS, 1);
    expect(long).toMatchObject({ title: "a".repeat(70), description: "b".repeat(1000), alt: "c".repeat(125) });
    const alt = "A yellow and red cracked-dust style book cover featuring the title 'DUST' and the author 'HUGH HOWEY', shown from multiple angles.";
    expect(checkSuggestion(reply({ alt }), SLUGS, 1)).toMatchObject({
      alt: "A yellow and red cracked-dust style book cover featuring the title 'DUST' and the author 'HUGH HOWEY', shown from multiple",
    });
    expect(checkSuggestion(reply({ moduleCode: "chapter one" }), SLUGS, 1)).toMatchObject({ moduleCode: null });
    expect(checkSuggestion(reply({ isTextbook: false }), SLUGS, 1)).toMatchObject({ moduleCode: null });
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
    photoTip: null,
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

describe("the instruction (AI features spec 2.3 and 2.4)", () => {
  it("names every category with what belongs in it", () => {
    for (const { slug } of categories) expect(CATEGORY_HINTS[slug], slug).toBeTruthy();
    const text = suggestionInstruction(categories);
    expect(text).toContain("- tech: Tech, such as laptops");
    expect(text).toContain("- textbooks-notes: Textbooks & notes, such as textbooks");
    expect(text).toContain("the cover photo first");
  });

  it("gives a category it has no line for its name only", () => {
    expect(suggestionInstruction([{ slug: "pets", name: "Pets" }])).toContain("- pets: Pets\n");
  });
});

describe("photo tips in the reply (AI round two spec 7)", () => {
  const tip = (photoTip: unknown) => reply({ photoTip });
  const tipOf = (text: string, seen: number) => {
    const checked = checkSuggestion(text, SLUGS, seen);
    return typeof checked === "string" ? checked : checked.photoTip;
  };

  it("keeps a tip about a photo the provider saw", () => {
    expect(tipOf(tip({ photo: 1, kind: "dark", text: " Take it again near a window. " }), 1)).toEqual({
      photo: 1,
      kind: "dark",
      text: "Take it again near a window.",
    });
    expect(tipOf(tip({ photo: 2, kind: "better-cover", text: "This one shows the whole cover." }), 2)).toEqual({
      photo: 2,
      kind: "better-cover",
      text: "This one shows the whole cover.",
    });
  });

  it("clips long words at a word rather than refusing them (models can't count characters)", () => {
    const long = "Move the books and the mug out of the photo, so buyers can see the calculator and its cover clearly and quickly.";
    expect(tipOf(tip({ photo: 3, kind: "cluttered", text: long }), 3)).toEqual({
      photo: 3,
      kind: "cluttered",
      text: "Move the books and the mug out of the photo, so buyers can see the calculator and its cover clearly",
    });
    expect(PHOTO_TIP_MAX).toBe(100);
  });

  it("treats a missing or null tip as no tip, and the suggestion stays", () => {
    expect(tipOf(reply(), 3)).toBeNull();
    expect(tipOf(tip(null), 3)).toBeNull();
  });

  it("drops a tip that breaks a rule, never the suggestion (Groq saw only the cover: seen 1)", () => {
    for (const [photoTip, seen] of [
      [{ photo: 2, kind: "dark", text: "Too dark." }, 1],
      [{ photo: 2, kind: "better-cover", text: "Use this one." }, 1],
      [{ photo: 1, kind: "better-cover", text: "Use this one." }, 3],
      [{ photo: 4, kind: "blurry", text: "Hold it still." }, 3],
      [{ photo: 0, kind: "blurry", text: "Hold it still." }, 3],
      [{ photo: 1.5, kind: "blurry", text: "Hold it still." }, 3],
      [{ photo: "1", kind: "blurry", text: "Hold it still." }, 3],
      [{ photo: 1, kind: "tilted", text: "Straighten it." }, 3],
      [{ photo: 1, kind: "dark", text: "   " }, 3],
      [{ photo: 1, kind: "dark" }, 3],
      ["dark", 3],
    ] as const) {
      const checked = checkSuggestion(tip(photoTip), SLUGS, seen);
      expect(checked, JSON.stringify(photoTip)).toMatchObject({ title: "Financial Accounting, 3rd edition", photoTip: null });
    }
  });

  it("still refuses an unknown field beside photoTip", () => {
    expect(checkSuggestion(reply({ photoTip: null, price: 200 }), SLUGS, 1)).toBe("bad-output");
  });

  it("asks for photoTip in the schema as null or one photo's tip, with no enum beside a type array", () => {
    const schema = suggestionSchema(SLUGS);
    expect(schema.required).toContain("photoTip");
    expect(schema.properties.photoTip.anyOf[0]).toEqual({ type: "null" });
    expect(schema.properties.photoTip.anyOf[1].properties.kind.enum).toEqual([
      "dark",
      "blurry",
      "cluttered",
      "cut-off",
      "better-cover",
    ]);
    // Anthropic refuses an enum beside `type: [..., "null"]` (AI stage E's real-key run).
    const bad: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node !== "object" || node === null) return;
      const each = node as Record<string, unknown>;
      if (Array.isArray(each.type) && "enum" in each) bad.push(path);
      for (const [key, value] of Object.entries(each)) walk(value, `${path}.${key}`);
    };
    walk(schema, "schema");
    expect(bad).toEqual([]);
  });

  it("tells the model a tip is for a real problem only, and better-cover only with another clearly better photo", () => {
    const words = suggestionInstruction(categories);
    expect(words).toMatch(/photoTip: null unless one photo has a real problem/);
    expect(words).toMatch(/better-cover \(another photo shows the item clearly better than photo 1\)/);
    expect(words).toMatch(/at most 100 characters/);
    // Haiku gets each photo after a "Photo n" label (lib/data/ai/anthropic.ts), so the number names the right one.
    expect(words).toMatch(/each photo follows its label, "Photo 1" \(the cover\)/);
  });
});

describe("the photo tip on the form (AI round two spec 7, stage F planning decisions 4 and 8)", () => {
  const A = "/photos/ph-a";
  const B = "/photos/ph-b";
  const C = "/photos/ph-c";

  it("carries a tip by the address of the photo sent in its place", () => {
    expect(photoTipValues({ photo: 2, kind: "better-cover", text: "This one shows the whole cover." }, [A, C])).toEqual({
      tipPhoto: C,
      tipKind: "better-cover",
      tipText: "This one shows the whole cover.",
    });
    expect(photoTipValues({ photo: 3, kind: "dark", text: "Too dark." }, [A, C])).toEqual({});
    expect(photoTipValues(null, [A, C])).toEqual({});
  });

  it("shows a tip for a photo still on the form, numbered by its place now", () => {
    const values = { tipPhoto: C, tipKind: "dark", tipText: "Take it again near a window." };
    expect(shownPhotoTip(values, [A, B, C])).toEqual({ place: 3, src: C, kind: "dark", text: "Take it again near a window." });
    expect(shownPhotoTip(values, [C, A])).toEqual({ place: 1, src: C, kind: "dark", text: "Take it again near a window." });
  });

  it("shows nothing for a photo that's gone, a made-up kind or words, or a better cover that's the cover already", () => {
    const tip = { tipPhoto: B, tipKind: "better-cover", tipText: "This one shows the whole cover." };
    expect(shownPhotoTip(tip, [A, C])).toBeNull();
    expect(shownPhotoTip(tip, [B, A])).toBeNull();
    expect(shownPhotoTip({ ...tip, tipKind: "tilted" }, [A, B])).toBeNull();
    expect(shownPhotoTip({ ...tip, tipText: "" }, [A, B])).toBeNull();
    expect(shownPhotoTip({ ...tip, tipText: "x".repeat(101) }, [A, B])).toBeNull();
    expect(shownPhotoTip({}, [A, B])).toBeNull();
  });

  it("keeps only the form's own tags through a photo move", () => {
    expect(keepSuggestedTags(`title category alt:${A} alt:/photos/ph-gone bogus title`, [B, A])).toBe(`title category alt:${A}`);
    expect(keepSuggestedTags("", [A])).toBe("");
  });
});
