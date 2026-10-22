# Role views N4: the mentor caseload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/mentor` into a caseload that answers "which of my shops need me now?" (Needs you / All, flags in words, a check-in chip, small-multiple enquiry charts on one scale), put the Add note and Add check-in forms first on a shop's mentor page with its history as a `Feed`, and tell a mentor when an admin assigns them a shop, on both backends, with every page inside the 150 KB first-visit JavaScript budget and each page's number recorded against the stage's baseline.

**Architecture:** Two new readers with twins: `lastCheckIns(viewer, ownerIds)` (dates only; on Supabase a new security-definer `public.last_check_ins` that checks `private.can_mentor` with the caller's session) and `dailyEnquiriesFor(slugs, days, now)` (one read for the whole caseload, SAST days, `null` before a shop opened). `mentoredShops` gains `lastCheckInOn`, new flags (`no-listings`, `paused-by-hub`, `paused-by-seller`) and a "most in need first" order on both backends. `set_shop_mentor` (Supabase) and `assignMentor` (sample store) send one "staff-role" notification to the new mentor. Everything on screen is a Server Component built from N1's kit, apart from N2's small client `PendingButton` on the shop page's two forms (Task 10) (`Card`, `ListRow`, `Pill`, `LinkTabs look="segmented"`, `Sparkline`, `StatRow`/`StatTile`, `Feed`, `EmptyState`, `PageTransition`).

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, TypeScript, Tailwind CSS 4.3 with component CSS in `app/globals.css`, Vitest 5 + Testing Library, Playwright + axe, Supabase (Postgres, pgTAP).

**Spec:** `docs/superpowers/specs/2026-10-22-role-views-design.md` (sections 3, 6, 7.3, 8, 9 and the N4 row of 10). **Builds on:** `docs/superpowers/plans/2026-10-22-role-views-n1-kit.md` (assumed built as written).

---

## Rules for whoever builds this

- **Commits:** implementers leave their work uncommitted. The controller checks each task and commits it, only with Lama's go-ahead for the stage (project memory, CLAUDE.md). Every "Commit" step below is for the controller.
- **One git command at a time.** Run `git status` before any git command, as a separate call. Stage only this plan's files: other sessions share `.git` (project memory). Never `git add .`.
- **Stop only your own server** (by PID or port), never `pkill` by name. Never kill an install, a build or `supabase` mid-flight.
- Read `node_modules/next/dist/docs/` for any Next API you touch (`searchParams` in a page: `01-app/03-api-reference/03-file-conventions/page.md`).
- Never write a font name, a hex colour, `md:` or `lg:` in a component. Use tokens, `wide:` and `desk:`. Sky never carries text, icons or thin lines on white.
- **JavaScript (Lama, 2026-10-22):** Server Components stay the default. Every page stays inside the 150 KB first-visit JS budget (brotli); each page's number is recorded against Task 0's baseline, and any page that grows by more than 1 KB gets a one-line reason in "Changes made during the build". Small client costs are fine when they buy function, accessibility or smoothness.
- No `Date.now()`, `new Date()` or `Math.random()` in anything that can prerender. Every reader and helper here takes `now` or `today` from its caller, which reads the clock after `connection()`.
- **Mentors' notes are private (CLAUDE.md, POPIA):** nothing in this stage may show a note's or check-in's text anywhere but the shop's mentor page, and nothing may read or show anything about the viewer's own shop. `lastCheckIns` returns dates only.
- Supabase work needs the local stack: `supabase start`, then `supabase db reset` after a migration, then `pnpm db:types`. `supabase test db` runs pgTAP; `pnpm test:db` runs the contract tests on the stack.

## Plan decisions (where this plan narrows or departs from the spec; Lama to confirm at plan review)

1. **The assignment notification reuses the "staff-role" kind** (`NotificationKind`, `lib/types.ts:346`; the kinds check, `supabase/migrations/20261020120000_widen.sql:22`). It is "the Hub's word about your staff work", drawn with the shield (`components/messages/NotificationsView.tsx:42`), so no kind migration and no new icon. Its subject is the shop's link and it links to `/mentor/<slug>` (`mentorShopPath`, `lib/staff/paths.ts:28`). The privacy page's list of notifications gains "an admin asks you to mentor a shop". The words: "You're now mentoring {shop}." (spec 7.3, with a full stop like every other sentence). When the shop's owner deletes their account, the notification goes too (POPIA), and when the shop changes its link, the notification's link follows: triggers on `public.shops` on Supabase, `deleteAccountData` and `changeShopSlug` on the sample store.
2. **`lastCheckIns` takes the viewer: `lastCheckIns(viewer, ownerIds)`** (spec 6 wrote `lastCheckIns(ownerIds)`). The sample store then applies the same rule as `private.can_mentor` (its new `mayMentor`), so the contract test proves "nothing about your own shop" on both backends, not only on Supabase. On Supabase it is the viewer's client calling a new `public.last_check_ins(uuid[])`. That function is **security definer** and checks `private.can_mentor` per owner with the caller's session: pgTAP 06 requires every function in `public` to be security definer (`supabase/tests/06_account_actions.test.sql:38`). It returns `(owner_id uuid, last_on date)` and nothing else.
3. **`mentoredShops` calls `lastCheckIns` itself** and returns `lastCheckInOn` on each row, because the new order needs it (spec 6). The page doesn't call `lastCheckIns` separately.
4. **Flags:** `"paused"` splits into `"paused-by-hub"` and `"paused-by-seller"` (a paused shop with no recorded `pausedBy`, as old sample rows have, counts as the seller's); `"no-listings"` ("No listings yet") replaces `"no-enquiries"` when the shop has no available listing that the Hub hasn't hidden. `mentorFlags` takes one object. The CSV keeps its columns and follows `FLAG_WORDS`, so its Flags cell uses the new words; its rows follow the dashboard's new order, since both read `mentoredShops`.
5. **Check-in chip:** "Due" when the shop has never had a check-in, or the last one is more than 30 days old (day 31). Otherwise "Today", "1 day ago" or "N days ago". A screen reader hears "Check-in: Due". A shop needs you when it has a flag or its check-in is due, so a newly assigned shop needs you until its first check-in.
6. **The page's `h1` and tab title stay "Mentor dashboard"** (`app/mentor/page.tsx:16,34`). Five test files and the account page's link use those words. The caseload card's heading is the spec's "Your shops" (an admin's: "Every mentored shop"), followed by "N of M need you · K slot requests".
7. **The page's "Download CSV" button goes:** N1's Mentoring bar has Export. `tests/e2e/staff.spec.ts:176` moves to the bar's link.
8. **The chart shows the shops in the current view** (Needs you, or All), on one scale worked out over the whole caseload, so switching views never rescales. It's left out when the view has no rows. N1's `Sparkline` and `lib/charts/scale.ts` gain an optional shared `max`; the too-small rule (spec 5.3) then uses the shared max.
9. **`dailyEnquiriesFor` on Supabase reads with the admin client**, like `shopStats` and `recentCounts` (`lib/data/supabase/shop-stats.ts`, 2b plan decision 21: no API role may read every conversation of a shop, and only counts leave the server). Callers pass only `mentoredShops`' slugs. It makes two round trips per 100 shops (the shops, then their conversations), whatever the caseload's size. Its 14 SAST days (today included) can differ by part of a day from the rolling 14×24 hours behind `counts.enquiries`; the chart says "in 14 days" and doesn't print the other number.
10. **"The 14 days before" is N2's `recentCounts(slug, 14, now).previous`** (N2 plan decision 9). `mentoredShops` keeps `MentoredShop.counts` as plain `EnquiryCounts` through N2's `currentOf`, so the caseload and the CSV are unchanged; the shop page reads `recentCounts` again for `previous` (on Supabase N2's per-request cache makes that no second query). Enquiries and sales get a delta; "replied within 48 hours" stays words with no delta. N4 builds after N2 and reuses its `lastSastDays`, `dailyOver` and `currentOf`; Task 0 stops if they're missing.
11. **Each row's detail is its flags' explanations** (`FLAG_WORDS[flag].explanation`, spec 7.3), or "No flags.". An admin's rows start with "Mentor: {name}.". The row's meta is the campus.
12. **The slot-request count is words, not a link** (the bar's Office hours tab already links, with its badge). If `openBookingCount` fails, the clause is left out; if the chart's read fails, its card shows a `section-error` box (spec 8).
13. **The notice "Mentor saved." becomes "Mentor saved. They've been told."** (`lib/staff/notices.ts:12`). Removing a mentor still says "The shop has no mentor now." and tells no one.
14. **`.mentor-home` is at least as tall as `StaffSkeleton`'s nav and body blocks**, so the skeleton is never taller than the shortest state (an empty caseload, or "All clear"). An end-to-end helper measures it.
15. **The `role-views-writes` Playwright project** belongs to N2 (spec 9). Task 12 adds it only if it isn't there yet, and in a way that leaves N2's version alone when it is.

## File structure

**Create**
- `supabase/migrations/20261025120000_mentor_caseload.sql`: `public.last_check_ins`, `private.mentor_assigned_note_text`, `public.set_shop_mentor` replaced with the notification. (Take the next free timestamp if a later migration exists; Task 0 checks.)
- `supabase/tests/52_mentor_caseload.test.sql`: pgTAP for all three.
- `app/mentor/page.test.tsx`: the `?view` switch.
- `components/staff/MentorDashboard.test.tsx` is rewritten (it exists).
- `tests/e2e/helpers/role-views.ts`: `expectNoShorterThanSkeleton`.
- `tests/e2e/role-views-writes.spec.ts` (only if N2 hasn't made it; otherwise add to it).

**Modify**
- `lib/types.ts`: `MentorFlag`, `MentoredShop.lastCheckInOn`.
- `lib/staff/mentor.ts` and `lib/staff/mentor.test.ts`: flags, words, check-in rules, order, summary sentences.
- `lib/charts/scale.ts`, `lib/charts/scale.test.ts`, `components/charts/Sparkline.tsx`, `components/charts/Sparkline.test.tsx`: the shared `max`.
- `lib/data/shop-stats.ts`, `lib/data/supabase/shop-stats.ts`, `lib/data/shop-stats.test.ts`: `dailyEnquiriesFor`, on N2's `dailyOver`.
- `lib/data/mentors.ts`, `lib/data/supabase/mentors.ts`, `lib/data/mentors.test.ts`: `lastCheckIns`, the new order and flags.
- `lib/data/contract/mentors.contract.ts`, `lib/data/contract/stats.contract.ts`.
- `lib/staff/admin-actions.ts`, `lib/staff/admin-actions.test.ts`, `lib/staff/notification-text.ts`, `lib/staff/notification-text.test.ts`, `lib/staff/notices.ts`, `lib/staff/contract/admin-gates.contract.ts`.
- `supabase/tests/06_account_actions.test.sql`: the signed-in allowlist.
- `lib/supabase/database.types.ts`: regenerated (`pnpm db:types`).
- `app/privacy/page.tsx`: one clause.
- `components/staff/MentorDashboard.tsx`, `components/staff/MentorShop.tsx`, `components/staff/MentorShop.test.tsx`.
- `app/mentor/page.tsx`, `app/mentor/[slug]/page.tsx`, `app/mentor/[slug]/page.test.tsx`.
- `app/globals.css`: one new block, "Mentor caseload (N4)", at the end.
- `tests/e2e/staff.spec.ts`, `tests/e2e/screenshots.spec.ts`, `tests/e2e/role-views.spec.ts`, `tests/e2e/role-views-screenshots.spec.ts`, `tests/e2e/cls.spec.ts`, `playwright.config.ts` (only if N2 hasn't added the project).
- `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`, this plan's "Changes made during the build".

---

### Task 0: Preflight and baselines

**Files:** none changed. The numbers go into "Changes made during the build" at the end of this plan.

- [ ] **Step 1: Check the tree**

```bash
git status
```
Expected: nothing under `app/`, `components/`, `lib/`, `supabase/` or `tests/` modified by anyone else. If there is, stop and ask Lama.

- [ ] **Step 2: Check what N4 builds on**

```bash
ls components/kit components/charts app/mentor/layout.tsx tests/e2e/role-views.spec.ts tests/e2e/role-views-screenshots.spec.ts
```
Expected: N1's files are there (`Card.tsx`, `ListRow.tsx`, `Pill.tsx`, `StatTile.tsx`, `Feed.tsx`, `EmptyState.tsx`, `PageTransition.tsx`, `sections.tsx`, `Sparkline.tsx`, …). If not, N1 hasn't landed: stop.

N4 builds on N2 (`docs/superpowers/plans/2026-10-22-role-views-n2-seller.md`, Tasks 1 and 2). Check N2's names are on main:

```bash
grep -n "export function lastSastDays" lib/time.ts; grep -n "export function dailyOver\|export function currentOf\|export async function recentCounts\|export async function dailyEnquiries" lib/data/shop-stats.ts; grep -n "export type RecentCounts" lib/types.ts
```
Expected: six lines, one for each name.

```bash
ls components/kit/PendingButton.tsx components/kit/PendingButton.test.tsx
```
Expected: both exist (N2 Task 13b); Task 10 uses it.

**If any name or file is missing, stop: N2 isn't merged, and N4 can't start.** Tell the controller; don't write N2's helpers here.

```bash
grep -n "role-views-writes" playwright.config.ts
```
Write down whether the project exists (Task 12 depends on it).

```bash
ls supabase/migrations | tail -3
```
If any file sorts after `20261024120000_campuscart_name.sql`, name Task 4's migration with the next free timestamp after it, and use that name everywhere this plan says `20261025120000_mentor_caseload.sql`.

- [ ] **Step 3: The JavaScript baseline**

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Expected: all pass. Copy each page's `scriptBrotli` into "Changes made during the build" under "Baseline". Task 11 records each page's number against them (the budget rule above).

- [ ] **Step 4: The HTML baseline of the mentor pages**

Start the production server you just built, in the background, and note its PID:

```bash
pnpm start --port 3200
```

Then, in another call:

```bash
JAR="$(mktemp)" && curl -s -o /dev/null -c "$JAR" -H "Origin: http://localhost:3200" --data "email=mentor@eduvos.com&next=/mentor" http://localhost:3200/login/sample && curl -s -b "$JAR" http://localhost:3200/mentor | wc -c && curl -s -b "$JAR" http://localhost:3200/mentor/tech-corner | wc -c
```
Expected: two byte counts (uncompressed HTML, signed in as the sample mentor). Write them down as `MENTOR_HTML_BEFORE` and `MENTOR_SHOP_HTML_BEFORE`; Task 11 puts them in the gate test. Stop the server by its PID (never by name).

---

### Task 1: Small multiples share one scale

**Files:**
- Modify: `lib/charts/scale.ts` (`isTooSmallToChart`, `sparkline`), `components/charts/Sparkline.tsx`
- Test: `lib/charts/scale.test.ts`, `components/charts/Sparkline.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `lib/charts/scale.test.ts`:

```ts
describe("a shared scale for small multiples (role views N4 plan decision 8)", () => {
  it("draws against the shared largest value, not the line's own", () => {
    const own = sparkline([0, 5], { width: 100, height: 20, pad: 2 });
    const shared = sparkline([0, 5], { width: 100, height: 20, pad: 2 }, 10);
    expect(own.last).toEqual({ x: 98, y: 2 });
    expect(shared.last).toEqual({ x: 98, y: 10 });
  });

  it("draws a line of zeros along the bottom on a shared scale", () => {
    expect(sparkline([0, 0], { width: 100, height: 20, pad: 2 }, 8).segments).toEqual(["2,18 98,18"]);
  });

  it("judges too small by the shared largest value", () => {
    expect(isTooSmallToChart([0, 0, 0])).toBe(true);
    expect(isTooSmallToChart([0, 0, 0], 8)).toBe(false);
    expect(isTooSmallToChart([4, 5], 3)).toBe(true);
    expect(isTooSmallToChart([null, 0], 8)).toBe(true);
  });
});
```

Append to `components/charts/Sparkline.test.tsx`, inside the existing `describe("Sparkline", …)`:

```tsx
  it("draws a quiet line on a shared scale instead of writing its numbers", () => {
    const { container } = render(
      <Sparkline points={[0, 1, 0, 1]} labels={["a", "b", "c", "d"]} label="Enquiries" summary="2 enquiries" max={9} />,
    );
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/charts/scale.test.ts components/charts/Sparkline.test.tsx`
Expected: FAIL (the extra argument and the `max` prop are ignored).

- [ ] **Step 3: Implement**

In `lib/charts/scale.ts`, replace `isTooSmallToChart` and the first lines of `sparkline` with:

```ts
/**
 * Fewer than 2 known points, or a largest value of 3 or under: write the numbers instead of a chart (spec 5.3). Small
 * multiples pass their shared largest value (`max`), so they're all charts or all words (N4 plan decision 8).
 */
export function isTooSmallToChart(points: readonly (number | null)[], max?: number): boolean {
  const known = points.filter((point): point is number => point !== null);
  return known.length < 2 || (max ?? Math.max(...known)) <= 3;
}
```

```ts
/**
 * A sparkline's polyline segments in a width × height box: one segment per unbroken run of known points, the edges
 * of each gap (drawn as open circles), and the last point (drawn as a dot) when the last day is known. `sharedMax` is
 * the largest value across a set of small multiples, so they share one scale (N4 plan decision 8).
 */
export function sparkline(points: readonly (number | null)[], { width, height, pad }: Box, sharedMax?: number) {
  const known = points.filter((point): point is number => point !== null);
  const max = sharedMax ?? (known.length ? Math.max(...known) : 0);
```

The rest of `sparkline` is unchanged.

In `components/charts/Sparkline.tsx`, make exactly three changes and leave everything else as N1 built it, the too-small branch that writes the values (`{summary} <span className="chart-values">({values})</span>`, N1 plan Task 8) included:

1. Add the prop to `SparklineProps`:

```tsx
  /** The largest value across a set of small multiples, so they share one scale (role views N4 plan decision 8). */
  max?: number;
```

2. Take it in the signature, `export function Sparkline({ points, labels, label, summary, max }: SparklineProps)`, and change the too-small check from `isTooSmallToChart(points)` to `isTooSmallToChart(points, max)`.

3. Change `const line = sparkline(points, BOX);` to `const line = sparkline(points, BOX, max);`.

(N1's `BarList` already has its own `max?` and `rowHeader?` props; nothing here touches it.)

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/charts components/charts`
Expected: PASS, N1's cases included. Check the shared case by hand: height 20, pad 2, max 10, value 5 → y = 20 − 2 − (5/10)·16 = 10.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/charts/scale.ts lib/charts/scale.test.ts components/charts/Sparkline.tsx components/charts/Sparkline.test.tsx
git commit -m "feat(charts): small multiples share one scale (Sparkline max), too-small judged on it (role views N4 Task 1)"
```

---

### Task 2: The caseload's rules

**Files:**
- Modify: `lib/types.ts` (`MentorFlag` at line 570, `MentoredShop` at line 573), `lib/staff/mentor.ts`
- Test: `lib/staff/mentor.test.ts` (rewritten)

- [ ] **Step 1: Write the failing tests.** Replace `lib/staff/mentor.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";
import {
  byNeed,
  caseloadDetail,
  caseloadSummary,
  checkInDue,
  checkInWords,
  csvCell,
  FLAG_WORDS,
  mentorCsv,
  mentorFlags,
  needsYou,
  repliesInTime,
  sharedMax,
  shopStanding,
  sparkSummary,
} from "./mentor";

const counts = (enquiries: number, due: number, repliedInTime: number, salesConfirmed: number): EnquiryCounts => ({
  enquiries,
  due,
  repliedInTime,
  salesConfirmed,
});

/** An open shop with two listings up, unless `more` says otherwise. */
const flags = (
  numbers: EnquiryCounts,
  more: Partial<{ status: "approved" | "paused"; pausedBy: "seller" | "staff" | null; availableListings: number }> = {},
) => mentorFlags({ counts: numbers, status: "approved", pausedBy: null, availableListings: 2, ...more });

const shop = (overrides: Partial<MentoredShop>): MentoredShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "approved",
  pausedBy: null,
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: counts(2, 2, 2, 0),
  flags: [],
  lastCheckInOn: "2026-10-06",
  ...overrides,
});

const TODAY = "2026-10-14";

describe("the mentor dashboard's flags (staff tools spec 2.6; role views spec 7.3)", () => {
  it("flags a shop with no enquiries in the 14 days", () => {
    expect(flags(counts(0, 0, 0, 0))).toEqual(["no-enquiries"]);
    expect(flags(counts(1, 0, 0, 0))).toEqual([]);
  });

  it("says No listings yet instead of No enquiries when nothing is up for buyers", () => {
    expect(flags(counts(0, 0, 0, 0), { availableListings: 0 })).toEqual(["no-listings"]);
    // Sold out: enquiries came, but there's nothing left to ask about.
    expect(flags(counts(3, 0, 0, 0), { availableListings: 0 })).toEqual(["no-listings"]);
  });

  it("flags slow replies under 50%, only once an enquiry is due", () => {
    expect(flags(counts(4, 4, 1, 0))).toEqual(["slow-replies"]);
    expect(flags(counts(4, 4, 2, 0))).toEqual([]);
    expect(flags(counts(2, 0, 0, 0))).toEqual([]);
  });

  it("says whose pause it is, after the other flags", () => {
    expect(flags(counts(0, 0, 0, 0), { status: "paused", pausedBy: "staff" })).toEqual(["no-enquiries", "paused-by-hub"]);
    expect(flags(counts(1, 0, 0, 0), { status: "paused", pausedBy: "seller" })).toEqual(["paused-by-seller"]);
    // An old sample row has no pausedBy: the seller's own pause.
    expect(flags(counts(1, 0, 0, 0), { status: "paused", pausedBy: null })).toEqual(["paused-by-seller"]);
  });

  it("names each flag, with what it means in a sentence", () => {
    expect(Object.values(FLAG_WORDS).map((words) => words.label)).toEqual([
      "No listings yet",
      "No enquiries in 14 days",
      "Slow replies (under 50% in 48 hours)",
      "Paused by the Hub",
      "Paused by the seller",
    ]);
    for (const words of Object.values(FLAG_WORDS)) expect(words.explanation).toMatch(/\.$/);
  });

  it("says replies in time as the dashboard does (selling plan decision 18)", () => {
    expect(repliesInTime(counts(4, 4, 3, 0))).toBe("3 of 4");
    expect(repliesInTime(counts(2, 0, 0, 0))).toBe("None due yet");
  });

  it("says where a shop stands, a pause with whose it is", () => {
    expect(shopStanding("approved", null)).toBe("Open");
    expect(shopStanding("paused", "staff")).toBe("Paused by the Hub");
    expect(shopStanding("paused", "seller")).toBe("Paused by the seller");
    expect(shopStanding("pending", null)).toBe("Waiting");
  });
});

describe("check-ins (role views spec 7.3, N4 plan decision 5)", () => {
  it("is due with none yet, or more than 30 days after the last", () => {
    expect(checkInDue(null, TODAY)).toBe(true);
    expect(checkInDue("2026-09-14", TODAY)).toBe(false);
    expect(checkInDue("2026-09-13", TODAY)).toBe(true);
  });

  it("says how long ago, or Due", () => {
    expect(checkInWords(null, TODAY)).toBe("Due");
    expect(checkInWords("2026-10-14", TODAY)).toBe("Today");
    expect(checkInWords("2026-10-13", TODAY)).toBe("1 day ago");
    expect(checkInWords("2026-10-05", TODAY)).toBe("9 days ago");
    expect(checkInWords("2026-09-13", TODAY)).toBe("Due");
  });

  it("needs you with a flag or a check-in due", () => {
    expect(needsYou(shop({}), TODAY)).toBe(false);
    expect(needsYou(shop({ flags: ["slow-replies"] }), TODAY)).toBe(true);
    expect(needsYou(shop({ lastCheckInOn: null }), TODAY)).toBe(true);
  });
});

describe("the caseload's order (role views spec 6)", () => {
  it("puts the most flags first, then the longest without a check-in (none first), then the name", () => {
    const rows = [
      shop({ name: "Zed", flags: ["slow-replies"], lastCheckInOn: "2026-10-12" }),
      shop({ name: "Two flags", flags: ["no-enquiries", "paused-by-seller"], lastCheckInOn: "2026-10-14" }),
      shop({ name: "Bee", flags: ["slow-replies"], lastCheckInOn: null }),
      shop({ name: "Ace", flags: ["slow-replies"], lastCheckInOn: null }),
      shop({ name: "Calm", flags: [], lastCheckInOn: null }),
    ];
    expect(rows.sort(byNeed(TODAY)).map((row) => row.name)).toEqual(["Two flags", "Ace", "Bee", "Zed", "Calm"]);
  });
});

describe("the caseload's words (role views spec 7.3)", () => {
  it("sums up who needs you and the slot requests waiting", () => {
    expect(caseloadSummary(2, 6, 2)).toBe("2 of 6 need you · 2 slot requests");
    expect(caseloadSummary(1, 1, 1)).toBe("1 of 1 need you · 1 slot request");
    expect(caseloadSummary(0, 3, 0)).toBe("0 of 3 need you · 0 slot requests");
    expect(caseloadSummary(0, 3, null)).toBe("0 of 3 need you");
  });

  it("explains a row's flags in sentences, and names the mentor for an admin", () => {
    expect(caseloadDetail(shop({ flags: ["no-listings"] }), false)).toBe(FLAG_WORDS["no-listings"].explanation);
    expect(caseloadDetail(shop({ flags: ["no-enquiries", "paused-by-hub"] }), false)).toBe(
      `${FLAG_WORDS["no-enquiries"].explanation} ${FLAG_WORDS["paused-by-hub"].explanation}`,
    );
    expect(caseloadDetail(shop({}), false)).toBe("No flags.");
    expect(caseloadDetail(shop({}), true)).toBe("Mentor: Naledi. No flags.");
  });

  it("takes the largest day across every shop as the chart's shared scale", () => {
    expect(sharedMax([[1, null, 4], [2]])).toBe(4);
    expect(sharedMax([[null]])).toBe(0);
    expect(sharedMax([])).toBe(0);
  });

  it("says each little chart's takeaway", () => {
    expect(sparkSummary("Tech corner", [null, null, 1, 0, 3])).toBe("Tech corner: 4 enquiries in 3 days, 3 today.");
    expect(sparkSummary("Tech corner", [0, 1])).toBe("Tech corner: 1 enquiry in 2 days, 1 today.");
    expect(sparkSummary("Tech corner", [null, null])).toBe("Tech corner: no days to show yet.");
  });
});

describe("the dashboard's CSV (staff tools spec 2.6, plan decision 17, amendment 12.1 and 12.2)", () => {
  it("quotes every text cell, doubling its quotes, and leaves numbers bare", () => {
    expect(csvCell("Tech corner")).toBe('"Tech corner"');
    expect(csvCell("Bakes, cakes")).toBe('"Bakes, cakes"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("Two\nlines")).toBe('"Two\nlines"');
    expect(csvCell("")).toBe('""');
    expect(csvCell(3)).toBe("3");
  });

  it("puts an apostrophe before text a spreadsheet would run as a formula, and quotes it", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("\"'=HYPERLINK(1)\"");
    expect(csvCell("+27 11")).toBe("\"'+27 11\"");
    expect(csvCell("-shop")).toBe("\"'-shop\"");
    expect(csvCell("@me")).toBe("\"'@me\"");
    expect(csvCell("=1,2")).toBe("\"'=1,2\"");
    expect(csvCell("\t=1")).toBe("\"'\t=1\"");
    expect(csvCell("\r=1")).toBe("\"'\r=1\"");
  });

  it("keeps a semicolon inside its quotes, so a spreadsheet that splits on semicolons can't run what follows it", () => {
    expect(csvCell("Bakes;=1+1;")).toBe('"Bakes;=1+1;"');
    expect(csvCell("Rock-n-roll = fun")).toBe('"Rock-n-roll = fun"');
  });

  it("writes the table with a header row and a line per shop, the flags in the new words, each line ending in CRLF", () => {
    const row = shop({
      status: "paused",
      pausedBy: "seller",
      counts: counts(4, 4, 1, 2),
      flags: ["slow-replies", "paused-by-seller"],
    });
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toBe(
      '﻿"Shop","Campus","Mentor","Badge","Status","Enquiries (14 days)","Due for a reply","Replied within 48 hours",' +
        '"Sales confirmed (14 days)","Flags"\r\n' +
        '"Tech corner","Midrand","Naledi","Responsive","Paused",4,4,1,2,"Slow replies (under 50% in 48 hours); Paused by the seller"\r\n',
    );
    expect(mentorCsv([], new Map())).toMatch(/^﻿"Shop",.*,"Flags"\r\n$/);
  });

  it("quotes a shop with no badge or flags as empty text, and guards a shop named like a formula", () => {
    const row = shop({ slug: "bakes", name: "=Bakes;=1+1;", campusSlug: "online", badge: null, counts: counts(0, 0, 0, 0) });
    const lines = mentorCsv([row], new Map()).split("\r\n");
    expect(lines[1]).toBe("\"'=Bakes;=1+1;\",\"online\",\"Naledi\",\"\",\"Open\",0,0,0,0,\"\"");
  });

  it("starts with a UTF-8 byte-order mark, so Excel reads accents and apostrophes right (Zoë's Café)", () => {
    const csv = mentorCsv([], new Map());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv[1]).toBe('"');
    expect(Buffer.from(csv).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const row = shop({ slug: "zoes", name: "Zoë's Café", badge: null, counts: counts(1, 0, 0, 0) });
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toContain('"Zoë\'s Café","Midrand"');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/staff/mentor.test.ts`
Expected: FAIL (missing exports, old flag names).

- [ ] **Step 3: Change the types.** In `lib/types.ts`, replace line 570:

```ts
/**
 * A shop's flags on the mentor dashboard (staff tools spec 2.6; role views spec 7.3). "no-listings" replaces
 * "no-enquiries" when nothing is up for buyers; a pause says whose it is.
 */
export type MentorFlag = "no-listings" | "no-enquiries" | "slow-replies" | "paused-by-hub" | "paused-by-seller";
```

and add one line to the comment above `NotificationKind` (`lib/types.ts:335`), after the staff accounts' line:

```ts
 * A "staff-role" notification's subject is the role ("mentor", "admin"), or, for a mentor's new shop (role views N4),
 * the shop's link, with the href /mentor/<slug>.
```

(If `NotificationKind` has no comment block, add these as its `/** … */` comment.)

Then add to `MentoredShop`, after `flags: MentorFlag[];`:

```ts
  /**
   * The latest check-in's day, YYYY-MM-DD in South Africa, or null when there's been none (role views spec 6). The day
   * only: never what was said.
   */
  lastCheckInOn: string | null;
```

- [ ] **Step 4: Implement.** Replace `lib/staff/mentor.ts` with:

```ts
import { badgeLabel } from "@/lib/format";
import { replyRate } from "@/lib/selling/badges";
import type { EnquiryCounts, MentorFlag, MentoredShop, SellerStatus } from "@/lib/types";

// The mentor dashboard's flags, its caseload rules and its CSV (staff tools spec 2.6, plan decisions 15 and 17; role
// views spec 7.3). Mentors see numbers, never messages (FUNCTION-MAP K1), and a check-in's day, never what was said.
// Plain functions; the words are samples for Lama to change (plan decision 22). Days come from the caller, in SAST.

/** The dashboard's window: the spec's first flag counts 14 days. */
export const MENTOR_WINDOW_DAYS = 14;
/** "Slow replies" is under half answered within 48 hours. */
export const SLOW_REPLY_RATE = 0.5;
/** A check-in is due when there's been none, or the last is more than this many days old (role views spec 7.3). */
export const CHECK_IN_DUE_DAYS = 30;

const DAY_MS = 86_400_000;

type FlagInput = {
  counts: EnquiryCounts;
  status: SellerStatus;
  pausedBy: "seller" | "staff" | null;
  /** Its listings a buyer could ask about: available, and not hidden by the Hub. */
  availableListings: number;
};

/**
 * A shop's flags, in this order (staff tools spec 2.6; role views spec 7.3). With nothing up for buyers it's "No
 * listings yet", not "No enquiries": there was nothing to ask about. Slow replies only count once an enquiry is due
 * (selling plan decision 18). A pause says whose it is; one with no record of whose is the seller's.
 */
export function mentorFlags({ counts, status, pausedBy, availableListings }: FlagInput): MentorFlag[] {
  const flags: MentorFlag[] = [];
  if (availableListings === 0) flags.push("no-listings");
  else if (counts.enquiries === 0) flags.push("no-enquiries");
  const rate = replyRate(counts);
  if (rate !== null && rate < SLOW_REPLY_RATE) flags.push("slow-replies");
  if (status === "paused") flags.push(pausedBy === "staff" ? "paused-by-hub" : "paused-by-seller");
  return flags;
}

/** Each flag's name and what it means, for the caseload's rows, the shop's mentor page and the CSV. */
export const FLAG_WORDS: Readonly<Record<MentorFlag, { label: string; explanation: string }>> = {
  "no-listings": {
    label: "No listings yet",
    explanation: "Nothing is up for buyers yet, so there's nothing to ask about. A first listing is the next step.",
  },
  "no-enquiries": {
    label: "No enquiries in 14 days",
    explanation: "No buyer has asked about a listing in the last 14 days. New listings or better photos may help.",
  },
  "slow-replies": {
    label: "Slow replies (under 50% in 48 hours)",
    explanation: "Fewer than half of the enquiries that are due were answered within 48 hours.",
  },
  "paused-by-hub": {
    label: "Paused by the Hub",
    explanation: "The Hub paused the shop, so buyers can't see it until the Hub resumes it.",
  },
  "paused-by-seller": {
    label: "Paused by the seller",
    explanation: "The seller paused the shop, so buyers can't see its listings until they resume it.",
  },
};

/** "3 of 4", or "None due yet" while no enquiry has come due (selling plan decision 18). */
export function repliesInTime(counts: EnquiryCounts): string {
  return counts.due === 0 ? "None due yet" : `${counts.repliedInTime} of ${counts.due}`;
}

const STATUS_WORDS: Readonly<Record<SellerStatus, string>> = { pending: "Waiting", approved: "Open", paused: "Paused" };

/** A shop's status as the CSV words it. */
export function statusWords(status: SellerStatus): string {
  return STATUS_WORDS[status];
}

/** A shop's status as the mentor page words it, a pause with whose it is (role views spec 7.3). */
export function shopStanding(status: SellerStatus, pausedBy: "seller" | "staff" | null): string {
  if (status !== "paused") return statusWords(status);
  return pausedBy === "staff" ? "Paused by the Hub" : "Paused by the seller";
}

/** Whole days from `day` to `today`, both YYYY-MM-DD in South Africa. */
function daysSince(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS);
}

/** Due with no check-in yet, or more than 30 days after the last (N4 plan decision 5). */
export function checkInDue(lastOn: string | null, today: string): boolean {
  return lastOn === null || daysSince(lastOn, today) > CHECK_IN_DUE_DAYS;
}

/** The check-in chip's words: "Due", "Today", "1 day ago" or "9 days ago". */
export function checkInWords(lastOn: string | null, today: string): string {
  if (lastOn === null || checkInDue(lastOn, today)) return "Due";
  const days = daysSince(lastOn, today);
  if (days === 0) return "Today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** A shop needs you when it has a flag or its check-in is due (role views spec 7.3). */
export function needsYou(row: Pick<MentoredShop, "flags" | "lastCheckInOn">, today: string): boolean {
  return row.flags.length > 0 || checkInDue(row.lastCheckInOn, today);
}

type Ordered = Pick<MentoredShop, "flags" | "lastCheckInOn" | "name">;

/**
 * mentoredShops' order (role views spec 6): the most flags first, then the longest since a check-in (none at all
 * first), then by name. Equal ages compare as 0 before subtracting, so two shops with no check-in (Infinity) tie
 * rather than giving NaN.
 */
export function byNeed(today: string): (a: Ordered, b: Ordered) => number {
  const since = (row: Ordered) =>
    row.lastCheckInOn === null ? Number.POSITIVE_INFINITY : daysSince(row.lastCheckInOn, today);
  return (a, b) => {
    const [sinceA, sinceB] = [since(a), since(b)];
    return (
      b.flags.length - a.flags.length || (sinceB === sinceA ? 0 : sinceB - sinceA) || a.name.localeCompare(b.name)
    );
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The caseload's header line: "2 of 6 need you · 2 slot requests". The slots are left out when they couldn't be read. */
export function caseloadSummary(need: number, total: number, slotRequests: number | null): string {
  const shops = `${need} of ${total} need you`;
  return slotRequests === null ? shops : `${shops} · ${plural(slotRequests, "slot request", "slot requests")}`;
}

/** A caseload row's detail: its flags' explanations, or "No flags."; an admin's starts with the mentor's name. */
export function caseloadDetail(row: Pick<MentoredShop, "flags" | "mentorName">, showMentor: boolean): string {
  const flags = row.flags.length === 0 ? "No flags." : row.flags.map((flag) => FLAG_WORDS[flag].explanation).join(" ");
  return showMentor ? `Mentor: ${row.mentorName}. ${flags}` : flags;
}

/** The largest day across every shop's series: the small multiples' shared scale (N4 plan decision 8). */
export function sharedMax(series: Iterable<readonly (number | null)[]>): number {
  let max = 0;
  for (const points of series) for (const point of points) if (point !== null && point > max) max = point;
  return max;
}

/** A small chart's takeaway: "Tech corner: 4 enquiries in 3 days, 3 today." Days before the shop opened don't count. */
export function sparkSummary(name: string, points: readonly (number | null)[]): string {
  const known = points.filter((point): point is number => point !== null);
  if (known.length === 0) return `${name}: no days to show yet.`;
  const total = known.reduce((sum, point) => sum + point, 0);
  const last = points[points.length - 1];
  const today = last === null || last === undefined ? "" : `, ${last} today`;
  return `${name}: ${plural(total, "enquiry", "enquiries")} in ${plural(known.length, "day", "days")}${today}.`;
}

/**
 * One CSV cell (RFC 4180). Text always goes in double quotes, with any quotes inside doubled, so a separator that isn't
 * a comma can't split it: where Excel's list separator is a semicolon, an unquoted `Bakes;=1+1;` would become three
 * cells, the second a formula. Text that starts with =, +, -, @, a tab or a carriage return gets an apostrophe first,
 * so a spreadsheet never runs a shop's name as a formula (plan decision 17, amendment 12.1). Numbers go in bare.
 */
export function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A UTF-8 byte-order mark: without it Excel reads the file as ANSI and garbles "Zoë's Café" (amendment 12.2). */
const BYTE_ORDER_MARK = "﻿";

const CSV_HEADER = [
  "Shop",
  "Campus",
  "Mentor",
  "Badge",
  "Status",
  "Enquiries (14 days)",
  "Due for a reply",
  "Replied within 48 hours",
  "Sales confirmed (14 days)",
  "Flags",
];

/**
 * The dashboard's shops as a CSV file (spec 2.6), one line per shop in the dashboard's order, each ending in CRLF. No
 * messages, no emails, no check-ins. It starts with a byte-order mark, so the route sends the body as it is
 * (amendment 12.2).
 */
export function mentorCsv(rows: readonly MentoredShop[], campusNames: ReadonlyMap<string, string>): string {
  const lines = [
    CSV_HEADER,
    ...rows.map((row) => [
      row.name,
      campusNames.get(row.campusSlug) ?? row.campusSlug,
      row.mentorName,
      row.badge ? badgeLabel(row.badge) : "",
      statusWords(row.status),
      row.counts.enquiries,
      row.counts.due,
      row.counts.repliedInTime,
      row.counts.salesConfirmed,
      row.flags.map((flag) => FLAG_WORDS[flag].label).join("; "),
    ]),
  ];
  return BYTE_ORDER_MARK + lines.map((cells) => `${cells.map(csvCell).join(",")}\r\n`).join("");
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run lib/staff/mentor.test.ts`
Expected: PASS. `pnpm typecheck` now fails in the readers, the components and their tests (old flags, `mentorFlags`' arguments, the missing `lastCheckInOn`): Tasks 5, 8 and 10 fix them. Don't commit until Task 5 passes typecheck for `lib/`.

- [ ] **Step 6: Commit (controller), together with Task 5**

---

### Task 3: The caseload's enquiries by day, on N2's counting

N2 already gives `lastSastDays` (`lib/time.ts`), `dailyOver`, `currentOf` and `recentCounts` returning `RecentCounts` with `previous` (`lib/data/shop-stats.ts`), and the twin's per-request `conversationsOfSlug` and `shopOf` (N2 plan Task 2). This task adds only the caseload's reader, built on `dailyOver`, so a shop's line on the mentor's chart is the same series as its seller's `dailyEnquiries`. The shop page's "14 days before" is `recentCounts(…).previous` (Task 10), so no new previous-window code.

**Files:**
- Modify: `lib/data/shop-stats.ts` (after N2's `dailyEnquiries`), `lib/data/supabase/shop-stats.ts`
- Test: `lib/data/shop-stats.test.ts`, `lib/data/contract/stats.contract.ts`

- [ ] **Step 1: Write the failing tests.** In `lib/data/shop-stats.test.ts`, add `dailyEnquiriesFor` to N2's import from `./shop-stats`, and append:

```ts
describe("the caseload's enquiries by day (role views spec 6, N4)", () => {
  it("gives each shop the same series as its seller's dailyEnquiries, and nothing for a shop that isn't there", async () => {
    const series = await dailyEnquiriesFor(["tech-corner", "no-such-shop"], 14, NOW);
    expect([...series.keys()]).toEqual(["tech-corner"]);
    expect(series.get("tech-corner")).toEqual(await dailyEnquiries("tech-corner", 14, NOW));
    expect(series.get("tech-corner")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
  });

  it("leaves out a conversation whose seller has gone, and reads nothing for no shops", async () => {
    add({ createdAt: ago(2), sellerGone: true });
    expect((await dailyEnquiriesFor(["tech-corner"], 14, NOW)).get("tech-corner")!.at(-1)).toBe(0);
    expect(await dailyEnquiriesFor([], 14, NOW)).toEqual(new Map());
  });
});
```

(`dailyEnquiries` is already in N2's import there.)

In `lib/data/contract/stats.contract.ts`, add `dailyEnquiriesFor` to the import from `@/lib/data/shop-stats` and add inside `statsContract`:

```ts
  it("counts Tech corner's enquiries by SAST day for the mentor's chart, as dailyEnquiries does (role views spec 6)", async () => {
    const series = await dailyEnquiriesFor(["tech-corner", "no-such-shop"], 14, now);
    expect([...series.keys()]).toEqual(["tech-corner"]);
    // The seed's two enquiries started on 12 and 13 October (SAST); the 14 days run from 1 to 14 October.
    expect(series.get("tech-corner")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
    expect(await dailyEnquiriesFor([], 14, now)).toEqual(new Map());
  });

  it("leaves the days before a shop opened empty, never 0, for every shop in one read", async () => {
    await world.tidyMessaging();
    const opened = new Date();
    const slug = await world.openShop("shopper");
    const listingId = await world.addListing(slug, { title: "Desk lamp for the chart" });
    await world.addConversation({
      buyer: "asker",
      slug,
      listingId,
      messages: [{ side: "buyer", body: "Is the desk lamp still there?", sentAt: opened }],
    });
    const series = await dailyEnquiriesFor([slug, "tech-corner"], 7, opened);
    expect(series.get(slug)).toEqual([null, null, null, null, null, null, 1]);
    expect(series.get(slug)).toEqual(await dailyEnquiries(slug, 7, opened));
    expect(series.get("tech-corner")).toHaveLength(7);
  });
```

If N2's contract already imports `dailyEnquiries` from `@/lib/data/shop-stats`, merge; otherwise add it. The second case fails only if it runs across SAST midnight; rerun it then.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/shop-stats.test.ts lib/data/contract/stats.test.ts`
Expected: FAIL (`dailyEnquiriesFor` is not exported).

- [ ] **Step 3: Implement the sample side.** Append to `lib/data/shop-stats.ts`:

```ts
/**
 * Enquiries a day over the last `days` SAST days for each shop in `slugs`, in one read for the whole caseload (role
 * views spec 6): a map from slug to the series `dailyEnquiries` gives that shop, oldest first, null before it opened. A
 * slug with no shop is left out. Request-time only. Callers pass only mentoredShops' slugs (on Supabase this reads with
 * the admin client, N4 plan decision 9).
 */
export async function dailyEnquiriesFor(
  slugs: readonly string[],
  days: number,
  now: Date,
): Promise<Map<string, (number | null)[]>> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).dailyEnquiriesFor(slugs, days, now);
  const wanted = new Set(slugs);
  const bySlug = new Map<string, ConversationRow[]>();
  for (const row of sampleStore().conversations.values()) {
    if (!wanted.has(row.sellerSlug) || row.sellerGone) continue;
    const list = bySlug.get(row.sellerSlug) ?? [];
    list.push(row);
    bySlug.set(row.sellerSlug, list);
  }
  const series = new Map<string, (number | null)[]>();
  for (const slug of wanted) {
    const shop = sampleStore().sellers.get(slug);
    if (shop) series.set(slug, dailyOver(bySlug.get(slug) ?? [], shop.createdAt, days, now));
  }
  return series;
}
```

`dailyOver`, `onSupabase`, `sampleStore` and `ConversationRow` are already in the file after N2.

- [ ] **Step 4: Implement the Supabase twin.** In `lib/data/supabase/shop-stats.ts`, add `lastSastDays` from `@/lib/time` to the imports (N2's import from `../shop-stats` already has `dailyOver`) and append:

```ts
/**
 * The caseload's enquiries a day (role views spec 6; N4 plan decision 9): the shops by their links, then all their
 * conversations since the first day's SAST midnight, a hundred shops a request, mapped as conversationsOf maps them and
 * counted by N2's dailyOver. Admin client, as shopStats: only the counts leave the server, and callers pass only
 * mentoredShops' slugs.
 */
export const dailyEnquiriesFor: typeof Sample.dailyEnquiriesFor = async (slugs, days, now) => {
  const series = new Map<string, (number | null)[]>();
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return series;
  // The first day's midnight in South Africa (UTC+2 all year), as UTC: earlier conversations can't land in the window.
  const since = new Date(Date.parse(`${lastSastDays(days, now)[0]}T00:00:00+02:00`)).toISOString();
  const shops: { id: string; slug: string; created_at: string }[] = [];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await forServer()
      .from("shops")
      .select("id, slug, created_at")
      .in("slug", unique.slice(from, from + 100));
    if (error) throw new Error(error.message);
    shops.push(...data);
  }
  const byShop = new Map<string, CountedConversation[]>(shops.map((shop) => [shop.id, []]));
  const ids = shops.map((shop) => shop.id);
  for (let from = 0; from < ids.length; from += 100) {
    const rows = await selectAll(
      () =>
        forServer()
          .from("conversations")
          .select("id, shop_id, listing_id, is_offer, request_id, created_at, first_reply_at, status, completed_at, confirmed_at")
          .in("shop_id", ids.slice(from, from + 100))
          .eq("seller_gone", false)
          .gte("created_at", since),
      ["id"],
    );
    for (const row of rows) {
      byShop.get(row.shop_id)?.push({
        listingId: row.listing_id,
        requestId: row.is_offer ? (row.request_id ?? GONE_REQUEST) : null,
        createdAt: row.created_at,
        firstReplyAt: row.first_reply_at,
        status: row.status as CountedConversation["status"],
        completedAt: row.completed_at,
        confirmedAt: row.confirmed_at,
      });
    }
  }
  for (const shop of shops) series.set(shop.slug, dailyOver(byShop.get(shop.id) ?? [], shop.created_at, days, now));
  return series;
};
```

The mapping is `conversationsOf`'s (same file); if N2 changed it, match N2's. `GONE_REQUEST`, `forServer`, `selectAll` and `CountedConversation` are already in the file.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run lib/data/shop-stats.test.ts lib/data/contract/stats.test.ts`
Expected: PASS, N2's cases included.

Run (local stack up, after `supabase db reset`): `pnpm test:db lib/data/contract/stats.db.test.ts`
Expected: PASS, both new cases included.

- [ ] **Step 6: Commit (controller)**

```bash
git add lib/data/shop-stats.ts lib/data/supabase/shop-stats.ts lib/data/shop-stats.test.ts lib/data/contract/stats.contract.ts
git commit -m "feat(data): dailyEnquiriesFor, a caseload's enquiries by SAST day in one read, on N2's dailyOver, on both backends (role views N4 Task 3)"
```

---

### Task 4: The database: last check-ins, and telling the new mentor

**Files:**
- Create: `supabase/migrations/20261025120000_mentor_caseload.sql`, `supabase/tests/52_mentor_caseload.test.sql`
- Modify: `supabase/tests/06_account_actions.test.sql` (the signed-in allowlist, line 63), `lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Write the failing pgTAP test** `supabase/tests/52_mentor_caseload.test.sql`

```sql
-- Role views N4 (role views spec 6 and 7.3; N4 plan Task 4).
-- - public.last_check_ins gives the latest check-in day for each owner asked about, and nothing else: no text, no
--   author, no note. Only where private.can_mentor lets the signed-in account read notes about that owner: never to the
--   owner, an admin who sells included, nor to a mentor of another shop or one whose role has gone.
-- - public.set_shop_mentor tells the new mentor, with the "staff-role" kind, the shop's link as its subject and its
--   mentor page as the link; never on a removal, when nothing changed, or when it refuses.
-- - Deleting the shop (its owner's account) takes that notification away (POPIA).
begin;
select plan(25);

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
-- What account n learns about the owners' last check-ins: "<owner's n> <day>", by owner.
create function pg_temp.seen(n text, owners text[]) returns text[] language plpgsql as $f$
declare
  got text[];
begin
  perform pg_temp.sign_in(n);
  select coalesce(array_agg(right(r.owner_id::text, 2) || ' ' || r.last_on::text order by r.owner_id), '{}')
  into got
  from public.last_check_ins(array(select pg_temp.a(o) from unnest(owners) o)) r;
  perform pg_temp.sign_out();
  return got;
end;
$f$;
-- Account n sets the mentor of shop s (null for none).
create function pg_temp.assign(n text, s text, mentor text) returns text language plpgsql as $f$
declare
  got text;
begin
  perform pg_temp.sign_in(n);
  got := public.set_shop_mentor(pg_temp.s(s), case when mentor is null then null else pg_temp.a(mentor) end);
  perform pg_temp.sign_out();
  return got;
end;
$f$;
-- Account n's notifications: "<kind> <subject> <link> <sentence>".
create function pg_temp.told(n text) returns text[] language sql as $f$
  select coalesce(array_agg(t.kind || ' ' || t.subject_id || ' ' || t.href || ' ' || t.text order by t.text), '{}')
  from public.notifications t where t.account_id = pg_temp.a(n);
$f$;
grant execute on all functions in schema pg_temp to public;

insert into public.campuses (slug, name, region, sort) values ('mc-campus', 'Caseload campus', 'Gauteng', 97);
insert into public.categories (slug, name, sort) values ('mc-category', 'Caseload category', 98);
-- d1 Ada, an admin whose shop Mpho mentors; d2 Mpho, a mentor; d3 Sizwe, a student whose shop Mpho mentors; d4 Lindi,
-- a mentor of Zola's shop only; d5 Bongi, an admin with no shop; d6 Thabo, a mentor the tests assign; d7 Zola, a
-- student whose shop Lindi mentors.
insert into auth.users (id, email)
select pg_temp.a(n), 'mc-' || n || '@eduvos.com' from unnest(array['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']) n;
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('d1'), 'Ada', 'mc-campus', '{admin}'),
  (pg_temp.a('d2'), 'Mpho', 'mc-campus', '{mentor}'),
  (pg_temp.a('d3'), 'Sizwe', 'mc-campus', '{}'),
  (pg_temp.a('d4'), 'Lindi', 'mc-campus', '{mentor}'),
  (pg_temp.a('d5'), 'Bongi', 'mc-campus', '{admin}'),
  (pg_temp.a('d6'), 'Thabo', 'mc-campus', '{mentor}'),
  (pg_temp.a('d7'), 'Zola', 'mc-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('d1'), 'mc-ada', pg_temp.a('d1'), 'Ada prints', 'mc-category', 'mc-campus', '2026-01'),
  (pg_temp.s('d3'), 'mc-sizwe', pg_temp.a('d3'), 'Sizwe sells', 'mc-category', 'mc-campus', '2026-01'),
  (pg_temp.s('d7'), 'mc-zola', pg_temp.a('d7'), 'Zola bakes', 'mc-category', 'mc-campus', '2026-01');
insert into public.seller_profiles (account_id, status, shop_id, applied_at, approved_at, mentor_id) values
  (pg_temp.a('d1'), 'approved', pg_temp.s('d1'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('d2')),
  (pg_temp.a('d3'), 'approved', pg_temp.s('d3'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('d2')),
  (pg_temp.a('d7'), 'approved', pg_temp.s('d7'), now() - interval '9 days', now() - interval '8 days', pg_temp.a('d4'));
insert into public.mentor_notes (owner_id, kind, check_in_on, text, author_id, author_name) values
  (pg_temp.a('d3'), 'check-in', '2026-10-01', 'Talked about photos.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d3'), 'check-in', '2026-10-09', 'Priced the calculators.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d3'), 'note', null, 'A note, not a check-in.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d1'), 'check-in', '2026-10-05', 'Met Ada at the Hub.', pg_temp.a('d2'), 'Mpho'),
  (pg_temp.a('d7'), 'check-in', '2026-10-07', 'Priced the cupcakes.', pg_temp.a('d4'), 'Lindi');

-- --- last_check_ins: its shape ---------------------------------------------------------------------------------------

select has_function('public', 'last_check_ins', array['uuid[]'], 'public.last_check_ins(uuid[]) exists');
select is(
  (select array_agg(c.name || ' ' || format_type(c.type, null) order by c.ord)
   from pg_proc p,
     unnest(p.proargnames, p.proallargtypes::oid[], p.proargmodes::text[]) with ordinality as c(name, type, mode, ord)
   where p.oid = 'public.last_check_ins(uuid[])'::regprocedure and c.mode = 't'),
  array['owner_id uuid', 'last_on date'],
  'it returns an owner and a day: no text column, no author'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
   where p.oid = 'public.last_check_ins(uuid[])'::regprocedure),
  'security definer with an empty search path, as every function in public'
);
select ok(not has_function_privilege('anon', 'public.last_check_ins(uuid[])', 'execute'), 'nobody signed out runs it');
set local role anon;
select throws_ok(
  $$select * from public.last_check_ins(array['00000000-0000-4000-8000-0000000000d3']::uuid[])$$,
  '42501', null, 'anon is refused'
);
reset role;

-- --- last_check_ins: who learns what ---------------------------------------------------------------------------------

select is(pg_temp.seen('d2', array['d1', 'd3', 'd7']), array['d1 2026-10-05', 'd3 2026-10-09'],
  'the mentor gets the latest check-in day of each shop they mentor, a note and another mentor''s shop left out');
select is(pg_temp.seen('d5', array['d1', 'd3']), array['d1 2026-10-05', 'd3 2026-10-09'],
  'an admin with no shop gets both');
select is(pg_temp.seen('d1', array['d1', 'd3']), array['d3 2026-10-09'],
  'an admin who sells gets nothing about their own shop');
select is(pg_temp.seen('d3', array['d3']), '{}'::text[], 'the seller gets nothing about their own shop');
select is(pg_temp.seen('d4', array['d1', 'd3', 'd7']), array['d7 2026-10-07'],
  'another mentor gets only the shop they mentor');
savepoint gone;
update public.profiles set roles = '{}' where id = pg_temp.a('d2');
select is(pg_temp.seen('d2', array['d1', 'd3']), '{}'::text[], 'nor does a mentor whose role has gone');
rollback to savepoint gone;

-- --- set_shop_mentor tells the new mentor -----------------------------------------------------------------------------

select is(private.mentor_assigned_note_text('Sizwe sells'), 'You''re now mentoring Sizwe sells.', 'mentorAssignedText');
select is(pg_temp.assign('d5', 'd3', 'd6'), 'changed', 'Bongi makes Thabo the mentor of Sizwe''s shop');
select is(pg_temp.told('d6'), array['staff-role mc-sizwe /mentor/mc-sizwe You''re now mentoring Sizwe sells.'],
  'Thabo is told once, with a link to the shop''s mentor page');
select is(
  (select a.detail from public.audit_log a where a.action = 'mentor-assigned' and a.target_id = 'mc-sizwe'),
  'Thabo',
  'and the log names him, as before'
);
select is(pg_temp.assign('d5', 'd3', 'd6'), 'nothing', 'the same mentor again changes nothing');
select is(array_length(pg_temp.told('d6'), 1), 1, 'and tells nobody');
select is(pg_temp.assign('d5', 'd3', null), 'changed', 'a removal changes the shop');
select is(
  (select count(*) from public.notifications t where t.kind = 'staff-role' and t.subject_id = 'mc-sizwe'),
  1::bigint,
  'but tells nobody'
);
select is(pg_temp.assign('d1', 'd1', 'd6'), 'own-shop', 'Ada can''t choose her own shop''s mentor');
select is(array_length(pg_temp.told('d6'), 1), 1, 'so Thabo hears nothing more');
select is(pg_temp.assign('d4', 'd3', 'd4'), 'forbidden', 'a mentor can''t assign anyone');
select is(pg_temp.told('d4'), '{}'::text[], 'and nobody is told');

-- --- Deleting the shop takes the word away (POPIA) -----------------------------------------------------------------------

-- Sizwe deletes his account: his shop goes, and with it Thabo's "You're now mentoring Sizwe sells." (still there after
-- the removal above). If forget_account doesn't delete the shop row itself, its cascade does; either way the trigger runs.
do $$ begin perform public.forget_account('00000000-0000-4000-8000-0000000000d3'::uuid); end $$;
select is(pg_temp.told('d6'), '{}'::text[], 'deleting Sizwe''s account takes Thabo''s notification about his shop away');

-- --- A new link takes the word with it ----------------------------------------------------------------------------------

do $$ begin perform pg_temp.assign('d5', 'd7', 'd6'); end $$;
update public.shops set slug = 'mc-zola-bakes' where id = pg_temp.s('d7');
select is(pg_temp.told('d6'), array['staff-role mc-zola /mentor/mc-zola-bakes You''re now mentoring Zola bakes.'],
  'when Zola''s shop changes its link, Thabo''s notification links to the new one');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `supabase test db`
Expected: `52_mentor_caseload` fails (no `last_check_ins`, no `mentor_assigned_note_text`, no notification). The others pass.

- [ ] **Step 3: Write the migration** `supabase/migrations/20261025120000_mentor_caseload.sql`

```sql
-- Role views N4, the mentor caseload (role views spec 6 and 7.3; N4 plan Task 4, decisions 1 and 2).
-- - public.last_check_ins: the latest check-in day for each owner asked about, and nothing else: no text, no author,
--   no note. Each owner is checked with private.can_mentor, as the signed-in account: the shop's mentor (still holding
--   the role) or an admin, never the owner, an admin who sells included. lastCheckIns (lib/data/supabase/mentors.ts)
--   calls it with the viewer's own session. Security definer, as every function in public (06_account_actions).
-- - private.mentor_assigned_note_text: the sentence (mentorAssignedText, lib/staff/notification-text.ts).
-- - public.set_shop_mentor, replaced whole from 20261021120500_own_target_gate.sql: it now tells the new mentor
--   ("staff-role", the shop's link as its subject, to /mentor/<slug>), only when a mentor is given or changed; a
--   removal, "nothing", "own-shop" and "forbidden" tell no one (assignMentor, lib/staff/admin-actions.ts).
-- - private.forget_mentor_word_about_shop, after a shop is deleted: that notification goes too (POPIA).
-- - private.move_mentor_word_with_shop, after a shop's link changes: that notification's link follows it.

-- --- The sentence ------------------------------------------------------------------------------------------------------

create function private.mentor_assigned_note_text(shop text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'You''re now mentoring ' || shop || '.';
$$;

-- Built only inside the functions (16_staff_shop_actions).
revoke all on function private.mentor_assigned_note_text(text) from public, anon, authenticated, service_role;

-- --- last_check_ins ------------------------------------------------------------------------------------------------------

-- Returns one row per owner with a check-in that the signed-in account may read about; none for anyone else.
-- A user action for staff (advisor 0029 lists it on purpose).
create function public.last_check_ins(p_owners uuid[])
returns table (owner_id uuid, last_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, max(mn.check_in_on)
  from unnest(p_owners) as o(id)
  join public.mentor_notes mn on mn.owner_id = o.id and mn.kind = 'check-in'
  -- is_staff('mentor') is "a mentor or an admin": checked once, before can_mentor's per-owner rule.
  where (select private.is_staff('mentor')) and private.can_mentor(o.id)
  group by o.id;
$$;

revoke all on function public.last_check_ins(uuid[]) from public, anon;
grant execute on function public.last_check_ins(uuid[]) to authenticated, service_role;

-- --- Deleting a shop takes its mentor's word about it away (POPIA) --------------------------------------------------------

-- The "You're now mentoring {shop}" notification names a shop that no longer exists once its owner deletes their
-- account (the shop row goes with it). The sample store does the same in deleteAccountData (lib/data/accounts.ts).
create function private.forget_mentor_word_about_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n where n.kind = 'staff-role' and n.href = '/mentor/' || old.slug;
  return old;
end;
$$;

create trigger shops_forget_mentor_word
after delete on public.shops
for each row execute function private.forget_mentor_word_about_shop();

revoke all on function private.forget_mentor_word_about_shop() from public, anon, authenticated, service_role;

-- --- A shop's new link takes its mentor's word with it ------------------------------------------------------------------

-- change_shop_slug gives a shop a new link once (selling spec 2.11); the old one opens nothing. The notification's link
-- follows, so it never leads to the 404. Its subject keeps the link it was made with. The sample store does the same in
-- changeShopSlug (lib/data/shops.ts).
create function private.move_mentor_word_with_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications n
  set href = '/mentor/' || new.slug
  where n.kind = 'staff-role' and n.href = '/mentor/' || old.slug;
  return new;
end;
$$;

create trigger shops_move_mentor_word
after update of slug on public.shops
for each row when (old.slug is distinct from new.slug)
execute function private.move_mentor_word_with_shop();

revoke all on function private.move_mentor_word_with_shop() from public, anon, authenticated, service_role;

-- --- set_shop_mentor, replaced (from 20261021120500_own_target_gate.sql) ---------------------------------------------

-- A shop's mentor, as before (assignMentor), and now the new mentor is told.
-- Returns 'changed' | 'nothing' | 'own-shop' | 'forbidden' (admin).
-- A staff action (advisor 0029 lists it on purpose).
create or replace function public.set_shop_mentor(p_shop uuid, p_mentor uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  profile public.seller_profiles;
  shop public.shops;
  mentor_name text;
begin
  if not private.is_staff('admin') then
    return 'forbidden';
  end if;
  -- stage L: the admin's own (refuseOwn, lib/staff/admin-actions.ts), before the reason and every read for writing.
  if private.is_own_shop(p_shop) then
    return 'own-shop';
  end if;
  if p_mentor is not null then
    select p.first_name into mentor_name from public.profiles p where p.id = p_mentor and 'mentor' = any (p.roles)
    for share;
  end if;
  profile := private.lock_owned_shop(p_shop);
  if profile.account_id is null or profile.status = 'pending' then
    return 'nothing';
  end if;
  if p_mentor is not null then
    if mentor_name is null or p_mentor = profile.account_id then
      return 'nothing';
    end if;
  end if;
  if profile.mentor_id is not distinct from p_mentor then
    return 'nothing';
  end if;
  update public.seller_profiles sp set mentor_id = p_mentor where sp.account_id = profile.account_id;
  select * into shop from public.shops s where s.id = p_shop;
  perform private.record_audit(
    case when p_mentor is null then 'mentor-removed' else 'mentor-assigned' end, 'shop', shop.slug, shop.name,
    coalesce(mentor_name, ''), shop.owner_id, p_mentor
  );
  -- role views N4: the new mentor hears it, with a link to the shop's mentor page. A removal tells no one.
  if p_mentor is not null then
    perform private.notify(
      p_mentor, 'staff-role', shop.slug, private.mentor_assigned_note_text(shop.name), '/mentor/' || shop.slug
    );
  end if;
  return 'changed';
end;
$$;
```

Before saving, diff the body above against the latest `set_shop_mentor` (`grep -n "function public.set_shop_mentor" supabase/migrations/*.sql`; it should be `20261021120500_own_target_gate.sql:258`). Everything but the notify block must match it line for line; if a later migration replaced it, copy that one and add the block.

- [ ] **Step 4: Add the function to pgTAP 06's allowlist.** In `supabase/tests/06_account_actions.test.sql`, in "the user actions, and nothing else, run for signed-in users", add one line after `'hub_going(text)',`:

```sql
    'last_check_ins(uuid[])',
```

- [ ] **Step 5: Reset and run**

```bash
supabase db reset
```
```bash
supabase test db
```
Expected: every file passes, `52_mentor_caseload` with 25 tests, `06` and `16` unchanged in count. If a pgTAP file lists every trigger on `public.shops` (`grep -rn "tgname\|has_trigger" supabase/tests`), add `shops_forget_mentor_word` and `shops_move_mentor_word` to it.

- [ ] **Step 6: Regenerate the types**

```bash
pnpm db:types
```
Expected: `lib/supabase/database.types.ts` gains `last_check_ins` under `Functions`, with `Args: { p_owners: string[] }` and `Returns: { owner_id: string; last_on: string }[]`. Nothing else changes; if other lines change, another migration was applied since the file was last made: stop and ask.

- [ ] **Step 7: Commit (controller)**

```bash
git add supabase/migrations/20261025120000_mentor_caseload.sql supabase/tests/52_mentor_caseload.test.sql supabase/tests/06_account_actions.test.sql lib/supabase/database.types.ts
git commit -m "feat(db): last_check_ins gives a check-in's day only, through can_mentor; set_shop_mentor tells the new mentor (role views N4 Task 4)"
```

---

### Task 5: `lastCheckIns` and the new `mentoredShops`, on both backends

**Files:**
- Modify: `lib/data/mentors.ts`, `lib/data/supabase/mentors.ts`
- Test: `lib/data/mentors.test.ts`, `lib/data/contract/mentors.contract.ts`

- [ ] **Step 1: Write the failing tests.** In `lib/data/mentors.test.ts`:

Change the import to `import { addNote, getMentoredShop, lastCheckIns, listNotes, mentoredShops } from "./mentors";`.

In the first case's expected row, add `lastCheckInOn: "2026-10-06",` after `flags: [],`.

Replace the case "flags a paused shop, and one with no enquiries in the 14 days" with:

```ts
  it("flags a shop the seller paused, and one with no enquiries in the 14 days", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    const later = new Date("2026-11-14T10:00:00.000Z");
    expect((await mentoredShops(naledi, later))[0].flags).toEqual(["no-enquiries", "paused-by-seller"]);
  });

  it("says No listings yet when nothing is up for buyers (role views spec 7.3)", async () => {
    for (const listing of sampleStore().listings.values()) {
      if (listing.sellerSlug === "tech-corner") listing.state = "sold";
    }
    expect((await mentoredShops(naledi, NOW))[0].flags).toEqual(["no-listings"]);
  });
```

Append a new `describe`:

```ts
describe("the caseload's check-ins and order (role views spec 6, N4)", () => {
  it("gives the latest check-in's day, never its text, and nothing about the viewer's own shop", async () => {
    expect(await lastCheckIns(naledi, ["acc-seller"])).toEqual(new Map([["acc-seller", "2026-10-06"]]));
    expect(await lastCheckIns(pieter, ["acc-seller"])).toEqual(new Map([["acc-seller", "2026-10-06"]]));
    expect(await lastCheckIns(zanele, ["acc-seller"])).toEqual(new Map());
    // Sipho, made an admin, learns nothing about his own shop; as its owner, nothing either.
    expect(await lastCheckIns({ id: "acc-seller", roles: ["admin"] }, ["acc-seller"])).toEqual(new Map());
    expect(await lastCheckIns({ id: "acc-seller", roles: [] }, ["acc-seller"])).toEqual(new Map());
  });

  it("takes the latest check-in, not the latest written, and leaves notes out", async () => {
    await addNote({
      ownerId: "acc-seller",
      kind: "check-in",
      checkInOn: "2026-10-02",
      text: "An older check-in, written later.",
      author: { id: "acc-mentor", firstName: "Naledi" },
      now: NOW,
    });
    await addNote({
      ownerId: "acc-seller",
      kind: "note",
      checkInOn: null,
      text: "A note today.",
      author: { id: "acc-mentor", firstName: "Naledi" },
      now: NOW,
    });
    expect((await lastCheckIns(naledi, ["acc-seller"])).get("acc-seller")).toBe("2026-10-06");
  });

  it("puts the shops with the most flags first, then the longest without a check-in, then by name", async () => {
    const store = sampleStore();
    // Naledi mentors a second shop with no check-in (Lerato's, approved here by hand, then paused by the Hub): no
    // listings and the Hub's pause give it two flags.
    Object.assign(store.sellerProfiles.get("acc-pending")!, {
      sellerSlug: "crochet-corner",
      mentorId: "acc-mentor",
      status: "paused",
      pausedBy: "staff",
    });
    const rows = await mentoredShops(naledi, NOW);
    expect(rows.map((row) => row.slug)).toEqual(["crochet-corner", "tech-corner"]);
    expect(rows[0]).toMatchObject({ flags: expect.arrayContaining(["paused-by-hub"]), lastCheckInOn: null });
  });
});
```

The last case turns the waiting sample shop (`acc-pending`, whose fixture profile has `sellerSlug: null`, `data/fixtures/accounts.ts:58`; its shop is `crochet-corner`, `data/fixtures/shops.ts:13`) into a paused, mentored one by hand. If `crochet-corner` has available listings in the store, its flags are `["no-enquiries", "paused-by-hub"]`: still two, still first.

In `lib/data/contract/mentors.contract.ts`: change the import to `import { addNote, getMentoredShop, lastCheckIns, listNotes, mentoredShops } from "@/lib/data/mentors";`; in the first case's expected row replace `flags: expect.arrayContaining(["no-enquiries"]),` with:

```ts
        flags: ["no-listings"],
        lastCheckInOn: null,
```

and append inside `mentorsContract`:

```ts
  it("gives the latest check-in day per owner, never text, and nothing about the viewer's own shop (role views spec 6)", async () => {
    const [shopperId, staffId] = await Promise.all([world.signedIn("shopper"), world.signedIn("staff")]);
    await world.setRoles("asker", ["mentor"]);
    await world.setMentor(await world.openShop("shopper"), "asker");
    await world.setMentor(await world.openShop("staff"), "asker");
    const DAY = 86_400_000;
    const now = Date.now();
    await note("asker", "shopper", "Talked about photos.", new Date(now - 3 * DAY), true);
    await note("asker", "shopper", "Priced the calculators.", new Date(now - DAY), true);
    await note("asker", "shopper", "A note, not a check-in.", new Date(now));
    await note("asker", "staff", "Met the admin who sells.", new Date(now - 2 * DAY), true);
    const seen = (name: WorldAccountName, owners: string[]) =>
      world.asViewer(name, async () => lastCheckIns(await world.viewerAccount(name), owners));
    const shopperDay = sastDate(new Date(now - DAY));
    const staffDay = sastDate(new Date(now - 2 * DAY));

    expect(await seen("asker", [shopperId, staffId])).toEqual(new Map([[shopperId, shopperDay], [staffId, staffDay]]));
    // An admin who sells learns nothing about their own shop; its owner nothing; another mentor nothing.
    expect(await seen("staff", [shopperId, staffId])).toEqual(new Map([[shopperId, shopperDay]]));
    expect(await seen("shopper", [shopperId])).toEqual(new Map());
    await world.setRoles("seller", ["mentor"]);
    expect(await seen("seller", [shopperId, staffId])).toEqual(new Map());
    // Days only.
    for (const day of (await seen("asker", [shopperId, staffId])).values()) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("puts the shops with the most flags first, then the longest without a check-in, then by name (role views spec 6)", async () => {
    await world.setRoles("asker", ["mentor"]);
    const shopper = await world.openShop("shopper");
    const seller = await world.openShop("seller");
    await world.setMentor(shopper, "asker");
    await world.setMentor(seller, "asker");
    const order = async () => (await shopsFor("asker")).map((shop) => shop.slug);
    // One flag each (no listings yet) and no check-ins: by name, "Contract Seller's shop" first.
    expect(await order()).toEqual([seller, shopper]);
    // A check-in at Seller's: Shopper's has gone longer without one.
    await note("asker", "seller", "Checked in about the first listing.", new Date(), true);
    expect(await order()).toEqual([shopper, seller]);
    // Seller's is paused by its seller: two flags beat one.
    await world.pauseShop(seller, "seller");
    expect(await order()).toEqual([seller, shopper]);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/mentors.test.ts lib/data/contract/mentors.test.ts`
Expected: FAIL (`lastCheckIns` missing, old order and flags).

- [ ] **Step 3: Implement the sample store.** Replace lines 1–53 of `lib/data/mentors.ts` (imports, header comment and `mentoredShops`) with:

```ts
import { randomUUID } from "node:crypto";
import { onSupabase } from "@/lib/backend";
import { byNeed, MENTOR_WINDOW_DAYS, mentorFlags } from "@/lib/staff/mentor";
import { isAdmin } from "@/lib/staff/roles";
import { sastDate } from "@/lib/time";
import type { Account, MentoredShop } from "@/lib/types";
import type { MentorNoteRow, SellerProfileRow } from "./rows";
import { currentOf, recentCounts } from "./shop-stats";
import { sampleStore } from "./store";

// The mentor dashboard's data (staff tools spec 2.6; plan decisions 15 and 16; role views spec 6 and 7.3). A mentor
// sees the shops assigned to them; an admin sees every assigned shop; nobody sees their own. Each has its last 14 days'
// numbers, its flags and its last check-in's day, most in need first: numbers, never messages (FUNCTION-MAP K1), and a
// check-in's day, never what was said. Notes and check-ins are about the shop's owner, shared with every mentor and
// admin who can open the shop's page, and never shown to the seller. Times come from the caller.
//
// On Supabase (C4/C5 plan Task 19) mentoredShops, lastCheckIns, listNotes and addNote are lib/data/supabase/mentors.ts's,
// picked by their first line through import(); getMentoredShop goes through mentoredShops.

const supabase = () => import("./supabase/mentors");

const DELETED = "Deleted account";

type Viewer = Pick<Account, "id" | "roles">;

/**
 * Whether `viewer` may follow the shop on this seller profile, private.can_mentor's rule (amendment 15.3): it has a
 * mentor, isn't waiting and has a shop; the viewer isn't its owner, and is its mentor still holding the role, or an
 * admin.
 */
function mayMentor(
  viewer: Viewer,
  profile: SellerProfileRow | undefined,
): profile is SellerProfileRow & { mentorId: string; sellerSlug: string } {
  if (!profile?.mentorId || profile.status === "pending" || !profile.sellerSlug) return false;
  if (profile.accountId === viewer.id) return false;
  return isAdmin(viewer) || (profile.mentorId === viewer.id && viewer.roles.includes("mentor"));
}

/** The shops `viewer` may follow (plan decision 15): theirs, or for an admin every assigned shop. Most in need first. */
export async function mentoredShops(viewer: Viewer, now: Date): Promise<MentoredShop[]> {
  if (onSupabase()) return (await supabase()).mentoredShops(viewer, now);
  const { sellerProfiles, sellers, accounts, listings } = sampleStore();
  // Listings a buyer could ask about: available, and not hidden by the Hub.
  const available = new Map<string, number>();
  for (const listing of listings.values()) {
    if (listing.state !== "available" || listing.hiddenAt) continue;
    available.set(listing.sellerSlug, (available.get(listing.sellerSlug) ?? 0) + 1);
  }
  const rows: MentoredShop[] = [];
  for (const profile of sellerProfiles.values()) {
    if (!mayMentor(viewer, profile)) continue;
    const shop = sellers.get(profile.sellerSlug);
    const owner = accounts.get(profile.accountId);
    if (!shop || !owner) continue;
    // The current window alone (N2's currentOf): the shop page reads the window before itself (Task 10).
    const counts = currentOf(await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now));
    const pausedBy = profile.status === "paused" ? (profile.pausedBy ?? null) : null;
    rows.push({
      slug: shop.slug,
      name: shop.name,
      campusSlug: shop.campusSlug,
      ownerName: owner.firstName,
      ownerId: owner.id,
      badge: shop.badge,
      status: profile.status,
      pausedBy,
      mentorId: profile.mentorId,
      mentorName: accounts.get(profile.mentorId)?.firstName ?? DELETED,
      counts,
      flags: mentorFlags({
        counts,
        status: profile.status,
        pausedBy,
        availableListings: available.get(shop.slug) ?? 0,
      }),
      lastCheckInOn: null,
    });
  }
  const checkIns = await lastCheckIns(viewer, rows.map((row) => row.ownerId));
  return rows
    .map((row) => ({ ...row, lastCheckInOn: checkIns.get(row.ownerId) ?? null }))
    .sort(byNeed(sastDate(now)));
}

/**
 * The latest check-in's day for each owner `viewer` may follow (role views spec 6; N4 plan decision 2): a map from the
 * owner's account to YYYY-MM-DD. The day only, never what was said, and nothing about the viewer's own shop or a shop
 * they don't follow, as private.can_mentor decides on Supabase.
 */
export async function lastCheckIns(viewer: Viewer, ownerIds: readonly string[]): Promise<Map<string, string>> {
  if (onSupabase()) return (await supabase()).lastCheckIns(viewer, ownerIds);
  const { sellerProfiles, mentorNotes } = sampleStore();
  const allowed = new Set(ownerIds.filter((id) => mayMentor(viewer, sellerProfiles.get(id))));
  const latest = new Map<string, string>();
  for (const row of mentorNotes.values()) {
    if (row.kind !== "check-in" || row.checkInOn === null || !allowed.has(row.ownerId)) continue;
    const seen = latest.get(row.ownerId);
    if (seen === undefined || row.checkInOn > seen) latest.set(row.ownerId, row.checkInOn);
  }
  return latest;
}
```

The rest of the file (`getMentoredShop`, `MentorNoteView`, `listNotes`, `addNote`) is unchanged. `getMentoredShop` now also returns `lastCheckInOn`, which the shop page shows (Task 10).

- [ ] **Step 4: Implement the Supabase twin.** In `lib/data/supabase/mentors.ts`, change the imports' first lines to:

```ts
import "server-only";
import { byNeed, MENTOR_WINDOW_DAYS, mentorFlags } from "@/lib/staff/mentor";
import { sastDate } from "@/lib/time";
import type { MentoredShop, SellerStatus, TrustBadge } from "@/lib/types";
```

keep N2's `import { currentOf, recentCounts } from "../shop-stats";`, and add, after `firstNames`:

```ts
/** Each shop's listings a buyer could ask about (available, not hidden), a hundred shops a request: the viewer reads them as their mentor or an admin. */
async function availableCounts(client: DbClient, shopIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let from = 0; from < shopIds.length; from += 100) {
    const rows = await selectAll(
      () =>
        client
          .from("listings")
          .select("id, shop_id")
          .in("shop_id", shopIds.slice(from, from + 100))
          .eq("state", "available")
          .is("hidden_at", null),
      ["id"],
    );
    for (const row of rows) counts.set(row.shop_id, (counts.get(row.shop_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * The latest check-in day per owner through public.last_check_ins, with `client`'s session, so private.can_mentor
 * decides (role views spec 6): days only, nothing about the viewer's own shop. A hundred owners a call.
 */
async function checkInsWith(client: DbClient, ownerIds: readonly string[]): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  const unique = [...new Set(ownerIds)];
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await client.rpc("last_check_ins", { p_owners: unique.slice(from, from + 100) });
    if (error) failed("last_check_ins", error);
    for (const row of data ?? []) latest.set(row.owner_id, row.last_on);
  }
  return latest;
}
```

and replace `mentoredShops` (lines 38–90) with:

```ts
export const mentoredShops: typeof Sample.mentoredShops = async (viewer, now) => {
  const client = await forViewerAs(viewer.id);
  const profiles = (
    await selectAll(
      () =>
        client
          .from("staff_seller_profiles")
          .select("account_id, status, shop_id, paused_by, mentor_id")
          .not("mentor_id", "is", null)
          .neq("status", "pending")
          .not("shop_id", "is", null),
      ["account_id"],
    )
  ).filter((row) => row.account_id !== viewer.id);
  if (profiles.length === 0) return [];
  const shopIds = profiles.map((row) => row.shop_id!);
  const shops = new Map<string, { slug: string; name: string; campus_slug: string; badge: string | null }>();
  for (let from = 0; from < shopIds.length; from += 100) {
    const { data, error } = await client
      .from("shops")
      .select("id, slug, name, campus_slug, badge")
      .in("id", shopIds.slice(from, from + 100));
    if (error) failed("shops", error);
    for (const row of data) shops.set(row.id, row);
  }
  const [names, available, checkIns] = await Promise.all([
    firstNames(client, profiles.flatMap((row) => [row.account_id!, row.mentor_id!])),
    availableCounts(client, shopIds),
    checkInsWith(client, profiles.map((row) => row.account_id!)),
  ]);
  const rows: MentoredShop[] = [];
  for (const profile of profiles) {
    const shop = shops.get(profile.shop_id!);
    const ownerName = names.get(profile.account_id!);
    if (!shop || ownerName === undefined) continue;
    const status = profile.status as SellerStatus;
    const pausedBy = status === "paused" ? ((profile.paused_by as "seller" | "staff" | null) ?? null) : null;
    const counts = currentOf(await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now));
    rows.push({
      slug: shop.slug,
      name: shop.name,
      campusSlug: shop.campus_slug,
      ownerName,
      ownerId: profile.account_id!,
      badge: shop.badge as TrustBadge | null,
      status,
      pausedBy,
      mentorId: profile.mentor_id!,
      mentorName: names.get(profile.mentor_id!) ?? DELETED,
      counts,
      flags: mentorFlags({ counts, status, pausedBy, availableListings: available.get(profile.shop_id!) ?? 0 }),
      lastCheckInOn: checkIns.get(profile.account_id!) ?? null,
    });
  }
  return rows.sort(byNeed(sastDate(now)));
};

/** The latest check-in day per owner, read with the viewer's session (N4 plan decision 2). */
export const lastCheckIns: typeof Sample.lastCheckIns = async (viewer, ownerIds) =>
  ownerIds.length === 0 ? new Map() : checkInsWith(await forViewerAs(viewer.id), ownerIds);
```

Update the file's header comment: after "the 14-day numbers are C1's recentCounts (the admin client, request-time)", add "; the last check-in's day comes from public.last_check_ins with the viewer's session (role views N4)".

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run lib/data/mentors.test.ts lib/data/contract/mentors.test.ts lib/staff
```
Expected: PASS.

```bash
pnpm test:db lib/data/contract/mentors.db.test.ts
```
Expected: PASS: the contract on the stack, and the seed parity cases (the seed's check-in on 6 October is on both sides).

```bash
pnpm typecheck
```
Expected: errors only in `components/staff/MentorDashboard*`, `components/staff/MentorShop*` and `app/mentor/**` (Tasks 8–10). None under `lib/`.

- [ ] **Step 6: Commit (controller), with Task 2**

```bash
git add lib/types.ts lib/staff/mentor.ts lib/staff/mentor.test.ts lib/data/mentors.ts lib/data/supabase/mentors.ts lib/data/mentors.test.ts lib/data/contract/mentors.contract.ts
git commit -m "feat(mentor): caseload most in need first, No listings yet, whose pause, and lastCheckIns (day only, can_mentor) on both backends (role views N4 Tasks 2 and 5)"
```

---

### Task 6: The CSV follows the new words

**Files:**
- Test: `app/mentor/export/route.test.ts`

The CSV code needs no change (`mentorCsv` reads `FLAG_WORDS`, Task 2). This task proves the route still sends it.

- [ ] **Step 1: Run the route's test**

Run: `pnpm vitest run app/mentor/export/route.test.ts`
Expected: PASS. If an assertion names an old flag ("Shop paused"), change it to the new label ("Paused by the seller" or "Paused by the Hub", as its fixture's `pausedBy` says) and note it in "Changes made during the build".

- [ ] **Step 2: Commit (controller), only if the test changed**

```bash
git add app/mentor/export/route.test.ts
git commit -m "test(mentor): the CSV's flags in the new words (role views N4 Task 6)"
```

---

### Task 7: Assigning a mentor tells them

**Files:**
- Modify: `lib/staff/notification-text.ts`, `lib/staff/admin-actions.ts` (`assignMentor`, line 337), `lib/staff/notices.ts` (line 12), `app/privacy/page.tsx` (lines 183–187)
- Modify: `lib/data/accounts.ts` (`deleteAccountData`, beside `forgetFollowsOf`, line 313), `lib/data/shops.ts` (`changeShopSlug`, line 217)
- Test: `lib/staff/notification-text.test.ts`, `lib/staff/admin-actions.test.ts`, `lib/staff/contract/admin-gates.contract.ts` (line 264), `app/privacy/page.test.tsx` (line 394), `lib/data/accounts.test.ts`, `lib/data/shops.test.ts`

- [ ] **Step 1: Write the failing tests**

In `lib/staff/notification-text.test.ts`, add `mentorAssignedText` to the import and this case inside the existing `describe`:

```ts
  it("tells a mentor which shop they now mentor (role views spec 7.3)", () => {
    expect(mentorAssignedText("Tech corner")).toBe("You're now mentoring Tech corner.");
  });
```

In `lib/staff/admin-actions.test.ts`, inside the `describe` that holds "assigns a mentor, or none, only from the accounts with the mentor role", add:

```ts
  it("tells the new mentor, with a link to the shop's mentor page; a removal or the same mentor again tells no one (role views spec 7.3)", async () => {
    await asAdmin();
    const toldNaledi = async () =>
      (await getNotifications("acc-mentor", 50)).filter((note) => note.kind === "staff-role");
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "" })));
    expect(await notice()).toBe("mentor-removed");
    expect(await toldNaledi()).toEqual([]);
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-mentor" })));
    expect(await toldNaledi()).toMatchObject([
      { kind: "staff-role", text: "You're now mentoring Tech corner.", href: "/mentor/tech-corner" },
    ]);
    await redirectOf(() => assignMentor(form({ shop: "tech-corner", mentor: "acc-mentor" })));
    expect(await notice()).toBe("nothing");
    expect(await toldNaledi()).toHaveLength(1);
  });
```

In `lib/staff/contract/admin-gates.contract.ts`, replace line 264:

```ts
    expect(await changes(assignMentor, { shop: slug, mentor: shopperId })).toMatchObject({ notice: "mentor-assigned", audit: 1, told: {}, tags: [] });
```

with:

```ts
    // The new mentor is told, with the shop's mentor page (role views spec 7.3); the same mentor again tells no one.
    expect(await changes(assignMentor, { shop: slug, mentor: shopperId })).toMatchObject({
      notice: "mentor-assigned",
      audit: 1,
      told: { shopper: ["staff-role"] },
      texts: { shopper: [expect.stringMatching(/^You're now mentoring .+\.$/)] },
      tags: [],
    });
```

Leave line 265 (the same post again: `notice: "nothing", audit: 0`) as it is, and add after it:

```ts
    expect(await changes(assignMentor, { shop: slug, mentor: "" })).toMatchObject({ notice: "mentor-removed", audit: 1, told: {} });
```

In `app/privacy/page.test.tsx`, in "lists every kind of notification, and what a staff role keeps" (line 394), change

```ts
    expect(account).toHaveTextContent(/your staff role changes\. Only you see them\./);
```

to

```ts
    expect(account).toHaveTextContent(/your staff role changes, or an admin asks you to mentor a shop\. Only you see them\./);
```

In `lib/data/accounts.test.ts`, inside the `describe` that holds "forgets the account in the staff tools" (after it), add:

```ts
  it("takes away a mentor's \"You're now mentoring\" notification about the deleted seller's shop, and nothing else (role views N4, POPIA)", async () => {
    const store = sampleStore();
    const note = (id: string, subjectId: string, text: string, href: string) =>
      store.notifications.set(id, {
        id,
        accountId: "acc-mentor",
        kind: "staff-role",
        subjectId,
        text,
        href,
        createdAt: NOW.toISOString(),
        readAt: null,
      });
    note("note-mentoring", "tech-corner", "You're now mentoring Tech corner.", "/mentor/tech-corner");
    note("note-role", "mentor", "You're a CampusCart mentor now.", "/account");
    await deleteAccountData("acc-seller");
    expect(store.notifications.has("note-mentoring")).toBe(false);
    expect(store.notifications.has("note-role")).toBe(true);
  });
```

In `lib/data/shops.test.ts`, add after the case that changes Tech corner's link to "gadgets" (line 190):

```ts
  it("moves a mentor's \"You're now mentoring\" notification to the shop's new link (role views N4)", async () => {
    const store = sampleStore();
    store.notifications.set("note-mentoring", {
      id: "note-mentoring",
      accountId: "acc-mentor",
      kind: "staff-role",
      subjectId: "tech-corner",
      text: "You're now mentoring Tech corner.",
      href: "/mentor/tech-corner",
      createdAt: NOW.toISOString(),
      readAt: null,
    });
    expect(await changeShopSlug("acc-seller", "gadgets", NOW)).toBe("changed");
    expect(store.notifications.get("note-mentoring")?.href).toBe("/mentor/gadgets");
  });
```

If `NotificationRow` (`lib/data/rows.ts:223`) has a required field these rows lack (such as `count`), add it with its "none" value.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/staff/notification-text.test.ts lib/staff/admin-actions.test.ts lib/staff/contract/admin-gates.test.ts app/privacy/page.test.tsx lib/data/accounts.test.ts`
Expected: FAIL (no sentence, nobody told, the old privacy words, the notification kept).

- [ ] **Step 3: Implement**

Append to `lib/staff/notification-text.ts`:

```ts
/** A shop given to a mentor, for the mentor, with the "staff-role" kind (role views spec 7.3, N4 plan decision 1). */
export function mentorAssignedText(shop: string): string {
  return `You're now mentoring ${shop}.`;
}
```

In `lib/staff/admin-actions.ts`, add `mentorAssignedText` to the `./notification-text` import and `mentorShopPath` to the `./paths` import, then replace `assignMentor` (lines 336–360) with:

```ts
/**
 * A shop's mentor (spec 2.6, plan decision 15): `mentor` is an account with the mentor role, or "" for none. The new
 * mentor is told, with a link to the shop's mentor page (role views spec 7.3); a removal tells no one. On Supabase
 * set_shop_mentor sends it in its own transaction.
 */
export async function assignMentor(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaffAction("admin", path);
  const now = new Date();
  if (slug && await ownsShop(staff.id, slug)) return refuseOwn("shop", path, now);
  const raw = field(formData, "mentor");
  const mentorId = raw === "" ? null : isId(raw) ? raw : undefined;
  const changed = slug && mentorId !== undefined ? await decide(setShopMentor(slug, mentorId), path, now) : null;
  if (!changed) return nothingChanged(path, now);
  await sampleFollowUps(async () => {
    await recordAudit({
      staff: staffOf(staff),
      action: changed.mentorName ? "mentor-assigned" : "mentor-removed",
      target: { kind: "shop", id: changed.slug, name: changed.name },
      detail: changed.mentorName ?? "",
      subjectId: changed.ownerId,
      // The detail names the new mentor (a removal names no one), so deleting their account can forget it.
      relatedId: changed.mentorName ? mentorId : null,
      now,
    });
    if (changed.mentorName && typeof mentorId === "string") {
      await notify({
        accountId: mentorId,
        kind: "staff-role",
        subjectId: changed.slug,
        text: mentorAssignedText(changed.name),
        href: mentorShopPath(changed.slug),
        now,
      });
    }
  });
  await leaveNotice(changed.mentorName ? "mentor-assigned" : "mentor-removed", now);
  done(path);
}
```

`notify` is already imported (line 9).

In `lib/staff/notices.ts`, change line 12 to:

```ts
  ["mentor-assigned", "Mentor saved. They've been told."],
```

In `app/privacy/page.tsx`, in "Your notifications" (lines 183–187), change

```
            hours, or your staff role changes. Only you see them.
```

to

```
            hours, your staff role changes, or an admin asks you to mentor a shop. Only you see them.
```

In `lib/data/accounts.ts`, add `import { mentorShopPath } from "@/lib/staff/paths";` and, in `deleteAccountData`, right after `await forgetFollowsOf(accountId);` (line 313, while the shop's link is still known), add:

```ts
  // A mentor's "You're now mentoring {shop}" names this account's shop: it goes with the shop (role views N4, POPIA).
  // On Supabase the shops table's trigger does it (private.forget_mentor_word_about_shop).
  const ownSlug = store.sellerProfiles.get(accountId)?.sellerSlug ?? null;
  if (ownSlug) {
    for (const [id, row] of store.notifications) {
      if (row.kind === "staff-role" && row.href === mentorShopPath(ownSlug)) store.notifications.delete(id);
    }
  }
```

In `lib/data/shops.ts`, add `import { mentorShopPath } from "@/lib/staff/paths";` and, in `changeShopSlug`, right after `moveShop(own.shop.slug, slug);` (line 224):

```ts
  // A mentor's "You're now mentoring" follows the shop to its new link (role views N4). On Supabase the shops table's
  // trigger does it (private.move_mentor_word_with_shop).
  for (const note of sampleStore().notifications.values()) {
    if (note.kind === "staff-role" && note.href === mentorShopPath(own.shop.slug)) note.href = mentorShopPath(slug);
  }
```

`lib/staff/paths.ts` imports only types, so `lib/data` may import it without a cycle.

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run lib/staff app/privacy lib/data/accounts.test.ts lib/data/shops.test.ts
```
Expected: PASS. If `lib/staff/notices.test.ts` lists every notice's words, update "Mentor saved." there too.

```bash
pnpm test:db lib/staff/contract/admin-gates.db.test.ts
```
Expected: PASS: on the stack the notification comes from `set_shop_mentor` (Task 4), with the same kind and words.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/staff/notification-text.ts lib/staff/notification-text.test.ts lib/staff/admin-actions.ts lib/staff/admin-actions.test.ts lib/staff/notices.ts lib/staff/contract/admin-gates.contract.ts app/privacy/page.tsx app/privacy/page.test.tsx lib/data/accounts.ts lib/data/accounts.test.ts lib/data/shops.ts lib/data/shops.test.ts
git commit -m "feat(staff): assigning a mentor tells them, linking to the shop's mentor page, never on a removal or no change (role views N4 Task 7)"
```

---

### Task 8: The caseload component

**Files:**
- Modify: `components/staff/MentorDashboard.tsx` (rewritten), `app/globals.css` (new block at the end)
- Test: `components/staff/MentorDashboard.test.tsx` (rewritten)

- [ ] **Step 1: Write the failing tests.** Replace `components/staff/MentorDashboard.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MentoredShop } from "@/lib/types";
import { MentorDashboard } from "./MentorDashboard";

const TODAY = "2026-10-14";
const DAYS = Array.from({ length: 14 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);

const shop = (overrides: Partial<MentoredShop>): MentoredShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "approved",
  pausedBy: null,
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: { enquiries: 11, due: 9, repliedInTime: 9, salesConfirmed: 1 },
  flags: [],
  lastCheckInOn: "2026-10-06",
  ...overrides,
});

const tech = shop({});
const lash = shop({
  slug: "lash-lounge",
  name: "Lash lounge",
  ownerId: "acc-lash",
  badge: null,
  counts: { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 },
  flags: ["no-listings"],
  lastCheckInOn: null,
});
const names = new Map([["midrand", "Midrand"]]);
const daily = new Map<string, (number | null)[]>([
  ["tech-corner", [0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 2, 5, 0]],
  ["lash-lounge", [null, null, null, null, null, null, null, null, null, null, null, null, 0, 0]],
]);

function show(props: Partial<Parameters<typeof MentorDashboard>[0]> = {}) {
  render(
    <MentorDashboard
      rows={[lash, tech]}
      view="needs"
      showMentor={false}
      campusNames={names}
      slotRequests={2}
      daily={daily}
      days={DAYS}
      today={TODAY}
      {...props}
    />,
  );
}

describe("the mentor caseload (role views spec 7.3)", () => {
  it("sums up who needs you, and offers Needs you and All as one control", () => {
    show();
    const card = screen.getByRole("region", { name: "Your shops" });
    expect(within(card).getByText("1 of 2 need you · 2 slot requests")).toBeInTheDocument();
    const segments = within(card).getByRole("navigation", { name: "Which shops" });
    expect(within(segments).getByRole("link", { name: "Needs you (1)" })).toHaveAttribute("aria-current", "page");
    expect(within(segments).getByRole("link", { name: "All (2)" })).toHaveAttribute("href", "/mentor?view=all");
  });

  it("lists only the shops that need you, each a row with its initials, its flags in words and its check-in", () => {
    show();
    const list = screen.getByRole("list", { name: "Shops that need you" });
    const rows = within(list).getAllByRole("link");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("href", "/mentor/lash-lounge");
    expect(rows[0]).toHaveAccessibleName(/^Lash lounge\s+Nothing is up for buyers yet/);
    expect(rows[0]).toHaveTextContent("Check-in: Due");
    expect(within(rows[0]).getByText("LL")).toHaveAttribute("aria-hidden", "true");
    expect(rows[0]).toHaveTextContent("Midrand");
  });

  it("lists every shop under All, a quiet one with no flags and how long since its check-in", () => {
    show({ view: "all" });
    const rows = within(screen.getByRole("list", { name: "All shops" })).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("href"))).toEqual(["/mentor/lash-lounge", "/mentor/tech-corner"]);
    expect(rows[1]).toHaveTextContent("No flags.");
    expect(rows[1]).toHaveTextContent("Check-in: 8 days ago");
  });

  it("says All clear when no shop needs you, with the way to every shop", () => {
    show({ rows: [tech] });
    expect(screen.getByText(/^All clear/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all 1 shop" })).toHaveAttribute("href", "/mentor?view=all");
    expect(screen.queryByRole("region", { name: "Enquiries, 14 days" })).toBeNull();
  });

  it("offers office hours while no shop is assigned yet", () => {
    show({ rows: [] });
    expect(screen.getByRole("heading", { name: "No shops yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Office hours" })).toHaveAttribute("href", "/hub/manage#hub-queue");
    expect(screen.queryByRole("navigation", { name: "Which shops" })).toBeNull();
  });

  it("names every shop's mentor for an admin, under its own heading", () => {
    show({ view: "all", showMentor: true });
    expect(screen.getByRole("region", { name: "Every mentored shop" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Mentor: Naledi\./ })).toHaveLength(2);
  });

  it("draws one small chart per shop in the view, on one scale, each with its takeaway", () => {
    show({ view: "all" });
    const chart = screen.getByRole("region", { name: "Enquiries, 14 days" });
    expect(within(chart).getByRole("img", { name: "Tech corner: 11 enquiries in 14 days, 0 today." })).toBeInTheDocument();
    // Two known days of 0 on a scale whose largest is 5: a flat line, not words.
    expect(within(chart).getByRole("img", { name: "Lash lounge: 0 enquiries in 2 days, 0 today." })).toBeInTheDocument();
    expect(chart.querySelectorAll("polyline").length).toBeGreaterThanOrEqual(2);
  });

  it("says the chart didn't load, and leaves the rows working", () => {
    show({ daily: null });
    expect(screen.getByText("The enquiries chart didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/mentor");
    expect(screen.getByRole("list", { name: "Shops that need you" })).toBeInTheDocument();
  });

  it("leaves out the slot requests when they couldn't be counted", () => {
    show({ slotRequests: null });
    expect(screen.getByText("1 of 2 need you")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/staff/MentorDashboard.test.tsx`
Expected: FAIL (the old table).

- [ ] **Step 3: Implement.** Replace `components/staff/MentorDashboard.tsx` with:

```tsx
import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import { CheckIcon, StoreIcon } from "@/components/icons";
import { Card } from "@/components/kit/Card";
import { EmptyState } from "@/components/kit/EmptyState";
import { ListRow } from "@/components/kit/ListRow";
import { Pill } from "@/components/kit/Pill";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { dayMonth } from "@/lib/format";
import {
  caseloadDetail,
  caseloadSummary,
  checkInDue,
  checkInWords,
  needsYou,
  sharedMax,
  sparkSummary,
} from "@/lib/staff/mentor";
import { HUB_MANAGE_PATH, MENTOR_PATH, mentorShopPath } from "@/lib/staff/paths";
import type { MentoredShop } from "@/lib/types";

export type CaseloadView = "needs" | "all";

type MentorDashboardProps = {
  /** The whole caseload, most in need first (mentoredShops). */
  rows: readonly MentoredShop[];
  view: CaseloadView;
  /** An admin sees every assigned shop, with its mentor (plan decision 15). */
  showMentor: boolean;
  campusNames: ReadonlyMap<string, string>;
  /** Slot requests waiting (openBookingCount), or null when they couldn't be counted. */
  slotRequests: number | null;
  /** Enquiries a day by shop, oldest first (dailyEnquiriesFor), or null when the read failed. */
  daily: ReadonlyMap<string, readonly (number | null)[]> | null;
  /** The days `daily` covers, YYYY-MM-DD in SAST, for the numbers tables. */
  days: readonly string[];
  /** Today in SAST, for the check-in chips. */
  today: string;
};

const ALL_PATH = `${MENTOR_PATH}?view=all`;

/**
 * The mentor's caseload (role views spec 7.3): who needs you now, as rows that each open the shop's mentor page, and a
 * small chart per shop on one scale. Numbers, never messages; a check-in's age, never what was said. The words are
 * samples for Lama to change.
 */
export function MentorDashboard({
  rows,
  view,
  showMentor,
  campusNames,
  slotRequests,
  daily,
  days,
  today,
}: MentorDashboardProps) {
  const needing = rows.filter((row) => needsYou(row, today));
  const shown = view === "all" ? rows : needing;
  const scale = daily ? sharedMax(daily.values()) : 0;
  const labels = days.map((day) => dayMonth(day));
  return (
    <div className="mentor-home">
      <Card title={showMentor ? "Every mentored shop" : "Your shops"} level={2}>
        <p className="mentor-summary">{caseloadSummary(needing.length, rows.length, slotRequests)}</p>
        {rows.length === 0 ? (
          <EmptyState
            icon={<StoreIcon />}
            title="No shops yet"
            line="An admin assigns shops to mentors on each shop's page. Meanwhile, students' slot requests wait in office hours."
            action={{ label: "Office hours", href: `${HUB_MANAGE_PATH}#hub-queue` }}
          />
        ) : (
          <>
            <LinkTabs
              label="Which shops"
              look="segmented"
              current={view}
              tabs={[
                { key: "needs", label: `Needs you (${needing.length})`, href: MENTOR_PATH },
                { key: "all", label: `All (${rows.length})`, href: ALL_PATH },
              ]}
            />
            {shown.length === 0 ? (
              <div>
                <p className="mentor-all-clear">
                  <CheckIcon aria-hidden="true" /> All clear: no shop needs you today.
                </p>
                <Link href={ALL_PATH} prefetch={false} className="mentor-all-link">
                  See all {rows.length} {rows.length === 1 ? "shop" : "shops"}
                </Link>
              </div>
            ) : (
              <ul className="mentor-rows" aria-label={view === "all" ? "All shops" : "Shops that need you"}>
                {shown.map((row) => (
                  <ListRow
                    key={row.slug}
                    href={mentorShopPath(row.slug)}
                    lead={{ kind: "initials", text: row.name }}
                    title={row.name}
                    detail={caseloadDetail(row, showMentor)}
                    pill={
                      <Pill tone={checkInDue(row.lastCheckInOn, today) ? "warning" : "neutral"}>
                        <span className="sr-only">Check-in: </span>
                        {checkInWords(row.lastCheckInOn, today)}
                      </Pill>
                    }
                    meta={campusNames.get(row.campusSlug) ?? row.campusSlug}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
      {shown.length > 0 && (
        <Card title="Enquiries, 14 days" level={2}>
          {daily === null ? (
            <div className="section-error">
              <p>The enquiries chart didn&apos;t load.</p>
              <a href={view === "all" ? ALL_PATH : MENTOR_PATH} className="btn btn-outline text-navy">
                Try again
              </a>
            </div>
          ) : (
            <ul className="mentor-sparks">
              {shown.map((row) => {
                const points = daily.get(row.slug) ?? days.map(() => null);
                return (
                  <li key={row.slug}>
                    <h3 className="mentor-spark-name">{row.name}</h3>
                    <Sparkline
                      points={points}
                      labels={labels}
                      label={`Enquiries a day, ${row.name}`}
                      summary={sparkSummary(row.name, points)}
                      max={scale}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="staff-muted">
            One scale for every shop, so a taller line means more enquiries. Mentors see numbers, never messages.
          </p>
        </Card>
      )}
    </div>
  );
}
```

Check `CheckIcon` accepts `aria-hidden` through `IconProps` (`components/icons.tsx`); if the `Svg` wrapper already sets `aria-hidden`, drop the prop.

- [ ] **Step 4: The CSS.** Append at the very end of `app/globals.css`:

```css
/* --- Mentor caseload (role views N4; spec 7.3) ------------------------------------------------------------------
   Rows, the All-clear line and the small multiples. Colours only from tokens. */
@layer components {
  /* Never shorter than StaffSkeleton's nav and body blocks (44px + 20px + 28px + 24rem), so the skeleton is never
     taller than the shortest state: an empty caseload, or All clear (CLAUDE.md, N4 plan decision 14). */
  .mentor-home {
    display: grid;
    align-content: start;
    gap: 16px;
    min-height: calc(24rem + 92px);
  }

  .mentor-summary {
    color: var(--color-navy);
    font-weight: 700;
  }

  .mentor-rows {
    display: grid;
  }

  .mentor-all-clear {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--color-ink);
  }

  .mentor-all-clear > svg {
    flex: none;
    width: 20px;
    height: 20px;
    color: var(--color-success);
  }

  .mentor-all-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
  }

  .mentor-sparks {
    display: grid;
    gap: 12px;
  }

  .mentor-spark-name {
    color: var(--color-ink);
    font-size: 14px;
    font-weight: 700;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .mentor-sparks {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px 24px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .mentor-sparks {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run components/staff/MentorDashboard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit (controller), with Task 9**

---

### Task 9: `/mentor` reads the view and the chart's days

**Files:**
- Modify: `app/mentor/page.tsx` (rewritten)
- Create: `app/mentor/page.test.tsx`

- [ ] **Step 1: Write the failing test** `app/mentor/page.test.tsx`

```tsx
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageTransition } from "@/components/kit/PageTransition";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import MentorPage from "./page";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

type Node = ReactElement<{ children?: unknown } & Record<string, unknown>>;

/** The page's request-time part, run on its own (jsdom can't render an async component inside a tree). */
async function open(view?: string): Promise<Node> {
  let node = MentorPage({ searchParams: Promise.resolve(view ? { view } : {}) } as never) as Node;
  // PageTransition (N1), then Suspense, then the async part.
  while (typeof node.type !== "function" || node.type === PageTransition) node = node.props.children as Node;
  return (await (node.type as (props: unknown) => Promise<Node>)(node.props)) as Node;
}

const dashboard = (frame: Node) => frame.props.children as Node;

describe("the mentor dashboard's views (role views spec 7.3)", () => {
  it("shows Needs you unless ?view=all asks for every shop", async () => {
    await signedInAs(request, "acc-mentor");
    expect(dashboard(await open()).props.view).toBe("needs");
    expect(dashboard(await open("all")).props.view).toBe("all");
    expect(dashboard(await open("everything")).props.view).toBe("needs");
  });

  it("hands the caseload, its 14 SAST days and their series to the dashboard", async () => {
    await signedInAs(request, "acc-mentor");
    const props = dashboard(await open("all")).props as {
      rows: { slug: string }[];
      days: string[];
      daily: Map<string, unknown[]>;
      today: string;
    };
    expect(props.rows.map((row) => row.slug)).toEqual(["tech-corner"]);
    expect(props.days).toHaveLength(14);
    expect(props.days.at(-1)).toBe(props.today);
    expect(props.daily.get("tech-corner")).toHaveLength(14);
  });
});
```

`STAFF_NOW` is `2026-10-14T08:42:00.000Z` (`tests/helpers/staff.ts:9`), so `today` is 2026-10-14.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run app/mentor/page.test.tsx`
Expected: FAIL (no `view` prop).

- [ ] **Step 3: Implement.** Replace `app/mentor/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { MentorDashboard } from "@/components/staff/MentorDashboard";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { openBookingCount } from "@/lib/data/hub-posts";
import { mentoredShops } from "@/lib/data/mentors";
import { dailyEnquiriesFor } from "@/lib/data/shop-stats";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { MENTOR_WINDOW_DAYS } from "@/lib/staff/mentor";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";
import { lastSastDays, sastDate } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "Mentor dashboard");
}

/** The mentor's caseload (staff tools spec 2.6; role views spec 7.3). Mentors and admins only. */
export default function MentorPage({ searchParams }: PageProps<"/mentor">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/mentor">, "searchParams">) {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days, the check-in ages and the chart's days read the clock (decision 26).
  await connection();
  const now = new Date();
  const view = (await searchParams).view === "all" ? "all" : "needs";
  const [rows, campuses, notice, slotRequests] = await Promise.all([
    mentoredShops(account, now),
    getCampuses(),
    takeNotice(),
    openBookingCount().catch(() => null),
  ]);
  // Only mentoredShops' slugs: on Supabase this reads with the admin client (N4 plan decision 9).
  const daily = await dailyEnquiriesFor(
    rows.map((row) => row.slug),
    MENTOR_WINDOW_DAYS,
    now,
  ).catch(() => null);
  return (
    <StaffFrame account={account} area="Mentoring" title="Mentor dashboard" current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorDashboard
        rows={rows}
        view={view}
        showMentor={isAdmin(account)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        slotRequests={slotRequests}
        daily={daily}
        days={lastSastDays(MENTOR_WINDOW_DAYS, now)}
        today={sastDate(now)}
      />
    </StaffFrame>
  );
}
```

If N1 left `app/mentor/page.tsx` with a different wrapper around `<Suspense>` (Task 13 of N1), keep N1's wrapper.

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run app/mentor components/staff/MentorDashboard.test.tsx && pnpm typecheck && pnpm lint
```
Expected: PASS; typecheck errors only in `MentorShop*` and `app/mentor/[slug]` (Task 10).

- [ ] **Step 5: Commit (controller), with Task 8**

```bash
git add components/staff/MentorDashboard.tsx components/staff/MentorDashboard.test.tsx app/mentor/page.tsx app/mentor/page.test.tsx app/globals.css
git commit -m "feat(mentor): the caseload: Needs you and All, flags in words, check-in chips, small multiples on one scale (role views N4 Tasks 8 and 9)"
```

---

### Task 10: A shop's mentor page: forms first, then the history

**Files:**
- Modify: `components/staff/MentorShop.tsx` (rewritten, its two submit buttons now N2's `PendingButton`), `app/mentor/[slug]/page.tsx`
- Test: `components/staff/MentorShop.test.tsx`, `app/mentor/[slug]/page.test.tsx`

- [ ] **Step 1: Write the failing tests.** In `components/staff/MentorShop.test.tsx`:

Replace `show` with:

```tsx
async function show(
  forms: {
    note?: FormView;
    checkIn?: FormView;
    noteOnce?: string | null;
    checkInOnce?: string | null;
    previous?: { enquiries: number; salesConfirmed: number } | null;
  } = {},
) {
  const shop = (await getMentoredShop("tech-corner", naledi, NOW))!;
  render(
    <MentorShop
      shop={shop}
      campusName="Midrand"
      notes={await listNotes(shop.ownerId)}
      noteForm={forms.note ?? empty}
      checkInForm={forms.checkIn ?? empty}
      noteOnce={forms.noteOnce === undefined ? NOTE_ONCE : forms.noteOnce}
      checkInOnce={forms.checkInOnce === undefined ? CHECK_IN_ONCE : forms.checkInOnce}
      today="2026-10-14"
      previous={forms.previous === undefined ? { enquiries: 0, salesConfirmed: 0 } : forms.previous}
      now={NOW}
    />,
  );
}
```

Replace the case "explains each flag" with:

```tsx
  it("explains each flag, and says whose pause it is", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await show();
    expect(screen.getByText("Paused by the seller", { selector: "dt" })).toBeInTheDocument();
    expect(
      screen.getByText("The seller paused the shop, so buyers can't see its listings until they resume it."),
    ).toBeInTheDocument();
    expect(screen.getByText("Paused by the seller", { selector: "dd" })).toBeInTheDocument();
  });
```

and add these cases inside the `describe`:

```tsx
  it("compares the last 14 days with the 14 before, in words as well as arrows (role views spec 7.3)", async () => {
    await show({ previous: { enquiries: 0, salesConfirmed: 0 } });
    const numbers = screen.getByRole("list", { name: "Last 14 days" });
    expect(within(numbers).getAllByRole("listitem")).toHaveLength(3);
    expect(within(numbers).getByText("↑ 2 on the 14 days before", { exact: false })).toBeInTheDocument();
    expect(within(numbers).getByText("Same as the 14 days before")).toBeInTheDocument();
    expect(within(numbers).getByText("2 of 2")).toBeInTheDocument();
  });

  it("can't compare when the 14 days before couldn't be read", async () => {
    await show({ previous: null });
    expect(screen.getAllByText("Can't compare")).toHaveLength(2);
  });

  it("puts the two forms before the history, and groups the history by day", async () => {
    await show();
    const addNote = screen.getByRole("region", { name: "Add a note" });
    const addCheckIn = screen.getByRole("region", { name: "Add a check-in" });
    const history = screen.getByRole("region", { name: "Notes and check-ins" });
    expect(addNote.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addCheckIn.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(history).getByRole("heading", { name: "This week" })).toBeInTheDocument();
    expect(within(history).getByRole("heading", { name: "Earlier" })).toBeInTheDocument();
  });

  it("gives the last check-in's day", async () => {
    await show();
    const facts = screen.getByRole("region", { name: "This shop" });
    expect(within(facts).getByText("6 October 2026")).toBeInTheDocument();
  });
```

The seed's note is from 10 October and its check-in from 6 October; at `NOW` (14 October) they group as "This week" and "Earlier" (`groupBySastDay`, N1 Task 9), and the existing "newest first" case still reads the note first.

In `app/mentor/[slug]/page.test.tsx`, add `import { PageTransition } from "@/components/kit/PageTransition";` and replace `open` with:

```tsx
/** The page's request-time part, run on its own: jsdom can't render an async component inside a tree. */
async function open(slug: string): Promise<unknown> {
  type Node = ReactElement<{ children?: unknown } & Record<string, unknown>>;
  let node = MentorShopPage({ params: Promise.resolve({ slug }) } as never) as Node;
  // PageTransition (N1), then Suspense, then the async part.
  while (typeof node.type !== "function" || node.type === PageTransition) node = node.props.children as Node;
  return (node.type as (props: unknown) => Promise<unknown>)(node.props);
}
```

(If N1 already changed `open` to step past `PageTransition`, keep N1's.)

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/staff/MentorShop.test.tsx app/mentor`
Expected: FAIL.

- [ ] **Step 3: Implement.** The two submit buttons use N2's `PendingButton` (`components/kit/PendingButton.tsx`, N2 plan decision 17, Task 13b) as it is: its `children`, `pendingLabel` and `className` props say everything these forms need, and its own CSS dims it while pending. Replace `components/staff/MentorShop.tsx` with:

```tsx
import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { Card } from "@/components/kit/Card";
import { Feed } from "@/components/kit/Feed";
import { PendingButton } from "@/components/kit/PendingButton";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { MentorNoteView } from "@/lib/data/mentors";
import { badgeLabel } from "@/lib/format";
import { staffFieldIds } from "@/lib/staff/errors";
import { FLAG_WORDS, MENTOR_WINDOW_DAYS, repliesInTime, shopStanding } from "@/lib/staff/mentor";
import { addCheckIn, addMentorNote } from "@/lib/staff/mentor-actions";
import { longSastDate, shortSastDate } from "@/lib/time";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";

type FormView = { values: Readonly<Record<string, string>>; errors: readonly FormError[] };

type MentorShopProps = {
  shop: MentoredShop;
  campusName: string;
  notes: readonly MentorNoteView[];
  noteForm: FormView;
  checkInForm: FormView;
  /** The one-time tokens that make a note, and a check-in, once however many times its form is sent (amendment 15.7). */
  noteOnce: string | null;
  checkInOnce: string | null;
  /** Today's SAST date, the check-in's default and latest. */
  today: string;
  /** The 14 days before the last 14 (N2's RecentCounts.previous), or null when they couldn't be read (N4 plan decision 10). */
  previous: Pick<EnquiryCounts, "enquiries" | "salesConfirmed"> | null;
  /** The request's time, for the history's Today, Yesterday and This week. */
  now: Date;
};

const BEFORE = `the ${MENTOR_WINDOW_DAYS} days before`;

/**
 * A shop's mentor page (staff tools spec 2.6; role views spec 7.3): its facts and numbers against the 14 days before,
 * what its flags mean, the forms to add a note or a check-in, then what's been written, grouped by day. Notes are
 * about the shop's owner, shared with every mentor and admin who can open this page, and never shown to the seller.
 * The words are samples for Lama to change.
 */
export function MentorShop({
  shop,
  campusName,
  notes,
  noteForm,
  checkInForm,
  noteOnce,
  checkInOnce,
  today,
  previous,
  now,
}: MentorShopProps) {
  const note = staffFieldIds(`note-${shop.slug}`);
  const checkIn = staffFieldIds(`check-in-${shop.slug}`);
  const noteError = errorFor(noteForm.errors, note.text);
  const dayError = errorFor(checkInForm.errors, checkIn.day);
  const checkInError = errorFor(checkInForm.errors, checkIn.text);
  return (
    <>
      <Card title="This shop" level={2}>
        <dl className="staff-facts">
          <div>
            <dt>Owner</dt>
            <dd>{shop.ownerName}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          <div>
            <dt>Mentor</dt>
            <dd>{shop.mentorName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{shopStanding(shop.status, shop.pausedBy)}</dd>
          </div>
          <div>
            <dt>Badge</dt>
            <dd>{shop.badge ? badgeLabel(shop.badge) : "None"}</dd>
          </div>
          <div>
            <dt>Last check-in</dt>
            <dd>{shop.lastCheckInOn ? longSastDate(`${shop.lastCheckInOn}T10:00:00Z`) : "None yet"}</dd>
          </div>
        </dl>
        <StatRow label={`Last ${MENTOR_WINDOW_DAYS} days`}>
          <StatTile
            label="Enquiries"
            value={shop.counts.enquiries}
            delta={{ previous: previous?.enquiries ?? null, period: BEFORE }}
          />
          <div className="stat-tile">
            <span className="stat-tile-label">Replied within 48 hours</span>
            <span className="stat-tile-value" data-masked="">
              {repliesInTime(shop.counts)}
            </span>
          </div>
          <StatTile
            label="Sales confirmed"
            value={shop.counts.salesConfirmed}
            delta={{ previous: previous?.salesConfirmed ?? null, period: BEFORE }}
          />
        </StatRow>
        {shop.flags.length === 0 ? (
          <p>No flags.</p>
        ) : (
          <dl className="staff-flags">
            {shop.flags.map((flag) => (
              <div key={flag}>
                <dt>{FLAG_WORDS[flag].label}</dt>
                <dd>{FLAG_WORDS[flag].explanation}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="staff-muted">
          Worked out from the shop&apos;s conversations: mentors see its numbers, never their messages.{" "}
          {/* A shop the Hub has paused has no storefront for anyone, as on the admin pages (amendment 15.5). */}
          {shop.status === "paused" && shop.pausedBy === "staff" ? (
            <>The Hub has paused {shop.name}, so buyers can&apos;t see it.</>
          ) : (
            <Link href={`/sellers/${shop.slug}`} prefetch={false}>
              See {shop.name}&apos;s storefront
            </Link>
          )}
        </p>
      </Card>

      <section id={`mentor-${shop.slug}-add-note`} aria-labelledby={`mentor-${shop.slug}-add-note-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-add-note-title`} className="staff-section-title">
          Add a note
        </h2>
        <ErrorSummary id={`note-${shop.slug}-summary`} errors={noteForm.errors} />
        <form action={addMentorNote} noValidate className="form-stack staff-inline-form">
          <input type="hidden" name="shop" value={shop.slug} />
          {noteOnce && <input type="hidden" name="once" value={noteOnce} />}
          <div className="form-field">
            <label htmlFor={note.text} className="form-label">
              Note
            </label>
            <p id={`${note.text}-hint`} className="form-hint">
              Only mentors and admins see it, never the seller. Up to 1,000 characters.
            </p>
            <FieldError id={`${note.text}-error`} message={noteError} />
            <textarea
              id={note.text}
              name="text"
              rows={4}
              required
              defaultValue={noteForm.values.text ?? ""}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={describedBy(`${note.text}-hint`, noteError && `${note.text}-error`)}
              className="form-input staff-textarea"
            />
          </div>
          <PendingButton className="btn btn-primary form-submit" pendingLabel="Saving the note…">
            Add a note <span className="sr-only">about {shop.name}</span>
          </PendingButton>
        </form>
      </section>

      <section
        id={`mentor-${shop.slug}-add-check-in`}
        aria-labelledby={`mentor-${shop.slug}-add-check-in-title`}
        className="staff-section"
      >
        <h2 id={`mentor-${shop.slug}-add-check-in-title`} className="staff-section-title">
          Add a check-in
        </h2>
        <ErrorSummary id={`check-in-${shop.slug}-summary`} errors={checkInForm.errors} />
        <form action={addCheckIn} noValidate className="form-stack staff-inline-form">
          <input type="hidden" name="shop" value={shop.slug} />
          {checkInOnce && <input type="hidden" name="once" value={checkInOnce} />}
          <div className="form-field">
            <label htmlFor={checkIn.day} className="form-label">
              Date of the check-in
            </label>
            <FieldError id={`${checkIn.day}-error`} message={dayError} />
            <input
              id={checkIn.day}
              name="day"
              type="date"
              required
              max={today}
              defaultValue={checkInForm.values.day ?? today}
              aria-invalid={dayError ? true : undefined}
              aria-describedby={describedBy(dayError && `${checkIn.day}-error`)}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label htmlFor={checkIn.text} className="form-label">
              What you talked about
            </label>
            <p id={`${checkIn.text}-hint`} className="form-hint">
              Only mentors and admins see it, never the seller. Up to 1,000 characters.
            </p>
            <FieldError id={`${checkIn.text}-error`} message={checkInError} />
            <textarea
              id={checkIn.text}
              name="text"
              rows={4}
              required
              defaultValue={checkInForm.values.text ?? ""}
              aria-invalid={checkInError ? true : undefined}
              aria-describedby={describedBy(`${checkIn.text}-hint`, checkInError && `${checkIn.text}-error`)}
              className="form-input staff-textarea"
            />
          </div>
          <PendingButton className="btn btn-outline text-navy form-submit" pendingLabel="Saving the check-in…">
            Add a check-in <span className="sr-only">for {shop.name}</span>
          </PendingButton>
        </form>
      </section>

      <section id={`mentor-${shop.slug}-notes`} aria-labelledby={`mentor-${shop.slug}-notes-title`} className="staff-section">
        <h2 id={`mentor-${shop.slug}-notes-title`} className="staff-section-title">
          Notes and check-ins
        </h2>
        {notes.length === 0 ? (
          <p className="staff-empty">Nothing written yet.</p>
        ) : (
          <Feed
            label="Notes and check-ins by day"
            now={now}
            items={notes.map((item) => ({
              id: item.id,
              at: item.createdAt,
              content: (
                <div className="staff-note">
                  <p className="staff-note-kind">
                    {item.kind === "check-in" && item.checkInOn
                      ? `Check-in on ${longSastDate(`${item.checkInOn}T10:00:00Z`)}`
                      : "Note"}
                  </p>
                  <p className="staff-prewrap">{item.text}</p>
                  <p className="staff-muted">
                    {item.authorName}, <time dateTime={item.createdAt}>{shortSastDate(item.createdAt)}</time>
                  </p>
                </div>
              ),
            }))}
          />
        )}
      </section>
    </>
  );
}
```

The three section ids stay as they were: `addMentorNote` and `addCheckIn` redirect to them (`lib/staff/contract/mentor.contract.ts:28` and `:52`).

In `app/mentor/[slug]/page.tsx`:
- add `import { recentCounts } from "@/lib/data/shop-stats";` and `import { MENTOR_WINDOW_DAYS } from "@/lib/staff/mentor";`;
- add `PageTransition` around the `<Suspense>` if N1 hasn't (it should have);
- replace the `Promise.all` and the `<MentorShop …/>` element (lines 46–69) with:

```tsx
  // A note and a check-in each get a one-time token, made now, at request time (staff tools amendment 15.7).
  const [campuses, notes, note, checkIn, notice, noteOnce, checkInOnce, previous] = await Promise.all([
    getCampuses(),
    listNotes(shop.ownerId),
    readFormState(noteForm(shop.slug)),
    readFormState(checkInForm(shop.slug)),
    takeNotice(),
    issueOnceToken(),
    issueOnceToken(),
    // getMentoredShop has checked the viewer may follow this shop: recentCounts reads with the admin client (N4 plan
    // decision 9), so it's called only after that check. N2's previous window (decision 10); on Supabase its
    // per-request cache means no second query.
    recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now).then((counts) => counts.previous, () => null),
  ]);
  return (
    <StaffFrame account={account} area="Mentoring" title={shop.name} current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorShop
        shop={shop}
        campusName={campuses.find((campus) => campus.slug === shop.campusSlug)?.name ?? ""}
        notes={notes}
        noteForm={{ values: note?.values ?? {}, errors: staffErrors(note?.errors ?? [], staffFieldIds(`note-${shop.slug}`)) }}
        checkInForm={{
          values: checkIn?.values ?? {},
          errors: staffErrors(checkIn?.errors ?? [], staffFieldIds(`check-in-${shop.slug}`)),
        }}
        noteOnce={noteOnce}
        checkInOnce={checkInOnce}
        today={sastDate(now)}
        previous={previous}
        now={now}
      />
    </StaffFrame>
  );
```


- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run components/staff app/mentor lib && pnpm typecheck && pnpm lint
```
Expected: PASS, and typecheck and lint clean everywhere.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/staff/MentorShop.tsx components/staff/MentorShop.test.tsx "app/mentor/[slug]/page.tsx" "app/mentor/[slug]/page.test.tsx"
git commit -m "feat(mentor): a shop's page puts the forms first, compares 14 days with the 14 before, and groups the history by day (role views N4 Task 10)"
```

---

### Task 11: End-to-end reads, gates and the existing specs

**Files:**
- Create: `tests/e2e/helpers/role-views.ts`
- Modify: `tests/e2e/role-views.spec.ts`, `tests/e2e/staff.spec.ts` (lines 167–212), `tests/e2e/screenshots.spec.ts` (lines 621–625), `tests/e2e/cls.spec.ts`

- [ ] **Step 1: The skeleton helper** `tests/e2e/helpers/role-views.ts`

```ts
import { expect, type Page } from "@playwright/test";

// Shared by the role views' end-to-end tests (N4 plan Tasks 11 and 12).

/**
 * The staff page showing is at least as tall as StaffSkeleton (CLAUDE.md: a skeleton is never taller than the page's
 * shortest state). The skeleton is put beside the page with StaffSkeleton's own classes, measured, and taken away.
 */
export async function expectNoShorterThanSkeleton(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => {
    const frame = [...document.querySelectorAll<HTMLElement>("main .staff-page")].find(
      (element) => element.offsetParent !== null,
    );
    if (!frame) throw new Error("No staff page is showing");
    const shell = document.createElement("div");
    shell.className = "page staff-page";
    shell.setAttribute("aria-hidden", "true");
    for (const part of ["eyebrow", "title", "nav", "body"]) {
      const block = document.createElement("span");
      block.className = `skeleton staff-skeleton-${part}`;
      shell.append(block);
    }
    frame.after(shell);
    const measured = { page: frame.getBoundingClientRect().height, skeleton: shell.getBoundingClientRect().height };
    shell.remove();
    return measured;
  });
  expect(sizes.page, "the page's height against its skeleton's").toBeGreaterThanOrEqual(sizes.skeleton);
}
```

- [ ] **Step 2: The reads.** Append to `tests/e2e/role-views.spec.ts` (merge the imports with N1's: `expect`, `test`, `Page` from `@playwright/test`; `seriousIssues` from `./helpers/axe`; `main`, `onlyAt`, `signInAsSample` from `./helpers/messaging`; add `expectNoShorterThanSkeleton` from `./helpers/role-views`):

```ts
// Task 0's measurements, before N4: the uncompressed HTML of /mentor and /mentor/tech-corner, signed in as the sample
// mentor. The gate allows about 8 KB more (role views spec 9).
const MENTOR_HTML_BEFORE = 0; // Task 0 Step 4: write the number here
const MENTOR_SHOP_HTML_BEFORE = 0; // Task 0 Step 4: write the number here

test.describe("the mentor caseload (role views spec 7.3, N4)", () => {
  const shopsCard = (page: Page) => main(page).getByRole("region", { name: "Your shops" });

  test("All and Needs you split the caseload, the counts match the rows, and every row opens its shop", async ({ page }) => {
    await signInAsSample(page, "Mentor", "/mentor?view=all");
    const card = shopsCard(page);
    const segments = card.getByRole("navigation", { name: "Which shops" });
    const rows = card.getByRole("list", { name: "All shops" }).getByRole("link");
    const total = await rows.count();
    expect(total).toBeGreaterThan(0);
    await expect(segments.getByRole("link", { name: `All (${total})` })).toHaveAttribute("aria-current", "page");
    const summary = (await card.locator(".mentor-summary").textContent()) ?? "";
    const [, need, all] = /^(\d+) of (\d+) need you/.exec(summary) ?? [];
    expect(Number(all)).toBe(total);

    const targets = await rows.evaluateAll((links) =>
      links.map((link) => [link.getAttribute("href")!, link.querySelector(".list-row-title")!.textContent!]),
    );
    for (const [href, name] of targets) {
      await page.goto(href);
      await expect(main(page).getByRole("heading", { level: 1, name })).toBeVisible();
    }

    await page.goto("/mentor");
    await expect(segments.getByRole("link", { name: `Needs you (${need})` })).toHaveAttribute("aria-current", "page");
    if (Number(need) === 0) await expect(card.getByText(/^All clear/)).toBeVisible();
    else await expect(card.getByRole("list", { name: "Shops that need you" }).getByRole("link")).toHaveCount(Number(need));
  });

  test("the chart draws one small chart per shop in the view, each with its takeaway", async ({ page }) => {
    await signInAsSample(page, "Mentor", "/mentor?view=all");
    const rows = await shopsCard(page).getByRole("list", { name: "All shops" }).getByRole("link").count();
    const chart = main(page).getByRole("region", { name: "Enquiries, 14 days" });
    await expect(chart.locator(".mentor-sparks > li")).toHaveCount(rows);
    await expect(chart.getByText(/^Tech corner: \d+ enquir(y|ies) in \d+ days?/).first()).toBeAttached();
  });

  test("a shop's page puts both forms before the history, with the last 14 days against the 14 before", async ({ page }) => {
    await signInAsSample(page, "Mentor", "/mentor/tech-corner");
    const facts = main(page).getByRole("region", { name: "This shop" });
    await expect(facts.getByRole("list", { name: "Last 14 days" }).getByRole("listitem")).toHaveCount(3);
    const top = async (name: string) => (await main(page).getByRole("region", { name }).boundingBox())!.y;
    expect(await top("Add a note")).toBeLessThan(await top("Notes and check-ins"));
    expect(await top("Add a check-in")).toBeLessThan(await top("Notes and check-ins"));
  });

  test("no serious or critical accessibility issues on the caseload and a shop's page", async ({ page }) => {
    for (const [label, path] of [
      ["Mentor", "/mentor"],
      ["Mentor", "/mentor?view=all"],
      ["Mentor", "/mentor/tech-corner"],
      ["Admin", "/mentor?view=all"],
    ] as const) {
      await page.context().clearCookies();
      await signInAsSample(page, label, path);
      expect(await seriousIssues(page), `${label} at ${path}`).toEqual([]);
    }
  });

  test("the caseload is never shorter than its skeleton", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signInAsSample(page, "Mentor", "/mentor");
    await expectNoShorterThanSkeleton(page);
    await page.goto("/mentor?view=all");
    await expectNoShorterThanSkeleton(page);
  });

  test("the caseload and a shop's page add under about 8 KB of HTML", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Mentor", "/mentor");
    const bytes = async (path: string) => Buffer.byteLength(await (await page.request.get(path)).text());
    expect((await bytes("/mentor?view=all")) - MENTOR_HTML_BEFORE).toBeLessThan(8 * 1024);
    expect((await bytes("/mentor/tech-corner")) - MENTOR_SHOP_HTML_BEFORE).toBeLessThan(8 * 1024);
  });
});
```

Write Task 0's two numbers into the constants before running. Left at 0, the HTML test fails, which is the reminder.

- [ ] **Step 3: The existing mentor specs.** In `tests/e2e/staff.spec.ts`, in "a mentor downloads the dashboard as a CSV, and adds a note to a shop they mentor" (line 168), replace

```ts
    await signInAsSample(page, "Mentor", "/mentor");
    const table = main(page).getByRole("table", { name: "Your sellers, A to Z" });
    await expect(table.getByRole("link", { name: "Tech corner" })).toBeVisible();

    const downloading = page.waitForEvent("download");
    await main(page).getByRole("link", { name: "Download CSV" }).click();
```

with

```ts
    await signInAsSample(page, "Mentor", "/mentor?view=all");
    const shops = main(page).getByRole("region", { name: "Your shops" });
    await expect(shops.getByRole("link", { name: /^Tech corner/ })).toBeVisible();

    // The CSV is the Mentoring bar's Export (role views N1; N4 plan decision 7).
    const downloading = page.waitForEvent("download");
    await page.getByRole("navigation", { name: "Mentoring" }).getByRole("link", { name: "Export" }).click();
```

and replace `await table.getByRole("link", { name: "Tech corner" }).click();` with `await shops.getByRole("link", { name: /^Tech corner/ }).click();`. The rest of the test is unchanged: "Notes and check-ins" is still a region, and the new note is still a list item in it.

In `tests/e2e/screenshots.spec.ts`, replace lines 621–622:

```ts
  await mentor.goto("/mentor");
  await expect(mentorMain.getByRole("table", { name: "Your sellers, A to Z" })).toBeVisible();
```

with

```ts
  await mentor.goto("/mentor?view=all");
  await expect(mentorMain.getByRole("region", { name: "Your shops" })).toBeVisible();
```

- [ ] **Step 4: Layout shift.** In `tests/e2e/cls.spec.ts`, add to `PAGES` (after the Saved searches rows, before the offline page), unless N1 added a `/mentor` row already (then add only the missing ones):

```ts
  // Role views N4: the mentor's caseload and a shop's page.
  ["mentor dashboard (needs you)", "/mentor", undefined, "Mentor"],
  ["mentor dashboard (all)", "/mentor?view=all", undefined, "Mentor"],
  ["mentor shop page", "/mentor/tech-corner", undefined, "Mentor"],
```

and to `SLOW_PAGES` (at the end):

```ts
  // Role views N4: the skeleton gives way to the caseload without moving the footer.
  ["mentor dashboard (needs you)", "/mentor", "Mentor"],
  ["mentor dashboard (all)", "/mentor?view=all", "Mentor"],
  ["mentor shop page", "/mentor/tech-corner", "Mentor"],
```

- [ ] **Step 5: Run everything**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: clean, every unit test passing. Write the count down.

```bash
pnpm build && pnpm e2e tests/e2e/role-views.spec.ts tests/e2e/staff.spec.ts tests/e2e/cls.spec.ts tests/e2e/performance.spec.ts tests/e2e/a11y.spec.ts tests/e2e/staff-checks.spec.ts --reporter=line
```
Expected: all pass at 360, 390, 768, 1024 and 1440; the CLS rows at 0.05 or less (the slow rows at 390 and 1440).

If "the caseload is never shorter than its skeleton" fails, compare N1's built `StaffSkeleton` and `.staff-skeleton-*` CSS with the sum in `.mentor-home`'s `min-height` (Task 8), fix the sum, and note it.

- [ ] **Step 6: The JavaScript gate**

Write every page's `scriptBrotli` from the performance run beside Task 0's baseline in "Changes made during the build". **Every page must be at or under 150 KB.** Any page that grew by more than 1 KB gets a one-line reason there. N4 adds no client code; it only uses N2's `PendingButton` on the staff-only mentor shop page, so public pages should not move; if one grows, find out why (most likely a kit or chart file pulled into a client component) and fix it or give the reason. Then:

```bash
grep -rln "use client" components/kit components/charts components/staff
```
Expected: only `components/kit/PendingButton.tsx` (N2's). N4 adds no client component.

```bash
grep -l "serviceWorker.register" .next/static/chunks/*.js
```
Expected: no output.

```bash
grep -rn "newContext(" tests/e2e | grep -v serviceWorkers
```
Expected: no output.

- [ ] **Step 7: Commit (controller)**

```bash
git add tests/e2e/helpers/role-views.ts tests/e2e/role-views.spec.ts tests/e2e/staff.spec.ts tests/e2e/screenshots.spec.ts tests/e2e/cls.spec.ts
git commit -m "test: the mentor caseload end to end (views, rows, chart, forms first, axe, skeleton, HTML size, layout shift); CSV from the bar (role views N4 Task 11)"
```

---

### Task 12: The assignment notification, end to end

**Files:**
- Modify: `playwright.config.ts` (only if Task 0 found no `role-views-writes` project)
- Create or modify: `tests/e2e/role-views-writes.spec.ts`

- [ ] **Step 1: The project, only if it isn't there**

```bash
grep -n "role-views-writes" playwright.config.ts
```
If this prints anything, N2 made it: skip to Step 2. Otherwise:

1. After the `HOUSEKEEPING_WRITES` constant, add:

```ts
// Role views' writes (spec 9): N2's mark-sold and N4's mentor notification. They run after every other test, so a new
// mentor or a sold listing never lands under another test.
const ROLE_VIEWS_WRITES = /role-views-writes\.spec\.ts$/;
```

2. In each of the five device projects (`phone-360`, `phone-390`, `tablet-768`, `laptop-1024`, `desktop-1440`), change `HOUSEKEEPING_WRITES]` at the end of `testIgnore` to `HOUSEKEEPING_WRITES, ROLE_VIEWS_WRITES]` (five places; `grep -c "ROLE_VIEWS_WRITES]" playwright.config.ts` prints 5 afterwards).

3. After the `housekeeping-writes` project, add:

```ts
    // After everything else (role views spec 9). Run it alone with --project=role-views-writes --no-deps.
    {
      name: "role-views-writes",
      use: desktop(1440, 900),
      testMatch: ROLE_VIEWS_WRITES,
      dependencies: [
        ...DEVICE_PROJECTS,
        "selling-writes",
        "staff-writes",
        "community-writes",
        "alerts-writes",
        "staff-accounts-writes",
        "hardening-writes",
        "housekeeping-writes",
      ],
    },
```

N2's plan should check for this block the same way before adding its own.

- [ ] **Step 2: The test.** Create `tests/e2e/role-views-writes.spec.ts` with the content below, or, if N2 made the file, add the imports it lacks and the `test.describe` block:

```ts
import { expect, test } from "@playwright/test";
import { button, field, main, newBuyer, signUp } from "./helpers/messaging";
import { expectNoShorterThanSkeleton } from "./helpers/role-views";
import { POST_LANDS } from "./helpers/selling";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";
import { giveRole } from "./helpers/staff-accounts";

// Role views' writes (spec 9). These run last, in the role-views-writes project. Each makes its own accounts and shops
// and never changes the sample staff's roles or the sample shops' mentors.

test.describe("the mentor caseload's writes (role views spec 7.3, N4)", () => {
  test("assigning a mentor tells them once, linking to the shop's mentor page; the same mentor again, or none, tells no one", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    // A fresh shop, applied for by a fresh student and approved by the sample admin.
    const shopName = newShopName();
    const sellerContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
    await applyToSell(await sellerContext.newPage(), shopName);
    const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
    const slug = await reviewShop(admin, shopName);
    await button(admin, `Approve ${shopName}`).click();
    await expect(staffNotice(admin)).toHaveText("Approved. The shop is live, and its owner has been told.", POST_LANDS);

    // A fresh mentor, in this page. With no shops yet: one empty state, and no shorter than the skeleton.
    const mentor = newBuyer();
    await signUp(page, mentor);
    await giveRole(admin, mentor.email, "Mentor");
    await page.goto("/mentor");
    await expect(main(page).getByRole("heading", { name: "No shops yet" })).toBeVisible();
    await expectNoShorterThanSkeleton(page);

    const saveMentor = async (label: string) => {
      await admin.goto(`/admin/sellers/${slug}`);
      await field(admin, `Mentor for ${shopName}`).selectOption({ label });
      await button(admin, `Save mentor for ${shopName}`).click();
    };
    // Matched by its sentence and shop name, so giveRole's own "You're a CampusCart mentor now." can't be counted.
    const told = () =>
      main(page)
        .getByRole("link", { name: new RegExp(`You're now mentoring ${shopName}\\.`) })
        .filter({ visible: true });

    await saveMentor(mentor.firstName);
    await expect(staffNotice(admin)).toHaveText("Mentor saved. They've been told.", POST_LANDS);
    await page.goto("/notifications");
    await expect(told()).toHaveCount(1);
    await expect(told()).toHaveAttribute("href", `/mentor/${slug}`);
    await told().click();
    await expect(main(page).getByRole("heading", { level: 1, name: shopName })).toBeVisible();

    // On the caseload it needs them: nothing listed yet, and no check-in.
    await page.goto("/mentor");
    const row = main(page)
      .getByRole("list", { name: "Shops that need you" })
      .getByRole("link", { name: new RegExp(`^${shopName}`) });
    await expect(row).toContainText("Nothing is up for buyers yet");
    await expect(row).toContainText("Check-in: Due");

    // The same mentor again changes nothing and tells no one; removing the mentor tells no one either.
    await saveMentor(mentor.firstName);
    await expect(staffNotice(admin)).toHaveText("Nothing changed. It was already done.", POST_LANDS);
    await saveMentor("No mentor");
    await expect(staffNotice(admin)).toHaveText("The shop has no mentor now.", POST_LANDS);
    await page.goto("/notifications");
    await expect(told()).toHaveCount(1);

    await sellerContext.close();
    await admin.context().close();
  });
});
```

`signUp` signs the new account in on `page` (`tests/e2e/helpers/messaging.ts:72`); its role is read on every request, so `/mentor` opens after `giveRole`.

- [ ] **Step 3: Run it**

```bash
pnpm build && pnpm e2e --project=role-views-writes --no-deps --reporter=line
```
Expected: PASS.

```bash
grep -rn "newContext(" tests/e2e | grep -v serviceWorkers
```
Expected: no output.

- [ ] **Step 4: Commit (controller)**

```bash
git add tests/e2e/role-views-writes.spec.ts playwright.config.ts
git commit -m "test: a mentor is told once when assigned, never on no change or a removal; the role-views-writes project (role views N4 Task 12)"
```

(Leave `playwright.config.ts` out of `git add` if Step 1 changed nothing.)

---

### Task 13: Screenshots

**Files:**
- Modify: `tests/e2e/role-views-screenshots.spec.ts`

- [ ] **Step 1: Add N4's shots.** Append to `tests/e2e/role-views-screenshots.spec.ts` (N1 made it, with `test.skip(!process.env.SCREENSHOTS, …)` at the top and `signInAsSample` imported):

```ts
const N4_SHOTS = [
  ["mentor-needs", "Mentor", "/mentor"],
  ["mentor-all", "Mentor", "/mentor?view=all"],
  ["mentor-shop", "Mentor", "/mentor/tech-corner"],
  ["admin-mentoring", "Admin", "/mentor?view=all"],
] as const;

for (const [name, label, path] of N4_SHOTS) {
  test(`role views N4: ${name}`, async ({ page }) => {
    const width = test.info().project.name.split("-").pop();
    test.skip(!["390", "1440"].includes(width!), "390 and 1440 only");
    await signInAsSample(page, label, path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `docs/progress/role-views/n4-${width}-${name}.png`, fullPage: true });
  });
}
```

- [ ] **Step 2: Take them**

```bash
SCREENSHOTS=1 pnpm e2e tests/e2e/role-views-screenshots.spec.ts --project=phone-390 --project=desktop-1440 --grep "N4"
```
Expected: 8 PNGs named `n4-390-*.png` and `n4-1440-*.png` in `docs/progress/role-views/`. Look at each: rows readable at 390, chips not wrapping under the chevron, the small multiples two or three across at 1440, no sky text on white.

- [ ] **Step 3: Commit (controller)**

```bash
git add tests/e2e/role-views-screenshots.spec.ts docs/progress/role-views/n4-*.png
git commit -m "test: role views N4 screenshots at 390 and 1440 (caseload, all, a shop's page, the admin's view)"
```

---

### Task 14: Docs

**Files:**
- Modify: `CLAUDE.md` (Code rules; Privacy), `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`, this plan's "Changes made during the build"

- [ ] **Step 1: CLAUDE.md.** Add to "Code rules", after the bullet about mentors' notes' staff pages (or after N1's role views bullets):

```markdown
- The mentor caseload (role views N4): `mentoredShops` puts the most flags first, then the longest since a check-in (none first), then the name (`byNeed`, `lib/staff/mentor.ts`), on both backends, and the CSV follows that order. A shop with nothing available is flagged "No listings yet" instead of "No enquiries", and a pause says whose it is (`paused-by-hub`, `paused-by-seller`). `lastCheckIns(viewer, ownerIds)` (`lib/data/mentors.ts`) gives a check-in's day, never its text, under `private.can_mentor`'s rule: on Supabase `public.last_check_ins` with the viewer's client. `dailyEnquiriesFor(slugs, days, now)` (`lib/data/shop-stats.ts`; SAST days, null before a shop opened) reads with the admin client like `shopStats`, so call it only with `mentoredShops`' slugs.
- Assigning a mentor tells the new mentor ("staff-role" kind, the shop's link as its subject, to `/mentor/<slug>`): `assignMentor` on the sample store, `set_shop_mentor` on Supabase. A removal or no change tells no one.
```

If N2 didn't add it, also add, after the `housekeeping-writes` bullet:

```markdown
- End-to-end tests of the role views' writes (N2's mark-sold, N4's mentor notification) go in `tests/e2e/role-views-writes.spec.ts`, which runs last, in the `role-views-writes` project, after `housekeeping-writes`.
```

In "Privacy (POPIA)", extend the mentors' notes bullet with: "The caseload shows a check-in's day only (`lastCheckIns`), never what was said."

- [ ] **Step 2: The decisions log.** Read `docs/reference/LANDING-DECISIONS.md`'s header and last row, then add the next row in its layout:

```markdown
| N | 2026-10-2X | How does a mentor see their caseload? | **Most in need first** (role views N4): Needs you / All, each shop's flags in words (No listings yet; whose pause), a check-in chip (Due after 30 days or with none), small charts on one scale; a shop's page puts its forms first and its history by day. `lastCheckIns` gives days only, under `can_mentor`. Assigning a mentor tells them ("staff-role"). Lama, 2026-10-2X. |
```

- [ ] **Step 3: PROGRESS.md.** Add "## 2026-10-2X: Role views N4 built (the mentor caseload)" before "## Next", in the style of the sections above it:
- what's built (the caseload, the shop page, the two readers, the migration, the notification);
- where the build differed from the plan;
- checks: unit count, `pnpm test:db` and `supabase test db` counts, the e2e counts, each page's first-visit JS against the baseline (all under 150 KB, a reason for any growth over 1 KB), the HTML bytes added;
- open points for Lama: plan decisions 1–15, the 30-day threshold, the sample words, the screenshots to review.

Update "## Next": "N5, You, can be planned."

- [ ] **Step 4: Fill in "Changes made during the build"** below: one bullet per departure, each with its commit.

- [ ] **Step 5: Commit (controller), with Lama's go-ahead**

```bash
git add CLAUDE.md docs/reference/LANDING-DECISIONS.md docs/PROGRESS.md docs/superpowers/plans/2026-10-22-role-views-n4-mentor.md
git commit -m "docs: role views N4 built: CLAUDE.md rules for the caseload, lastCheckIns and the mentor notification; decision log; progress"
```

If other sessions have uncommitted lines in PROGRESS or the decisions log, stage only this stage's lines (`git add -p` on those files), never `git add .`.

---

## Self-review: what the spec asks for, and where this plan does it

| Spec / brief | Where |
|---|---|
| §6 `mentoredShops` sorted by flags, days since check-in, name, on both backends | Task 2 (`byNeed`), Task 5 (both readers, unit and contract tests) |
| §6 `lastCheckIns`: date only, never text; only owners from `mentoredShops`; viewer's session; pgTAP for seller and admin-who-sells; no text column | Task 4 (function, pgTAP 52: columns, can_mentor, seller, admin who sells, other mentor, role gone), Task 5 (sample `mayMentor`, twin through the viewer's client, contract on both); decision 2 |
| §6 `dailyEnquiriesFor`: one read for the caseload, SAST days, null before a shop existed | Task 3 (on N2's `dailyOver` and `lastSastDays`, sample and twin, unit and contract tests); decision 9 |
| §7.3 header "N of M need you · K slot requests" (`openBookingCount`) | Task 2 (`caseloadSummary`), Task 8, Task 9 |
| §7.3 segments Needs you / All (`?view=all`), "needs you" = flag or check-in due | Tasks 2, 8, 9 (page test), 11 (e2e) |
| §7.3 rows: initials, flag explanations, Paused by the Hub vs the seller, No listings yet, check-in chip | Tasks 2, 5, 8; decisions 4, 5, 11 |
| §7.3 `mentorFlags` and the CSV kept consistent | Tasks 2 and 6; decision 4 |
| §7.3 chart: Sparkline small multiples on one shared scale | Task 1 (shared `max`), Task 8; decision 8 |
| §7.3 Export stays, from the bar | Task 11 (staff.spec moves to the bar); decision 7 |
| §7.3 shop page: facts, StatRow 14 vs previous 14, Add note and Add check-in first, history as Feed | N2's `RecentCounts.previous`, Task 10; decision 10 |
| §7.3 assignMentor notifies ("You're now mentoring {shop}", link to the shop page), both backends, never when unchanged; kind reused; words; privacy text | Task 4 (SQL, pgTAP), Task 7 (TS, unit, admin-gates contract on both backends, privacy page, notice), Task 12 (e2e); decision 1 |
| §8 a failed reader shows its card's error; a failed count shows nothing | Task 8 (chart `section-error`, slot clause left out), Task 9 (`.catch`), Task 10 (`previous` null → "Can't compare") |
| §9 unit, contract, pgTAP | Tasks 1–5, 7–10 |
| §9 e2e reads in the device projects, axe, every Needs-you row opens the right item | Task 11 |
| §9 writes in `role-views-writes` (added idempotently if N2 hasn't) | Task 12; decision 15 |
| §9 layout shift < 0.05 at 390 and 1440 (and slow network) | Task 11 Step 4 |
| §9 skeleton no taller than the shortest state | Task 8 (`.mentor-home` min-height), Task 11 and 12 (`expectNoShorterThanSkeleton` on Needs you, All, and an empty caseload); decision 14 |
| §9 HTML under about 8 KB added | Task 0 Step 4 (baseline), Task 11 (gate) |
| §3 every page inside the 150 KB first-visit JS budget, numbers recorded, a reason for growth over 1 KB; Server Components by default | Task 0 Step 3, Task 11 Step 6; N2's `PendingButton` reused, no new client component (Task 10) |
| §9 screenshots with `SCREENSHOTS=1` into `docs/progress/role-views/` | Task 13 |
| Privacy: a mentor's notification about a shop goes when the shop's owner deletes their account, and follows a new link | Task 4 (two triggers, pgTAP), Task 7 (`deleteAccountData`, `changeShopSlug`, unit tests) |
| Privacy: notes never to the seller, nothing about the viewer's own shop, not in the download | `mayMentor`/`can_mentor` (Tasks 4, 5); `lastCheckIns` returns days only; nothing new enters the data download |
| 44px, brand colours, `wide:`/`desk:`, motion | Task 8 CSS (44px links, tokens only, navy and sky-dark, no motion); N1's rows, segments and pills |
| Docs | Task 14 |

## Changes after plan review (2026-10-22)

1. Task 7: `app/privacy/page.test.tsx:394`'s regex follows the new privacy sentence; the file joins Task 7's commit.
2. Task 1: `Sparkline` is no longer rewritten whole. Only three changes (the `max` prop, `isTooSmallToChart(points, max)`, `sparkline(points, BOX, max)`), so N1's too-small branch that writes the values stays. Noted that N1's `BarList` already has `max?` and `rowHeader?`.
3. Task 4 pgTAP: Zola (d7), a student whose shop Lindi mentors, with a check-in on 7 October. Mpho's case asks about d1, d3 and d7 and gets only his two; Lindi's gets only d7. A real anon call is refused (42501). The plan count is now 24.
4. POPIA: deleting a shop (its owner's account) removes the mentor's "You're now mentoring" notification. On Supabase it's a security-definer trigger function, `private.forget_mentor_word_about_shop`, run after delete on `public.shops`, with execute revoked from every API role. On the sample store it's in `deleteAccountData` beside `forgetFollowsOf`. pgTAP and a unit test cover it.
5. `last_check_ins` also requires `private.is_staff('mentor')` (a mentor or an admin), checked once.
6. Task 10's comment now cites decision 9 for the admin-client rule.
7. Task 2 adds a line to `NotificationKind`'s comment: a "staff-role" subject is a role, or a shop's link for a mentor's new shop.
8. `byNeed` compares equal check-in ages as 0 before subtracting, so two shops with no check-in tie without relying on NaN.
9. Task 12: a comment says `told()` matches the sentence, so giveRole's notification can't be counted.

10. A shop's new link takes the mentor's notification with it: an `after update of slug` trigger on `public.shops` (`private.move_mentor_word_with_shop`, security definer, execute revoked from every API role) rewrites its href; the sample store does it in `changeShopSlug`. The subject keeps the old link. Covered by one pgTAP case (plan count 25) and one unit test.
11. Aligned with N2 (built first): N4 no longer declares `lastSastDays`, `enquiriesByDay`, `previousOver` or `previousCounts`. `dailyEnquiriesFor` is built on N2's `dailyOver` (its contract checks each shop's series equals `dailyEnquiries`). `mentoredShops` wraps `recentCounts` in N2's `currentOf`, so `MentoredShop.counts` stays `EnquiryCounts` and the exact-match tests hold. The shop page's "14 days before" is `recentCounts(…).previous`. Task 0 now checks N2's names one by one and stops if any is missing. Decision 10, the file list and the coverage table follow.
12. Lama's JavaScript rule (2026-10-22) replaces the byte-for-byte gates (Goal, Rules, Task 0 Step 3, Task 11 Step 6, Docs, coverage table): every page inside the 150 KB first-visit budget, each page's number recorded against Task 0's baseline, a one-line reason for any page that grows by more than 1 KB. Revisiting choices made only to avoid client JS: the mentor shop page's two submit buttons become `PendingButton` (a small `useFormStatus` client component, staff-only page): "Saving the note…" or "Saving the check-in…" at once, with a second press ignored. Without JavaScript the forms work as before. A live character counter for the 1,000-character fields was considered and left out: the server's error already says what's wrong and keeps the text. Everything else stays a Server Component, because none of it needs the browser.
13. No duplicate `PendingButton`: N2 already creates `components/kit/PendingButton.tsx` with tests (N2 plan decision 17, Task 13b), with the props N4 needs (`children`, `pendingLabel`, `className`), so N4 drops its own `components/staff/PendingButton.tsx`, its test and its CSS. The note and check-in buttons use N2's, saying "Saving the note…" and "Saving the check-in…". Task 0 checks it exists. N4 adds no client component.

## Changes made during the build

- **Baseline (Task 0):** _to be filled in by the implementer: each public page's `scriptBrotli`, and `MENTOR_HTML_BEFORE` / `MENTOR_SHOP_HTML_BEFORE`._
- **N2 at Task 0:** _N2's six names found (required), and whether `role-views-writes` existed._
