# AI stage B: the listing check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before a listing goes live, Haiku reads its title, description, category and cover photo against "What can't be sold"; a high-confidence match stops the publish with a notice and Publish anyway, which publishes and files a report for the Hub (AI features spec section 3, decision 96).

**Architecture:** A pure module (`lib/selling/listing-check.ts`) owns the concerns, the instruction, the schema, the reply check and when a save needs a check. The provider door (`lib/data/ai.ts`) gets `checkListingGuidelines`, Haiku and the fake only, failing open. `saveListingForm` runs it after the field checks and before the one-time token is taken; Publish anyway posts the concern, and after the save the action files a report with no reporter account ("The listing check") through `fileListingCheckReport` (sample store, and `public.file_listing_check_report` on Supabase). Off behind `VOSSIE_AI_LISTING_CHECK`.

**Tech Stack:** Next.js 16.4 Server Actions, `@anthropic-ai/sdk` 1.3.0 (structured outputs), Supabase Postgres (plpgsql, pgTAP), Vitest 5, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-03-ai-features-design.md` sections 3, 7 and 8. Read `CLAUDE.md` first (the photo-to-listing and reports rules apply as they are).

---

## Decisions made while planning (Lama may overturn any; they go in the spec's section 12 in Task 12)

1. **A report with no reporter account is the listing check's.** `reports.reporter_id` becomes nullable; null means "filed by the listing check", shown to staff as "The listing check". No new column: it's the only report without a student (YAGNI). At most one open listing-check report per listing (a partial unique index).
2. **Publish anyway posts the concern** (`anyway=counterfeit`), so no server state is kept between the two posts. A forged `anyway` skips the check only by filing a report against the seller's own listing, so it can't be used to slip past the Hub.
3. **When the check runs:** a publish (`intent=publish`, not Save as draft, not a waiting shop) of a new listing or a draft, and a save of a live, paused or sold listing whose title, description or photos changed (spec: "on Save when the title, description or photos changed"). Category and price changes alone don't.
4. **The check runs after the field checks and before the token is taken**, so a stopped publish keeps the form, its photos and its token, as a failed save does.
5. **The report is filed for any listing saved anyway that isn't a draft or hidden** (changed by the final review: "only when saved as available" left a paused or sold listing unreported, and Resume or Relist would then put it live unchecked). Filing failing is logged by kind and doesn't undo the save (the seller isn't shown an error page).
6. **The seller isn't told about the report.** The notice already says the Hub will take a look.
7. **Dismissing a listing-check report says "Dismissed."** (not "The reporter has been told"), and tells no one.
8. **The provider request names its task** (`task: "photo-to-listing" | "listing-check"`), so the fake answers each one and the log line names the feature.
9. **The e2e test dismisses its own report**, so `staff-writes`' "Open reports" link (the oldest open report) still finds the reports that test makes.

## File structure

| File | Responsibility |
|---|---|
| `lib/ai/config.ts` (modify) | `listing-check` feature, its switch, Haiku and fake only (`featureProviders`) |
| `lib/data/ai/types.ts` (modify) | `AiTask`, `ProviderRequest.task` |
| `lib/data/ai/fake.ts` (modify) | answers the listing check: stops a title with "fake" in it |
| `lib/selling/listing-check.ts` (create) | concerns and their words, instruction, schema, `parseVerdict`, `stopsPublish`, `parseConcern`, `checkNeeded`, `checkReportDetail` |
| `lib/data/ai.ts` (modify) | `checkRequest`, `checkListingGuidelines`; the log line takes the task |
| `lib/data/rows.ts`, `lib/data/reports.ts`, `lib/data/supabase/reports.ts` (modify) | nullable `reporterId`, `fileListingCheckReport` |
| `lib/data/staff-reports.ts`, `lib/data/supabase/staff-reports.ts` (modify) | "The listing check" as the reporter's name; nullable reporter in `ClosedReport` |
| `lib/staff/admin-actions.ts`, `lib/staff/notices.ts` (modify) | no notification for a null reporter; "Dismissed." |
| `supabase/migrations/20261104120000_listing_check.sql` (create) | nullable `reporter_id`, the index, `close_reports` guard, `file_listing_check_report` |
| `supabase/tests/62_listing_check.test.sql` (create) | pgTAP for the function and the guard |
| `lib/data/contract/listing-check.contract.ts`, `.test.ts`, `.db.test.ts` (create) | the same behaviour on both backends |
| `lib/selling/listing-actions.ts` (modify) | the check in `saveListingForm`, Publish anyway, the report |
| `components/sell/ListingCheck.tsx` (create), `components/sell/ListingFormView.tsx`, `components/sell/ListingForm.tsx` (modify) | the notice with Edit listing and Publish anyway |
| `app/privacy/page.tsx` (modify) | the check's line |
| `playwright.config.ts`, `tests/e2e/selling-writes.spec.ts` (modify) | switch on with the fake; the end-to-end test |
| docs (modify) | spec section 12, `GO-LIVE.md`, `PROGRESS.md`, `CLAUDE.md` |

Run unit tests for a task's files only (`pnpm exec vitest run <paths>`), the whole suite once at the end (Task 13). Never commit: leave each task's work uncommitted for the controller (memory: controller commits).

---

### Task 1: The feature's settings

**Files:**
- Modify: `lib/ai/config.ts`
- Test: `lib/ai/config.test.ts`

- [ ] **Step 1: Write the failing tests.** Add to `lib/ai/config.test.ts` inside the `describe`:

```ts
  it("turns the listing check on by its own switch, with Haiku or the fake, never Groq alone", () => {
    expect(aiFeatureOn("listing-check", { ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing-check", { VOSSIE_AI_LISTING_CHECK: "1", ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(aiFeatureOn("listing-check", { VOSSIE_AI_LISTING_CHECK: "1", GROQ_API_KEY: "k" })).toBe(false);
    expect(aiFeatureOn("listing-check", { VOSSIE_AI_LISTING_CHECK: "1", VOSSIE_AI_PROVIDERS: "fake" })).toBe(true);
    // Photo-to-listing's switch doesn't turn it on.
    expect(aiFeatureOn("listing-check", { VOSSIE_LISTING_AI: "1", ANTHROPIC_API_KEY: "k" })).toBe(false);
  });

  it("gives each feature the providers it may use that have their keys, in order", () => {
    const env = { VOSSIE_AI_PROVIDERS: "groq,anthropic", ANTHROPIC_API_KEY: "k", GROQ_API_KEY: "k" };
    expect(featureProviders("listing", env)).toEqual(["groq", "anthropic"]);
    expect(featureProviders("listing-check", env)).toEqual(["anthropic"]);
    expect(featureProviders("listing", { ANTHROPIC_API_KEY: "k" })).toEqual(["anthropic"]);
  });
```

and import `featureProviders` beside `aiFeatureOn`.

- [ ] **Step 2: Run them to see them fail.**

Run: `pnpm exec vitest run lib/ai/config.test.ts`
Expected: FAIL (`featureProviders` is not exported; `"listing-check"` isn't an `AiFeature`).

- [ ] **Step 3: Implement.** In `lib/ai/config.ts` replace the `AiFeature` type, `SWITCHES` and `aiFeatureOn`:

```ts
/** The features, each with its own switch. Stages C to E add theirs here (AI features spec 7.2). */
export type AiFeature = "listing" | "listing-check";

const SWITCHES: Readonly<Record<AiFeature, string>> = {
  listing: "VOSSIE_LISTING_AI",
  "listing-check": "VOSSIE_AI_LISTING_CHECK",
};

/** Groq's free tier is for the photo features only (AI features spec 7.1): the rest are Haiku's. */
const ONLY: Partial<Record<AiFeature, readonly ProviderName[]>> = { "listing-check": ["anthropic", "fake"] };

/** The providers a feature may try, in VOSSIE_AI_PROVIDERS's order, each with its key. */
export function featureProviders(feature: AiFeature, env: Env = process.env): ProviderName[] {
  const only = ONLY[feature];
  return aiProviders(env).filter((name) => (!only || only.includes(name)) && providerHasKey(name, env));
}

/** A feature shows only when its switch is "1" and a provider it may use can answer (photo-to-listing decision 14). */
export function aiFeatureOn(feature: AiFeature, env: Env = process.env): boolean {
  return env[SWITCHES[feature]] === "1" && featureProviders(feature, env).length > 0;
}
```

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run lib/ai/config.test.ts`
Expected: PASS (7 tests).

---

### Task 2: The request names its task, and the fake answers the check

**Files:**
- Modify: `lib/data/ai/types.ts`, `lib/data/ai/fake.ts`, `lib/data/ai.ts` (the request and the log line only)
- Test: `lib/data/ai.test.ts`

- [ ] **Step 1: Write the failing test.** Add to `lib/data/ai.test.ts`'s `describe`:

```ts
  it("names the task in the request and in the log line", async () => {
    bothProviders();
    const warn = vi.mocked(console.warn);
    expect(listingRequest([photo(1)], CATEGORIES).task).toBe("photo-to-listing");
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    groq.mockResolvedValueOnce({ ok: true, text: REPLY });
    await readListingPhotos([photo(1)], CATEGORIES);
    expect(warn).toHaveBeenCalledWith("[vossie] photo-to-listing: anthropic timeout");
  });
```

- [ ] **Step 2: Run it to see it fail.**

Run: `pnpm exec vitest run lib/data/ai.test.ts`
Expected: FAIL (`task` is undefined).

- [ ] **Step 3: Implement.** In `lib/data/ai/types.ts`, above `ProviderRequest`:

```ts
/** What a request is for: the fake answers each, and a failure's log line names it. */
export type AiTask = "photo-to-listing" | "listing-check";
```

and add as the first field of `ProviderRequest`:

```ts
  task: AiTask;
```

Change the file's opening comment's first sentence to "The one shape every AI provider answers". In `lib/data/ai.ts`, change `logFailure` and its callers:

```ts
function logFailure(task: AiTask, provider: ProviderName, failure: string): void {
  console.warn(`[vossie] ${task}: ${provider} ${failure}`);
}
```

(import `AiTask` from `./ai/types`), add `task: "photo-to-listing",` as the first field of `listingRequest`'s object, and call `logFailure("photo-to-listing", name, …)` in `readListingPhotos`. While there, make `readListingPhotos` loop over `featureProviders("listing")` instead of `aiProviders()` with the `providerHasKey` skip (same order and keys; import `featureProviders` from `@/lib/ai/config` and drop the two unused imports).

Replace `lib/data/ai/fake.ts`'s `read`:

```ts
/**
 * The listing check's fake (AI features spec 3.7): a title with "fake" in it looks like counterfeit goods, so the e2e
 * test can stop a publish; anything else breaks nothing. The title is the request text's first line.
 */
export function fakeVerdict(text: string) {
  const title = text.split("\n")[0] ?? "";
  return /\bfake\b/i.test(title)
    ? { concern: "counterfeit", confidence: "high" }
    : { concern: "none", confidence: "high" };
}

export const read: ReadPhoto = async (request) => ({
  ok: true,
  text: JSON.stringify(request.task === "listing-check" ? fakeVerdict(request.text) : FAKE_REPLY),
});
```

and change the file's opening comment to say it answers both tasks.

- [ ] **Step 4: Run the door's tests and the providers' tests.**

Run: `pnpm exec vitest run lib/data/ai.test.ts lib/data/ai/`
Expected: PASS. If a provider test builds a `ProviderRequest` literal, add `task: "photo-to-listing"` to it.

- [ ] **Step 5: Types.** Run: `pnpm typecheck`. Expected: clean (`scripts/photo-test.hand.ts` uses `listingRequest`, which now sets the task).

---

### Task 3: The check's rules

**Files:**
- Create: `lib/selling/listing-check.ts`
- Test: `lib/selling/listing-check.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `lib/selling/listing-check.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to see them fail.**

Run: `pnpm exec vitest run lib/selling/listing-check.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Create `lib/selling/listing-check.ts`:

```ts
// The listing check (AI features spec section 3, decision 96, stage B): what a listing may break in "What can't be
// sold" (app/seller-guidelines/page.tsx), what the model is told and answers, and when a save needs a check. Pure: the
// provider door (lib/data/ai.ts) and the listing form's action use it.

/** The guideline's seven kinds, in its order. */
export const CONCERNS = [
  "weapons",
  "alcohol-or-tobacco",
  "medicines",
  "counterfeit",
  "academic-dishonesty",
  "stolen",
  "illegal",
] as const;

export type Concern = (typeof CONCERNS)[number];

/** Each kind as the seller and the Hub read it, in the guideline's words. */
export const CONCERN_WORDS: Readonly<Record<Concern, string>> = {
  weapons: "weapons, or something made to hurt people",
  "alcohol-or-tobacco": "alcohol or tobacco sold to anyone under 18",
  medicines: "medicines",
  counterfeit: "counterfeit goods",
  "academic-dishonesty": "academic dishonesty",
  stolen: "stolen goods",
  illegal: "something that is against the law",
};

const CONFIDENCE = ["high", "medium", "low"] as const;

export type CheckVerdict = { concern: Concern | "none"; confidence: (typeof CONFIDENCE)[number] };

/** The system prompt. Never names the seller or the shop: only the listing is sent (spec 3.1). */
export function checkInstruction(): string {
  return [
    "You check listings on CampusCart, a marketplace for Eduvos university students in South Africa, against its rules",
    "on what can't be sold. Answer with the one rule a listing most likely breaks, or none, and how sure you are.",
    "",
    "The rules:",
    "- weapons: weapons, and anything made to hurt people.",
    "- alcohol-or-tobacco: alcohol or tobacco sold to anyone under 18.",
    "- medicines: medicines.",
    "- counterfeit: counterfeit goods, such as fake brands, copied software or pirated books and music.",
    "- academic-dishonesty: writing someone's assignment or sitting a test for them.",
    "- stolen: stolen goods, and anything the seller doesn't have the right to sell.",
    "- illegal: anything else that is against South African law.",
    "",
    "Tutoring and study notes are welcome: \"FAC1501 tutoring\" and a student's own summaries break nothing.",
    "\"I'll write your FAC1501 assignment\" is academic dishonesty. A kitchen knife, a used textbook, a phone with its",
    "box and a branded item sold second-hand break nothing. Prices are never a reason. Say high only when the listing",
    "plainly breaks a rule; when you're unsure, say medium or low.",
  ].join("\n");
}

/** The structured reply (spec 3.2). */
export function checkSchema(): Readonly<Record<string, unknown>> {
  return {
    type: "object",
    properties: {
      concern: { type: "string", enum: [...CONCERNS, "none"] },
      confidence: { type: "string", enum: [...CONFIDENCE] },
    },
    required: ["concern", "confidence"],
    additionalProperties: false,
  };
}

/** A reply checked against the schema, or null. */
export function parseVerdict(text: string): CheckVerdict | null {
  let reply: unknown;
  try {
    reply = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof reply !== "object" || reply === null) return null;
  const { concern, confidence } = reply as Record<string, unknown>;
  const concerns: readonly string[] = [...CONCERNS, "none"];
  if (typeof concern !== "string" || !concerns.includes(concern)) return null;
  if (typeof confidence !== "string" || !(CONFIDENCE as readonly string[]).includes(confidence)) return null;
  return { concern, confidence } as CheckVerdict;
}

/** Only high confidence stops a publish (spec 3.3): anything less publishes without a word. */
export function stopsPublish(verdict: CheckVerdict): Concern | null {
  return verdict.confidence === "high" && verdict.concern !== "none" ? verdict.concern : null;
}

/** Publish anyway's posted concern, when it's one of the seven. */
export function parseConcern(raw: string): Concern | null {
  return (CONCERNS as readonly string[]).includes(raw) ? (raw as Concern) : null;
}

type Saved = { state: string; title: string; description: string; photos: readonly { src: string }[] };

/**
 * Whether a publish needs a check (spec 3, planning decision 3): a new listing or a draft always; a live, paused or sold
 * one only when its title, description or photos changed.
 */
export function checkNeeded(
  existing: Saved | null,
  next: { title: string; description: string },
  order: readonly string[],
): boolean {
  if (!existing || existing.state === "draft") return true;
  return (
    existing.title !== next.title ||
    existing.description !== next.description ||
    existing.photos.map((photo) => photo.src).join("\n") !== order.join("\n")
  );
}

/** The report's detail, for the Hub (spec 3.4). The database writes the same words (file_listing_check_report). */
export function checkReportDetail(concern: Concern): string {
  return `The listing check thought this may be ${CONCERN_WORDS[concern]}. The seller published it anyway.`;
}
```

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run lib/selling/listing-check.test.ts`
Expected: PASS (8 tests).

---

### Task 4: The door's check

**Files:**
- Modify: `lib/data/ai.ts`
- Test: `lib/data/ai.test.ts`

- [ ] **Step 1: Write the failing tests.** Add a new `describe` at the end of `lib/data/ai.test.ts` (import `checkListingGuidelines` and `checkRequest` from `./ai`):

```ts
describe("the listing check through the door (AI features spec 3 and 7.1)", () => {
  const LISTING = { title: "Rolex watch", description: "Like new.", categoryName: "Fashion & thrift", cover: photo(7) };

  it("sends the listing's words and its cover, never a seller, with the check's schema", () => {
    const request = checkRequest(LISTING);
    expect(request.task).toBe("listing-check");
    expect(request.text).toBe("Title: Rolex watch\nCategory: Fashion & thrift\nDescription: Like new.");
    expect(request.images.map((image) => image.base64)).toEqual(["Bw=="]);
    expect(checkRequest({ ...LISTING, cover: null }).images).toEqual([]);
    expect(request.schema).toMatchObject({ required: ["concern", "confidence"] });
  });

  it("asks Haiku only, never Groq, and stops on a high-confidence concern", async () => {
    bothProviders();
    haiku.mockResolvedValueOnce({ ok: true, text: '{"concern":"counterfeit","confidence":"high"}' });
    expect(await checkListingGuidelines(LISTING)).toBe("counterfeit");
    haiku.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    expect(groq).not.toHaveBeenCalled();
  });

  it("fails open: a failure, a bad reply, a lower confidence or no provider all publish, logging only the kind", async () => {
    bothProviders();
    const warn = vi.mocked(console.warn);
    haiku.mockResolvedValueOnce({ ok: false, failure: "timeout" });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: true, text: "{}" });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    haiku.mockResolvedValueOnce({ ok: true, text: '{"concern":"weapons","confidence":"medium"}' });
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    haiku.mockRejectedValueOnce(new Error("Rolex watch"));
    expect(await checkListingGuidelines(LISTING)).toBeNull();
    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      "[vossie] listing-check: anthropic timeout",
      "[vossie] listing-check: anthropic bad-output",
      "[vossie] listing-check: anthropic api-error",
    ]);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await checkListingGuidelines(LISTING)).toBeNull();
  });

  it("uses the fake in sample mode: a title with 'fake' in it looks counterfeit", async () => {
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    expect(await checkListingGuidelines({ ...LISTING, title: "Fake designer watch" })).toBe("counterfeit");
    expect(await checkListingGuidelines(LISTING)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `pnpm exec vitest run lib/data/ai.test.ts`
Expected: FAIL (`checkListingGuidelines` is not exported).

- [ ] **Step 3: Implement.** Add to `lib/data/ai.ts` (imports: `checkInstruction`, `checkSchema`, `parseVerdict`, `stopsPublish`, `type Concern` from `@/lib/selling/listing-check`):

```ts
/** What the listing check reads (spec 3.1): the listing's words and its cover. Never the seller's name or shop. */
export type ListingForCheck = { title: string; description: string; categoryName: string; cover: Photo | null };

/** What the listing check asks. The title comes first: the fake reads it there. */
export function checkRequest(listing: ListingForCheck): ProviderRequest {
  return {
    task: "listing-check",
    system: checkInstruction(),
    images: listing.cover ? [{ type: listing.cover.type, base64: Buffer.from(listing.cover.bytes).toString("base64") }] : [],
    text: `Title: ${listing.title}\nCategory: ${listing.categoryName}\nDescription: ${listing.description}`,
    schema: checkSchema(),
  };
}

/**
 * The listing check (AI features spec section 3): the guideline a listing plainly breaks, or null to publish. Haiku
 * only (the fake in sample mode). It fails open (spec 3.5): no provider, a failure, a bad reply or anything thrown
 * publishes, and only the kind is logged, never the listing.
 */
export async function checkListingGuidelines(listing: ListingForCheck): Promise<Concern | null> {
  const request = checkRequest(listing);
  for (const name of featureProviders("listing-check")) {
    try {
      const reply = await (await LOAD[name]()).read(request);
      if (!reply.ok) {
        logFailure("listing-check", name, reply.failure);
        if (MOVE_ON.has(reply.failure)) continue;
        return null;
      }
      const verdict = parseVerdict(reply.text);
      if (!verdict) {
        logFailure("listing-check", name, "bad-output");
        return null;
      }
      return stopsPublish(verdict);
    } catch {
      logFailure("listing-check", name, "api-error");
      return null;
    }
  }
  return null;
}
```

Move the `Photo` type above both readers if needed, and add one sentence to the file's opening comment: "Each feature has its reader here (photo-to-listing's `readListingPhotos`, the listing check's `checkListingGuidelines`)."

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run lib/data/ai.test.ts`
Expected: PASS. The rate-limited case moves on, finds no other allowed provider (Groq isn't one) and returns null.

---

### Task 5: Reports without a reporter account (sample store and staff views)

**Files:**
- Modify: `lib/data/rows.ts` (`ReportRow.reporterId`), `lib/data/reports.ts`, `lib/data/staff-reports.ts`, `lib/staff/admin-actions.ts`, `lib/staff/notices.ts`
- Test: `lib/data/reports.test.ts`, `lib/data/staff-reports.test.ts`, `lib/staff/admin-actions.test.ts` (whichever holds the dismiss tests: `grep -ln "dismissReport\|Dismissed" lib/staff/*.test.ts`)

- [ ] **Step 1: Write the failing tests.** In `lib/data/reports.test.ts` add (use the file's existing `NOW`, `resetSampleStore` and fixture listing `l-001`, Tech corner's, owned by `acc-seller`; check the ids with `grep -n "l-001\|ownerId" data/fixtures/shops.ts | head`):

```ts
describe("the listing check's reports (AI features spec 3.4)", () => {
  it("files one open report per listing, with no reporter account, about the seller's own live listing", async () => {
    expect(await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-seller", concern: "counterfeit", now: NOW })).toBe("filed");
    expect(await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-seller", concern: "stolen", now: NOW })).toBe("already-open");
    const rows = [...sampleStore().reports.values()].filter((row) => row.targetId === "l-001");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reporterId: null,
      targetKind: "listing",
      reason: "prohibited",
      detail: "The listing check thought this may be counterfeit goods. The seller published it anyway.",
      status: "open",
      targetOwnerId: "acc-seller",
    });
  });

  it("refuses another seller's listing, a draft, a hidden one and one that doesn't exist", async () => {
    expect(await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-student", concern: "stolen", now: NOW })).toBe("not-found");
    expect(await fileListingCheckReport({ listingId: "l-nope", ownerId: "acc-seller", concern: "stolen", now: NOW })).toBe("not-found");
    sampleStore().listings.get("l-001")!.state = "draft";
    expect(await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-seller", concern: "stolen", now: NOW })).toBe("not-found");
  });

  it("is in nobody's own reports", async () => {
    await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-seller", concern: "counterfeit", now: NOW });
    expect(await listReportsBy("acc-seller")).toEqual([]);
  });
});
```

In `lib/data/staff-reports.test.ts` add (import `fileListingCheckReport` beside `createReport`):

```ts
  it("lists the listing check's report with its own name in place of a student's (AI features spec 3.4)", async () => {
    await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-seller", concern: "counterfeit", now: NOW });
    expect((await listReports()).find((view) => view.target.id === "l-001")).toMatchObject({
      reporterId: null,
      reporterName: "The listing check",
      reason: "prohibited",
      open: true,
    });
  });
```

In the file that tests `dismissReport` (`grep -ln "dismissReport" lib/staff/*.test.ts`), add, using that file's own sign-in and form helpers for the dismiss action:

```ts
  it("dismisses the listing check's report saying only Dismissed, and tells no one", async () => {
    await fileListingCheckReport({ listingId: "l-001", ownerId: "acc-seller", concern: "stolen", now: NOW });
    const id = [...sampleStore().reports.values()].find((row) => row.reporterId === null)!.id;
    const before = sampleStore().notifications.size;
    // Dismiss it with a note as the file's other dismiss test does, as the sample admin.
    await dismissAs(id, "A real watch.");
    expect(sampleStore().reports.get(id)).toMatchObject({ status: "closed", outcome: "dismissed" });
    expect(sampleStore().notifications.size).toBe(before);
    expect(await takeStaffNotice()).toBe("dismissed-check");
  });
```

where `dismissAs` and `takeStaffNotice` are the two lines that file's existing "Dismissed. The reporter has been told." test uses to post the dismiss and read its notice: name them as small helpers at the top of the `describe` if they're inline. Check `sampleStore().notifications` is the store's notifications map (`grep -n "notifications" lib/data/store.ts | head -3`) and use its name.

- [ ] **Step 2: Run them to see them fail.**

Run: `pnpm exec vitest run lib/data/reports.test.ts lib/data/staff-reports.test.ts lib/staff/`
Expected: FAIL (`fileListingCheckReport` is not exported).

- [ ] **Step 3: Implement.**

`lib/data/rows.ts`, in `ReportRow`:

```ts
  /** The student who sent it; null for the listing check's (AI features spec 3.4). */
  reporterId: string | null;
```

`lib/data/reports.ts`, after `createReport` (import `checkReportDetail`, `type Concern` from `@/lib/selling/listing-check`):

```ts
/**
 * Publish anyway's report (AI features spec 3.4): about the seller's own listing, live now, with no reporter account
 * ("The listing check" to the Hub), reason "prohibited". One open at a time per listing. Not in anyone's own reports,
 * limits or data download, which all read by reporter.
 */
export async function fileListingCheckReport({
  listingId,
  ownerId,
  concern,
  now,
}: {
  listingId: string;
  ownerId: string;
  concern: Concern;
  now: Date;
}): Promise<"filed" | "already-open" | "not-found"> {
  if (onSupabase()) return (await supabase()).fileListingCheckReport({ listingId, ownerId, concern, now });
  const store = sampleStore();
  const listing = store.listings.get(listingId);
  const shop = listing ? store.sellers.get(listing.sellerSlug) : undefined;
  if (!listing || shop?.ownerId !== ownerId || listing.state === "draft" || listing.hiddenAt) return "not-found";
  const open = [...store.reports.values()].some(
    (row) =>
      row.reporterId === null &&
      row.targetKind === "listing" &&
      row.targetId === listingId &&
      row.status === "open" &&
      row.targetGone !== true,
  );
  if (open) return "already-open";
  const id = `rep-${randomUUID()}`;
  store.reports.set(id, {
    id,
    reporterId: null,
    targetKind: "listing",
    targetId: listingId,
    targetTitle: listing.title,
    reason: "prohibited",
    detail: checkReportDetail(concern),
    status: "open",
    createdAt: now.toISOString(),
    targetOwnerId: ownerId,
  });
  return "filed";
}
```

(Check the listing row's field names with `grep -n "export type ListingRow" -A25 lib/data/rows.ts`: use its own names for the seller's slug, state and hide time if they differ.)

`lib/data/staff-reports.ts`: change `reporterId: string` to `string | null` in the view type and in `ClosedReport`, and in `toView`:

```ts
    // The listing check's reports have no reporter account (AI features spec 3.4).
    reporterName: row.reporterId === null ? LISTING_CHECK_NAME : lookups.firstName(row.reporterId),
```

with, near the top:

```ts
/** Who the Hub sees as the listing check's reports' reporter. */
export const LISTING_CHECK_NAME = "The listing check";
```

`lib/staff/admin-actions.ts`, `tellReporter`: start with `if (closed.reporterId === null) return;` and change its comment to "…; the listing check's reports tell no one". In the dismiss action, leave `closed.reporterId === null ? "dismissed-check" : "dismissed"` with `leaveNotice`. `lib/staff/notices.ts`: add `["dismissed-check", "Dismissed."],` after `"dismissed"`.

Run `pnpm typecheck` and fix each `reporterId` use it reports (the Supabase twins come in Task 6; for now `lib/data/supabase/staff-reports.ts` only drops the `!` on `row.reporter_id` in its two mappings).

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run lib/data/reports.test.ts lib/data/staff-reports.test.ts lib/staff/ components/staff/`
Expected: PASS.

---

### Task 6: Supabase: the migration, the twin and the contract

**Files:**
- Create: `supabase/migrations/20261104120000_listing_check.sql`, `supabase/tests/62_listing_check.test.sql`, `lib/data/contract/listing-check.contract.ts`, `lib/data/contract/listing-check.test.ts`, `lib/data/contract/listing-check.db.test.ts`
- Modify: `lib/data/supabase/reports.ts`

Needs the local stack (`supabase start`, then `supabase db reset`). Never push to Vossie Market: that's Lama's go-ahead after a dry run (Task 12 adds the line to GO-LIVE).

- [ ] **Step 1: Write the pgTAP test.** Create `supabase/tests/62_listing_check.test.sql` (its own accounts and listings, set up as `28_report_target_owner.test.sql` does, so the seed is never relied on):

```sql
-- AI stage B: the listing check's reports (AI features spec 3.4; plan 2026-11-04-ai-stage-b-listing-check.md, Task 6).
-- file_listing_check_report files one open report with no reporter account about the caller's own live listing, in the
-- words checkReportDetail writes; no student can read it; closing it tells no one.
begin;
select plan(11);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.a(n), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$f$;
create function pg_temp.sign_out() returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('lc-campus', 'Check campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('lc-category', 'Check category', 98);
-- e1 Lerato sells; e2 Thandi is a student; e3 Adam is an admin.
insert into auth.users (id, email)
select pg_temp.a(n), 'lc-' || n || '@eduvos.com' from unnest(array['e1', 'e2', 'e3']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('e1'), 'Lerato', 'lc-campus', '{}'),
  (pg_temp.a('e2'), 'Thandi', 'lc-campus', '{}'),
  (pg_temp.a('e3'), 'Adam', 'lc-campus', '{admin}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('e1'), 'lc-lerato', pg_temp.a('e1'), 'Lerato watches', 'lc-category', 'lc-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at) values
  (pg_temp.a('e1'), 'approved', pg_temp.s('e1'), now() - interval '9 days', now() - interval '8 days');
insert into public.listings (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at) values
  ('lc-l1', pg_temp.s('e1'), 'available', 'item', 'Designer watch', 'lc-category', 'good', 300, 'cash', 'A watch.', 'online', 'lc-campus', now()),
  ('lc-l2', pg_temp.s('e1'), 'draft', 'item', 'Another watch', 'lc-category', 'good', 300, 'cash', 'A watch.', 'online', 'lc-campus', null);

select pg_temp.sign_in('e1');
select is(public.file_listing_check_report('lc-l1', 'counterfeit'), 'filed', 'the seller files the check''s report');
select is(public.file_listing_check_report('lc-l1', 'stolen'), 'already-open', 'one open report per listing');
select is(public.file_listing_check_report('lc-l2', 'stolen'), 'not-found', 'never about a draft');
select throws_ok(
  $$ select public.file_listing_check_report('lc-l1', 'none') $$, '22023', null, 'the concern is one of the seven'
);
select pg_temp.sign_out();

select is(
  (select count(*)::int from public.reports where target_id = 'lc-l1'), 1, 'one row'
);
select is(
  (select reporter_id from public.reports where target_id = 'lc-l1'), null::uuid, 'with no reporter account'
);
select is(
  (select detail from public.reports where target_id = 'lc-l1'),
  'The listing check thought this may be counterfeit goods. The seller published it anyway.',
  'in checkReportDetail''s words'
);
select is(
  (select array[reason, target_owner_id::text] from public.reports where target_id = 'lc-l1'),
  array['prohibited', pg_temp.a('e1')::text],
  'prohibited, and whose listing it is'
);

select pg_temp.sign_in('e2');
select is(public.file_listing_check_report('lc-l1', 'stolen'), 'not-found', 'never about another account''s listing');
select is((select count(*)::int from public.reports where target_id = 'lc-l1'), 0, 'and a student can''t read it');
select pg_temp.sign_out();

select pg_temp.sign_in('e3');
select private.close_reports('listing', array['lc-l1'], 'acted', 'Hidden');
select pg_temp.sign_out();
select is(
  (select count(*)::int from public.notifications where kind = 'report-handled' and subject_id = (
    select id::text from public.reports where target_id = 'lc-l1'
  )),
  0,
  'closing it tells no one'
);

select * from finish();
rollback;
```

If `private.close_reports` can't be called as `authenticated` (it's private), call it after `pg_temp.sign_out()` with the admin's claims set but the role left as the test's owner: set `request.jwt.claims` for `e3` with `set_config` and call it without `set local role`, as `28_report_target_owner.test.sql`'s `pg_temp.own` does. Count the `is`/`throws_ok` lines against `plan(11)`.

- [ ] **Step 2: Run it to see it fail.**

Run: `supabase test db`
Expected: FAIL (`file_listing_check_report` doesn't exist).

- [ ] **Step 3: Write the migration.** Create `supabase/migrations/20261104120000_listing_check.sql`:

```sql
-- AI stage B, the listing check (AI features spec section 3, decision 96; plan 2026-11-04-ai-stage-b-listing-check.md).
-- 1. A report may have no reporter account: null is the listing check's, filed when a seller presses Publish anyway.
--    The reports policy reads by reporter_id = auth.uid(), so no student sees one; forget_account deletes by reporter,
--    so none is deleted with an account (its target_owner_id is cleared, as for any report).
-- 2. One open listing-check report per listing.
-- 3. private.close_reports, copied from 20261020120300_staff_shop_actions.sql, tells only a reporter who exists (the line
--    marked "stage B"). dismiss_report needs nothing: private.notify skips a null account.
-- 4. file_listing_check_report: the seller's own live listing only, the words written here (checkReportDetail in
--    lib/selling/listing-check.ts says the same; the contract test checks both).

alter table public.reports alter column reporter_id drop not null;

create unique index reports_one_open_check_per_listing on public.reports (target_kind, target_id)
  where reporter_id is null and status = 'open' and not target_gone;

create or replace function private.close_reports(p_kind text, p_target_ids text[], p_outcome text, p_note text)
returns void
language sql
volatile
set search_path = ''
as $$
  with closed as (
    update public.reports r
    set status = 'closed', outcome = p_outcome, note = p_note, closed_at = now(), closed_by = (select auth.uid())
    where r.status = 'open' and not r.target_gone and r.target_kind = p_kind and r.target_id = any (p_target_ids)
    returning r.id, r.reporter_id, r.target_title
  )
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select c.reporter_id, 'report-handled', c.id::text, private.report_outcome_note_text('acted', c.target_title),
    '/account/privacy#account-privacy-reports-title'
  from closed c
  where c.reporter_id is not null;  -- stage B: the listing check's reports tell no one
$$;

create function public.file_listing_check_report(p_listing text, p_concern text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.require_profile();
  title text;
  words text;
  made uuid;
begin
  words := case p_concern
    when 'weapons' then 'weapons, or something made to hurt people'
    when 'alcohol-or-tobacco' then 'alcohol or tobacco sold to anyone under 18'
    when 'medicines' then 'medicines'
    when 'counterfeit' then 'counterfeit goods'
    when 'academic-dishonesty' then 'academic dishonesty'
    when 'stolen' then 'stolen goods'
    when 'illegal' then 'something that is against the law'
  end;
  if words is null then
    raise exception 'a listing check names one of the seven kinds' using errcode = 'invalid_parameter_value';
  end if;
  select l.title into title
  from public.listings l join public.shops s on s.id = l.shop_id
  where l.id = p_listing and s.owner_id = caller and l.state <> 'draft' and l.hidden_at is null;
  if title is null then
    return 'not-found';
  end if;
  insert into public.reports (reporter_id, target_kind, target_id, target_title, reason, detail, target_owner_id)
  values (
    null, 'listing', p_listing, title, 'prohibited',
    'The listing check thought this may be ' || words || '. The seller published it anyway.', caller
  )
  on conflict (target_kind, target_id) where reporter_id is null and status = 'open' and not target_gone do nothing
  returning id into made;
  return case when made is null then 'already-open' else 'filed' end;
end;
$$;

revoke all on function public.file_listing_check_report(text, text) from public, anon;
grant execute on function public.file_listing_check_report(text, text) to authenticated, service_role;
```

Before running, check two things and adjust the SQL to match: `private.close_reports`'s latest definition is still the one in `20261020120300_staff_shop_actions.sql` (`grep -ln "function private.close_reports" supabase/migrations/*.sql`), and `create_report`'s `l.id = p_target_id` comparison shows `listings.id` is text (it is in `20261021120400_report_target_owner.sql`).

- [ ] **Step 4: Run the pgTAP test.**

Run: `supabase db reset && supabase test db`
Expected: PASS, every file (the earlier 61 too).

- [ ] **Step 5: Write the twin.** Add to `lib/data/supabase/reports.ts`:

```ts
/** Publish anyway's report (AI features spec 3.4), through the seller's own client: file_listing_check_report. */
export const fileListingCheckReport: typeof Sample.fileListingCheckReport = async ({ listingId, ownerId, concern }) => {
  const { data, error } = await (await forViewerAs(ownerId)).rpc("file_listing_check_report", {
    p_listing: listingId,
    p_concern: concern,
  });
  if (error) failed("file_listing_check_report", error);
  if (data !== "filed" && data !== "already-open" && data !== "not-found") {
    throw new Error(`file_listing_check_report answered ${String(data)}`);
  }
  return data;
};
```

Regenerate the database types the way the repo does (`grep -n "gen types" package.json docs/reference/*.md | head -3`) so `rpc("file_listing_check_report")` type-checks, then fix `reporter_id` uses `pnpm typecheck` reports in `lib/data/supabase/staff-reports.ts` (`reporterId: row.reporter_id`, no `!`; the people lookup already drops nulls).

- [ ] **Step 6: The contract test.** Create `lib/data/contract/listing-check.contract.ts`:

```ts
import { afterEach, beforeEach, expect, it } from "vitest";
import { fileListingCheckReport } from "@/lib/data/reports";
import type { World } from "@/tests/contract/world";

// The listing check's reports (AI stage B, plan Task 6), the same in both backends: listing-check.test.ts runs it on the
// sample store (`pnpm test`), listing-check.db.test.ts on the local stack (`pnpm test:db`).

export function listingCheckContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("files one open report about the seller's own live listing, refusing a draft and another account", async () => {
    const slug = await world.openShop("seller", { name: "Contract watches" });
    const live = await world.addListing(slug, { title: "Contract designer watch" });
    const draft = await world.addListing(slug, { title: "Contract draft watch" });
    await world.draftListing(draft);
    const owner = await world.signedIn("seller");
    const file = (listingId: string) =>
      world.asViewer("seller", () =>
        fileListingCheckReport({ listingId, ownerId: owner, concern: "counterfeit", now: new Date() }),
      );
    expect(await file(live)).toBe("filed");
    expect(await file(live)).toBe("already-open");
    expect(await file(draft)).toBe("not-found");
    const shopper = await world.signedIn("shopper");
    expect(
      await world.asViewer("shopper", () =>
        fileListingCheckReport({ listingId: live, ownerId: shopper, concern: "stolen", now: new Date() }),
      ),
    ).toBe("not-found");
  });
}
```

`listing-check.test.ts` and `listing-check.db.test.ts` are the two six-line runners, as `smoke.test.ts` and the top of `smoke.db.test.ts` are (the `.db` one with the same `vi.mock("@/lib/data/supabase/clients", …withViewerSeam…)` line). If `world.cleanup()` doesn't remove reports about a listing it added, add that to both worlds' `tidySelling` (`tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`) the way they remove the listing.

Run: `pnpm exec vitest run lib/data/contract/listing-check.test.ts && pnpm test:db lib/data/contract/listing-check.db.test.ts`
Expected: PASS on both.

---

### Task 7: The check in the save action

**Files:**
- Modify: `lib/selling/listing-actions.ts`
- Test: `lib/selling/listing-actions.test.ts`

- [ ] **Step 1: Write the failing tests.** In `lib/selling/listing-actions.test.ts`, change the `@/lib/data/ai` mock to:

```ts
vi.mock("@/lib/data/ai", () => ({ PHOTOS_READ: 3, readListingPhotos: vi.fn(), checkListingGuidelines: vi.fn() }));
```

import `checkListingGuidelines` beside `readListingPhotos`, and add a `describe` at the end (it uses the file's `signedInAs`, `fanForm`, `redirectOf`, `readFormState`, `listingForm`, `listOwnListings`, `sampleStore`; Tech corner's owner is the account `fanForm`'s other tests sign in as):

```ts
describe("the listing check (AI features spec section 3)", () => {
  beforeEach(() => {
    vi.stubEnv("VOSSIE_AI_LISTING_CHECK", "1");
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    vi.mocked(checkListingGuidelines).mockReset().mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  const checkReports = () => [...sampleStore().reports.values()].filter((row) => row.reporterId === null);

  it("stops a publish it thinks breaks a guideline: back to the form with the concern, nothing made, the token kept", async () => {
    await signedInAs("acc-seller");
    vi.mocked(checkListingGuidelines).mockResolvedValue("counterfeit");
    const data = await fanForm({ title: "Rolex watch" });
    expect(await redirectOf(() => saveListingForm(data))).toBe("/sell/listings/new");
    const state = (await readFormState(listingForm(null)))!;
    expect(state.notice).toBe("listing-check");
    expect(state.values).toMatchObject({ title: "Rolex watch", checkConcern: "counterfeit" });
    expect((await listOwnListings("tech-corner")).some((listing) => listing.title === "Rolex watch")).toBe(false);
    expect(vi.mocked(checkListingGuidelines).mock.calls[0][0]).toMatchObject({
      title: "Rolex watch",
      categoryName: "Res & living",
    });
    // The same form, sent with Publish anyway, still has its token.
    data.set("anyway", "counterfeit");
    expect(await redirectOf(() => saveListingForm(data))).toBe("/sell/listings");
  });

  it("publishes anyway without asking again, and files one report for the Hub", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ title: "Rolex watch", anyway: "counterfeit" })));
    expect(checkListingGuidelines).not.toHaveBeenCalled();
    const listing = (await listOwnListings("tech-corner")).find((row) => row.title === "Rolex watch")!;
    expect(listing.state).toBe("available");
    expect(checkReports()).toMatchObject([{ targetId: listing.id, reason: "prohibited", status: "open" }]);
  });

  it("publishes without a word when the check finds nothing, and never checks a draft", async () => {
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect(checkListingGuidelines).toHaveBeenCalledTimes(1);
    await redirectOf(async () => saveListingForm(await fanForm({ title: "Lamp", intent: "draft" })));
    expect(checkListingGuidelines).toHaveBeenCalledTimes(1);
    expect(checkReports()).toEqual([]);
  });

  it("checks an edit only when the title, description or photos changed", async () => {
    await signedInAs("acc-seller");
    const listing = sampleStore().listings.get("l-001")!;
    const edit = (overrides: Record<string, string>) =>
      form({
        listing: "l-001",
        kind: listing.kind,
        title: listing.title,
        category: listing.categorySlug,
        condition: listing.condition ?? "",
        price: String(listing.priceZar ?? ""),
        payMode: listing.payMode,
        description: listing.description,
        handover: listing.handover,
        pickup: listing.pickupPointId ?? "",
        photo: listing.photos.map((photo) => photo.src),
        intent: "publish",
        ...overrides,
      });
    await redirectOf(() => saveListingForm(edit({ price: "99" })));
    expect(checkListingGuidelines).not.toHaveBeenCalled();
    await redirectOf(() => saveListingForm(edit({ title: `${listing.title} (boxed)` })));
    expect(checkListingGuidelines).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the switch is off, and ignores an anyway that isn't one of the seven", async () => {
    await signedInAs("acc-seller");
    vi.stubEnv("VOSSIE_AI_LISTING_CHECK", "");
    await redirectOf(async () => saveListingForm(await fanForm({ anyway: "yes" })));
    expect(checkListingGuidelines).not.toHaveBeenCalled();
    expect(checkReports()).toEqual([]);
  });
});
```

(Check the sample ids before running: `grep -n "acc-seller\|tech-corner" data/fixtures/*.ts | head`, and the listing row's field names as in Task 5. Use the ones the file's other tests use.)

- [ ] **Step 2: Run them to see them fail.**

Run: `pnpm exec vitest run lib/selling/listing-actions.test.ts`
Expected: the new tests FAIL (no check is made); the rest PASS.

- [ ] **Step 3: Implement.** In `lib/selling/listing-actions.ts` import `checkListingGuidelines` from `@/lib/data/ai`, `fileListingCheckReport` from `@/lib/data/reports`, and `checkNeeded`, `parseConcern`, `type Concern` from `./listing-check`. Add, above `saveListingForm`:

```ts
/**
 * The listing check (AI features spec section 3): reads the listing and its cover against "What can't be sold" and
 * names the guideline it plainly breaks, or null to publish. The cover goes when it's one of the seller's uploads; a
 * placeholder or stock cover is left out. It fails open: anything thrown publishes, and only the kind is logged.
 */
async function guidelineConcern(
  owner: ShopOwner,
  fields: { title: string; description: string; categorySlug: string },
  order: readonly string[],
  now: Date,
): Promise<Concern | null> {
  try {
    const id = order[0] ? photoIdOf(order[0]) : null;
    const viewer = async () => ({ id: owner.account.id, hubStaff: false });
    const photo = id ? await photoFor(id, viewer, now).catch(() => null) : null;
    const categoryName =
      (await getCategories()).find((category) => category.slug === fields.categorySlug)?.name ?? fields.categorySlug;
    return await checkListingGuidelines({
      title: fields.title,
      description: fields.description,
      categoryName,
      cover: photo ? { type: photo.type, bytes: photo.bytes } : null,
    });
  } catch {
    console.warn("[vossie] listing-check: check error");
    return null;
  }
}
```

In `saveListingForm`, replace the `intent` line and add the check right after it (before the `if (!existing)` token block):

```ts
  // Publish anyway (AI features spec 3) posts the concern the check named; it publishes, so it's never a draft.
  const anyway = parseConcern(field(formData, "anyway"));
  const intent = owner.status !== "pending" && (anyway || field(formData, "intent") !== "draft") ? "publish" : "draft";
  // The listing check, before the token is taken, so a stopped publish keeps the form, its photos and its token
  // (planning decisions 3 and 4). Publish anyway skips it: its report is filed after the save.
  if (intent === "publish" && !anyway && aiFeatureOn("listing-check") && checkNeeded(existing, check.value, order)) {
    const concern = await guidelineConcern(owner, check.value, order, now);
    if (concern) {
      const values = { ...typedValues(formData, order, alts, context), checkConcern: concern };
      await writeFormState(form, { errors: [], values, notice: "listing-check" }, now);
      done(formPath);
    }
  }
```

After `listingsChanged();` (and before the follower block), add:

```ts
  // Publish anyway's report for the Hub (spec 3.4). A failure to file it doesn't undo the save: the listing is live.
  if (anyway && saved.state === "available") {
    await fileListingCheckReport({ listingId: saved.id, ownerId: owner.account.id, concern: anyway, now }).catch(() =>
      console.warn("[vossie] listing-check: report not filed"),
    );
  }
```

Update the function's comment with one sentence: "Before a publish, the listing check may stop it with Publish anyway (AI features spec section 3)."

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run lib/selling/listing-actions.test.ts`
Expected: PASS, the earlier tests included (with the switch unset they never call the check).

---

### Task 8: The notice on the form

**Files:**
- Create: `components/sell/ListingCheck.tsx`
- Modify: `components/sell/ListingFormView.tsx`, `components/sell/ListingForm.tsx`, `app/globals.css` only if the composer's `.msg-check` styles don't fit inside the form
- Test: `components/sell/ListingCheck.test.tsx`, `components/sell/ListingFormView.test.tsx`

- [ ] **Step 1: Write the failing tests.** Create `components/sell/ListingCheck.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingCheck } from "./ListingCheck";

describe("ListingCheck (AI features spec 3)", () => {
  it("names the guideline, links to the rules and the title, and posts the concern with Publish anyway", () => {
    render(
      <form>
        <ListingCheck concern="counterfeit" prefix="new-listing" />
      </form>,
    );
    const alert = screen.getByRole("alert", { name: "Check this before you publish" });
    expect(alert).toHaveTextContent(
      "This may break the seller guidelines: counterfeit goods. If it doesn't, publish it anyway and the Hub will take a look.",
    );
    expect(screen.getByRole("link", { name: "Edit listing" })).toHaveAttribute("href", "#new-listing-title");
    expect(screen.getByRole("link", { name: "What can't be sold" })).toHaveAttribute(
      "href",
      "/seller-guidelines#guidelines-banned",
    );
    const anyway = screen.getByRole("button", { name: "Publish anyway" });
    expect(anyway).toHaveAttribute("name", "anyway");
    expect(anyway).toHaveAttribute("value", "counterfeit");
  });
});
```

In `components/sell/ListingFormView.test.tsx` add (it uses the file's `view` and `values`):

```tsx
describe("the listing check's notice (AI features spec 3)", () => {
  it("draws the check inside the form, after the hidden Save, in place of a status notice", () => {
    const { container } = render(view({ notice: "listing-check", values: { ...values, checkConcern: "stolen" } }));
    const alert = screen.getByRole("alert", { name: "Check this before you publish" });
    const form = container.querySelector("form")!;
    expect(form).toContainElement(alert);
    // Enter in a field presses the form's first submit button: still the hidden Save, never Publish anyway.
    expect(form.querySelector('button[type="submit"]')).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("draws nothing for a concern that isn't one of the seven", () => {
    render(view({ notice: "listing-check", values: { ...values, checkConcern: "yes" } }));
    expect(screen.queryByRole("alert", { name: "Check this before you publish" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `pnpm exec vitest run components/sell/ListingCheck.test.tsx components/sell/ListingFormView.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Create `components/sell/ListingCheck.tsx`:

```tsx
import Link from "next/link";
import { listingFieldIds } from "@/lib/selling/errors";
import { CONCERN_WORDS, type Concern } from "@/lib/selling/listing-check";

/**
 * "Check this before you publish" (AI features spec section 3): the guideline the listing check thinks the listing may
 * break, a way back to the title, and Publish anyway, which posts the form again with the concern (planning decision
 * 2). It sits inside the form after the hidden Save, so Enter in a field never publishes anyway. Like the composer's
 * scam check (components/messages/ScamCheck.tsx), it's an alert the browser focuses on a page load. No client code.
 */
export function ListingCheck({ concern, prefix }: { concern: Concern; prefix: string }) {
  const titleId = `${prefix}-check-title`;
  return (
    <div role="alert" tabIndex={-1} autoFocus aria-labelledby={titleId} className="msg-check">
      <h2 id={titleId} className="msg-check-title">
        Check this before you publish
      </h2>
      <p>
        This may break the seller guidelines: {CONCERN_WORDS[concern]}. If it doesn&apos;t, publish it anyway and the Hub
        will take a look.
      </p>
      <p className="msg-check-hint">
        <Link href="/seller-guidelines#guidelines-banned" prefetch={false}>
          What can&apos;t be sold
        </Link>
      </p>
      <div className="sell-form-buttons">
        <a href={`#${listingFieldIds(prefix).title}`} className="btn btn-outline text-navy">
          Edit listing
        </a>
        <button type="submit" name="anyway" value={concern} className="btn btn-primary">
          Publish anyway
        </button>
      </div>
    </div>
  );
}
```

In `components/sell/ListingFormView.tsx`: import `ListingCheck` and `parseConcern`; work out `const concern = notice === "listing-check" ? parseConcern(values.checkConcern ?? "") : null;`; the `role="status"` notice needs no change (`noticeText("listing-check")` is null: `lib/selling/notices.ts` has no entry for it, and must not get one); and render `{concern && <ListingCheck concern={concern} prefix={prefix} />}` inside the form, right after the hidden `once` input and before `withCard`. `ListingForm.tsx` needs no change if `values` already carries `checkConcern` from the form state (it does: `values = state ? state.values : …`).

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run components/sell/`
Expected: PASS.

- [ ] **Step 5: Look at it.** Start the preview (`vossie-dev`) with `VOSSIE_AI_LISTING_CHECK=1 VOSSIE_AI_PROVIDERS=fake` in `.env.local` (and remove those two lines afterwards), sign in as Tech corner's seller, publish a listing titled "Fake designer watch" at 390 and 1440, and check the box's spacing, the buttons' 44px height and the focus landing on it. Check it in Dark and Night too (the menu's Theme): the box uses tokens only.

---

### Task 9: The privacy line

**Files:**
- Modify: `app/privacy/page.tsx`
- Test: `app/privacy/page.test.tsx`

- [ ] **Step 1: Write the failing test.** Add to `app/privacy/page.test.tsx`, beside the photo-to-listing line's `describe` (follow its way of stubbing the environment and rendering the page):

```tsx
describe("the listing check's line (AI features spec 7.3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** As photo-to-listing's lineWith: the page's sections are built when its module loads. */
  async function checkLineWith(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.resetModules();
    const { default: Page } = await import("./page");
    const { unmount } = render(<Page />);
    const line = screen.queryByText(/When you publish a listing/)?.textContent ?? null;
    unmount();
    return line;
  }

  it("says what goes to Anthropic on a publish, that it's read outside South Africa, and that you can still publish", async () => {
    const line = await checkLineWith({
      VOSSIE_AI_LISTING_CHECK: "1",
      VOSSIE_AI_PROVIDERS: "anthropic,groq",
      ANTHROPIC_API_KEY: "test",
      GROQ_API_KEY: "test",
    });
    expect(line).toContain("its title, description, category and cover photo are sent to Anthropic");
    expect(line).toContain("(never Groq)");
    expect(line).toContain("read outside South Africa");
    expect(line).toContain("you can still publish it, and the Hub takes a look");
  });

  it("isn't there while the check is off, without Anthropic's key, or with only the fake", async () => {
    expect(await checkLineWith({ VOSSIE_AI_PROVIDERS: "anthropic", ANTHROPIC_API_KEY: "test" })).toBeNull();
    expect(await checkLineWith({ VOSSIE_AI_LISTING_CHECK: "1", VOSSIE_AI_PROVIDERS: "anthropic,groq", GROQ_API_KEY: "test" })).toBeNull();
    expect(await checkLineWith({ VOSSIE_AI_LISTING_CHECK: "1", VOSSIE_AI_PROVIDERS: "fake" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail.**

Run: `pnpm exec vitest run app/privacy/page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `app/privacy/page.tsx`, below `photoFillLine`:

```tsx
/**
 * The listing check's line (AI features spec 7.3): Haiku only, so Anthropic is the one provider named. Fixed at build,
 * like photoFillLine.
 */
function listingCheckLine() {
  if (!featureProviders("listing-check").includes("anthropic") || !aiFeatureOn("listing-check")) return null;
  return (
    <li>
      When you publish a listing, its title, description, category and cover photo are sent to Anthropic, an AI provider
      in the United States, which deletes them within 30 days and doesn&apos;t use them to train its models (never Groq),
      to check it against what can&apos;t be sold. So what&apos;s sent is read outside South Africa. Your name and your
      shop aren&apos;t sent. If it may break the guidelines you can still publish it, and the Hub takes a look.
    </li>
  );
}
```

Import `featureProviders`, and render `{listingCheckLine()}` right after wherever `photoFillLine()` is rendered.

- [ ] **Step 4: Run the tests.**

Run: `pnpm exec vitest run app/privacy/page.test.tsx`
Expected: PASS.

---

### Task 10: End to end on the fake

**Files:**
- Modify: `playwright.config.ts`, `tests/e2e/selling-writes.spec.ts`

- [ ] **Step 1: Switch it on for the e2e server.** In `playwright.config.ts`'s `webServer.env`, add `VOSSIE_AI_LISTING_CHECK: "1",` after `VOSSIE_LISTING_AI`, and extend the comment above `env`: "The listing check is on too, answered by the fake: a title with "fake" in it looks counterfeit (AI features stage B)." Then check no other e2e test publishes a title with the word fake in it: `grep -rniE "fill\(.*\bfake\b|publishListing\(.*\bfake\b" tests/e2e` prints nothing.

- [ ] **Step 2: Write the test.** Add to the end of `tests/e2e/selling-writes.spec.ts` (`signedInPage` comes from `./helpers/staff-accounts` or wherever `grep -rn "export async function signedInPage" tests/e2e/helpers` finds it):

```ts
test("the listing check stops a listing that may break the guidelines; Publish anyway publishes it and the Hub gets a report (AI stage B)", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const title = `Fake designer watch ${uniqueWord()}`;
  await signInAsSample(page, "Seller, Tech corner");
  await page.goto("/sell/listings/new");
  await fillListing(page, title);
  await button(page, "Save and publish").click();
  const check = main(page).getByRole("alert", { name: "Check this before you publish" });
  await expect(check).toContainText("counterfeit goods", POST_LANDS);
  await expect(page).toHaveURL(/\/sell\/listings\/new$/);
  await expect(field(page, "Title")).toHaveValue(title);
  expect(await seriousIssues(page)).toEqual([]);

  await check.getByRole("button", { name: "Publish anyway" }).click();
  await expect(page).toHaveURL(/\/sell\/listings$/, POST_LANDS);
  const word = title.split(" ").at(-1)!;
  await page.goto(browseFor(word));
  await expect(cardsFor(page, word)).toHaveCount(1);

  // The Hub's report, from the listing check, which this test dismisses: staff-writes' "Open reports" link goes to
  // the oldest open report and must find its own (planning decision 9).
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/reports");
  await main(admin).getByRole("link", { name: `Review the report about ${title}` }).click();
  await expect(main(admin).getByText("The listing check", { exact: true })).toBeVisible();
  await expect(main(admin).getByText("Prohibited item", { exact: true })).toBeVisible();
  await field(admin, "Note").fill("Checked: a real watch, the word was the seller's joke.");
  await main(admin).getByRole("button", { name: /^Dismiss the report about/ }).click();
  await expect(admin).toHaveURL(/\/admin\/reports$/, POST_LANDS);
  await expect(main(admin).getByText("Dismissed.", { exact: true })).toBeVisible();
  await admin.context().close();
});
```

Match the staff notice locator to what `tests/e2e/staff.spec.ts` uses (`staffNotice(admin)`), importing it from the same helper.

- [ ] **Step 3: Run it.**

Run (build and server once, then the one test): `pnpm exec playwright test tests/e2e/selling-writes.spec.ts --project=selling-writes --no-deps -g "listing check"`
Expected: PASS. Then the whole selling-writes project once: `pnpm exec playwright test --project=selling-writes --no-deps` (8 passed).

- [ ] **Step 4: The staff tests after it.** Run: `pnpm exec playwright test --project=staff-writes --no-deps tests/e2e/staff-writes.spec.ts` against the same server (`E2E_REUSE_SERVER=1`) right after Step 3, so the selling-writes run's dismissed report is in the store. Expected: PASS.

---

### Task 11: Size, chunks and layout

**Files:** none (checks).

- [ ] **Step 1:** `pnpm build`, then `grep -lE "groq|anthropic" .next/static/chunks/*.js` prints nothing, and `grep -l "serviceWorker.register" .next/static/chunks/*.js` prints nothing.
- [ ] **Step 2:** `E2E_REUSE_SERVER=1 pnpm exec playwright test tests/e2e/performance.spec.ts --project=phone-390`: 46 passed. The listing forms were at 153,599 B of 153,600 before this stage; `ListingCheck` is a Server Component, so they should not move. If they go over, stop and tell the controller: don't trim other code to make room.
- [ ] **Step 3:** `E2E_REUSE_SERVER=1 pnpm exec playwright test tests/e2e/cls.spec.ts -g "new listing form|edit listing form" --project=phone-390 --project=desktop-1440`: passed (the alert shows only after a post, so a first load doesn't change).

---

### Task 12: Docs

**Files:** `docs/superpowers/specs/2026-11-03-ai-features-design.md`, `docs/reference/GO-LIVE.md`, `docs/PROGRESS.md`, `CLAUDE.md`

- [ ] **Step 1: Spec.** Under section 12 add "### While planning stage B (2026-11-04, plan `docs/superpowers/plans/2026-11-04-ai-stage-b-listing-check.md`)" with this plan's nine planning decisions, one line each, and "### While building stage B" with anything that changed while building. Change the header's status line to say stage B is built.
- [ ] **Step 2: GO-LIVE.** Add a block "### The listing check (after the submission)" after photo-to-listing's: push `20261104120000_listing_check.sql` (dry run first, Lama's go-ahead); set `VOSSIE_AI_LISTING_CHECK=1` in Vercel (the Anthropic key is photo-to-listing's), then redeploy (the privacy line is drawn at build); after two weeks, read the `[vossie] listing-check:` log lines and the Reports queue's listing-check reports, and how many were dismissed.
- [ ] **Step 3: CLAUDE.md.** One rule under the photo-to-listing rule: "The listing check (AI stage B): `checkListingGuidelines` in `lib/data/ai.ts`, Haiku and the fake only (`featureProviders`), fails open; `saveListingForm` runs it on a publish (and on a save whose title, description or photos changed) after the field checks and before the token; only high confidence stops it; Publish anyway posts the concern and files a report with no reporter account ("The listing check", `fileListingCheckReport`), which tells no one when it closes. Off behind `VOSSIE_AI_LISTING_CHECK`."
- [ ] **Step 4: PROGRESS.md.** A "2026-11-04: AI stage B, the listing check" entry before "## Next" with what was built, the checks and their numbers, and "Nothing committed yet: waiting on Lama". Update the AI features bullet under "## Next" (stage B built; C to E not planned).

---

### Task 13: The whole check

- [ ] **Step 1:** `pnpm lint && pnpm typecheck`: clean.
- [ ] **Step 2:** `pnpm test`: all pass (it was 3,615 before stage A's final fixes; say the new count).
- [ ] **Step 3:** On the local stack: `supabase db reset && supabase test db && pnpm test:db`: all pass.
- [ ] **Step 4:** The device projects once, with two workers on a quiet machine (`pnpm e2e --workers=2`, in the background): compare with the 2026-11-03 run (1,485 passed). Report any failure with its rerun on its own.
- [ ] **Step 5:** Leave everything uncommitted and report to the controller: files changed, the counts, the bytes, and anything decided while building.
