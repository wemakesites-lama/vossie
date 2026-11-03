# AI stage A: Haiku first, and one door for every AI feature: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photo-to-listing asks Claude Haiku 5.5 first (Groq's free tier only when Haiku couldn't answer), reads up to three photos with the category names, and every AI provider sits behind one door (`lib/data/ai.ts`) and one settings file (`lib/ai/config.ts`) that stages B to E build on.

**Architecture:** Spec `docs/superpowers/specs/2026-11-03-ai-features-design.md`, sections 2 and 7 (decision 96). The provider files keep their shape (one `read` each, loaded by dynamic import), but a request now carries a system prompt, up to three images and a short text. Settings move out of `lib/selling/` because stages B to E aren't selling. Nothing else on the listing form changes: same button, same notices, same limit.

**Tech stack:** Next.js 16.4 Server Actions, `@anthropic-ai/sdk` 1.3.0 (structured outputs through `output_config.format`, effort through `output_config.effort`), `groq-sdk` 1.6.0, Vitest 5.

**Ground rules for whoever builds this** (from `CLAUDE.md` and Lama's memory notes):
- Leave the work uncommitted. The controller checks it and commits only with Lama's go-ahead. One git command at a time.
- `rm` only the files this plan names. Never kill a running install or build.
- Stop only your own dev server (by PID or port), never `pkill` by name.
- `pnpm` only.

---

## File map

| File | What happens |
|---|---|
| `lib/ai/config.ts` | **New.** Provider list (`VOSSIE_AI_PROVIDERS`, Haiku then Groq by default), keys, one switch per feature (`aiFeatureOn`) |
| `lib/ai/config.test.ts` | **New.** Replaces `lib/selling/ai-config.test.ts` |
| `lib/selling/ai-config.ts`, `lib/selling/ai-config.test.ts` | **Removed** (replaced by the two above) |
| `lib/selling/suggest.ts` | `SUGGESTION_INSTRUCTION` becomes `suggestionInstruction(categories)`, with `CATEGORY_HINTS` |
| `lib/selling/suggest.test.ts` | Tests for the instruction |
| `lib/data/listing-ai.ts` → `lib/data/ai.ts` | Moved. `readCoverPhoto` becomes `readListingPhotos`, plus `listingRequest` and `PHOTOS_READ` |
| `lib/data/listing-ai/` → `lib/data/ai/` | Moved: `types.ts`, `anthropic.ts`, `groq.ts`, `groq.test.ts`, `fake.ts` |
| `lib/data/ai/types.ts` | `ProviderRequest` becomes `{ system, images, text, schema }` |
| `lib/data/ai/anthropic.ts` | System prompt, every image, `VOSSIE_HAIKU_EFFORT`, a timeout per effort |
| `lib/data/ai/anthropic.test.ts` | **New** |
| `lib/data/ai/groq.ts`, `groq.test.ts` | System message; the cover only |
| `lib/data/ai.test.ts` | **New.** The door: three photos at most, Haiku first, Groq only when Haiku couldn't answer |
| `lib/selling/listing-actions.ts`, `.test.ts` | Reads up to three photos; `aiFeatureOn("listing")` |
| `app/privacy/page.tsx`, `.test.tsx` | The line says what each provider gets, and that photos are read outside South Africa |
| `vitest.hand.config.mts`, `scripts/photo-test.hand.ts` | **New.** The photo test, run by hand with real keys, never in `pnpm test` |
| `.env.example`, `docs/reference/GO-LIVE.md`, `CLAUDE.md`, both specs, `docs/PROGRESS.md` | Docs |

---

### Task 1: One settings file for every AI feature

**Files:**
- Create: `lib/ai/config.ts`, `lib/ai/config.test.ts`
- Modify: `lib/selling/listing-actions.ts` (lines 24 and 262), `app/privacy/page.tsx` (lines 5, 20 and 21)
- Remove: `lib/selling/ai-config.ts`, `lib/selling/ai-config.test.ts`

- [ ] **Step 1: Write the failing test.** Create `lib/ai/config.test.ts`:

```ts
// lib/ai/config.test.ts
import { describe, expect, it } from "vitest";
import { aiFeatureOn, aiProviders, providerHasKey } from "./config";

describe("the AI settings (AI features spec 7.2)", () => {
  it("lists Haiku then Groq when unset, otherwise in the order given, ignoring unknown and repeated names", () => {
    expect(aiProviders({})).toEqual(["anthropic", "groq"]);
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: " groq, anthropic ,groq,openai" })).toEqual(["groq", "anthropic"]);
  });

  it("still reads the old setting's name, and the new one wins", () => {
    expect(aiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "groq" })).toEqual(["groq"]);
    expect(aiProviders({ VOSSIE_LISTING_AI_PROVIDERS: "groq", VOSSIE_AI_PROVIDERS: "anthropic" })).toEqual(["anthropic"]);
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: " " })).toEqual(["anthropic", "groq"]);
  });

  it("never uses the fake on Supabase", () => {
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: "fake" })).toEqual(["fake"]);
    expect(aiProviders({ VOSSIE_AI_PROVIDERS: "fake,groq", VOSSIE_BACKEND: "supabase" })).toEqual(["groq"]);
  });

  it("turns a feature on only when its switch is on and a listed provider has its key (or is the fake)", () => {
    expect(aiFeatureOn("listing", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1" })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", ANTHROPIC_API_KEY: " " })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", GROQ_API_KEY: "k" })).toBe(true);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", VOSSIE_AI_PROVIDERS: "anthropic", GROQ_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing", { VOSSIE_LISTING_AI: "1", VOSSIE_AI_PROVIDERS: "fake" })).toBe(true);
  });

  it("knows each provider's key", () => {
    expect(providerHasKey("anthropic", { ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(providerHasKey("groq", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(providerHasKey("fake", {})).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**

Run: `pnpm vitest run lib/ai/config.test.ts`
Expected: FAIL, `Failed to resolve import "./config"`.

- [ ] **Step 3: Write `lib/ai/config.ts`:**

```ts
// lib/ai/config.ts
import { onSupabase } from "@/lib/backend";

// The AI features' settings (AI features spec 7.2; photo-to-listing spec decisions 11 and 14). A plain module with no
// SDK, so a Server Component can ask whether to show a feature without loading a provider. Read on each call, never
// kept at module scope.

type Env = Readonly<Record<string, string | undefined>>;

export type ProviderName = "anthropic" | "groq" | "fake";

/** The features, each with its own switch. Stages B to E add theirs here (AI features spec 7.2). */
export type AiFeature = "listing";

const KNOWN: readonly ProviderName[] = ["anthropic", "groq", "fake"];
const KEYS: Readonly<Record<Exclude<ProviderName, "fake">, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
};
const SWITCHES: Readonly<Record<AiFeature, string>> = { listing: "VOSSIE_LISTING_AI" };

/** Haiku first, Groq's free tier behind it (AI features spec decision 1, Lama's Q1). */
const DEFAULT_PROVIDERS = "anthropic,groq";

/**
 * VOSSIE_AI_PROVIDERS in order. The old name, VOSSIE_LISTING_AI_PROVIDERS, is still read until it's gone from Vercel.
 * The fake is never used on Supabase.
 */
export function aiProviders(env: Env = process.env): ProviderName[] {
  const setting = env.VOSSIE_AI_PROVIDERS?.trim() || env.VOSSIE_LISTING_AI_PROVIDERS?.trim() || DEFAULT_PROVIDERS;
  const listed = setting.split(",").map((name) => name.trim());
  const known = [...new Set(listed)].filter((name): name is ProviderName => (KNOWN as readonly string[]).includes(name));
  return onSupabase(env) ? known.filter((name) => name !== "fake") : known;
}

export function providerHasKey(name: ProviderName, env: Env = process.env): boolean {
  return name === "fake" || Boolean(env[KEYS[name]]?.trim());
}

/** A feature shows only when its switch is "1" and a listed provider can answer (photo-to-listing decision 14). */
export function aiFeatureOn(feature: AiFeature, env: Env = process.env): boolean {
  return env[SWITCHES[feature]] === "1" && aiProviders(env).some((name) => providerHasKey(name, env));
}
```

- [ ] **Step 4: Point the two callers at it.** In `lib/selling/listing-actions.ts`, replace line 24 `import { listingAiOn } from "./ai-config";` with:

```ts
import { aiFeatureOn } from "@/lib/ai/config";
```

and at line 262 replace `listingAiOn()` with `aiFeatureOn("listing")`.

In `app/privacy/page.tsx`, replace line 5 with:

```ts
import { aiFeatureOn, aiProviders, providerHasKey } from "@/lib/ai/config";
```

and in `photoFillLine()` replace `listingAiOn()` with `aiFeatureOn("listing")` and `listingAiProviders()` with `aiProviders()`. (Task 6 rewrites the rest of that function.)

Two more importers, found while building: in `components/sell/ListingForm.tsx` import `aiFeatureOn` from `"@/lib/ai/config"` and call `aiFeatureOn("listing")` in place of `listingAiOn()`; in `lib/data/listing-ai.ts` import `aiProviders, providerHasKey, type ProviderName` from `"@/lib/ai/config"` and call `aiProviders()` (Task 3 moves that file).

- [ ] **Step 5: Remove the old files** (named in this plan, nothing else):

```bash
rm lib/selling/ai-config.ts lib/selling/ai-config.test.ts
```

- [ ] **Step 6: Run the tests.**

Run: `pnpm vitest run lib/ai/config.test.ts lib/selling/listing-actions.test.ts app/privacy/page.test.tsx`
Expected: all pass. (The privacy test still sets the old `VOSSIE_LISTING_AI_PROVIDERS`, which is still read; Task 6 moves it to the new name.)

Run: `grep -rn "selling/ai-config\|listingAiOn\|listingAiProviders" app lib components tests`
Expected: no output.

---

### Task 2: The instruction names every category

**Files:**
- Modify: `lib/selling/suggest.ts` (lines 34 to 46: `SUGGESTION_INSTRUCTION`)
- Test: `lib/selling/suggest.test.ts`

- [ ] **Step 1: Write the failing test.** Add to the end of `lib/selling/suggest.test.ts`, and add `CATEGORY_HINTS, suggestionInstruction` to its import from `./suggest`, plus `import { categories } from "@/data/fixtures/categories";`:

```ts
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
```

- [ ] **Step 2: Run it and see it fail.**

Run: `pnpm vitest run lib/selling/suggest.test.ts`
Expected: FAIL, `CATEGORY_HINTS` and `suggestionInstruction` aren't exported.

- [ ] **Step 3: Replace `SUGGESTION_INSTRUCTION`** (the whole `export const SUGGESTION_INSTRUCTION = [ … ].join("\n");` block) with:

```ts
/** A category as the instruction names it. */
export type CategoryChoice = { slug: string; name: string };

/** What belongs in each category, for the model (AI features spec 2.3). A category without a line gets its name. */
export const CATEGORY_HINTS: Readonly<Record<string, string>> = {
  "textbooks-notes": "textbooks, study guides, lecture notes and summaries",
  tech: "laptops, phones, tablets, calculators, chargers, headphones and other electronics",
  "res-living": "furniture, bedding, kitchen things, small appliances and anything else for a room or res",
  "fashion-thrift": "clothes, shoes, bags, jewellery and other fashion, new or second-hand",
  food: "home-made, baked or packaged food, snacks and drinks",
  "hair-beauty": "hair products, wigs, make-up, skincare, and hair or beauty services",
  tutoring: "lessons and help with a module or subject",
  services: "other services, such as printing, repairs, photography, design or moving",
  "tickets-events": "tickets to events, shows and parties",
  stationery: "pens, files, notebooks, art and drawing supplies, lab coats and other things for class",
};

/** The system prompt every provider gets (spec decisions 5 to 10; AI features spec 2.3 and 2.4). */
export function suggestionInstruction(categories: readonly CategoryChoice[]): string {
  const choices = categories.map(({ slug, name }) =>
    CATEGORY_HINTS[slug] ? `- ${slug}: ${name}, such as ${CATEGORY_HINTS[slug]}` : `- ${slug}: ${name}`,
  );
  return [
    "You help a university student in South Africa list something for sale on CampusCart, the marketplace for Eduvos campuses.",
    "You get one to three photos of one item or service, the cover photo first. Describe it for its listing, in plain South African English.",
    "Write plain text only: no markdown, no asterisks, no bullet points. Describe only what you can see; don't guess.",
    "title: what it is, up to 70 characters, brand and model where you can read them. For a textbook, its title and edition.",
    "categorySlug: the one category that fits best, from these:",
    ...choices,
    "condition: how worn it looks (new, like-new, good or fair).",
    "description: two or three short sentences a buyer would want, from what you can see. Never guess or mention a price.",
    "alt: one short, complete sentence of at most 120 characters describing the cover photo for someone who can't see it.",
    "isTextbook and moduleCode: the module code printed on a textbook's cover or spine (such as FAC1501), else null.",
    "personIsSubject: true when a person, not an item, is the main subject. Never describe a person.",
    "confidence: low when you can't tell what the item is.",
  ].join("\n");
}
```

- [ ] **Step 4: Run it and see it pass.**

Run: `pnpm vitest run lib/selling/suggest.test.ts`
Expected: PASS. (`lib/data/listing-ai.ts` still imports `SUGGESTION_INSTRUCTION`, so `pnpm typecheck` fails until Task 4. That's expected.)

---

### Task 3: Move the door to `lib/data/ai`

A move with no change in behaviour, so Task 4's diff shows only what changes.

**Files:**
- Move: `lib/data/listing-ai.ts` → `lib/data/ai.ts`; `lib/data/listing-ai/` → `lib/data/ai/`
- Modify: `lib/selling/listing-actions.ts` line 8, `lib/selling/listing-actions.test.ts` lines 6, 7 and 38

- [ ] **Step 1: Check what's there**, as a separate call from the move:

Run: `ls lib/data/listing-ai lib/data/listing-ai.ts && ls lib/data/ai lib/data/ai.ts 2>&1`
Expected: the five files `anthropic.ts fake.ts groq.test.ts groq.ts types.ts` and `lib/data/listing-ai.ts`; then "No such file or directory" for both `ai` paths. If `lib/data/ai` exists, stop and ask.

- [ ] **Step 2: Move them** (plain `mv`; the controller stages the move):

```bash
mv lib/data/listing-ai lib/data/ai
```

```bash
mv lib/data/listing-ai.ts lib/data/ai.ts
```

- [ ] **Step 3: Fix the paths.** In `lib/data/ai.ts`, change every `./listing-ai/` to `./ai/` (the three `import()` calls in `LOAD` and the `import type … from "./listing-ai/types"`). In `lib/selling/listing-actions.ts` line 8 change `"@/lib/data/listing-ai"` to `"@/lib/data/ai"`. In `lib/selling/listing-actions.test.ts` change `"@/lib/data/listing-ai"` (lines 6 and 38) to `"@/lib/data/ai"` and `"@/lib/data/listing-ai/fake"` (line 7) to `"@/lib/data/ai/fake"`.

- [ ] **Step 4: Check nothing points at the old path.**

Run: `grep -rn "listing-ai" app lib components tests scripts`
Expected: no output.

Run: `pnpm vitest run lib/data/ai/groq.test.ts`
Expected: PASS (3 tests).

---

### Task 4: A request carries a system prompt and up to three photos

`types.ts`, both real providers and the door change together. `pnpm typecheck` passes again at the end of this task, not before.

**Files:**
- Modify: `lib/data/ai/types.ts`, `lib/data/ai/anthropic.ts`, `lib/data/ai/groq.ts`, `lib/data/ai/groq.test.ts`, `lib/data/ai.ts`
- Create: `lib/data/ai/anthropic.test.ts`, `lib/data/ai.test.ts`

- [ ] **Step 1: Write the failing provider test.** Create `lib/data/ai/anthropic.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());

// The SDK's real error classes, with only the request faked: the provider tells failures apart by class.
vi.mock("@anthropic-ai/sdk", async (original) => {
  const real = (await original<typeof import("@anthropic-ai/sdk")>()).default;
  class FakeAnthropic {
    messages = { create };
    static APIConnectionTimeoutError = real.APIConnectionTimeoutError;
    static RateLimitError = real.RateLimitError;
    static NotFoundError = real.NotFoundError;
  }
  return { default: FakeAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { read } from "./anthropic";

const REQUEST = {
  system: "Describe it.",
  images: [
    { type: "image/jpeg" as const, base64: "AQ==" },
    { type: "image/png" as const, base64: "Ag==" },
  ],
  text: "The photos show one item or service, the cover first.",
  schema: { type: "object" },
};
const answer = (text: string, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });

afterEach(() => {
  create.mockReset();
  vi.unstubAllEnvs();
});

describe("the Haiku provider (AI features spec 2.2 to 2.5)", () => {
  it("sends the system prompt, every photo in order, then the text, at low effort in 10 seconds", async () => {
    create.mockResolvedValueOnce(answer('{"title":"Dust"}'));
    expect(await read(REQUEST)).toEqual({ ok: true, text: '{"title":"Dust"}' });
    const [body, options] = create.mock.calls[0];
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      system: "Describe it.",
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object" } } },
    });
    expect(body.messages[0].content.map((block: { type: string }) => block.type)).toEqual(["image", "image", "text"]);
    expect(body.messages[0].content[1].source).toEqual({ type: "base64", media_type: "image/png", data: "Ag==" });
    expect(options).toEqual({ timeout: 10_000 });
  });

  it("thinks at medium effort with 15 seconds when VOSSIE_HAIKU_EFFORT says so", async () => {
    vi.stubEnv("VOSSIE_HAIKU_EFFORT", "medium");
    create.mockResolvedValueOnce(answer("{}"));
    await read(REQUEST);
    const [body, options] = create.mock.calls[0];
    expect(body.output_config.effort).toBe("medium");
    expect(options).toEqual({ timeout: 15_000 });
  });

  it("answers a refusal and a cut-off reply as answers, and a busy service as a reason to move on", async () => {
    create.mockResolvedValueOnce(answer("", "refusal"));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "refusal" });
    create.mockResolvedValueOnce(answer('{"title":', "max_tokens"));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "bad-output" });
    create.mockRejectedValueOnce(new Anthropic.RateLimitError(429, {}, "Too many requests", new Headers()));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "rate-limited" });
    create.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError());
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "timeout" });
  });
});
```

- [ ] **Step 2: Add Groq's cover-only test.** In `lib/data/ai/groq.test.ts` replace the `REQUEST` line with:

```ts
const REQUEST = {
  system: "Describe it.",
  images: [
    { type: "image/jpeg" as const, base64: "AQID" },
    { type: "image/jpeg" as const, base64: "BAUG" },
  ],
  text: "The photos show one item or service, the cover first.",
  schema: {},
};
```

and add this test inside the `describe` block:

```ts
  it("sends the system prompt as a system message and the cover photo only (AI features spec 2.2)", async () => {
    create.mockResolvedValueOnce(answer("{}"));
    await read(REQUEST);
    const { messages } = create.mock.calls[0][0];
    expect(messages[0]).toEqual({ role: "system", content: "Describe it." });
    const images = messages[1].content.filter((part: { type: string }) => part.type === "image_url");
    expect(images).toEqual([{ type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } }]);
  });
```

- [ ] **Step 3: Write the failing door test.** Create `lib/data/ai.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const haiku = vi.hoisted(() => vi.fn());
const groq = vi.hoisted(() => vi.fn());
vi.mock("./ai/anthropic", () => ({ read: haiku }));
vi.mock("./ai/groq", () => ({ read: groq }));

import { listingRequest, readListingPhotos } from "./ai";
import { FAKE_REPLY } from "./ai/fake";

const CATEGORIES = [
  { slug: "textbooks-notes", name: "Textbooks & notes" },
  { slug: "tech", name: "Tech" },
];
const photo = (byte: number) => ({ type: "image/jpeg" as const, bytes: new Uint8Array([byte]) });
const REPLY = JSON.stringify(FAKE_REPLY);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  haiku.mockReset();
  groq.mockReset();
});

function bothProviders() {
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "anthropic,groq");
  vi.stubEnv("ANTHROPIC_API_KEY", "k");
  vi.stubEnv("GROQ_API_KEY", "k");
  vi.spyOn(console, "warn").mockImplementation(() => {});
}

describe("the provider door (AI features spec 7.1)", () => {
  it("sends at most three photos, the cover first, with the instruction as the system prompt", () => {
    const request = listingRequest([1, 2, 3, 4].map(photo), CATEGORIES);
    expect(request.images.map((image) => image.base64)).toEqual(["AQ==", "Ag==", "Aw=="]);
    expect(request.system).toContain("- tech: Tech, such as laptops");
    expect(request.schema).toMatchObject({ properties: { categorySlug: { enum: ["textbooks-notes", "tech"] } } });
  });

  it("asks Haiku first, and Groq only when Haiku couldn't answer", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    groq.mockResolvedValueOnce({ ok: true, text: REPLY });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true, suggestion: { moduleCode: "FAC1501" } });
    expect(haiku).toHaveBeenCalledTimes(1);
    expect(groq).toHaveBeenCalledTimes(1);
  });

  it("stops at Haiku's answer, a refusal included, so the photos go to one provider", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toEqual({ ok: false, failure: "refusal" });
    haiku.mockResolvedValueOnce({ ok: true, text: REPLY });
    expect(await readListingPhotos([photo(1)], CATEGORIES)).toMatchObject({ ok: true });
    expect(groq).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the three and see them fail.**

Run: `pnpm vitest run lib/data/ai.test.ts lib/data/ai/anthropic.test.ts lib/data/ai/groq.test.ts`
Expected: FAIL: `listingRequest` isn't exported; the providers read `image`, not `images`.

- [ ] **Step 5: Change `ProviderRequest`.** In `lib/data/ai/types.ts` replace the `ProviderRequest` type with:

```ts
/** One photo as a provider gets it. */
export type ProviderImage = { type: PhotoType; base64: string };

export type ProviderRequest = {
  /** The instruction, sent as the system prompt. */
  system: string;
  /** None to three photos in the seller's order, the cover first (AI features spec 2.2). Groq reads only the first. */
  images: readonly ProviderImage[];
  /** What's asked of the photos. */
  text: string;
  schema: Readonly<Record<string, unknown>>;
};
```

and change the file's opening comment's "spec decision 9" to "photo-to-listing spec decision 9; AI features spec 7.1".

- [ ] **Step 6: Rewrite `lib/data/ai/anthropic.ts`** (whole file):

```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER_TIMEOUT_MS, type ProviderFailure, type ReadPhoto } from "./types";

// Claude Haiku 5.5, the first choice (AI features spec decision 1, Lama's Q1), with structured outputs. It reads every
// photo it's sent. Its effort is VOSSIE_HAIKU_EFFORT, low (the default) or medium, chosen by the photo test (spec
// section 8); medium thinks for longer, so it gets 15 seconds. The key is read on first use, never at module scope.

export const HAIKU_MODEL = "claude-haiku-5-5";

type Effort = "low" | "medium";
const effort = (): Effort => (process.env.VOSSIE_HAIKU_EFFORT === "medium" ? "medium" : "low");
const TIMEOUT_MS: Readonly<Record<Effort, number>> = { low: PROVIDER_TIMEOUT_MS, medium: 15_000 };

let client: Anthropic | null = null;
// Logging pinned off, so an ANTHROPIC_LOG=debug environment can never log a request, and with it a base64 photo.
const anthropic = () =>
  (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, logLevel: "off" }));

function failureOf(error: unknown): ProviderFailure {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.RateLimitError) return "rate-limited";
  if (error instanceof Anthropic.NotFoundError) return "model-gone";
  return "api-error";
}

export const read: ReadPhoto = async ({ system, images, text, schema }) => {
  const level = effort();
  try {
    const message = await anthropic().messages.create(
      {
        model: HAIKU_MODEL,
        // A reply is about 150 to 300 tokens; the rest leaves room for medium effort's thinking.
        max_tokens: 4096,
        system,
        output_config: { effort: level, format: { type: "json_schema", schema: { ...schema } } },
        messages: [
          {
            role: "user",
            content: [
              ...images.map((image) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: image.type, data: image.base64 },
              })),
              { type: "text" as const, text },
            ],
          },
        ],
      },
      { timeout: TIMEOUT_MS[level] },
    );
    if (message.stop_reason === "refusal") return { ok: false, failure: "refusal" };
    // Cut off: the JSON is unfinished, so it's an answer that fails the check, not a busy service.
    if (message.stop_reason === "max_tokens") return { ok: false, failure: "bad-output" };
    const reply = message.content.find((block) => block.type === "text");
    return reply && reply.type === "text" ? { ok: true, text: reply.text } : { ok: false, failure: "api-error" };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
};
```

- [ ] **Step 7: Change Groq's request.** In `lib/data/ai/groq.ts`, in the comment above `GROQ_MODEL` add a second sentence: `It reads the cover photo only: Groq counts every image as 2,048 tokens against the free tier (AI features spec 2.2).` Then replace the start of `ask` down to the end of its `messages` array with:

```ts
async function ask({ system, images, text, schema }: ProviderRequest): Promise<ProviderReply | typeof REFUSED_FORMAT> {
  // VOSSIE_GROQ_FORMAT=json_object if strict json_schema turns out to refuse an image (plan change 8).
  const strict = process.env.VOSSIE_GROQ_FORMAT !== "json_object";
  const cover = images[0];
  try {
    const completion = await groq().chat.completions.create({
      model: GROQ_MODEL,
      // A reply is about 150 to 300 tokens. Groq counts this reserve toward the free tier's 8,000 tokens a minute, so
      // 512 rather than 1,024 lets about twice as many fills through (spec section 13); a reply cut off is bad-output.
      max_completion_tokens: 512,
      // No reasoning ("none", which groq-sdk 1.6.0 documents for qwen3 models) and none returned: reasoning tokens
      // could use up the completion tokens or the 10 seconds before the JSON is written.
      reasoning_effort: "none",
      reasoning_format: "hidden",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: strict ? text : `${text}\nAnswer with JSON only.` },
            ...(cover ? [{ type: "image_url" as const, image_url: { url: `data:${cover.type};base64,${cover.base64}` } }] : []),
          ],
        },
      ],
```

Everything from `response_format:` down stays as it is.

- [ ] **Step 8: Rewrite the door, `lib/data/ai.ts`** (whole file):

```ts
// lib/data/ai.ts
import "server-only";
import { aiProviders, providerHasKey, type ProviderName } from "@/lib/ai/config";
import {
  checkSuggestion,
  suggestionInstruction,
  suggestionSchema,
  type CategoryChoice,
  type Suggestion,
  type SuggestFailure,
} from "@/lib/selling/suggest";
import type { PhotoType } from "@/lib/types";
import type { ProviderFailure, ProviderRequest, ReadPhoto } from "./ai/types";

// The only door to the AI providers (AI features spec 7.1; photo-to-listing spec decisions 9 to 11). Each provider file
// is loaded only when it's tried, so an SDK is never in a page's code. Failures are logged by provider and kind only:
// never a photo or text.

const LOAD: Readonly<Record<ProviderName, () => Promise<{ read: ReadPhoto }>>> = {
  anthropic: () => import("./ai/anthropic"),
  groq: () => import("./ai/groq"),
  fake: () => import("./ai/fake"),
};

/** These mean the provider couldn't answer, so the next one is tried (photo-to-listing decision 11). */
const MOVE_ON: ReadonlySet<ProviderFailure> = new Set(["timeout", "rate-limited", "model-gone", "api-error"]);

/** Photo-to-listing reads at most this many photos, the cover first (AI features spec 2.2). */
export const PHOTOS_READ = 3;

export type ListingReading = { ok: true; suggestion: Suggestion } | { ok: false; failure: SuggestFailure };

type Photo = { type: PhotoType; bytes: Uint8Array };

function logFailure(provider: ProviderName, failure: SuggestFailure): void {
  console.warn(`[vossie] photo-to-listing: ${provider} ${failure}`);
}

/** What photo-to-listing asks. Exported for the photo test (`scripts/photo-test.hand.ts`). */
export function listingRequest(photos: readonly Photo[], categories: readonly CategoryChoice[]): ProviderRequest {
  return {
    system: suggestionInstruction(categories),
    images: photos.slice(0, PHOTOS_READ).map((photo) => ({
      type: photo.type,
      base64: Buffer.from(photo.bytes).toString("base64"),
    })),
    text: "The photos show one item or service, the cover first.",
    schema: suggestionSchema(categories.map((category) => category.slug)),
  };
}

export async function readListingPhotos(
  photos: readonly Photo[],
  categories: readonly CategoryChoice[],
): Promise<ListingReading> {
  const request = listingRequest(photos, categories);
  const slugs = categories.map((category) => category.slug);
  let last: SuggestFailure = "api-error";
  for (const name of aiProviders()) {
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
    const checked = checkSuggestion(reply.text, slugs);
    if (typeof checked === "string") {
      logFailure(name, checked);
      return { ok: false, failure: checked };
    }
    return { ok: true, suggestion: checked };
  }
  return { ok: false, failure: last };
}
```

- [ ] **Step 9: Run the tests and see them pass.**

Run: `pnpm vitest run lib/data/ai.test.ts lib/data/ai/anthropic.test.ts lib/data/ai/groq.test.ts lib/selling/suggest.test.ts`
Expected: PASS (door 3, Haiku 3, Groq 4, suggest all).

Run: `grep -rn "SUGGESTION_INSTRUCTION\|readCoverPhoto" app lib components tests scripts`
Expected: only `lib/selling/listing-actions.ts` and its test (Task 5 changes both).

---

### Task 5: The listing form sends up to three photos

**Files:**
- Modify: `lib/selling/listing-actions.ts` (line 8 import, `suggestFromCover` at lines 136 to 178, its call at line 263)
- Test: `lib/selling/listing-actions.test.ts` (the "filling in from a photo" block, lines 692 to 826)

- [ ] **Step 1: Update the test block and add the three-photo test.** In `lib/selling/listing-actions.test.ts`:
  - line 6: `import { readListingPhotos } from "@/lib/data/ai";`
  - line 38: `vi.mock("@/lib/data/ai", () => ({ PHOTOS_READ: 3, readListingPhotos: vi.fn() }));`
  - in the block's `beforeEach`, replace `vi.stubEnv("VOSSIE_LISTING_AI_PROVIDERS", "fake");` with `vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");`
  - replace every `readCoverPhoto` in the block with `readListingPhotos` (a find and replace inside lines 692 to 826)

  Then add this test after "fills the empty fields, tags them, …":

```ts
  it("sends up to three photos and the categories' names (AI features spec 2.2 and 2.3)", async () => {
    await signedInAs("acc-seller");
    vi.mocked(readListingPhotos).mockResolvedValue({ ok: true, suggestion });
    const files = [1, 2, 3, 4].map((n) => photoFile(pngBytes(), `photo-${n}.png`));
    await redirectOf(async () => saveListingForm(await suggestForm({ newPhotos: files })));
    const [photos, categories] = vi.mocked(readListingPhotos).mock.calls[0];
    expect(photos).toHaveLength(3);
    expect(categories).toContainEqual(expect.objectContaining({ slug: "tech", name: "Tech" }));
  });
```

- [ ] **Step 2: Run it and see it fail.**

Run: `pnpm vitest run lib/selling/listing-actions.test.ts -t "filling in from a photo"`
Expected: FAIL: `readListingPhotos` is never called, because the action still calls `readCoverPhoto`.

- [ ] **Step 3: Change the action.** In `lib/selling/listing-actions.ts`, line 8 becomes:

```ts
import { PHOTOS_READ, readListingPhotos } from "@/lib/data/ai";
```

Replace the doc comment's first sentence and the whole `suggestFromCover` function (lines 136 to 178) with:

```ts
/**
 * "Fill in from my photo" (photo-to-listing spec decisions 1 to 6, 12; AI features spec 2.2): reads the cover and up to
 * two photos after it, fills the empty fields, and comes back to the form with what was typed, the photos, and a
 * notice. No token is taken and no listing is made. The cover is read first, so a refused one uses no press; the press
 * is counted only once it's about to reach a provider, and the five sample accounts aren't counted in sample mode.
 *
 * An infrastructure error (a database call, a provider that won't load) comes back as "couldn't read", with the form,
 * rather than the action's error page, which would lose what was typed. Nothing inside redirects, so the catch can't
 * swallow one. Only the kind is logged: the error's message may hold data.
 */
async function suggestFromPhotos(
  owner: ShopOwner,
  values: Record<string, string>,
  order: readonly string[],
  now: Date,
): Promise<{ values: Record<string, string>; notice: string }> {
  const cover = order[0] ?? null;
  const id = cover ? photoIdOf(cover) : null;
  if (!cover || !id) return { values, notice: "suggest-no-photo" };
  try {
    const viewer = async () => ({ id: owner.account.id, hubStaff: false });
    const photo = await photoFor(id, viewer, now);
    if (!photo) return { values, notice: "suggest-failed" };
    if (!isSampleAccount(owner.account) && !(await reservePhotoFill(owner.account.id, now, PHOTO_FILLS_PER_DAY))) {
      return { values, notice: "suggest-limit" };
    }
    // The photos after the cover go too when they load; one that doesn't is left out.
    const more = await Promise.all(
      order.slice(1, PHOTOS_READ).map(async (src) => {
        const other = photoIdOf(src);
        return other ? photoFor(other, viewer, now) : null;
      }),
    );
    const photos = [photo, ...more.filter((each) => each !== null)].map(({ type, bytes }) => ({ type, bytes }));
    const reading = await readListingPhotos(photos, await getCategories());
    if (!reading.ok) return { values, notice: failureNotice(reading.failure) };
    const merged = mergeSuggestion(values, reading.suggestion, cover);
    // Every field the fill could write already had text: say so, not "We filled in 0 fields". The press still counts.
    if (merged.suggested.length === 0) return { values, notice: "suggest-nothing" };
    return {
      values: {
        ...merged.values,
        suggested: merged.suggested.join(" "),
        suggestedModule: reading.suggestion.moduleCode ?? "",
      },
      notice: "suggested",
    };
  } catch {
    console.warn("[vossie] photo-to-listing: suggest error");
    return { values, notice: "suggest-failed" };
  }
}
```

At the call (line 263), replace `await suggestFromCover(owner, typed, order, context, now)` with `await suggestFromPhotos(owner, typed, order, now)`. If `ListingContext` is now unused in that call's surroundings, leave its import: `context` is still used by the save path.

- [ ] **Step 4: Run the tests and see them pass.**

Run: `pnpm vitest run lib/selling/listing-actions.test.ts`
Expected: PASS, the new test included.

Run: `pnpm typecheck`
Expected: no errors. (If `more.filter((each) => each !== null)` doesn't narrow on this TypeScript version, write `more.filter((each): each is NonNullable<typeof each> => each !== null)`.)

---

### Task 6: The privacy line says what each provider gets

**Files:**
- Modify: `app/privacy/page.tsx` (`photoFillLine`, lines 15 to 45)
- Test: `app/privacy/page.test.tsx` (lines 452 to 487)

- [ ] **Step 1: Rewrite the test block.** Replace the `describe("photo-to-listing's line …")` block's `lineWith` query and its two tests with:

```ts
  /** The page's sections are built when its module loads, so each case loads it afresh under its settings. */
  async function lineWith(env: Record<string, string>) {
    vi.stubEnv("VOSSIE_LISTING_AI", "1");
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.resetModules();
    const { default: Page } = await import("./page");
    const { unmount } = render(<Page />);
    const line = screen.queryByText(/to read what the item is/)?.textContent ?? null;
    unmount();
    return line;
  }

  it("names only the providers a photo could go to, what each gets and keeps, and that it leaves South Africa", async () => {
    const both = await lineWith({ VOSSIE_AI_PROVIDERS: "anthropic,groq", ANTHROPIC_API_KEY: "test", GROQ_API_KEY: "test" });
    expect(both).toContain(
      "up to three of your photos (the cover first) are sent to Anthropic, an AI provider in the United States, which doesn't use them to train its models",
    );
    expect(both).toContain("If Anthropic can't answer, your cover photo goes to Groq, an AI provider in the United States");
    expect(both).toContain("read outside South Africa");
    expect(both).toContain("Nothing is sent unless you press the button, and you check every suggested field");

    const groq = await lineWith({ VOSSIE_AI_PROVIDERS: "anthropic,groq", ANTHROPIC_API_KEY: "", GROQ_API_KEY: "test" });
    expect(groq).toContain("your cover photo is sent to Groq, an AI provider in the United States, which keeps nothing from it");
    expect(groq).not.toContain("Anthropic");
  });

  it("shows no line with only the fake provider", async () => {
    expect(await lineWith({ VOSSIE_AI_PROVIDERS: "fake" })).toBeNull();
  });
```

- [ ] **Step 2: Run it and see it fail.**

Run: `pnpm vitest run app/privacy/page.test.tsx -t "photo-to-listing"`
Expected: FAIL: the line still says "your cover photo is sent to Anthropic".

- [ ] **Step 3: Rewrite `photoFillLine`** (its doc comment and body; the `<li>` keeps its place in the sections):

```tsx
/**
 * Photo-to-listing's line (photo-to-listing spec section 4, AI features spec 7.3): the providers a photo could actually
 * go to, in order, with what each gets and keeps. Built at module scope like the sections, so it's fixed at build:
 * redeploy after changing the providers or their keys.
 */
function photoFillLine() {
  if (!aiFeatureOn("listing")) return null;
  const used = aiProviders().filter((name) => name !== "fake" && providerHasKey(name));
  if (used.length === 0) return null;
  const words = {
    anthropic: {
      name: "Anthropic",
      sent: "up to three of your photos (the cover first) are sent to",
      goes: "up to three of your photos go to",
      line: "Anthropic, an AI provider in the United States, which doesn't use them to train its models",
    },
    groq: {
      name: "Groq",
      sent: "your cover photo is sent to",
      goes: "your cover photo goes to",
      line: "Groq, an AI provider in the United States, which keeps nothing from it (we've turned on its zero data retention)",
    },
  } as const;
  const chain = used.map((name) => words[name as keyof typeof words]);
  // A later provider sees a photo only when the one before it couldn't answer (photo-to-listing decision 11).
  const fallbacks = chain.slice(1).map((next, index) => ` If ${chain[index].name} can't answer, ${next.goes} ${next.line}.`);
  return (
    <li>
      When you press Fill in from my photo on a new listing, {chain[0].sent} {chain[0].line}, to read what the item
      is.{fallbacks.join("")} So your photos are read outside South Africa. Nothing is sent unless you press the button,
      and you check every suggested field before you publish.
    </li>
  );
}
```

Keep whatever followed the `</li>` in the old function (check the old lines 40 to 45 before replacing; if the old `<li>` had more text after "before you publish.", keep that text too).

- [ ] **Step 4: Run it and see it pass.**

Run: `pnpm vitest run app/privacy/page.test.tsx`
Expected: PASS, the cookie-name test included.

---

### Task 7: The photo test, run by hand

A Vitest file outside `pnpm test`, so it can use the real providers and the `@/` paths. It never runs in CI.

**Files:**
- Create: `vitest.hand.config.mts`, `scripts/photo-test.hand.ts`

- [ ] **Step 1: Create `vitest.hand.config.mts`:**

```ts
import { defineConfig } from "vitest/config";

// Checks run by hand with real keys (AI features spec section 8): never in `pnpm test` or CI. Node, not jsdom, because
// the Anthropic SDK refuses to run in a browser-like environment.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { environment: "node", include: ["scripts/**/*.hand.ts"] },
});
```

- [ ] **Step 2: Create `scripts/photo-test.hand.ts`:**

```ts
// scripts/photo-test.hand.ts
// The photo test (AI features spec section 8), run by hand with real keys, never in CI:
//   VOSSIE_PHOTO_TEST=~/campuscart-photo-test pnpm vitest run --config vitest.hand.config.mts
// Each item in that folder ("calculator.jpg", or "calculator-1.jpg", "calculator-2.jpg" … with -1 the cover) is read by
// Groq (the cover only) and by Haiku at low and at medium effort. The results go to results.md in the same folder. An
// optional expected.json ({ "calculator": { "categorySlug": "tech", "moduleCode": null } }) adds a column to compare.
// Keys come from .env.local. It costs a few cents. Photos of people need their consent.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { categories } from "@/data/fixtures/categories";
import { listingRequest } from "@/lib/data/ai";
import { read as readHaiku } from "@/lib/data/ai/anthropic";
import { read as readGroq } from "@/lib/data/ai/groq";
import { checkSuggestion } from "@/lib/selling/suggest";
import type { PhotoType } from "@/lib/types";

const TYPES: Readonly<Record<string, PhotoType>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
/** Groq's free tier allows about 3 photo reads a minute (photo-to-listing spec section 13). */
const GROQ_PAUSE_MS = 20_000;

type Expected = Record<string, { categorySlug?: string; moduleCode?: string | null }>;

/** The folder's photos by item, in name order, so "-1" is each item's cover. */
function items(dir: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const file of readdirSync(dir).sort()) {
    if (!TYPES[extname(file).toLowerCase()]) continue;
    const item = file.replace(/(-\d+)?\.[^.]+$/, "");
    groups.set(item, [...(groups.get(item) ?? []), file]);
  }
  return groups;
}

describe("the photo test (by hand)", () => {
  it("reads every item with each provider and writes results.md", { timeout: 60 * 60_000 }, async () => {
    const dir = process.env.VOSSIE_PHOTO_TEST;
    if (!dir) throw new Error("Set VOSSIE_PHOTO_TEST to the folder of test photos.");
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    const expectedFile = join(dir, "expected.json");
    const expected: Expected = existsSync(expectedFile) ? JSON.parse(readFileSync(expectedFile, "utf8")) : {};
    const slugs = categories.map((category) => category.slug);
    const runs = [
      { name: "groq", read: readGroq, effort: null },
      { name: "haiku low", read: readHaiku, effort: "low" },
      { name: "haiku medium", read: readHaiku, effort: "medium" },
    ] as const;
    const rows = [
      "| Item | Run | ms | Result | Title | Category | Condition | Module | Expected |",
      "|---|---|---|---|---|---|---|---|---|",
    ];
    for (const [item, files] of items(dir)) {
      const photos = files.map((file) => ({
        type: TYPES[extname(file).toLowerCase()],
        bytes: new Uint8Array(readFileSync(join(dir, file))),
      }));
      const request = listingRequest(photos, categories);
      for (const run of runs) {
        if (run.effort) process.env.VOSSIE_HAIKU_EFFORT = run.effort;
        const started = performance.now();
        const reply = await run.read(request);
        const ms = Math.round(performance.now() - started);
        const checked = reply.ok ? checkSuggestion(reply.text, slugs) : reply.failure;
        const cells =
          typeof checked === "string"
            ? [checked, "", "", "", ""]
            : ["ok", checked.title, checked.categorySlug, checked.condition, checked.moduleCode ?? ""];
        const want = expected[item];
        const wanted = want ? `${want.categorySlug ?? ""} ${want.moduleCode ?? ""}`.trim() : "";
        rows.push(`| ${item} | ${run.name} | ${ms} | ${cells.join(" | ")} | ${wanted} |`);
        if (run.name === "groq") await new Promise((resolve) => setTimeout(resolve, GROQ_PAUSE_MS));
      }
    }
    writeFileSync(join(dir, "results.md"), `${rows.join("\n")}\n`);
  });
});
```

- [ ] **Step 3: Check it's left out of the normal run and type-checks.**

Run: `pnpm vitest run --reporter=dot 2>&1 | tail -5`
Expected: every test passes, and the output never names `photo-test.hand.ts`.

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

---

### Task 8: Docs, settings example and the full checks

**Files:**
- Modify: `.env.example` (end of file), `docs/reference/GO-LIVE.md` (the "Photo-to-listing (after the submission)" block, lines 207 to 216), `CLAUDE.md` (the photo-to-listing bullet), `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md` (status line), `docs/superpowers/specs/2026-11-03-ai-features-design.md` (new section 12)

- [ ] **Step 1: Append to `.env.example`:**

```bash

# The AI features (AI features spec 7.2). Server only. The providers in order: Claude Haiku first, Groq's free tier
# when Haiku couldn't answer; a provider without its key is skipped. The old name, VOSSIE_LISTING_AI_PROVIDERS, is
# still read. Real keys go in .env.local and the host's settings, never here.
# VOSSIE_AI_PROVIDERS=anthropic,groq
# ANTHROPIC_API_KEY=
# GROQ_API_KEY=
# Photo-to-listing's "Fill in from my photo": off unless 1, and only with a listed provider that has its key.
# VOSSIE_LISTING_AI=1
# Haiku's effort, low (the default, 10 seconds to answer) or medium (15 seconds), set from the photo test.
# VOSSIE_HAIKU_EFFORT=low
```

- [ ] **Step 2: Rewrite GO-LIVE's photo-to-listing block** (lines 207 to 216) as:

```markdown
### Photo-to-listing (after the submission)
Built 2026-10-27 and off for the submission (spec `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`, section 9). Haiku first since stage A of the AI features (spec `docs/superpowers/specs/2026-11-03-ai-features-design.md`, decision 96). Switch it on only when every line here is done.

- [x] **The hand check of Groq's strict `json_schema` with an image** (spec decision 9), done 2026-10-27 with Lama's Groq key: strict works with an image and no reasoning, so `VOSSIE_GROQ_FORMAT` stays unset. The outcome is in the spec's section 13. The very first press got a 429 that didn't repeat: watch the `rate-limited` count.
- [ ] **The photo test** (AI features spec section 8), with Lama's keys: about 30 photos, `VOSSIE_PHOTO_TEST=… pnpm vitest run --config vitest.hand.config.mts`. Set `VOSSIE_HAIKU_EFFORT` from it and note the outcome in the AI features spec's section 12.
- [ ] Lama: create the Anthropic key in the Anthropic console, and set a monthly spend limit there.
- [ ] Lama: create the Groq key.
- [ ] Lama: turn on Zero Data Retention in Groq's Data Controls.
- [ ] Lama: read Groq's Services Agreement (training, consumer use, liability) and note the answer here.
- [ ] Set `VOSSIE_LISTING_AI=1`, `VOSSIE_AI_PROVIDERS=anthropic,groq`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` and `VOSSIE_HAIKU_EFFORT` in Vercel, remove `VOSSIE_LISTING_AI_PROVIDERS` if it's there, then redeploy: the privacy page's line is drawn at build.
- [ ] Check Groq's deprecations page before switching on, then monthly.
- [ ] After two weeks, read the `[vossie] photo-to-listing:` log lines' counts by provider (`rate-limited`, `bad-output`, `low-confidence`, `refusal`).
```

- [ ] **Step 3: Update `CLAUDE.md`'s photo-to-listing bullet.** Replace:

`Providers are reached only through \`readCoverPhoto\` (\`lib/data/listing-ai.ts\`), each loaded by dynamic import`

with:

`Providers are reached only through \`lib/data/ai.ts\` (\`readListingPhotos\` for this feature; Haiku 5.5 first, Groq only when Haiku couldn't answer, up to three photos to Haiku and the cover to Groq), each loaded by dynamic import`

and replace:

`The feature's settings live only in \`lib/selling/ai-config.ts\` (\`VOSSIE_LISTING_AI\`, \`VOSSIE_LISTING_AI_PROVIDERS\`; the fake never on Supabase); a provider's own switch stays in its file (\`VOSSIE_GROQ_FORMAT\` in \`lib/data/listing-ai/groq.ts\`).`

with:

`Every AI feature's settings live only in \`lib/ai/config.ts\` (\`VOSSIE_AI_PROVIDERS\`, Haiku then Groq by default, and one switch per feature through \`aiFeatureOn\`: \`VOSSIE_LISTING_AI\` here; the fake never on Supabase); a provider's own switch stays in its file (\`VOSSIE_GROQ_FORMAT\` in \`lib/data/ai/groq.ts\`, \`VOSSIE_HAIKU_EFFORT\` in \`lib/data/ai/anthropic.ts\`).`

- [ ] **Step 4: Point the old spec at the new one.** In `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md`, append to the end of the status line (line 4): ` **2026-11-03:** Haiku first, up to three photos and the new door and settings, in the AI features spec (decision 96, stage A).`

- [ ] **Step 5: Add section 12 to the AI features spec** (`docs/superpowers/specs/2026-11-03-ai-features-design.md`, after section 11):

```markdown
## 12. Changes made while planning and building

### While planning stage A (2026-11-03, plan `docs/superpowers/plans/2026-11-03-ai-stage-a-haiku-first.md`)

1. **The category lines live in code** (`CATEGORY_HINTS` in `lib/selling/suggest.ts`), keyed by slug, not in the categories' data: the categories table has no description column, and a test fails when a category has no line.
2. **Haiku's effort is a setting,** `VOSSIE_HAIKU_EFFORT` (low by default), so the photo test can compare low and medium without a code change; medium gets 15 seconds.
3. **The photo test is a Vitest file run by hand** (`scripts/photo-test.hand.ts`, `vitest.hand.config.mts`), outside `pnpm test`, so it can use the real providers.
4. **`VOSSIE_LISTING_AI_PROVIDERS` is still read** when `VOSSIE_AI_PROVIDERS` is unset, until it's removed from Vercel.
```

- [ ] **Step 6: Run every check.**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all clean; the unit count is the last run's plus the new tests.

Run: `pnpm build`
Expected: the build succeeds. Then:

Run: `grep -lE "groq|anthropic" .next/static/chunks/*.js`
Expected: no output (no SDK in a browser chunk).

Run: `pnpm e2e tests/e2e/selling-writes.spec.ts`
Expected: the photo-to-listing test passes on the fake provider, as before.

- [ ] **Step 7: Hand over.** Leave everything uncommitted. Report the check results to the controller, who commits with Lama's go-ahead:

```bash
git status
```

The controller then stages only these paths, one command at a time (deleted and moved files included), and commits:

```bash
git add lib/ai lib/selling/ai-config.ts lib/selling/ai-config.test.ts lib/selling/suggest.ts lib/selling/suggest.test.ts lib/data/ai.ts lib/data/ai.test.ts lib/data/ai lib/data/listing-ai.ts lib/data/listing-ai lib/selling/listing-actions.ts lib/selling/listing-actions.test.ts app/privacy/page.tsx app/privacy/page.test.tsx vitest.hand.config.mts scripts/photo-test.hand.ts .env.example docs/reference/GO-LIVE.md CLAUDE.md docs/superpowers/specs/2026-10-24-photo-to-listing-design.md docs/superpowers/specs/2026-11-03-ai-features-design.md docs/superpowers/plans/2026-11-03-ai-stage-a-haiku-first.md
```

```bash
git commit -m "feat(ai): Haiku first for photo-to-listing, Groq as the fallback (decision 96, stage A)" -m "Up to three photos go to Claude Haiku 5.5 with the categories' names; Groq's free tier reads the cover only when Haiku couldn't answer. Every AI provider sits behind lib/data/ai.ts and every setting in lib/ai/config.ts (VOSSIE_AI_PROVIDERS, one switch per feature; the old VOSSIE_LISTING_AI_PROVIDERS still read). The privacy line says what each provider gets and that photos are read outside South Africa. The photo test runs by hand (vitest.hand.config.mts). Still off until GO-LIVE's photo-to-listing block is done." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The photo test with real keys (Lama's go-ahead; costs a few cents)

Not code: it decides `VOSSIE_HAIKU_EFFORT` before go-live.

- [ ] **Step 1: Lama gathers about 30 photos** in a folder outside the repo, for example `~/campuscart-photo-test/`: textbooks front and back (`book-1.jpg`, `book-2.jpg`), calculators, laptops, clothes, furniture, res kitchen kit, one with a person (with their consent), plus an `expected.json` for category and module code. On a copy, shrink them to at most 1600px as the listing form would (macOS):

```bash
sips -Z 1600 ~/campuscart-photo-test/*.jpg
```

- [ ] **Step 2: Put the two keys in `.env.local`** (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`), never in `.env.example`.

- [ ] **Step 3: Run it** (about 15 minutes, mostly Groq's pauses):

```bash
VOSSIE_PHOTO_TEST=~/campuscart-photo-test pnpm vitest run --config vitest.hand.config.mts
```

Expected: `~/campuscart-photo-test/results.md`, one row per item per run.

- [ ] **Step 4: Decide and record.** Compare Haiku low against medium (category and module code against expected, titles and conditions by eye, ms). Choose medium only if it's clearly better and answers in under 15 seconds. Write the outcome as item 5 under section 12's "While building" in the AI features spec, set `VOSSIE_HAIKU_EFFORT` in GO-LIVE's checklist, and tick GO-LIVE's photo test line. Never commit the photos or `results.md`.
