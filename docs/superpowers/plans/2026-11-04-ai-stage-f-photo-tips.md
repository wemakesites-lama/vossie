# AI stage F: photo tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Never commit** in this project: leave the work uncommitted for the controller (Lama's rule).

**Goal:** After "Fill in from my photo", the photo card shows at most one tip about one photo ("Tip for photo 1: Take it again near a window, so the cover isn't so dark."), and when another photo would make a clearly better cover, a "Make it the cover" button that uses the photo field's existing move. Nothing is stored with the listing.

**Architecture:** The photo-to-listing reply gains one field, `photoTip` (null or `{ photo, kind, text }`). Its rules are pure, in `lib/selling/suggest.ts`: the schema, the instruction lines, `checkPhotoTip` (run inside `checkSuggestion` against the number of photos the provider saw), and three small form helpers (`photoTipValues`, `shownPhotoTip`, `keepSuggestedTags`). The door (`readListingPhotos`, `lib/data/ai.ts`) tells the check how many photos each provider saw: Groq reads only the cover, so it saw 1. `suggestFromPhotos` carries the tip to the form in form state by the photo's address, like the filled values; `ListingForm` turns it into a `ShownPhotoTip`, and `PhotoTipHint`, a Server Component inside the Photos fieldset, draws it with "Make it the cover" as a plain `photoMove` submit button. `PhotoField` (the client component) is not touched, so no new code reaches the browser.

**Tech Stack:** Next.js 16.4 (App Router, Server Actions), TypeScript, Vitest + Testing Library, Playwright + axe. No Supabase change.

**Spec:** `docs/superpowers/specs/2026-11-04-ai-round-two-design.md` section 7 (photo tips) and section 8 (stages and testing), decision 97. Builds on photo-to-listing (`docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`) and AI features stage A (`docs/superpowers/plans/2026-11-03-ai-stage-a-haiku-first.md`).

**Parallel work:** stages G ("Someone's looking for this") and H (Starter pack) may be built at the same time in other worktrees. G's publish line touches `saveListingForm`'s publish path in `lib/selling/listing-actions.ts`; F touches only `suggestFromPhotos` and the photo-move branch there. Shared files (`lib/selling/listing-actions.ts`, `lib/data/ai.ts`, `lib/data/ai/fake.ts`, `components/sell/ListingFormView.tsx`, `app/globals.css`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`, the spec): **add your own lines in your own block; never reorder, reformat or rename what's there.** `pnpm build` and e2e runs take the controller's `e2e-3200.lock` (as in stages C to E); stop only your own server, by PID. F needs no Supabase stack.

---

## Planning decisions (go into the spec's new section 10, "While planning stage F")

1. **A tip is checked against the photos its provider saw.** `checkSuggestion(text, categorySlugs, seen)` takes `seen`, the number of photos that provider read: Groq reads only the cover (`groq.ts`), so the door passes 1 (`COVER_ONLY`); Haiku and the fake get the number sent (at most `PHOTOS_READ`, 3). A tip's `photo` must be 1 to `seen`, and `better-cover` must name a photo other than 1. That one rule gives spec 7's Groq line (photo 1 only, never `better-cover`) and also throws out a tip about a photo the model was never sent.
2. **A broken or missing tip loses only the tip, never the suggestion.** `checkSuggestion` drops a tip that breaks a rule and keeps the rest. The schema lists `photoTip` as required (strict structured outputs want every property listed), but our check accepts a reply without it: Groq's `json_object` fallback (`VOSSIE_GROQ_FORMAT`) may leave it out, and that must still fill the form.
3. **The schema has no enum beside a type array, and no length or number limits.** `photoTip` is `anyOf: [{ type: "null" }, { type: "object", … }]`; inside, `kind` is `{ type: "string", enum: [...] }` (no null), `photo` is `{ type: "integer" }`, and `text` is `{ type: "string" }`. Anthropic refuses an enum beside `type: ["string", "null"]` (stage E's real-key run), and models can't count characters (stage C's summaries), so `text` is clipped to 100 characters at a word with the file's own `cutTo`, never refused. A unit test walks the schema for any enum beside a type array.
4. **The tip travels to the form by the photo's address, not its number.** `suggestFromPhotos` maps `photo` to the address of the photo actually sent in that place: a photo after the cover that failed to load was left out, so the n-th photo sent isn't always the n-th on the form. The form-state values are `tipPhoto` (the address), `tipKind` and `tipText`. `shownPhotoTip` shows the tip only for an address still on the form and numbers it by its place now, and never shows `better-cover` for the photo that's already the cover.
5. **"Nothing is stored" means nothing beyond the redirect.** The tip rides in the listing form's form state for the redirect after Fill in, as the filled values and their "Suggested" tags already do (10 minutes, this session only). It's never saved with the listing or anywhere else, and the next post of any kind (a save, a photo move, another fill) drops it, since `typedValues` doesn't carry it.
6. **The tip shows after a fill that read the photos:** the notices `suggested` and `suggest-nothing` (every field already typed: the photos were still read, and a tip still helps). Never after a failure, a person, no photo or the daily limit.
7. **Drawn on the server, inside the Photos fieldset, under its hint and above the photos** (`components/sell/PhotoTipHint.tsx`, passed through `PhotoFieldset`'s new `tip` prop). The hint reuses `.form-hint` (already white on the navy card) and the button reuses `.sell-action` (44px tall, already outlined on navy), so the only CSS is one small `.photo-tip` layout rule. `PhotoField` gets no new prop and no new code: `/sell/listings/new` was 153,382 B of a 153,600 B brotli budget (stage A's progress entry).
8. **"Make it the cover" is a submit button posting `photoMove=<address>:cover`,** the value the photo field's own Make cover posts without JavaScript. With JavaScript it's a normal post too (the photo field's client moves handle only its own buttons, and its submit hold still waits for photos being shrunk). The server's existing move branch applies it and lands on the Photos legend. So the seller still knows what to check, the move keeps the fill's "Suggested" tags: the form posts them back in a hidden `suggested` field, and `keepSuggestedTags` keeps only the form's own field names and descriptions of photos still on the form, so form state never holds a stranger's text (amendment 10.2). The "We filled in N fields" notice, the price hint and the Looking For line go, as after any server move.
9. **The fake:** with two photos or more it says photo 2 is the better cover (`FAKE_COVER_TIP`); with one photo it gives no tip, so every existing test and the one-photo e2e fill are unchanged.
10. **No privacy page change and no Supabase change.** Nothing new is sent (the same photos and instruction) and nothing new is kept. `form_states.values` is JSON and takes the three new keys as it is.
11. **Words:** "Tip for photo {n}: {text}" and "Make it the cover" (the button is described by the tip, so a screen reader hears which photo).

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/selling/suggest.ts` (+ `suggest.test.ts`) | modify | `PHOTO_TIP_KINDS`, `PHOTO_TIP_MAX`, `PhotoTip`, `PhotoTipKind`, `ShownPhotoTip`; `Suggestion.photoTip`; the schema's `photoTip`; the instruction's lines; `checkPhotoTip`; `checkSuggestion(text, slugs, seen)`; `photoTipValues`, `shownPhotoTip`, `keepSuggestedTags` |
| `lib/data/ai.ts` (+ `ai.test.ts`) | modify | `COVER_ONLY`; `readListingPhotos` passes each provider's `seen` |
| `lib/data/ai/fake.ts` | modify | `FAKE_REPLY.photoTip: null`, `FAKE_COVER_TIP`, the `photo-to-listing` case |
| `lib/selling/listing-actions.ts` (+ `listing-actions.test.ts`) | modify | `suggestFromPhotos` carries the tip by address; the photo-move branch keeps the fill's tags |
| `components/sell/PhotoTipHint.tsx` | create | the tip and "Make it the cover", server-rendered |
| `components/sell/PhotoFieldset.tsx` | modify | `tip` prop, renders `PhotoTipHint` under the hint |
| `components/sell/ListingFormView.tsx` (+ test) | modify | `photoTip` prop to the fieldset; the hidden `suggested` field |
| `components/sell/ListingForm.tsx` (+ test) | modify | `shownPhotoTip` after a fill |
| `app/globals.css` | modify | `.photo-tip`, beside `.photo-start-looking` |
| `tests/e2e/selling-writes.spec.ts` | modify | the photo tips test (fake: two photos, Make it the cover, axe, layout shift) |
| `scripts/photo-test.hand.ts` | modify | passes `seen`; Tip column, with tips the check dropped marked |
| `CLAUDE.md`, the spec, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md` | modify | docs |

---

### Task 1: The reply's tip (schema, instruction, check)

**Files:** Modify `lib/selling/suggest.ts`, `lib/selling/suggest.test.ts`.

- [ ] **Step 1: Update the existing tests for the new argument and field.** In `lib/selling/suggest.test.ts`:
  - every existing `checkSuggestion(…, SLUGS)` call becomes `checkSuggestion(…, SLUGS, 1)`;
  - the first test's `toEqual({ … moduleCode: "FAC1501" })` gains `photoTip: null` (the `reply()` helper sends no `photoTip`: a reply without one is still good);
  - the `Suggestion` literal in the `mergeSuggestion` describe gains `photoTip: null`.

- [ ] **Step 2: Failing tests.** Add `PHOTO_TIP_MAX` to the file's import from `./suggest` (`checkPhotoTip` is tested through `checkSuggestion`), then append:

```ts
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
  });
});
```

- [ ] **Step 3:** `pnpm vitest run lib/selling/suggest.test.ts` → FAIL (`PHOTO_TIP_MAX` not exported; `photoTip` missing).

- [ ] **Step 4: Implement** in `lib/selling/suggest.ts`.

  After `MODULE_CODE`, add:

```ts
/** What a photo tip is about (AI round two spec 7). */
export const PHOTO_TIP_KINDS = ["dark", "blurry", "cluttered", "cut-off", "better-cover"] as const;
export type PhotoTipKind = (typeof PHOTO_TIP_KINDS)[number];

/** A tip's words at most (spec 7). Longer ones are clipped at a word, never refused: models can't count characters. */
export const PHOTO_TIP_MAX = 100;

/** One photo's tip: its number among the photos sent (1 is the cover), what's wrong, and how to fix it. */
export type PhotoTip = { photo: number; kind: PhotoTipKind; text: string };
```

  In `Suggestion`, after `moduleCode`:

```ts
  /** At most one photo's tip (AI round two spec 7), or null: most photos need none. */
  photoTip: PhotoTip | null;
```

  In `suggestionInstruction`, insert these lines after the `personIsSubject` line and before the `confidence` line:

```ts
    "photoTip: null unless one photo has a real problem a buyer would notice. Most photos need no tip.",
    "When one does, give one tip, for the photo that matters most. photo is its number (1 is the cover). kind is dark (too dark to see the item well), blurry (out of focus or shaken), cluttered (other things crowd the item), cut-off (part of the item is outside the photo) or better-cover (another photo shows the item clearly better than photo 1).",
    "better-cover only when you were sent more than one photo, with photo the better one's number. text: one short, friendly sentence about that photo saying how to fix it, at most 100 characters, without the photo's number, such as \"Take it again near a window, so the item isn't so dark.\"",
```

  In `suggestionSchema`, add `"photoTip"` at the end of `required`, and at the end of `properties`:

```ts
      // anyOf, not `type: ["object", "null"]`: Anthropic refuses an enum beside a type array (AI stage E's real-key
      // run). No maxLength or minimum: models can't count, so the check clips the words and drops a bad number.
      photoTip: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["photo", "kind", "text"],
            properties: {
              photo: { type: "integer" },
              kind: { type: "string", enum: [...PHOTO_TIP_KINDS] },
              text: { type: "string" },
            },
          },
        ],
      },
```

  Replace the `FIELDS` line with:

```ts
/** The fields every reply must have. photoTip may be missing (a Groq json_object reply can leave it out): no tip. */
const FIELDS = Object.keys(suggestionSchema([]).properties)
  .filter((key) => key !== "photoTip")
  .sort()
  .join(",");
```

  After `moduleCodeOf`, add:

```ts
/**
 * A reply's tip, checked against the photos its provider saw (AI round two spec 7): `seen` is 1 for Groq, which reads
 * only the cover, so its tip must be about photo 1 and is never better-cover. better-cover never names the cover
 * itself. A tip that breaks a rule, or whose words come to nothing, is dropped and the suggestion stays. Long words are
 * clipped at a word, not refused.
 */
export function checkPhotoTip(raw: unknown, seen: number): PhotoTip | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { photo, kind, text } = raw as Record<string, unknown>;
  if (typeof photo !== "number" || !Number.isInteger(photo) || photo < 1 || photo > seen) return null;
  if (typeof kind !== "string" || !(PHOTO_TIP_KINDS as readonly string[]).includes(kind)) return null;
  if (kind === "better-cover" && photo === 1) return null;
  if (typeof text !== "string") return null;
  const words = cutTo(cleanLine(text).trim(), PHOTO_TIP_MAX);
  return words ? { photo, kind: kind as PhotoTipKind, text: words } : null;
}
```

  Change `checkSuggestion`:
  - signature: `export function checkSuggestion(text: string, categorySlugs: readonly string[], seen: number): Suggestion | SuggestFailure`;
  - its doc comment gains one sentence: "`seen` is how many photos the provider read, for the photo tip (AI round two spec 7)."
  - the field check: `if (Object.keys(reply).filter((key) => key !== "photoTip").sort().join(",") !== FIELDS) return "bad-output";`
  - the returned object gains `photoTip: checkPhotoTip(reply.photoTip, seen),` after `moduleCode`.

- [ ] **Step 5:** `pnpm vitest run lib/selling/suggest.test.ts` → PASS. (`pnpm typecheck` will fail in `lib/data/ai.ts` and `scripts/photo-test.hand.ts` until Tasks 3 and 7; that's expected.)

### Task 2: The form's tip helpers

**Files:** Modify `lib/selling/suggest.ts`, `lib/selling/suggest.test.ts`.

- [ ] **Step 1: Failing tests.** Add `keepSuggestedTags`, `photoTipValues` and `shownPhotoTip` to the import, then append:

```ts
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
```

- [ ] **Step 2:** `pnpm vitest run lib/selling/suggest.test.ts` → FAIL.

- [ ] **Step 3: Implement** at the end of `lib/selling/suggest.ts`:

```ts
/** A tip as the form shows it: the photo's place now (1 is the cover) and its address, for Make it the cover. */
export type ShownPhotoTip = { place: number; src: string; kind: PhotoTipKind; text: string };

/**
 * The form-state values that carry a tip to the form after a fill (stage F planning decisions 4 and 5): the photo by
 * the address of the one sent in its place, since a photo that didn't load was left out. Never saved with a listing.
 */
export function photoTipValues(tip: PhotoTip | null, sentSrcs: readonly string[]): Record<string, string> {
  const src = tip ? sentSrcs[tip.photo - 1] : undefined;
  return tip && src ? { tipPhoto: src, tipKind: tip.kind, tipText: tip.text } : {};
}

/**
 * The tip to show (AI round two spec 7), or null: only for a photo still on the form, numbered by its place now, and
 * never a better cover that's already the cover. Form state is checked again like anything read back.
 */
export function shownPhotoTip(values: Readonly<Record<string, string>>, srcs: readonly string[]): ShownPhotoTip | null {
  const { tipPhoto = "", tipKind = "", tipText = "" } = values;
  const at = tipPhoto ? srcs.indexOf(tipPhoto) : -1;
  if (at < 0 || !(PHOTO_TIP_KINDS as readonly string[]).includes(tipKind)) return null;
  if (!tipText || characterCount(tipText) > PHOTO_TIP_MAX) return null;
  if (tipKind === "better-cover" && at === 0) return null;
  return { place: at + 1, src: tipPhoto, kind: tipKind as PhotoTipKind, text: tipText };
}

const TAGGED_FIELDS: readonly string[] = ["title", "category", "condition", "description"];

/**
 * A fill's "Suggested" tags posted back with a photo move (stage F planning decision 8): only the form's own field
 * names and descriptions of photos still on the form, once each, so form state never holds a stranger's text.
 */
export function keepSuggestedTags(raw: string, order: readonly string[]): string {
  const known = (key: string) => TAGGED_FIELDS.includes(key) || (key.startsWith("alt:") && order.includes(key.slice(4)));
  return [...new Set(raw.split(" ").filter(known))].join(" ");
}
```

- [ ] **Step 4:** `pnpm vitest run lib/selling/suggest.test.ts` → PASS.

### Task 3: The door and the fake

**Files:** Modify `lib/data/ai.ts`, `lib/data/ai/fake.ts`, `lib/data/ai.test.ts`.

- [ ] **Step 1: Failing tests.** In `lib/data/ai.test.ts`, add `FAKE_COVER_TIP` to the import from `./ai/fake`, then append:

```ts
describe("photo tips through the door (AI round two spec 7)", () => {
  const withTip = (photoTip: unknown) => JSON.stringify({ ...FAKE_REPLY, photoTip });
  const better = { photo: 2, kind: "better-cover", text: "This one shows the whole cover." };

  it("keeps Haiku's better-cover tip about a photo it was sent, and drops one about a photo it wasn't", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: true, text: withTip(better) });
    expect(await readListingPhotos([photo(1), photo(2)], CATEGORIES)).toMatchObject({ ok: true, suggestion: { photoTip: better } });
    haiku.mockResolvedValueOnce({ ok: true, text: withTip({ photo: 3, kind: "dark", text: "Too dark." }) });
    expect(await readListingPhotos([photo(1), photo(2)], CATEGORIES)).toMatchObject({ ok: true, suggestion: { photoTip: null } });
  });

  it("holds Groq to the cover: a tip about photo 2 or a better cover is dropped, the suggestion kept", async () => {
    bothProviders();
    for (const tip of [better, { photo: 2, kind: "dark", text: "Too dark." }]) {
      haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
      groq.mockResolvedValueOnce({ ok: true, text: withTip(tip) });
      expect(await readListingPhotos([photo(1), photo(2)], CATEGORIES)).toMatchObject({
        ok: true,
        suggestion: { moduleCode: "FAC1501", photoTip: null },
      });
    }
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    groq.mockResolvedValueOnce({ ok: true, text: withTip({ photo: 1, kind: "dark", text: "Take it near a window." }) });
    expect(await readListingPhotos([photo(1), photo(2)], CATEGORIES)).toMatchObject({
      ok: true,
      suggestion: { photoTip: { photo: 1, kind: "dark", text: "Take it near a window." } },
    });
  });

  it("uses the fake's better cover only with two photos or more", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true, suggestion: { photoTip: null } });
    expect(await readListingPhotos([photo(1), photo(2)], CATEGORIES)).toMatchObject({
      ok: true,
      suggestion: { photoTip: FAKE_COVER_TIP },
    });
  });
});
```

  (If the file's existing fake tests stub more than `VOSSIE_AI_PROVIDERS` for the listing feature, copy what they stub.)

- [ ] **Step 2:** `pnpm vitest run lib/data/ai.test.ts` → FAIL.

- [ ] **Step 3: Implement the door.** In `lib/data/ai.ts`, after `MOVE_ON`:

```ts
/**
 * Providers that read only the cover, however many photos are sent (Groq: AI features spec 2.2). A photo tip from one
 * must be about photo 1 and is never better-cover (AI round two spec 7).
 */
const COVER_ONLY: ReadonlySet<ProviderName> = new Set(["groq"]);
```

  In `readListingPhotos`, replace `const checked = checkSuggestion(reply.text, slugs);` with:

```ts
    const seen = COVER_ONLY.has(name) ? Math.min(1, request.images.length) : request.images.length;
    const checked = checkSuggestion(reply.text, slugs, seen);
```

- [ ] **Step 4: Implement the fake.** In `lib/data/ai/fake.ts`:
  - `FAKE_REPLY` gains `photoTip: null,` after `confidence: "high",`;
  - after `FAKE_REPLY`, add:

```ts
/** Photo tips' fake (AI stage F): with two photos or more, photo 2 is the better cover, so the e2e test can move it. */
export const FAKE_COVER_TIP = {
  photo: 2,
  kind: "better-cover",
  text: "This one shows the whole cover, so buyers see more.",
} as const;
```

  - in `fakeReply`, add a case before `default`:

```ts
    case "photo-to-listing":
      return request.images.length > 1 ? { ...FAKE_REPLY, photoTip: FAKE_COVER_TIP } : FAKE_REPLY;
```

  - the file's opening comment: after "Photo-to-listing: a textbook with a module code, so the tags, the price hint and the Looking For line can all show", add "; with two photos or more, a better cover (FAKE_COVER_TIP)".

- [ ] **Step 5:** `pnpm vitest run lib/data/ai.test.ts lib/selling/suggest.test.ts` → PASS.

### Task 4: The action carries the tip, and a move keeps the tags

**Files:** Modify `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`.

- [ ] **Step 1: Failing tests.** In `lib/selling/listing-actions.test.ts`, in the `filling in from a photo` describe:
  - the `suggestion` literal gains `photoTip: null as PhotoTip | null,` (import `type PhotoTip` from `./suggest`), so `{ ...suggestion, photoTip: … }` type-checks;
  - append:

```ts
  it("carries a tip to the form by the photo's address, and keeps it when every field was typed (AI stage F)", async () => {
    await signedInAs("acc-seller");
    const tip = { photo: 2, kind: "better-cover" as const, text: "This one shows the whole cover." };
    vi.mocked(readListingPhotos).mockResolvedValue({ ok: true, suggestion: { ...suggestion, photoTip: tip } });
    const files = [1, 2].map((n) => photoFile(pngBytes(), `photo-${n}.png`));
    await redirectOf(async () => saveListingForm(await suggestForm({ newPhotos: files })));
    const state = (await readFormState(listingForm(null)))!;
    const [first, second] = state.values.photos.split("\n");
    expect(state.notice).toBe("suggested");
    expect(state.values).toMatchObject({ tipPhoto: second, tipKind: "better-cover", tipText: tip.text });
    expect(state.values.tipPhoto).not.toBe(first);

    await signedInAs("acc-seller");
    const full = { title: "My calculator", category: "tech", condition: "good", description: "Works well." };
    await redirectOf(async () => saveListingForm(await suggestForm({ ...full, newPhotos: files })));
    const typed = (await readFormState(listingForm(null)))!;
    expect(typed.notice).toBe("suggest-nothing");
    expect(typed.values).toMatchObject({ tipKind: "better-cover", tipText: tip.text });
  });

  it("gives no tip values when the reply has none", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readListingPhotos).mockResolvedValue({ ok: true, suggestion });
    await redirectOf(async () => saveListingForm(await suggestForm()));
    const state = (await readFormState(listingForm(null)))!;
    expect(state.values.tipPhoto).toBeUndefined();
    expect(state.values.tipKind).toBeUndefined();
  });

  it("Make it the cover: the photo move puts it first, keeps the fill's own tags and drops the tip (AI stage F)", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readListingPhotos).mockResolvedValue({
      ok: true,
      suggestion: { ...suggestion, photoTip: { photo: 2, kind: "better-cover", text: "This one shows the whole cover." } },
    });
    const files = [1, 2].map((n) => photoFile(pngBytes(), `photo-${n}.png`));
    await redirectOf(async () => saveListingForm(await suggestForm({ newPhotos: files })));
    const [first, second] = (await readFormState(listingForm(null)))!.values.photos.split("\n");

    await signedInAs("acc-seller");
    const moved = await suggestForm({
      newPhotos: [],
      photo: [first, second],
      photoMove: `${second}:cover`,
      suggested: `title category alt:${first} alt:/photos/ph-gone made-up`,
    });
    expect(await redirectOf(async () => saveListingForm(moved))).toBe("/sell/listings/new#new-photos-title");
    const state = (await readFormState(listingForm(null)))!;
    expect(state.values.photos).toBe(`${second}\n${first}`);
    expect(state.values.suggested).toBe(`title category alt:${first}`);
    expect(state.values.tipPhoto).toBeUndefined();
    expect(state.notice).toBeNull();
    expect(readListingPhotos).toHaveBeenCalledTimes(1);
  });
```

  (`suggestForm` posts `intent=suggest`, but the photo-move branch runs before the intent is read, as with any photo button. If the second `signedInAs` resets the session's form state in this file's helpers, read `first`/`second` before it, as above, and reuse them.)

- [ ] **Step 2:** `pnpm vitest run lib/selling/listing-actions.test.ts` → FAIL.

- [ ] **Step 3: Implement.** In `lib/selling/listing-actions.ts`:
  - the `./suggest` import becomes `import { keepSuggestedTags, mergeSuggestion, photoTipValues, type SuggestFailure } from "./suggest";`
  - in `suggestFromPhotos`, replace the block from `const more = await Promise.all(` through `const photos = …;` with:

```ts
    // The photos after the cover go too when they load; one that doesn't (or whose read fails) is left out. They're
    // read before the press is counted, so a failure here never costs one. Each keeps its address, so a photo tip
    // names the photo sent in its place (AI stage F planning decision 4).
    const more = await Promise.all(
      order.slice(1, PHOTOS_READ).map(async (src) => {
        const other = photoIdOf(src);
        const read = other ? await photoFor(other, viewer, now).catch(() => null) : null;
        return read ? { src, read } : null;
      }),
    );
    if (!isSampleAccount(owner.account) && !(await reservePhotoFill(owner.account.id, now, PHOTO_FILLS_PER_DAY))) {
      return { values, notice: "suggest-limit" };
    }
    const sent = [{ src: cover, read: photo }, ...more.filter((each) => each !== null)];
    const photos = sent.map(({ read: { type, bytes } }) => ({ type, bytes }));
```

  - after `if (!reading.ok) return …;`, add:

```ts
    // The photo tip (AI round two spec 7) goes to the form with the fill, never with the listing.
    const tip = photoTipValues(reading.suggestion.photoTip, sent.map((each) => each.src));
```

  - the `suggest-nothing` return becomes `return { values: { ...values, ...tip }, notice: "suggest-nothing" };`
  - the success return's values gain `...tip,` after `suggestedModule: …`;
  - the function's doc comment gains: "A photo tip, when the reply has one, comes back with the fill (AI round two spec 7)."
  - in `saveListingForm`'s photo-move branch, replace `const state = { errors: photoErrors, values: typedValues(formData, moved, alts, context), notice: null };` with:

```ts
    const values = typedValues(formData, moved, alts, context);
    // A fill's "Suggested" tags stay through a move (Make it the cover, AI stage F); a photo tip goes with any post.
    const tags = keepSuggestedTags(field(formData, "suggested"), moved);
    if (tags) values.suggested = tags;
    const state = { errors: photoErrors, values, notice: null };
```

- [ ] **Step 4:** `pnpm vitest run lib/selling/listing-actions.test.ts` → PASS (the whole file: the existing photo-move tests post no `suggested`, so their values are unchanged).

### Task 5: The tip on the form

**Files:** Create `components/sell/PhotoTipHint.tsx`. Modify `components/sell/PhotoFieldset.tsx`, `components/sell/ListingFormView.tsx`, `components/sell/ListingFormView.test.tsx`, `components/sell/ListingForm.tsx`, `components/sell/ListingForm.test.tsx`, `app/globals.css`.

- [ ] **Step 1: Failing view test.** Append to the photo-to-listing tests in `components/sell/ListingFormView.test.tsx` (it already imports `within`):

```tsx
  it("shows a photo tip in the Photos group, with Make it the cover only for a better cover (AI stage F)", () => {
    const two = ["/placeholders/photo/2.svg", "/placeholders/photo/3.svg"].map((src) => ({ src, alt: "", thumb: src }));
    const { unmount } = show({
      photoStart: { on: true, limitReached: false },
      photos: two,
      values: { ...values, suggested: "title" },
      notice: "suggested",
      photoTip: { place: 2, src: two[1].src, kind: "better-cover", text: "This one shows the whole cover." },
    });
    expect(document.getElementById("new-photo-tip")).toHaveTextContent("Tip for photo 2: This one shows the whole cover.");
    const make = within(screen.getByRole("group", { name: "Photos" })).getByRole("button", { name: "Make it the cover" });
    expect(make).toHaveAttribute("type", "submit");
    expect(make).toHaveAttribute("name", "photoMove");
    expect(make).toHaveAttribute("value", "/placeholders/photo/3.svg:cover");
    expect(make).toHaveAccessibleDescription("Tip for photo 2: This one shows the whole cover.");
    expect(document.querySelector('input[type="hidden"][name="suggested"]')).toHaveValue("title");
    unmount();

    show({
      photoStart: { on: true, limitReached: false },
      photos: two,
      photoTip: { place: 1, src: two[0].src, kind: "dark", text: "Take it again near a window." },
    });
    expect(document.getElementById("new-photo-tip")).toHaveTextContent("Tip for photo 1: Take it again near a window.");
    expect(screen.queryByRole("button", { name: "Make it the cover" })).toBeNull();
    expect(document.querySelector('input[name="suggested"]')).toBeNull();
  });

  it("shows no tip without one", () => {
    show({ photoStart: { on: true, limitReached: false } });
    expect(document.querySelector(".photo-tip")).toBeNull();
  });
```

- [ ] **Step 2: Failing request-time test.** In `components/sell/ListingForm.test.tsx`, add `vi.unstubAllEnvs();` to the existing `beforeEach`, then append inside the describe:

```tsx
  it("shows a fill's photo tip for a photo still on the form, and none for one that's gone (AI stage F)", async () => {
    vi.stubEnv("VOSSIE_LISTING_AI", "1");
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    viewer.sessionKey = "session-1";
    const filled = (tipPhoto: string) =>
      saveFormState(
        {
          sessionKey: "session-1",
          form: "listing:new",
          errors: [],
          values: {
            kind: "item",
            title: "Financial Accounting",
            photos: "/placeholders/photo/2.svg\n/placeholders/photo/3.svg",
            suggested: "title",
            tipPhoto,
            tipKind: "better-cover",
            tipText: "This one shows the whole cover.",
          },
          notice: "suggested",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        new Date(),
      );
    await filled("/placeholders/photo/3.svg");
    const { unmount } = render(await ListingForm({}));
    expect(screen.getByRole("button", { name: "Make it the cover" })).toHaveAttribute("value", "/placeholders/photo/3.svg:cover");
    unmount();
    await filled("/placeholders/photo/9.svg");
    render(await ListingForm({}));
    expect(screen.queryByRole("button", { name: "Make it the cover" })).toBeNull();
  });
```

- [ ] **Step 3:** `pnpm vitest run components/sell` → FAIL.

- [ ] **Step 4: Implement.** Create `components/sell/PhotoTipHint.tsx`:

```tsx
import type { ShownPhotoTip } from "@/lib/selling/suggest";

/**
 * A photo tip after "Fill in from my photo" (AI round two spec 7), drawn on the server beside the photos: what to fix
 * in one photo and, for a better cover, Make it the cover, which posts the photo field's own move ("<photo>:cover")
 * with the form. No client code, and nothing is stored: the next post drops it.
 */
export function PhotoTipHint({ prefix, tip }: { prefix: string; tip: ShownPhotoTip }) {
  const id = `${prefix}-photo-tip`;
  return (
    <div className="photo-tip">
      <p id={id} className="form-hint">
        <strong>Tip for photo {tip.place}:</strong> {tip.text}
      </p>
      {tip.kind === "better-cover" && (
        <button type="submit" name="photoMove" value={`${tip.src}:cover`} aria-describedby={id} className="sell-action">
          Make it the cover
        </button>
      )}
    </div>
  );
}
```

  In `components/sell/PhotoFieldset.tsx`:
  - import `type { ShownPhotoTip } from "@/lib/selling/suggest"` and `{ PhotoTipHint } from "./PhotoTipHint"`;
  - `PhotoFieldsetProps` gains `/** A photo tip after a fill (AI round two spec 7), or null. */ tip?: ShownPhotoTip | null;`
  - destructure `tip`, and render `{tip && <PhotoTipHint prefix={prefix} tip={tip} />}` right after `<FieldError id={errorId} message={error} />` and before `<PhotoField`;
  - the component's doc comment gains: "A photo tip after a fill is drawn here too, under the hint (AI stage F)."

  In `components/sell/ListingFormView.tsx`:
  - import `type { ShownPhotoTip } from "@/lib/selling/suggest"`;
  - props gain `/** A photo tip after a fill (AI round two spec 7), or null. */ photoTip?: ShownPhotoTip | null;` after `lookingFor`, and `photoTip = null` joins the second destructuring line;
  - `photoField`'s `<PhotoFieldset … suggested={suggested}` gains `tip={photoTip}`;
  - inside the `<form>`, after the `once` hidden input:

```tsx
        {/* A fill's tags go back with a photo move (Make it the cover), so they stay on the form (AI stage F). */}
        {values.suggested && <input type="hidden" name="suggested" value={values.suggested} />}
```

  In `components/sell/ListingForm.tsx`:
  - import `{ shownPhotoTip } from "@/lib/selling/suggest"`;
  - after the `const [priceHint, lookingFor] = …` line:

```tsx
  // Photo tips (AI round two spec 7): after a fill that read the photos, for a photo still on the form (never stored).
  const read = on && (state?.notice === "suggested" || state?.notice === "suggest-nothing");
  const photoTip = read ? shownPhotoTip(values, photos.map((photo) => photo.src)) : null;
```

  - pass `photoTip={photoTip}` to `ListingFormView`.

  In `app/globals.css`, right after the `.photo-start-looking a { … }` rule, in the same block and indentation:

```css
  /* A photo tip after a fill (AI stage F): the hint, then Make it the cover under it. The hint and the button use the
     card's own .form-hint and .sell-action colours. */
  .photo-tip {
    display: grid;
    gap: 8px;
    justify-items: start;
    margin-block: 8px 12px;
  }
```

- [ ] **Step 5:** `pnpm vitest run components/sell lib/selling` → PASS. `pnpm typecheck` may still fail only in `scripts/photo-test.hand.ts` (Task 7). `lib/theme-contrast.test.ts` needs no new pair: no new colours.

### Task 6: The end-to-end test

**Files:** Modify `tests/e2e/selling-writes.spec.ts`.

- [ ] **Step 1: Write the test** right after the "fill in from a photo" test. Add `import { expectStill, recordShifts } from "./helpers/shifts";` to the imports.

```ts
test("photo tips: a better cover is offered after Fill in, and Make it the cover moves it (AI stage F)", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsSample(page, "Seller, Tech corner", "/sell");
  await page.goto("/sell/listings/new");
  // Two photos, so the fake says photo 2 is the better cover (FAKE_COVER_TIP).
  await field(page, "Add photos").setInputFiles([photoWithLocation("textbook-front.png"), photoWithLocation("textbook-back.png")]);
  await expect(main(page).getByText(/^Your photos are ready\.$/).filter({ visible: true })).toBeVisible();
  await button(page, "Fill in from my photo").click();
  const tip = main(page).locator(".photo-tip");
  await expect(tip).toContainText("Tip for photo 2: This one shows the whole cover, so buyers see more.", POST_LANDS);
  const before = await photoAddresses(page);
  expect(before).toHaveLength(2);
  expect(await seriousIssues(page), "the photo tip").toEqual([]);

  // The filled form stays in form state for 10 minutes, so loading it again draws the same tip: its layout shift.
  await recordShifts(page);
  await expectStill(page, "the new listing with a photo tip (390px)", "/sell/listings/new");
  await expect(tip).toBeVisible();

  await tip.getByRole("button", { name: "Make it the cover" }).click();
  await expect.poll(() => photoAddresses(page), POST_LANDS).toEqual([before[1], before[0]]);
  await expect(main(page).locator(".photo-tip")).toHaveCount(0);
  // The fill's tags stay through the move.
  await expect(main(page).locator(".field-tag", { hasText: "Suggested" }).first()).toBeVisible();
  // No listing was made, so nothing is left to delete.
});
```

- [ ] **Step 2:** `pnpm lint` and `pnpm typecheck` (the script error from Task 7 aside). Don't run Playwright yourself; the controller runs it in Task 9 under `e2e-3200.lock`.

### Task 7: The photo test's tip column

**Files:** Modify `scripts/photo-test.hand.ts`.

- [ ] **Step 1: Implement.**
  - the opening comment gains: "A Tip column shows each run's photo tip (AI stage F); one the check dropped shows as "dropped: …". expected.json may give `tip` (a kind, or null for none)."
  - `type Expected = Record<string, { categorySlug?: string; moduleCode?: string | null; tip?: string | null }>;`
  - the header rows become `"| Item | Run | ms | Result | Title | Category | Condition | Module | Tip | Expected |"` and `"|---|---|---|---|---|---|---|---|---|---|"`;
  - add above `describe`:

```ts
/** A tip as a table cell, with any pipe made safe. */
const tipCell = (tip: { photo: number; kind: string; text: string } | null | undefined) =>
  tip ? `${tip.photo} ${tip.kind}: ${tip.text.replaceAll("|", "/")}` : "";

/** The tip the model gave, before the check: so a tip the check dropped still shows. */
function rawTip(text: string) {
  try {
    const tip = (JSON.parse(text) as { photoTip?: unknown }).photoTip;
    return tip && typeof tip === "object" ? (tip as { photo: number; kind: string; text: string }) : null;
  } catch {
    return null;
  }
}
```

  - in the loop, replace the `checked` and `cells` lines with:

```ts
        // Groq reads only the cover (groq.ts), so its tip is checked against one photo, as the door does.
        const seen = run.name === "groq" ? 1 : request.images.length;
        const checked = reply.ok ? checkSuggestion(reply.text, slugs, seen) : reply.failure;
        const given = reply.ok ? rawTip(reply.text) : null;
        const tip =
          typeof checked === "string" ? "" : checked.photoTip ? tipCell(checked.photoTip) : given ? `dropped: ${tipCell(given)}` : "";
        const cells =
          typeof checked === "string"
            ? [checked, "", "", "", "", ""]
            : ["ok", checked.title, checked.categorySlug, checked.condition, checked.moduleCode ?? "", tip];
```

  - `wanted` becomes ``want ? `${want.categorySlug ?? ""} ${want.moduleCode ?? ""} ${want.tip === undefined ? "" : `tip ${want.tip ?? "none"}`}`.trim() : ""``.

- [ ] **Step 2:** `pnpm typecheck` → clean; `pnpm lint` → clean. Don't run the test: it needs real keys (Task 8).

### Task 8 (controller, with Lama): the real-key hand test on Haiku

Before the switch goes on anywhere (spec 8). It costs a few cents. Photos of people need their consent; the folder stays outside the repo.

- [ ] **Step 1: The folder.** `~/campuscart-photo-test-tips/` with, in name order so `-1` is each item's cover:
  - three clean items, one photo each, where no tip is expected (e.g. `clean-calculator.jpg`, `clean-textbook.jpg`, `clean-kettle.jpg`);
  - `dark.jpg` (taken in dim light), `blurry.jpg` (shaken), `cluttered.jpg` (the item on a busy desk), `cutoff.jpg` (part of the item out of frame);
  - `cover-1.jpg` (a weak cover: the back or a corner) and `cover-2.jpg` (the clear front of the same item);
  - `expected.json`: `{ "clean-calculator": { "tip": null }, "clean-textbook": { "tip": null }, "clean-kettle": { "tip": null }, "dark": { "tip": "dark" }, "blurry": { "tip": "blurry" }, "cluttered": { "tip": "cluttered" }, "cutoff": { "tip": "cut-off" }, "cover": { "tip": "better-cover" } }`.
- [ ] **Step 2: Run** (keys from `.env.local`):

```bash
VOSSIE_PHOTO_TEST=~/campuscart-photo-test-tips pnpm vitest run --config vitest.hand.config.mts
```

- [ ] **Step 3: Read `results.md`.** Pass when:
  - **The schema is accepted:** no Haiku row is `api-error` (a 400 for the schema shows as `api-error` on every row) or `bad-output` across the board. If it is, read the error (run one request in a scratch script printing the SDK's error message), fix the schema in `suggestionSchema`, and add the case to Task 1's schema test.
  - **Groq still answers:** its rows aren't all `api-error`. If Groq's strict mode refuses `anyOf`, stop and report to Lama. The fallback, only with his go-ahead: Groq gets the schema without `photoTip` (one helper in `groq.ts` that drops `properties.photoTip` and its `required` entry when present). `checkSuggestion` already accepts a reply without a tip.
  - **Haiku low tips sparingly:** no tip on at least two of the three clean items, and a tip for most of the four problem photos.
  - **The cover pair gets `2 better-cover`** from Haiku. Groq's tip, if any, is photo 1 and never better-cover. A `dropped:` cell means the model broke a rule and the check caught it: note how often.
  - **The words read well:** each at most 100 characters, about that photo, with no photo number in them.
- [ ] **Step 4: If Haiku tips on clean photos too often,** tighten the instruction's first photoTip line once (for example "Most photos need no tip: give null unless a buyer would struggle to see the item."), update Task 1's instruction test to match, and run Step 2 again. Record both runs.
- [ ] **Step 5: Record** the counts only (no photos, no file names of people) for the spec's section 10 ("While building stage F") and the progress entry: rows per run, tips given, tips matching expected, dropped tips, any schema change.

### Task 9 (controller): Docs, checks and review

- [ ] **Step 1: `CLAUDE.md`.** At the end of the photo-to-listing bullet (Code rules, the one starting "Photo-to-listing (`docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`)"), before "Off until GO-LIVE's photo-to-listing block is done.", add:

  "Photo tips (stage F, decision 97, round two spec 7): the reply's optional `photoTip` is null or one photo's `{ photo, kind, text }` (kinds in `PHOTO_TIP_KINDS`; `text` clipped to 100 characters at a word, never refused). `checkSuggestion` checks it against the photos the provider saw (`seen`; Groq is `COVER_ONLY` in `lib/data/ai.ts`, so its tip is about photo 1 and never `better-cover`) and drops a bad tip, never the suggestion; the schema's `photoTip` is an `anyOf` (never an enum beside a type array). The tip reaches the form only through the fill's form state, by the photo's address (`photoTipValues`, `shownPhotoTip`), is never saved with the listing, and goes with the next post. `PhotoTipHint` draws it on the server in the Photos fieldset; `better-cover`'s Make it the cover posts the photo move (`<address>:cover`), which keeps the fill's tags (`keepSuggestedTags`). `PhotoField` gets no tip code."

- [ ] **Step 2: The spec** (`docs/superpowers/specs/2026-11-04-ai-round-two-design.md`):
  - the status line gains: "Stage F (photo tips) planned 2026-11-04 (`docs/superpowers/plans/2026-11-04-ai-stage-f-photo-tips.md`) and built {date}, off behind `VOSSIE_LISTING_AI` with photo-to-listing."
  - a new `## 10. While planning and building` section after section 9, with `### While planning stage F` (planning decisions 1 to 11 above, one line each) and `### While building stage F` (Task 8's results and anything the build changed).
- [ ] **Step 3: `docs/reference/GO-LIVE.md`.** In the "Photo-to-listing (after the submission)" block, add one line: "- [ ] Photo tips (stage F) ride on this switch: read the hand test's Tip column (round two spec section 10) before switching on." No new logging in this stage.
- [ ] **Step 4: Checks.**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

  All clean. Then take `e2e-3200.lock` and:

```bash
pnpm build
grep -lE "groq|anthropic" .next/static/chunks/*.js
grep -l "serviceWorker.register" .next/static/chunks/*.js
pnpm e2e --project=selling-writes --no-deps tests/e2e/selling-writes.spec.ts
pnpm e2e tests/e2e/performance.spec.ts tests/e2e/cls.spec.ts tests/e2e/a11y.spec.ts -g "listings/new|listing form"
```

  Both greps print nothing. The selling-writes run passes every test, the new one included, with axe clean and the tip state's layout shift at or under 0.05 at 390. `/sell/listings/new`'s first-visit JavaScript is unchanged from before this stage (153,382 B brotli in stage A's entry; record the new number): any growth means client code crept in, so find it before going on. If the `-g` filter matches nothing in a file, run that file's listing-form test by its own title (read the file). Stop your own server by PID; remove the lock.
- [ ] **Step 5: Review.** One combined reviewer (memory: review cadence) reads the diff against spec section 7 and this plan: the Groq rule holds through `COVER_ONLY` and `seen`; no enum beside a type array; text clipped, not refused; nothing tip-related in `PhotoField.tsx` or any `"use client"` file (`git diff --stat` shows `components/sell/PhotoField.tsx` untouched); the tip never reaches `saveOwnListing` or anything but form state; `keepSuggestedTags` keeps no posted text but known keys; G's and H's lines (if merged first) untouched.
- [ ] **Step 6: `docs/PROGRESS.md`.** A dated entry "AI stage F: photo tips (decision 97)": what was built (one line per part: the reply's tip and its check, the door's Groq rule, the fake, the form's hint and Make it the cover, the hand test's column), the checks with numbers (unit count, the selling-writes count, axe, layout shift, `/sell/listings/new` bytes, the greps), Task 8's results in counts, and what's left (photo-to-listing's GO-LIVE block, which now covers photo tips).
- [ ] **Step 7:** Leave everything uncommitted and report to the controller's notes (or Lama) with the file list from `git status`.
