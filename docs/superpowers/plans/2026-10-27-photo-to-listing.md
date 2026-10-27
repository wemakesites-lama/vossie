# Photo-to-listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller's cover photo fills in the new listing form's empty fields through one server-side call (Groq's `qwen/qwen3.8-27b` first, Claude Haiku 5.5 as an optional fallback), with "Suggested" tags, a price hint from real CampusCart listings and a textbook Looking For line. It's built now and stays off for the submission.

**Architecture:** "Fill in from my photo" is one more submit button on the existing listing form (`intent=suggest`), handled by a new branch in `saveListingForm`, after photos are stored and before `checkListing`. `lib/data/listing-ai.ts` is the only thing the action calls. It loads one provider file at a time (`groq.ts`, `anthropic.ts`, `fake.ts`) by dynamic import, and checks every reply itself (`checkSuggestion`). The UI is Server Components plus the existing `PendingButton`; the reading state is CSS keyed off that button's pending state.

**Tech Stack:** Next.js 16.4 Server Actions, React 19.3, TypeScript, Tailwind 4.3 / `app/globals.css`, Vitest 5, Playwright + axe, Supabase (Postgres migration), `groq-sdk`, `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md` (Lama's answers in section 12).

---

## Ground rules for this build

- **Commits:** implementers leave their work uncommitted. The controller checks each task, and commits only with Lama's go-ahead, staging only that task's files (memory: controller commits, shared file edits). No `git` state-changing command without that go-ahead.
- **Tests:** speed first. Keep the tests that guard a risk (written below); don't add more.
- **Stop your own server only:** stop a dev server by its PID or port, never `pkill` by name.
- **Next.js:** read `node_modules/next/dist/docs/` before using a Next API you haven't used in this repo.
- **Never** read the API keys at module scope or during a build; never import a provider SDK from client code.

## Changes to the spec made while planning (record them in the spec's section 3 in Task 12)

1. **No 1024px resize (decision 3).** The repo has no server-side image library, and adding one (`sharp`) for this isn't worth it. The stored cover is already at most 1600px (the browser shrinks it) and stripped. Groq counts an image as 2,048 tokens whatever its size, so it costs nothing there; Haiku pays a little more per call.
2. **The schema has no `edition` field (decision 9).** The instruction asks for a textbook's edition inside its title instead.
3. **The price hint reads available listings only (decision 8)** through `searchListings` (browse's own `listingMatches`, which matches available listings only), queried by the suggested category and the title's first two search words. Sold listings aren't matched.
4. **The Looking For line shows only when the model read a module code (decision 15),** and matches open requests at the seller's campus that contain that code, through browse's `matchScore` and `queryWords`. A title alone is too loose to count students by.
5. **The daily count is a counter like the sign-in code sends:** per account, kept at most 24 hours, deleted with the account (a cascade), not in the data download. The database counts by UTC hour, so its window is between 23 and 24 hours.
6. **Notices are announced (`role="status"`), not focused,** as every selling notice is today.
7. **`PendingButton` gains `name` and `value`**, and is pending only when its own button sent the form (`useFormStatus().data`), so Save never shows "Reading your photo…".
8. **`VOSSIE_GROQ_FORMAT=json_object`** switches Groq from strict `json_schema` to `json_object`, if the hand check in Task 4 shows strict mode refuses an image.

## File structure

| File | Responsibility |
|---|---|
| `lib/selling/ai-config.ts` | New. The settings: whether the feature is on, the provider order, which providers have keys. Plain module, no SDK. |
| `lib/selling/suggest.ts` | New. Pure: the instruction, the JSON schema, `checkSuggestion`, `mergeSuggestion`, the failure kinds. |
| `lib/data/listing-ai/types.ts` | New. The provider contract. |
| `lib/data/listing-ai/groq.ts` | New, server-only. Groq's `qwen/qwen3.8-27b`. |
| `lib/data/listing-ai/anthropic.ts` | New, server-only. Claude Haiku 5.5. |
| `lib/data/listing-ai/fake.ts` | New. A fixed textbook reply, for e2e and the sample demo. Refused on Supabase. |
| `lib/data/listing-ai.ts` | New, server-only. `readCoverPhoto`: provider order, fallback, check, logging. |
| `lib/data/photo-fills.ts` | New. `reservePhotoFill`: the daily count (sample store), dispatching to its twin. |
| `lib/data/supabase/photo-fills.ts` | New. The Supabase twin. |
| `supabase/migrations/20261027120000_photo_fills.sql` | New. `private.photo_fills` and `public.reserve_photo_fill`. |
| `lib/selling/price-hint.ts` | New. The price hint text. |
| `lib/selling/looking-for-count.ts` | New. Open requests at a campus naming a module code. |
| `lib/selling/notices.ts` | Modify. Five notices. |
| `lib/selling/listing-actions.ts` | Modify. The `intent=suggest` branch. |
| `components/kit/PendingButton.tsx` | Modify. `name`, `value`, pending only for its own press. |
| `components/sell/fields.tsx` | Modify. An optional `tag` on each field; `placeholder=" "` on text fields. |
| `components/sell/PhotoStart.tsx` | New. The navy card around the photo field. |
| `components/sell/ListingFormView.tsx` | Modify. The card, divider, notice, tags, hint, Looking For line. |
| `components/sell/ListingForm.tsx` | Modify. Reads the notice, the hint and the count, and passes them down. |
| `app/globals.css` | Modify. `.photo-start*`. |
| `app/privacy/page.tsx` | Modify. The provider line, shown while the feature is on. |
| `playwright.config.ts` | Modify. The e2e server runs with the fake provider. |
| `tests/e2e/selling-writes.spec.ts` | Modify. One write test, axe on two states. |
| `docs/reference/GO-LIVE.md`, `CLAUDE.md`, `docs/PROGRESS.md`, the spec | Modify (Task 12). |

---

### Task 1: The settings and the dependencies

**Files:**
- Create: `lib/selling/ai-config.ts`
- Test: `lib/selling/ai-config.test.ts`
- Modify: `package.json` (through pnpm)

- [ ] **Step 1: Add the two SDKs, pinned**

```bash
pnpm add --save-exact groq-sdk @anthropic-ai/sdk
```

Expected: both appear under `dependencies` with exact versions. Then read their types once, so the code in Task 4 matches what's installed: `node_modules/groq-sdk/resources/chat/completions.d.ts` (look for `response_format` and `ChatCompletionContentPartImage`) and `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` (look for `output_config`). If a name differs from Task 4's code, use the installed name.

- [ ] **Step 2: Write the failing test**

```ts
// lib/selling/ai-config.test.ts
import { describe, expect, it } from "vitest";
import { listingAiOn, listingAiProviders, providerHasKey } from "./ai-config";

describe("photo-to-listing settings (spec decisions 11 and 14)", () => {
  it("lists the providers in order, Groq alone when unset, ignoring unknown and repeated names", () => {
    expect(listingAiProviders({})).toEqual(["groq"]);
    expect(listingAiProviders({ VOSSIE_LISTING_AI_PROVIDERS: " groq, anthropic ,groq,openai" })).toEqual(["groq", "anthropic"]);
  });

  it("never uses the fake on Supabase", () => {
    expect(listingAiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "fake" })).toEqual(["fake"]);
    expect(listingAiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "fake,groq", VOSSIE_BACKEND: "supabase" })).toEqual(["groq"]);
  });

  it("is on only when switched on and a listed provider has its key (or is the fake)", () => {
    expect(listingAiOn({ GROQ_API_KEY: "k" })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1" })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", GROQ_API_KEY: " " })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", GROQ_API_KEY: "k" })).toBe(true);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", VOSSIE_LISTING_AI_PROVIDERS: "anthropic", GROQ_API_KEY: "k" })).toBe(false);
    expect(listingAiOn({ VOSSIE_LISTING_AI: "1", VOSSIE_LISTING_AI_PROVIDERS: "fake" })).toBe(true);
  });

  it("knows each provider's key", () => {
    expect(providerHasKey("anthropic", { ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(providerHasKey("groq", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(providerHasKey("fake", {})).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm test lib/selling/ai-config.test.ts`
Expected: FAIL, cannot resolve `./ai-config`.

- [ ] **Step 4: Write the module**

```ts
// lib/selling/ai-config.ts
import { onSupabase } from "@/lib/backend";

// Photo-to-listing's settings (spec decisions 11 and 14). A plain module with no SDK, so a Server Component can ask
// whether to show the button without loading a provider. Read on each call, never kept at module scope.

type Env = Readonly<Record<string, string | undefined>>;

export type ProviderName = "groq" | "anthropic" | "fake";

const KNOWN: readonly ProviderName[] = ["groq", "anthropic", "fake"];
const KEYS: Readonly<Record<Exclude<ProviderName, "fake">, string>> = {
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** VOSSIE_LISTING_AI_PROVIDERS in order ("groq" when unset). The fake is never used on Supabase. */
export function listingAiProviders(env: Env = process.env): ProviderName[] {
  const listed = (env.VOSSIE_LISTING_AI_PROVIDERS ?? "groq").split(",").map((name) => name.trim());
  const known = [...new Set(listed)].filter((name): name is ProviderName => (KNOWN as readonly string[]).includes(name));
  return onSupabase(env) ? known.filter((name) => name !== "fake") : known;
}

export function providerHasKey(name: ProviderName, env: Env = process.env): boolean {
  return name === "fake" || Boolean(env[KEYS[name]]?.trim());
}

/** The button shows only when VOSSIE_LISTING_AI is "1" and a listed provider can answer (decision 14). */
export function listingAiOn(env: Env = process.env): boolean {
  return env.VOSSIE_LISTING_AI === "1" && listingAiProviders(env).some((name) => providerHasKey(name, env));
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `pnpm test lib/selling/ai-config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Checkpoint.** Leave uncommitted; the controller reviews and commits with Lama's go-ahead (`package.json`, `pnpm-lock.yaml`, the two files).

---

### Task 2: The instruction, the schema, the check and the merge

**Files:**
- Create: `lib/selling/suggest.ts`
- Test: `lib/selling/suggest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/selling/suggest.test.ts`
Expected: FAIL, cannot resolve `./suggest`.

- [ ] **Step 3: Write the module**

```ts
// lib/selling/suggest.ts
import { characterCount, cleanText } from "@/lib/messaging/rules";
import { ALT_MAX, cleanLine, CONDITION_CHOICES, DESCRIPTION_MAX, TITLE_MAX } from "./rules";

// Photo-to-listing's words and rules (spec decisions 5 to 10), the same for every provider. Pure, so the check and the
// merge are tested without a provider, and the action and the providers share one schema.

/** Why there's no suggestion. Every kind but "person" shows the "couldn't read" notice (spec 2.4). */
export type SuggestFailure =
  | "timeout"
  | "rate-limited"
  | "refusal"
  | "bad-output"
  | "low-confidence"
  | "person"
  | "model-gone"
  | "api-error";

/** A checked suggestion: text already cleaned and cut to the form's limits. */
export type Suggestion = {
  title: string;
  categorySlug: string;
  condition: string;
  description: string;
  alt: string;
  /** Upper case, no spaces ("FAC1501"), or null when the photo isn't a textbook or shows none. */
  moduleCode: string | null;
};

const CONDITIONS = CONDITION_CHOICES.map((choice) => choice.value);
const CONFIDENCE = ["high", "medium", "low"];
const MODULE_CODE = /^[A-Z]{2,5}\d{3,4}[A-Z]?$/;

export const SUGGESTION_INSTRUCTION = [
  "You help a university student in South Africa list something for sale on CampusCart, a campus marketplace.",
  "Look at the photo and describe the item for its listing, in plain South African English.",
  "title: what it is, up to 70 characters, brand and model where you can read them. For a textbook, its title and edition.",
  "categorySlug: the one category that fits best.",
  "condition: how worn it looks (new, like-new, good or fair).",
  "description: two or three short sentences a buyer would want, from what you can see. Never guess a price.",
  "alt: one sentence describing the photo for someone who can't see it.",
  "isTextbook and moduleCode: the module code printed on a textbook's cover or spine (such as FAC1501), else null.",
  "personIsSubject: true when a person, not an item, is the main subject. Never describe a person.",
  "confidence: low when you can't tell what the item is.",
].join("\n");

/** The JSON schema every provider is asked for (spec decision 9), with the form's own categories. */
export function suggestionSchema(categorySlugs: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "categorySlug",
      "condition",
      "description",
      "alt",
      "isTextbook",
      "moduleCode",
      "personIsSubject",
      "confidence",
    ],
    properties: {
      title: { type: "string" },
      categorySlug: { type: "string", enum: [...categorySlugs] },
      condition: { type: "string", enum: CONDITIONS },
      description: { type: "string" },
      alt: { type: "string" },
      isTextbook: { type: "boolean" },
      moduleCode: { type: ["string", "null"] },
      personIsSubject: { type: "boolean" },
      confidence: { type: "string", enum: CONFIDENCE },
    },
  } as const;
}

const FIELDS = Object.keys(suggestionSchema([]).properties).sort().join(",");

/** At most `max` characters, as the form counts them. */
function cutTo(text: string, max: number): string {
  return characterCount(text) <= max ? text : [...text].slice(0, max).join("").trimEnd();
}

function moduleCodeOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/\s+/g, "");
  return MODULE_CODE.test(code) ? code : null;
}

/**
 * Our own check of a provider's reply (spec decision 10), whatever the provider promised: the exact fields with the
 * right types, a category and condition the form offers, then a person or an unsure read. Returns the cleaned
 * suggestion, or why there's none.
 */
export function checkSuggestion(text: string, categorySlugs: readonly string[]): Suggestion | SuggestFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "bad-output";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "bad-output";
  const reply = parsed as Record<string, unknown>;
  if (Object.keys(reply).sort().join(",") !== FIELDS) return "bad-output";
  const strings = ["title", "categorySlug", "condition", "description", "alt", "confidence"];
  if (strings.some((key) => typeof reply[key] !== "string")) return "bad-output";
  if (typeof reply.isTextbook !== "boolean" || typeof reply.personIsSubject !== "boolean") return "bad-output";
  if (reply.moduleCode !== null && typeof reply.moduleCode !== "string") return "bad-output";
  if (reply.personIsSubject) return "person";
  if (reply.confidence === "low") return "low-confidence";
  const categorySlug = reply.categorySlug as string;
  const condition = reply.condition as string;
  if (!categorySlugs.includes(categorySlug) || !CONDITIONS.includes(condition as never)) return "bad-output";
  if (!CONFIDENCE.includes(reply.confidence as string)) return "bad-output";
  const title = cutTo(cleanLine(reply.title as string).trim(), TITLE_MAX);
  if (!title) return "bad-output";
  return {
    title,
    categorySlug,
    condition,
    description: cutTo(cleanText(reply.description as string).trim(), DESCRIPTION_MAX),
    alt: cutTo(cleanLine(reply.alt as string).trim(), ALT_MAX),
    moduleCode: reply.isTextbook ? moduleCodeOf(reply.moduleCode) : null,
  };
}

/**
 * Fills the form's empty fields from a suggestion (spec decisions 5 and 6), never a typed one, and lists the fields it
 * filled, for the "Suggested" tags. A service gets no condition; the cover's description is filled only with a cover.
 */
export function mergeSuggestion(
  values: Readonly<Record<string, string>>,
  suggestion: Suggestion,
  coverSrc: string | null,
): { values: Record<string, string>; suggested: string[] } {
  const next: Record<string, string> = { ...values };
  const suggested: string[] = [];
  const fill = (key: string, value: string) => {
    if (value && !(next[key] ?? "").trim()) {
      next[key] = value;
      suggested.push(key);
    }
  };
  fill("title", suggestion.title);
  fill("category", suggestion.categorySlug);
  if (next.kind !== "service") fill("condition", suggestion.condition);
  const description = suggestion.moduleCode
    ? cutTo(`Module ${suggestion.moduleCode}. ${suggestion.description}`, DESCRIPTION_MAX)
    : suggestion.description;
  fill("description", description);
  if (coverSrc) fill(`alt:${coverSrc}`, suggestion.alt);
  return { values: next, suggested };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm test lib/selling/suggest.test.ts`
Expected: PASS (8 tests). If `cleanLine` keeps a leading or trailing space, the `.trim()` already handles it.

- [ ] **Step 5: Checkpoint.** Leave uncommitted for the controller.

---

### Task 3: The provider contract and the fake

**Files:**
- Create: `lib/data/listing-ai/types.ts`, `lib/data/listing-ai/fake.ts`

No test of its own: the fake is exercised by Task 5's tests and the e2e test.

- [ ] **Step 1: Write the contract**

```ts
// lib/data/listing-ai/types.ts
import type { PhotoType } from "@/lib/photos/rules";

// The one shape every photo-to-listing provider answers (spec decision 9). A provider turns this into one request and
// hands back the reply's raw text, or why it couldn't answer; lib/data/listing-ai.ts checks the text.

export type ProviderRequest = {
  image: { type: PhotoType; base64: string };
  instruction: string;
  schema: Readonly<Record<string, unknown>>;
};

/** Why a provider couldn't answer. The first four send the photo to the next provider (decision 11). */
export type ProviderFailure = "timeout" | "rate-limited" | "model-gone" | "api-error" | "refusal" | "bad-output";

export type ProviderReply = { ok: true; text: string } | { ok: false; failure: ProviderFailure };

/** Each provider file exports one of these as `read`. */
export type ReadPhoto = (request: ProviderRequest) => Promise<ProviderReply>;

/** A provider answers within this, or it's a timeout. */
export const PROVIDER_TIMEOUT_MS = 10_000;
```

Check `PhotoType` is exported from `lib/photos/rules.ts` (`PHOTO_TYPES: readonly PhotoType[]` uses it). If it's declared elsewhere, import it from there.

- [ ] **Step 2: Write the fake**

```ts
// lib/data/listing-ai/fake.ts
import type { ReadPhoto } from "./types";

// A fixed reply for the e2e tests and the sample demo (spec decision 13): a textbook with a module code, so the tags,
// the price hint and the Looking For line can all show. listingAiProviders never lists it on Supabase.

export const FAKE_REPLY = {
  title: "Financial Accounting, 3rd edition",
  categorySlug: "textbooks-notes",
  condition: "good",
  description: "A clean copy with a few highlighted pages. No missing pages.",
  alt: "The cover of Financial Accounting, 3rd edition",
  isTextbook: true,
  moduleCode: "FAC1501",
  personIsSubject: false,
  confidence: "high",
} as const;

export const read: ReadPhoto = async () => ({ ok: true, text: JSON.stringify(FAKE_REPLY) });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Checkpoint.** Leave uncommitted for the controller.

---

### Task 4: The Groq and Haiku providers, and the hand check

**Files:**
- Create: `lib/data/listing-ai/groq.ts`, `lib/data/listing-ai/anthropic.ts`

These wrap SDK calls; the logic that matters (fallback, check) is tested in Task 5 with these mocked. The hand check below confirms the Groq request with a real key.

- [ ] **Step 1: Write the Groq provider**

```ts
// lib/data/listing-ai/groq.ts
import "server-only";
import Groq from "groq-sdk";
import { PROVIDER_TIMEOUT_MS, type ProviderFailure, type ReadPhoto } from "./types";

// Groq's qwen/qwen3.8-27b on the free tier (spec decision 9). A preview model Groq may withdraw: a 404 is "model-gone",
// and the model is changed here. The key is read on first use, never at module scope.

export const GROQ_MODEL = "qwen/qwen3.8-27b";

let client: Groq | null = null;
const groq = () => (client ??= new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 0 }));

function failureOf(error: unknown): ProviderFailure {
  if (error instanceof Groq.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Groq.RateLimitError) return "rate-limited";
  if (error instanceof Groq.NotFoundError) return "model-gone";
  // Strict mode's own refusal of a reply that doesn't fit the schema: an answer, so no second provider (decision 11).
  if (error instanceof Groq.BadRequestError && JSON.stringify(error.error ?? "").includes("json_validate_failed")) {
    return "bad-output";
  }
  return "api-error";
}

export const read: ReadPhoto = async ({ image, instruction, schema }) => {
  // VOSSIE_GROQ_FORMAT=json_object if strict json_schema turns out to refuse an image (plan change 8).
  const strict = process.env.VOSSIE_GROQ_FORMAT !== "json_object";
  try {
    const completion = await groq().chat.completions.create({
      model: GROQ_MODEL,
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: strict ? instruction : `${instruction}\nAnswer with JSON only.` },
            { type: "image_url", image_url: { url: `data:${image.type};base64,${image.base64}` } },
          ],
        },
      ],
      response_format: strict
        ? { type: "json_schema", json_schema: { name: "listing_suggestion", schema: { ...schema }, strict: true } }
        : { type: "json_object" },
    });
    const text = completion.choices[0]?.message?.content;
    return text ? { ok: true, text } : { ok: false, failure: "api-error" };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
};
```

- [ ] **Step 2: Write the Haiku provider**

```ts
// lib/data/listing-ai/anthropic.ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER_TIMEOUT_MS, type ProviderFailure, type ReadPhoto } from "./types";

// Claude Haiku 5.5, the fallback (spec decision 9; listed only once Lama adds it, Q6). Structured outputs, effort low.

export const HAIKU_MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;
const anthropic = () =>
  (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 0 }));

function failureOf(error: unknown): ProviderFailure {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.RateLimitError) return "rate-limited";
  if (error instanceof Anthropic.NotFoundError) return "model-gone";
  return "api-error";
}

export const read: ReadPhoto = async ({ image, instruction, schema }) => {
  try {
    const message = await anthropic().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      output_config: { effort: "low", format: { type: "json_schema", schema: { ...schema } } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
            { type: "text", text: instruction },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal") return { ok: false, failure: "refusal" };
    const text = message.content.find((block) => block.type === "text");
    return text && text.type === "text" ? { ok: true, text: text.text } : { ok: false, failure: "api-error" };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
};
```

- [ ] **Step 3: Typecheck against the installed SDKs**

Run: `pnpm typecheck`
Expected: no errors. If a type name differs (for example the content part or `output_config` types), fix it to the installed SDK's names (Task 1, Step 1); don't change the behaviour.

- [ ] **Step 4: The hand check, with Lama's Groq key (not in CI)**

Lama creates a free Groq key and turns on Zero Data Retention in Groq's Data Controls first. The provider imports `server-only`, so the check runs through the dev server, not a script: set `VOSSIE_LISTING_AI=1`, `VOSSIE_LISTING_AI_PROVIDERS=groq` and `GROQ_API_KEY` in `.env.local`, start `pnpm dev --port 3100`, and after Task 8 press "Fill in from my photo" on 3 photos (a textbook, a calculator, a hoodie). Expected: the fields fill. If every press gives "We couldn't read that photo" and the server log shows `api-error` from groq, add `VOSSIE_GROQ_FORMAT=json_object` and try again. Write the outcome in the spec's section 3 (Task 12). Remove the key from `.env.local` afterwards.

- [ ] **Step 5: Checkpoint.** Leave uncommitted for the controller.

---

### Task 5: `readCoverPhoto`: order, fallback, check and logging

**Files:**
- Create: `lib/data/listing-ai.ts`
- Test: `lib/data/listing-ai.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/data/listing-ai.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderReply } from "./listing-ai/types";

vi.mock("server-only", () => ({}));
const groq = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
const anthropic = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
vi.mock("./listing-ai/groq", () => ({ read: groq }));
vi.mock("./listing-ai/anthropic", () => ({ read: anthropic }));

import { FAKE_REPLY } from "./listing-ai/fake";
import { readCoverPhoto } from "./listing-ai";

const PHOTO = { type: "image/jpeg" as const, bytes: new Uint8Array([1, 2, 3]) };
const SLUGS = ["textbooks-notes", "tech"];
const good: ProviderReply = { ok: true, text: JSON.stringify(FAKE_REPLY) };

beforeEach(() => {
  vi.stubEnv("VOSSIE_LISTING_AI_PROVIDERS", "groq,anthropic");
  vi.stubEnv("GROQ_API_KEY", "g");
  vi.stubEnv("ANTHROPIC_API_KEY", "a");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  groq.mockReset();
  anthropic.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("readCoverPhoto (spec decisions 9 to 11)", () => {
  it("returns the first provider's checked suggestion, sending the photo as base64 with the form's categories", async () => {
    groq.mockResolvedValue(good);
    expect(await readCoverPhoto(PHOTO, SLUGS)).toMatchObject({ ok: true, suggestion: { moduleCode: "FAC1501" } });
    expect(groq).toHaveBeenCalledWith(
      expect.objectContaining({ image: { type: "image/jpeg", base64: "AQID" } }),
    );
    expect(anthropic).not.toHaveBeenCalled();
  });

  it("moves on only when the first couldn't answer", async () => {
    for (const failure of ["timeout", "rate-limited", "model-gone", "api-error"] as const) {
      groq.mockResolvedValueOnce({ ok: false, failure });
      anthropic.mockResolvedValueOnce(good);
      expect(await readCoverPhoto(PHOTO, SLUGS)).toMatchObject({ ok: true });
    }
    expect(anthropic).toHaveBeenCalledTimes(4);
  });

  it("never sends a refusal, a bad reply or a person to a second provider", async () => {
    groq.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "refusal" });
    groq.mockResolvedValueOnce({ ok: true, text: "{}" });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "bad-output" });
    groq.mockResolvedValueOnce({ ok: true, text: JSON.stringify({ ...FAKE_REPLY, personIsSubject: true }) });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "person" });
    expect(anthropic).not.toHaveBeenCalled();
  });

  it("skips a provider without its key, and reports the last failure when none can answer", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    anthropic.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "rate-limited" });
    expect(groq).not.toHaveBeenCalled();
  });

  it("logs a failure by provider and kind only, never the photo or the text", async () => {
    groq.mockResolvedValueOnce({ ok: true, text: "Financial Accounting" });
    await readCoverPhoto(PHOTO, SLUGS);
    expect(console.warn).toHaveBeenCalledWith("[vossie] photo-to-listing: groq bad-output");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/data/listing-ai.test.ts`
Expected: FAIL, cannot resolve `./listing-ai`.

- [ ] **Step 3: Write the module**

```ts
// lib/data/listing-ai.ts
import "server-only";
import type { PhotoType } from "@/lib/photos/rules";
import { listingAiProviders, providerHasKey, type ProviderName } from "@/lib/selling/ai-config";
import {
  checkSuggestion,
  SUGGESTION_INSTRUCTION,
  suggestionSchema,
  type Suggestion,
  type SuggestFailure,
} from "@/lib/selling/suggest";
import type { ProviderFailure, ReadPhoto } from "./listing-ai/types";

// The only door to photo-to-listing's providers (spec decisions 9 to 11). Each provider file is loaded only when it's
// tried, so an SDK is never in a page's code. Failures are logged by provider and kind only: never the photo or text.

const LOAD: Readonly<Record<ProviderName, () => Promise<{ read: ReadPhoto }>>> = {
  groq: () => import("./listing-ai/groq"),
  anthropic: () => import("./listing-ai/anthropic"),
  fake: () => import("./listing-ai/fake"),
};

/** These mean the provider couldn't answer, so the next one is tried (decision 11). */
const MOVE_ON: ReadonlySet<ProviderFailure> = new Set(["timeout", "rate-limited", "model-gone", "api-error"]);

export type CoverReading = { ok: true; suggestion: Suggestion } | { ok: false; failure: SuggestFailure };

function logFailure(provider: ProviderName, failure: SuggestFailure): void {
  console.warn(`[vossie] photo-to-listing: ${provider} ${failure}`);
}

export async function readCoverPhoto(
  photo: { type: PhotoType; bytes: Uint8Array },
  categorySlugs: readonly string[],
): Promise<CoverReading> {
  const request = {
    image: { type: photo.type, base64: Buffer.from(photo.bytes).toString("base64") },
    instruction: SUGGESTION_INSTRUCTION,
    schema: suggestionSchema(categorySlugs),
  };
  let last: SuggestFailure = "api-error";
  for (const name of listingAiProviders()) {
    if (!providerHasKey(name)) continue;
    const reply = await (await LOAD[name]()).read(request);
    if (!reply.ok) {
      logFailure(name, reply.failure);
      if (MOVE_ON.has(reply.failure)) {
        last = reply.failure;
        continue;
      }
      return { ok: false, failure: reply.failure };
    }
    const checked = checkSuggestion(reply.text, categorySlugs);
    if (typeof checked === "string") {
      logFailure(name, checked);
      return { ok: false, failure: checked };
    }
    return { ok: true, suggestion: checked };
  }
  return { ok: false, failure: last };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm test lib/data/listing-ai.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint.** Leave uncommitted for the controller.

---

### Task 6: The daily count (sample store, Supabase twin, migration)

**Files:**
- Modify: `lib/data/store.ts` (the `SampleStore` type near line 57, the initial store near line 141, `STORE_VERSION` at line 110)
- Modify: `lib/data/accounts.ts:351` (forget the count with the account)
- Create: `lib/data/photo-fills.ts`, `lib/data/supabase/photo-fills.ts`, `supabase/migrations/20261027120000_photo_fills.sql`
- Test: `lib/data/photo-fills.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/data/photo-fills.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { reservePhotoFill } from "./photo-fills";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-27T08:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;

beforeEach(() => resetSampleStore());

describe("reservePhotoFill (spec decision 12)", () => {
  it("allows up to the limit in any 24 hours, then refuses without counting", async () => {
    for (let i = 0; i < 3; i += 1) expect(await reservePhotoFill("acc-1", later(i), 3)).toBe(true);
    expect(await reservePhotoFill("acc-1", later(10), 3)).toBe(false);
    expect(sampleStore().photoFills.get("acc-1")).toHaveLength(3);
    expect(await reservePhotoFill("acc-2", later(10), 3)).toBe(true);
  });

  it("forgets presses more than 24 hours old", async () => {
    for (let i = 0; i < 3; i += 1) await reservePhotoFill("acc-1", later(i), 3);
    expect(await reservePhotoFill("acc-1", later(24 * HOUR + 1000), 3)).toBe(true);
    expect(sampleStore().photoFills.get("acc-1")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/data/photo-fills.test.ts`
Expected: FAIL, cannot resolve `./photo-fills`.

- [ ] **Step 3: Add the store's map**

In `lib/data/store.ts`: add to the `SampleStore` type, after `codeSends`:

```ts
  /** Photo-to-listing presses per account, as ISO times in the last 24 hours (photo-to-listing spec decision 12). */
  photoFills: Map<string, string[]>;
```

add `photoFills: new Map(),` after `codeSends: new Map(),` in the initial store, and change `export const STORE_VERSION = 14;` to `15`.

In `lib/data/accounts.ts`, after `store.codeSends.delete(account.email);`:

```ts
  store.photoFills.delete(account.id);
```

- [ ] **Step 4: Write the sample function**

```ts
// lib/data/photo-fills.ts
import { onSupabase } from "@/lib/backend";
import { DAY_MS } from "@/lib/messaging/rules";
import { sampleStore } from "./store";

// The daily count of photo-to-listing presses per account (spec decision 12): a counter like the sign-in code sends,
// kept 24 hours, gone with the account, not in the data download (plan change 5).

const supabase = () => import("./supabase/photo-fills");

/** Counts one press for `accountId` and says yes while under `limit` in the 24 hours before `now`; else counts nothing. */
export async function reservePhotoFill(accountId: string, now: Date, limit: number): Promise<boolean> {
  if (onSupabase()) return (await supabase()).reservePhotoFill(accountId, now, limit);
  const store = sampleStore();
  const since = now.getTime() - DAY_MS;
  const recent = (store.photoFills.get(accountId) ?? []).filter((at) => Date.parse(at) > since);
  if (recent.length >= limit) {
    store.photoFills.set(accountId, recent);
    return false;
  }
  store.photoFills.set(accountId, [...recent, now.toISOString()]);
  return true;
}
```

Check `DAY_MS` is exported from `lib/messaging/rules.ts` (the message limits import it from `./rules`). If not, use `24 * 60 * 60 * 1000`.

- [ ] **Step 5: Run it to see it pass**

Run: `pnpm test lib/data/photo-fills.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the migration**

```sql
-- supabase/migrations/20261027120000_photo_fills.sql
-- Photo-to-listing's daily count (photo-to-listing spec decision 12; plan Task 6, change 5).
-- - private.photo_fills: presses per account per UTC hour, like private.code_sends. Rows older than 24 hours are
--   deleted by the next press; the rest go with the profile (on delete cascade). Not in the data download: a counter.
-- - public.reserve_photo_fill: counts one press and says yes while under the limit in the last 24 hours (to the hour),
--   else counts nothing. An advisory lock per account makes two presses at once count one after the other.
--   The server's only (the service role); the account id comes from the session in the action.

create table private.photo_fills (
  account_id uuid not null references public.profiles (id) on delete cascade,
  hour timestamptz not null,
  n int not null check (n >= 1),
  primary key (account_id, hour)
);

alter table private.photo_fills enable row level security;
revoke all on table private.photo_fills from public, anon, authenticated;
grant all on table private.photo_fills to service_role;

create function private.reserve_photo_fill(p_account uuid, filled_at timestamptz, max_fills int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  used int;
begin
  if p_account is null or max_fills is null or max_fills < 1 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('photo_fill:' || p_account::text));
  delete from private.photo_fills
  where account_id = p_account and hour <= pg_catalog.date_trunc('hour', filled_at - interval '24 hours', 'UTC');
  select coalesce(sum(n), 0) into used from private.photo_fills where account_id = p_account;
  if used >= max_fills then
    return false;
  end if;
  insert into private.photo_fills as f (account_id, hour, n)
  values (p_account, pg_catalog.date_trunc('hour', filled_at, 'UTC'), 1)
  on conflict on constraint photo_fills_pkey do update set n = f.n + 1;
  return true;
end;
$$;

revoke all on function private.reserve_photo_fill(uuid, timestamptz, int) from public, anon, authenticated, service_role;

create function public.reserve_photo_fill(p_account_id uuid, p_max_fills integer)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_photo_fill(p_account_id, now(), p_max_fills);
$$;

revoke all on function public.reserve_photo_fill(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_photo_fill(uuid, integer) to service_role;
```

- [ ] **Step 7: Apply it locally and regenerate the types**

Run (local stack running): `supabase db reset`, then `pnpm db:types`
Expected: the reset succeeds, and `lib/supabase/database.types.ts` gains `reserve_photo_fill` under `Functions`.

- [ ] **Step 8: Write the Supabase twin**

```ts
// lib/data/supabase/photo-fills.ts
import "server-only";
import type * as Sample from "../photo-fills";
import { forServer } from "./clients";

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** One press for `accountId`, counted per UTC hour on the database's clock (plan change 5). */
export const reservePhotoFill: typeof Sample.reservePhotoFill = async (accountId, _now, limit) => {
  const { data, error } = await forServer().rpc("reserve_photo_fill", { p_account_id: accountId, p_max_fills: limit });
  if (error) failed("reserve_photo_fill", error);
  return data === true;
};
```

Check the other twins' first lines (for example `lib/data/supabase/sign-in.ts`) and copy their `server-only` and `Sample` import style exactly.

- [ ] **Step 9: Run the unit tests and the database tests**

Run: `pnpm test lib/data` then `supabase test db` and `pnpm test:db`
Expected: all pass (the store tests may check the store's keys: if `lib/data/store.test.ts` lists them, add `photoFills`).

- [ ] **Step 10: Checkpoint.** Leave uncommitted for the controller. The migration is pushed to the live project only with the go-live steps (Task 12), never by the implementer.

---

### Task 7: The price hint and the Looking For count

**Files:**
- Create: `lib/selling/price-hint.ts`, `lib/selling/looking-for-count.ts`
- Test: `lib/selling/price-hint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/selling/price-hint.test.ts
import { describe, expect, it } from "vitest";
import { hintQuery, priceHintText } from "./price-hint";

const listing = (priceZar: number | null, priceIsFrom = false) => ({ priceZar, priceIsFrom });

describe("the price hint (spec decision 8, plan change 3)", () => {
  it("asks browse for the title's first two words in the suggested category", () => {
    expect(hintQuery("Casio scientific calculator", "tech", "midrand")).toMatchObject({
      q: "casio scientific",
      category: "tech",
      campus: "midrand",
    });
  });

  it("gives the middle half's range once 3 or more priced listings match", () => {
    const prices = [100, 180, 200, 220, 260, 900].map((price) => listing(price));
    expect(priceHintText(prices)).toBe("Similar on CampusCart: R180 to R260 (6 listings)");
  });

  it("leaves out free, swap-only and starting prices, and says nothing under 3", () => {
    expect(priceHintText([listing(0), listing(null), listing(150, true), listing(200), listing(250)])).toBeNull();
    expect(priceHintText([listing(200), listing(200), listing(200)])).toBe("Similar on CampusCart: R200 (3 listings)");
  });
});
```

The middle half of [100, 180, 200, 220, 260, 900] is the values from the 25th to the 75th percentile by position: indices `Math.floor(6 / 4) = 1` to `Math.ceil(6 * 3 / 4) - 1 = 4`, so R180 to R260.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test lib/selling/price-hint.test.ts`
Expected: FAIL, cannot resolve `./price-hint`.

- [ ] **Step 3: Write the price hint**

```ts
// lib/selling/price-hint.ts
import { searchWords } from "@/lib/browse/search";
import { formatRand } from "@/lib/format";
import type { CampusChoice, Listing, SearchQuery } from "@/lib/types";

// The price hint under the price field (spec 2.3 and decision 8): from real CampusCart listings found by browse's own
// search, never from the model. Shown only with 3 or more priced matches.

const MIN_MATCHES = 3;

/** Browse's query for a suggestion: the title's first two search words, in its category, at a campus. */
export function hintQuery(title: string, categorySlug: string, campus: CampusChoice): SearchQuery {
  return {
    q: searchWords(title).slice(0, 2).join(" ") || null,
    category: categorySlug,
    campus,
    price: null,
    pay: null,
    deals: null,
    sort: "match",
  };
}

/** "Similar on CampusCart: R180 to R260 (5 listings)", or null with fewer than 3 priced matches. */
export function priceHintText(listings: readonly Pick<Listing, "priceZar" | "priceIsFrom">[]): string | null {
  const prices = listings
    .filter((listing) => !listing.priceIsFrom && listing.priceZar !== null && listing.priceZar > 0)
    .map((listing) => listing.priceZar as number)
    .sort((a, b) => a - b);
  if (prices.length < MIN_MATCHES) return null;
  const low = prices[Math.floor(prices.length / 4)];
  const high = prices[Math.ceil((prices.length * 3) / 4) - 1];
  const range = low === high ? formatRand(low) : `${formatRand(low)} to ${formatRand(high)}`;
  return `Similar on CampusCart: ${range} (${prices.length} listings)`;
}
```

Check `lib/format.ts` for the rand formatter's real name (`grep -n "export function" lib/format.ts`). It must print `R180` for 180 (no space, no cents); if the existing one prints differently, write the amount as `` `R${n}` `` instead. Check `searchWords` lower-cases (the test expects "casio scientific").

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm test lib/selling/price-hint.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the Looking For count (no unit test: two existing helpers and a filter; the e2e test covers it)**

```ts
// lib/selling/looking-for-count.ts
import { matchScore, queryWords } from "@/lib/browse/search";
import type { LookingForRequest } from "@/lib/types";

// How many open requests at a campus name a module code (spec 2.3 and decision 15, plan change 4), through browse's own
// word matching. Requests never name their asker, and this gives only a count.

export function requestsNaming(
  requests: readonly Pick<LookingForRequest, "title" | "details" | "campusSlug">[],
  moduleCode: string,
  campusSlug: string,
): number {
  const words = queryWords(moduleCode);
  return requests.filter(
    (request) =>
      request.campusSlug === campusSlug &&
      matchScore({ title: request.title, category: "", seller: "", description: request.details }, words) !== null,
  ).length;
}
```

- [ ] **Step 6: Checkpoint.** Leave uncommitted for the controller.

---

### Task 8: The notices and the `intent=suggest` branch

**Files:**
- Modify: `lib/selling/notices.ts`
- Modify: `lib/selling/listing-actions.ts` (after the photo-move branch, around line 200)
- Test: `lib/selling/listing-actions.test.ts` (one new `describe`)

- [ ] **Step 1: Add the notices**

In `lib/selling/notices.ts`, add to `NOTICES`:

```ts
  // Photo-to-listing (photo-to-listing spec 2.3 and 2.4). "suggested" is drawn with its count by the form itself.
  ["suggest-failed", "We couldn't read that photo. Fill it in yourself below, or try a clearer, closer photo of the item."],
  [
    "suggest-person",
    "We don't fill in listings from photos of people. Fill it in yourself below. If a person is in the photo, make sure they're happy to be in it.",
  ],
  ["suggest-no-photo", "Add a photo first. Choose one above, then press Fill in from my photo."],
  ["suggest-limit", "You've used today's photo fills. Fill it in yourself below, or try again tomorrow."],
```

- [ ] **Step 2: Write the failing tests**

Add to `lib/selling/listing-actions.test.ts` (it already has `form`, `signedInAs`, `photoFile`, `pngBytes`, `freshToken`, `redirectOf` and the `next/*` mocks). Add at the top, beside the other mocks:

```ts
vi.mock("@/lib/data/listing-ai", () => ({ readCoverPhoto: vi.fn() }));
```

and the imports:

```ts
import { readCoverPhoto } from "@/lib/data/listing-ai";
import { FAKE_REPLY } from "@/lib/data/listing-ai/fake";
```

then:

```ts
describe("filling in from a photo (photo-to-listing spec 2.3, 2.4 and decisions 1 to 6, 12)", () => {
  const suggestion = {
    title: FAKE_REPLY.title,
    categorySlug: FAKE_REPLY.categorySlug,
    condition: FAKE_REPLY.condition,
    description: FAKE_REPLY.description,
    alt: FAKE_REPLY.alt,
    moduleCode: FAKE_REPLY.moduleCode,
  };
  const suggestForm = async (overrides: Record<string, string | string[] | File | File[]> = {}) =>
    form({
      once: await freshToken(),
      kind: "item",
      title: "",
      category: "",
      condition: "",
      description: "",
      payMode: "cash",
      handover: "pickup",
      pickup: "pp-midrand-library",
      intent: "suggest",
      newPhotos: photoFile(pngBytes()),
      ...overrides,
    });

  beforeEach(() => {
    vi.stubEnv("VOSSIE_LISTING_AI", "1");
    vi.stubEnv("VOSSIE_LISTING_AI_PROVIDERS", "fake");
    vi.mocked(readCoverPhoto).mockReset();
  });

  it("fills the empty fields, tags them, keeps the photo, makes no listing and comes back to the form", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readCoverPhoto).mockResolvedValue({ ok: true, suggestion });
    const listingsBefore = (await listOwnListings("tech-corner")).length;
    expect(await redirectOf(async () => saveListingForm(await suggestForm({ title: "My calculator" })))).toBe(
      "/sell/listings/new",
    );
    const state = (await readFormState(listingForm(null)))!;
    expect(state.notice).toBe("suggested");
    expect(state.values).toMatchObject({
      title: "My calculator",
      category: "textbooks-notes",
      condition: "good",
      description: `Module FAC1501. ${FAKE_REPLY.description}`,
      suggestedModule: "FAC1501",
    });
    expect(state.values.suggested.split(" ")).toEqual(["category", "condition", "description", expect.stringMatching(/^alt:/)]);
    expect(state.values.photos).not.toBe("");
    expect(await listOwnListings("tech-corner")).toHaveLength(listingsBefore);
  });

  it("answers without a photo, a person and a failure with their notices, the form unchanged", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await suggestForm({ newPhotos: [] })));
    expect((await readFormState(listingForm(null)))?.notice).toBe("suggest-no-photo");
    expect(readCoverPhoto).not.toHaveBeenCalled();

    vi.mocked(readCoverPhoto).mockResolvedValueOnce({ ok: false, failure: "person" });
    await redirectOf(async () => saveListingForm(await suggestForm({ title: "Kept" })));
    expect(await readFormState(listingForm(null))).toMatchObject({ notice: "suggest-person", values: { title: "Kept" } });

    vi.mocked(readCoverPhoto).mockResolvedValueOnce({ ok: false, failure: "timeout" });
    await redirectOf(async () => saveListingForm(await suggestForm()));
    const failed = (await readFormState(listingForm(null)))!;
    expect(failed.notice).toBe("suggest-failed");
    expect(failed.values.suggested).toBeUndefined();
  });

  it("stops at the day's limit, counting only presses that reach a provider", async () => {
    await signedInAs("acc-pending");
    vi.mocked(readCoverPhoto).mockResolvedValue({ ok: true, suggestion });
    for (let i = 0; i < 20; i += 1) await redirectOf(async () => saveListingForm(await suggestForm({ pickup: "pp-pretoria-library" })));
    expect(readCoverPhoto).toHaveBeenCalledTimes(20);
    await redirectOf(async () => saveListingForm(await suggestForm({ pickup: "pp-pretoria-library" })));
    expect(readCoverPhoto).toHaveBeenCalledTimes(20);
    expect((await readFormState(listingForm(null)))?.notice).toBe("suggest-limit");
  });

  it("does nothing new while the feature is off: the press saves nothing and says nothing", async () => {
    vi.stubEnv("VOSSIE_LISTING_AI", "");
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await suggestForm()));
    expect(readCoverPhoto).not.toHaveBeenCalled();
    expect((await readFormState(listingForm(null)))?.notice ?? null).toBeNull();
  });
});
```

Notes for the implementer:
- `acc-seller` may be a sample account (exempt from the limit in sample mode, decision 12). The limit test uses `acc-pending`, which must not be one of the five sample accounts. Check `lib/auth/sample-accounts.ts`; if `acc-pending` is exempt too, create a fresh account with the test file's existing helpers, or stub the exemption.
- Use the test file's own PNG helper (`pngBytes`) with whatever arguments it takes.

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test lib/selling/listing-actions.test.ts -t "filling in from a photo"`
Expected: FAIL (no `suggest` branch: the press goes on to `checkListing`).

- [ ] **Step 4: Write the branch**

In `lib/selling/listing-actions.ts`, add imports:

```ts
import { readCoverPhoto } from "@/lib/data/listing-ai";
import { photoFor, photoIdOf } from "@/lib/data/photos";
import { reservePhotoFill } from "@/lib/data/photo-fills";
import { isSampleAccount } from "@/lib/auth/sample-accounts";
import { isSampleMode } from "@/lib/auth/config";
import { listingAiOn } from "./ai-config";
import { mergeSuggestion, type SuggestFailure } from "./suggest";
```

(merge `photoFor, photoIdOf` into the existing `@/lib/data/photos` import.) Add above `saveListingForm`:

```ts
/** Photo-to-listing presses per account in any 24 hours (spec decision 12, Lama's Q4). */
const PHOTO_FILLS_PER_DAY = 20;

const failureNotice = (failure: SuggestFailure) => (failure === "person" ? "suggest-person" : "suggest-failed");

/**
 * "Fill in from my photo" (photo-to-listing spec decisions 1 to 6, 12): reads the cover, fills the empty fields, and
 * comes back to the form with what was typed, the photos, and a notice. No token is taken and no listing is made.
 */
async function suggestFromCover(
  owner: ShopOwner,
  values: Record<string, string>,
  order: readonly string[],
  context: ListingContext,
  now: Date,
): Promise<{ values: Record<string, string>; notice: string }> {
  const cover = order[0] ?? null;
  const id = cover ? photoIdOf(cover) : null;
  if (!cover || !id) return { values, notice: "suggest-no-photo" };
  const exempt = isSampleMode() && isSampleAccount(owner.account);
  if (!exempt && !(await reservePhotoFill(owner.account.id, now, PHOTO_FILLS_PER_DAY))) {
    return { values, notice: "suggest-limit" };
  }
  const photo = await photoFor(id, { id: owner.account.id, hubStaff: false });
  if (!photo) return { values, notice: "suggest-failed" };
  const reading = await readCoverPhoto(photo, context.categorySlugs);
  if (!reading.ok) return { values, notice: failureNotice(reading.failure) };
  const merged = mergeSuggestion(values, reading.suggestion, cover);
  return {
    values: {
      ...merged.values,
      suggested: merged.suggested.join(" "),
      suggestedModule: reading.suggestion.moduleCode ?? "",
    },
    notice: "suggested",
  };
}
```

Then, in `saveListingForm`, right after the photo-move branch (the `if (move) { … done(…) }` block) and before `const check = checkListing(…)`:

```ts
  // "Fill in from my photo": only while the feature is on (decision 14). A press while it's off goes on as a Save
  // would not: it simply comes back to the form, as a photo button does.
  if (field(formData, "intent") === "suggest") {
    const typed = typedValues(formData, order, alts, context);
    const result = listingAiOn()
      ? await suggestFromCover(owner, typed, order, context, now)
      : { values: typed, notice: null };
    await writeFormState(form, { errors: photoErrors, values: result.values, notice: result.notice }, now);
    done(formPath);
  }
```

Check before writing:
- `photoFor(id, viewer)` (`lib/data/photos.ts:112`): read its signature and return type. It must return the bytes and type for the photo's owner, on both backends (it dispatches to the twin). If the viewer type differs, pass what it takes. If it returns `{ forEveryone, type, bytes }`, pass `{ type: photo.type, bytes: photo.bytes }` to `readCoverPhoto`.
- `owner.account` must have `email` for `isSampleAccount`. Check `ShopOwner` in `lib/selling/owner.ts`.
- `photoErrors` is the array built just above the photo-move branch. Keeping it shows an upload problem (a too-big file) with the notice.

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test lib/selling/listing-actions.test.ts`
Expected: PASS, the new four and every existing test.

- [ ] **Step 6: Checkpoint.** Leave uncommitted for the controller.

---

### Task 9: `PendingButton` for one button, and the field tags

**Files:**
- Modify: `components/kit/PendingButton.tsx`
- Modify: `components/sell/fields.tsx`
- Test: `components/kit/PendingButton.test.tsx` (create, or add to the existing one if there is one)

- [ ] **Step 1: Write the failing test**

```tsx
// components/kit/PendingButton.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false, data: null as FormData | null }));
vi.mock("react-dom", async (original) => ({ ...(await original<typeof import("react-dom")>()), useFormStatus: () => status }));

import { PendingButton } from "./PendingButton";

const sent = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};

describe("PendingButton (photo-to-listing plan change 7)", () => {
  it("shows its pending words only when its own button sent the form", () => {
    Object.assign(status, { pending: true, data: sent({ intent: "publish" }) });
    const { rerender } = render(
      <PendingButton name="intent" value="suggest" pendingLabel="Reading your photo…">Fill in from my photo</PendingButton>,
    );
    expect(screen.getByRole("button").textContent).toBe("Fill in from my photo");
    expect(screen.getByRole("button").getAttribute("aria-disabled")).toBeNull();
    Object.assign(status, { pending: true, data: sent({ intent: "suggest" }) });
    rerender(<PendingButton name="intent" value="suggest" pendingLabel="Reading your photo…">Fill in from my photo</PendingButton>);
    expect(screen.getByRole("button").textContent).toBe("Reading your photo…");
    expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button").getAttribute("value")).toBe("suggest");
  });

  it("without a name, stays pending for any post, as before", () => {
    Object.assign(status, { pending: true, data: sent({ intent: "publish" }) });
    render(<PendingButton pendingLabel="Marking as sold…">Mark as sold</PendingButton>);
    expect(screen.getByRole("button").textContent).toBe("Marking as sold…");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test components/kit/PendingButton.test.tsx`
Expected: FAIL (no `name`/`value` props; the first expectation sees "Reading your photo…").

- [ ] **Step 3: Change `PendingButton`**

```tsx
"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  children: ReactNode;
  /** What the button says while its form posts ("Marking as sold…"). */
  pendingLabel: string;
  className?: string;
  /** The button's own name and value. With them, it's pending only when it sent the form (photo-to-listing). */
  name?: string;
  value?: string;
};

/**
 * A form's submit button that says what's happening while the post is on its way, and ignores a second press then
 * (role views N2 plan decision 17). aria-disabled rather than disabled, so focus stays on it; the live region reads
 * the change. With a name and value, a different button's post leaves it as it is. Without JavaScript it is a plain
 * submit button.
 */
export function PendingButton({ children, pendingLabel, className, name, value }: PendingButtonProps) {
  const { pending, data } = useFormStatus();
  const mine = pending && (name === undefined || data?.get(name) === value);
  const ignore = (event: MouseEvent<HTMLButtonElement>) => {
    if (mine) event.preventDefault();
  };
  return (
    <span aria-live="polite" className="pending-button">
      <button type="submit" name={name} value={value} className={className} aria-disabled={mine || undefined} onClick={ignore}>
        {mine ? pendingLabel : children}
      </button>
    </span>
  );
}
```

- [ ] **Step 4: Run it to see it pass, and the existing users still pass**

Run: `pnpm test components/kit/PendingButton.test.tsx components/sell components/messages`
Expected: PASS.

- [ ] **Step 5: Add the tag and the shimmer hook to the fields**

In `components/sell/fields.tsx`:
- Add `tag?: string;` to `TextFieldProps`, `SelectFieldProps` and the `RadioGroup` props.
- Inside each `<label>` (and the radio group's `<legend>`), after the label text:

```tsx
{tag && <span className="field-tag">{tag}</span>}
```

- On the text `<input>` and the `<textarea>` in `TextField`, add `placeholder=" "` (the shimmer finds empty text fields with `:placeholder-shown`, spec 2.2).
- Pass `tag` through in each component's props destructuring.

The tag sits inside the label, so a screen reader reads "Title Suggested".

- [ ] **Step 6: Run the form tests**

Run: `pnpm test components/sell`
Expected: PASS. If a snapshot or an exact-markup assertion now sees `placeholder=" "`, update that expectation.

- [ ] **Step 7: Checkpoint.** Leave uncommitted for the controller.

---

### Task 10: The photo card, the filled form and the CSS

**Files:**
- Create: `components/sell/PhotoStart.tsx`
- Modify: `components/sell/ListingFormView.tsx`, `components/sell/ListingForm.tsx`, `app/globals.css`
- Test: `components/sell/ListingFormView.test.tsx` (add cases)

- [ ] **Step 1: Write the failing view tests**

Add to `components/sell/ListingFormView.test.tsx`, using its existing render helper and default props (read the top of the file and reuse them):

```tsx
describe("photo-to-listing (spec 2.1 to 2.4)", () => {
  it("draws the photo card first on a new listing, with the button, when the feature is on", () => {
    renderForm({ listingId: null, photoStart: { on: true, limitReached: false } });
    const card = screen.getByRole("group", { name: "Start with a photo" });
    expect(within(card).getByRole("button", { name: "Fill in from my photo" })).toBeTruthy();
    expect(screen.getByText("or fill it in yourself")).toBeTruthy();
  });

  it("keeps the edit form as it is: no card, no button", () => {
    renderForm({ listingId: "lst-1", photoStart: { on: true, limitReached: false } });
    expect(screen.queryByRole("button", { name: "Fill in from my photo" })).toBeNull();
  });

  it("tags only the suggested fields, says how many, and shows the hint and the Looking For line", () => {
    renderForm({
      listingId: null,
      photoStart: { on: true, limitReached: false },
      values: { title: "Financial Accounting", category: "textbooks-notes", suggested: "title category" },
      notice: "suggested",
      priceHint: "Similar on CampusCart: R180 to R260 (5 listings)",
      lookingFor: { count: 3, campusName: "Pretoria", href: "/looking-for?cat=textbooks-notes" },
    });
    expect(screen.getByRole("status").textContent).toContain("We filled in 2 fields from your photo.");
    expect(screen.getByLabelText(/Title/).closest(".form-field")?.textContent).toContain("Suggested");
    expect(screen.getByText(/Description/).closest(".form-field")?.textContent).not.toContain("Suggested");
    expect(screen.getByText("Similar on CampusCart: R180 to R260 (5 listings)")).toBeTruthy();
    expect(screen.getByText(/3 students at Pretoria are Looking For this/)).toBeTruthy();
  });

  it("draws the limit state as a secondary button with its line, never disabled", () => {
    renderForm({ listingId: null, photoStart: { on: true, limitReached: true }, notice: "suggest-limit" });
    const button = screen.getByRole("button", { name: "Fill in from my photo" });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("You can still add photos. Filling in from them is back tomorrow.")).toBeTruthy();
  });
});
```

If the file has no `renderForm` helper, write one at the top of this `describe` that renders `<ListingFormView {...DEFAULTS} {...overrides} />` with the defaults the file's other tests use.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test components/sell/ListingFormView.test.tsx -t "photo-to-listing"`
Expected: FAIL (unknown props, no card).

- [ ] **Step 3: Write `PhotoStart`**

```tsx
// components/sell/PhotoStart.tsx
import type { ReactNode } from "react";
import { PendingButton } from "@/components/kit/PendingButton";

type PhotoStartProps = {
  prefix: string;
  /** Today's limit is used up (spec 2.4): the button stays, drawn as a secondary button, with a line saying why. */
  limitReached: boolean;
  /** The photo field (PhotoFieldset), drawn inside the card. */
  children: ReactNode;
};

/**
 * The navy "Start with a photo" card on a new listing (photo-to-listing spec 2.1 and 2.2). A fieldset, so the card is
 * one named group. The status line is in the markup but hidden until the button is pending (CSS, spec 2.2).
 */
export function PhotoStart({ prefix, limitReached, children }: PhotoStartProps) {
  return (
    <fieldset className="photo-start" aria-labelledby={`${prefix}-photo-start-title`}>
      <div className="photo-start-photos">{children}</div>
      <div className="photo-start-body">
        <h2 id={`${prefix}-photo-start-title`} className="photo-start-title">
          Start with a photo
        </h2>
        <p className="photo-start-line">We&apos;ll fill in what we can see. You check it before anything goes live.</p>
        {limitReached && (
          <p className="photo-start-line">You can still add photos. Filling in from them is back tomorrow.</p>
        )}
        <PendingButton
          name="intent"
          value="suggest"
          pendingLabel="Reading your photo…"
          className={limitReached ? "photo-start-button photo-start-button-quiet" : "photo-start-button"}
        >
          Fill in from my photo
        </PendingButton>
        <p role="status" className="photo-start-status">
          Looking for a title, category and condition. This takes a few seconds.
        </p>
      </div>
    </fieldset>
  );
}
```

A `<fieldset>` needs a `<legend>` to be named by role in some browsers: if the test's `getByRole("group", { name: … })` fails, change the `<h2>` to `<legend className="photo-start-title">` and drop `aria-labelledby`. The status line has text from the start, so `role="status"` announces nothing until it's shown; the CSS shows it while pending.

- [ ] **Step 4: Change `ListingFormView`**

Add to `ListingFormViewProps`:

```ts
  /** Photo-to-listing (spec 2.1): null when the feature is off. Only a new listing passes it. */
  photoStart: { on: boolean; limitReached: boolean } | null;
  /** The form's notice code (spec 2.3 and 2.4), or null. */
  notice: string | null;
  /** The price hint (spec 2.3), or null. */
  priceHint: string | null;
  /** The textbook Looking For line (spec 2.3), or null. */
  lookingFor: { count: number; campusName: string; href: string } | null;
```

In the body:

```tsx
  const suggested = new Set((values.suggested ?? "").split(" ").filter(Boolean));
  const tagOf = (field: string) => (suggested.has(field) ? "Suggested" : undefined);
  const noticeWords =
    notice === "suggested"
      ? `We filled in ${suggested.size} ${suggested.size === 1 ? "field" : "fields"} from your photo. Check each one before you publish.`
      : noticeText(notice);
  const withCard = photoStart?.on === true && listingId === null;
  const photoField = (
    <PhotoFieldset
      key={photos.map((photo) => photo.src).join(" ")}
      prefix={prefix}
      photos={photos}
      error={errorOf("photos")}
      altError={longAlt < 0 ? undefined : errorOf("alt")}
      suggested={suggested}
    />
  );
```

- Render `{noticeWords && <p role="status" className="form-notice">{noticeWords}</p>}` right after the `ErrorSummary`, and the Looking For line under it when `lookingFor` is set:

```tsx
{lookingFor && (
  <p className="photo-start-looking">
    {`${lookingFor.count} ${lookingFor.count === 1 ? "student" : "students"} at ${lookingFor.campusName} ${lookingFor.count === 1 ? "is" : "are"} Looking For this. `}
    <Link href={lookingFor.href} prefetch={false}>See their requests</Link>
  </p>
)}
```

- Inside the `<form>`, after the hidden inputs and before the kind `RadioGroup`:

```tsx
{withCard && (
  <>
    <PhotoStart prefix={prefix} limitReached={photoStart.limitReached}>{photoField}</PhotoStart>
    <p className="photo-start-or">or fill it in yourself</p>
  </>
)}
```

- Where `PhotoFieldset` is today (before the buttons), render `{!withCard && photoField}`.
- Pass `tag={tagOf("title")}`, `tag={tagOf("category")}`, `tag={tagOf("condition")}` and `tag={tagOf("description")}` to those four fields.
- Under the price field's hint paragraph, render the hint, inside the same `form-field`, and add its id to the input's `aria-describedby`:

```tsx
{priceHint && (
  <p id={`${ids.price}-suggest`} className="form-hint">
    {priceHint}
  </p>
)}
```

and change the price input's `aria-describedby` to `describedBy(`${ids.price}-hint`, priceHint && `${ids.price}-suggest`, priceError && `${ids.price}-error`)` (check `describedBy` takes any number of ids; if it takes two, join them yourself).
- Import `noticeText` from `@/lib/selling/notices` and `PhotoStart` from `./PhotoStart`.

- [ ] **Step 5: Tag the cover's description in `PhotoFieldset`**

`PhotoFieldset` passes a `suggested: ReadonlySet<string>` prop on to `PhotoField` (a client component). Rather than change the client component's code, pass the label words: in `PhotoFieldset`, keep the existing description label, and when `suggested.has(`alt:${photo.src}`)` for a photo, add " (Suggested)" to that photo's description label through the existing words prop it already draws labels from. Read `PhotoField`'s label rendering (around line 280) first: if the label text comes from the server (a `PhotoWords` or parts prop), extend that; if it's fixed in the client component, add an optional `altTag?: string[]` (one entry per photo index) to its props and render `<span className="field-tag">Suggested</span>` inside the label when set. Keep the client component's change to those few lines.

- [ ] **Step 6: Change `ListingForm` to read and pass the new props**

In `components/sell/ListingForm.tsx`:

```tsx
import { connection } from "next/server";
import { getOpenRequests, searchListings } from "@/lib/data";
import { listingAiOn } from "@/lib/selling/ai-config";
import { requestsNaming } from "@/lib/selling/looking-for-count";
import { hintQuery, priceHintText } from "@/lib/selling/price-hint";
import { sastToday } from "@/lib/time";
```

After `values` is worked out:

```tsx
  // Photo-to-listing (spec 2.1 and 2.3): the card on a new listing while the feature is on; after a fill, the price
  // hint and the textbook Looking For line, worked out now from the filled values (never stored).
  const on = !listing && listingAiOn();
  const filled = on && state?.notice === "suggested";
  const campusSlug = owner.shop.campusSlug;
  const [priceHint, lookingFor] = filled
    ? await Promise.all([
        values.title && values.category
          ? searchListings(hintQuery(values.title, values.category, campusSlug)).then(async (here) =>
              here.items.length >= 3
                ? priceHintText(here.items)
                : priceHintText((await searchListings(hintQuery(values.title, values.category, "all"))).items),
            )
          : null,
        values.suggestedModule
          ? (async () => {
              await connection();
              const count = requestsNaming(
                await getOpenRequests({ category: null, today: sastToday() }),
                values.suggestedModule,
                campusSlug,
              );
              return count > 0
                ? {
                    count,
                    campusName: campuses.find((campus) => campus.slug === campusSlug)?.name ?? "",
                    href: `/looking-for?cat=${values.category}`,
                  }
                : null;
            })()
          : null,
      ])
    : [null, null];
```

and pass to the view:

```tsx
      photoStart={on ? { on: true, limitReached: state?.notice === "suggest-limit" } : null}
      notice={state?.notice ?? null}
      priceHint={priceHint}
      lookingFor={lookingFor}
```

Check: `"all"` is the right `CampusChoice` value (`ALL_CAMPUSES` in `lib/campus.ts`: import and use it instead of the literal). `ListingForm` already runs at request time inside `<Suspense>` (it reads the session), so `connection()` before `sastToday()` keeps the "no `new Date()` while prerendering" rule.

- [ ] **Step 7: Add the CSS**

Append to `app/globals.css`, beside the other `.sell-*` rules (use the file's existing token names for the brand colours: `grep -n "\-\-vos-" app/globals.css | head` and use those, not hex):

```css
/* Photo-to-listing (photo-to-listing spec 2.1 to 2.3). The card is navy: small text white, sky only for the button. */
.photo-start {
  display: grid;
  gap: 1rem;
  margin: 0 0 0.5rem;
  padding: 1rem;
  border: 0;
  border-radius: 1rem;
  background: var(--vos-navy);
  color: #fff;
}
.photo-start-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
}
.photo-start-line {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #fff;
}
.photo-start-button {
  min-height: 2.75rem;
  margin-top: 0.75rem;
  padding: 0.625rem 1.25rem;
  border: 0;
  border-radius: 999px;
  background: var(--vos-sky);
  color: var(--vos-navy);
  font-weight: 700;
}
.photo-start-button-quiet {
  background: transparent;
  color: #fff;
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.7);
}
.photo-start-status {
  display: none;
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: #fff;
}
.photo-start:has(.photo-start-button[aria-disabled="true"]) .photo-start-status {
  display: block;
}
.photo-start-or {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--vos-muted);
}
.photo-start-or::before,
.photo-start-or::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--vos-idle);
}
.field-tag {
  margin-left: 0.5rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--vos-pale);
  color: var(--vos-navy);
  font-size: 0.75rem;
  font-weight: 600;
}

/* The reading state (spec 2.2): a band of light sweeps the cover, and the fields still empty shimmer. */
@keyframes photo-start-sweep {
  from { translate: 0 -100%; }
  to { translate: 0 100%; }
}
@keyframes photo-start-shimmer {
  from { translate: -100% 0; }
  to { translate: 100% 0; }
}
.photo-start:has(.photo-start-button[aria-disabled="true"]) .sell-photo:first-child .sell-thumb {
  position: relative;
}
.photo-start:has(.photo-start-button[aria-disabled="true"]) .sell-photo:first-child::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgb(255 255 255 / 0.7), transparent);
  animation: photo-start-sweep 1.6s ease-in-out infinite alternate;
}
form:has(.photo-start-button[aria-disabled="true"]) .form-field:has(input.form-input:placeholder-shown, textarea:placeholder-shown, select option[value=""]:checked) {
  position: relative;
  overflow: hidden;
}
form:has(.photo-start-button[aria-disabled="true"]) .form-field:has(input.form-input:placeholder-shown, textarea:placeholder-shown, select option[value=""]:checked)::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgb(225 240 247 / 0.9), transparent);
  animation: photo-start-shimmer 1.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .photo-start *::after,
  form .form-field::after {
    animation: none;
    display: none;
  }
}
html[data-low-data] .photo-start *::after,
html[data-low-data] form .form-field::after {
  animation: none;
  display: none;
}
@media (min-width: 48rem) and (min-height: 30rem) {
  .photo-start {
    grid-template-columns: auto 1fr;
    align-items: center;
    padding: 1.25rem;
  }
}
```

Notes:
- The sweep sits on the cover's list item (`.sell-photo:first-child`), which needs `position: relative` and `overflow: hidden` for the band to stay inside the thumbnail. Check `.sell-photo`'s layout in `globals.css` and put the pseudo-element on whichever element wraps only the thumbnail; adjust the selector, not the effect.
- Inside the card, `.sell-action` buttons and the description inputs are on navy. Check their contrast in the browser (Task 11): if `.sell-action`'s text is navy or sky-dark, add `.photo-start .sell-action { color: #fff; border-color: rgb(255 255 255 / 0.7); }` and give the description inputs a white background.
- Look for the existing reduced-motion and data saver switches in `globals.css` (the file has them); if they already turn off every `::after` animation, the two blocks above can go.

- [ ] **Step 8: Run the view tests, the lint and the typecheck**

Run: `pnpm test components/sell` then `pnpm lint` then `pnpm typecheck`
Expected: PASS, no lint errors (React Compiler rules included), no type errors.

- [ ] **Step 9: Checkpoint.** Leave uncommitted for the controller.

---

### Task 11: See it in the browser, the privacy line, and the e2e test

**Files:**
- Modify: `app/privacy/page.tsx`
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/selling-writes.spec.ts`

- [ ] **Step 1: Look at it**

With `.env.local` holding `VOSSIE_LISTING_AI=1` and `VOSSIE_LISTING_AI_PROVIDERS=fake` (sample mode), start the preview (`vossie-dev`), sign in as the sample seller, open `/sell/listings/new` at 390x844 and at 1440x900, and check against the spec's mockups (in `.superpowers/brainstorm/`):
1. The navy card on top, the divider, the form below; side by side from the tablet step.
2. Add a photo, press "Fill in from my photo": the button reads "Reading your photo…", the status line shows, the cover sweeps, empty fields shimmer (the fake answers at once, so add a temporary `await new Promise((r) => setTimeout(r, 3000))` in `fake.ts` to see it, and remove it after).
3. The filled form: the notice with the count, "Suggested" on title, category, condition, description and the cover's description, the price hint (if 3 or more sample textbooks match), Save publishes.
4. Reduced motion (`resize_window` with the emulation, or the OS setting) and data saver: nothing moves.
5. Contrast of everything on the navy card (axe in Step 4 also checks).

Fix what's off in Task 10's files.

- [ ] **Step 2: Add the privacy line**

In `app/privacy/page.tsx`, in "What else happens" after the Vercel item:

```tsx
{listingAiOn() && (
  <li>
    When you press Fill in from my photo on a new listing, your cover photo is sent to Groq, an AI provider in the
    United States, to read what the item is. Groq keeps nothing from it (we&apos;ve turned on its zero data retention).
    Nothing is sent unless you press the button, and you check every suggested field before you publish.
  </li>
)}
```

and `import { listingAiOn } from "@/lib/selling/ai-config";`. If Lama lists Haiku later (Q6), this line gains Anthropic. Run `pnpm test app/privacy` (the page test finds cookie names; it shouldn't change).

Do not publish the "keeps nothing" sentence until Lama has turned on zero data retention and read Groq's agreement (spec Q3); the line only shows while `VOSSIE_LISTING_AI=1`, which stays unset until then.

- [ ] **Step 3: Run the e2e server with the fake**

In `playwright.config.ts`, give `webServer` an `env`:

```ts
    env: { ...process.env, VOSSIE_LISTING_AI: "1", VOSSIE_LISTING_AI_PROVIDERS: "fake" } as Record<string, string>,
```

Check how `webServer` already gets its environment (it may rely on the shell). If adding `env` changes other projects' behaviour, keep it: every project now sees the card on `/sell/listings/new`, which is what launch will look like once it's on.

- [ ] **Step 4: Write the e2e test**

Add to `tests/e2e/selling-writes.spec.ts` (it uses `signInAsSample`, `fillListing`, `uniqueWord`, `seriousIssues` already):

```ts
test("fill in from a photo: the fields fill and are tagged, axe passes, and Save publishes (photo-to-listing)", async ({
  page,
}) => {
  await signInAsSample(page, "seller");
  await page.goto("/sell/listings/new");
  await expect(page.getByRole("button", { name: "Fill in from my photo" })).toBeVisible();

  // No photo yet: the notice, and axe on that state.
  await page.getByRole("button", { name: "Fill in from my photo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Add a photo first." })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);

  await page.locator('main input[type="file"]').setInputFiles("tests/e2e/fixtures/listing-photo.jpg");
  await page.getByRole("button", { name: "Fill in from my photo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "We filled in" })).toBeVisible();
  await expect(page.getByLabel(/Title/)).toHaveValue("Financial Accounting, 3rd edition");
  await expect(page.locator(".field-tag", { hasText: "Suggested" }).first()).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);

  const word = uniqueWord();
  await page.getByLabel(/Title/).fill(`Financial Accounting ${word}`);
  await page.getByLabel("Price in rand").fill("200");
  await page.getByRole("button", { name: "Save and publish" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Published." })).toBeVisible();
});
```

Check the helpers' real names and arguments (`signInAsSample`, `uniqueWord`, `seriousIssues`) at the top of the spec file and in `tests/e2e/helpers/`, and use an existing photo fixture (the spec file's other tests upload one: reuse that path). Every field the form requires but the fake doesn't fill (handover, pickup) has a default on a new listing.

- [ ] **Step 5: Run the e2e project**

Run: `pnpm e2e --project=selling-writes -g "fill in from a photo"`
Expected: PASS. Then run the device projects' `performance.spec.ts` and the new listing form's layout-shift check, and record `/sell/listings/new`'s compressed JS before and after (the plan's `PendingButton` cost). It must stay inside the 150 KB first-visit budget.

- [ ] **Step 6: Screenshots (only with `SCREENSHOTS=1`)**

Add to `tests/e2e/screenshots.spec.ts`, in its existing pattern, a "photo to listing review screenshots" group: the card at 390 and 1440, the filled form, and the four fallback notices (the person and failure notices by setting the form state through the UI is hard: take the no-photo and limit states, and leave person and failure to the unit tests). Run `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts -g "photo to listing review screenshots"` and save them under `docs/progress/` as the other sets are.

- [ ] **Step 7: Checkpoint.** Leave uncommitted for the controller.

---

### Task 12: Build checks, docs and the go-live list

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`, `docs/reference/GO-LIVE.md`, `CLAUDE.md`, `docs/PROGRESS.md`

- [ ] **Step 1: The full checks**

Run, one after another: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Expected: all pass. Then:

```bash
grep -lE "groq|anthropic" .next/static/chunks/*.js
```

Expected: prints nothing (no SDK in a browser chunk). And the existing chunk greps (`serviceWorker.register`, `supabase`) still print nothing.

- [ ] **Step 2: Record the plan's changes in the spec**

Add a section "13. Changes made while planning and building (2026-10-27)" to the spec, listing this plan's "Changes to the spec" 1 to 8 and the hand check's outcome (Task 4, Step 4: strict or `json_object`). Edit the decisions they touch (3, 8, 9, 12, 15) so the spec reads true on its own, and change "announced and focused" to "announced" in 2.3, 2.4 and section 5.

- [ ] **Step 3: GO-LIVE**

Add to `docs/reference/GO-LIVE.md`, in its checklist style, a "Photo-to-listing (after the submission)" block:
- Push `20261027120000_photo_fills.sql` with the other migrations (dry run first).
- Lama: create the Groq key; turn on Zero Data Retention in Groq's Data Controls; read Groq's Services Agreement (training, consumer use, liability) and note the answer here.
- Set `VOSSIE_LISTING_AI=1`, `VOSSIE_LISTING_AI_PROVIDERS=groq`, `GROQ_API_KEY` (and `VOSSIE_GROQ_FORMAT=json_object` if Task 4's check needed it) in Vercel, then redeploy (the privacy line is drawn at build).
- Check Groq's deprecations page monthly. After two weeks, read the `[vossie] photo-to-listing:` log lines' counts (`rate-limited`, `bad-output`, `low-confidence`); list Haiku (Q6) if busy minutes are common.

- [ ] **Step 4: CLAUDE.md**

Add one code rule (match the file's style):

```markdown
- Photo-to-listing (`docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`): "Fill in from my photo" is `intent=suggest` on the listing form, handled in `saveListingForm` after photos are stored and before `checkListing`; it makes no listing and takes no token. Providers are reached only through `readCoverPhoto` (`lib/data/listing-ai.ts`), each loaded by dynamic import, so no SDK reaches a browser chunk (`grep -lE "groq|anthropic" .next/static/chunks/*.js` prints nothing). Every reply goes through `checkSuggestion`; suggestions fill only empty fields (`mergeSuggestion`) and are tagged "Suggested". The settings live only in `lib/selling/ai-config.ts` (`VOSSIE_LISTING_AI`, `VOSSIE_LISTING_AI_PROVIDERS`; the fake never on Supabase). 20 presses per account in any 24 hours (`reservePhotoFill`; sample accounts exempt only in sample mode). Off until GO-LIVE's photo-to-listing block is done.
```

- [ ] **Step 5: PROGRESS**

Update the photo-to-listing line in `docs/PROGRESS.md`'s Next section: built (with the unit count, the e2e result and `/sell/listings/new`'s recorded bytes), off for the submission, and what's left (GO-LIVE's block).

- [ ] **Step 6: Final checkpoint.** The controller runs the full unit suite and the selling e2e project once more, then asks Lama for the go-ahead to commit (staging only this build's files).
