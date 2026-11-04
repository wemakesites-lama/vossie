# AI stage I1: Shop coach without the model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Never commit** in this project: leave the work uncommitted for the controller (Lama's rule). Implementers never commit; the controller commits.

**Goal:** Every approved shop gets up to three actions a week, worked out by the app from its own numbers, its listings and public demand, worded with fixed templates. The seller sees them on the `/sell` home ("This week") and at the top of the Launchpad (`/hub`), with a tick when the app sees an action done and "Mark done" (or "Kept on purpose") on the two kinds it can't check, and a line about last week. No model is called in this stage: stage I2 adds the overnight Batch API call, the mentor's block, the flag, "What shops need" and the notification, on top of what this stage builds.

**Architecture:** Pure rules live in `lib/coach/`:
- `kinds.ts`: the catalogue of 11 kinds, in the spec's order, with their thresholds.
- `week.ts`: the SAST week a time is in, and when a week's row may be made at request time.
- `candidates.ts`: a shop's candidates from its facts.
- `wording.ts`: the fixed title and "why" for each kind.
- `plan.ts`: `planWeek`, the fixed week from the candidates (I2's model path falls back to it).
- `done.ts`: an action's state from live facts, and the progress lines.

The data layer has two halves, each with a Supabase twin:
- `lib/data/coach.ts`: the stored weeks and ticks (read, save, settle, tick, export, forget).
- `lib/data/coach-facts.ts`: the facts a week is planned from (`shopFacts`) and the facts its done states are worked out from (`liveFacts`). It reads through existing readers wherever one exists: `queueFor`'s queue, `shopConversations` (the counting's rows), `searchListings` for similar prices, stage G's `requestMatchCandidates` and `matchRequests` for `answer-request`, `getHubPosts`, `getHubPost`, `getRequest` and `findOffer`.

One orchestrator, `lib/coach/this-week.ts`, reads this week's row for the signed-in seller, makes it with fixed wording on first read when none exists and the time allows (`makeCoachWeek`, the writer I2's cron also calls), settles last week's row when it makes this one, and works out the live states. The `/sell` home reads it beside its other cards (`Promise.all` with a failure caught, `SectionError` on failure). The Launchpad renders it for a signed-in seller inside the feed's `Reveal`. "Mark done" is a plain form posting to `tickCoachAction`.

On Supabase, two tables:
- `public.coach_weeks`: one row per shop per SAST week, `on delete cascade` from `shops`.
- `public.coach_ticks`: the seller's ticks, cascading from their week.

Row level security is on and there are no grants to `anon` or `authenticated`. Reads go through definer functions: `public.own_coach_weeks` is owner-only and never returns the mentor questions; `public.staff_coach_weeks` follows `private.can_mentor`'s rule and is created here, but nothing reads it until I2. The service role writes. A tick goes through `public.tick_coach_action`, which is owner-gated. The feature is off behind `VOSSIE_AI_SHOP_COACH`.

**Tech Stack:** Next.js 16.4 (Server Components, Server Actions, Cache Components), React 19.3, TypeScript, Vitest 5, Playwright + axe, Supabase Postgres (plpgsql, pgTAP).

**Spec:** `docs/superpowers/specs/2026-11-04-ai-round-two-design.md`: sections 2 (all of 2.1), 3 (the parts that touch the seller and the Launchpad), 4 ("Storage", "Privacy", "Switch", "Fixed wording") and 8. Decision 97.

**Read first:**
- `CLAUDE.md` and `AGENTS.md`, especially these bullets: Server Components, `getViewer`/`requireAccount`, the seller's queue (`queueFor`), the `/sell` cards, the `SellSkeleton` height rule, the selling pages' client components, Launchpad, the data download, privacy, e2e write projects and `WRITES`.
- Stage G's plan, `2026-11-04-ai-stage-g-looking-match.md`. This stage uses its `requestMatchCandidates` (`lib/data/request-match.ts`) and `matchRequests` (`lib/looking-for/match.ts`), so "Someone's looking for this" and `answer-request` always agree.

**Depends on:** stage G merged. This plan is written against the names G's plan defines. If G's merged code names them differently, use G's names and note the difference in the spec's section 10.

**Parallel-run rule (build sessions):**
- **Never run as an implementer:** Playwright, `supabase db reset`, `supabase test db`, `pnpm test:db` and `pnpm db:types`. The controller runs those after merging, under its locks (`supabase.lock`, `e2e-3200.lock` in the coordination folder the controller names).
- **Never run at all:** `supabase stop` or `db push`.
- **Do run:** `pnpm exec vitest run <paths>`, `pnpm typecheck` and `pnpm lint`.
- **Shared files:**
  - The list: `lib/ai/config.ts`, `lib/data/store.ts` (`STORE_VERSION`), `lib/data/rows.ts`, `lib/supabase/database.types.ts`, `playwright.config.ts`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md` and the spec.
  - The rule: add your own lines in your own block. Never reorder, reformat or rename what's there.
- **Owned here:** this stage owns `lib/coach/`, `lib/data/coach.ts`, `lib/data/coach-facts.ts`, their Supabase twins, `components/coach/`, `20261107120000_shop_coach.sql`, `67_shop_coach.test.sql` and `tests/e2e/coach-writes.spec.ts`.

---

## Planning decisions (Lama may overturn any; they go in the spec's section 10, "While planning stage I1", in Task 13)

1. **Candidates have stable ids:** `"{kind}:{target}"`. For example `add-photos:l-123`, `answer-request:r-9`, `go-to-launchpad:hp-4`, and `list-more:shop` for a kind about the whole shop. The same thing gets the same id every week, so a tick is per action and per week (`coach_ticks`: shop, week, action id), and I2's `checkCoaching` can check the model's ids against the ids it was sent.
2. **How many:**
   - **Per kind:** at most two candidates, the most in need first (the lowest photo count, the oldest, the soonest).
   - **The fixed week:** `planWeek` takes the first candidate of each kind in the catalogue's order and keeps the first three. So the fixed week never has three photo actions, and the spec's "top three candidates, ranked by the catalogue's order" holds kind by kind.
3. **Three states, not two:**
   - **Done:** the app sees it done, or the seller ticked it.
   - **Open.**
   - **Gone ("No longer needed"):** its listing was deleted or sold where selling doesn't finish it, its request closed, or its post was unpublished or has passed.
   - **Counting:** a gone action is left out of "N of M", so a seller is never marked down for a request that closed.
4. **Done checks use the time the facts were read (`asOf`, kept on each action):**
   - **`reply-waiting`:** done when no buyer has been waiting since `asOf` or before. In the queue's terms, `replies.oldest` is null or newer than `asOf`.
   - **`mark-sold`:** done when no sale in the queue is from `asOf` or before.
   - **`refresh-quiet`:** done when the listing's `updatedAt` is after `asOf`, or it's sold or deleted.
   - **Why:** this is the queue the `/sell` home and the seller bar read (`queueFor`), so the coach never disagrees with Needs you.
5. **Thresholds** (constants in `kinds.ts`):
   - `add-photos`: fewer than two photos. Zero counts too: a listing with none needs it more than one with one.
   - `say-more`: a description under 80 characters.
   - `refresh-quiet`: 21 days.
   - `reply-waiting`: 24 hours.
   - `list-more`: fewer than 3 available.
   - `go-to-launchpad`: the next 14 days.
6. **`check-price`:**
   - **Similar listings:** Browse's own `searchListings` with the listing's title as `q`, its category, every campus and no filters. That's `listingMatches`, the only search rule (spec 2.1).
   - **Left out:** the listing itself, the shop's own listings, swap-only listings, free ones and "From" prices.
   - **The rule:** with 3 or more left, it's a candidate when its price is at least 1.5 times their middle price (the median, rounded to the rand).
   - **Done:** its price drops below 1.5 times the stored middle, or the seller ticks "Kept on purpose". The middle is kept in the evidence; it isn't searched again during the week.
7. **`answer-request` uses stage G's matcher:**
   - **First pass:** `requestMatchCandidates(campus, today)` gives the open requests with a stored search at the shop's campus, and `matchRequests` pairs them with each of the shop's available listings.
   - **Second pass:** requests at that campus whose stored search is in the shop's own category, not yet paired with a listing ("its category", spec 2.1).
   - **Left out:** the seller's own requests (`matchRequests` does it) and requests this shop has offered on (`findOffer`), as G does.
   - **With G's switch off** no request has a stored search, so there are no candidates of this kind.
8. **`go-to-launchpad`:**
   - **Candidates:** published events and office hours from today to 14 days ahead, at the shop's campus, `online` or every campus (`all`).
   - **Done:** the shop's owner has an RSVP or a slot request for that post, in any state, even once it has passed. Not `listOwnBookings`, which drops a passed post, so an action would turn back to open the day after the event.
   - **Gone:** a post that has passed without a booking, or was unpublished.
9. **`read-tip`:** the newest published tip the seller hasn't ticked in the last 12 weeks. Done only by the seller's tick ("Mark done").
10. **A week is settled when the next one is made.**
    - **When:** making a week's row first works out last week's states one final time and stores the ids that were done (`done_ids`, `settled_at`).
    - **What reads it:** "Last week: 2 of 3 done" reads the settled ids, and so do I2's `coaching-stalled` flag and "What shops need". None of them works out live states for past weeks.
    - **Unsettled:** a last week that isn't settled yet (the seller never came back) is worked out live where it's shown.
    - **This week's** states are always live (spec 4).
11. **How sample mode and the e2e server get a row without a cron:**
    - **Lazy row:** the first read of the week makes the row with fixed wording. This is request-time only, after `connection()`, never inside `"use cache"`, the way `settleRequests` runs.
    - **Sample mode:** always.
    - **Supabase:** from Monday 06:00 SAST. That's an hour after I2's 05:00 SAST collect, so the cron's model-worded rows are never beaten by a lazy fixed one. Before then the card isn't shown.
    - **Shops in between:** a shop approved midweek, or missed by the batch, gets its fixed week on its first visit.
12. **Only approved shops** (not pending, not paused by anyone) get a week, a card or a candidate. Sample shops no account owns get nothing.
13. **Ticks:**
    - **Who writes them:** the seller, through the owner-gated `public.tick_coach_action` with their own session, not the service role. The spec's "writes are service role only" is kept for the weeks themselves.
    - **What can be ticked:** only this week's actions of the two seller-ticked kinds (`read-tip`, `check-price`).
    - **No undo:** the week starts again on Monday.
    - **No one-time token:** a second press changes nothing. **No notice:** the tick shows. **No tag:** nothing cached reads coach rows.
14. **Keys:** the sample store keys a shop's weeks by its owner's account (`${ownerId}:${week}`), since a shop's link can change once. Supabase keys them by `shop_id`, and the foreign key's cascade does account deletion.
15. **The Launchpad card renders inside the feed's `Reveal`, above Coming up, not in a `<Suspense fallback={null}>` of its own.**
    - **Why:** a card several rows tall that streams in after the feed would push Coming up down, a layout shift every signed-in seller would see.
    - **What stays as the spec says:** the static shell (intro, Verified shops) is unchanged, and anyone else sees the page unchanged.
    - **For Lama:** this is a deviation from the spec's wording. If Lama prefers the spec, a `<Suspense fallback={null}>` above `<Reveal>` is a one-line change, and the e2e's layout-shift check will then measure the shift.
16. **The card shows only while `aiFeatureOn("shop-coach")`:** the switch, plus Haiku or the fake able to answer, as every AI feature decides. I1 itself never calls the model.
17. **The data download** gives what's stored, week by week:
    - each action's kind, title and why;
    - whether the seller ticked it;
    - whether it was done when the week ended (`null` while the week isn't settled);
    - `writtenBy`.
    It never includes mentor questions (spec 4). Deleting the account deletes the shop's weeks and ticks.
18. **Links:** the card's links are plain, untyped `next/link`s with `prefetch={false}`, as stage G's are. "Mark done" buttons have a visually hidden " : {title}", so every button has a distinct name that starts with its visible text (WCAG 2.4.4 and 2.5.3).
19. **The fixed wording is a sample for Lama to change** (in `wording.ts`). Titles are cut to 70 characters and "why" lines to 140, at a word (`clipAtWord`, `lib/clip.ts`). I2 reuses the cut for the model's words.
20. **End-to-end:** a new write project, `coach-writes`, runs last, after `role-views-writes`, and joins `WRITES`. With the switch on in the e2e server, the sample seller's `/sell` also shows the card on the device projects. Task 12 checks no device test's locators collide with the card's words.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/ai/config.ts` (+ test) | modify | `"shop-coach"` feature, `VOSSIE_AI_SHOP_COACH`, Haiku and the fake only |
| `lib/clip.ts` (+ test) | create | `clipAtWord(text, max)` |
| `lib/staff/numbers.ts` | modify | `export` on `mondayOf` (no other change) |
| `lib/coach/kinds.ts` | create | `COACH_KINDS`, `CoachKind`, `SELLER_TICKED`, thresholds, `KIND_LABELS` |
| `lib/coach/types.ts` | create | `Candidate`, `CoachAction`, `ShopFacts`, `LiveFacts`, `CoachWeek`, `ActionState` |
| `lib/coach/week.ts` (+ test) | create | `coachWeekOf`, `previousWeek`, `weeksBack`, `lazyAllowed` |
| `lib/coach/candidates.ts` (+ test) | create | `candidatesFor(facts, now)` |
| `lib/coach/wording.ts` (+ test) | create | `fixedWording(candidate)` |
| `lib/coach/plan.ts` (+ test) | create | `planWeek(candidates, asOf)`, `asCoachActions(value)` |
| `lib/coach/done.ts` (+ test) | create | `actionState`, `progressOf`, `progressLine`, `lastWeekLine`, `settledIds` |
| `lib/data/rows.ts` | modify | `CoachWeekRow`, `CoachTickRow` |
| `lib/data/store.ts` | modify | `coachWeeks`, `coachTicks`, `STORE_VERSION` 19 |
| `supabase/migrations/20261107120000_shop_coach.sql` | create | tables, checks, functions, grants |
| `supabase/tests/67_shop_coach.test.sql` | create | pgTAP |
| `lib/supabase/database.types.ts` | modify | hand edit; the controller regenerates |
| `lib/data/coach.ts`, `lib/data/supabase/coach.ts` | create | weeks and ticks |
| `lib/data/shop-stats.ts`, `lib/data/supabase/shop-stats.ts` | modify | `shopConversations(slug)` (the counting's rows, exported) |
| `lib/data/coach-facts.ts`, `lib/data/supabase/coach-facts.ts` | create | `shopFacts`, `liveFacts`, `bookedPosts` |
| `lib/data/contract/coach.contract.ts`, `.test.ts`, `.db.test.ts` | create | both backends |
| `lib/coach/this-week.ts` (+ test) | create | `makeCoachWeek`, `readThisWeek` |
| `lib/coach/actions.ts` (+ test) | create | `tickCoachAction` (Server Action) |
| `components/coach/CoachWeek.tsx` (+ test), the CSS file holding `.sell-home` | create / modify | the card |
| `components/sell/SellHome.tsx`, `components/sell/Dashboard.tsx` (+ tests) | modify | "This week" on `/sell` |
| `components/hub/CoachOnHub.tsx` (+ test), `app/hub/page.tsx` | create / modify | the Launchpad card |
| `lib/data/accounts.ts`, `lib/data/supabase/accounts.ts` (if the export is assembled there) | modify | `coach` in the download; sample deletion |
| `playwright.config.ts`, `tests/e2e/coach-writes.spec.ts` | modify / create | switch on with the fake; `coach-writes` project |
| `CLAUDE.md`, the spec, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md` | modify | docs |

Run unit tests for a task's files only (`pnpm exec vitest run <paths>`); the whole suite runs once, in Task 14.

---

### Task 1: The switch and the word cut

**Files:** Modify `lib/ai/config.ts`, `lib/ai/config.test.ts`. Create `lib/clip.ts`, `lib/clip.test.ts`.

- [ ] **Step 1: Failing tests.** Append to `lib/ai/config.test.ts`:

```ts
it("turns Shop coach on only with its switch and Haiku or the fake (AI stage I1)", () => {
  const groq = { VOSSIE_AI_PROVIDERS: "groq", GROQ_API_KEY: "g", VOSSIE_AI_SHOP_COACH: "1" };
  expect(featureProviders("shop-coach", groq)).toEqual([]);
  expect(aiFeatureOn("shop-coach", groq)).toBe(false);
  const haiku = { VOSSIE_AI_PROVIDERS: "anthropic,groq", ANTHROPIC_API_KEY: "a", GROQ_API_KEY: "g" };
  expect(featureProviders("shop-coach", haiku)).toEqual(["anthropic"]);
  expect(aiFeatureOn("shop-coach", haiku)).toBe(false);
  expect(aiFeatureOn("shop-coach", { ...haiku, VOSSIE_AI_SHOP_COACH: "1" })).toBe(true);
  expect(aiFeatureOn("shop-coach", { VOSSIE_AI_PROVIDERS: "fake", VOSSIE_AI_SHOP_COACH: "1" })).toBe(true);
});
```

  `lib/clip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clipAtWord } from "./clip";

describe("clipAtWord (models can't count characters: cut, never refuse)", () => {
  it("keeps text that fits, with its spaces collapsed", () => {
    expect(clipAtWord("  Reply to   the 3 students  ", 70)).toBe("Reply to the 3 students");
  });
  it("cuts at the last word that fits, adding an ellipsis inside the limit", () => {
    const cut = clipAtWord("Add a second photo to Casio fx-991ZA Plus calculator, barely used, with its case", 40);
    expect(Array.from(cut).length).toBeLessThanOrEqual(40);
    expect(cut).toBe("Add a second photo to Casio fx-991ZA…");
  });
  it("cuts inside a word only when one word fills more than half", () => {
    expect(clipAtWord("Supercalifragilisticexpialidocious and more", 20)).toBe("Supercalifragilisti…");
  });
  it("drops trailing punctuation before the ellipsis", () => {
    expect(clipAtWord("Your oldest enquiry is 2 days old, and another, and another", 36)).toBe("Your oldest enquiry is 2 days old…");
  });
});
```

  (The third case guards the "more than half" rule: with no space in the first 19 characters, the word itself is cut.)
- [ ] **Step 2:** `pnpm exec vitest run lib/ai/config.test.ts lib/clip.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
  - **`lib/ai/config.ts`:** add each line as the last entry (don't reorder):
    - `AiFeature`: `| "shop-coach"`.
    - `SWITCHES`: `"shop-coach": "VOSSIE_AI_SHOP_COACH",`.
    - `ONLY`: `"shop-coach": ["anthropic", "fake"],`.
    - Change the doc comment to "Stages C to I add theirs here".
  - **No `AiTask` yet:** I2 adds `"shop-coach"` with the request.

  `lib/clip.ts`:

```ts
// One line of text cut to a length at a word (AI round two: Shop coach's titles and whys, I1 planning decision 19).
// The model is asked for a length but can't count characters (the report read's lesson, 2026-11-04), so text is cut,
// never refused. Pure.

/** `text` with its whitespace collapsed, cut to at most `max` characters at a word, with "…" when cut. */
export function clipAtWord(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (Array.from(line).length <= max) return line;
  const room = Array.from(line).slice(0, max - 1).join("");
  const cut = room.lastIndexOf(" ");
  return `${(cut > max / 2 ? room.slice(0, cut) : room).replace(/[\s,;:.-]+$/, "")}…`;
}
```

- [ ] **Step 4:** tests pass; `pnpm typecheck` clean.

### Task 2: The catalogue, the types and the week

**Files:** Create `lib/coach/kinds.ts`, `lib/coach/types.ts`, `lib/coach/week.ts`, `lib/coach/week.test.ts`. Modify `lib/staff/numbers.ts` (add `export` before `function mondayOf`; nothing else).

- [ ] **Step 1: Failing test** (`lib/coach/week.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { coachWeekOf, lazyAllowed, previousWeek, weeksBack } from "./week";

describe("the coach's SAST weeks (spec 4: one row per shop per SAST week, starting Monday)", () => {
  it("is the Monday of the South African week", () => {
    // Sunday 2026-11-08 21:59 UTC is 23:59 SAST, still Sunday's week.
    expect(coachWeekOf(new Date("2026-11-08T21:59:00Z"))).toBe("2026-11-02");
    // Sunday 22:00 UTC is Monday 00:00 SAST: the new week.
    expect(coachWeekOf(new Date("2026-11-08T22:00:00Z"))).toBe("2026-11-09");
  });
  it("steps back by weeks", () => {
    expect(previousWeek("2026-11-09")).toBe("2026-11-02");
    expect(weeksBack("2026-11-09", 12)).toBe("2026-08-17");
  });
  it("makes a row at request time always in sample mode, and on Supabase from Monday 06:00 SAST (decision 11)", () => {
    const mondayFive = new Date("2026-11-09T03:59:00Z"); // 05:59 SAST
    const mondaySix = new Date("2026-11-09T04:00:00Z"); // 06:00 SAST
    expect(lazyAllowed(mondayFive, false)).toBe(true);
    expect(lazyAllowed(mondayFive, true)).toBe(false);
    expect(lazyAllowed(mondaySix, true)).toBe(true);
    expect(lazyAllowed(new Date("2026-11-11T01:00:00Z"), true)).toBe(true);
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/coach/week.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `lib/coach/kinds.ts`:

```ts
// Shop coach's catalogue (AI round two spec 2.1): the only kinds an action can be, in the spec's order, which is also
// the fixed week's order (planning decision 2). The model never adds a kind (I2 checks its ids). Pure.

export const COACH_KINDS = [
  "reply-waiting",
  "mark-sold",
  "add-photos",
  "say-more",
  "refresh-quiet",
  "check-price",
  "answer-request",
  "list-more",
  "finish-shop",
  "go-to-launchpad",
  "read-tip",
] as const;

export type CoachKind = (typeof COACH_KINDS)[number];

/** The kinds the app can't check (spec 2.1): the seller ticks them, this week only (planning decision 13). */
export const SELLER_TICKED: ReadonlySet<CoachKind> = new Set(["check-price", "read-tip"]);

/** At most this many actions a week (spec 2). */
export const ACTIONS_A_WEEK = 3;
/** At most this many candidates of one kind (planning decision 2). */
export const PER_KIND = 2;
export const TITLE_MAX = 70;
export const WHY_MAX = 140;

// The thresholds (spec 2.1; planning decision 5).
export const REPLY_WAIT_HOURS = 24;
export const PHOTOS_WANTED = 2;
export const DESCRIPTION_WANTED = 80;
export const QUIET_DAYS = 21;
export const PRICE_RATIO = 1.5;
export const SIMILAR_WANTED = 3;
export const LISTINGS_WANTED = 3;
export const LAUNCHPAD_DAYS = 14;
/** A tip ticked in this many weeks isn't offered again (planning decision 9); also how long rows are kept (spec 4). */
export const WEEKS_KEPT = 12;

/** Each kind as the Hub team reads it ("What shops need", stage I2). Samples for Lama to change. */
export const KIND_LABELS: Readonly<Record<CoachKind, string>> = {
  "reply-waiting": "Reply to waiting buyers",
  "mark-sold": "Mark sales as sold",
  "add-photos": "Add photos",
  "say-more": "Say more in a description",
  "refresh-quiet": "Refresh a quiet listing",
  "check-price": "Check a price",
  "answer-request": "Answer a Looking For request",
  "list-more": "List more",
  "finish-shop": "Finish the shop's page",
  "go-to-launchpad": "Go to a Launchpad event or office hours",
  "read-tip": "Read a Launchpad tip",
};
```

  `lib/coach/types.ts`:

```ts
import type { ListingState, SellerQueue } from "@/lib/types";
import type { CoachKind } from "./kinds";

// Shop coach's shapes (AI round two spec 2 and 4). Pure types: lib/coach's rules, lib/data/coach*.ts and the cards.

/** What an action is about. `id` is null for the shop itself. */
export type CoachTarget = { type: "shop" | "listing" | "request" | "post"; id: string | null };

/** The numbers behind a candidate (spec 2.1): the fixed wording fills from them, and I2's check allows only them. */
export type Evidence = Readonly<Record<string, number>>;

export type Candidate = {
  /** "{kind}:{target id or shop}" (planning decision 1). */
  id: string;
  kind: CoachKind;
  target: CoachTarget;
  /** What the target is called (a listing's, request's or post's title), or null for the shop. */
  name: string | null;
  evidence: Evidence;
  /** The one link that does it (spec 2). */
  href: string;
};

/** A stored action: a candidate with its words, and when its facts were read (planning decision 4). */
export type CoachAction = Candidate & { title: string; why: string; asOf: string };

export type ActionState = "done" | "open" | "gone";

/** A week as its reader gets it. `mentorQuestions` only ever reaches staff (I2). */
export type CoachWeek = {
  week: string;
  actions: CoachAction[];
  writtenBy: "model" | "fixed";
  /** The ids done, and gone, when the week was settled, or null until then (planning decision 10). */
  doneIds: string[] | null;
  goneIds: string[] | null;
  settledAt: string | null;
  createdAt: string;
  /** The seller's ticks that week. */
  ticks: string[];
};

/** One of the shop's available, shown listings, as the candidate rules read it. */
export type FactListing = {
  id: string;
  title: string;
  categorySlug: string;
  priceZar: number | null;
  priceIsFrom: boolean;
  photos: number;
  descriptionChars: number;
  updatedAt: string;
  /** The newest enquiry about it (a buyer's first message; offers aren't enquiries), or null. */
  lastEnquiryAt: string | null;
  /** The prices of similar available listings elsewhere (planning decision 6). */
  similarPrices: number[];
};

export type FactPost = {
  id: string;
  kind: "event" | "office-hours" | "tip";
  title: string;
  campusSlug: string;
  startsAt: string | null;
  publishedAt: string;
};

/** What a week is planned from (spec 2.1). Read at `asOf`. */
export type ShopFacts = {
  asOf: string;
  shop: { slug: string; campusSlug: string; categorySlug: string; about: string; hasPhoto: boolean };
  queue: Pick<SellerQueue, "replies" | "sales" | "listings">;
  listings: FactListing[];
  /** Open requests the matcher pairs with the shop, best first; the seller's own and offered ones left out. */
  requests: { id: string; title: string; via: "listing" | "category" }[];
  /** Published events and office hours from today on, soonest first, and tips, newest first. */
  posts: FactPost[];
  /** Posts the owner has an RSVP or a slot request for. */
  booked: readonly string[];
  /** Tips ticked in the last 12 weeks (planning decision 9). */
  tickedTips: readonly string[];
};

export type LiveListing = {
  state: ListingState;
  hidden: boolean;
  photos: number;
  descriptionChars: number;
  priceZar: number | null;
  updatedAt: string;
};

/** What done states are worked out from (spec 4: live, so always current). */
export type LiveFacts = {
  queue: Pick<SellerQueue, "replies" | "sales" | "listings">;
  shop: { about: string; hasPhoto: boolean };
  /** By id; a deleted listing is absent. */
  listings: ReadonlyMap<string, LiveListing>;
  offered: ReadonlySet<string>;
  openRequests: ReadonlySet<string>;
  booked: ReadonlySet<string>;
  /** Published posts asked about, and which of them have passed (SAST day before today). */
  publishedPosts: ReadonlySet<string>;
  passedPosts: ReadonlySet<string>;
};
```

  `lib/coach/week.ts`:

```ts
import { addDays } from "@/lib/staff/rules";
import { mondayOf } from "@/lib/staff/numbers";
import { sastDate } from "@/lib/time";
import { WEEKS_KEPT } from "./kinds";

// Shop coach's weeks (AI round two spec 4): Monday to Sunday in South Africa, named by the Monday (YYYY-MM-DD). The
// clock comes from the caller, read after connection(). Pure.

/** On Supabase, a week's row is made at request time only from Monday 06:00 SAST (I1 planning decision 11). */
export const LAZY_FROM_HOUR = 6;
const HOUR_MS = 3_600_000;
const SAST_OFFSET_MS = 2 * HOUR_MS;

export function coachWeekOf(now: Date): string {
  return mondayOf(sastDate(now));
}

export function previousWeek(week: string): string {
  return addDays(week, -7);
}

export function weeksBack(week: string, weeks: number = WEEKS_KEPT): string {
  return addDays(week, -7 * weeks);
}

/** Whether a missing row may be made now (decision 11): always in sample mode; on Supabase after the cron's run. */
export function lazyAllowed(now: Date, supabase: boolean): boolean {
  if (!supabase) return true;
  const mondayStart = Date.parse(`${coachWeekOf(now)}T00:00:00Z`) - SAST_OFFSET_MS;
  return now.getTime() - mondayStart >= LAZY_FROM_HOUR * HOUR_MS;
}
```

- [ ] **Step 4:** test passes; `pnpm typecheck` clean (the `mondayOf` export is the only change to `numbers.ts`; run `pnpm exec vitest run lib/staff/numbers.test.ts` to be sure).

### Task 3: Candidates, fixed wording and the fixed week

**Files:** Create `lib/coach/candidates.ts`, `lib/coach/wording.ts`, `lib/coach/plan.ts` and a test for each.

- [ ] **Step 1: Failing tests.** `lib/coach/candidates.test.ts`. Build one `ShopFacts` helper and change one thing per case:

```ts
import { describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates";
import type { FactListing, ShopFacts } from "./types";

const NOW = new Date("2026-11-10T08:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const listing = (id: string, changes: Partial<FactListing> = {}): FactListing => ({
  id,
  title: `Listing ${id}`,
  categorySlug: "tech",
  priceZar: 200,
  priceIsFrom: false,
  photos: 3,
  descriptionChars: 120,
  updatedAt: ago(2),
  lastEnquiryAt: ago(1),
  similarPrices: [],
  ...changes,
});
const facts = (changes: Partial<ShopFacts> = {}): ShopFacts => ({
  asOf: NOW.toISOString(),
  shop: { slug: "tech-corner", campusSlug: "midrand", categorySlug: "tech", about: "We fix laptops.", hasPhoto: true },
  queue: { replies: { count: 0, oldest: null }, sales: [], listings: { available: 3, paused: 0, sold: 0, drafts: 0 } },
  listings: [listing("l-1"), listing("l-2"), listing("l-3")],
  requests: [],
  posts: [],
  booked: [],
  tickedTips: [],
  ...changes,
});
const kinds = (f: ShopFacts) => candidatesFor(f, NOW).map((c) => c.id);

describe("candidatesFor (spec 2.1, planning decisions 1 to 9)", () => {
  it("finds nothing for a shop in good shape", () => {
    expect(kinds(facts())).toEqual([]);
  });
  it("asks for a reply only once the oldest buyer has waited over 24 hours", () => {
    const waiting = (hours: number) =>
      facts({ queue: { ...facts().queue, replies: { count: 3, oldest: { id: "c-1", title: "Lamp", at: new Date(NOW.getTime() - hours * 3_600_000).toISOString(), state: null } } } });
    expect(kinds(waiting(23))).toEqual([]);
    const [c] = candidatesFor(waiting(49), NOW);
    expect(c).toMatchObject({ id: "reply-waiting:shop", evidence: { waiting: 3, oldestDays: 2 }, href: "/sell/messages" });
  });
  it("asks to mark sales sold, linking to the oldest sale's thread", () => {
    const sales = [
      { conversationId: "c-9", listingId: "l-1", title: "Lamp", at: ago(3) },
      { conversationId: "c-8", listingId: "l-2", title: "Desk", at: ago(1) },
    ];
    expect(candidatesFor(facts({ queue: { ...facts().queue, sales } }), NOW)[0]).toMatchObject({
      id: "mark-sold:shop",
      evidence: { sales: 2 },
      href: "/messages/c-9",
    });
  });
  it("asks for photos on listings with fewer than two, fewest first, at most two (decisions 2 and 5)", () => {
    const f = facts({ listings: [listing("l-1", { photos: 1 }), listing("l-2", { photos: 0 }), listing("l-3", { photos: 1 })] });
    expect(kinds(f)).toEqual(["add-photos:l-2", "add-photos:l-1"]);
  });
  it("asks to say more under 80 characters, to refresh after 21 quiet days", () => {
    const f = facts({
      listings: [
        listing("l-1", { descriptionChars: 79 }),
        listing("l-2", { updatedAt: ago(22), lastEnquiryAt: ago(30) }),
        listing("l-3", { updatedAt: ago(22), lastEnquiryAt: ago(5) }),
      ],
    });
    expect(kinds(f)).toEqual(["say-more:l-1", "refresh-quiet:l-2"]);
  });
  it("checks a price at 1.5 times the middle of 3 or more similar listings (decision 6)", () => {
    const f = facts({ listings: [listing("l-1", { priceZar: 450, similarPrices: [300, 200, 250] }), listing("l-2", { priceZar: 370, similarPrices: [250, 250, 250] }), listing("l-3", { priceZar: 900, similarPrices: [100, 100] })] });
    expect(candidatesFor(f, NOW).filter((c) => c.kind === "check-price")).toEqual([
      expect.objectContaining({ id: "check-price:l-1", evidence: { price: 450, middle: 250, similar: 3 } }),
    ]);
  });
  it("never checks a free, swap-only or From price", () => {
    const f = facts({ listings: [listing("l-1", { priceZar: null, similarPrices: [1, 1, 1] }), listing("l-2", { priceZar: 0, similarPrices: [1, 1, 1] }), listing("l-3", { priceIsFrom: true, priceZar: 900, similarPrices: [1, 1, 1] })] });
    expect(kinds(f)).toEqual([]);
  });
  it("offers on matched requests, listing matches first (decision 7)", () => {
    const f = facts({ requests: [{ id: "r-1", title: "Calculator", via: "listing" }, { id: "r-2", title: "Laptop bag", via: "category" }, { id: "r-3", title: "Mouse", via: "category" }] });
    expect(candidatesFor(f, NOW).map((c) => [c.id, c.href])).toEqual([
      ["answer-request:r-1", "/looking-for/r-1/offer"],
      ["answer-request:r-2", "/looking-for/r-2/offer"],
    ]);
  });
  it("asks to list more under 3 available, and to finish the shop without about or photo", () => {
    const f = facts({ queue: { ...facts().queue, listings: { available: 1, paused: 0, sold: 0, drafts: 0 } }, listings: [listing("l-1")], shop: { ...facts().shop, about: "", hasPhoto: false } });
    expect(candidatesFor(f, NOW).filter((c) => c.kind === "list-more" || c.kind === "finish-shop")).toEqual([
      expect.objectContaining({ id: "list-more:shop", evidence: { available: 1, more: 2 }, href: "/sell/listings/new" }),
      expect.objectContaining({ id: "finish-shop:shop", evidence: { about: 0, photo: 0 }, href: "/sell/profile" }),
    ]);
  });
  it("sends the seller to the Launchpad's next 14 days at their campus, online or everywhere, unbooked (decision 8)", () => {
    const post = (id: string, campusSlug: string, days: number) => ({
      id, kind: "event" as const, title: `Event ${id}`, campusSlug, startsAt: new Date(NOW.getTime() + days * DAY).toISOString(), publishedAt: ago(5),
    });
    const f = facts({ posts: [post("hp-1", "pretoria", 2), post("hp-2", "online", 3), post("hp-3", "midrand", 1), post("hp-4", "all", 15), post("hp-5", "all", 4)], booked: ["hp-3"] });
    expect(candidatesFor(f, NOW).map((c) => [c.id, c.href])).toEqual([
      ["go-to-launchpad:hp-2", "/hub/hp-2"],
      ["go-to-launchpad:hp-5", "/hub/hp-5"],
    ]);
  });
  it("offers the newest tip not ticked in 12 weeks (decision 9)", () => {
    const tip = (id: string, days: number) => ({ id, kind: "tip" as const, title: `Tip ${id}`, campusSlug: "all", startsAt: null, publishedAt: ago(days) });
    const f = facts({ posts: [tip("t-1", 9), tip("t-2", 2), tip("t-3", 5)], tickedTips: ["t-2"] });
    expect(kinds(f)).toEqual(["read-tip:t-3"]);
  });
  it("keeps the catalogue's order across kinds", () => {
    const f = facts({ listings: [listing("l-1", { photos: 1, descriptionChars: 10 })], queue: { ...facts().queue, listings: { available: 1, paused: 0, sold: 0, drafts: 0 } } });
    expect(candidatesFor(f, NOW).map((c) => c.kind)).toEqual(["add-photos", "say-more", "list-more"]);
  });
});
```

  `lib/coach/wording.test.ts`: one case per kind, checking the title and the why from the evidence and the name. Cut a 70-character listing title in `add-photos` to see the cut (the title stays at 70 or under and ends with "…"). Check the singular forms too ("Reply to the student waiting on you", "List one more thing").

  `lib/coach/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { asCoachActions, planWeek } from "./plan";
import type { Candidate } from "./types";

const c = (id: string): Candidate => ({ id, kind: id.split(":")[0] as Candidate["kind"], target: { type: "listing", id: id.split(":")[1] }, name: "Lamp", evidence: { photos: 1, chars: 10, available: 1, more: 2 }, href: "/x" });
const AS_OF = "2026-11-10T08:00:00.000Z";

describe("planWeek, the fixed week (spec 4; planning decision 2)", () => {
  it("takes the first candidate of each kind, in the catalogue's order, three at most", () => {
    const week = planWeek([c("add-photos:l-1"), c("add-photos:l-2"), c("say-more:l-1"), c("list-more:shop"), c("read-tip:t-1")], AS_OF);
    expect(week.map((a) => a.id)).toEqual(["add-photos:l-1", "say-more:l-1", "list-more:shop"]);
    expect(week.every((a) => a.asOf === AS_OF && a.title.length > 0 && a.why.length > 0)).toBe(true);
  });
  it("is empty with no candidates", () => {
    expect(planWeek([], AS_OF)).toEqual([]);
  });
  it("reads stored actions back, refusing anything malformed", () => {
    const week = planWeek([c("say-more:l-1")], AS_OF);
    expect(asCoachActions(JSON.parse(JSON.stringify(week)))).toEqual(week);
    expect(asCoachActions([{ ...week[0], kind: "write-poem" }])).toBeNull();
    expect(asCoachActions([...week, ...week, ...week, ...week])).toBeNull();
    expect(asCoachActions({})).toBeNull();
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/coach` → FAIL.
- [ ] **Step 3: Implement** `lib/coach/candidates.ts`:

```ts
import { ALL_CAMPUSES } from "@/lib/campus";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { offerPath } from "@/lib/looking-for/paths";
import { editListingPath, NEW_LISTING_PATH, PROFILE_PATH } from "@/lib/selling/paths";
import { sastDate } from "@/lib/time";
import {
  COACH_KINDS,
  DESCRIPTION_WANTED,
  LAUNCHPAD_DAYS,
  LISTINGS_WANTED,
  PER_KIND,
  PHOTOS_WANTED,
  PRICE_RATIO,
  QUIET_DAYS,
  REPLY_WAIT_HOURS,
  SIMILAR_WANTED,
  type CoachKind,
} from "./kinds";
import type { Candidate, FactListing, ShopFacts } from "./types";

// A shop's candidates (AI round two spec 2.1; I1 planning decisions 1 to 9): the catalogue's rules over facts the data
// layer read (lib/data/coach-facts.ts). Pure. The order is the catalogue's, and within a kind the most in need first,
// at most PER_KIND of each.

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ONLINE = "online";

const days = (from: string, to: number) => Math.floor((to - Date.parse(from)) / DAY_MS);

/** The middle of a list of prices, rounded to the rand. */
export function middlePrice(prices: readonly number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

const forListing = (kind: CoachKind, l: FactListing, evidence: Candidate["evidence"]): Candidate => ({
  id: `${kind}:${l.id}`,
  kind,
  target: { type: "listing", id: l.id },
  name: l.title,
  evidence,
  href: editListingPath(l.id),
});

const forShop = (kind: CoachKind, evidence: Candidate["evidence"], href: string): Candidate => ({
  id: `${kind}:shop`,
  kind,
  target: { type: "shop", id: null },
  name: null,
  evidence,
  href,
});

export function candidatesFor(facts: ShopFacts, now: Date): Candidate[] {
  const at = now.getTime();
  const today = sastDate(now);
  const byKind: Record<CoachKind, Candidate[]> = Object.fromEntries(COACH_KINDS.map((k) => [k, []])) as never;
  const { queue, listings, shop } = facts;

  const oldest = queue.replies.oldest;
  if (oldest && at - Date.parse(oldest.at) > REPLY_WAIT_HOURS * HOUR_MS) {
    byKind["reply-waiting"].push(
      forShop("reply-waiting", { waiting: queue.replies.count, oldestDays: Math.max(1, days(oldest.at, at)) }, inboxPath("selling")),
    );
  }
  if (queue.sales.length > 0) {
    byKind["mark-sold"].push(
      forShop("mark-sold", { sales: new Set(queue.sales.map((s) => s.listingId)).size }, threadPath(queue.sales[0].conversationId)),
    );
  }
  for (const l of [...listings].sort((a, b) => a.photos - b.photos)) {
    if (l.photos < PHOTOS_WANTED) byKind["add-photos"].push(forListing("add-photos", l, { photos: l.photos }));
  }
  for (const l of [...listings].sort((a, b) => a.descriptionChars - b.descriptionChars)) {
    if (l.descriptionChars < DESCRIPTION_WANTED) byKind["say-more"].push(forListing("say-more", l, { chars: l.descriptionChars }));
  }
  for (const l of [...listings].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
    const quietSince = l.lastEnquiryAt && l.lastEnquiryAt > l.updatedAt ? l.lastEnquiryAt : l.updatedAt;
    if (days(l.updatedAt, at) >= QUIET_DAYS && days(quietSince, at) >= QUIET_DAYS) {
      byKind["refresh-quiet"].push(forListing("refresh-quiet", l, { days: days(quietSince, at) }));
    }
  }
  const priced = listings.filter((l) => l.priceZar !== null && l.priceZar > 0 && !l.priceIsFrom && l.similarPrices.length >= SIMILAR_WANTED);
  for (const l of priced.sort((a, b) => b.priceZar! / middlePrice(b.similarPrices) - a.priceZar! / middlePrice(a.similarPrices))) {
    const middle = middlePrice(l.similarPrices);
    if (middle > 0 && l.priceZar! >= PRICE_RATIO * middle) {
      byKind["check-price"].push(forListing("check-price", l, { price: l.priceZar!, middle, similar: l.similarPrices.length }));
    }
  }
  for (const r of facts.requests) {
    byKind["answer-request"].push({
      id: `answer-request:${r.id}`,
      kind: "answer-request",
      target: { type: "request", id: r.id },
      name: r.title,
      evidence: {},
      href: offerPath(r.id),
    });
  }
  if (queue.listings.available < LISTINGS_WANTED) {
    const available = queue.listings.available;
    byKind["list-more"].push(forShop("list-more", { available, more: LISTINGS_WANTED - available }, NEW_LISTING_PATH));
  }
  if (!shop.about.trim() || !shop.hasPhoto) {
    byKind["finish-shop"].push(forShop("finish-shop", { about: shop.about.trim() ? 1 : 0, photo: shop.hasPhoto ? 1 : 0 }, PROFILE_PATH));
  }
  const booked = new Set(facts.booked);
  const near = facts.posts
    .filter((p) => p.kind !== "tip" && p.startsAt !== null && !booked.has(p.id))
    .filter((p) => [shop.campusSlug, ONLINE, ALL_CAMPUSES].includes(p.campusSlug))
    .filter((p) => sastDate(new Date(p.startsAt!)) >= today && Date.parse(p.startsAt!) - at <= LAUNCHPAD_DAYS * DAY_MS)
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
  for (const p of near) {
    const until = Math.max(0, Math.ceil((Date.parse(p.startsAt!) - at) / DAY_MS));
    byKind["go-to-launchpad"].push({
      id: `go-to-launchpad:${p.id}`,
      kind: "go-to-launchpad",
      target: { type: "post", id: p.id },
      name: p.title,
      evidence: { days: until, date: Number(p.startsAt!.slice(8, 10)) },
      href: `/hub/${p.id}`,
    });
  }
  const ticked = new Set(facts.tickedTips);
  const tip = facts.posts
    .filter((p) => p.kind === "tip" && !ticked.has(p.id))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  if (tip) {
    byKind["read-tip"].push({ id: `read-tip:${tip.id}`, kind: "read-tip", target: { type: "post", id: tip.id }, name: tip.title, evidence: {}, href: `/hub/${tip.id}` });
  }
  return COACH_KINDS.flatMap((kind) => byKind[kind].slice(0, kind === "read-tip" ? 1 : PER_KIND));
}
```

  Notes for the implementer:
  - **`go-to-launchpad`'s `date` evidence** is the UTC day of the month. Use the SAST day instead (`sastDate(new Date(p.startsAt))`), since a post at 23:30 SAST is on the next UTC day. Add a case for it.
  - **The days-until** must use SAST days too; keep `Math.ceil` only if the test above still states it.
  - **Check each path helper's real name:** `editListingPath`, `NEW_LISTING_PATH`, `PROFILE_PATH`, `offerPath`, `inboxPath`, `threadPath`. The Launchpad's post path is `/hub/${id}`: use the existing helper if `lib/hub.ts` has one.

  `lib/coach/wording.ts` (samples for Lama to change; each title cut to `TITLE_MAX`, each why to `WHY_MAX`):

```ts
import { clipAtWord } from "@/lib/clip";
import { TITLE_MAX, WHY_MAX, type CoachKind } from "./kinds";
import type { Candidate } from "./types";

// Shop coach's fixed wording (AI round two spec 4): every kind's template, filled from its evidence and the target's
// name. Used when the model fails, when the batch is late, and always in sample mode. Samples for Lama to change.

type Words = { title: string; why: string };
const n = (c: Candidate, key: string) => c.evidence[key] ?? 0;
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const TEMPLATES: Readonly<Record<CoachKind, (c: Candidate) => Words>> = {
  "reply-waiting": (c) => ({
    title: n(c, "waiting") === 1 ? "Reply to the student waiting on you" : `Reply to the ${n(c, "waiting")} students waiting on you`,
    why: `Your oldest enquiry is ${n(c, "oldestDays")} ${plural(n(c, "oldestDays"), "day", "days")} old.`,
  }),
  "mark-sold": (c) => ({
    title: n(c, "sales") === 1 ? "Mark your sale as sold" : `Mark your ${n(c, "sales")} sales as sold`,
    why: "A buyer finished the deal, but buyers still see it as available.",
  }),
  "add-photos": (c) => ({
    title: `Add a second photo to ${c.name}`,
    why: n(c, "photos") === 0 ? "It has no photo yet. Buyers ask more about listings with a few." : "It has 1 photo. Buyers ask more about listings with a few.",
  }),
  "say-more": (c) => ({
    title: `Say more about ${c.name}`,
    why: `Its description is ${n(c, "chars")} characters. Size, condition and where to meet help buyers decide.`,
  }),
  "refresh-quiet": (c) => ({
    title: `Refresh ${c.name}`,
    why: `No one has asked about it in ${n(c, "days")} days. A new photo, title or price can help.`,
  }),
  "check-price": (c) => ({
    title: `Check the price of ${c.name}`,
    why: `${n(c, "similar")} similar listings ask about R${n(c, "middle")}; yours is R${n(c, "price")}.`,
  }),
  "answer-request": (c) => ({
    title: `Make an offer: ${c.name}`,
    why: "A student at your campus is looking for something like what you sell.",
  }),
  "list-more": (c) => ({
    title: n(c, "more") === 1 ? "List one more thing" : `List ${n(c, "more")} more things`,
    why: `You have ${n(c, "available")} available ${plural(n(c, "available"), "listing", "listings")}. More choice gives buyers a reason to look around.`,
  }),
  "finish-shop": (c) => ({
    title: n(c, "photo") === 0 && n(c, "about") === 0 ? "Add a photo and a few words to your shop" : n(c, "photo") === 0 ? "Add a photo of your shop" : "Say what your shop is about",
    why: "Buyers trust a shop with a photo and a few words about it.",
  }),
  "go-to-launchpad": (c) => ({
    title: `Go to ${c.name}`,
    why: n(c, "days") === 0 ? "It's today, at your campus or online." : `It's in ${n(c, "days")} ${plural(n(c, "days"), "day", "days")}, at your campus or online.`,
  }),
  "read-tip": (c) => ({ title: `Read: ${c.name}`, why: "A short tip from the Hub's mentors." }),
};

export function fixedWording(candidate: Candidate): Words {
  const words = TEMPLATES[candidate.kind](candidate);
  return { title: clipAtWord(words.title, TITLE_MAX), why: clipAtWord(words.why, WHY_MAX) };
}
```

  `lib/coach/plan.ts`:

```ts
import { ACTIONS_A_WEEK, COACH_KINDS, TITLE_MAX, WHY_MAX, type CoachKind } from "./kinds";
import type { Candidate, CoachAction } from "./types";
import { fixedWording } from "./wording";

// The fixed week (AI round two spec 4; I1 planning decision 2): the first candidate of each kind in the catalogue's
// order, three at most, in fixed wording. Stage I2's model path falls back to it. Pure.

export function planWeek(candidates: readonly Candidate[], asOf: string): CoachAction[] {
  const seen = new Set<CoachKind>();
  const picked: Candidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.kind) || picked.length === ACTIONS_A_WEEK) continue;
    seen.add(candidate.kind);
    picked.push(candidate);
  }
  return picked.map((candidate) => ({ ...candidate, ...fixedWording(candidate), asOf }));
}

const KINDS: readonly string[] = COACH_KINDS;
const TARGETS = ["shop", "listing", "request", "post"];
const isText = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && Array.from(v).length <= max;

/** Stored actions read back (Supabase's jsonb, or anything else): null unless every one has the shape. */
export function asCoachActions(value: unknown): CoachAction[] | null {
  if (!Array.isArray(value) || value.length > ACTIONS_A_WEEK) return null;
  for (const a of value) {
    if (typeof a !== "object" || a === null) return null;
    const { id, kind, target, name, evidence, href, title, why, asOf } = a as Record<string, unknown>;
    if (typeof id !== "string" || typeof kind !== "string" || !KINDS.includes(kind) || !id.startsWith(`${kind}:`)) return null;
    if (typeof target !== "object" || target === null || !TARGETS.includes(String((target as { type?: unknown }).type))) return null;
    if (name !== null && typeof name !== "string") return null;
    if (typeof evidence !== "object" || evidence === null || Object.values(evidence).some((v) => typeof v !== "number")) return null;
    if (typeof href !== "string" || !href.startsWith("/")) return null;
    if (!isText(title, TITLE_MAX) || !isText(why, WHY_MAX) || typeof asOf !== "string" || Number.isNaN(Date.parse(asOf))) return null;
  }
  return value as CoachAction[];
}
```

- [ ] **Step 4:** `pnpm exec vitest run lib/coach` passes; `pnpm typecheck` clean.

### Task 4: Done checks and the progress lines

**Files:** Create `lib/coach/done.ts`, `lib/coach/done.test.ts`.

- [ ] **Step 1: Failing test** (`lib/coach/done.test.ts`). Make a `live(changes)` helper. Cover each kind's done, open and gone:

```ts
import { describe, expect, it } from "vitest";
import { actionState, lastWeekLine, progressLine, progressOf, settledIds } from "./done";
import type { CoachAction, LiveFacts } from "./types";

const AS_OF = "2026-11-09T03:00:00.000Z";
const action = (id: string, evidence: CoachAction["evidence"] = {}): CoachAction => {
  const [kind, target] = id.split(":");
  return {
    id, kind: kind as CoachAction["kind"], evidence, href: "/x", title: "T", why: "W", asOf: AS_OF, name: "N",
    target: { type: target === "shop" ? "shop" : kind === "answer-request" ? "request" : kind.includes("launchpad") || kind === "read-tip" ? "post" : "listing", id: target === "shop" ? null : target },
  };
};
const listing = { state: "available" as const, hidden: false, photos: 1, descriptionChars: 30, priceZar: 450, updatedAt: "2026-10-01T00:00:00.000Z" };
const live = (changes: Partial<LiveFacts> = {}): LiveFacts => ({
  queue: { replies: { count: 0, oldest: null }, sales: [], listings: { available: 1, paused: 0, sold: 0, drafts: 0 } },
  shop: { about: "", hasPhoto: false },
  listings: new Map([["l-1", listing]]),
  offered: new Set(), openRequests: new Set(["r-1"]), booked: new Set(), publishedPosts: new Set(["hp-1", "t-1"]), passedPosts: new Set(),
  ...changes,
});
const none = new Set<string>();

describe("actionState (spec 2.1's Done when; planning decisions 3, 4 and 8)", () => {
  it("reply-waiting: done once nobody waiting since the facts were read is still waiting", () => {
    const a = action("reply-waiting:shop");
    const waiting = (at: string) => live({ queue: { ...live().queue, replies: { count: 1, oldest: { id: "c", title: null, at, state: null } } } });
    expect(actionState(a, waiting("2026-11-08T10:00:00.000Z"), none)).toBe("open");
    expect(actionState(a, waiting("2026-11-09T09:00:00.000Z"), none)).toBe("done");
    expect(actionState(a, live(), none)).toBe("done");
  });
  it("mark-sold: done once no sale from before is waiting", () => {
    const sale = (at: string) => live({ queue: { ...live().queue, sales: [{ conversationId: "c", listingId: "l-1", title: "Lamp", at }] } });
    expect(actionState(action("mark-sold:shop"), sale("2026-11-08T10:00:00.000Z"), none)).toBe("open");
    expect(actionState(action("mark-sold:shop"), sale("2026-11-10T10:00:00.000Z"), none)).toBe("done");
  });
  it("add-photos and say-more: done at two photos or 80 characters; gone when the listing is", () => {
    expect(actionState(action("add-photos:l-1"), live(), none)).toBe("open");
    expect(actionState(action("add-photos:l-1"), live({ listings: new Map([["l-1", { ...listing, photos: 2 }]]) }), none)).toBe("done");
    expect(actionState(action("say-more:l-1"), live({ listings: new Map([["l-1", { ...listing, descriptionChars: 80 }]]) }), none)).toBe("done");
    expect(actionState(action("add-photos:l-1"), live({ listings: new Map() }), none)).toBe("gone");
    expect(actionState(action("say-more:l-1"), live({ listings: new Map([["l-1", { ...listing, state: "sold" }]]) }), none)).toBe("gone");
  });
  it("refresh-quiet: done when edited, sold or removed", () => {
    expect(actionState(action("refresh-quiet:l-1"), live(), none)).toBe("open");
    expect(actionState(action("refresh-quiet:l-1"), live({ listings: new Map([["l-1", { ...listing, updatedAt: "2026-11-10T00:00:00.000Z" }]]) }), none)).toBe("done");
    expect(actionState(action("refresh-quiet:l-1"), live({ listings: new Map([["l-1", { ...listing, state: "sold" }]]) }), none)).toBe("done");
    expect(actionState(action("refresh-quiet:l-1"), live({ listings: new Map() }), none)).toBe("done");
  });
  it("check-price: done below 1.5 times the stored middle, or ticked", () => {
    const a = action("check-price:l-1", { price: 450, middle: 250, similar: 3 });
    expect(actionState(a, live(), none)).toBe("open");
    expect(actionState(a, live({ listings: new Map([["l-1", { ...listing, priceZar: 370 }]]) }), none)).toBe("done");
    expect(actionState(a, live(), new Set([a.id]))).toBe("done");
  });
  it("answer-request: done on an offer, gone when the request closes", () => {
    const a = action("answer-request:r-1");
    expect(actionState(a, live(), none)).toBe("open");
    expect(actionState(a, live({ offered: new Set(["r-1"]) }), none)).toBe("done");
    expect(actionState(a, live({ openRequests: new Set() }), none)).toBe("gone");
  });
  it("list-more and finish-shop: done at 3 available, and with about and photo both", () => {
    expect(actionState(action("list-more:shop"), live({ queue: { ...live().queue, listings: { available: 3, paused: 0, sold: 0, drafts: 0 } } }), none)).toBe("done");
    expect(actionState(action("finish-shop:shop"), live({ shop: { about: "Hi", hasPhoto: false } }), none)).toBe("open");
    expect(actionState(action("finish-shop:shop"), live({ shop: { about: "Hi", hasPhoto: true } }), none)).toBe("done");
  });
  it("go-to-launchpad: done once booked, even after it passed; gone unbooked once passed or unpublished", () => {
    const a = action("go-to-launchpad:hp-1");
    expect(actionState(a, live(), none)).toBe("open");
    expect(actionState(a, live({ booked: new Set(["hp-1"]), passedPosts: new Set(["hp-1"]) }), none)).toBe("done");
    expect(actionState(a, live({ passedPosts: new Set(["hp-1"]) }), none)).toBe("gone");
    expect(actionState(a, live({ publishedPosts: new Set() }), none)).toBe("gone");
  });
  it("read-tip: done only when ticked", () => {
    expect(actionState(action("read-tip:t-1"), live(), none)).toBe("open");
    expect(actionState(action("read-tip:t-1"), live(), new Set(["read-tip:t-1"]))).toBe("done");
  });
});

describe("the lines (spec 2: Last week: 2 of 3 done; planning decision 3)", () => {
  it("leaves gone actions out of the count", () => {
    expect(progressOf(["done", "gone", "open"])).toEqual({ done: 1, total: 2 });
    expect(progressLine({ done: 1, total: 2 })).toBe("1 of 2 done");
    expect(lastWeekLine({ done: 2, total: 3 })).toBe("Last week: 2 of 3 done");
    expect(lastWeekLine({ done: 0, total: 0 })).toBe("Last week: nothing to do");
    expect(lastWeekLine(null)).toBeNull();
  });
  it("settles a week into the ids done and the ids gone, so a settled week counts as a live one does", () => {
    expect(settledIds([action("list-more:shop"), action("read-tip:t-1"), action("say-more:l-1")], ["done", "open", "gone"])).toEqual({
      done: ["list-more:shop"],
      gone: ["say-more:l-1"],
    });
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/coach/done.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/coach/done.ts`:

```ts
import { DESCRIPTION_WANTED, LISTINGS_WANTED, PHOTOS_WANTED, PRICE_RATIO } from "./kinds";
import type { ActionState, CoachAction, LiveFacts } from "./types";

// Whether each action is done (AI round two spec 2.1's "Done when"; I1 planning decisions 3, 4 and 8). Worked out
// live from each action's kind and target, so it's always current. Pure.

const after = (at: string, asOf: string) => Date.parse(at) > Date.parse(asOf);

export function actionState(action: CoachAction, live: LiveFacts, ticks: ReadonlySet<string>): ActionState {
  const id = action.target.id ?? "";
  const listing = live.listings.get(id);
  const listed = listing !== undefined && listing.state === "available" && !listing.hidden;
  switch (action.kind) {
    case "reply-waiting": {
      const oldest = live.queue.replies.oldest;
      return oldest === null || after(oldest.at, action.asOf) ? "done" : "open";
    }
    case "mark-sold":
      return live.queue.sales.some((sale) => !after(sale.at, action.asOf)) ? "open" : "done";
    case "add-photos":
      if (!listed) return "gone";
      return listing.photos >= PHOTOS_WANTED ? "done" : "open";
    case "say-more":
      if (!listed) return "gone";
      return listing.descriptionChars >= DESCRIPTION_WANTED ? "done" : "open";
    case "refresh-quiet":
      if (!listing || listing.state === "sold" || after(listing.updatedAt, action.asOf)) return "done";
      return listed ? "open" : "gone";
    case "check-price": {
      if (ticks.has(action.id)) return "done";
      if (!listed) return "gone";
      const middle = action.evidence.middle ?? 0;
      return listing.priceZar !== null && listing.priceZar < PRICE_RATIO * middle ? "done" : "open";
    }
    case "answer-request":
      if (live.offered.has(id)) return "done";
      return live.openRequests.has(id) ? "open" : "gone";
    case "list-more":
      return live.queue.listings.available >= LISTINGS_WANTED ? "done" : "open";
    case "finish-shop":
      return live.shop.about.trim() && live.shop.hasPhoto ? "done" : "open";
    case "go-to-launchpad":
      if (live.booked.has(id)) return "done";
      return live.publishedPosts.has(id) && !live.passedPosts.has(id) ? "open" : "gone";
    case "read-tip":
      if (ticks.has(action.id)) return "done";
      return live.publishedPosts.has(id) ? "open" : "gone";
  }
}

export type Progress = { done: number; total: number };

/** Gone actions are left out (decision 3). */
export function progressOf(states: readonly ActionState[]): Progress {
  return { done: states.filter((s) => s === "done").length, total: states.filter((s) => s !== "gone").length };
}

export function progressLine({ done, total }: Progress): string {
  return `${done} of ${total} done`;
}

/** Under the actions (spec 2). Null when there was no week before. */
export function lastWeekLine(progress: Progress | null): string | null {
  if (progress === null) return null;
  return progress.total === 0 ? "Last week: nothing to do" : `Last week: ${progressLine(progress)}`;
}

/**
 * What a settled week stores (decision 10): the ids done and the ids gone, so its "N of M" leaves gone actions out as a
 * live week's does (Task 7's settledProgress reads both).
 */
export function settledIds(actions: readonly CoachAction[], states: readonly ActionState[]): { done: string[]; gone: string[] } {
  return {
    done: actions.filter((_, i) => states[i] === "done").map((a) => a.id),
    gone: actions.filter((_, i) => states[i] === "gone").map((a) => a.id),
  };
}
```

- [ ] **Step 4:** test passes; `pnpm typecheck` clean.

### Task 5: Where weeks are stored (sample store, migration, pgTAP)

**Files:** Modify `lib/data/rows.ts`, `lib/data/store.ts`, `lib/supabase/database.types.ts`. Create `supabase/migrations/20261107120000_shop_coach.sql`, `supabase/tests/67_shop_coach.test.sql`.

- [ ] **Step 1: Rows** (`lib/data/rows.ts`, a new block at the end):

```ts
// --- Shop coach (AI stage I1) ---------------------------------------------------------------------------------------

/** One shop's week (AI round two spec 4), keyed `${ownerId}:${week}` in the sample store (I1 planning decision 14). */
export type CoachWeekRow = {
  ownerId: string;
  /** The SAST Monday, YYYY-MM-DD. */
  week: string;
  actions: CoachAction[];
  /** Two questions for the shop's mentor (stage I2), or null. Staff only: never in the download. */
  mentorQuestions: [string, string] | null;
  writtenBy: "model" | "fixed";
  /** Set together when the week is settled (planning decision 10). */
  doneIds: string[] | null;
  goneIds: string[] | null;
  settledAt: string | null;
  createdAt: string;
};

/** A seller's tick (spec 4), keyed `${ownerId}:${week}:${actionId}`. */
export type CoachTickRow = { ownerId: string; week: string; actionId: string; createdAt: string };
```

  Import `CoachAction` as a type from `@/lib/coach/types`.
- [ ] **Step 2: The store.**
  - `SampleStore` gains `coachWeeks: Map<string, CoachWeekRow>` and `coachTicks: Map<string, CoachTickRow>`, each with a one-line comment.
  - `seedStore()` gives both `new Map()`.
  - `STORE_VERSION = 19`, with the note line `* 19: Shop coach's weeks and ticks (`coachWeeks`, `coachTicks`, AI stage I1).`
  - If G's 18 isn't merged yet when you get here, stop and tell the controller: the numbers must stay in order.
- [ ] **Step 3: The migration** `supabase/migrations/20261107120000_shop_coach.sql`:

```sql
-- Shop coach, stage I1 (AI round two spec 2 and 4; plan 2026-11-04-ai-stage-i1-shop-coach-core.md, Task 5).
-- 1. public.coach_weeks: one row per shop per SAST week (its Monday): up to three actions (jsonb, checked by the app's
--    asCoachActions on read), the mentor's two questions (stage I2; staff only), who wrote it ('model' or 'fixed'), and,
--    once settled, the ids done and gone (planning decision 10). Deleting the shop deletes its weeks.
-- 2. public.coach_ticks: the seller's ticks, per week and action id; deleting the week deletes them.
-- 3. Row level security on, no grants to anon or authenticated, so no API role reads either table directly. Reads go
--    through public.own_coach_weeks (the owner; never the mentor questions) and public.staff_coach_weeks
--    (private.can_mentor's rule; read from stage I2). The service role writes weeks; a tick is
--    public.tick_coach_action, with the seller's own session, owner-gated (planning decision 13).

create table public.coach_weeks (
  shop_id uuid not null references public.shops (id) on delete cascade,
  week date not null check (extract(isodow from week) = 1),
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) <= 3),
  mentor_questions jsonb check (
    mentor_questions is null or (
      jsonb_typeof(mentor_questions) = 'array'
      and jsonb_array_length(mentor_questions) = 2
      and jsonb_typeof(mentor_questions -> 0) = 'string'
      and jsonb_typeof(mentor_questions -> 1) = 'string'
      and char_length(mentor_questions ->> 0) between 1 and 140
      and char_length(mentor_questions ->> 1) between 1 and 140
    )
  ),
  written_by text not null check (written_by in ('model', 'fixed')),
  done_ids text[],
  gone_ids text[],
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (shop_id, week),
  constraint coach_weeks_settled check ((done_ids is null) = (settled_at is null) and (gone_ids is null) = (settled_at is null))
);
create index coach_weeks_week_idx on public.coach_weeks (week);

create table public.coach_ticks (
  shop_id uuid not null,
  week date not null,
  action_id text not null check (char_length(action_id) between 3 and 120),
  created_at timestamptz not null default now(),
  primary key (shop_id, week, action_id),
  foreign key (shop_id, week) references public.coach_weeks (shop_id, week) on delete cascade
);

alter table public.coach_weeks enable row level security;
alter table public.coach_ticks enable row level security;
revoke all on table public.coach_weeks, public.coach_ticks from public, anon, authenticated, service_role;
grant all on table public.coach_weeks, public.coach_ticks to service_role;
-- No policies: no grants to anon or authenticated (the advisor's INFO finding 0008, rls_enabled_no_policy, lists both
-- on purpose, as featured_draws).

-- The SAST Monday of a time (Africa/Johannesburg, no daylight saving).
create function private.coach_week_of(at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', (at at time zone 'Africa/Johannesburg'))::date;
$$;

-- The signed-in owner's weeks from p_since on, newest first, with that week's ticks. Never the mentor questions.
-- A user read (advisor 0029 lists it on purpose).
create function public.own_coach_weeks(p_since date)
returns table (
  week date, actions jsonb, written_by text, done_ids text[], gone_ids text[], settled_at timestamptz,
  created_at timestamptz, ticks text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week, w.actions, w.written_by, w.done_ids, w.gone_ids, w.settled_at, w.created_at,
    coalesce((select array_agg(t.action_id order by t.action_id) from public.coach_ticks t
      where t.shop_id = w.shop_id and t.week = w.week), '{}')
  from public.coach_weeks w
  join public.shops s on s.id = w.shop_id
  where s.owner_id = (select auth.uid()) and w.week >= coalesce(p_since, '-infinity'::date)
  order by w.week desc;
$$;

-- A shop's weeks from p_since on, for its mentor (still holding the role) or an admin, never its owner
-- (private.can_mentor), with the mentor questions and the ticks. Read from stage I2's mentor page.
create function public.staff_coach_weeks(p_shop uuid, p_since date)
returns table (
  week date, actions jsonb, mentor_questions jsonb, written_by text, done_ids text[], gone_ids text[],
  settled_at timestamptz, created_at timestamptz, ticks text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week, w.actions, w.mentor_questions, w.written_by, w.done_ids, w.gone_ids, w.settled_at, w.created_at,
    coalesce((select array_agg(t.action_id order by t.action_id) from public.coach_ticks t
      where t.shop_id = w.shop_id and t.week = w.week), '{}')
  from public.coach_weeks w
  join public.shops s on s.id = w.shop_id
  where w.shop_id = p_shop and w.week >= coalesce(p_since, '-infinity'::date)
    and private.can_mentor(s.owner_id)
  order by w.week desc;
$$;

-- The signed-in seller ticks one of this SAST week's actions of a kind only the seller can tick (spec 2.1:
-- check-price's "Kept on purpose", read-tip). 'ticked', 'already', or 'not-found' (no shop, no week, no such action,
-- another kind). A user action.
create function public.tick_coach_action(p_action text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_week date := private.coach_week_of(now());
begin
  select s.id into v_shop from public.shops s where s.owner_id = (select auth.uid());
  if v_shop is null or p_action is null or p_action !~ '^(check-price|read-tip):' then
    return 'not-found';
  end if;
  if not exists (
    select 1 from public.coach_weeks w, jsonb_array_elements(w.actions) a(x)
    where w.shop_id = v_shop and w.week = v_week and a.x ->> 'id' = p_action
  ) then
    return 'not-found';
  end if;
  insert into public.coach_ticks (shop_id, week, action_id) values (v_shop, v_week, p_action)
  on conflict do nothing;
  return case when found then 'ticked' else 'already' end;
end;
$$;

revoke all on function private.coach_week_of(timestamptz) from public, anon, authenticated;
grant execute on function private.coach_week_of(timestamptz) to authenticated, service_role;
revoke all on function public.own_coach_weeks(date), public.staff_coach_weeks(uuid, date),
  public.tick_coach_action(text) from public, anon, authenticated;
grant execute on function public.own_coach_weeks(date), public.staff_coach_weeks(uuid, date),
  public.tick_coach_action(text) to authenticated, service_role;
```

  Before writing it, check three things and adjust:
  - **`private.owns_shop(uuid)`:** if it exists (the seller-queue migration uses it), use it in `own_coach_weeks` and `tick_coach_action` instead of comparing `owner_id`.
  - **One shop per owner:** confirm a profile can have only one shop (`shops_owner_id_idx` isn't unique). If it can have more, pick the shop through `seller_profiles.shop_id`.
  - **`found` after `on conflict do nothing`:** it is false when nothing was inserted. Confirm this in pgTAP rather than relying on memory.
- [ ] **Step 4: pgTAP** `supabase/tests/67_shop_coach.test.sql`.
  - **The frame:** copy `63_report_read.test.sql`'s (`begin; select plan(N);`, the `pg_temp.a`/`s`/`sign_in`/`sign_out`/`as_service` helpers, and `rollback`), with its own campus `sc-campus` and category `sc-category`.
  - **Seed:**
    - Profiles: `f1` Lerato, who sells; `f2` Thandi, a student; `f3` Musa, a mentor with role `{mentor}`, assigned as `f1`'s mentor (`seller_profiles.mentor_id`); `f4` Adam, an admin; `f5` Sipho, another mentor, not assigned.
    - `f1`'s shop, approved.
    - Two weeks for it, as the service role: this week (`private.coach_week_of(now())`), with a `read-tip:t-1`, a `check-price:l-1` and a `list-more:shop` action and two mentor questions; and last week, settled.
  - **Assertions:**
  1. Both tables exist with RLS on (`has_table`, and `relrowsecurity` from `pg_class`).
  2. `not has_table_privilege('authenticated', 'public.coach_weeks', 'select')`, the same for `anon` and for `coach_ticks`.
  3. The checks raise `23514`: a week that isn't a Monday, four actions, `written_by = 'robot'`, one mentor question, and `done_ids` without `settled_at`.
  4. As `f1`: `own_coach_weeks(null)` gives 2 rows, newest first, and its result has no `mentor_questions` column. Check `pg_get_function_result('public.own_coach_weeks(date)'::regprocedure) !~ 'mentor_questions'`.
  5. As `f2`: `own_coach_weeks(null)` gives 0 rows. As anon (`sign_out()`): executing it throws `42501`.
  6. `staff_coach_weeks(shop, null)`: as `f3` 2 rows with the questions; as `f4` 2 rows; as `f5` 0; as `f1` 0, even after giving `f1` the admin role in the test (`can_mentor`'s owner rule).
  7. As `f1`, `tick_coach_action`:
     - `'read-tip:t-1'` is `'ticked'`, then `'already'`.
     - `'list-more:shop'` is `'not-found'`.
     - Last week's `'read-tip:t-0'` is `'not-found'`.
     - As `f2`, `'read-tip:t-1'` is `'not-found'`.
     - `own_coach_weeks` then shows the tick on this week's row.
  8. Deleting the shop (as the service role) deletes both weeks and the tick.
  9. With a fresh seed row, `public.forget_account(pg_temp.a('f1'))` as the service role leaves no `coach_weeks` row for that shop.
- [ ] **Step 5: Types.** Hand-edit `lib/supabase/database.types.ts`:
  - **Tables:** add `coach_weeks` and `coach_ticks` (`Row`, `Insert`, `Update`, `Relationships`), each in alphabetical place.
  - **Functions:** add `own_coach_weeks`, `staff_coach_weeks` and `tick_coach_action`.
  - The controller regenerates the file with `pnpm db:types` and diffs it.
- [ ] **Step 6:** `pnpm typecheck` clean; `pnpm exec vitest run lib/data/store.test.ts` passes. **Don't run** `supabase` or `pnpm test:db`.

### Task 6: The data layer (both backends)

**Files:**
- Create `lib/data/coach.ts`, `lib/data/supabase/coach.ts`, `lib/data/coach-facts.ts`, `lib/data/supabase/coach-facts.ts`, and `lib/data/contract/coach.contract.ts` (+ `.test.ts`, `.db.test.ts`, copying the shape of `lib/data/contract/requests-own.*`).
- Modify `lib/data/shop-stats.ts` and `lib/data/supabase/shop-stats.ts`.

- [ ] **Step 1: The counting's rows, exported.**
  - In `lib/data/shop-stats.ts` add:

```ts
/** The shop's conversations as the counting reads them (Shop coach's quiet listings read them; AI stage I1). */
export async function shopConversations(sellerSlug: string): Promise<CountedConversation[]> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).shopConversations(sellerSlug);
  return rowsOf(sellerSlug);
}
```

  - In the twin add `export const shopConversations: typeof Sample.shopConversations = (slug) => conversationsOfSlug(slug);`.
  - No other change.
- [ ] **Step 2: Failing contract** (`lib/data/contract/coach.contract.ts`), on the World (`tests/contract/world.ts`):

```ts
import { afterEach, beforeEach, expect, it } from "vitest";
import { coachWeekOf, previousWeek } from "@/lib/coach/week";
import type { CoachAction } from "@/lib/coach/types";
import { exportCoach, readOwnCoachWeeks, saveCoachWeek, settleCoachWeek, tickCoachAction } from "@/lib/data/coach";
import { liveFacts, shopFacts } from "@/lib/data/coach-facts";
import type { World } from "@/tests/contract/world";

// Shop coach's storage and facts (AI stage I1, Task 6), the same in both backends. coach.test.ts runs it on the sample
// store, coach.db.test.ts on the local stack.

const action = (id: string, asOf: string): CoachAction => ({
  id, kind: id.split(":")[0] as CoachAction["kind"], target: { type: "post", id: id.split(":")[1] }, name: "A tip",
  evidence: {}, href: "/hub/x", title: "Read: A tip", why: "A short tip.", asOf,
});

export function coachContract(makeWorld: () => World): void {
  let world: World;
  let seller: string;
  let other: string;
  let slug: string;
  const now = new Date();
  const week = coachWeekOf(now);
  beforeEach(async () => {
    world = makeWorld();
    await world.tidySelling("seller");
    seller = await world.signedIn("seller");
    other = await world.signedIn("shopper");
    slug = await world.openShop("seller");
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const save = (w: string, actions: CoachAction[]) =>
    saveCoachWeek(slug, { week: w, actions, writtenBy: "fixed", mentorQuestions: null }, now);

  it("stores a week once and gives it only to its owner, without mentor questions", async () => {
    expect(await save(week, [action("read-tip:t-1", now.toISOString())])).toBe(true);
    expect(await save(week, [])).toBe(false);
    const [mine] = await readOwnCoachWeeks(seller, slug, previousWeek(week));
    expect(mine).toMatchObject({ week, writtenBy: "fixed", doneIds: null, goneIds: null, ticks: [] });
    expect(mine.actions.map((a) => a.id)).toEqual(["read-tip:t-1"]);
    expect(mine).not.toHaveProperty("mentorQuestions");
    expect(await readOwnCoachWeeks(other, slug, previousWeek(week))).toEqual([]);
  });

  it("ticks this week's seller-ticked actions only, once", async () => {
    await save(week, [action("read-tip:t-1", now.toISOString()), { ...action("list-more:shop", now.toISOString()), target: { type: "shop", id: null } }]);
    expect(await tickCoachAction(seller, slug, "read-tip:t-1", now)).toBe("ticked");
    expect(await tickCoachAction(seller, slug, "read-tip:t-1", now)).toBe("already");
    expect(await tickCoachAction(seller, slug, "list-more:shop", now)).toBe("not-found");
    expect(await tickCoachAction(other, slug, "read-tip:t-1", now)).toBe("not-found");
    expect((await readOwnCoachWeeks(seller, slug, week))[0].ticks).toEqual(["read-tip:t-1"]);
  });

  it("settles a week once", async () => {
    await save(previousWeek(week), [action("read-tip:t-0", now.toISOString())]);
    expect(await settleCoachWeek(slug, previousWeek(week), { done: ["read-tip:t-0"], gone: [] }, now)).toBe(true);
    expect(await settleCoachWeek(slug, previousWeek(week), { done: [], gone: [] }, now)).toBe(false);
    expect((await readOwnCoachWeeks(seller, slug, previousWeek(week)))[0].doneIds).toEqual(["read-tip:t-0"]);
  });

  it("gives the owner's weeks to the data download, never mentor questions", async () => {
    await saveCoachWeek(slug, { week, actions: [action("read-tip:t-1", now.toISOString())], writtenBy: "model", mentorQuestions: ["How did the photos go?", "What sold?"] }, now);
    const exported = await exportCoach(seller);
    expect(exported).toEqual([{ week, writtenBy: "model", actions: [{ kind: "read-tip", title: "Read: A tip", why: "A short tip.", ticked: false, doneWhenWeekEnded: null }] }]);
    expect(JSON.stringify(exported)).not.toContain("What sold?");
  });

  it("reads a shop's facts and live facts the same way", async () => {
    const id = await world.addListing(slug, { title: "Contract lamp", categorySlug: "tech", description: "Short." });
    const queue = { replies: { count: 0, oldest: null }, sales: [], listings: { available: 1, paused: 0, sold: 0, drafts: 0 } };
    const facts = await shopFacts({ slug, ownerId: seller }, queue, now, []);
    expect(facts.listings.find((l) => l.id === id)).toMatchObject({ descriptionChars: 6, lastEnquiryAt: null });
    const live = await liveFacts({ slug, ownerId: seller }, [{ ...action(`say-more:${id}`, now.toISOString()), target: { type: "listing", id } }], queue, now);
    expect(live.listings.get(id)).toMatchObject({ state: "available", descriptionChars: 6 });
  });
}
```

  As you write, check the World's real verbs and options: `openShop`'s return, `addListing`'s fields (`description`, a photo count?), `tidySelling`. `coach.test.ts` runs `coachContract(sampleWorld)`. `coach.db.test.ts` runs it on `supabaseWorld` with the `withViewerSeam` mock line `requests-own.db.test.ts` has, since `readOwnCoachWeeks`, `tickCoachAction` and `exportCoach` use the viewer's session on Supabase.
- [ ] **Step 3:** `pnpm exec vitest run lib/data/contract/coach.test.ts` → FAIL.
- [ ] **Step 4: Implement** `lib/data/coach.ts`:

```ts
import { onSupabase } from "@/lib/backend";
import { SELLER_TICKED } from "@/lib/coach/kinds";
import type { CoachAction, CoachWeek } from "@/lib/coach/types";
import { coachWeekOf } from "@/lib/coach/week";
import { sampleStore } from "./store";

// Shop coach's weeks and ticks (AI round two spec 4; I1 plan Task 6). Request-time only, never inside "use cache".
// The sample store keys a shop's weeks by its owner (planning decision 14); Supabase by shop, read through the
// owner-only own_coach_weeks with the viewer's session, written with the admin client. Mentor questions never leave
// this module towards a seller: readOwnCoachWeeks and exportCoach leave them out.

const supabase = () => import("./supabase/coach");

export type NewCoachWeek = Pick<CoachWeek, "week" | "actions" | "writtenBy"> & { mentorQuestions: [string, string] | null };
export type TickResult = "ticked" | "already" | "not-found";

const ownerOf = (slug: string) => sampleStore().sellers.get(slug)?.ownerId ?? null;
const weekKey = (ownerId: string, week: string) => `${ownerId}:${week}`;

function ticksOf(ownerId: string, week: string): string[] {
  return [...sampleStore().coachTicks.values()]
    .filter((t) => t.ownerId === ownerId && t.week === week)
    .map((t) => t.actionId)
    .sort();
}

/** The signed-in owner's weeks from `since` (a Monday) on, newest first. Never the mentor questions. */
export async function readOwnCoachWeeks(accountId: string, sellerSlug: string, since: string): Promise<CoachWeek[]> {
  if (onSupabase()) return (await supabase()).readOwnCoachWeeks(accountId, sellerSlug, since);
  if (ownerOf(sellerSlug) !== accountId) return [];
  return [...sampleStore().coachWeeks.values()]
    .filter((row) => row.ownerId === accountId && row.week >= since)
    .sort((a, b) => b.week.localeCompare(a.week))
    .map(({ week, actions, writtenBy, doneIds, goneIds, settledAt, createdAt }) => ({
      week, actions: structuredClone(actions), writtenBy, doneIds, goneIds, settledAt, createdAt, ticks: ticksOf(accountId, week),
    }));
}

/** Stores a week unless the shop has one (the cron and the lazy path race safely). True when this call stored it. */
export async function saveCoachWeek(sellerSlug: string, week: NewCoachWeek, now: Date): Promise<boolean> {
  if (onSupabase()) return (await supabase()).saveCoachWeek(sellerSlug, week, now);
  const ownerId = ownerOf(sellerSlug);
  if (!ownerId) return false;
  const key = weekKey(ownerId, week.week);
  if (sampleStore().coachWeeks.has(key)) return false;
  sampleStore().coachWeeks.set(key, {
    ownerId, week: week.week, actions: structuredClone(week.actions), mentorQuestions: week.mentorQuestions,
    writtenBy: week.writtenBy, doneIds: null, goneIds: null, settledAt: null, createdAt: now.toISOString(),
  });
  return true;
}

/** Settles a week once (planning decision 10). True when this call settled it. */
export async function settleCoachWeek(sellerSlug: string, week: string, ids: { done: string[]; gone: string[] }, now: Date): Promise<boolean> {
  if (onSupabase()) return (await supabase()).settleCoachWeek(sellerSlug, week, ids, now);
  const ownerId = ownerOf(sellerSlug);
  const row = ownerId ? sampleStore().coachWeeks.get(weekKey(ownerId, week)) : undefined;
  if (!row || row.settledAt) return false;
  Object.assign(row, { doneIds: [...ids.done], goneIds: [...ids.gone], settledAt: now.toISOString() });
  return true;
}

/** The seller ticks one of this week's actions of a kind only they can tick (planning decision 13). */
export async function tickCoachAction(accountId: string, sellerSlug: string, actionId: string, now: Date): Promise<TickResult> {
  if (onSupabase()) return (await supabase()).tickCoachAction(actionId);
  if (ownerOf(sellerSlug) !== accountId) return "not-found";
  const week = coachWeekOf(now);
  const row = sampleStore().coachWeeks.get(weekKey(accountId, week));
  const action = row?.actions.find((a) => a.id === actionId);
  if (!action || !SELLER_TICKED.has(action.kind)) return "not-found";
  const key = `${accountId}:${week}:${actionId}`;
  if (sampleStore().coachTicks.has(key)) return "already";
  sampleStore().coachTicks.set(key, { ownerId: accountId, week, actionId, createdAt: now.toISOString() });
  return "ticked";
}

export type CoachExport = {
  week: string;
  writtenBy: "model" | "fixed";
  actions: { kind: CoachAction["kind"]; title: string; why: string; ticked: boolean; doneWhenWeekEnded: boolean | null }[];
};

/** Every week of the account's own shop, newest first: on Supabase own_coach_weeks(null) with the viewer's session. */
async function everyOwnWeek(accountId: string): Promise<CoachWeek[]> {
  if (onSupabase()) return (await supabase()).everyOwnWeek();
  const slug = [...sampleStore().sellers.values()].find((shop) => shop.ownerId === accountId)?.slug;
  return slug ? readOwnCoachWeeks(accountId, slug, "0000-01-01") : [];
}

/** The account's shop's weeks for its data download (planning decision 17), newest first. No mentor questions. */
export async function exportCoach(accountId: string): Promise<CoachExport[]> {
  return (await everyOwnWeek(accountId)).map((w) => ({
    week: w.week,
    writtenBy: w.writtenBy,
    actions: w.actions.map((a) => ({
      kind: a.kind, title: a.title, why: a.why, ticked: w.ticks.includes(a.id),
      doneWhenWeekEnded: w.doneIds === null ? null : w.doneIds.includes(a.id),
    })),
  }));
}

/** Deleting an account (sample store): its shop's weeks and ticks. On Supabase the shops cascade does it. */
export function forgetCoachOf(accountId: string): void {
  const { coachWeeks, coachTicks } = sampleStore();
  for (const [key, row] of coachWeeks) if (row.ownerId === accountId) coachWeeks.delete(key);
  for (const [key, row] of coachTicks) if (row.ownerId === accountId) coachTicks.delete(key);
}
```

  `CoachWeek` gains `goneIds` (from Task 4's change). The Supabase twin (`lib/data/supabase/coach.ts`, `import "server-only"`) does the following:
  - **`readOwnCoachWeeks`:** `(await forViewer()).rpc("own_coach_weeks", { p_since: since })`. Each row's `actions` goes through `asCoachActions`, and a row that fails it is dropped with a `console.warn` naming the week only. `everyOwnWeek` is the same call with `p_since: null`.
  - **`saveCoachWeek`:** finds the shop id by slug with `forServer()`, then `forServer().from("coach_weeks").upsert({ shop_id, week, actions, mentor_questions, written_by }, { onConflict: "shop_id,week", ignoreDuplicates: true }).select("week")`, and answers `data.length === 1`.
  - **`settleCoachWeek`:** `forServer().from("coach_weeks").update({ done_ids, gone_ids, settled_at }).eq("shop_id", id).eq("week", week).is("settled_at", null).select("week")`, and answers `data.length === 1`.
  - **`tickCoachAction`:** `(await forViewer()).rpc("tick_coach_action", { p_action: actionId })`. Map its text to `TickResult`; anything else throws.
  - **Errors:** each throws `new Error(\`${what} failed (${error.code ?? "unknown"})\`)`, as `supabase/seller-queue.ts` does.

  `lib/data/coach-facts.ts`:

```ts
import { onSupabase } from "@/lib/backend";
import type { CoachAction, FactListing, LiveFacts, LiveListing, ShopFacts } from "@/lib/coach/types";
import { matchRequests } from "@/lib/looking-for/match";
import { requestOpenOn } from "@/lib/looking-for/rules";
import { hasPassed } from "@/lib/hub";
import { sastDate } from "@/lib/time";
import type { SellerQueue } from "@/lib/types";
import { getHubPost, getHubPosts, getRequest, getSellerListings, searchListings } from "./index";
import { findOffer } from "./offers";
import { requestMatchCandidates } from "./request-match";
import { NAMES } from "./saved-searches";
import { shopConversations } from "./shop-stats";
import { sampleStore } from "./store";

// The facts Shop coach plans a week from and works its done states out from (AI round two spec 2.1 and 4; I1 plan
// Task 6). Through existing readers wherever one exists: the queue comes from the caller (queueFor for the signed-in
// seller), conversations from the counting (shopConversations), similar prices from Browse's searchListings, requests
// from stage G's matcher, posts from the Launchpad's cached readers. Only what the owner's own rows hold (photo counts,
// descriptions, the shop's about and photo, the owner's bookings) is read here, from the store or, on Supabase, with the
// admin client: request-time only, and only the numbers leave the server. Never a buyer's name or a message's text.

export type CoachShop = { slug: string; ownerId: string };
type Queue = Pick<SellerQueue, "replies" | "sales" | "listings">;

const supabase = () => import("./supabase/coach-facts");

/** What the owner's own rows hold: the shop's about and photo, and its listings (any state) as the rules read them. */
export type OwnRows = {
  shop: { campusSlug: string; categorySlug: string; about: string; hasPhoto: boolean };
  listings: (LiveListing & { id: string; title: string; categorySlug: string; priceIsFrom: boolean })[];
};

async function ownRows(slug: string): Promise<OwnRows | null> {
  if (onSupabase()) return (await supabase()).ownRows(slug);
  const { sellers, listings } = sampleStore();
  const shop = sellers.get(slug);
  if (!shop) return null;
  return {
    shop: {
      campusSlug: shop.campusSlug,
      categorySlug: shop.categorySlug,
      about: shop.about,
      hasPhoto: shop.image !== null && !shop.image.src.startsWith("/placeholders/"),
    },
    listings: [...listings.values()]
      .filter((row) => row.sellerSlug === slug)
      .map((row) => ({
        id: row.id, title: row.title, categorySlug: row.categorySlug, state: row.state, hidden: Boolean(row.hiddenAt),
        priceZar: row.priceZar, priceIsFrom: row.priceIsFrom, photos: row.photos.length,
        descriptionChars: Array.from(row.description).length, updatedAt: row.updatedAt,
      })),
  };
}

/** The posts the owner has an RSVP or a slot request for, any state, among `postIds` (planning decision 8). */
export async function bookedPosts(ownerId: string, postIds: readonly string[]): Promise<Set<string>> {
  if (onSupabase()) return (await supabase()).bookedPosts(ownerId, postIds);
  const wanted = new Set(postIds);
  const { hubRsvps, hubBookings } = sampleStore();
  return new Set([
    ...[...hubRsvps.values()].filter((r) => r.accountId === ownerId && wanted.has(r.postId)).map((r) => r.postId),
    ...[...hubBookings.values()].filter((b) => b.accountId === ownerId && wanted.has(b.postId)).map((b) => b.postId),
  ]);
}

/** Similar listings' prices (planning decision 6): Browse's own search on the title and category, every campus. */
async function similarPrices(listing: { id: string; title: string; categorySlug: string }, slug: string): Promise<number[]> {
  const { items } = await searchListings({ q: listing.title, category: listing.categorySlug, campus: "all", price: null, pay: null, deals: null, sort: "match" });
  return items
    .filter((l) => l.id !== listing.id && l.sellerSlug !== slug && l.priceZar !== null && l.priceZar > 0 && !l.priceIsFrom)
    .map((l) => l.priceZar!);
}

/** What a week is planned from (spec 2.1). `tickedTips`: tips ticked in the last 12 weeks. Throws for an unknown shop. */
export async function shopFacts(shop: CoachShop, queue: Queue, now: Date, tickedTips: readonly string[]): Promise<ShopFacts> {
  const today = sastDate(now);
  const own = await ownRows(shop.slug);
  if (!own) throw new Error("shopFacts: no such shop");
  const listed = own.listings.filter((l) => l.state === "available" && !l.hidden);
  const [conversations, publicListings, candidates, upcoming, tips] = await Promise.all([
    shopConversations(shop.slug),
    getSellerListings(shop.slug),
    requestMatchCandidates(own.shop.campusSlug, today),
    getHubPosts({ kinds: ["event", "office-hours"], from: today }),
    getHubPosts({ kinds: ["tip"], from: today }),
  ]);
  const lastEnquiry = new Map<string, string>();
  for (const row of conversations) {
    if (row.listingId === null || row.requestId) continue;
    if ((lastEnquiry.get(row.listingId) ?? "") < row.createdAt) lastEnquiry.set(row.listingId, row.createdAt);
  }
  const listings: FactListing[] = await Promise.all(
    listed.map(async (l) => ({
      id: l.id, title: l.title, categorySlug: l.categorySlug, priceZar: l.priceZar, priceIsFrom: l.priceIsFrom,
      photos: l.photos, descriptionChars: l.descriptionChars, updatedAt: l.updatedAt,
      lastEnquiryAt: lastEnquiry.get(l.id) ?? null,
      similarPrices: l.priceZar !== null && l.priceZar > 0 && !l.priceIsFrom ? await similarPrices(l, shop.slug) : [],
    })),
  );
  // answer-request (planning decision 7): G's matcher on each listing, then the shop's own category.
  const names = { sellers: new Map(publicListings.map((l) => [l.sellerSlug, l.sellerName])), categories: NAMES.categories };
  const paired = new Map<string, { id: string; title: string; via: "listing" | "category"; score: number }>();
  for (const listing of publicListings) {
    for (const match of matchRequests(listing, candidates, names, shop.ownerId)) {
      const kept = paired.get(match.id);
      if (!kept || kept.score < match.score) paired.set(match.id, { id: match.id, title: match.title, via: "listing", score: match.score });
    }
  }
  for (const candidate of candidates) {
    if (!paired.has(candidate.id) && candidate.askerId !== shop.ownerId && candidate.query.category === own.shop.categorySlug) {
      paired.set(candidate.id, { id: candidate.id, title: candidate.title, via: "category", score: -1 });
    }
  }
  const offered = await Promise.all([...paired.keys()].map(async (id) => [id, await findOffer(id, shop.slug)] as const));
  const requests = [...paired.values()]
    .filter((r) => offered.find(([id]) => id === r.id)?.[1] === null)
    .sort((a, b) => (a.via === b.via ? b.score - a.score : a.via === "listing" ? -1 : 1))
    .map(({ id, title, via }) => ({ id, title, via }));
  const posts = [...upcoming, ...tips].map((p) => ({
    id: p.id, kind: p.kind as "event" | "office-hours" | "tip", title: p.title, campusSlug: p.campusSlug, startsAt: p.startsAt, publishedAt: p.publishedAt,
  }));
  const booked = await bookedPosts(shop.ownerId, upcoming.map((p) => p.id));
  return {
    asOf: now.toISOString(),
    shop: { slug: shop.slug, ...own.shop },
    queue,
    listings,
    requests,
    posts,
    booked: [...booked],
    tickedTips,
  };
}

/** What done states are worked out from, for these actions (spec 4: live). */
export async function liveFacts(shop: CoachShop, actions: readonly CoachAction[], queue: Queue, now: Date): Promise<LiveFacts> {
  const today = sastDate(now);
  const ids = (type: string) => [...new Set(actions.filter((a) => a.target.type === type && a.target.id).map((a) => a.target.id!))];
  const [own, booked, requests, posts, offers] = await Promise.all([
    ownRows(shop.slug),
    bookedPosts(shop.ownerId, ids("post")),
    Promise.all(ids("request").map(async (id) => [id, await getRequest(id)] as const)),
    Promise.all(ids("post").map(async (id) => [id, await getHubPost(id)] as const)),
    Promise.all(ids("request").map(async (id) => [id, await findOffer(id, shop.slug)] as const)),
  ]);
  return {
    queue,
    shop: { about: own?.shop.about ?? "", hasPhoto: own?.shop.hasPhoto ?? false },
    listings: new Map((own?.listings ?? []).map(({ id, state, hidden, photos, descriptionChars, priceZar, updatedAt }) => [id, { state, hidden, photos, descriptionChars, priceZar, updatedAt }])),
    offered: new Set(offers.filter(([, thread]) => thread !== null).map(([id]) => id)),
    openRequests: new Set(requests.filter(([, r]) => r !== null && requestOpenOn(r, today)).map(([id]) => id)),
    booked,
    publishedPosts: new Set(posts.filter(([, p]) => p !== null).map(([id]) => id)),
    passedPosts: new Set(posts.filter(([, p]) => p !== null && hasPassed(p, today)).map(([id]) => id)),
  };
}
```

  The Supabase twin (`lib/data/supabase/coach-facts.ts`, `import "server-only"`, admin client `forServer()`) does the following:
  - **`ownRows(slug)`:**
    - Reads the shop by slug: `id, campus_slug, category_slug, about, image_photo_id`, with `hasPhoto = image_photo_id !== null`.
    - Reads its listings (any state): `id, title, category_slug, state, hidden_at, price_zar, price_is_from, description, updated_at`.
    - Counts photos from `listing_photos` per listing in one query (`.in("listing_id", ids)`). Check its column names in `20261015004015_selling.sql` and how `supabase/catalog.ts` reads it.
    - Answers null for no shop.
  - **`bookedPosts(ownerId, postIds)`:** `hub_rsvps` and `hub_bookings` `.eq("account_id", ownerId).in("post_id", postIds)`, the post ids only. An empty `postIds` answers an empty set without a query.
  - **Comment:** say it reads with the admin client, like `shopStats`, and that callers pass only the signed-in seller's own shop (I1), or a shop staff may open, after that check (I2).
- [ ] **Step 5:** contract passes on the sample store (`pnpm exec vitest run lib/data/contract/coach.test.ts`); `pnpm typecheck` clean. **Don't run** `pnpm test:db`: the controller runs `coach.db.test.ts`.

### Task 7: The orchestrator: make, settle, read

**Files:** Create `lib/coach/this-week.ts`, `lib/coach/this-week.test.ts`.

- [ ] **Step 1: Failing test** (on the sample store: `resetSampleStore()` before each; `vi.stubEnv("VOSSIE_AI_SHOP_COACH", "1")` and `vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake")`):
  - **Makes the week:** with no row this week, `readThisWeek` makes one with fixed wording and returns it with states. A second call makes nothing new: `sampleStore().coachWeeks.size` is unchanged.
  - **Settles last week:** with last week's row present and unsettled, making this week's row settles it. "Last week: 1 of 2 done" follows from a ticked tip and an open listing action.
  - **Nothing to show:**
    - With the switch off: null.
    - For a paused shop, and a pending one: null, and no row made.
    - On Supabase before Monday 06:00 SAST: null and nothing made. Mock `onSupabase()` to true and the data calls with `vi.mock` to check `lazyAllowed` is honoured. Or test the branch through an injected `supabase` flag: see the signature below.
  - **Empty week:** a shop with no candidates gets a week with no actions, and the view says `empty: true`.
- [ ] **Step 2:** `pnpm exec vitest run lib/coach/this-week.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/coach/this-week.ts`:

```ts
import { aiFeatureOn } from "@/lib/ai/config";
import { onSupabase } from "@/lib/backend";
import { readOwnCoachWeeks, saveCoachWeek, settleCoachWeek } from "@/lib/data/coach";
import { liveFacts, shopFacts, type CoachShop } from "@/lib/data/coach-facts";
import type { OwnShop } from "@/lib/data/shops";
import { queueFor } from "@/lib/selling/queue";
import type { SellerQueue } from "@/lib/types";
import { candidatesFor } from "./candidates";
import { actionState, lastWeekLine, progressOf, settledIds, type Progress } from "./done";
import { SELLER_TICKED } from "./kinds";
import { planWeek } from "./plan";
import type { ActionState, CoachAction, CoachWeek } from "./types";
import { coachWeekOf, lazyAllowed, previousWeek, weeksBack } from "./week";

// This week's coaching for the signed-in seller (AI round two spec 2; I1 plan Task 7). Request-time only, inside
// <Suspense>, after getViewer() (which awaited connection()); never inside "use cache". Making a missing week here is
// the lazy path (planning decision 11); makeCoachWeek is also stage I2's writer for the fixed fallback.

export type CoachItem = CoachAction & { state: ActionState; tick: "mark-done" | "kept" | null };
export type CoachView = { week: string; items: CoachItem[]; progress: Progress; lastWeek: string | null };

type Queue = Pick<SellerQueue, "replies" | "sales" | "listings">;

/** A week's states, live, with its own ticks. */
export async function statesOf(shop: CoachShop, week: CoachWeek, queue: Queue, now: Date): Promise<ActionState[]> {
  const live = await liveFacts(shop, week.actions, queue, now);
  const ticks = new Set(week.ticks);
  return week.actions.map((action) => actionState(action, live, ticks));
}

/** A settled week's progress, from its stored ids (decision 10). */
export function settledProgress(week: CoachWeek): Progress | null {
  if (week.doneIds === null || week.goneIds === null) return null;
  return { done: week.doneIds.length, total: week.actions.length - week.goneIds.length };
}

/** Settles `week` once, from live states. */
export async function settleWeek(shop: CoachShop, week: CoachWeek, queue: Queue, now: Date): Promise<void> {
  if (week.settledAt) return;
  await settleCoachWeek(shop.slug, week.week, settledIds(week.actions, await statesOf(shop, week, queue, now)), now);
}

/**
 * Makes the shop's week in fixed wording (spec 4) unless it has one, settling last week first. `weeks` are the shop's
 * recent rows (12 weeks), newest first. How many actions this call stored, or null when it stored nothing (stage I2's
 * collect run notifies only for a stored week with actions).
 */
export async function makeCoachWeek(shop: CoachShop, weeks: readonly CoachWeek[], queue: Queue, now: Date): Promise<number | null> {
  const week = coachWeekOf(now);
  if (weeks.some((w) => w.week === week)) return null;
  const last = weeks.find((w) => w.week === previousWeek(week));
  if (last) await settleWeek(shop, last, queue, now);
  const tickedTips = weeks.flatMap((w) => w.ticks.filter((id) => id.startsWith("read-tip:")).map((id) => id.slice("read-tip:".length)));
  const facts = await shopFacts(shop, queue, now, tickedTips);
  const actions = planWeek(candidatesFor(facts, now), facts.asOf);
  const stored = await saveCoachWeek(shop.slug, { week, actions, writtenBy: "fixed", mentorQuestions: null }, now);
  return stored ? actions.length : null;
}

/** The "This week" card's view, or null when there's no card (switch off, not approved, or not made yet on Supabase). */
export async function readThisWeek(account: { id: string }, own: OwnShop, now: Date): Promise<CoachView | null> {
  if (!aiFeatureOn("shop-coach") || own.status !== "approved" || own.shop.ownerId !== account.id) return null;
  const shop = { slug: own.shop.slug, ownerId: account.id };
  const week = coachWeekOf(now);
  const queue = await queueFor(shop.slug);
  let weeks = await readOwnCoachWeeks(account.id, shop.slug, weeksBack(week));
  if (!weeks.some((w) => w.week === week)) {
    if (!lazyAllowed(now, onSupabase())) return null;
    await makeCoachWeek(shop, weeks, queue, now);
    weeks = await readOwnCoachWeeks(account.id, shop.slug, weeksBack(week));
  }
  const current = weeks.find((w) => w.week === week);
  if (!current) return null;
  const last = weeks.find((w) => w.week === previousWeek(week)) ?? null;
  const [states, lastStates] = await Promise.all([
    statesOf(shop, current, queue, now),
    last && !last.settledAt ? statesOf(shop, last, queue, now) : Promise.resolve(null),
  ]);
  const items = current.actions.map((action, i) => ({
    ...action,
    state: states[i],
    tick: states[i] === "open" && SELLER_TICKED.has(action.kind) ? (action.kind === "check-price" ? "kept" : "mark-done") : null,
  })) satisfies CoachItem[];
  return {
    week,
    items,
    progress: progressOf(states),
    lastWeek: lastWeekLine(last ? (settledProgress(last) ?? progressOf(lastStates ?? [])) : null),
  };
}
```

  Adjust to the real `OwnShop` export (`lib/data/shops.ts` exports `OwnShop`).
- [ ] **Step 4:** test passes; `pnpm typecheck` clean.

### Task 8: "Mark done"

**Files:** Create `lib/coach/actions.ts`, `lib/coach/actions.test.ts`.

- [ ] **Step 1: Failing test.** Mock `requireShopOwner` and `done`, as `lib/selling/shop-actions.test.ts` does. Cases:
  - It ticks with the session's account and shop, and lands on `/sell`, or on `/hub` for `from=hub`.
  - An `action` that isn't `kind:target` shaped writes nothing and lands on `/sell`.
  - With the switch off, or for a shop that isn't approved, it writes nothing.
  - Any other `from` lands on `/sell`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implement:**

```ts
"use server";

import { aiFeatureOn } from "@/lib/ai/config";
import { tickCoachAction as tick } from "@/lib/data/coach";
import { done, field } from "@/lib/selling/action-helpers";
import { requireShopOwner } from "@/lib/selling/owner";
import { SELL_PATH } from "@/lib/selling/paths";

// "Mark done" and "Kept on purpose" (AI round two spec 2.1; I1 planning decision 13): a plain form's action. Identity
// comes only from the session. No token (a second press changes nothing), no notice (the tick shows), no tag (nothing
// cached reads coach rows). It ends with done(), back where it was pressed.

const ACTION_ID = /^(check-price|read-tip):[a-z0-9-]{1,100}$/;
const BACK: Readonly<Record<string, string>> = { sell: SELL_PATH, hub: "/hub" };

export async function tickCoachAction(formData: FormData): Promise<void> {
  const back = BACK[field(formData, "from")] ?? SELL_PATH;
  const owner = await requireShopOwner(back);
  const actionId = field(formData, "action");
  if (aiFeatureOn("shop-coach") && owner.status === "approved" && ACTION_ID.test(actionId)) {
    await tick(owner.account.id, owner.shop.slug, actionId, new Date());
  }
  done(back);
}
```

- [ ] **Step 4:** test passes; `pnpm typecheck` and `pnpm lint` clean.

### Task 9: "This week" on `/sell`

**Files:** Create `components/coach/CoachWeek.tsx`, `components/coach/CoachWeek.test.tsx`. Modify `components/sell/SellHome.tsx`, `components/sell/Dashboard.tsx` (+ tests), and the CSS file that holds `.sell-home` (find it with `grep -rn "\.sell-home" app/*.css components`).

- [ ] **Step 1: Failing tests.** `CoachWeek.test.tsx` renders the view with three items (one done, one open with "Mark done", one gone) and checks:
  - **The region:** a region named by its title ("This week").
  - **The links:** each title is a link to its href (no prefetch is a prop, so check `href` only).
  - **The why lines.**
  - **The states:** "Done" text beside the done item (never only an icon), and "No longer needed" beside the gone one.
  - **The button:** "Mark done" is a submit button whose accessible name is `Mark done: Read: A tip`, in a form with hidden `action` and `from` fields.
  - **The line:** "1 of 2 done", and "Last week: 2 of 3 done" when given.
  - **Empty:** with no items it says "Nothing to do this week. Your shop is in good shape." and nothing else but the last week line.
  - **`from="hub"`:** the forms post `from=hub` and the title is "Your week".

  `Dashboard.test.tsx` gains:
  - `coach="error"` shows `SectionError` with id `sell-coach`;
  - `coach={null}` shows no "This week" region;
  - a view shows it after Needs you (compare document order).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implement** `components/coach/CoachWeek.tsx` (a Server Component; no `"use client"`):

```tsx
import Link from "next/link";
import { Card } from "@/components/kit/Card";
import { CheckIcon } from "@/components/icons";
import { tickCoachAction } from "@/lib/coach/actions";
import { progressLine } from "@/lib/coach/done";
import type { CoachView } from "@/lib/coach/this-week";

type CoachWeekProps = { view: CoachView; from: "sell" | "hub" };

const TICK_WORDS = { "mark-done": "Mark done", kept: "Kept on purpose" } as const;
export const NOTHING_TO_DO = "Nothing to do this week. Your shop is in good shape.";

/**
 * Shop coach's week (AI round two spec 2): up to three actions, each with its one link, why, and whether it's done,
 * then last week's line. "This week" on /sell, "Your week" on the Launchpad. No client code: "Mark done" is a plain
 * form (planning decision 13). Links don't prefetch (decision 18).
 */
export function CoachWeek({ view, from }: CoachWeekProps) {
  return (
    <Card title={from === "sell" ? "This week" : "Your week"}>
      {view.items.length === 0 ? (
        <p className="coach-empty">{NOTHING_TO_DO}</p>
      ) : (
        <>
          <p className="coach-progress">{progressLine(view.progress)}</p>
          <ol className="coach-items">
            {view.items.map((item) => (
              <li key={item.id} className="coach-item" data-state={item.state}>
                <Link href={item.href} prefetch={false} className="coach-title">
                  {item.title}
                </Link>
                <p className="coach-why">{item.why}</p>
                {item.state === "done" && (
                  <p className="coach-state">
                    <CheckIcon aria-hidden="true" /> Done
                  </p>
                )}
                {item.state === "gone" && <p className="coach-state coach-gone">No longer needed</p>}
                {item.tick && (
                  <form action={tickCoachAction} className="coach-tick">
                    <input type="hidden" name="action" value={item.id} />
                    <input type="hidden" name="from" value={from} />
                    <button type="submit" className="btn btn-outline text-navy">
                      {TICK_WORDS[item.tick]}
                      <span className="sr-only">: {item.title}</span>
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {view.lastWeek && <p className="coach-last">{view.lastWeek}</p>}
    </Card>
  );
}
```

  Check the real details as you write:
  - `CheckIcon` is exported from `components/icons.tsx` and takes `aria-hidden`.
  - The tick button is at least 44px tall: `.btn` already is; confirm.

  **CSS** (in the same file as `.sell-home`, a new block):
  - `.coach-items` is a plain list with spacing.
  - `.coach-title` is sky-dark and underlined, at least 44px tall as a touch target (padding-block). Links on white use sky-dark (CLAUDE.md brand).
  - `.coach-why` is muted text; `.coach-state` is `display: flex; gap`.
  - `.coach-gone` uses `text-muted`.
  - Colours only from tokens: no `#fff`, no `navy` for words on a band. No animation.
  - Dark and Night need nothing new if only tokens are used. Add the pairs to `lib/theme-contrast.test.ts` only if a new pairing appears.

  **`SellHome.tsx`:**
  - Add `readThisWeek(account, own, now).catch(() => "error" as const)` to the `Promise.all`.
  - Pass `coach={…}` to `Dashboard`.
  - Import `readThisWeek` from `@/lib/coach/this-week`.

  **`Dashboard.tsx`:**
  - New prop `coach: CoachView | null | "error"`, documented as "Shop coach's week (AI stage I1), null for no card, "error" when its reader failed".
  - Render it right after the Needs you card: `{coach === "error" ? <Card title="This week"><SectionError id="sell-coach" title="This week" path={SELL_PATH} /></Card> : coach && <CoachWeek view={coach} from="sell" />}`.
- [ ] **Step 4: Check the budget rules.**
  - **No client components:** `grep -rn '"use client"' components/coach lib/coach` prints nothing. The `/sell` page must stay free of client components (CLAUDE.md).
  - **`SellSkeleton`** is unchanged. A card only makes the home taller, so the skeleton stays shorter than every state.
- [ ] **Step 5:** tests pass; `pnpm typecheck`, `pnpm lint` clean.

### Task 10: The Coach card on the Launchpad

**Files:** Create `components/hub/CoachOnHub.tsx`, `components/hub/CoachOnHub.test.tsx`. Modify `app/hub/page.tsx`.

- [ ] **Step 1: Failing test** (`CoachOnHub.test.tsx`, mocking `getViewer`, `getShopOf` and `readThisWeek`, as `YourRequestsLink.test.tsx` does):
  - Signed out, the result is null. With no shop, null.
  - When `readThisWeek` answers null, or throws, the result is null: a failed read shows nothing, like `YourRequestsLink`.
  - With a view, it renders `CoachWeek` with `from="hub"`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implement:**

```tsx
import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { readThisWeek } from "@/lib/coach/this-week";
import { getShopOf } from "@/lib/data/shops";
import { CoachWeek } from "@/components/coach/CoachWeek";

/**
 * The Launchpad's Coach card (AI round two spec 3): a signed-in seller's week above Coming up. Anyone else gets
 * nothing, so the page is unchanged. It renders inside the feed's Reveal, not a boundary of its own, so it arrives with
 * the feed and moves nothing (I1 planning decision 15). A failed read shows nothing.
 */
export async function CoachOnHub() {
  const account = await getViewer().catch(() => null);
  if (!account) return null;
  await connection();
  const own = await getShopOf(account.id).catch(() => null);
  if (!own) return null;
  const view = await readThisWeek(account, own, new Date()).catch(() => null);
  return view ? <CoachWeek view={view} from="hub" /> : null;
}
```

  In `app/hub/page.tsx`, inside the existing `<Reveal fallback={<HubFeedSkeleton />}>`, put `<CoachOnHub />` before `<HubFeed searchParams={searchParams} />`. Give the card a wrapper `<div id="hub-coach" className="hub-section">` if the feed's spacing needs it. No other change to the page: the intro and Verified shops stay static.
- [ ] **Step 4:** test passes. `pnpm typecheck`, `pnpm lint` clean. `pnpm exec vitest run app/hub components/hub` passes. A page test reading the folders, such as `PageTransition` or `Reveal`, must still pass.

### Task 11: The data download and account deletion

**Files:** Modify `lib/data/accounts.ts` (`AccountExport`, `assembleExport`, `deleteAccountData`) and its tests. Check `lib/data/supabase/accounts.ts`: it calls `assembleExport`, so it needs no change. The account download's contract test (`lib/data/contract/c4-download.db.test.ts`, or whichever checks the export's key order) gets the new key.

- [ ] **Step 1: Failing tests:**
  - `lib/data/accounts.test.ts`: a seller with a coach week, ticked once, exports `coach: [{ week, writtenBy, actions: [{ kind, title, why, ticked: true, doneWhenWeekEnded: null }] }]`, and the JSON never contains a mentor question. Set one on the row in the test.
  - `deleteAccountData` leaves no `coachWeeks` or `coachTicks` row with the owner's id.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implement:**
  - `AccountExport` gains `/** Shop coach's weeks for the account's shop (AI stage I1, planning decision 17): what's stored, never mentor questions. */ coach: CoachExport[];` after `savedSearches`.
  - `assembleExport` reads `exportCoach(accountId)` and puts `coach` last, so both backends keep one key order.
  - `deleteAccountData` (sample) calls `forgetCoachOf(accountId)` just before `forgetShopOf(accountId)`, with a comment. On Supabase, `forget_account` deletes the shop and the cascade deletes the weeks (pgTAP 9).
- [ ] **Step 4:** tests pass; `pnpm typecheck` clean.

### Task 12: The end-to-end test

**Files:** Modify `playwright.config.ts`. Create `tests/e2e/coach-writes.spec.ts`.

- [ ] **Step 1: The server and the project.** In `playwright.config.ts`:
  - **The switch:** after the last AI switch in `webServer.env`, add `VOSSIE_AI_SHOP_COACH: "1",` with the comment "Shop coach on, in fixed wording, its weeks made on first read (AI stage I1)".
  - **The file pattern:** add `const COACH_WRITES = /coach-writes\.spec\.ts$/;` with a comment ("Shop coach's ticks and new shops' weeks run after every other test, so no card another test reads changes under it (AI stage I1)"), and append `COACH_WRITES` to `WRITES`.
  - **The project:** `{ name: "coach-writes", use: phone(390, 844), testMatch: COACH_WRITES, dependencies: [...DEVICE_PROJECTS, "selling-writes", "staff-writes", "community-writes", "alerts-writes", "staff-accounts-writes", "hardening-writes", "housekeeping-writes", "role-views-writes"] }`, with the "Run it alone with --project=coach-writes --no-deps." comment.
- [ ] **Step 2: Check no other test is disturbed.** With the switch on, the sample seller's `/sell`, and `/hub` for any signed-in seller, show the card on every device project.
  - **Words that might collide:** list the tests that visit `/sell` or `/hub` signed in as a seller (`grep -rln '"/sell"\|"/hub"' tests/e2e`). Look for strict-mode locators the card's words could also match: `getByText("Done")`, `getByRole("link", { name: /Reply|Mark|Add|List/ })`, `getByRole("button", { name: "Mark done" })`, and regions named "This week" or "Your week". Report any overlap to the controller with the fix (scope the locator to its region).
  - **`role-views-writes.spec.ts`:** it measures the new shop's home against `SellSkeleton`. The card makes the home taller, so it still passes; confirm by reading it.
  - **Other words:** "All clear" and "2 of 5 done" appear nowhere in the card's words. The checklist's "2 of 5 done" and the card's "N of M done" are different strings, but check the checklist assertion is scoped to its region, as it is today (`getByRole("region", { name: "Get your shop going" })`).
- [ ] **Step 3: Write the tests** (`tests/e2e/coach-writes.spec.ts`). Use the helpers `role-views-writes.spec.ts` uses (`applyToSell`, `signedInPage`, `reviewShop`, `staffNotice`, `publishListing`, `uniqueWord`, `seriousIssues`, `recordShifts`, `expectStill`). Before writing, check the sample fixtures (`data/fixtures/staff.ts`):
  - Is there a published tip? There is a tip if the Launchpad shows "Tips" with rows.
  - Is there an event or office hours in the next 14 days at the campus `applyToSell` picks, `online` or `all`? Sample dates may be fixed and in the past.

  Write the assertions marked "if" to match what the fixtures give.

```ts
import { expect, test } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main } from "./helpers/messaging";
import { POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { expectStill } from "./helpers/shifts";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

// Shop coach without the model (AI stage I1, spec 2 and 3): a new shop's first week in fixed wording on /sell and the
// Launchpad, a tick, a done check, and nothing for anyone else. Runs last, in the coach-writes project, with a shop of
// its own. Every browser.newContext( here says serviceWorkers: "block" (CLAUDE.md).

test("a new shop's week: fixed wording on /sell and the Launchpad, a done check and a tick", async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  const shopName = newShopName();
  await applyToSell(page, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  await reviewShop(admin, shopName);
  await admin.getByRole("button", { name: `Approve ${shopName}` }).click();
  await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);
  await admin.context().close();

  // The first read makes the week (planning decision 11): no listings and no shop photo yet.
  await page.goto("/sell");
  const week = main(page).getByRole("region", { name: "This week" });
  await expect(week.getByRole("link", { name: "List 3 more things" })).toHaveAttribute("href", "/sell/listings/new");
  await expect(week.getByRole("link", { name: /^Add a photo/ })).toHaveAttribute("href", "/sell/profile");
  expect(await week.getByRole("listitem").count()).toBeLessThanOrEqual(3);
  await expect(week).toContainText("0 of");
  expect(await seriousIssues(page), "/sell with its week").toEqual([]);

  // Three listings: the app sees list-more done.
  for (const n of [1, 2, 3]) await publishListing(page, `Desk lamp ${n} ${uniqueWord()}`);
  await page.goto("/sell");
  await expect(week.locator(".coach-item", { has: page.getByRole("link", { name: "List 3 more things" }) })).toContainText("Done");

  // The Launchpad: the same week above Coming up.
  await page.goto("/hub");
  const card = main(page).getByRole("region", { name: "Your week" });
  await expect(card).toBeVisible();
  const comingUp = main(page).getByRole("heading", { name: "Coming up", level: 2 });
  expect((await card.boundingBox())!.y).toBeLessThan((await comingUp.boundingBox())!.y);
  expect(await seriousIssues(page), "/hub with the Coach card").toEqual([]);

  // If the week has a tip (the third action, after list-more and finish-shop, when there's no upcoming post):
  // Mark done ticks it and lands back on the Launchpad.
  const tick = card.getByRole("button", { name: /^Mark done: / });
  if ((await tick.count()) > 0) {
    await tick.click();
    await expect(page).toHaveURL(/\/hub$/);
    await expect(card.getByRole("button", { name: /^Mark done: / })).toHaveCount(0);
    await expect(card).toContainText("Done");
  }

  // Nobody else sees a card.
  const visitor = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const other = await visitor.newPage();
  await other.goto("/hub");
  await expect(main(other).getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible();
  await expect(main(other).getByRole("region", { name: "Your week" })).toHaveCount(0);
  await visitor.close();
});

test("the Launchpad doesn't move for a signed-in seller (planning decision 15)", async ({ browser, baseURL }) => {
  // Tech corner's owner has a week (made on first read, here or by the device projects).
  const seller = await sellerPage(browser, baseURL!);
  await seller.goto("/sell");
  await expect(main(seller).getByRole("region", { name: "This week" })).toBeVisible();
  await recordShifts(seller);
  await expectStill(seller, "the Launchpad with the Coach card", "/hub");
  await expect(main(seller).getByRole("region", { name: "Your week" })).toBeVisible();
  await seller.context().close();
});
```

  Add `sellerPage` (from `./helpers/messaging`) and `recordShifts` (from `./helpers/shifts`) to the imports. `recordShifts` must be called before the navigation it measures: check how `role-views-writes.spec.ts` pairs it with `expectStill`, and copy that order. The `"Admin"` label passed to `signedInPage` must match a sample button: check `helpers/staff.ts`.
- [ ] **Step 4:** `pnpm lint` and `pnpm typecheck`. **Don't run Playwright**: the controller runs it under `e2e-3200.lock`.

### Task 13: Docs

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-11-04-ai-round-two-design.md`, `docs/PROGRESS.md`, `docs/reference/GO-LIVE.md`.

- [ ] **Step 1: CLAUDE.md.** Add one Code rules bullet, after stage G's:

  "- Shop coach (AI stages I1 and I2, round two spec 2 to 4):
    - **The rules:** the 11 kinds and their thresholds live only in `lib/coach/kinds.ts`. `candidatesFor` (`lib/coach/candidates.ts`) works a shop's candidates out from `shopFacts` (`lib/data/coach-facts.ts`), which reads through existing readers: the queue from `queueFor` (the seller's) or I2's `coachQueues` (staff and the cron), `shopConversations`, Browse's `searchListings` for similar prices, and stage G's `requestMatchCandidates` and `matchRequests` for `answer-request`. Never copy their rules.
    - **Done states** are worked out live (`actionState`, `lib/coach/done.ts`) from `liveFacts`, against each action's `asOf`. A week is settled (`done_ids`, `gone_ids`) when the next one is made, and past weeks are read from what was settled.
    - **Rows:** `coach_weeks` and `coach_ticks`. The seller reads through `own_coach_weeks` (never the mentor questions), staff through `staff_coach_weeks` (`private.can_mentor`). The service role writes weeks; a tick is `tick_coach_action`, owner-gated, this week, `check-price` and `read-tip` only.
    - **The fixed week:** `planWeek` (one per kind, catalogue order, three at most) with `fixedWording` (`lib/coach/wording.ts`). `makeCoachWeek` (`lib/coach/this-week.ts`) is the only writer of a fixed week: the lazy path on first read (always in sample mode; on Supabase from Monday 06:00 SAST, `lazyAllowed`) and I2's fallback. Request-time only, never inside `"use cache"`.
    - **The cards:** "This week" on `/sell` (a `Promise.all` reader with `.catch`, `SectionError` id `sell-coach`) and "Your week" on `/hub` for a signed-in approved seller, rendered inside the feed's `Reveal` (not its own boundary, so nothing moves). No client code; "Mark done" is a plain form (`tickCoachAction`, `lib/coach/actions.ts`).
    - **The switch:** off behind `VOSSIE_AI_SHOP_COACH` (no rows made, no cards). The e2e server has it on with the fake."

  Add one Privacy bullet: "Shop coach's weeks are about the business: the seller, its mentor and admins see them; they're in the data download (actions, ticks, settled states), never the mentor questions; deleting the account deletes them (the shops cascade on Supabase, `forgetCoachOf` in the sample store)."

  Add to the e2e bullets: "End-to-end tests for Shop coach's weeks and ticks go in `tests/e2e/coach-writes.spec.ts`, in the `coach-writes` project, which runs last, after `role-views-writes`."
- [ ] **Step 2: The spec.**
  - **Status line:** append "Stage I1 planned (2026-11-04, `docs/superpowers/plans/2026-11-04-ai-stage-i1-shop-coach-core.md`)", then "built" when done.
  - **Section 10:** add "### While planning stage I1" (planning decisions 1 to 20, one line each) and "### While building stage I1".
- [ ] **Step 3: GO-LIVE.** Add a block "### Shop coach, without the model (AI stage I1, after the submission)" before section 7:
  - Built (date, plan) and off. It needs stage G live for `answer-request` (without G it simply has none).
  - [ ] Push `20261107120000_shop_coach.sql` to Vossie Market: a dry run first, then Lama's go-ahead.
  - [ ] Either wait for I2, or set `VOSSIE_AI_SHOP_COACH=1` alone for fixed wording (weeks made on a seller's first visit from Monday 06:00 SAST). Then redeploy.
  - [ ] On vossie-pi: an approved seller sees "This week" on `/sell` and "Your week" on `/hub`; a tip's Mark done ticks; a signed-out visitor's `/hub` is unchanged.
- [ ] **Step 4: PROGRESS.md.** Add an entry at the top: what was built, the checks with their counts, and what isn't done (not committed by the implementer; migration not pushed; off until GO-LIVE; I2 next).

### Task 14 (controller): the full checks

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`: all clean. Record the counts.
- [ ] Under `supabase.lock`, in this order:
  - `supabase db reset` (the local stack only, never the remote);
  - `supabase test db` (67_shop_coach included);
  - `pnpm test:db` (`coach.db.test.ts` and the download contract included);
  - `pnpm db:types`, then diff it against Task 5's hand edit.

  Release the lock.
- [ ] Under `e2e-3200.lock`:
  - `pnpm build`.
  - `grep -lE "groq|anthropic" .next/static/chunks/*.js` prints nothing, and `grep -l "serviceWorker.register" .next/static/chunks/*.js` prints nothing.
  - Record `/sell`'s and `/hub`'s first-visit JS against the last recorded figures. They should be unchanged: no client code was added.
  - `pnpm e2e` for the device projects (the card is on for the sample seller) and the `coach-writes` project.
  - Release the lock, and stop only your own server, by PID.
- [ ] Hand the work to the controller's commit step (implementers never commit). Note in PROGRESS that the migration isn't pushed.

---

## Self-review against the spec (sections 2, 3, 4 and 8, as far as I1 goes)

| Spec | Where |
|---|---|
| Up to three actions a week per approved shop, on `/sell` ("This week") and atop `/hub` for a signed-in seller | Tasks 7, 9 and 10; decisions 2, 12 and 15 |
| Title ≤ 70, why ≤ 140 from the app's facts, one link, done tick or Mark done | Tasks 3 (`wording.ts`, `clipAtWord`) and 9; decision 19 |
| "Last week: 2 of 3 done" | Tasks 4 and 7 (`lastWeekLine`, `settledProgress`); decisions 3 and 10 |
| The catalogue's 11 kinds, candidate rules and done checks | Tasks 2 to 4; decisions 4 to 9 |
| Candidates carry id, kind, target, evidence, links | Task 2 (`Candidate`); decision 1 |
| "Nothing to do this week. Your shop is in good shape." | Task 9 (`NOTHING_TO_DO`) |
| `answer-request` uses section 5's matcher, so the two agree | Task 6 (`requestMatchCandidates`, `matchRequests`, `findOffer`); decision 7 |
| `go-to-launchpad` done by RSVP or slot request (`listOwnBookings`) | Task 6 (`bookedPosts`); decision 8 explains why not `listOwnBookings` itself |
| Links into the Launchpad only from published posts | Task 6 reads posts through `getHubPosts`/`getHubPost` (published only); gone when unpublished |
| Fixed wording per kind, always in sample mode | Task 3; Task 7's lazy path; decision 11 |
| A way to make a week's row that I2's cron calls | `planWeek` (Task 3), `makeCoachWeek` and `saveCoachWeek` (Tasks 6 and 7) |
| `coach_weeks` (shop, week, actions jsonb, mentor questions, `written_by`, created) and `coach_ticks` | Task 5; settled ids added (decision 10) |
| Owner reads own; mentors and admins by `private.can_mentor`; service-role writes | Task 5 (`own_coach_weeks`, `staff_coach_weeks`); ticks owner-gated (decision 13) |
| Sample store keeps the same rows | Task 5; decision 14 |
| In the data download; deleted with the account; mentor questions never in the download | Task 11; Task 5 pgTAP 8 and 9; decision 17 |
| Switch `VOSSIE_AI_SHOP_COACH` | Task 1; Task 7 (`readThisWeek` null), Task 8 |
| Stage I1 depends on G | Header; Task 6 |
| Testing: unit, contract both backends, pgTAP, e2e in a write project that runs last, axe/CLS/JS | Tasks 2 to 12; Task 14's budget record |
| Not in I1 (I2): the cron and Batch API, `checkCoaching`, the mentor block and questions, the column and flag, "What shops need", the `coach` notification, the privacy line, the 12-week cleanup | Stage I2's plan |
