# AI stage G: "Someone's looking for this" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Never commit** in this project: leave the work uncommitted for the controller (Lama's rule).

**Goal:** When a student posts or edits a Looking For request, its title and details are read once into a stored search (`match_query`). When a shop publishes a listing for the first time, the app checks it against the open requests' stored searches at the listing's campus, with no model call. The "Published" notice on My listings then adds "2 students are looking for something like this" and links to up to three requests, each with "Make an offer". The asker hears only when an offer is made, as today.

**Architecture:** The pure rules live in `lib/looking-for/match.ts`: the words that are read, the stored search built from a parse, what an edit does to it, the matcher over browse's `listingMatches`, and the line. The notice's form-state values live in `lib/selling/wanted.ts`. The data layer has two halves:
- **Matching:** `lib/data/request-match.ts` (and its Supabase twin) gives the candidates, stores a search, reads one back, lists the unread, and runs `requestsWantingListing` for a published listing. Stage I's `answer-request` reuses this module, so it never imports the AI door.
- **Reading:** `lib/data/request-reading.ts` holds `readRequestMatch`, which `saveMyRequest` calls after the save through the words search's cached `parseSearchWords`, and the backfill.

`saveListingForm` calls `requestsWantingListing` after `notifySavedSearches`, under the same first-publish condition, and keeps the count and the ids in My listings' notice. `MyListings` reads each request's title through the cached `getRequest`. On Supabase, two columns on `public.requests` hold the search. Only the service role reads them (directly) and writes them (`public.save_request_match`), and neither column is in any column grant or view. The one-off backfill is a Route Handler called by hand behind `CRON_SECRET`. The feature is off behind `VOSSIE_AI_LOOKING_MATCH`.

**Tech Stack:** Next.js 16.4 (Server Actions, Cache Components, a Route Handler), TypeScript, Vitest 5, Playwright + axe, Supabase Postgres (plpgsql, pgTAP).

**Spec:** `docs/superpowers/specs/2026-11-04-ai-round-two-design.md`: section 5, section 8, and section 2.1's `answer-request` row (stage I reuses this stage's matcher). Decision 97. Read `CLAUDE.md` and `AGENTS.md` first, especially the Looking For, saved searches, words search, Supabase and e2e write-project bullets. Then read stage E's plan (`2026-11-05-ai-stage-e-words-search.md`): this stage reuses its parse, its cap and its fake.

**Parallel work:** stages F (photo tips) and H (starter pack) may be built at the same time in other worktrees.
- **Owned here:** stage G owns `VOSSIE_AI_LOOKING_MATCH`, `lib/looking-for/match.ts`, `lib/selling/wanted.ts`, `lib/data/request-match.ts`, `lib/data/request-reading.ts`, `20261106120000_looking_match.sql`, `66_looking_match.test.sql` and `/api/cron/request-matches`.
- **Shared files:** `lib/ai/config.ts`, `app/privacy/page.tsx`, `playwright.config.ts`, `lib/data/store.ts` (`STORE_VERSION`), `lib/supabase/database.types.ts`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md` and the spec's status line. **Add your own lines in your own block; never reorder, reformat or rename what's there.** If H bumps `STORE_VERSION` too, the controller merges the two numbers.
- **Locks:** the controller alone runs `supabase`, `pnpm test:db`, `pnpm build` and Playwright, under its locks (`supabase.lock`, `e2e-3200.lock` in the coordination folder the controller names). Never `supabase stop`, `db reset` or `db push` yourself.

---

## Planning decisions (Lama may overturn any; they go in the spec's new section 10 in Task 12)

1. **The stored search is a `MatchQuery`.** That is browse's `SearchQuery` without its order, the same shape a saved search has, so `listingMatches` takes it unchanged.
   - Its `q` is the model's.
   - Its `category` and `campus` are the request's own fields, which the student chose from the same lists sellers use. The model's category and campus are dropped, the way the link wins in `applyWords`.
   - It has no `price`, `pay` or `deals`. The request shows its budget and swap choice, and a seller may offer above a budget ("Open to offers" is common), so filtering on price would hide matches.
   - A parse whose `q` has no search words (`queryWords` empty) stores no search: an empty `q` would match every listing in the category.
2. **What's read is the title and details together**: `"{title}. {details}"`, normalised as the words search does (trimmed, spaces and line breaks collapsed, lowercased), cut at 300 characters at a word (`REQUEST_WORDS_MAX`), not Browse's 100.
   - The text is checked with `looksLikeSentence`. A request that isn't a sentence stores no search; in practice every request is one, since details are 20 characters or more.
   - That string is `parseSearchWords`' cache key and the only input: no account, no campus cookie, no budget.
3. **Where the read runs:**
   - **Place:** in `saveMyRequest`, after the request is saved and before `clearOwnFormState`, the note, `requestsChanged()` and `done()`. It runs in the action, not in `after()`, so the next publish (and the e2e test) always sees it. A post is rare, and the wait is Haiku's 3-second `quick` limit at worst.
   - **What it calls:** `parseSearchWords` (`"use cache"`, whose cap reservation is the one allowed `forServer()` call inside a cache) from request-time code. Nothing new runs inside `"use cache"`.
   - **Failures:** `readRequestMatch` never throws (a failure is logged by kind only), so a request is always posted.
   - **No tag:** the stored search has no tag of its own, because no cached reader reads `match_query`. Matching reads it at request time.
4. **`match_read_at` marks a request as read, with or without a search.** A request that couldn't be read (full cap, failed call, not a sentence, no item words) has `match_read_at` set and no search, so it's never matched and the backfill never retries it. A request with `match_read_at` null hasn't been read yet, and the backfill takes it.
5. **What an edit does** (`matchStep`):
   - Words unchanged and already read: nothing, or "move" (the stored search takes the new category and campus) when those changed. No parse, no cap.
   - Words changed: read again.
   - With the switch off, the app reads nothing. A new request stays unread (the backfill reads it later), and an edit that changes the words clears the stored search and its read, since it no longer describes the request. A "move" still happens, since it isn't a read.
6. **Sample requests (no asker) are never read or matched:** they can't take offers (`offerStatus` says "sample").
7. **The count is of students, not requests:** distinct askers. The links go to up to three requests, at most one per student (their best match), ordered by match score, then newest.
   - Left out: the seller's own requests (spec), and requests this shop has already made an offer on (`findOffer`), which the composer would only show as "offered". Stage I's done check is "the shop makes an offer", so the two agree.
8. **The notice carries the count and the ids, not the titles.** `saveListingForm` writes `wanted` and `wantedIds` into My listings' form-state values. `MyListings` reads each request through the cached `getRequest`, keeps only those still open (`requestOpenOn`), and shows the current titles. If none are left open, there's no line.
9. **The line sits outside the `role="status"` paragraph,** in its own block right after it, so the existing tests that check the notice's exact text keep passing.
   - The links are plain, untyped `next/link`s with `prefetch={false}`, as "See it as buyers do" is.
   - "Make an offer" carries a visually hidden " on {title}", so every link has a distinct name whose start is its visible text (WCAG 2.4.4 and 2.5.3).
   - The line ends with a full stop: "1 student is looking for something like this."
10. **The backfill is a Route Handler called by hand:** `GET /api/cron/request-matches` with `Authorization: Bearer $CRON_SECRET`.
    - It isn't in `vercel.json`.
    - Each call reads up to 15 unread open requests, oldest first, and answers `{ matched, unmatched, more, capped }`. The call is repeated until `more` is false.
    - It calls `reserveWordsSearch` and `readSearchWords` directly, not the cached parse. A full cap is then known, and the backfill stops without marking anything, so the next day can carry on. The words are unique per request, so a cache wouldn't help.
    - It answers 404 in sample mode and while the switch is off ("no reading").
11. **Supabase:**
    - New columns: `requests.match_query jsonb` (its shape is checked) and `match_read_at timestamptz`.
    - Neither column is in the column grants to `anon` or `authenticated`, nor in `request_cards` or `my_requests`. Only the service role reads them.
    - The one writer is `public.save_request_match(p_request, p_query, p_read)`, service role only. It never touches `updated_at`, so `closes_on` doesn't move (stage L), and it refuses a sample request.
12. **The data download includes it** as `matchedAs`, a label such as "“calculator” in Tech at Midrand" (`savedSearchLabel`), or null. It's derived from the student's own words, kept with their request and used to show that request to shops, so POPIA's right of access covers it. This mirrors saved searches being in the download by name.
    - The privacy page gets a line: what's sent to Anthropic, that it's read outside South Africa, and that the search is kept with the request and is in the download.
    - Deleting the request, or the account, removes it.
13. **End-to-end tests:**
    - **Where:** `tests/e2e/community-writes.spec.ts` (CLAUDE.md: tests that post requests or publish listings), with axe in the same test, since `community-checks.spec.ts` publishes nothing by design.
    - **No new layout-shift test:** the line comes once (`takeNotice` clears it), so the reload-based `expectPageStill` can't measure it. Instead, the line renders in the same server stream as the notice, and the test checks that both arrive together. `/sell/listings`' existing shift checks stand.
    - **Budget:** the stage adds no client code, so the build's `/sell/listings` first-visit JavaScript must be unchanged.
14. **No word-dropping fallback.** Matching requires every `q` word (`listingMatches`), as Browse does. Snap to search's lesson (decision 96's real-key test) says an over-specific `q` can find nothing. The hand test (Task 10) measures how often that happens on the 16 sample requests and reports it to Lama before the switch goes on. No fallback is built in this stage.
15. **Where things are counted:** each read takes one of the words search's 2,000 daily parses on a cache miss (spec section 5: "the same parsing"). The model is never asked to count characters: the code cuts the words and `checkWords` already cuts `q` at 100 characters.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/ai/config.ts` (+ test) | modify | `"looking-match"` feature, `VOSSIE_AI_LOOKING_MATCH`, Haiku and the fake only |
| `lib/looking-for/match.ts` (+ `.test.ts`) | create | `requestWords`, `requestMatchQuery`, `withPlace`, `asMatchQuery`, `matchStep`, `matchRequests`, `wantedFrom`, `wantedLine` |
| `lib/selling/wanted.ts` (+ `.test.ts`) | create | `wantedValues`, `readWanted` (My listings' form-state values) |
| `lib/data/rows.ts` | modify | `RequestRow.matchQuery`, `RequestRow.matchReadAt` |
| `lib/data/store.ts` | modify | `STORE_VERSION` 18 and its note |
| `data/fixtures/request-rows.ts` | modify | samples: `matchQuery: null, matchReadAt: null` |
| `lib/data/requests.ts` | modify | `createRequest` sets both null; `requestExport` gains `matchedAs` |
| `tests/contract/sample-world.ts` | modify | `addRequest` sets both null |
| `supabase/migrations/20261106120000_looking_match.sql` | create | columns, shape checks, indexes, `save_request_match` |
| `supabase/tests/66_looking_match.test.sql` | create | pgTAP |
| `lib/supabase/database.types.ts` | modify | the two columns and the function (hand edit; the controller regenerates) |
| `lib/data/request-match.ts` (+ `.test.ts`) | create | `requestMatchCandidates`, `requestsWantingListing`, `saveRequestMatch`, `requestMatchOf`, `unreadRequests` |
| `lib/data/supabase/request-match.ts` | create | the Supabase twin |
| `lib/data/supabase/saved-searches.ts` | modify | `export` on `listedListing` (no other change) |
| `lib/data/supabase/requests.ts` | modify | `exportRequests` reads `match_query` with the admin client |
| `lib/data/contract/request-match.contract.ts`, `.test.ts`, `.db.test.ts` | create | both backends |
| `lib/data/request-reading.ts` (+ `.test.ts`) | create | `readRequestMatch`, `backfillRequestMatches` |
| `lib/looking-for/actions.ts` (+ tests) | modify | `saveMyRequest` calls `readRequestMatch` |
| `app/api/cron/request-matches/route.ts` (+ `route.test.ts`) | create | the backfill |
| `lib/selling/listing-actions.ts` (+ test) | modify | first publish runs `requestsWantingListing`; notice values |
| `components/sell/MyListings.tsx`, `MyListingsView.tsx` (+ tests) | modify | the line and its links |
| the CSS file holding `.form-notice` | modify | `.wanted-notice` |
| `app/privacy/page.tsx` (+ test) | modify | the line |
| `scripts/looking-match.hand.ts` | create | the real-key hand test |
| `playwright.config.ts`, `tests/e2e/community-writes.spec.ts` | modify | the switch on with the fake; the e2e test |
| `CLAUDE.md`, the spec, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md` | modify | docs |

Run unit tests for a task's files only (`pnpm exec vitest run <paths>`); the whole suite runs once, in Task 13.

---

### Task 1: The switch

**Files:** Modify `lib/ai/config.ts`, `lib/ai/config.test.ts`.

- [ ] **Step 1: Failing test** (append beside the words search's test in `lib/ai/config.test.ts`):

```ts
it("turns the looking match on only with its switch and Haiku or the fake (AI stage G)", () => {
  const groq = { VOSSIE_AI_PROVIDERS: "groq", GROQ_API_KEY: "g", VOSSIE_AI_LOOKING_MATCH: "1" };
  expect(featureProviders("looking-match", groq)).toEqual([]);
  expect(aiFeatureOn("looking-match", groq)).toBe(false);
  const haiku = { VOSSIE_AI_PROVIDERS: "groq,anthropic", GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" };
  expect(featureProviders("looking-match", haiku)).toEqual(["anthropic"]);
  expect(aiFeatureOn("looking-match", haiku)).toBe(false);
  expect(aiFeatureOn("looking-match", { ...haiku, VOSSIE_AI_LOOKING_MATCH: "1" })).toBe(true);
  expect(aiFeatureOn("looking-match", { VOSSIE_AI_PROVIDERS: "fake", VOSSIE_AI_LOOKING_MATCH: "1" })).toBe(true);
  // Its own switch: the words search's switch doesn't turn it on.
  expect(aiFeatureOn("looking-match", { VOSSIE_AI_PROVIDERS: "fake", VOSSIE_AI_WORDS_SEARCH: "1" })).toBe(false);
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/ai/config.test.ts` → FAIL (unknown feature).
- [ ] **Step 3:** In `lib/ai/config.ts`, add each line as the last entry (don't reorder):
  - `AiFeature`: `| "looking-match"`.
  - `SWITCHES`: `"looking-match": "VOSSIE_AI_LOOKING_MATCH",`.
  - `ONLY`: `"looking-match": ["anthropic", "fake"],`.
  - Update the `AiFeature` doc comment to "Stages C to E and G add theirs here".
  - No new `AiTask`: the read is the words search's task (`"words-search"`), so its log lines say `words-search`.
- [ ] **Step 4:** test passes; `pnpm typecheck` clean.

### Task 2: The pure rules

**Files:** Create `lib/looking-for/match.ts`, `lib/looking-for/match.test.ts`, `lib/selling/wanted.ts`, `lib/selling/wanted.test.ts`.

- [ ] **Step 1: Failing tests** (`lib/looking-for/match.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { ParsedWords } from "@/lib/browse/words";
import type { Listing, MatchQuery } from "@/lib/types";
import { listings } from "@/data/fixtures/listings";
import {
  asMatchQuery,
  matchRequests,
  matchStep,
  REQUEST_WORDS_MAX,
  requestMatchQuery,
  requestWords,
  wantedFrom,
  wantedLine,
  withPlace,
  type MatchCandidate,
} from "./match";
import type { RequestFields } from "./rules";

const FIELDS: RequestFields = {
  title: "Casio fx-991 calculator",
  categorySlug: "tech",
  campusSlug: "midrand",
  details: "Need it for\n\nmy stats exam.   Can meet at the library.",
  budgetZar: 250,
  swapWelcome: false,
  neededBy: null,
};
const parsed = (changes: Partial<ParsedWords> = {}): ParsedWords => ({
  q: "casio calculator",
  category: "textbooks-notes",
  campus: "pretoria",
  price: "under-500",
  pay: "cash",
  deals: null,
  sort: "price-low",
  ...changes,
});
const QUERY: MatchQuery = { q: "casio calculator", category: "tech", campus: "midrand", price: null, pay: null, deals: null };

describe("requestWords (planning decision 2)", () => {
  it("joins the title and details, collapses spaces and lowercases", () => {
    expect(requestWords(FIELDS)).toBe("casio fx-991 calculator. need it for my stats exam. can meet at the library.");
  });
  it("adds no full stop after a title that ends with one", () => {
    expect(requestWords({ title: "Anyone selling a kettle?", details: "Mine broke this week, sadly." })).toBe(
      "anyone selling a kettle? mine broke this week, sadly.",
    );
  });
  it("cuts at 300 characters, at a word", () => {
    const words = requestWords({ title: "Desk lamp", details: "lamp ".repeat(100) });
    expect(Array.from(words).length).toBeLessThanOrEqual(REQUEST_WORDS_MAX);
    expect(words.endsWith("lamp")).toBe(true);
  });
});

describe("requestMatchQuery (planning decision 1)", () => {
  it("takes the model's q and the request's own category and campus, with no price, pay or deals", () => {
    expect(requestMatchQuery(parsed(), FIELDS)).toEqual(QUERY);
  });
  it.each([null, "", "  ", "a the of"])("stores nothing when q %j has no search words", (q) => {
    expect(requestMatchQuery(parsed({ q }), FIELDS)).toBeNull();
  });
  it("moves a search to a new category and campus", () => {
    expect(withPlace(QUERY, { categorySlug: "res-living", campusSlug: "pretoria" })).toEqual({
      ...QUERY,
      category: "res-living",
      campus: "pretoria",
    });
  });
});

describe("asMatchQuery (a stored search read back)", () => {
  it("takes a stored search", () => {
    expect(asMatchQuery(JSON.parse(JSON.stringify(QUERY)))).toEqual(QUERY);
  });
  it.each([
    ["null", null],
    ["an array", [QUERY]],
    ["no q", { ...QUERY, q: null }],
    ["a q of stop words", { ...QUERY, q: "the" }],
    ["an extra key", { ...QUERY, owner: "x" }],
    ["a missing key", { q: "lamp", category: null, campus: "midrand", price: null, pay: null }],
    ["a bad price", { ...QUERY, price: "under-7" }],
    ["a bad pay", { ...QUERY, pay: "card" }],
    ["a bad deals", { ...QUERY, deals: "yes" }],
    ["no campus", { ...QUERY, campus: null }],
  ])("refuses %s", (_name, value) => {
    expect(asMatchQuery(value)).toBeNull();
  });
});

describe("matchStep (planning decisions 4 and 5)", () => {
  const read = { query: QUERY, readAt: "2026-11-04T10:00:00.000Z" };
  const unreadable = { query: null, readAt: "2026-11-04T10:00:00.000Z" };
  const never = { query: null, readAt: null };
  const moved = { ...FIELDS, campusSlug: "pretoria" };
  const reworded = { ...FIELDS, title: "Sharp EL-W506 calculator" };

  it("reads a new request while on, and does nothing while off", () => {
    expect(matchStep(null, FIELDS, null, true)).toBe("read");
    expect(matchStep(null, FIELDS, null, false)).toBe("nothing");
  });
  it("leaves an edit that changes neither the words nor the place", () => {
    expect(matchStep(FIELDS, { ...FIELDS, budgetZar: 300 }, read, true)).toBe("nothing");
    expect(matchStep(FIELDS, { ...FIELDS, budgetZar: 300 }, read, false)).toBe("nothing");
  });
  it("moves a read search to a new category or campus without reading, on or off", () => {
    expect(matchStep(FIELDS, moved, read, true)).toBe("move");
    expect(matchStep(FIELDS, moved, read, false)).toBe("move");
    expect(matchStep(FIELDS, moved, unreadable, true)).toBe("nothing");
  });
  it("reads again when the words change, or when it was never read, while on", () => {
    expect(matchStep(FIELDS, reworded, read, true)).toBe("read");
    expect(matchStep(FIELDS, FIELDS, never, true)).toBe("read");
  });
  it("clears a search whose words changed while off, and leaves one never read", () => {
    expect(matchStep(FIELDS, reworded, read, false)).toBe("clear");
    expect(matchStep(FIELDS, reworded, unreadable, false)).toBe("clear");
    expect(matchStep(FIELDS, reworded, never, false)).toBe("nothing");
  });
});

describe("matchRequests and wantedFrom (planning decision 7)", () => {
  // l-001 is the sample "Casio fx-991ZA Plus calculator", Tech corner, Midrand.
  const casio = listings.find((listing) => listing.id === "l-001") as Listing;
  const names = { sellers: new Map([[casio.sellerSlug, "Tech corner"]]), categories: new Map([["tech", "Tech"]]) };
  const candidate = (id: string, askerId: string, changes: Partial<MatchQuery> = {}, createdAt = "2026-11-01T08:00:00.000Z"): MatchCandidate => ({
    id,
    title: `Request ${id}`,
    askerId,
    query: { ...QUERY, q: "calculator", campus: casio.campusSlug, ...changes },
    createdAt,
  });

  it("matches with browse's own rules and leaves out the seller's own requests", () => {
    const found = matchRequests(
      casio,
      [
        candidate("r-a", "acc-1"),
        candidate("r-own", "owner"),
        candidate("r-elsewhere", "acc-2", { campus: "pretoria" }),
        candidate("r-books", "acc-3", { category: "textbooks-notes" }),
        candidate("r-lamp", "acc-4", { q: "lamp" }),
      ],
      names,
      "owner",
    );
    expect(found.map((match) => match.id)).toEqual(["r-a"]);
  });
  it("orders by score, then newest, and counts each student once", () => {
    const found = matchRequests(
      casio,
      [
        candidate("r-old", "acc-1", {}, "2026-10-01T08:00:00.000Z"),
        candidate("r-new", "acc-1", {}, "2026-11-02T08:00:00.000Z"),
        candidate("r-casio", "acc-2", { q: "casio calculator" }),
        candidate("r-3", "acc-3"),
        candidate("r-4", "acc-4"),
      ],
      names,
      "owner",
    );
    expect(found[0].id).toBe("r-casio");
    const wanted = wantedFrom(found);
    expect(wanted.students).toBe(4);
    expect(wanted.requests).toHaveLength(3);
    expect(wanted.requests.map((request) => request.id)).not.toContain("r-old");
  });
  it("says how many students", () => {
    expect(wantedLine(1)).toBe("1 student is looking for something like this.");
    expect(wantedLine(2)).toBe("2 students are looking for something like this.");
  });
});
```

  (Check that `l-001` really is the Casio calculator at Midrand in `data/fixtures/listings.ts`, and its category is `tech`. If the id differs, use the id the stage E plan's e2e names for "Casio fx-991ZA Plus calculator".)

  `lib/selling/wanted.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readWanted, wantedValues } from "./wanted";

describe("the notice's wanted values (planning decision 8)", () => {
  it("writes the count and up to three ids, and nothing for no students", () => {
    expect(wantedValues({ students: 4, requests: [{ id: "r-a", title: "A" }, { id: "r-b", title: "B" }] })).toEqual({
      wanted: "4",
      wantedIds: "r-a r-b",
    });
    expect(wantedValues({ students: 0, requests: [] })).toEqual({});
    expect(wantedValues(null)).toEqual({});
  });
  it("reads them back, refusing anything a form could have made up", () => {
    expect(readWanted({ listing: "l-1", wanted: "2", wantedIds: "r-a r-b" })).toEqual({ students: 2, ids: ["r-a", "r-b"] });
    expect(readWanted({ wanted: "2", wantedIds: "r-a R-B ../x r-c r-d r-e" })).toEqual({ students: 2, ids: ["r-a", "r-c", "r-d"] });
    expect(readWanted({ wanted: "0", wantedIds: "r-a" })).toBeNull();
    expect(readWanted({ wanted: "1.5", wantedIds: "r-a" })).toBeNull();
    expect(readWanted({ wanted: "2", wantedIds: "" })).toBeNull();
    expect(readWanted({ listing: "l-1" })).toBeNull();
    expect(readWanted(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/looking-for/match.test.ts lib/selling/wanted.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** `lib/looking-for/match.ts`:

```ts
import { listingMatches, type ListingNames } from "@/lib/browse/results";
import { queryWords } from "@/lib/browse/search";
import type { ParsedWords } from "@/lib/browse/words";
import type { Listing, MatchQuery, PayFilter, PriceFilter } from "@/lib/types";
import type { RequestFields } from "./rules";

// "Someone's looking for this" (AI round two spec section 5; AI stage G plan): a request's own words are read once into
// a stored search, and a first publish is matched against the open ones with browse's own listingMatches, never a copy
// of its rules. Pure: lib/data/request-match.ts and lib/data/request-reading.ts call these, and Shop coach's
// answer-request (stage I) reuses matchRequests so the two always agree. Askers are compared here, never shown.

/** The most of a request's words that are read (planning decision 2): the title and the start of the details. */
export const REQUEST_WORDS_MAX = 300;
/** The most requests the Published notice links to (spec 5). */
export const WANTED_SHOWN = 3;

type Words = Pick<RequestFields, "title" | "details">;
type Place = Pick<RequestFields, "categorySlug" | "campusSlug">;

/** "{title}. {details}", trimmed, spaces and line breaks collapsed, lowercased, cut at a word: the cache key and the only input. */
export function requestWords({ title, details }: Words): string {
  const head = title.trim();
  const text = `${/[.!?]$/.test(head) ? head : `${head}.`} ${details}`.replace(/\s+/g, " ").trim().toLowerCase();
  const chars = Array.from(text);
  if (chars.length <= REQUEST_WORDS_MAX) return text;
  const cut = chars.slice(0, REQUEST_WORDS_MAX).join("");
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

/**
 * The stored search (planning decision 1): the model's q, and the request's own category and campus; no price, pay or
 * deals. Null when q has no search words, since an empty q would match everything in the category.
 */
export function requestMatchQuery(parse: ParsedWords, place: Place): MatchQuery | null {
  if (queryWords(parse.q).length === 0) return null;
  return { q: parse.q, category: place.categorySlug, campus: place.campusSlug, price: null, pay: null, deals: null };
}

/** A read search moved to the request's new category and campus (planning decision 5): no read, no cap. */
export function withPlace(query: MatchQuery, place: Place): MatchQuery {
  return { ...query, category: place.categorySlug, campus: place.campusSlug };
}

const KEYS = "campus,category,deals,pay,price,q";
const PRICES: readonly PriceFilter[] = ["free", "under-50", "under-100", "under-250", "under-500"];
const PAYS: readonly PayFilter[] = ["cash", "swap"];
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T | null =>
  value === null || (typeof value === "string" && (allowed as readonly string[]).includes(value));

/** A stored search read back (Supabase's jsonb, or anything else): null unless it's exactly a MatchQuery with search words. */
export function asMatchQuery(value: unknown): MatchQuery | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== KEYS) return null;
  const { q, category, campus, price, pay, deals } = record;
  if (typeof q !== "string" || queryWords(q).length === 0) return null;
  if (category !== null && typeof category !== "string") return null;
  if (typeof campus !== "string" || campus === "") return null;
  if (!oneOf(price, PRICES) || !oneOf(pay, PAYS) || !oneOf(deals, ["free-and-swaps"] as const)) return null;
  return { q, category, campus, price, pay, deals };
}

/** A request's stored search and when it was read (with or without one); null readAt means never read. */
export type StoredMatch = { query: MatchQuery | null; readAt: string | null };

/** What a save does to the stored search (planning decisions 4 and 5). */
export type MatchStep = "nothing" | "read" | "move" | "clear";

export function matchStep(
  before: RequestFields | null,
  after: RequestFields,
  stored: StoredMatch | null,
  on: boolean,
): MatchStep {
  if (before === null) return on ? "read" : "nothing";
  const read = Boolean(stored?.readAt);
  const samePlace = before.categorySlug === after.categorySlug && before.campusSlug === after.campusSlug;
  if (requestWords(before) === requestWords(after)) {
    if (on && !read) return "read";
    return samePlace || !stored?.query ? "nothing" : "move";
  }
  if (on) return "read";
  return read || stored?.query ? "clear" : "nothing";
}

/** An open request with a stored search, as the matcher sees it. `askerId` is compared and counted, never shown. */
export type MatchCandidate = { id: string; title: string; askerId: string; query: MatchQuery; createdAt: string };

export type RequestMatch = MatchCandidate & { score: number };

/**
 * The requests a listing answers (spec 5): each candidate's stored search through browse's listingMatches, the
 * seller's own left out, best score first, then newest. Its campus is the request's, so only the listing's campus matches.
 */
export function matchRequests(
  listing: Listing,
  candidates: readonly MatchCandidate[],
  names: ListingNames,
  ownerId: string,
): RequestMatch[] {
  const found: RequestMatch[] = [];
  for (const candidate of candidates) {
    if (candidate.askerId === ownerId) continue;
    const score = listingMatches(listing, candidate.query, names);
    if (score !== null) found.push({ ...candidate, score });
  }
  return found.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
}

/** What the Published notice says (planning decision 7): how many students, and up to three requests, one each. */
export type Wanted = { students: number; requests: { id: string; title: string }[] };

export function wantedFrom(matches: readonly RequestMatch[]): Wanted {
  const seen = new Set<string>();
  const requests: Wanted["requests"] = [];
  for (const match of matches) {
    if (seen.has(match.askerId)) continue;
    seen.add(match.askerId);
    if (requests.length < WANTED_SHOWN) requests.push({ id: match.id, title: match.title });
  }
  return { students: seen.size, requests };
}

/** "2 students are looking for something like this." (spec 5). */
export function wantedLine(students: number): string {
  return students === 1
    ? "1 student is looking for something like this."
    : `${students} students are looking for something like this.`;
}
```

  `lib/selling/wanted.ts`:

```ts
import type { Wanted } from "@/lib/looking-for/match";
import { WANTED_SHOWN } from "@/lib/looking-for/match";
import { isId } from "@/lib/messaging/paths";

// The Published notice's "students are looking" part, in My listings' form state (AI stage G planning decision 8): the
// count and the request ids only. MyListings reads the titles at render, through the cached public reader.

const MOST_STUDENTS = 999;

export function wantedValues(wanted: Wanted | null): Record<string, string> {
  if (!wanted || wanted.students < 1 || wanted.requests.length === 0) return {};
  return { wanted: String(wanted.students), wantedIds: wanted.requests.map((request) => request.id).join(" ") };
}

/** The count and up to three ids, or null when the values hold none, or anything a form could have made up. */
export function readWanted(values: Readonly<Record<string, string>> | undefined): { students: number; ids: string[] } | null {
  const students = Number(values?.wanted);
  if (!Number.isInteger(students) || students < 1 || students > MOST_STUDENTS) return null;
  const ids = (values?.wantedIds ?? "").split(" ").filter(isId).slice(0, WANTED_SHOWN);
  return ids.length > 0 ? { students, ids } : null;
}
```

- [ ] **Step 4:** both test files pass; `pnpm typecheck` clean.

### Task 3: Where the search is stored (sample store, Supabase migration, pgTAP)

**Files:** Modify `lib/data/rows.ts`, `lib/data/store.ts`, `data/fixtures/request-rows.ts`, `lib/data/requests.ts` (`createRequest` only in this task), `tests/contract/sample-world.ts`, `lib/supabase/database.types.ts`. Create `supabase/migrations/20261106120000_looking_match.sql`, `supabase/tests/66_looking_match.test.sql`.

- [ ] **Step 1: The row.** In `RequestRow` (`lib/data/rows.ts`), after `remindedFor`:

```ts
  /**
   * The search its own words were read into ("Someone's looking for this", AI stage G): the model's q with its own
   * category and campus. Null until read, when it couldn't be read, and on the samples. Never shown to anyone.
   */
  matchQuery: MatchQuery | null;
  /** When it was read, with or without a search (stage G planning decision 4). Null until then, and on the samples. */
  matchReadAt: string | null;
```

  Import `MatchQuery` from `@/lib/types`. Then set `matchQuery: null, matchReadAt: null` in `data/fixtures/request-rows.ts`, in `createRequest`'s new row (`lib/data/requests.ts`) and in `sample-world.ts`' `addRequest`. `pnpm typecheck` lists any other place that builds a `RequestRow` (tests included): give each the two nulls.
- [ ] **Step 2: The store's version.** `STORE_VERSION = 18`, with the note line `* 18: a Looking For request keeps the search its words were read into (`matchQuery`, `matchReadAt`, AI stage G).` Check `scripts/seed-sql.ts`: it writes the requests' columns by name, so the two new nullable columns need nothing there. Run `pnpm exec vitest run scripts/seed-sql.test.ts data/fixtures` to be sure.
- [ ] **Step 3: The migration** `supabase/migrations/20261106120000_looking_match.sql`. First check there's still no trigger on `public.requests` (`grep -n "on public.requests" supabase/migrations/*.sql`): the write must not move `updated_at`.

```sql
-- "Someone's looking for this" (AI round two spec 5; AI stage G plan 2026-11-04-ai-stage-g-looking-match.md, Task 3).
-- 1. requests.match_query: the search a request's own words were read into, a MatchQuery (lib/types.ts: q, category,
--    campus, price, pay, deals) whose q has words, or null. match_read_at: when it was read, with or without a search;
--    null until then, so the backfill knows what's left (planning decision 4). Only an asker's request has them.
--    Neither is in the column grants to anon or authenticated (20261020120200_community_tables.sql) nor in
--    request_cards or my_requests: only the service role reads them, to match a first publish and for the asker's
--    data download.
-- 2. public.save_request_match: the one writer, service role only. It never sets updated_at, so closes_on doesn't
--    move (stage L). A query needs a read; a read of false clears both.

alter table public.requests
  add column match_query jsonb,
  add column match_read_at timestamptz,
  add constraint requests_match_query_shape check (
    match_query is null or (
      jsonb_typeof(match_query) = 'object'
      and match_query ?& array['q', 'category', 'campus', 'price', 'pay', 'deals']
      and (match_query - array['q', 'category', 'campus', 'price', 'pay', 'deals']) = '{}'::jsonb
      and jsonb_typeof(match_query -> 'q') = 'string'
      and char_length(match_query ->> 'q') between 1 and 100
      and jsonb_typeof(match_query -> 'campus') = 'string'
    )
  ),
  add constraint requests_match_query_read check (match_query is null or match_read_at is not null),
  add constraint requests_match_asker check (asker_id is not null or (match_query is null and match_read_at is null));

-- Matching a first publish: open, shown requests with a search at one campus.
create index requests_match_idx on public.requests (campus_slug)
  where status = 'open' and hidden_at is null and match_query is not null;
-- The backfill: open, shown asker requests not yet read, oldest first.
create index requests_match_unread_idx on public.requests (created_at)
  where status = 'open' and hidden_at is null and asker_id is not null and match_read_at is null;

create function public.save_request_match(p_request text, p_query jsonb, p_read boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_read is null or (not p_read and p_query is not null) then
    raise exception 'save_request_match: a search needs a read' using errcode = '22023';
  end if;
  update public.requests
  set match_query = p_query,
      match_read_at = case when p_read then now() else null end
  where id = p_request and asker_id is not null;
  return found;
end;
$$;

revoke all on function public.save_request_match(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_request_match(text, jsonb, boolean) to service_role;
```

- [ ] **Step 4: pgTAP** `supabase/tests/66_looking_match.test.sql`. Copy `63_report_read.test.sql`'s frame (`begin; select plan(N);`, the `pg_temp.a`/`sign_in`/`as_service` helpers, its own campus `lm-campus` and category `lm-category`, `rollback`). Insert two profiles (`f1` asker, `f2` other), one asker request `lm-r1` (`asker_id = pg_temp.a('f1')`, `updated_at = now() - interval '3 days'`), and one sample request `lm-r0` (`asker_id` null). Assertions:
  1. `has_column('public', 'requests', 'match_query', …)` and `has_column(… 'match_read_at' …)`.
  2. `ok(not has_column_privilege('authenticated', 'public.requests', 'match_query', 'select'), …)`, and the same for `anon` and for `match_read_at`.
  3. `hasnt_column('public', 'request_cards', 'match_query', …)`, and `hasnt_column('public', 'my_requests', 'match_query', …)`.
  4. `ok(not has_function_privilege('authenticated', 'public.save_request_match(text, jsonb, boolean)', 'execute'), …)`, the same for `anon`, and `ok(has_function_privilege('service_role', …))`.
  5. As the service role: `save_request_match('lm-r1', '{"q":"desk lamp","category":"lm-category","campus":"lm-campus","price":null,"pay":null,"deals":null}', true)` is true. The row then has that query and a `match_read_at`, and its `updated_at` and `closes_on` are what they were before (select them into a temp table first).
  6. `save_request_match('lm-r0', <the same>, true)` is false, and `lm-r0` still has nulls.
  7. `save_request_match('lm-r1', null, false)` is true, and both columns are null.
  8. `save_request_match('lm-r1', null, true)` is true: `match_read_at` is set and the query is null (read, no search).
  9. `throws_ok` with `22023` for `('lm-r1', <query>, false)` and for `('lm-r1', null, null)`.
  10. `throws_ok` with `23514` (check violation) for each of: an array, a query missing `deals`, one with an extra `owner` key, `"q": ""`, `"q": 5`, `"campus": null`.
  11. As `f1` signed in (`pg_temp.sign_in('f1')`), `select match_query from public.requests` throws `42501` (permission denied).
- [ ] **Step 5: Types.** Hand-edit `lib/supabase/database.types.ts`:
  - In `requests`' `Row`, add `match_query: Json | null` and `match_read_at: string | null`; in `Insert` and `Update`, add the same as optional, each in alphabetical place.
  - In `Functions`, add `save_request_match: { Args: { p_query: Json; p_read: boolean; p_request: string }; Returns: boolean }`.
  - The controller regenerates the file with `pnpm db:types` under the lock and diffs it.
- [ ] **Step 6:** `pnpm typecheck` clean; `pnpm exec vitest run lib/data/requests.test.ts lib/data/store.test.ts data/fixtures` pass. **Don't run** `supabase` or `pnpm test:db`: the controller runs them.

### Task 4: The matcher's data layer (both backends)

**Files:** Create `lib/data/request-match.ts`, `lib/data/request-match.test.ts`, `lib/data/supabase/request-match.ts`, `lib/data/contract/request-match.contract.ts` (+ `.test.ts`, `.db.test.ts`, copying the shape of `lib/data/contract/requests-own.*`). Modify `lib/data/supabase/saved-searches.ts` (add `export` to `listedListing`, nothing else).

- [ ] **Step 1: Failing contract** (`lib/data/contract/request-match.contract.ts`). It uses the World (`tests/contract/world.ts`):
  - `addRequest` posts in Tech at Pretoria.
  - `openShop(name)` opens an approved shop at Pretoria.
  - `addListing(slug, listing)` puts a listing in place.
  - `addOffer(slug, requestId, body)`, `hideRequest(id, reason)` and `cleanup()`.

```ts
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  requestMatchCandidates,
  requestMatchOf,
  requestsWantingListing,
  saveRequestMatch,
  unreadRequests,
} from "@/lib/data/request-match";
import { sastDate } from "@/lib/time";
import type { MatchQuery } from "@/lib/types";
import type { World } from "@/tests/contract/world";

// "Someone's looking for this" (AI stage G, Task 4), the same in both backends: storing a request's search, the
// candidates a first publish is matched against (open, shown, an asker's, at one campus), and requestsWantingListing.
// request-match.test.ts runs it on the sample store, request-match.db.test.ts on the local stack.

const LAMP: MatchQuery = { q: "contract lamp", category: "tech", campus: "pretoria", price: null, pay: null, deals: null };

export function requestMatchContract(makeWorld: () => World): void {
  let world: World;
  let asker: string;
  let seller: string;
  let slug: string;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidyMessaging();
    asker = await world.signedIn("asker");
    seller = await world.signedIn("seller");
    slug = await world.openShop("seller");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const today = () => sastDate(new Date());
  const ask = async (title = "A contract lamp", who: "asker" | "seller" | "shopper" = "asker") => {
    const id = await world.addRequest({ asker: who, title, neededBy: null });
    expect(await saveRequestMatch(id, LAMP, true, new Date())).toBe(true);
    return id;
  };

  it("stores a search and reads it back for its asker only", async () => {
    const id = await ask();
    expect(await requestMatchOf(asker, id)).toMatchObject({ query: LAMP, readAt: expect.any(String) });
    expect(await requestMatchOf(seller, id)).toBeNull();
  });

  it("keeps a read with no search, and clears both", async () => {
    const id = await ask();
    await saveRequestMatch(id, null, true, new Date());
    expect(await requestMatchOf(asker, id)).toMatchObject({ query: null, readAt: expect.any(String) });
    await saveRequestMatch(id, null, false, new Date());
    expect(await requestMatchOf(asker, id)).toEqual({ query: null, readAt: null });
  });

  it("never stores one on a sample request", async () => {
    expect(await saveRequestMatch("r-001", LAMP, true, new Date())).toBe(false);
  });

  it("offers open, shown requests with a search at the campus, and lists the unread", async () => {
    const id = await ask();
    const unread = await world.addRequest({ asker: "shopper", title: "A contract kettle", neededBy: null });
    const hidden = await ask("A contract hidden lamp", "shopper");
    await world.hideRequest(hidden, "Testing");
    const ids = (await requestMatchCandidates("pretoria", today())).map((candidate) => candidate.id);
    expect(ids).toContain(id);
    expect(ids).not.toContain(unread);
    expect(ids).not.toContain(hidden);
    expect(await requestMatchCandidates("midrand", today())).toEqual([]);
    expect((await unreadRequests(today(), 50)).map((row) => row.id)).toContain(unread);
    expect((await unreadRequests(today(), 50)).map((row) => row.id)).not.toContain(id);
  });

  it("counts the students a first publish answers, leaving out the seller's own and ones the shop offered on", async () => {
    await ask("A contract lamp");
    await ask("Another contract lamp");
    await ask("A contract lamp of my own", "seller");
    const offered = await ask("A contract lamp, offered", "shopper");
    await world.addOffer(slug, offered, "I have one.");
    const listingId = await world.addListing(slug, {
      title: "Contract lamp",
      categorySlug: "tech",
      description: "A lamp for the contract tests.",
    });
    const wanted = await requestsWantingListing({ listingId, sellerSlug: slug, ownerId: seller, now: new Date() });
    expect(wanted?.students).toBe(1);
    expect(wanted?.requests).toHaveLength(1);
    // Both lamps are the asker's: one student, one request shown.
    expect(["A contract lamp", "Another contract lamp"]).toContain(wanted?.requests[0].title);
  });

  it("answers null for a listing buyers can't see", async () => {
    await ask();
    const listingId = await world.addListing(slug, { title: "Contract lamp", categorySlug: "tech" });
    await world.hideListing(listingId, "Testing");
    expect(await requestsWantingListing({ listingId, sellerSlug: slug, ownerId: seller, now: new Date() })).toBeNull();
  });
}
```

  Check the World's real verbs and options as you write: `openShop`'s return value is the slug, `addOffer`'s arguments, and whether `"shopper"` is a `WorldAccountName` (it is: `asker`, `shopper`, `staff`, `seller`). `request-match.test.ts` runs `requestMatchContract(sampleWorld)`. `request-match.db.test.ts` runs it on `supabaseWorld` with the `withViewerSeam` mock line `requests-own.db.test.ts` has.
- [ ] **Step 2:** `pnpm exec vitest run lib/data/contract/request-match.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `lib/data/request-match.ts`:

```ts
import { onSupabase } from "@/lib/backend";
import {
  matchRequests,
  wantedFrom,
  type MatchCandidate,
  type StoredMatch,
  type Wanted,
} from "@/lib/looking-for/match";
import { closingDay, requestOpenOn, type RequestFields } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { Listing, MatchQuery } from "@/lib/types";
import { shopStatus, toListing } from "./catalog";
import { findOffer } from "./offers";
import { NAMES } from "./saved-searches";
import { sampleStore } from "./store";

// "Someone's looking for this" (AI round two spec 5; AI stage G plan Task 4): the stored searches of open requests and
// the matching of a first publish against them. Request-time only, never inside "use cache", and no model call here:
// lib/data/request-reading.ts does the reading. Shop coach's answer-request (stage I) uses requestMatchCandidates and
// matchRequests, so the two always agree. Askers are compared, never returned to a page.

const supabase = () => import("./supabase/request-match");

/** Open on `today` (a SAST date), not hidden, an asker's, at this campus, with a stored search. Oldest first. */
export async function requestMatchCandidates(campusSlug: string, today: string): Promise<MatchCandidate[]> {
  if (onSupabase()) return (await supabase()).requestMatchCandidates(campusSlug, today);
  return [...sampleStore().requests.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((row) =>
      row.askerId !== null &&
      row.hiddenAt === null &&
      row.matchQuery !== null &&
      row.campusSlug === campusSlug &&
      requestOpenOn({ status: row.status, closesOn: closingDay(row) }, today)
        ? [{ id: row.id, title: row.title, askerId: row.askerId, query: row.matchQuery, createdAt: row.createdAt }]
        : [],
    );
}

/** The listing as buyers see it now, with its shop's name; null for one they can't (hidden, a draft, a closed shop's). */
async function listedForMatch(listingId: string): Promise<{ listing: Listing; shopName: string } | null> {
  if (onSupabase()) {
    const listed = await (await import("./supabase/saved-searches")).listedListing(listingId);
    return listed ? { listing: listed.listing, shopName: listed.shopName } : null;
  }
  const { listings, sellers } = sampleStore();
  const row = listings.get(listingId);
  const shop = row ? sellers.get(row.sellerSlug) : undefined;
  if (!row || !shop || row.hiddenAt || shopStatus(shop) !== "approved") return null;
  const listing = toListing(row, shop);
  return listing.availability === "available" ? { listing, shopName: shop.name } : null;
}

/**
 * The students a first publish answers (spec 5): the open requests at the listing's campus whose stored search it
 * matches, less the seller's own and ones this shop has offered on (planning decision 7). Null for a listing buyers
 * can't see. No notification: the asker hears only when an offer is made.
 */
export async function requestsWantingListing({
  listingId,
  sellerSlug,
  ownerId,
  now,
}: {
  listingId: string;
  sellerSlug: string;
  ownerId: string;
  now: Date;
}): Promise<Wanted | null> {
  const listed = await listedForMatch(listingId);
  if (!listed) return null;
  const candidates = await requestMatchCandidates(listed.listing.campusSlug, sastDate(now));
  const names = { sellers: new Map([[listed.listing.sellerSlug, listed.shopName]]), categories: NAMES.categories };
  const matches = matchRequests(listed.listing, candidates, names, ownerId);
  const offered = await Promise.all(matches.map((match) => findOffer(match.id, sellerSlug)));
  return wantedFrom(matches.filter((_, index) => offered[index] === null));
}

/**
 * Stores a request's search (`read` true; `query` may be null: read, nothing to match), or clears both (`read` false,
 * `query` null). False for a sample request or one that's gone. On Supabase, save_request_match with the admin client.
 */
export async function saveRequestMatch(id: string, query: MatchQuery | null, read: boolean, now: Date): Promise<boolean> {
  if (onSupabase()) return (await supabase()).saveRequestMatch(id, query, read, now);
  if (!read && query !== null) throw new Error("saveRequestMatch: a search needs a read");
  const row = sampleStore().requests.get(id);
  if (!row || row.askerId === null) return false;
  row.matchQuery = read ? query : null;
  row.matchReadAt = read ? now.toISOString() : null;
  return true;
}

/** The asker's request's stored search and read, or null when it isn't theirs. Never shown: an edit reads it. */
export async function requestMatchOf(askerId: string, id: string): Promise<StoredMatch | null> {
  if (onSupabase()) return (await supabase()).requestMatchOf(askerId, id);
  const row = sampleStore().requests.get(id);
  return row && row.askerId === askerId ? { query: row.matchQuery, readAt: row.matchReadAt } : null;
}

/** Open, shown asker requests never read, oldest first, at most `limit`: the backfill's (planning decision 10). */
export async function unreadRequests(today: string, limit: number): Promise<{ id: string; fields: RequestFields }[]> {
  if (onSupabase()) return (await supabase()).unreadRequests(today, limit);
  return [...sampleStore().requests.values()]
    .filter(
      (row) =>
        row.askerId !== null &&
        row.hiddenAt === null &&
        row.matchReadAt === null &&
        requestOpenOn({ status: row.status, closesOn: closingDay(row) }, today),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit)
    .map(({ id, title, categorySlug, campusSlug, details, budgetZar, swapWelcome, neededBy }) => ({
      id,
      fields: { title, categorySlug, campusSlug, details, budgetZar, swapWelcome, neededBy },
    }));
}
```

  Check that importing `./saved-searches` (for `NAMES`) and `./offers` from here makes no import cycle (`saved-searches` imports `catalog`, `notifications` and `store`; none imports `request-match`).

  `lib/data/supabase/request-match.ts`, which follows `lib/data/supabase/requests.ts`' style:
  - `import "server-only"`.
  - Every read and write goes through `forServer()`: the columns are closed to every API role.
  - `requestMatchCandidates`: `selectAll(() => forServer().from("requests").select("id, title, asker_id, match_query, created_at").eq("campus_slug", campusSlug).eq("status", "open").is("hidden_at", null).not("asker_id", "is", null).not("match_query", "is", null).gt("closes_on", today), ["created_at", "id"])`. Each row goes through `asMatchQuery`, and a row whose search doesn't pass is left out.
  - `saveRequestMatch`: `forServer().rpc("save_request_match", { p_request: id, p_query: query, p_read: read })`. Throw on error (`failed("save_request_match", error)`) and return `data === true`. `now` is unused here: the database's `now()` is the time.
  - `requestMatchOf`: `.from("requests").select("match_query, match_read_at").eq("id", id).eq("asker_id", askerId).maybeSingle()` → `{ query: asMatchQuery(data.match_query), readAt: data.match_read_at === null ? null : iso(data.match_read_at) }`, or null.
  - `unreadRequests`: `.from("requests").select("id, title, category_slug, campus_slug, details, budget_zar, swap_welcome, needed_by").eq("status", "open").is("hidden_at", null).not("asker_id", "is", null).is("match_read_at", null).gt("closes_on", today).order("created_at").order("id").limit(limit)`, mapped to `RequestFields`.
  - Type each export as `typeof Sample.x`, as the twins do.
- [ ] **Step 4:** `pnpm exec vitest run lib/data/contract/request-match.test.ts lib/data/request-match.test.ts` pass (the `.test.ts` is the sample contract plus anything sample-only, such as `saveRequestMatch` throwing on a query with `read` false). `pnpm typecheck` clean. **Don't run** `pnpm test:db`: the controller runs `request-match.db.test.ts` under the lock.

### Task 5: Reading a request when it's posted or edited

**Files:** Create `lib/data/request-reading.ts`, `lib/data/request-reading.test.ts`. Modify `lib/looking-for/actions.ts`, `lib/looking-for/actions.test.ts`, and `lib/looking-for/actions-supabase.test.ts` (only to mock the new module, if it mocks the data layer module by module).

- [ ] **Step 1: Failing tests** (`lib/data/request-reading.test.ts`; frame copied from `lib/data/words-search.test.ts`: the hoisted `request`, `vi.mock("next/cache", …nextCache(request))`, the watched `./ai` mock, `resetSampleStore()` and `vi.stubEnv` in `beforeEach`, `vi.unstubAllEnvs()` in `afterEach`):

```ts
const FIELDS: RequestFields = {
  title: "Zorbitron desk lamp",
  categorySlug: "res-living",
  campusSlug: "midrand",
  details: "Zorbitron lamp that clips onto my desk.",
  budgetZar: null,
  swapWelcome: false,
  neededBy: null,
};
const NOW = new Date("2026-11-04T10:00:00.000Z");

/** A request of acc-student's in the store, as createRequest leaves it. */
async function posted(fields = FIELDS) {
  return (await createRequest({ askerId: "acc-student", fields, now: NOW })).id;
}
const stored = (id: string) => sampleStore().requests.get(id)!;

beforeEach(() => {
  resetRequest(request);
  resetSampleStore();
  vi.stubEnv("VOSSIE_BACKEND", "");
  vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "1");
  vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  read.mockClear();
});

it("reads a new request into a search: the fake's q, the request's category and campus", async () => {
  const id = await posted();
  await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
  expect(stored(id).matchQuery).toMatchObject({ category: "res-living", campus: "midrand", price: null, pay: null, deals: null });
  expect(stored(id).matchQuery?.q).toContain("zorbitron");
  expect(stored(id).matchReadAt).toBe(NOW.toISOString());
  expect(read).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0][0]).toBe("zorbitron desk lamp. zorbitron lamp that clips onto my desk.");
});

it("stores a read with no search when the model can't answer, and never throws", async () => {
  read.mockResolvedValueOnce(null);
  const id = await posted();
  await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
  expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: NOW.toISOString() });
});

it("stores a read with no search when the day's parses are used up", async () => {
  sampleStore().wordsSearchParses.set(sastDate(NOW), WORDS_SEARCH_DAILY_CAP);
  const id = await posted();
  await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
  expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: NOW.toISOString() });
  expect(read).not.toHaveBeenCalled();
});

it("reads nothing while the switch is off", async () => {
  vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "");
  const id = await posted();
  await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
  expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: null });
  expect(read).not.toHaveBeenCalled();
});

it("moves the search on an edit of the campus alone, without reading", async () => {
  const id = await posted();
  await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
  read.mockClear();
  const after = { ...FIELDS, campusSlug: "pretoria" };
  await readRequestMatch({ id, askerId: "acc-student", before: FIELDS, after, now: NOW });
  expect(stored(id).matchQuery?.campus).toBe("pretoria");
  expect(read).not.toHaveBeenCalled();
});

it("clears the search when an edit changes the words while off", async () => {
  const id = await posted();
  await readRequestMatch({ id, askerId: "acc-student", before: null, after: FIELDS, now: NOW });
  vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "");
  await readRequestMatch({ id, askerId: "acc-student", before: FIELDS, after: { ...FIELDS, title: "Zorbitron floor lamp" }, now: NOW });
  expect(stored(id)).toMatchObject({ matchQuery: null, matchReadAt: null });
});

describe("the backfill (planning decision 10)", () => {
  it("reads unread open requests, oldest first, and says whether more are left", async () => {
    for (let n = 0; n < BACKFILL_BATCH + 1; n += 1) await posted({ ...FIELDS, title: `Zorbitron lamp ${n}` });
    const first = await backfillRequestMatches(NOW);
    expect(first).toEqual({ matched: BACKFILL_BATCH, unmatched: 0, more: true, capped: false });
    expect(await backfillRequestMatches(NOW)).toEqual({ matched: 1, unmatched: 0, more: false, capped: false });
  });
  it("stops at a full cap and marks nothing it didn't read", async () => {
    const id = await posted();
    sampleStore().wordsSearchParses.set(sastDate(NOW), WORDS_SEARCH_DAILY_CAP);
    expect(await backfillRequestMatches(NOW)).toEqual({ matched: 0, unmatched: 0, more: true, capped: true });
    expect(stored(id).matchReadAt).toBeNull();
  });
  it("leaves the samples alone", async () => {
    await backfillRequestMatches(NOW);
    expect(stored("r-001")).toMatchObject({ matchQuery: null, matchReadAt: null });
  });
});
```

  The fake parse (`fakeWords`) keeps almost every word as `q`, so each test text's words all show up in the expected `q`. The `NOW` must fall before the samples' and the posted requests' closing days: posted requests close 30 days after `updatedAt`, so `NOW` is fine. Use `vi.setSystemTime` only if the readers' `today` needs it.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `lib/data/request-reading.ts`:

```ts
import { aiFeatureOn } from "@/lib/ai/config";
import { looksLikeSentence, WORDS_SEARCH_DAILY_CAP } from "@/lib/browse/words";
import { matchStep, requestMatchQuery, requestWords, withPlace } from "@/lib/looking-for/match";
import type { RequestFields } from "@/lib/looking-for/rules";
import { sastDate } from "@/lib/time";
import type { MatchQuery } from "@/lib/types";
import { readSearchWords } from "./ai";
import { getCampuses, getCategories } from "./index";
import { requestMatchOf, saveRequestMatch, unreadRequests } from "./request-match";
import { parseSearchWords, reserveWordsSearch } from "./words-search";

// Reading a Looking For request into its stored search ("Someone's looking for this", AI round two spec 5; AI stage G
// plan Task 5): once when it's posted, again when an edit changes its words, and by the backfill. Request-time only:
// saveMyRequest calls readRequestMatch after the save and before requestsChanged(); nothing here runs inside
// "use cache" (parseSearchWords is the words search's cached parse, whose cap reservation is its own). Only the words
// go to the model: no account, campus cookie or budget.

/** The search a request's words read as, or null: not a sentence, a full cap, a failed call, or no item words. */
async function queryFor(fields: RequestFields): Promise<MatchQuery | null> {
  const words = requestWords(fields);
  if (!looksLikeSentence(words, await getCampuses())) return null;
  try {
    return requestMatchQuery(await parseSearchWords(words), fields);
  } catch {
    // parseSearchWords throws on a full cap or any failure, so nothing bad is cached: this request just isn't matched.
    return null;
  }
}

/**
 * After a request is posted (`before` null) or edited: reads, moves, clears or leaves its stored search (planning
 * decisions 4 and 5). Never throws, so a request is always posted; only the kind of failure is logged.
 */
export async function readRequestMatch({
  id,
  askerId,
  before,
  after,
  now,
}: {
  id: string;
  askerId: string;
  before: RequestFields | null;
  after: RequestFields;
  now: Date;
}): Promise<void> {
  try {
    const on = aiFeatureOn("looking-match");
    if (before === null && !on) return;
    const stored = before === null ? null : await requestMatchOf(askerId, id);
    const step = matchStep(before, after, stored, on);
    if (step === "nothing") return;
    if (step === "clear") await saveRequestMatch(id, null, false, now);
    else if (step === "move" && stored?.query) await saveRequestMatch(id, withPlace(stored.query, after), true, now);
    else if (step === "read") await saveRequestMatch(id, await queryFor(after), true, now);
  } catch {
    console.warn("[vossie] looking-match: store error");
  }
}

/** Requests the backfill reads per call (Haiku's 3-second wait each, well inside a function's time). */
export const BACKFILL_BATCH = 15;

export type Backfill = { matched: number; unmatched: number; more: boolean; capped: boolean };

/**
 * The one-off backfill (spec 5, planning decision 10): open requests never read, oldest first, BACKFILL_BATCH a call.
 * It reserves and reads directly, not through the cached parse, so a full cap stops it without marking anything.
 */
export async function backfillRequestMatches(now: Date): Promise<Backfill> {
  const due = await unreadRequests(sastDate(now), BACKFILL_BATCH + 1);
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  let matched = 0;
  let unmatched = 0;
  for (const { id, fields } of due.slice(0, BACKFILL_BATCH)) {
    const words = requestWords(fields);
    let query: MatchQuery | null = null;
    if (looksLikeSentence(words, campuses)) {
      if (!(await reserveWordsSearch(now, WORDS_SEARCH_DAILY_CAP))) return { matched, unmatched, more: true, capped: true };
      const parsed = await readSearchWords(words, categories, campuses);
      query = parsed ? requestMatchQuery(parsed, fields) : null;
    }
    await saveRequestMatch(id, query, true, now);
    if (query) matched += 1;
    else unmatched += 1;
  }
  return { matched, unmatched, more: due.length > BACKFILL_BATCH, capped: false };
}
```

- [ ] **Step 4: The action.** In `saveMyRequest` (`lib/looking-for/actions.ts`), keep the edited request's fields when the action reads `own`:
  - Next to `let keptNeededBy`, add `let before: RequestFields | null = null;`.
  - Inside `if (editing) { … }`, after `keptNeededBy = own.request.neededBy;`, add

```ts
    const { title, categorySlug, campusSlug, details, budgetZar, swapWelcome, neededBy } = own.request;
    before = { title, categorySlug, campusSlug, details, budgetZar, swapWelcome, neededBy };
```

  Then add, right after `if (!saved) redirect(YOUR_REQUESTS_PATH);`:

```ts
  // "Someone's looking for this" (AI round two spec 5): the request's words read into its stored search, after the
  // save and before requestsChanged(). It never throws, and no cached reader reads the search, so it has no tag.
  await readRequestMatch({ id: saved.id, askerId: account.id, before, after: fields, now });
```

  Import `readRequestMatch` from `@/lib/data/request-reading` and `type RequestFields` from `./rules`. Add one sentence to `saveMyRequest`'s doc comment: "With the looking match on, the request's words are read into the search a first publish is matched against (AI stage G)."
- [ ] **Step 5: Action tests** (`lib/looking-for/actions.test.ts`, beside the posting tests, using that file's own helpers for a signed-in post and an edit):
  - With `VOSSIE_AI_LOOKING_MATCH=1` and `VOSSIE_AI_PROVIDERS=fake`, a posted request's store row has a `matchQuery` whose campus is the posted campus, and `matchReadAt` set.
  - With the switch off, it has neither.
  - An edit that changes only the budget leaves `matchReadAt` as it was.
  - A refused post (a field error) stores nothing.

  If `actions-supabase.test.ts` mocks data modules one by one, add `vi.mock("@/lib/data/request-reading", () => ({ readRequestMatch: vi.fn(async () => {}) }));` there, so that test doesn't reach a database.
- [ ] **Step 6:** `pnpm exec vitest run lib/data/request-reading.test.ts lib/looking-for` pass; `pnpm typecheck` and `pnpm lint` clean.

### Task 6: The backfill's Route Handler

**Files:** Create `app/api/cron/request-matches/route.ts`, `app/api/cron/request-matches/route.test.ts`.

- [ ] **Step 1: Failing test**, which copies `app/api/cron/badges/route.test.ts`' frame (the `next/server` and `next/cache` mocks, `SECRET = "c".repeat(64)`, a `call(authorization?)` helper, and the proxy check that a call without a session cookie never reaches `proxy.ts`). Mock `@/lib/data/request-reading`'s `backfillRequestMatches` with `vi.fn(async () => ({ matched: 2, unmatched: 1, more: false, capped: false }))`. Cases:
  - Sample mode (`VOSSIE_BACKEND` unset): 404, `no-store`, and the backfill isn't called.
  - On Supabase (`VOSSIE_BACKEND=supabase`) with the switch off: 404, not called. ("Off: no reading." `aiFeatureOn` needs a provider: stub `VOSSIE_AI_PROVIDERS=anthropic` and `ANTHROPIC_API_KEY=k`. The fake is never used on Supabase.)
  - On Supabase with the switch on, with a missing, wrong or short secret: 401, not called.
  - With the right secret: 200, `no-store`, the JSON `{ matched: 2, unmatched: 1, more: false, capped: false }`, and the backfill called once with a `Date`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement:**

```ts
import { connection } from "next/server";
import { aiFeatureOn } from "@/lib/ai/config";
import { onSupabase } from "@/lib/backend";
import { cronAllowed } from "@/lib/cron";
import { backfillRequestMatches } from "@/lib/data/request-reading";

/**
 * The one-off backfill of "Someone's looking for this" (AI round two spec 5; AI stage G planning decision 10): open
 * Looking For requests made before stage G, read into their stored search, 15 a call, oldest first. Called by hand,
 * never by Vercel Cron (it isn't in vercel.json), with "Authorization: Bearer <CRON_SECRET>", until `more` is false.
 * It writes only the stored search, which no cached page reads, so it expires no tag.
 *
 * - Sample mode, or the switch off: a 404, and nothing is read.
 * - A call without exactly the secret, or while CRON_SECRET is unset or shorter than 32 characters: a 401.
 *
 * proxy.ts never sees the call: it has no session cookie.
 */
export async function GET(request: Request): Promise<Response> {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  if (!onSupabase() || !aiFeatureOn("looking-match")) return new Response("Not found", { status: 404, headers });
  if (!cronAllowed(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  return Response.json(await backfillRequestMatches(new Date()), { headers });
}
```

- [ ] **Step 4:** the test passes. Confirm `proxy.ts`' matcher test (if one lists every Route Handler) still passes: `pnpm exec vitest run app/api proxy`.

### Task 7: Matching on a first publish

**Files:** Modify `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`.

- [ ] **Step 1: Failing tests** in a new `describe("someone's looking for this (AI round two spec 5, stage G)")` block, after the saved-search alerts block. It reuses that block's helpers: `signedInAs`, `fanForm`, `fan`, `redirectOf`, `NOW` and `readFormState(MY_LISTINGS_FORM)`. The sample seller `acc-seller` owns Tech corner at Midrand.

```ts
describe("someone's looking for this (AI round two spec 5, stage G)", () => {
  const FAN_QUERY: MatchQuery = { q: "fan", category: "tech", campus: "midrand", price: null, pay: null, deals: null };
  /** An open request of `askerId`'s in the store, with a stored search. */
  async function wantedBy(askerId: string, query: MatchQuery = FAN_QUERY) {
    const { id } = await createRequest({
      askerId,
      fields: {
        title: "A desk fan for res",
        categorySlug: query.category ?? "tech",
        campusSlug: query.campus,
        details: "A small desk fan for my room, please.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: NOW,
    });
    await saveRequestMatch(id, query, true, NOW);
    return id;
  }

  beforeEach(() => {
    vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "1");
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
  });

  it("adds the students looking, and up to three of their requests, to the Published notice", async () => {
    const id = await wantedBy("acc-student");
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect(await readFormState(MY_LISTINGS_FORM)).toMatchObject({
      notice: "published",
      values: { wanted: "1", wantedIds: id },
    });
  });

  it("leaves out the seller's own request and says nothing without a match", async () => {
    await wantedBy("acc-seller");
    await wantedBy("acc-student", { ...FAN_QUERY, q: "kettle" });
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    const state = await readFormState(MY_LISTINGS_FORM);
    expect(state?.values.wanted).toBeUndefined();
  });

  it("says nothing on an edit, on a draft, or with the switch off", async () => {
    await wantedBy("acc-student");
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm({ intent: "draft" })));
    expect((await readFormState(MY_LISTINGS_FORM))?.values.wanted).toBeUndefined();
    vi.stubEnv("VOSSIE_AI_LOOKING_MATCH", "");
    const row = (await fan())!;
    await redirectOf(async () => saveListingForm(await fanForm({ listing: row.id })));
    expect((await readFormState(MY_LISTINGS_FORM))?.values.wanted).toBeUndefined();
  });

  it("publishes anyway when matching fails", async () => {
    await wantedBy("acc-student");
    const spy = vi.spyOn(requestMatch, "requestsWantingListing").mockRejectedValueOnce(new Error("db down"));
    await signedInAs("acc-seller");
    await redirectOf(async () => saveListingForm(await fanForm()));
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBe("published");
    spy.mockRestore();
  });
});
```

  (`import * as requestMatch from "@/lib/data/request-match"` for the spy. If ES module spying doesn't take, mock the module in that one test file with `vi.mock(…, async (original) => ({ ...(await original()), requestsWantingListing: vi.fn((await original()).requestsWantingListing) }))`, as `words-search.test.ts` watches `./ai`. Check `fanForm`'s category is `tech` and its title holds "fan".)
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** In `saveListingForm`, before the first-publish block, add `let wanted: Wanted | null = null;`. Inside the block, after `await notifySavedSearches({ listingId: saved.id, now });`, add:

```ts
    // …and the open Looking For requests at its campus whose stored search it matches (AI round two spec 5), under the
    // same condition, with no model call. The asker hears nothing: only an offer tells them. A failure publishes anyway.
    if (aiFeatureOn("looking-match")) {
      wanted = await requestsWantingListing({
        listingId: saved.id,
        sellerSlug: owner.shop.slug,
        ownerId: owner.account.id,
        now,
      }).catch(() => {
        console.warn("[vossie] looking-match: match error");
        return null;
      });
    }
```

  Then change the My listings write to

```ts
  await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: saved.id, ...wantedValues(wanted) }, notice }, now);
```

  Leave `leaveListingToken` as it is: a repeated send lands with "Published." alone. Import `requestsWantingListing` from `@/lib/data/request-match`, `wantedValues` from `./wanted` and `type Wanted` from `@/lib/looking-for/match`. Extend the first-publish block's comment by one clause naming the looking match.
- [ ] **Step 4:** `pnpm exec vitest run lib/selling/listing-actions.test.ts` passes, the earlier `toMatchObject` checks of `values: { listing }` included.

### Task 8: The line on My listings

**Files:** Modify `components/sell/MyListings.tsx`, `components/sell/MyListingsView.tsx`, `components/sell/MyListings.test.tsx`, `components/sell/MyListingsView.test.tsx`, and the CSS file that holds `.form-notice` (`grep -rn "\.form-notice" app components --include=*.css`).

- [ ] **Step 1: Failing tests.**
  - `MyListingsView.test.tsx`: with `notice="Published. Buyers can find it now."` and `wanted={{ students: 2, requests: [{ id: "r-a", title: "A desk fan" }, { id: "r-b", title: "A fan for res" }] }}`:
    - the `role="status"` paragraph's text is the notice alone (unchanged);
    - after it, a block has the text "2 students are looking for something like this.";
    - there's a list of two items, each with a link named "A desk fan" to `/looking-for/r-a` and a link named "Make an offer on A desk fan" to `/looking-for/r-a/offer`;
    - every link has no prefetch (assert as the file's existing "See it as buyers do" test does, if it does).
    - With `wanted={null}`, or with no notice, no such block.
  - `MyListings.test.tsx` (following how it fakes `takeNotice` and the readers):
    - a notice state with `values: { listing, wanted: "2", wantedIds: "r-open r-closed r-gone" }` passes `wanted` with only the open request (`getRequest` mocked: `r-open` open, `r-closed` with `status: "closed"`, `r-gone` null), and `students: 2`;
    - if all of them are closed or gone, `wanted` is null.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** In `MyListings.tsx`, after the `Promise.all`:

```ts
  // "Someone's looking for this" (AI stage G planning decision 8): the requests the publish matched, read now through
  // the cached public reader, so a request closed or hidden since is left out and the titles are current. Request-time:
  // the clock is read after the session and the notice.
  const asked = readWanted(state?.values);
  let wanted: Wanted | null = null;
  if (asked) {
    const today = sastDate(new Date());
    const open = (await Promise.all(asked.ids.map((id) => getRequest(id)))).filter(
      (request): request is LookingForRequest => request !== null && requestOpenOn(request, today),
    );
    if (open.length > 0) wanted = { students: asked.students, requests: open.map(({ id, title }) => ({ id, title })) };
  }
```

  Pass `wanted={wanted}` to `MyListingsView`. In `MyListingsView`, add the prop `/** Students looking for something like a just-published listing (AI stage G). */ wanted?: Wanted | null;` and render it right after the `role="status"` paragraph, inside the same `{notice && …}` fragment:

```tsx
      {notice && wanted && (
        <div className="form-notice wanted-notice">
          <p>{wantedLine(wanted.students)}</p>
          <ul>
            {wanted.requests.map((request) => (
              <li key={request.id}>
                <Link href={requestPath(request.id)} prefetch={false}>
                  {request.title}
                </Link>{" "}
                <Link href={offerPath(request.id)} prefetch={false}>
                  Make an offer<span className="sr-only"> on {request.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
```

  Wrap the existing notice paragraph and this block in one fragment, so the order is notice, then the line. The links are untyped plain links, as "See it as buyers do" is (planning decision 9), so they need no `<NavPending />`. Update the view's doc comment by one sentence.

  CSS, beside `.form-notice`. Use tokens only: the project's real token names for links on white (the ones "See it as buyers do" or other notice links use). It must work in Light, Dark and Night, and its touch targets must be 44px:

```css
.wanted-notice ul {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
}
.wanted-notice li {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1rem;
}
.wanted-notice a {
  display: inline-block;
  min-block-size: 44px;
  padding-block: 0.625rem;
}
```

  If `lib/theme-contrast.test.ts` lists pairs by element, add none: the links reuse the notice's existing link colour.
- [ ] **Step 4:** `pnpm exec vitest run components/sell` passes; `pnpm lint` clean.

### Task 9: The data download and the privacy line

**Files:** Modify `lib/data/requests.ts` (`RequestExport`, `requestExport`), `lib/data/supabase/requests.ts` (`exportRequests`), their tests (`lib/data/requests.test.ts`, `lib/data/contract/requests-own.contract.ts`'s download case, `lib/data/contract/c4-download.db.test.ts` if it pins the shape), `app/privacy/page.tsx`, `app/privacy/page.test.tsx`.

- [ ] **Step 1: Failing tests.**
  - The download contract: a request with a stored search `{ q: "contract lamp", category: "tech", campus: "pretoria", … }` exports `matchedAs: "“contract lamp” in Tech at Pretoria"` (whatever `savedSearchLabel` gives: assert with the function), and one with none exports `matchedAs: null`.
  - Privacy (beside the words search's block, same frame), with `VOSSIE_AI_LOOKING_MATCH=1`, `anthropic,groq` and both keys, the line contains:
    - "its title and details are sent to Anthropic (never Groq)";
    - "read outside South Africa";
    - "never who asked";
    - "in your data download".
  - It's absent with the switch off, without Anthropic's key, or with only the fake.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.**
  - **`RequestExport`:** gains

```ts
  /**
   * The search its words were read into, as a label ("“calculator” in Tech at Midrand"), or null (AI stage G planning
   * decision 12): derived from the student's own words, so it's theirs to see.
   */
  matchedAs: string | null;
```

  - **`requestExport`:** its parameter type becomes `Omit<RequestRow, "id" | "askerId" | "updatedAt" | "remindedFor" | "seedOffers" | "matchReadAt">`, and it returns `matchedAs: row.matchQuery ? savedSearchLabel(row.matchQuery, NAMES) : null` (`savedSearchLabel` from `@/lib/saved-searches/rules`, `NAMES` from `./saved-searches`; check for an import cycle).
  - **Supabase `exportRequests`:** before mapping, read the asker's searches with the admin client (`forServer().from("requests").select("id, match_query").eq("asker_id", accountId)`). Build a `Map` of id to `asMatchQuery(match_query)`, and pass `matchQuery: searches.get(row.id) ?? null` into `requestExport`. The column is closed to the asker's own session, so `my_requests` doesn't change.
  - **Privacy:** a `lookingMatchLine()` beside `wordsSearchLine()`, with the same condition shape (`featureProviders("looking-match").includes("anthropic") && aiFeatureOn("looking-match")`), rendered after the words search's line:

```tsx
    <li>
      When you post a Looking For request, or change its words, its title and details are sent to Anthropic (never Groq),
      an AI provider in the United States, which deletes them within 30 days and doesn&apos;t use them to train its models,
      to read what you&apos;re looking for. So what&apos;s sent is read outside South Africa. Only those words go: not your
      account, your name or your budget. What it reads is kept with your request, so that when a shop at your campus lists
      something like it, the shop sees your request (never who asked) and can make an offer. It goes when your request
      does, and it&apos;s in your data download.
    </li>
```

- [ ] **Step 4:** `pnpm exec vitest run lib/data/requests.test.ts lib/data/contract/requests-own.test.ts app/privacy` pass.

### Task 10 (controller, with Lama's key): the real-key hand test

**Files:** Create `scripts/looking-match.hand.ts` (picked up by `vitest.hand.config.mts`, never by `pnpm test`).

The words search's schema bug was caught only by real Haiku, and the requests' words are longer than any search, so this runs before the switch goes on.

- [ ] **Step 1: Write the hand test:**

```ts
// scripts/looking-match.hand.ts
// "Someone's looking for this" with the real key (AI round two spec 8; AI stage G plan Task 10), run by hand, never in CI:
//   VOSSIE_LOOKING_TEST=~/campuscart-looking-test pnpm vitest run --config vitest.hand.config.mts scripts/looking-match.hand.ts
// Each of the 16 sample requests is read by Haiku exactly as a posted request would be (requestWords, the words
// search's request and check), and its stored search is matched against the sample listings at its campus. The results
// go to results.md in that folder. Keys come from .env.local; it costs well under a cent.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { listings } from "@/data/fixtures/listings";
import { requests } from "@/data/fixtures/requests";
import { sellers } from "@/data/fixtures/sellers";
import { listingMatches } from "@/lib/browse/results";
import { checkWords } from "@/lib/browse/words";
import { wordsRequest } from "@/lib/data/ai";
import { read as readHaiku } from "@/lib/data/ai/anthropic";
import { requestMatchQuery, requestWords } from "@/lib/looking-for/match";

describe("the looking match with real Haiku (by hand)", () => {
  it("reads every sample request, checks the reply and matches it", { timeout: 10 * 60_000 }, async () => {
    process.loadEnvFile(".env.local");
    const dir = process.env.VOSSIE_LOOKING_TEST;
    if (!dir) throw new Error("Set VOSSIE_LOOKING_TEST to a folder for results.md");
    mkdirSync(dir, { recursive: true });
    const names = {
      sellers: new Map(sellers.map((seller) => [seller.slug, seller.name])),
      categories: new Map(categories.map((category) => [category.slug, category.name])),
    };
    const slugs = { categories: categories.map((c) => c.slug), campuses: campuses.map((c) => c.slug) };
    const rows: string[] = ["| Request | Words sent | q | ms | Matches at its campus |", "|---|---|---|---|---|"];
    let bad = 0;
    for (const request of requests) {
      const words = requestWords(request);
      const started = Date.now();
      const reply = await readHaiku(wordsRequest(words, categories, campuses));
      const ms = Date.now() - started;
      const parsed = reply.ok ? checkWords(reply.text, slugs) : null;
      if (!parsed) bad += 1;
      const query = parsed ? requestMatchQuery(parsed, request) : null;
      const found = query ? listings.filter((listing) => listingMatches(listing, query, names) !== null) : [];
      rows.push(
        `| ${request.title} | ${words.length} chars | ${query?.q ?? (reply.ok ? "(no item words)" : reply.failure)} | ${ms} | ${found.map((l) => l.title).join("; ") || "none"} |`,
      );
    }
    writeFileSync(join(dir, "results.md"), `${rows.join("\n")}\n`);
    // Every reply must pass the schema check: one that doesn't is the stage E kind of bug.
    expect(bad).toBe(0);
  });
});
```

  Check that the sample request fixtures carry `title`, `details`, `categorySlug` and `campusSlug` (they're `LookingForRequest`s, so `requestWords(request)` and `requestMatchQuery(parsed, request)` type-check), and that `ReadPhoto`'s failure field is named `failure`.
- [ ] **Step 2: Run it** with Lama's workspace key in `.env.local` (an organisation key fails, per the stage A to E test).
  - Every reply passes `checkWords`.
  - For each request, record the `q`, and whether it matches the sample listing a student would want (the Casio request should find the Casio calculator, for example).
  - Count how many of the 16 find none because `q` is too specific (planning decision 14).
- [ ] **Step 3: Report** the table's summary to Lama in the spec's section 10 ("While building stage G"). If more than a few useful matches are missed only for an extra word in `q`, raise a follow-up: an instruction line for requests, or a fallback. Don't build either in this stage.

### Task 11: The end-to-end test

**Files:** Modify `playwright.config.ts`, `tests/e2e/community-writes.spec.ts`.

- [ ] **Step 1:** In `playwright.config.ts`'s `webServer.env`, add your own line after `VOSSIE_AI_PHOTO_SEARCH: "1",`: `VOSSIE_AI_LOOKING_MATCH: "1",`, with a one-line comment: "Someone's looking for this is on too, read by the fake, which keeps a request's words as its q (AI stage G)".
- [ ] **Step 2: Check no other test is disturbed.** With the switch on, every request any e2e test posts is read by the fake, and every first publish is matched.
  - The fake's `q` keeps each request's unique word (`uniqueWord()` in the title), so only a listing holding that word can match.
  - Confirm no other write test's published listing contains another test's request words: `grep -rn "postRequest\|fillRequest" tests/e2e`, then compare with `grep -rn "publishListing\|fillListing" tests/e2e`. Report any overlap.
  - The line sits outside the status paragraph, so `toHaveText` checks of "Published. Buyers can find it now." are untouched.
- [ ] **Step 3: Write the test** in `community-writes.spec.ts`, after the offer test. Import `seriousIssues` from `./helpers/axe` and `REQUEST_DETAILS` from `./helpers/community`.

```ts
  test("a shop publishes something a student asked for: the Published notice says so and links to the request (AI stage G)", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    const title = `Zorbitron lamp ${uniqueWord()}`;
    const id = await postRequest(page, title);

    // The fake keeps almost every word of the request as its q, so the listing says them all: the request's own words.
    const shop = await sellerPage(browser, baseURL!);
    await shop.goto("/sell/listings/new");
    await fillListing(shop, title);
    await field(shop, "Description").fill(`${title}. ${REQUEST_DETAILS}`);
    await button(shop, "Save and publish").click();
    await expect(shop).toHaveURL(/\/sell\/listings$/, POST_LANDS);
    await expect(statusLine(shop)).toHaveText("Published. Buyers can find it now.", POST_LANDS);
    // The line arrives with the notice, in the same render (planning decision 13).
    const wanted = main(shop).locator(".wanted-notice");
    await expect(wanted).toContainText("1 student is looking for something like this.");
    await expect(wanted.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/looking-for/${id}`);
    const offer = wanted.getByRole("link", { name: `Make an offer on ${title}` });
    await expect(offer).toHaveAttribute("href", `/looking-for/${id}/offer`);
    await expect(shop).toHaveTitle(/\S/);
    expect(await seriousIssues(shop)).toEqual([]);
    await offer.click();
    await expect(shop).toHaveURL(new RegExp(`/looking-for/${id}/offer$`));
    await expect(field(shop, "Your offer")).toBeVisible();
    await shop.context().close();

    // The asker hears nothing until an offer is made (spec 5).
    await page.goto("/notifications");
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    expect(await main(page).getByRole("link", { name: new RegExp(title) }).count()).toBe(0);
  });
```

  Check the real names as you write:
  - `statusLine` in `helpers/community.ts` reads the `role="status"` line; if it's scoped to the request panel, use `main(shop).getByRole("status")`.
  - `fillListing` lives in `helpers/selling.ts` and fills "Res & living", the request's category.
  - Tech corner is at Midrand, `postRequest`'s default campus.
  - The listing check's fake stops only titles with "fake" in them.
- [ ] **Step 4:** `pnpm lint` and `pnpm typecheck`. **Don't run Playwright**: the controller runs it under `e2e-3200.lock`.

### Task 12: Docs

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-11-04-ai-round-two-design.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`.

- [ ] **Step 1: CLAUDE.md.** Add one Code rules bullet, after the words search's:

  "- "Someone's looking for this" (AI stage G, round two spec 5):
    - **The read:** a request's title and details are read once, on posting or an edit that changes the words, into a stored search: `match_query`, a `MatchQuery` whose q is the model's and whose category and campus are the request's own, with no price, pay or deals. `readRequestMatch` (`lib/data/request-reading.ts`) does it, called from `saveMyRequest` after the save and before `requestsChanged()`. It goes through `parseSearchWords` (cached by the words, counted against the words search's daily cap), never inside `"use cache"`, and never throws.
    - **A request that can't be read** has `match_read_at` set and no search, and is never matched; sample requests never are.
    - **The matcher:** `matchRequests` (`lib/looking-for/match.ts`, over browse's `listingMatches`) with `requestMatchCandidates` and `requestsWantingListing` (`lib/data/request-match.ts`, no model call). Shop coach's `answer-request` uses them.
    - **On a first publish:** `saveListingForm` runs it after `notifySavedSearches`, under the same condition. It leaves out the seller's own requests and ones the shop has offered on, counts students (distinct askers), and keeps the count and up to three ids in My listings' notice (`wantedValues`, `lib/selling/wanted.ts`). `MyListings` reads their titles through `getRequest` and drops closed ones.
    - **Supabase:** only the service role reads `match_query` and writes it (`public.save_request_match`, which never moves `updated_at`).
    - **The backfill** is `/api/cron/request-matches`: by hand, behind `CRON_SECRET`, not in `vercel.json`.
    - **The switch:** off behind `VOSSIE_AI_LOOKING_MATCH` (no reading and no line; an edit that changes the words clears the stored search). The e2e server has it on with the fake."

  Add one Privacy bullet: "A request's stored search (`match_query`) is the asker's: never shown to anyone, in their data download as a label (`matchedAs`), and gone with the request or the account."
- [ ] **Step 2: The spec.**
  - Status line: append "Stage G planned (2026-11-04, `docs/superpowers/plans/2026-11-04-ai-stage-g-looking-match.md`)", then "built" when done. Append only: F and H edit the same line.
  - Add a section "## 10. Planning and building notes", with "### While planning stage G" (planning decisions 1 to 15, one line each) and "### While building stage G" (the hand test's summary and anything that changed).
- [ ] **Step 3: GO-LIVE.** Add a block "### Someone's looking for this (AI stage G, after the submission)" before section 7:
  - Built (date, plan) and off. Haiku only, with photo-to-listing's Anthropic key. Each post or worded edit takes one of the words search's 2,000 daily parses on a cache miss.
  - [ ] Push `20261106120000_looking_match.sql` to Vossie Market: a dry run first, then Lama's go-ahead.
  - [ ] The hand test (plan Task 10) passed with the workspace key, and its summary is in the spec's section 10.
  - [ ] Set `VOSSIE_AI_LOOKING_MATCH=1` in Vercel, then redeploy: the privacy page's line is drawn at build.
  - [ ] Run the backfill once: `curl -H "Authorization: Bearer $CRON_SECRET" https://vossie-pi.vercel.app/api/cron/request-matches` until it answers `"more":false`. `"capped":true` means the day's parses are used up: carry on after SAST midnight.
  - [ ] Check it on vossie-pi: a student posts a request; another account's shop at that campus publishes a matching listing and sees the line; "Make an offer" opens the composer; the asker has no notification until the offer.
  - [ ] After two weeks, read the `[vossie] looking-match:` and `words-search:` log lines.
- [ ] **Step 4: PROGRESS.md.** Add an entry at the top: what was built, the checks with their counts, and what isn't done (not committed by the implementer; migration not pushed; off until GO-LIVE; the hand test's result or "waiting for Lama's key").

### Task 13 (controller): the full checks

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`: all clean. Record the counts.
- [ ] Under `supabase.lock`, in this order:
  - `supabase db reset` (the local stack only, never the remote);
  - `supabase test db` (66_looking_match included);
  - `pnpm test:db` (`request-match.db.test.ts` and the download contract included);
  - `pnpm db:types`, then diff it against Task 3's hand edit.

  Release the lock.
- [ ] Under `e2e-3200.lock`:
  - `pnpm build`.
  - `grep -lE "groq|anthropic" .next/static/chunks/*.js` prints nothing, and `grep -l "serviceWorker.register" .next/static/chunks/*.js` prints nothing.
  - Record `/sell/listings`' first-visit JS against the last recorded figure: unchanged, since no client code was added.
  - `pnpm e2e` for the `community-writes` project (the new test, axe included), and `selling-writes`, to confirm the Published notice checks still pass.
  - Release the lock, and stop only your own server, by PID.
- [ ] Hand the work to the controller's commit step (implementers never commit). Note in PROGRESS that the migration isn't pushed.

---

## Self-review against the spec (section 5, section 8, section 2.1's `answer-request`)

| Spec | Where |
|---|---|
| Read title and details into a `SearchQuery` through `parseSearchWords`, cached by the words | Tasks 2 and 5: `requestWords`, `readRequestMatch` → `parseSearchWords` (decisions 1 and 2: a `MatchQuery`, the `SearchQuery` without its order) |
| Stored as `match_query` on the request | Task 3: sample row and migration |
| Can't be read (cap, failure, not a sentence) → no query, never matched | Task 5 tests; decision 4 (`match_read_at`) |
| One-off backfill | Task 6 (Route Handler) and Task 5 (`backfillRequestMatches`) |
| First publish, in `saveListingForm` after `notifySavedSearches`, under their condition | Task 7 |
| `listingMatches` against open requests' stored queries at the listing's campus; seller's own left out; no model call | Tasks 2 and 4: `matchRequests`, `requestMatchCandidates`, `requestsWantingListing` |
| "N students are looking…", up to three requests, each with "Make an offer", using the offer composer | Tasks 7 and 8; e2e Task 11 |
| Asker hears only on an offer | Task 11 checks notifications; no notify anywhere in the matcher |
| Requests never name the asker | Only titles and links are shown; askers are compared, never returned to a page |
| Stage I reuses the matcher | `matchRequests` (pure) and `requestMatchCandidates` in a module free of the AI door; CLAUDE.md bullet |
| `VOSSIE_AI_LOOKING_MATCH`: off, no reading and no line; stored queries kept but unused | Tasks 1, 5, 6 and 7; decision 5 (a changed edit while off clears) |
| Testing: unit, contract both backends, pgTAP, e2e with the fake in a write project that runs last, axe/CLS/JS | Tasks 2 to 11; decision 13 on layout shift |
| A real-key hand test before the switch goes on | Task 10 |
| Going live: migration after reset and test, switch, redeploy, vossie-pi check, GO-LIVE steps | Tasks 12 and 13 |
