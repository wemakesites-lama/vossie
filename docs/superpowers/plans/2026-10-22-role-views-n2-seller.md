# Role views N2: the seller home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/sell` into a seller home that says what needs the seller now (Needs you), then a few honest numbers and small charts, with a setup checklist for new shops; ship every "Fixes in N2" item (My listings as segments and rows, Delete set apart, empty states, "Mark {title} as sold" in a selling thread, the selling inbox's next step, back links, "Your" titles); give the seller bar its Messages badge. JavaScript: every page stays inside the 150 KB first-visit JS budget, each page's number is recorded against Task 0's baseline, and any page that grows by more than 1 KB gets a one-line reason in the progress entry (spec §3 and §9, Lama 2026-10-22).

**Architecture:** Three new readers and one extended one, each with a sample version (`lib/data/…`) and a Supabase twin (`lib/data/supabase/…`) under one contract: `sellerQueue(slug)` (one read: a definer SQL function `public.seller_queue` on Supabase, owner-only), `recentCounts` returning a `previous` window from the same rows, `dailyEnquiries(slug, days, now)` by SAST day, and `followerCounts(slug, since)` (a definer SQL function `public.follower_counts`, owner-only). The queue is read once per request through `queueFor` (React `cache`), shared by the seller bar's badge, the home's Needs you and a thread's Mark as sold. Everything on screen is a Server Component built from N1's kit.

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, TypeScript, Tailwind CSS 4.3 with component CSS in `app/globals.css`, Supabase (Postgres, pgTAP), Vitest 5 + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-22-role-views-design.md` (sections 3, 6, 7.1, 8, 9 and the N2 row of 10). **Depends on:** `docs/superpowers/plans/2026-10-22-role-views-n1-kit.md`, built exactly as written (its component names, props and CSS classes are used as they are there).

---

## Rules for whoever builds this

- **Commits:** implementers leave their work uncommitted. The controller checks each task and commits it, only with Lama's go-ahead for the stage (project memory, CLAUDE.md). Every "Commit" step below is for the controller.
- **One git command at a time.** Run `git status` before any git command, as a separate call. Stage only this plan's files (project memory: other sessions share the tree); never `git add .`.
- **Stop only your own server** (by PID or port), never `pkill` by name. Never stop an install or a build mid-flight.
- **The Supabase steps need the local stack:** `supabase start`, then `supabase db reset` (CLAUDE.md "Commands"). Never `--linked`.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`, `redirect.md` and `refresh.md` before Task 12; N2 uses no Next API that N1 and the existing code don't already use.
- Never write a font name, a hex colour, `md:` or `lg:` in a component. Sky never carries text, icons or thin lines on white. Data marks are navy or sky-dark.
- No `Date.now()`, `new Date()` or `Math.random()` in anything that can prerender: the home reads the clock only after `await connection()`.
- **Server Components stay the default.** N2 adds one small client component, `components/kit/PendingButton.tsx` (plan decision 17), because it makes the seller's buttons smoother and safer; nothing else on the seller pages is a client component. Small client costs are fine when they buy function, accessibility or smoothness (spec §3, Lama 2026-10-22); every page stays inside the 150 KB budget.
- Privacy: a shop sees how many follow it and how many follows are new this week, never who. No view counts anywhere.

## Plan decisions (where this plan narrows or departs from the spec; Lama to confirm at plan review)

1. **`sellerQueue(slug)` takes no `now`** (the spec wrote `sellerQueue(slug, now)`). Nothing in the queue depends on the clock: it returns each row's oldest timestamp, and the page works out the age chip from its own `now`, read after `connection()`. A sale is counted whether or not its 7-day auto-confirm has passed (both `done` and `confirmed` count), so no settling is needed either.
2. **"Buyers waiting for a reply"** counts conversations in status `asked` (the seller has never written; that is what `asked` means on both backends, so "last message from the buyer" always holds), not an offer, not one whose seller or buyer has gone. Questions to the shop count too: a buyer waiting is a buyer waiting, though the 48-hour badge rule only counts listing enquiries. Its oldest is the one asked longest ago.
3. **"Sales to mark as sold"** are selling conversations marked completed (`done` or `confirmed`) whose listing is still `available`, is an item (a service is sold again and again), isn't hidden by the Hub, and hasn't changed since the sale was marked completed (`completedAt >= listing.updatedAt`). The last rule stops the row nagging after the seller relisted or edited the listing on purpose. **A Hub hide or Show again counts as a change:** on Supabase both already set `listings.updated_at = now()` (`20261020120300_staff_shop_actions.sql:655,724`, `20261021120500_own_target_gate.sql:441,519`, `20261020120400_staff_tools_actions.sql:576`), so Task 4 makes the sample's `hideListing` and `showListing` (`lib/data/staff-shops.ts:274,296`) set `updatedAt` too, and the contract checks it on both backends. Offer threads count here (F counts their sales). The row's number is how many **listings** wait; it links to the oldest such thread. The queue returns the whole list (`sales`), so a thread shows "Mark {title} as sold" exactly when the queue lists it.
4. **Mark as sold needs no one-time token.** CLAUDE.md asks for one only on forms that make something new; marking sold twice changes nothing (`setOwnListingState` refuses sold to sold). The form posts to `changeListingState` with a new `thread` field; the action goes back to that thread (built with `threadPath` from an id that passed `isId`, so it can't be sent anywhere else) and leaves the notice under `threadSoldForm(id)`.
5. **"Hidden by the Hub" links to the tab of the oldest hidden listing** (`tabFor(state)`): My listings has no Hidden tab, and a hidden listing sits in its own state's tab, marked.
6. **The setup checklist's steps:** Add a photo of your shop (`image`), Say what you sell (`about`), Choose a pickup point (left out when the shop's campus has no pickup points, as for Eduvos Online), Publish your first listing (any non-draft listing), Reply to your first buyer (any non-offer conversation with a first reply). It shows while the shop has no published listing or has never replied, and replaces the Numbers, Chart and Badge cards; Needs you and Listings stay.
7. **Age chips:** under 1 hour "<1h", then whole hours to 47h, then whole days; info under 24h, **warning from 24h**, **danger from 48h** (the badge's window has passed). The spec named only the warning; danger at 48h is this plan's.
8. **The Messages badge counts buyers waiting for a reply** (`sellerQueue().replies.count`). The list it opens, the selling inbox, holds every conversation; the number equals the home's Needs-you row, which reads the same reader in the same request, and a unit test checks that.
9. **`recentCounts` returns `RecentCounts` (`EnquiryCounts & { previous }`)**; the mentor's readers keep their `EnquiryCounts` through a small `currentOf` so N4 decides what the mentor shows. The previous window counts enquiries made, and sales that counted, in `[since - days, since)`; "due" is judged at `now`, as it is for the current window.
10. **Followers:** a new reader `followerCounts(slug, since)` gives `{ total, recent }` in one read (`public.follower_counts`); `countFollowers` stays for its other callers. For anyone but the owner both are 0, as `follower_count` answers null today.
11. **Header words:** a pill says "Live", "Paused" or "Paused by the Hub"; a paused shop gets one line under it saying what that means. Three existing e2e lines that looked for "Your shop is live" or "Paused by the Hub: buyers can't see your listings" change (Task 14).
12. **My listings rows are `ListRow`s** that open the listing's edit page. N2 adds two optional props to N1's `ListRow`: `label` (the link's name, "Edit {title}", with the detail as its description, so every existing "Edit {title}" lookup still works) and `actions` (Pause, Resume, Relist, Mark sold, then Delete as a separate text link at the far end). N2 also adds `count?` to `LinkTab`, drawn under the label in the segmented look, so four segments fit one line at 360px.
13. **Titles:** the tab titles say "Your listings", "Edit your listing" and "Delete your listing"; My listings' heading and the crumbs say "Your listings". `/sell` keeps "Sell on CampusCart" (static; signed-out visitors see the pitch there). The notifications that say "See why in My listings" keep their words: they are written by SQL on Supabase too, and already-sent ones keep theirs (CLAUDE.md "The name": notifications already written keep their words); a later pass can change both.
14. **The owner's storefront "Back to your shop"** sits in the Follow box the owner had empty (44px kept for every viewer), as a white outline button on the stars, so nothing moves when it streams in.
15. **`SellSkeleton` becomes a header block and one card block** (about 17rem), shorter than every state of `/sell`; `.sell-page`'s screen-tall minimum keeps the footer below the first screen (CLAUDE.md), so the old 47rem height isn't needed. Task 14 measures it against the shortest state (a new shop's checklist).
16. **Supabase reads of a shop's conversations are cached per request** (`cache` on the twin's `conversationsOfSlug`), so the home's `shopStats`, `recentCounts` and `dailyEnquiries` make one query, not three. Outside a render (Server Actions, tests) `cache` passes through.
17. **One small client component, `PendingButton` (revisited after Lama's 2026-10-22 rule on JS).** The plan first kept every seller control a plain server form only to save bytes. Now "Mark {title} as sold", and My listings' Pause, Resume, Relist and Mark sold, use `components/kit/PendingButton.tsx` (`useFormStatus`): while the post is on its way the button says what's happening ("Marking as sold…") and is `aria-disabled`, so a second tap does nothing and screen readers hear the change through `aria-live`. The forms still work without JavaScript. `/sell` itself doesn't use it (the header prefetches `/sell` on every page and Pause is rare), so its first visit stays as it was; CLAUDE.md's "PhotoField is the only selling client component" line changes to name both (Task 16).

## File structure

**Create**
- `lib/data/seller-queue.ts`, `lib/data/seller-queue.test.ts`: the queue (sample, pure `queueOver`).
- `lib/data/supabase/seller-queue.ts`: its twin, over `public.seller_queue`.
- `lib/data/contract/seller-home.contract.ts`, `seller-home.test.ts`, `seller-home.db.test.ts`: the contract for all four readers.
- `supabase/migrations/20261025120000_role_views_seller.sql`: `public.seller_queue`, `public.follower_counts`.
- `supabase/tests/60_role_views_seller.test.sql`.
- `lib/selling/home.ts`, `lib/selling/home.test.ts`: the home's pure helpers (Needs-you rows, age chips, checklist steps, words).
- `lib/selling/queue.ts`: `queueFor`, the queue once per request.
- `components/kit/sell-badge.test.tsx`: "badge equals list" on the real sample store.
- `components/kit/PendingButton.tsx`, `components/kit/PendingButton.test.tsx`: N2's one client component (plan decision 17).
- `tests/e2e/role-views-writes.spec.ts`.

**Modify**
- `lib/types.ts`: `QueueOldest`, `QueueRow`, `SaleToMark`, `SellerQueue`, `RecentCounts`, `FollowerCounts`.
- `lib/time.ts`, `lib/time.test.ts`: `lastSastDays`.
- `lib/data/shop-stats.ts`, `lib/data/supabase/shop-stats.ts`, `lib/data/shop-stats.test.ts`: `previous`, `dailyEnquiries`, `currentOf`.
- `lib/data/mentors.ts`, `lib/data/supabase/mentors.ts`: `currentOf`.
- `lib/data/follows.ts`, `lib/data/supabase/follows.ts`: `followerCounts`.
- `lib/data/contract/stats.contract.ts`: `recentCounts`' new shape.
- `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`: `follow(…, at?)`.
- `supabase/tests/06_account_actions.test.sql`: the two new functions in the signed-in allowlist.
- `lib/supabase/database.types.ts`: regenerated (`pnpm db:types`).
- `lib/selling/badges.ts` and its test: `replyRateTarget`.
- `lib/selling/form-state.ts`: `threadSoldForm`.
- `lib/selling/listing-actions.ts` and its test: the `thread` field.
- `components/kit/ListRow.tsx`, `components/kit/ListRow.test.tsx`: `label`, `actions`.
- `components/ui/LinkTabs.tsx`, `components/ui/LinkTabs.test.tsx`: `count`.
- `components/kit/sections.tsx`, `components/kit/sections.test.tsx`: the Messages badge.
- `components/sell/SellHome.tsx`, `Dashboard.tsx`, `SellSkeleton.tsx`, `MyListingsView.tsx` and their tests.
- `components/messages/SaleActions.tsx`, `ThreadView.tsx`, `OpenThread.tsx`, `InboxView.tsx` and their tests; `components/messages/field-ids.test.tsx`, `components/forms/summary-ids.test.tsx` (mocks).
- `components/sell/MyListings.test.tsx` (its title lookup).
- `lib/data/staff-shops.ts`, `lib/data/staff-shops.test.ts`, `lib/staff/admin-actions.ts`, `lib/data/contract/staff-shops.contract.ts`: a Hub hide or Show again sets `updatedAt` (plan decision 3).
- `components/seller/ViewerFollow.tsx` and its test.
- `app/sell/listings/page.tsx`, `app/sell/listings/new/page.tsx`, `app/sell/listings/[id]/edit/page.tsx`, `app/sell/listings/[id]/delete/page.tsx`.
- `app/globals.css`: one new block, "Role views: the seller home (N2)", after N1's kit block; the old dashboard and tab rules that nothing uses any more go.
- `playwright.config.ts`: the `role-views-writes` project.
- `tests/e2e/role-views.spec.ts`, `tests/e2e/role-views-screenshots.spec.ts`, `tests/e2e/cls.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/selling.spec.ts`, `tests/e2e/staff.spec.ts`, `tests/e2e/staff-writes.spec.ts`, `tests/e2e/screenshots.spec.ts`.
- `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`.

---

### Task 0: Record the baselines

**Files:** none changed. The numbers go into "Changes made during the build" at the end of this plan.

- [ ] **Step 1: Check the tree**

```bash
git status
```
Expected: N1 is committed; only plans and other sessions' files are untracked or modified. Nothing under `app/`, `components/` or `lib/` is changed. If N1 isn't in, stop and tell the controller.

- [ ] **Step 2: The JS baseline**

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Expected: all pass. Copy every page's `scriptBrotli` (public and signed-in) into "Changes made during the build" under "Baseline": Task 15 records each page against it (spec §9).

```bash
grep -rln "use client" components/sell components/kit components/charts components/messages components/seller lib/selling
```
Write the list down too: Task 15 checks that N2 added no file to it.

- [ ] **Step 3: The home's HTML baseline**

With the build from Step 2, start the server yourself (`pnpm start --port 3200`), sign in at `http://localhost:3200/login` with "Seller, Tech corner", open `/sell`, and in the browser console run:

```js
document.querySelector("main").outerHTML.length
```
Write the number down as "N1 `/sell` main HTML" (Task 14's size check adds 8,192 to it). Stop your server by its PID.

---

### Task 1: Types and the SAST day list

**Files:**
- Modify: `lib/types.ts` (after `ShopStats`, line 477)
- Modify: `lib/time.ts` (after `sastToday`, line 23), `lib/time.test.ts`

- [ ] **Step 1: Write the failing test.** Add to `lib/time.test.ts` (import `lastSastDays` with the others):

```ts
describe("lastSastDays (role views N2)", () => {
  it("gives the last days by South African date, oldest first, across a month end", () => {
    // 00:30 on 1 November in South Africa is still 31 October in UTC.
    expect(lastSastDays(3, new Date("2026-10-31T22:30:00.000Z"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("gives today alone for one day", () => {
    expect(lastSastDays(1, new Date("2026-10-14T10:00:00.000Z"))).toEqual(["2026-10-14"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run lib/time.test.ts`
Expected: FAIL (`lastSastDays` is not exported).

- [ ] **Step 3: Implement.** In `lib/time.ts`, after `sastToday`:

```ts
/**
 * The last `days` South African dates up to `now`'s, oldest first, as YYYY-MM-DD (role views spec 6: a seller's
 * enquiries by day). Worked out in UTC from the SAST date, so the server's timezone can't move a day. It reads no
 * clock: `now` comes from the caller.
 */
export function lastSastDays(days: number, now: Date): string[] {
  const [year, month, day] = sastDate(now).split("-").map(Number);
  return Array.from({ length: days }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (days - 1 - index))).toISOString().slice(0, 10),
  );
}
```

In `lib/types.ts`, after `ShopStats`:

```ts
/** A window's counts and the window of the same length before it (role views spec 6: recentCounts + previous). */
export type RecentCounts = EnquiryCounts & { previous: EnquiryCounts };

/** How many follow a shop, and how many of those follows were made since a time and still stand. Never who. */
export type FollowerCounts = { total: number; recent: number };

/**
 * The oldest thing in one of the seller's Needs-you rows (role views spec 6): a conversation (`state` null; `title` the
 * listing's, or null for a question to the shop) or a listing (`state` its own). `at` is UTC, ISO.
 */
export type QueueOldest = { id: string; title: string | null; at: string; state: ListingState | null };

/** One Needs-you row's count and its oldest item. */
export type QueueRow = { count: number; oldest: QueueOldest | null };

/** A sale marked completed in a selling thread whose listing is still up for sale (role views N2 plan decision 3). */
export type SaleToMark = { conversationId: string; listingId: string; title: string; at: string };

/** What needs a shop's owner now (role views spec 6 and 7.1), in one read. Request-time; never cached across requests. */
export type SellerQueue = {
  /** Buyers waiting for a first reply (plan decision 2). */
  replies: QueueRow;
  /** Oldest first. The Needs-you number is how many listings these are. */
  sales: SaleToMark[];
  drafts: QueueRow;
  /** Listings the Hub hid, oldest hide first. */
  hidden: QueueRow;
  /** Listings the seller paused. */
  paused: QueueRow;
  /** The shop's listings by state, for the Listings card. */
  listings: { available: number; paused: number; sold: number; drafts: number };
  /** The shop has answered a buyer at least once (not an offer): the setup checklist's last step. */
  everReplied: boolean;
};
```

`ListingState` is already declared in `lib/types.ts`; check it's in scope where the block goes.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/time.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/types.ts lib/time.ts lib/time.test.ts
git commit -m "feat: types for the seller home's readers, and lastSastDays (role views N2 Task 1)"
```

---

### Task 2: The previous window and enquiries by day

**Files:**
- Modify: `lib/data/shop-stats.ts`, `lib/data/supabase/shop-stats.ts`, `lib/data/shop-stats.test.ts`
- Modify: `lib/data/mentors.ts` (line 36), `lib/data/supabase/mentors.ts` (line 73)

- [ ] **Step 1: Write the failing tests.** In `lib/data/shop-stats.test.ts`, change the import to `import { dailyEnquiries, recentCounts, shopStats } from "./shop-stats";` and replace the test "counts any window, such as the mentor dashboard's 14 days (staff tools plan decision 15)" (`lib/data/shop-stats.test.ts:91`) with:

```ts
  it("counts any window, such as the mentor dashboard's 14 days (staff tools plan decision 15), and the window before it (role views N2)", async () => {
    sampleStore().conversations.clear();
    add({ createdAt: ago(24 * 10), firstReplyAt: ago(24 * 10 - 1) });
    add({ createdAt: ago(24 * 15) });
    add({ createdAt: ago(24 * 20), status: "confirmed", confirmedAt: ago(24 * 13), confirmedBy: "buyer" });
    // Read as shopStats reads them (amendment 11), so the dashboard and the badge agree: a gone owner's count for nobody.
    add({ sellerGone: true, createdAt: ago(24), firstReplyAt: ago(23) });
    expect(await recentCounts("tech-corner", 14, NOW)).toEqual({
      enquiries: 1,
      due: 1,
      repliedInTime: 1,
      salesConfirmed: 1,
      // 14 to 28 days ago: the two older enquiries, neither answered in time; the sale counted 13 days ago is this window's.
      previous: { enquiries: 2, due: 2, repliedInTime: 0, salesConfirmed: 0 },
    });
  });
```

and add a new `describe` at the end of the file:

```ts
describe("enquiries by SAST day (role views spec 6)", () => {
  it("counts each day's enquiries, oldest day first, leaving out offers and questions to the shop", async () => {
    sampleStore().conversations.clear();
    // NOW is 12:00 on 14 October in South Africa.
    add({ createdAt: "2026-10-13T21:59:00.000Z" }); // 23:59 on the 13th
    add({ createdAt: "2026-10-13T22:01:00.000Z" }); // 00:01 on the 14th
    add({ createdAt: "2026-10-14T06:00:00.000Z" });
    add({ createdAt: "2026-10-12T06:00:00.000Z", requestId: "r-001", requestTitle: "A lamp" });
    add({ createdAt: "2026-10-12T06:00:00.000Z", listingId: null, listingTitle: null });
    add({ createdAt: "2026-10-12T06:00:00.000Z", sellerGone: true });
    expect(await dailyEnquiries("tech-corner", 3, NOW)).toEqual([0, 1, 2]);
  });

  it("has no number for the days before the shop existed", async () => {
    // Crochet corner was made at 14:20 on 10 October in South Africa.
    expect(await dailyEnquiries("crochet-corner", 7, NOW)).toEqual([null, null, 0, 0, 0, 0, 0]);
  });

  it("has no number on any day for a shop that doesn't exist", async () => {
    expect(await dailyEnquiries("no-such-shop", 2, NOW)).toEqual([null, null]);
  });
});
```

`NOW` in this file is `2026-10-14T10:00:00.000Z` (line 6). Crochet corner's `createdAt` is `2026-10-10T12:20:00.000Z` (`data/fixtures/shops.ts:38`), 14:20 SAST, so 10 October is its first day: the window 8 to 14 October gives two nulls.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/shop-stats.test.ts`
Expected: FAIL (`previous` missing; `dailyEnquiries` not exported).

- [ ] **Step 3: Implement the sample side.** In `lib/data/shop-stats.ts`:

Change the imports to:

```ts
import { onSupabase } from "@/lib/backend";
import { autoConfirmAt, DAY_MS } from "@/lib/messaging/rules";
import { lastSastDays, sastDate } from "@/lib/time";
import type { EnquiryCounts, RecentCounts, ShopStats } from "@/lib/types";
import type { ConversationRow } from "./rows";
import { sampleStore } from "./store";
```

Replace `counts` with (one new optional parameter, `before`, so the window can end):

```ts
export function counts(
  rows: readonly CountedConversation[],
  enquiriesSince: number,
  salesSince: number,
  now: Date,
  before: number = Number.POSITIVE_INFINITY,
): EnquiryCounts {
  // An offer thread isn't an enquiry: the shop wrote first (community actions spec 2.12). Its sale still counts.
  const enquiries = rows.filter((row) => {
    const at = Date.parse(row.createdAt);
    return row.listingId !== null && !row.requestId && at >= enquiriesSince && at < before;
  });
  const inTime = enquiries.filter(
    (row) => row.firstReplyAt !== null && Date.parse(row.firstReplyAt) - Date.parse(row.createdAt) <= REPLY_WINDOW_MS,
  );
  const due = enquiries.filter(
    (row) => inTime.includes(row) || now.getTime() - Date.parse(row.createdAt) >= REPLY_WINDOW_MS,
  );
  const sales = rows.filter((row) => {
    const at = soldAt(row, now);
    return at !== null && Date.parse(at) >= salesSince && Date.parse(at) < before;
  });
  return { enquiries: enquiries.length, due: due.length, repliedInTime: inTime.length, salesConfirmed: sales.length };
}
```

Replace `recentOver` with:

```ts
/**
 * A shop's enquiries and sales over the last `days` days, and over the `days` before those (role views spec 6), from
 * its conversations (either backend's). One pass over the same rows, so the comparison costs no second read.
 */
export function recentOver(rows: readonly CountedConversation[], days: number, now: Date): RecentCounts {
  const since = now.getTime() - days * DAY_MS;
  const before = since - days * DAY_MS;
  return { ...counts(rows, since, since, now), previous: counts(rows, before, before, now, since) };
}

/** The current window alone, for readers that show no comparison yet (the mentor's, until N4). */
export function currentOf({ enquiries, due, repliedInTime, salesConfirmed }: RecentCounts): EnquiryCounts {
  return { enquiries, due, repliedInTime, salesConfirmed };
}

/**
 * Enquiries per SAST day over the last `days` days, oldest first (role views spec 6). A day before the shop existed
 * (`createdAt`, null for no shop) has no number. Offers and questions to the shop aren't enquiries.
 */
export function dailyOver(
  rows: readonly CountedConversation[],
  createdAt: string | null,
  days: number,
  now: Date,
): (number | null)[] {
  const first = createdAt === null ? null : sastDate(new Date(createdAt));
  const perDay = new Map<string, number>();
  for (const row of rows) {
    if (row.listingId === null || row.requestId) continue;
    const day = sastDate(new Date(row.createdAt));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return lastSastDays(days, now).map((day) => (first === null || day < first ? null : (perDay.get(day) ?? 0)));
}

/** The shop's conversations as the counting reads them: its own, while its owner is there (amendment 9.1). */
function rowsOf(sellerSlug: string): ConversationRow[] {
  return [...sampleStore().conversations.values()].filter((row) => row.sellerSlug === sellerSlug && !row.sellerGone);
}
```

Replace the bodies of `shopStats` and `recentCounts`, and add `dailyEnquiries`, at the end of the file:

```ts
/** A shop's last 7 days, and its record for the badges: 90 days of enquiries, and every sale. */
export async function shopStats(sellerSlug: string, now: Date): Promise<ShopStats> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).shopStats(sellerSlug, now);
  return statsOver(rowsOf(sellerSlug), now);
}

/**
 * A shop's enquiries and sales over the last `days` days and the `days` before (role views spec 6): the seller home's
 * 7 and the mentor dashboard's 14 (staff tools plan decision 15). It reads the same rows as shopStats, so a
 * conversation whose owner has gone counts for no shop (amendment 11).
 */
export async function recentCounts(sellerSlug: string, days: number, now: Date): Promise<RecentCounts> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).recentCounts(sellerSlug, days, now);
  return recentOver(rowsOf(sellerSlug), days, now);
}

/** A shop's enquiries per SAST day over the last `days` days, null before it existed (role views spec 6). */
export async function dailyEnquiries(sellerSlug: string, days: number, now: Date): Promise<(number | null)[]> {
  if (onSupabase()) return (await import("./supabase/shop-stats")).dailyEnquiries(sellerSlug, days, now);
  return dailyOver(rowsOf(sellerSlug), sampleStore().sellers.get(sellerSlug)?.createdAt ?? null, days, now);
}
```

- [ ] **Step 4: Implement the twin.** In `lib/data/supabase/shop-stats.ts`, keep `import "server-only";` first, and change the imports and helpers to:

```ts
import "server-only";
import { cache } from "react";
import type * as Sample from "../shop-stats";
import { type CountedConversation, dailyOver, recentOver, statsOver } from "../shop-stats";
import { forServer } from "./clients";
import { selectAll } from "./rows";
```

Replace `shopIdOf` and `conversationsOfSlug` with:

```ts
/** The shop's id and when it was made, by its link, or null when there's no such shop. Once per request. */
const shopOf = cache(async (slug: string): Promise<{ id: string; createdAt: string } | null> => {
  const { data, error } = await forServer().from("shops").select("id, created_at").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id, createdAt: data.created_at } : null;
});

/**
 * The shop's counted conversations by its link, once per request (role views N2 plan decision 16): the seller home
 * reads shopStats, recentCounts and dailyEnquiries in one render. Outside a render, cache passes straight through.
 */
const conversationsOfSlug = cache(async (slug: string): Promise<CountedConversation[]> => {
  const shop = await shopOf(slug);
  return shop === null ? [] : conversationsOf(shop.id);
});
```

and replace the exports at the end with:

```ts
/** A shop's last 7 days, and its record for the badges: 90 days of enquiries, and every sale. */
export const shopStats: typeof Sample.shopStats = async (sellerSlug, now) =>
  statsOver(await conversationsOfSlug(sellerSlug), now);

/** A shop's enquiries and sales over the last `days` days and the `days` before. */
export const recentCounts: typeof Sample.recentCounts = async (sellerSlug, days, now) =>
  recentOver(await conversationsOfSlug(sellerSlug), days, now);

/** A shop's enquiries per SAST day, null before it existed. */
export const dailyEnquiries: typeof Sample.dailyEnquiries = async (sellerSlug, days, now) =>
  dailyOver(await conversationsOfSlug(sellerSlug), (await shopOf(sellerSlug))?.createdAt ?? null, days, now);
```

Update the file's header comment: add "N2 (role views spec 6) adds the previous window and enquiries by day, from the same rows, read once per request."

- [ ] **Step 5: Keep the mentor's counts as they are.** In `lib/data/mentors.ts`, change `import { recentCounts } from "./shop-stats";` to `import { currentOf, recentCounts } from "./shop-stats";` and line 36 to:

```ts
    const counts = currentOf(await recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now));
```

In `lib/data/supabase/mentors.ts`, change `import { recentCounts } from "../shop-stats";` to `import { currentOf, recentCounts } from "../shop-stats";` and line 73 the same way.

- [ ] **Step 6: The contract's old expectations.** In `lib/data/contract/stats.contract.ts`, the two `recentCounts` lines become:

```ts
      expect(await recentCounts(slug, 14, now), slug).toEqual({ ...NOTHING, previous: NOTHING });
```
```ts
    expect(await recentCounts("tech-corner", 14, now)).toEqual({ ...counts, previous: NOTHING });
```

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run lib/data/shop-stats.test.ts lib/data/mentors.test.ts lib/data/contract/stats.test.ts lib/data/contract/mentors.test.ts && pnpm typecheck`
Expected: PASS, clean. `grep -rn "recentCounts(" app components lib | grep -v test` lists only `lib/data/mentors.ts`, `lib/data/supabase/mentors.ts` and the two shop-stats files (SellHome joins in Task 9).

- [ ] **Step 8: Commit (controller)**

```bash
git add lib/data/shop-stats.ts lib/data/supabase/shop-stats.ts lib/data/shop-stats.test.ts lib/data/mentors.ts lib/data/supabase/mentors.ts lib/data/contract/stats.contract.ts
git commit -m "feat(data): recentCounts gives the window before from the same rows, dailyEnquiries by SAST day, one Supabase read per request (role views N2 Task 2)"
```

---

### Task 3: How many follow, and how many are new

**Files:**
- Modify: `lib/data/follows.ts`, `lib/data/supabase/follows.ts`, `lib/data/follows.test.ts`
- Modify: `tests/contract/world.ts`, `tests/contract/sample-world.ts` (line 203), `tests/db/supabase-world.ts` (line 394)

The Supabase twin calls `public.follower_counts`, which Task 5 adds; its contract runs in Task 6.

- [ ] **Step 1: Write the failing test.** Add to `lib/data/follows.test.ts` (import `followerCounts` with the others):

```ts
describe("followerCounts (role views spec 7.1)", () => {
  it("counts the shop's follows and the ones made since a time that still stand, never who", async () => {
    await addFollow("acc-student", "tech-corner", new Date("2026-10-01T08:00:00.000Z"));
    await addFollow("acc-mentor", "tech-corner", new Date("2026-10-13T08:00:00.000Z"));
    await addFollow("acc-admin", "tech-corner", new Date("2026-10-14T08:00:00.000Z"));
    await removeFollow("acc-admin", "tech-corner");
    expect(await followerCounts("tech-corner", new Date("2026-10-07T10:00:00.000Z"))).toEqual({ total: 2, recent: 1 });
    expect(await followerCounts("hair-studio", new Date("2026-10-07T10:00:00.000Z"))).toEqual({ total: 0, recent: 0 });
  });
});
```

`acc-student`, `acc-mentor` and `acc-admin` are sample accounts (`data/fixtures/accounts.ts:18, 63, 75`), none of them Tech corner's owner.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run lib/data/follows.test.ts`
Expected: FAIL (`followerCounts` is not exported).

- [ ] **Step 3: Implement.** In `lib/data/follows.ts`, import `FollowerCounts` with `FollowedShop` from `@/lib/types`, and add after `countFollowers`:

```ts
/**
 * How many follow the shop, and how many of those follows were made since `since` (role views spec 7.1: "+N new this
 * week"). An unfollow deletes its follow, so this is follows that still stand, never a net change. Never who.
 */
export async function followerCounts(sellerSlug: string, since: Date): Promise<FollowerCounts> {
  if (onSupabase()) return (await import("./supabase/follows")).followerCounts(sellerSlug, since);
  const follows = followsOf(sellerSlug);
  return {
    total: follows.length,
    recent: follows.filter((row) => Date.parse(row.createdAt) >= since.getTime()).length,
  };
}
```

In `lib/data/supabase/follows.ts`, add after `countFollowers`:

```ts
/** How many follow the signed-in owner's shop, and how many since `since` (follower_counts answers its owner only). */
export const followerCounts: typeof Sample.followerCounts = async (sellerSlug, since) => {
  const client = await forViewer();
  const shopId = await shopIdOf(client, sellerSlug);
  if (!shopId) return { total: 0, recent: 0 };
  const { data, error } = await client.rpc("follower_counts", { p_shop: shopId, p_since: since.toISOString() });
  if (error) failed("follower_counts", error);
  const row = data?.[0];
  return { total: row?.total ?? 0, recent: row?.recent ?? 0 };
};
```

Until Task 5 regenerates `database.types.ts`, this line doesn't typecheck; that's expected. Do Steps 4 and 5 now and the typecheck in Task 5.

- [ ] **Step 4: Let a world follow at a time.** In `tests/contract/world.ts`, change the `follow` line to:

```ts
  /** That account follows the shop (C2/C3 plan Task 9; C4's verb of the same name), now or at `at` (role views N2). */
  follow(follower: WorldAccountName, slug: string, at?: Date): Promise<void>;
```

In `tests/contract/sample-world.ts`, line 203:

```ts
    async follow(follower, slug, at = new Date()) {
      const accountId = await this.signedIn(follower);
      const follows = sampleStore().follows;
      const id = `follow-contract-${follows.size + 1}`;
      follows.set(id, { id, accountId, sellerSlug: slug, createdAt: at.toISOString() });
    },
```

In `tests/db/supabase-world.ts`, line 394, the insert becomes:

```ts
    async follow(follower, slug, at) {
      const added = await admin
        .from("follows")
        .insert({
          account_id: await this.signedIn(follower),
          shop_id: await shopId(slug),
          ...(at ? { created_at: at.toISOString() } : {}),
        })
        .select("id")
        .single();
```

(the rest of the verb, its undo, stays).

- [ ] **Step 5: Run the sample tests**

Run: `pnpm vitest run lib/data/follows.test.ts lib/data/contract/follows.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit (controller)** after Task 5's typecheck passes, with Task 5's commit.

---

### Task 4: The seller's queue (sample store)

**Files:**
- Create: `lib/data/seller-queue.ts`, `lib/data/seller-queue.test.ts`

- [ ] **Step 1: Write the failing tests** in `lib/data/seller-queue.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationRow, ListingRow } from "./rows";
import { queueOver, sellerQueue } from "./seller-queue";
import { resetSampleStore, sampleStore } from "./store";
import { makeListingRow } from "@/tests/helpers/fakes";

beforeEach(() => {
  resetSampleStore();
});

let made = 0;
/** A conversation with Tech corner, asked at `createdAt` and nothing else, unless the overrides say. */
function talk(overrides: Partial<ConversationRow>): ConversationRow {
  made += 1;
  return {
    id: `conv-q${made}`,
    listingId: "q-avail",
    listingTitle: "Desk lamp",
    sellerSlug: "tech-corner",
    buyerId: `acc-buyer-${made}`,
    sellerGone: false,
    status: "asked",
    createdAt: "2026-10-18T08:00:00.000Z",
    lastMessageAt: "2026-10-18T08:00:00.000Z",
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    ...overrides,
  };
}

const listing = (overrides: Partial<ListingRow>): ListingRow =>
  makeListingRow({ kind: "item", state: "available", updatedAt: "2026-10-10T08:00:00.000Z", ...overrides });

const LISTINGS = [
  listing({ id: "q-avail", title: "Desk lamp" }),
  listing({ id: "q-relist", title: "Kettle", updatedAt: "2026-10-20T08:00:00.000Z" }),
  listing({ id: "q-service", title: "Maths tutoring", kind: "service", condition: null }),
  listing({ id: "q-draft", title: "Bike", state: "draft", updatedAt: "2026-10-05T08:00:00.000Z" }),
  listing({ id: "q-paused", title: "Paused lamp", state: "paused", updatedAt: "2026-10-08T08:00:00.000Z" }),
  listing({ id: "q-hidden", title: "Exam papers", hiddenAt: "2026-10-17T08:00:00.000Z", hiddenReason: "Not allowed." }),
  listing({ id: "q-sold", title: "Radio", state: "sold", updatedAt: "2026-10-09T08:00:00.000Z" }),
];

describe("the seller's queue (role views spec 6 and 7.1)", () => {
  it("counts buyers waiting for a first reply, oldest first, and leaves out offers, replies and anyone gone", () => {
    const queue = queueOver(
      [
        talk({ id: "conv-old", listingId: "q-paused", listingTitle: "Paused lamp", createdAt: "2026-10-17T08:00:00.000Z" }),
        talk({ id: "conv-new", listingId: "q-sold", listingTitle: "Radio" }),
        talk({ id: "conv-question", listingId: null, listingTitle: null, createdAt: "2026-10-19T08:00:00.000Z" }),
        talk({ status: "replied", firstReplyAt: "2026-10-18T09:00:00.000Z" }),
        talk({ status: "offered", requestId: "r-001", requestTitle: "A lamp", createdAt: "2026-10-01T08:00:00.000Z" }),
        talk({ sellerGone: true, createdAt: "2026-10-01T08:00:00.000Z" }),
        talk({ buyerId: null, createdAt: "2026-10-01T08:00:00.000Z" }),
      ],
      LISTINGS,
    );
    expect(queue.replies).toEqual({
      count: 3,
      oldest: { id: "conv-old", title: "Paused lamp", at: "2026-10-17T08:00:00.000Z", state: null },
    });
    expect(queue.everReplied).toBe(true);
  });

  it("lists sales to mark as sold: an available item, not hidden, unchanged since the sale, oldest first", () => {
    const queue = queueOver(
      [
        talk({ id: "conv-done", status: "done", completedAt: "2026-10-15T08:00:00.000Z" }),
        talk({
          id: "conv-confirmed",
          status: "confirmed",
          completedAt: "2026-10-12T08:00:00.000Z",
          confirmedAt: "2026-10-13T08:00:00.000Z",
          confirmedBy: "buyer",
        }),
        // Relisted after the sale: the seller has acted since (plan decision 3).
        talk({ listingId: "q-relist", status: "done", completedAt: "2026-10-14T08:00:00.000Z" }),
        // A service is sold again and again; a hidden listing isn't the seller's to sell now; a sold one is done.
        talk({ listingId: "q-service", status: "done", completedAt: "2026-10-15T08:00:00.000Z" }),
        talk({ listingId: "q-hidden", status: "done", completedAt: "2026-10-16T08:00:00.000Z" }),
        talk({ listingId: "q-sold", status: "done", completedAt: "2026-10-16T08:00:00.000Z" }),
        // An offer's sale counts, as F counts it.
        talk({
          id: "conv-offer",
          status: "done",
          requestId: "r-001",
          requestTitle: "A lamp",
          completedAt: "2026-10-16T08:00:00.000Z",
        }),
        talk({ sellerGone: true, status: "done", completedAt: "2026-10-16T08:00:00.000Z" }),
      ],
      LISTINGS,
    );
    expect(queue.sales.map((sale) => [sale.conversationId, sale.listingId, sale.title])).toEqual([
      ["conv-confirmed", "q-avail", "Desk lamp"],
      ["conv-done", "q-avail", "Desk lamp"],
      ["conv-offer", "q-avail", "Desk lamp"],
    ]);
  });

  it("counts drafts, Hub-hidden and paused listings, each with its oldest, and the listings by state", () => {
    const queue = queueOver([], LISTINGS);
    expect(queue.drafts).toEqual({ count: 1, oldest: { id: "q-draft", title: "Bike", at: "2026-10-05T08:00:00.000Z", state: "draft" } });
    expect(queue.hidden).toEqual({
      count: 1,
      oldest: { id: "q-hidden", title: "Exam papers", at: "2026-10-17T08:00:00.000Z", state: "available" },
    });
    expect(queue.paused.oldest?.id).toBe("q-paused");
    expect(queue.listings).toEqual({ available: 4, paused: 1, sold: 1, drafts: 1 });
    expect(queue.everReplied).toBe(false);
  });

  it("reads Tech corner's own rows from the store: the seed's calculator sale waits to be marked sold", async () => {
    const queue = await sellerQueue("tech-corner");
    // conv-s2 (data/fixtures/messages.ts:25) was marked done on 13 October; l-001 last changed on 12 October.
    expect(queue.sales.map((sale) => sale.conversationId)).toEqual(["conv-s2"]);
    expect(queue.replies.count).toBe(0);
    expect(queue.everReplied).toBe(true);
    sampleStore().listings.get("l-001")!.state = "sold";
    expect((await sellerQueue("tech-corner")).sales).toEqual([]);
  });

  it("reads nothing of another shop's", async () => {
    sampleStore().conversations.set("conv-x", talk({ id: "conv-x", sellerSlug: "hair-studio" }));
    expect((await sellerQueue("tech-corner")).replies.count).toBe(0);
  });
});
```

Check `makeListingRow` (`tests/helpers/fakes.ts:137`) accepts `hiddenAt`, `hiddenReason`, `kind`, `condition` and `updatedAt` overrides (it spreads them). Check Tech corner's two seed listings stay available and unhidden in the fixtures; if `l-001`'s `updatedAt` in `data/fixtures/shops.ts:91` is later than 13 October 15:00 UTC, the fourth test's first expectation is `[]` instead, and that's what the seed says: change the test, not the rule.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/seller-queue.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/data/seller-queue.ts`:

```ts
import { onSupabase } from "@/lib/backend";
import type { QueueOldest, QueueRow, SaleToMark, SellerQueue } from "@/lib/types";
import type { ConversationRow, ListingRow } from "./rows";
import { sampleStore } from "./store";

// What needs a shop's owner now (role views spec 6 and 7.1; N2 plan decisions 1 to 3): buyers waiting for a first
// reply, sales whose listing is still up, drafts, Hub-hidden and paused listings, each with its oldest, plus the
// listings by state and whether the shop has ever replied. One slim read, request-time, never cached across requests;
// lib/selling/queue.ts reads it once per request. On Supabase it is public.seller_queue, which answers the shop's
// owner only (lib/data/supabase/seller-queue.ts). The caller passes the signed-in account's own shop.

const iso = (at: string) => new Date(at).toISOString();

const older = (a: { at: string; id: string }, b: { at: string; id: string }) =>
  Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function rowOf(items: readonly QueueOldest[]): QueueRow {
  const sorted = [...items].sort(older);
  return { count: sorted.length, oldest: sorted[0] ?? null };
}

const fromListing = (row: ListingRow, at: string): QueueOldest => ({ id: row.id, title: row.title, at: iso(at), state: row.state });

/** The queue over one shop's conversations and listings (either list may hold rows of other shops' only if passed). */
export function queueOver(conversations: readonly ConversationRow[], listings: readonly ListingRow[]): SellerQueue {
  const talks = conversations.filter((row) => !row.sellerGone);
  const byId = new Map(listings.map((row) => [row.id, row]));
  const sales: SaleToMark[] = talks
    .flatMap((row) => {
      const listing = row.listingId ? byId.get(row.listingId) : undefined;
      const at = row.completedAt ?? row.confirmedAt;
      if (!listing || !at || (row.status !== "done" && row.status !== "confirmed")) return [];
      if (listing.state !== "available" || listing.kind !== "item" || listing.hiddenAt) return [];
      if (Date.parse(at) < Date.parse(listing.updatedAt)) return [];
      return [{ conversationId: row.id, listingId: listing.id, title: listing.title, at: iso(at) }];
    })
    .sort((a, b) => older({ at: a.at, id: a.conversationId }, { at: b.at, id: b.conversationId }));
  const inState = (state: ListingRow["state"]) => listings.filter((row) => row.state === state);
  return {
    replies: rowOf(
      talks
        .filter((row) => row.status === "asked" && !row.requestId && row.buyerId !== null)
        .map((row) => ({ id: row.id, title: row.listingTitle, at: iso(row.createdAt), state: null })),
    ),
    sales,
    drafts: rowOf(inState("draft").map((row) => fromListing(row, row.updatedAt))),
    hidden: rowOf(listings.flatMap((row) => (row.hiddenAt ? [fromListing(row, row.hiddenAt)] : []))),
    paused: rowOf(inState("paused").map((row) => fromListing(row, row.updatedAt))),
    listings: {
      available: inState("available").length,
      paused: inState("paused").length,
      sold: inState("sold").length,
      drafts: inState("draft").length,
    },
    everReplied: talks.some((row) => !row.requestId && row.firstReplyAt !== null),
  };
}

/** What needs the owner of `sellerSlug` now. The caller passes the signed-in account's own shop. */
export async function sellerQueue(sellerSlug: string): Promise<SellerQueue> {
  if (onSupabase()) return (await import("./supabase/seller-queue")).sellerQueue(sellerSlug);
  const { conversations, listings } = sampleStore();
  return queueOver(
    [...conversations.values()].filter((row) => row.sellerSlug === sellerSlug),
    [...listings.values()].filter((row) => row.sellerSlug === sellerSlug),
  );
}
```

- [ ] **Step 3b: A Hub hide or Show again changes the listing, as on Supabase (plan decision 3).** First the test, in `lib/data/staff-shops.test.ts` (next to the existing Show again test at line 255):

```ts
  it("marks a listing changed when the Hub hides it and when it shows it again, as the database does (role views N2)", async () => {
    const hiddenAt = new Date("2026-10-15T08:00:00.000Z");
    await hideListing("l-001", "Not allowed.", hiddenAt);
    expect(sampleStore().listings.get("l-001")?.updatedAt).toBe(hiddenAt.toISOString());
    const shownAt = new Date("2026-10-16T08:00:00.000Z");
    await showListing("l-001", shownAt);
    expect(sampleStore().listings.get("l-001")?.updatedAt).toBe(shownAt.toISOString());
  });
```

Run `pnpm vitest run lib/data/staff-shops.test.ts`: FAIL. Then in `lib/data/staff-shops.ts`, in `hideListing` after `row.hiddenReason = reason;`:

```ts
  // A hide is a change to the listing, as hide_listing's updated_at = now() (role views N2 plan decision 3).
  row.updatedAt = now.toISOString();
```

and `showListing` takes the time:

```ts
export async function showListing(id: string, now: Date): Promise<ShownListing | null> {
  if (onSupabase()) return (await import("./supabase/staff-shops")).showListing(id, now);
  const row = sampleStore().listings.get(id);
  if (!row || !row.hiddenAt) return null;
  row.hiddenAt = null;
  row.hiddenReason = null;
  // Showing again is a change too, as show_listing's updated_at = now() (role views N2 plan decision 3).
  row.updatedAt = now.toISOString();
  const ownerId = sampleStore().sellers.get(row.sellerSlug)?.ownerId ?? null;
  return { id: row.id, title: row.title, state: row.state, ownerId };
}
```

The Supabase twin (`lib/data/supabase/staff-shops.ts:355`, `async (id) =>`) still fits `typeof Sample.showListing`; the database sets the time. Update the callers: `lib/staff/admin-actions.ts:728` becomes `decide(showListing(id, now), ADMIN_HIDDEN_PATH, now)` (`now` is already in scope there); `lib/data/staff-shops.test.ts:255, 262, 263` and `lib/data/contract/staff-shops.contract.ts:142, 148, 210, 234` pass `new Date()` as the second argument. `grep -rn "showListing(" lib app components` then lists no call with one argument.

Run: `pnpm vitest run lib/data/staff-shops.test.ts lib/staff lib/data/contract/staff-shops.test.ts && pnpm typecheck`. Expected: PASS.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/data/seller-queue.test.ts lib/data/boundaries.test.ts`
Expected: the queue tests PASS. `boundaries.test.ts` fails only if `lib/data/supabase/seller-queue.ts` is missing; Task 6 adds it, so run the boundaries test again there.

- [ ] **Step 5: Commit (controller)** with Task 6.

---

### Task 5: The SQL: `seller_queue` and `follower_counts`, with pgTAP

**Files:**
- Create: `supabase/migrations/20261025120000_role_views_seller.sql`, `supabase/tests/60_role_views_seller.test.sql`
- Modify: `supabase/tests/06_account_actions.test.sql` (the signed-in allowlist, around line 61)
- Modify: `lib/supabase/database.types.ts` (regenerated)

The newest migration is `20261024120000_campuscart_name.sql`, so this one is `20261025120000`. Check `ls supabase/migrations | tail -1` first; if a newer one has landed, take a later timestamp.

- [ ] **Step 1: Write the failing pgTAP test** `supabase/tests/60_role_views_seller.test.sql`:

```sql
-- Role views N2: the seller home's two reads (role views spec 6 and 7.1; N2 plan decisions 2, 3 and 10).
-- public.seller_queue: buyers waiting, sales to mark as sold, drafts, Hub-hidden and paused listings, the listings by
-- state and whether the shop ever replied, for the shop's owner only. public.follower_counts: how many follow, and how
-- many since a time, for the owner only, never who. lib/data/seller-queue.ts and lib/data/follows.ts are the sample's.
begin;
select plan(20);

create function pg_temp.a(n text) returns uuid language sql immutable as $f$
  select ('00000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.s(n text) returns uuid language sql immutable as $f$
  select ('10000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.c(n text) returns uuid language sql immutable as $f$
  select ('40000000-0000-4000-8000-0000000000' || n)::uuid;
$f$;
create function pg_temp.sign_in(n text) returns void language plpgsql as $f$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.a(n), 'role', 'authenticated', 'session_id', '50000000-0000-4000-8000-0000000000' || n)::text,
    true
  );
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

insert into public.campuses (slug, name, region, sort) values ('n2-campus', 'N2 campus', 'Gauteng', 94);
insert into public.categories (slug, name, sort) values ('n2-category', 'N2 category', 97);

-- 61 owns the shop under test; 62, 63 and 66 buy; 64 owns a new shop with nothing yet; 65 is an admin; 67 owns another.
insert into auth.users (id, email) values
  (pg_temp.a('61'), 'n2-61@eduvos.com'), (pg_temp.a('62'), 'n2-62@eduvos.com'), (pg_temp.a('63'), 'n2-63@eduvos.com'),
  (pg_temp.a('64'), 'n2-64@eduvos.com'), (pg_temp.a('65'), 'n2-65@eduvos.com'), (pg_temp.a('66'), 'n2-66@eduvos.com'),
  (pg_temp.a('67'), 'n2-67@eduvos.com');
insert into public.profiles (id, first_name, campus_slug, roles) values
  (pg_temp.a('61'), 'Owner', 'n2-campus', '{}'), (pg_temp.a('62'), 'Buyer', 'n2-campus', '{}'),
  (pg_temp.a('63'), 'Asker', 'n2-campus', '{}'), (pg_temp.a('64'), 'Fresh', 'n2-campus', '{}'),
  (pg_temp.a('65'), 'Admin', 'n2-campus', array['admin']), (pg_temp.a('66'), 'Third', 'n2-campus', '{}'),
  (pg_temp.a('67'), 'Other', 'n2-campus', '{}');
insert into public.shops (id, slug, owner_id, name, category_slug, campus_slug, since) values
  (pg_temp.s('61'), 'n2-shop', pg_temp.a('61'), 'N2 shop', 'n2-category', 'n2-campus', '2026-10'),
  (pg_temp.s('64'), 'n2-fresh', pg_temp.a('64'), 'N2 fresh', 'n2-category', 'n2-campus', '2026-10'),
  (pg_temp.s('67'), 'n2-other', pg_temp.a('67'), 'N2 other', 'n2-category', 'n2-campus', '2026-10');
insert into public.seller_profiles (account_id, status, shop_id, approved_at) values
  (pg_temp.a('61'), 'approved', pg_temp.s('61'), now()),
  (pg_temp.a('64'), 'approved', pg_temp.s('64'), now()),
  (pg_temp.a('67'), 'approved', pg_temp.s('67'), now());

insert into public.listings
  (id, shop_id, state, kind, title, category_slug, condition, price_zar, pay_mode, description, handover, campus_slug, first_published_at, updated_at, hidden_at, hidden_reason)
values
  ('q-avail', pg_temp.s('61'), 'available', 'item', 'Desk lamp', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', null, null),
  ('q-relist', pg_temp.s('61'), 'available', 'item', 'Kettle', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-20T08:00Z', null, null),
  ('q-service', pg_temp.s('61'), 'available', 'service', 'Maths tutoring', 'n2-category', null, 10, 'cash', 'x', 'online', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', null, null),
  ('q-draft', pg_temp.s('61'), 'draft', 'item', 'Bike', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', null, '2026-10-05T08:00Z', null, null),
  ('q-paused', pg_temp.s('61'), 'paused', 'item', 'Paused lamp', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-08T08:00Z', null, null),
  ('q-hidden', pg_temp.s('61'), 'available', 'item', 'Exam papers', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', '2026-10-17T08:00Z', 'Not allowed.'),
  ('q-sold', pg_temp.s('61'), 'sold', 'item', 'Radio', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-09T08:00Z', null, null),
  ('q-other', pg_temp.s('67'), 'available', 'item', 'Other lamp', 'n2-category', 'good', 10, 'cash', 'x', 'on-campus', 'n2-campus', '2026-10-01', '2026-10-10T08:00Z', null, null);

insert into public.conversations
  (id, listing_id, listing_title, shop_id, buyer_id, seller_gone, status, created_at, first_reply_at, completed_at, confirmed_at, confirmed_by, is_offer, request_title)
values
  -- Waiting: the oldest, a newer one, and a question to the shop.
  (pg_temp.c('61'), 'q-paused', 'Paused lamp', pg_temp.s('61'), pg_temp.a('62'), false, 'asked', '2026-10-17T08:00Z', null, null, null, null, false, null),
  (pg_temp.c('62'), 'q-sold', 'Radio', pg_temp.s('61'), pg_temp.a('62'), false, 'asked', '2026-10-18T08:00Z', null, null, null, null, false, null),
  (pg_temp.c('63'), null, null, pg_temp.s('61'), pg_temp.a('63'), false, 'asked', '2026-10-19T08:00Z', null, null, null, null, false, null),
  -- Not waiting: replied, an offer, a seller who has gone, a buyer who has gone.
  (pg_temp.c('64'), 'q-service', 'Maths tutoring', pg_temp.s('61'), pg_temp.a('63'), false, 'replied', '2026-10-16T08:00Z', '2026-10-16T09:00Z', null, null, null, false, null),
  (pg_temp.c('65'), null, null, pg_temp.s('61'), pg_temp.a('66'), false, 'offered', '2026-10-15T08:00Z', null, null, null, null, true, 'A lamp'),
  (pg_temp.c('66'), 'q-avail', 'Desk lamp', pg_temp.s('61'), pg_temp.a('63'), true, 'asked', '2026-10-10T08:00Z', null, null, null, null, false, null),
  (pg_temp.c('67'), 'q-relist', 'Kettle', pg_temp.s('61'), null, false, 'asked', '2026-10-09T08:00Z', null, null, null, null, false, null),
  -- Sales: two on the desk lamp count (the confirmed one is older); relisted, a service and a hidden listing don't.
  (pg_temp.c('68'), 'q-avail', 'Desk lamp', pg_temp.s('61'), pg_temp.a('62'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-15T08:00Z', null, null, false, null),
  (pg_temp.c('69'), 'q-avail', 'Desk lamp', pg_temp.s('61'), pg_temp.a('66'), false, 'confirmed', '2026-10-10T08:00Z', '2026-10-10T09:00Z', '2026-10-12T08:00Z', '2026-10-13T08:00Z', 'buyer', false, null),
  (pg_temp.c('6a'), 'q-relist', 'Kettle', pg_temp.s('61'), pg_temp.a('62'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-14T08:00Z', null, null, false, null),
  (pg_temp.c('6b'), 'q-service', 'Maths tutoring', pg_temp.s('61'), pg_temp.a('66'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-15T08:00Z', null, null, false, null),
  (pg_temp.c('6c'), 'q-hidden', 'Exam papers', pg_temp.s('61'), pg_temp.a('62'), false, 'done', '2026-10-11T08:00Z', '2026-10-11T09:00Z', '2026-10-16T08:00Z', null, null, false, null),
  -- Another shop's buyer waiting.
  (pg_temp.c('6d'), 'q-other', 'Other lamp', pg_temp.s('67'), pg_temp.a('62'), false, 'asked', '2026-10-01T08:00Z', null, null, null, null, false, null);

insert into public.follows (account_id, shop_id, created_at) values
  (pg_temp.a('62'), pg_temp.s('61'), '2026-10-10T08:00Z'),
  (pg_temp.a('63'), pg_temp.s('61'), '2026-10-21T08:00Z'),
  (pg_temp.a('66'), pg_temp.s('61'), '2026-10-22T08:00Z');

-- Nobody signed out reads either.
set local role anon;
select throws_ok($$select public.seller_queue('n2-shop')$$, '42501', null, 'anon reads no queue');
select throws_ok($$select * from public.follower_counts('10000000-0000-4000-8000-000000000061', now())$$, '42501', null, 'nor counts followers');
reset role;

select pg_temp.sign_in('61');
select is((public.seller_queue('n2-shop') -> 'replies' ->> 'count')::int, 3, 'three buyers wait: two enquiries and a question; not a reply, an offer, or anyone gone');
select is(
  public.seller_queue('n2-shop') -> 'replies' -> 'oldest' ->> 'id',
  pg_temp.c('61')::text,
  'the oldest wait is the one asked first'
);
select is(
  row(public.seller_queue('n2-shop') -> 'replies' -> 'oldest' ->> 'title', (public.seller_queue('n2-shop') -> 'replies' -> 'oldest' ->> 'at')::timestamptz)::text,
  row('Paused lamp', '2026-10-17T08:00Z'::timestamptz)::text,
  'with its listing''s title and when it was asked'
);
select is(
  array(select x ->> 'conversation_id' from jsonb_array_elements(public.seller_queue('n2-shop') -> 'sales') x),
  array[pg_temp.c('69')::text, pg_temp.c('68')::text],
  'sales to mark as sold, oldest first: not relisted since, not a service, not hidden'
);
select is(
  array(select distinct x ->> 'listing_id' from jsonb_array_elements(public.seller_queue('n2-shop') -> 'sales') x),
  array['q-avail'],
  'both on the one listing'
);
select is(
  row((public.seller_queue('n2-shop') -> 'drafts' ->> 'count')::int, public.seller_queue('n2-shop') -> 'drafts' -> 'oldest' ->> 'id')::text,
  row(1, 'q-draft')::text,
  'one draft'
);
select is(
  row(
    (public.seller_queue('n2-shop') -> 'hidden' ->> 'count')::int,
    public.seller_queue('n2-shop') -> 'hidden' -> 'oldest' ->> 'id',
    public.seller_queue('n2-shop') -> 'hidden' -> 'oldest' ->> 'state'
  )::text,
  row(1, 'q-hidden', 'available')::text,
  'one listing hidden by the Hub, with its state for the tab'
);
select is(
  row((public.seller_queue('n2-shop') -> 'paused' ->> 'count')::int, public.seller_queue('n2-shop') -> 'paused' -> 'oldest' ->> 'id')::text,
  row(1, 'q-paused')::text,
  'one paused listing'
);
select is(
  public.seller_queue('n2-shop') -> 'listings',
  '{"available": 4, "paused": 1, "sold": 1, "drafts": 1}'::jsonb,
  'the listings by state'
);
select is((public.seller_queue('n2-shop') ->> 'ever_replied')::boolean, true, 'the shop has replied');
select is(
  (select row(f.total, f.recent)::text from public.follower_counts(pg_temp.s('61'), '2026-10-20T00:00Z') f),
  row(3, 2)::text,
  'how many follow, and how many since the time given (countFollowers'' twin, never who)'
);
select is(public.seller_queue('n2-other'), null, 'nothing about another shop');
select is(public.seller_queue('no-such-shop'), null, 'nor about a link that is no shop');
select pg_temp.sign_out();

select pg_temp.sign_in('64');
select is(
  public.seller_queue('n2-fresh'),
  '{"replies": {"count": 0, "oldest": null}, "sales": [], "drafts": {"count": 0, "oldest": null}, "hidden": {"count": 0, "oldest": null}, "paused": {"count": 0, "oldest": null}, "listings": {"available": 0, "paused": 0, "sold": 0, "drafts": 0}, "ever_replied": false}'::jsonb,
  'a new shop''s queue is empty, never null'
);
select pg_temp.sign_out();

select pg_temp.sign_in('62');
select is(public.seller_queue('n2-shop'), null, 'a buyer reads nothing of the shop''s queue');
select is(
  (select row(f.total, f.recent)::text from public.follower_counts(pg_temp.s('61'), '2026-10-20T00:00Z') f),
  row(0, 0)::text,
  'nor how many follow it'
);
select pg_temp.sign_out();

select pg_temp.sign_in('65');
select is(public.seller_queue('n2-shop'), null, 'nor does an admin: the queue is its owner''s');
select pg_temp.sign_out();

-- The seller relists the desk lamp after both sales: nothing left to mark (plan decision 3).
update public.listings set updated_at = '2026-10-16T08:00Z' where id = 'q-avail';
select pg_temp.sign_in('61');
select is(public.seller_queue('n2-shop') -> 'sales', '[]'::jsonb, 'a listing changed since the sale isn''t asked about again');
select pg_temp.sign_out();

select * from finish();
rollback;
```

Count: 2 (anon) + 13 (owner) + 1 (fresh) + 2 (buyer) + 1 (admin) + 1 (relisted) = 20, so `plan(20)`. If pgTAP says "Looks like you planned N tests but ran M", count again by hand before changing the number.

Before running: check the column lists against the tables (`supabase/migrations/20261015004015_selling.sql:70` for listings; `20261015004333_messaging.sql:16` and `20261020120200_community_tables.sql:131` for conversations; `public.profiles` has `roles`). `request_title` must be set on an offer (`conversations_offers_keep_titles`); `request_id` may be null.

- [ ] **Step 2: Run it and watch it fail**

```bash
supabase db reset && supabase test db
```
Expected: `60_role_views_seller` FAILS (`function public.seller_queue(text) does not exist`). The other files pass.

- [ ] **Step 3: Write the migration** `supabase/migrations/20261025120000_role_views_seller.sql`:

```sql
-- Role views N2: the seller home's reads (role views spec 6 and 7.1; docs/superpowers/plans/2026-10-22-role-views-n2-seller.md,
-- plan decisions 2, 3 and 10). Both are read-only, security definer with an empty search path like every public
-- function (06_account_actions), and answer the shop's owner only (private.owns_shop): anyone else gets null or 0,
-- never an error, so they hint at nothing.

-- What needs the shop's owner now (sellerQueue, lib/data/seller-queue.ts; queueOver is the sample's): buyers waiting
-- for a first reply (asked, not an offer, buyer and seller both there), sales to mark as sold (done or confirmed, on an
-- available item the Hub hasn't hidden that hasn't changed since the sale was marked completed), drafts, Hub-hidden and
-- paused listings, each with its oldest; the listings by state; and whether the shop ever replied (not an offer).
-- It takes the shop's link and finds the shop itself, so the twin makes one call (plan review fix 6); the gate is still
-- private.owns_shop on the shop found. No shop by that link is null, as for anyone but the owner.
-- A user action (advisor 0029 lists it on purpose).
create function public.seller_queue(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    shop as (
      select s.id from public.shops s where s.slug = p_slug
    ),
    talks as (
      select c.id, c.listing_id, c.listing_title, c.status, c.is_offer, c.buyer_id, c.created_at, c.first_reply_at,
             c.completed_at, c.confirmed_at
      from public.conversations c
      where c.shop_id = (select id from shop) and not c.seller_gone
    ),
    own as (
      select l.id, l.title, l.state, l.kind, l.hidden_at, l.updated_at
      from public.listings l
      where l.shop_id = (select id from shop)
    ),
    waiting as (
      select t.id::text as id, t.listing_title as title, t.created_at as at
      from talks t
      where t.status = 'asked' and not t.is_offer and t.buyer_id is not null
    ),
    sales as (
      select t.id::text as conversation_id, o.id as listing_id, o.title, coalesce(t.completed_at, t.confirmed_at) as at
      from talks t
      join own o on o.id = t.listing_id
      where t.status in ('done', 'confirmed')
        and o.state = 'available' and o.kind = 'item' and o.hidden_at is null
        and coalesce(t.completed_at, t.confirmed_at) >= o.updated_at
    ),
    listed as (
      select 'drafts' as kind, o.id, o.title, o.updated_at as at, o.state from own o where o.state = 'draft'
      union all
      select 'hidden', o.id, o.title, o.hidden_at, o.state from own o where o.hidden_at is not null
      union all
      select 'paused', o.id, o.title, o.updated_at, o.state from own o where o.state = 'paused'
    )
  select case when exists (select 1 from shop) and (select private.owns_shop((select id from shop))) then jsonb_build_object(
    'replies', jsonb_build_object(
      'count', (select count(*) from waiting),
      'oldest', (
        select jsonb_build_object('id', w.id, 'title', w.title, 'at', w.at, 'state', null)
        from waiting w order by w.at, w.id limit 1
      )
    ),
    'sales', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('conversation_id', s.conversation_id, 'listing_id', s.listing_id, 'title', s.title, 'at', s.at)
          order by s.at, s.conversation_id
        )
        from sales s
      ),
      '[]'::jsonb
    ),
    'drafts', jsonb_build_object(
      'count', (select count(*) from listed x where x.kind = 'drafts'),
      'oldest', (
        select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at, 'state', x.state)
        from listed x where x.kind = 'drafts' order by x.at, x.id limit 1
      )
    ),
    'hidden', jsonb_build_object(
      'count', (select count(*) from listed x where x.kind = 'hidden'),
      'oldest', (
        select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at, 'state', x.state)
        from listed x where x.kind = 'hidden' order by x.at, x.id limit 1
      )
    ),
    'paused', jsonb_build_object(
      'count', (select count(*) from listed x where x.kind = 'paused'),
      'oldest', (
        select jsonb_build_object('id', x.id, 'title', x.title, 'at', x.at, 'state', x.state)
        from listed x where x.kind = 'paused' order by x.at, x.id limit 1
      )
    ),
    'listings', jsonb_build_object(
      'available', (select count(*) from own o where o.state = 'available'),
      'paused', (select count(*) from own o where o.state = 'paused'),
      'sold', (select count(*) from own o where o.state = 'sold'),
      'drafts', (select count(*) from own o where o.state = 'draft')
    ),
    'ever_replied', exists (select 1 from talks t where not t.is_offer and t.first_reply_at is not null)
  ) end;
$$;

-- How many follow the shop, and how many of those follows were made since p_since and still stand (followerCounts,
-- lib/data/follows.ts; the seller home's "+N new this week"). For its owner only: 0 and 0 for anyone else. Never who.
-- A user action (advisor 0029 lists it on purpose).
create function public.follower_counts(p_shop uuid, p_since timestamptz)
returns table (total int, recent int)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int, (count(*) filter (where f.created_at >= p_since))::int
  from public.follows f
  where f.shop_id = p_shop and (select private.owns_shop(p_shop));
$$;

revoke all on function public.seller_queue(text), public.follower_counts(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.seller_queue(text), public.follower_counts(uuid, timestamptz) to authenticated, service_role;
```

Both use indexes that exist: the shops' unique slug, `conversations_shop_id_idx`, `listings_shop_id_idx`, `follows_shop_id_idx`.

- [ ] **Step 4: The signed-in allowlist.** In `supabase/tests/06_account_actions.test.sql`, add the two signatures to the array in "the user actions, and nothing else, run for signed-in users", in the order Postgres sorts them: `'follower_counts(uuid,timestamp with time zone)',` right after `'follower_count(uuid)',`, and `'seller_queue(text)',` right after `'save_search(text,text,text,text,text,text,text)',`. If the test then reports the same two names in another order, use the order it prints (the database's collation decides).

- [ ] **Step 5: Run the database tests**

```bash
supabase db reset && supabase test db
```
Expected: every file passes, `60_role_views_seller` with 20 tests.

- [ ] **Step 6: Regenerate the types and typecheck**

```bash
pnpm db:types && pnpm typecheck
```
Expected: `lib/supabase/database.types.ts` gains `seller_queue` (returns `Json`) and `follower_counts` (returns `{ total: number; recent: number }[]`); the typecheck is clean, Task 3's twin included. `git diff --stat lib/supabase/database.types.ts` shows only these additions; if it shows unrelated churn (another session's migration), stop and ask the controller.

- [ ] **Step 7: Commit (controller)** (with Task 3)

```bash
git add supabase/migrations/20261025120000_role_views_seller.sql supabase/tests/60_role_views_seller.test.sql supabase/tests/06_account_actions.test.sql lib/supabase/database.types.ts lib/data/follows.ts lib/data/supabase/follows.ts lib/data/follows.test.ts tests/contract/world.ts tests/contract/sample-world.ts tests/db/supabase-world.ts
git commit -m "feat(db): seller_queue and follower_counts for the seller home, owner-only definer reads with pgTAP; followerCounts on both backends (role views N2 Tasks 3 and 5)"
```

---

### Task 6: The queue's Supabase twin and the contract

**Files:**
- Create: `lib/data/supabase/seller-queue.ts`
- Create: `lib/data/contract/seller-home.contract.ts`, `lib/data/contract/seller-home.test.ts`, `lib/data/contract/seller-home.db.test.ts`

- [ ] **Step 1: Write the contract** `lib/data/contract/seller-home.contract.ts`:

```ts
import { afterEach, beforeEach, expect, it } from "vitest";
import { followerCounts } from "@/lib/data/follows";
import { setOwnListingState } from "@/lib/data/own-listings";
import { sellerQueue } from "@/lib/data/seller-queue";
import { dailyEnquiries, recentCounts } from "@/lib/data/shop-stats";
import { hideListing, showListing } from "@/lib/data/staff-shops";
import type { World } from "@/tests/contract/world";

// The seller home's readers in both backends (role views spec 6; N2 plan decisions 1 to 3, 9 and 10): sellerQueue,
// recentCounts' window before, dailyEnquiries and followerCounts. seller-home.test.ts runs it on the sample store,
// seller-home.db.test.ts on the local stack. The queue and the follower counts are read as the shop's owner.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOTHING = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };

export function sellerHomeContract(makeWorld: () => World): void {
  let world: World;
  beforeEach(async () => {
    world = makeWorld();
    await world.tidyCommunity();
    await world.tidySelling("seller");
    await world.tidyMessaging();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  const queueOf = (slug: string) => world.asViewer("seller", () => sellerQueue(slug));

  it("a new shop's queue is empty: nothing waits, nothing to mark, never replied", async () => {
    const slug = await world.openShop("seller");
    expect(await queueOf(slug)).toEqual({
      replies: { count: 0, oldest: null },
      sales: [],
      drafts: { count: 0, oldest: null },
      hidden: { count: 0, oldest: null },
      paused: { count: 0, oldest: null },
      listings: { available: 0, paused: 0, sold: 0, drafts: 0 },
      everReplied: false,
    });
  });

  it("counts buyers waiting for a first reply, oldest first, leaving out replied ones and offers", async () => {
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract lamp" });
    const asked = new Date(Date.now() - 2 * HOUR);
    const oldest = await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [{ side: "buyer", body: "Is it still there?", sentAt: asked }],
    });
    await world.addConversation({
      buyer: "asker",
      slug,
      messages: [{ side: "buyer", body: "Do you deliver?", sentAt: new Date(Date.now() - HOUR) }],
    });
    await world.addConversation({
      buyer: "staff",
      slug,
      listingId: listing,
      messages: [
        { side: "buyer", body: "Still there?", sentAt: new Date(Date.now() - 3 * HOUR) },
        { side: "seller", body: "It is.", sentAt: new Date(Date.now() - 2.5 * HOUR) },
      ],
    });
    const request = await world.addRequest({ asker: "asker", title: "A contract kettle", neededBy: null });
    await world.addConversation({
      buyer: "asker",
      slug,
      offerOn: request,
      messages: [{ side: "seller", body: "I have one.", sentAt: new Date(Date.now() - 4 * HOUR) }],
    });
    const queue = await queueOf(slug);
    expect(queue.replies).toEqual({
      count: 2,
      oldest: { id: oldest, title: "Contract lamp", at: asked.toISOString(), state: null },
    });
    expect(queue.everReplied).toBe(true);
  });

  it("lists a sale to mark as sold until its listing is sold", async () => {
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract radio" });
    const conversation = await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [
        { side: "buyer", body: "Is it still there?", sentAt: new Date(Date.now() - 2 * HOUR) },
        { side: "seller", body: "It is.", sentAt: new Date(Date.now() - HOUR) },
      ],
    });
    // A little ahead, so the database's clock (the listing's updated_at) can't land after it on the local stack.
    await world.markDone(conversation, new Date(Date.now() + 5 * 60 * 1000));
    expect((await queueOf(slug)).sales.map((sale) => [sale.conversationId, sale.listingId, sale.title])).toEqual([
      [conversation, listing, "Contract radio"],
    ]);
    await world.asViewer("seller", () => setOwnListingState(slug, listing, "sold", new Date()));
    const after = await queueOf(slug);
    expect(after.sales).toEqual([]);
    expect(after.listings).toEqual({ available: 0, paused: 0, sold: 1, drafts: 0 });
  });

  it("stops asking once the Hub has hidden and shown the listing again: a Hub decision is a change (plan decision 3)", async () => {
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract heater" });
    const conversation = await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [
        { side: "buyer", body: "Is it still there?", sentAt: new Date(Date.now() - 2 * HOUR) },
        { side: "seller", body: "It is.", sentAt: new Date(Date.now() - HOUR) },
      ],
    });
    // Marked completed after the listing was made and before the Hub acts. On Supabase the listing's times are the
    // database's clock (the local stack's container shares the host's), so leave two seconds either side.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await world.markDone(conversation, new Date());
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect((await queueOf(slug)).sales.map((sale) => sale.conversationId)).toEqual([conversation]);
    // hide_listing needs an open report on Supabase; the sample's hideListing doesn't mind one.
    await world.addReport("asker", { kind: "listing", id: listing });
    await world.asViewer("staff", () => hideListing(listing, "Checking it.", new Date()));
    expect((await queueOf(slug)).sales).toEqual([]);
    await world.asViewer("staff", () => showListing(listing, new Date()));
    expect((await queueOf(slug)).sales).toEqual([]);
  });

  it("counts drafts, Hub-hidden and paused listings, each with its oldest", async () => {
    const slug = await world.openShop("seller");
    const draft = await world.addListing(slug, { title: "Contract draft" });
    const hidden = await world.addListing(slug, { title: "Contract hidden" });
    const paused = await world.addListing(slug, { title: "Contract paused" });
    await world.draftListing(draft);
    await world.hideListing(hidden, "Not allowed on CampusCart.");
    await world.asViewer("seller", () => setOwnListingState(slug, paused, "paused", new Date()));
    const queue = await queueOf(slug);
    expect([queue.drafts.count, queue.drafts.oldest?.id, queue.drafts.oldest?.state]).toEqual([1, draft, "draft"]);
    expect([queue.hidden.count, queue.hidden.oldest?.id, queue.hidden.oldest?.state]).toEqual([1, hidden, "available"]);
    expect([queue.paused.count, queue.paused.oldest?.id]).toEqual([1, paused]);
    expect(queue.listings).toEqual({ available: 1, paused: 1, sold: 0, drafts: 1 });
  });

  it("compares Tech corner's week with the week before, the seed's sale confirming itself on the 20th", async () => {
    // 21 October, noon in South Africa: the two enquiries (12 and 13 October) are the week before's; the sale marked
    // done on 13 October confirmed itself 7 days later, inside this week.
    const now = new Date("2026-10-21T10:00:00.000Z");
    expect(await recentCounts("tech-corner", 7, now)).toEqual({
      enquiries: 0,
      due: 0,
      repliedInTime: 0,
      salesConfirmed: 1,
      previous: { enquiries: 2, due: 2, repliedInTime: 2, salesConfirmed: 0 },
    });
    expect(await recentCounts("no-such-shop", 7, now)).toEqual({ ...NOTHING, previous: NOTHING });
  });

  it("gives Tech corner's enquiries by SAST day, and none before a shop existed", async () => {
    expect(await dailyEnquiries("tech-corner", 7, new Date("2026-10-14T10:00:00.000Z"))).toEqual([0, 0, 0, 0, 1, 1, 0]);
    const slug = await world.openShop("seller");
    const listing = await world.addListing(slug, { title: "Contract fan" });
    const now = new Date();
    await world.addConversation({
      buyer: "shopper",
      slug,
      listingId: listing,
      messages: [{ side: "buyer", body: "Still there?", sentAt: now }],
    });
    expect(await dailyEnquiries(slug, 3, new Date(now.getTime() + 1000))).toEqual([null, null, 1]);
  });

  it("counts the shop's followers and the ones from the last 7 days, never who", async () => {
    const slug = await world.openShop("seller");
    await world.follow("shopper", slug, new Date(Date.now() - 10 * DAY));
    await world.follow("asker", slug, new Date(Date.now() - 2 * DAY));
    expect(await world.asViewer("seller", () => followerCounts(slug, new Date(Date.now() - 7 * DAY)))).toEqual({
      total: 2,
      recent: 1,
    });
  });
}
```

The "by SAST day" scenario makes its conversation now, so it can fail if the run crosses midnight in South Africa between the two lines; that's a one-second window, accepted.

`lib/data/contract/seller-home.test.ts`:
```ts
import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { sellerHomeContract } from "./seller-home.contract";

describe("the seller home's readers on the sample store (role views N2)", () => {
  sellerHomeContract(sampleWorld);
});
```

`lib/data/contract/seller-home.db.test.ts` (the seed's sale is undone and redone as `stats.db.test.ts` does, lines 18–42, for the same reason: the hourly job may already have confirmed it):
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyEnquiries, recentCounts } from "@/lib/data/shop-stats";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { testAdminClient } from "@/tests/db/accounts";
import { parity } from "@/tests/db/parity";
import { type SupabaseWorld, supabaseWorld } from "@/tests/db/supabase-world";
import { sellerHomeContract } from "./seller-home.contract";

// The queue and the follower counts read as the shop's owner, through the viewer seam (stats.db.test.ts's pattern).
vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));

// The seed's one sale as the seed has it (stats.db.test.ts, lines 12 to 42): the hourly settle-sales job may have
// confirmed it already, so it's put back to done before each test and confirmed again after.
const admin = testAdminClient();
let confirmedByTheJob: { id: string; confirmed_at: string | null }[] = [];

beforeEach(async () => {
  const { data, error } = await admin.from("conversations").select("id, confirmed_at").eq("status", "confirmed").eq("confirmed_by", "auto");
  if (error) throw new Error(error.message);
  confirmedByTheJob = data;
  for (const { id } of data) {
    const undone = await admin.from("conversations").update({ status: "done", confirmed_at: null, confirmed_by: null }).eq("id", id);
    if (undone.error) throw new Error(undone.error.message);
  }
});

afterEach(async () => {
  for (const { id, confirmed_at } of confirmedByTheJob) {
    const redone = await admin.from("conversations").update({ status: "confirmed", confirmed_at, confirmed_by: "auto" }).eq("id", id);
    if (redone.error) throw new Error(redone.error.message);
  }
  confirmedByTheJob = [];
});

describe("the seller home's readers on the local stack (role views N2)", () => {
  sellerHomeContract(supabaseWorld);
});

describe("the seller home's readers give the sample store's answers on the seed (role views N2)", () => {
  let world: SupabaseWorld;
  const times = [new Date(), new Date("2026-10-14T10:00:00.000Z"), new Date("2026-10-21T10:00:00.000Z")];
  beforeEach(() => {
    world = supabaseWorld();
  });
  afterEach(async () => {
    await world.cleanup();
  });

  it("the week and the week before, and enquiries by day, for every shop that has talked to a buyer", async () => {
    resetSampleStore();
    const slugs = [...new Set([...sampleStore().conversations.values()].map((row) => row.sellerSlug)), "hair-studio"];
    for (const now of times) {
      for (const slug of slugs) {
        const recent = await parity(() => recentCounts(slug, 7, now));
        expect(recent.supabase, slug).toEqual(recent.sample);
        const daily = await parity(() => dailyEnquiries(slug, 14, now));
        expect(daily.supabase, slug).toEqual(daily.sample);
      }
    }
  });
});
```

The queue has no seed parity test: it reads as the shop's owner, and the seed shops' owners aren't the world's accounts. The contract (same scenarios, both backends) and pgTAP cover it. Check `parity`'s signature in `tests/db/parity.ts` before writing the parity test; `stats.db.test.ts` uses it the same way. The `world` in that `describe` is there for its cleanup, as in `stats.db.test.ts`; if the linter flags it as unused, drop it and its hooks.

- [ ] **Step 2: Run the sample contract and watch it fail**

Run: `pnpm vitest run lib/data/contract/seller-home.test.ts`
Expected: PASS for the sample store already (Tasks 2 to 4 built it). If anything fails, fix the sample reader, not the contract.

- [ ] **Step 3: Write the twin** `lib/data/supabase/seller-queue.ts`:

```ts
import "server-only";
import type * as Sample from "../seller-queue";
import type { ListingState, QueueRow, SellerQueue } from "@/lib/types";
import { forViewer } from "./clients";

// The seller's queue on Supabase (role views N2): one call to public.seller_queue(p_slug) with the signed-in owner's session.
// The function answers the shop's owner only and gives null to anyone else, which this twin turns into an error: the
// home then shows the card's error box, and the bar shows no badge (spec 8). Never cached across requests.

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

type RawOldest = { id: string; title: string | null; at: string; state: string | null } | null;
type RawRow = { count: number; oldest: RawOldest };
type Raw = {
  replies: RawRow;
  sales: { conversation_id: string; listing_id: string; title: string; at: string }[];
  drafts: RawRow;
  hidden: RawRow;
  paused: RawRow;
  listings: SellerQueue["listings"];
  ever_replied: boolean;
};

const iso = (at: string) => new Date(at).toISOString();

function rowFrom(raw: RawRow): QueueRow {
  return {
    count: raw.count,
    oldest: raw.oldest
      ? { id: raw.oldest.id, title: raw.oldest.title, at: iso(raw.oldest.at), state: raw.oldest.state as ListingState | null }
      : null,
  };
}

export const sellerQueue: typeof Sample.sellerQueue = async (sellerSlug) => {
  const client = await forViewer();
  // One call: the function finds the shop by its link and checks it is the signed-in account's (plan review fix 6).
  const { data, error } = await client.rpc("seller_queue", { p_slug: sellerSlug });
  if (error) failed("seller_queue", error);
  if (data === null) throw new Error("seller_queue answered nothing: not the signed-in account's shop");
  const raw = data as unknown as Raw;
  return {
    replies: rowFrom(raw.replies),
    sales: raw.sales.map((sale) => ({
      conversationId: sale.conversation_id,
      listingId: sale.listing_id,
      title: sale.title,
      at: iso(sale.at),
    })),
    drafts: rowFrom(raw.drafts),
    hidden: rowFrom(raw.hidden),
    paused: rowFrom(raw.paused),
    listings: raw.listings,
    everReplied: raw.ever_replied,
  };
};
```

- [ ] **Step 4: Run everything for the readers**

```bash
pnpm vitest run lib/data && pnpm typecheck && pnpm lint
```
Expected: PASS (the boundaries test included: the twin starts with `import "server-only";` and `lib/data/seller-queue.ts` reaches it only through `import()`).

```bash
supabase db reset && pnpm test:db lib/data/contract/seller-home.db.test.ts lib/data/contract/stats.db.test.ts lib/data/contract/mentors.db.test.ts lib/data/contract/follows.db.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/data/seller-queue.ts lib/data/seller-queue.test.ts lib/data/supabase/seller-queue.ts lib/data/contract/seller-home.contract.ts lib/data/contract/seller-home.test.ts lib/data/contract/seller-home.db.test.ts lib/data/staff-shops.ts lib/data/staff-shops.test.ts lib/staff/admin-actions.ts lib/data/contract/staff-shops.contract.ts
git commit -m "feat(data): sellerQueue on both backends with one contract (buyers waiting, sales to mark as sold, drafts, hidden, paused) (role views N2 Tasks 4 and 6)"
```

---

### Task 7: The home's pure helpers, the badge target and the queue once per request

**Files:**
- Create: `lib/selling/home.ts`, `lib/selling/home.test.ts`, `lib/selling/queue.ts`
- Modify: `lib/selling/badges.ts`, `lib/selling/badges.test.ts`

- [ ] **Step 1: Write the failing tests.** `lib/selling/home.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SellerQueue } from "@/lib/types";
import {
  dayLabels,
  enquirySummary,
  followerCountLabel,
  isNewShop,
  newFollowersLine,
  salesToMarkCount,
  sellerNeeds,
  setupSteps,
  waitChip,
} from "./home";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const EMPTY = { count: 0, oldest: null };
const QUEUE: SellerQueue = {
  replies: EMPTY,
  sales: [],
  drafts: EMPTY,
  hidden: EMPTY,
  paused: EMPTY,
  listings: { available: 0, paused: 0, sold: 0, drafts: 0 },
  everReplied: false,
};

describe("waitChip (role views spec 7.1, N2 plan decision 7)", () => {
  it("says hours, then days, and turns warning at 24 hours and danger at 48", () => {
    expect(waitChip(hoursAgo(0.5), NOW)).toEqual({ label: "<1h", tone: "info" });
    expect(waitChip(hoursAgo(23.9), NOW)).toEqual({ label: "23h", tone: "info" });
    expect(waitChip(hoursAgo(24), NOW)).toEqual({ label: "24h", tone: "warning" });
    expect(waitChip(hoursAgo(47.5), NOW)).toEqual({ label: "47h", tone: "warning" });
    expect(waitChip(hoursAgo(49), NOW)).toEqual({ label: "2d", tone: "danger" });
  });
});

describe("sellerNeeds", () => {
  it("gives the five rows in the spec's order, each linking to where the work is", () => {
    const rows = sellerNeeds(
      {
        ...QUEUE,
        replies: { count: 2, oldest: { id: "conv-1", title: null, at: hoursAgo(30), state: null } },
        sales: [
          { conversationId: "conv-9", listingId: "l-a", title: "Desk lamp", at: hoursAgo(80) },
          { conversationId: "conv-8", listingId: "l-a", title: "Desk lamp", at: hoursAgo(20) },
        ],
        drafts: { count: 1, oldest: { id: "l-d", title: "Bike", at: hoursAgo(90), state: "draft" } },
        hidden: { count: 1, oldest: { id: "l-h", title: "Exam papers", at: hoursAgo(5), state: "paused" } },
        paused: { count: 3, oldest: { id: "l-p", title: "Kettle", at: hoursAgo(200), state: "paused" } },
      },
      NOW,
    );
    expect(rows.map((row) => [row.key, row.count, row.title, row.href])).toEqual([
      ["replies", 2, "Buyers waiting for a reply", "/messages?tab=selling"],
      ["sales", 1, "Sale to mark as sold", "/messages/conv-9"],
      ["drafts", 1, "Draft ready to publish", "/sell/listings?tab=drafts"],
      ["hidden", 1, "Hidden by the Hub", "/sell/listings?tab=paused"],
      ["paused", 3, "Paused listings", "/sell/listings?tab=paused"],
    ]);
    expect(rows[0]).toMatchObject({ detail: "Oldest: a question for the shop", age: { label: "30h", tone: "warning" }, urgent: true });
    expect(rows[1]).toMatchObject({ detail: "Desk lamp" });
  });

  it("counts sales by listing, however many threads sold it", () => {
    expect(
      salesToMarkCount({
        ...QUEUE,
        sales: [
          { conversationId: "c1", listingId: "l-a", title: "A", at: hoursAgo(1) },
          { conversationId: "c2", listingId: "l-a", title: "A", at: hoursAgo(2) },
          { conversationId: "c3", listingId: "l-b", title: "B", at: hoursAgo(3) },
        ],
      }),
    ).toBe(2);
  });
});

describe("the setup checklist (role views spec 7.1, N2 plan decision 6)", () => {
  const shop = { image: null, about: "I bake.", pickupPointIds: ["pp-1"] };

  it("is shown until the shop has published and replied", () => {
    expect(isNewShop(QUEUE)).toBe(true);
    expect(isNewShop({ ...QUEUE, listings: { ...QUEUE.listings, sold: 1 } })).toBe(true);
    expect(isNewShop({ ...QUEUE, everReplied: true })).toBe(true);
    expect(isNewShop({ ...QUEUE, everReplied: true, listings: { ...QUEUE.listings, paused: 1 } })).toBe(false);
    // A draft isn't published.
    expect(isNewShop({ ...QUEUE, everReplied: true, listings: { ...QUEUE.listings, drafts: 3 } })).toBe(true);
  });

  it("completes each step from data, and leaves out pickup points where the campus has none", () => {
    expect(setupSteps(shop, QUEUE, true).map((step) => [step.label, step.done, step.href])).toEqual([
      ["Add a photo of your shop", false, "/sell/profile"],
      ["Say what you sell", true, "/sell/profile"],
      ["Choose a pickup point", true, "/sell/profile"],
      ["Publish your first listing", false, "/sell/listings/new"],
      ["Reply to your first buyer", false, "/messages?tab=selling"],
    ]);
    expect(setupSteps(shop, QUEUE, false).map((step) => step.label)).not.toContain("Choose a pickup point");
  });
});

describe("the home's words", () => {
  it("says how many follow, and how many are new, as numbers only", () => {
    expect([0, 1, 38].map(followerCountLabel)).toEqual(["No followers yet", "1 follower", "38 followers"]);
    expect([0, 3].map(newFollowersLine)).toEqual(["None new this week", "+3 new this week"]);
  });

  it("labels the days by SAST date and sums the week", () => {
    expect(dayLabels(3, NOW)).toEqual(["12 Oct", "13 Oct", "14 Oct"]);
    expect(enquirySummary([0, 0, 0, 0, 1, 1, 0])).toBe("2 enquiries in the last 7 days, none today.");
    expect(enquirySummary([null, null, 0, 0, 0, 0, 1])).toBe("1 enquiry in the last 7 days, 1 today.");
    expect(enquirySummary([0, 0, 0])).toBe("No enquiries in the last 3 days yet.");
  });
});
```

Check `dayMonth` (`lib/format.ts:106`) writes "12 Oct"; if it writes another form, use what it writes in the expectation.

Add to `lib/selling/badges.test.ts` (import `replyRateTarget`):

```ts
describe("replyRateTarget (role views N2: the badge bar's target tick)", () => {
  it("is Responsive's rate until the shop has it, then Trusted's", () => {
    expect(replyRateTarget(null)).toBe(0.8);
    expect(replyRateTarget("new-seller")).toBe(0.8);
    expect(replyRateTarget("responsive")).toBe(0.85);
    expect(replyRateTarget("trusted")).toBe(0.85);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/selling/home.test.ts lib/selling/badges.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** `lib/selling/home.ts`:

```ts
import type { SellerRow } from "@/lib/data/rows";
import { dayMonth } from "@/lib/format";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { lastSastDays } from "@/lib/time";
import type { SellerQueue } from "@/lib/types";
import { myListingsPath, NEW_LISTING_PATH, PROFILE_PATH, tabFor } from "./paths";

// The seller home's rows and words (role views spec 7.1; N2 plan decisions 2, 3 and 5 to 7), from the readers'
// answers. Pure: `now` comes from the caller, read after connection(). The words are samples for Lama to change.

const HOUR_MS = 60 * 60 * 1000;

/** A Needs-you row, as NeedsYouList (components/kit/NeedsYouList.tsx, N1) takes it. */
export type SellerNeed = {
  key: string;
  count: number;
  title: string;
  detail?: string;
  age?: { label: string; tone: "info" | "warning" | "danger" };
  href: string;
  urgent?: boolean;
};

/** How long the oldest buyer has waited (plan decision 7): warning from 24 hours, danger once 48 have passed. */
export function waitChip(at: string, now: Date): NonNullable<SellerNeed["age"]> {
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / HOUR_MS));
  const label = hours < 1 ? "<1h" : hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
  return { label, tone: hours >= 48 ? "danger" : hours >= 24 ? "warning" : "info" };
}

/** How many listings wait to be marked sold (plan decision 3): one per listing, however many threads sold it. */
export function salesToMarkCount(queue: SellerQueue): number {
  return new Set(queue.sales.map((sale) => sale.listingId)).size;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The home's Needs-you rows in the spec's order (7.1, item 2). NeedsYouList hides the ones at 0. */
export function sellerNeeds(queue: SellerQueue, now: Date): SellerNeed[] {
  const { replies, drafts, hidden, paused } = queue;
  const sales = salesToMarkCount(queue);
  const firstSale = queue.sales[0] ?? null;
  return [
    {
      key: "replies",
      count: replies.count,
      title: plural(replies.count, "Buyer waiting for a reply", "Buyers waiting for a reply"),
      detail: replies.oldest ? `Oldest: ${replies.oldest.title ?? "a question for the shop"}` : undefined,
      age: replies.oldest ? waitChip(replies.oldest.at, now) : undefined,
      href: inboxPath("selling"),
      urgent: true,
    },
    {
      key: "sales",
      count: sales,
      title: plural(sales, "Sale to mark as sold", "Sales to mark as sold"),
      detail: firstSale?.title,
      href: firstSale ? threadPath(firstSale.conversationId) : inboxPath("selling"),
    },
    {
      key: "drafts",
      count: drafts.count,
      title: plural(drafts.count, "Draft ready to publish", "Drafts ready to publish"),
      detail: drafts.oldest?.title ?? undefined,
      href: myListingsPath("drafts"),
    },
    {
      key: "hidden",
      count: hidden.count,
      title: "Hidden by the Hub",
      detail: hidden.oldest?.title ?? undefined,
      // My listings has no Hidden tab: the oldest hidden listing's own state's tab (plan decision 5).
      href: myListingsPath(hidden.oldest?.state ? tabFor(hidden.oldest.state) : "available"),
    },
    {
      key: "paused",
      count: paused.count,
      title: plural(paused.count, "Paused listing", "Paused listings"),
      detail: "Buyers can't see them",
      href: myListingsPath("paused"),
    },
  ];
}

/** The setup checklist shows while the shop has no published listing or has never replied (spec 7.1, New shop). */
export function isNewShop(queue: SellerQueue): boolean {
  const published = queue.listings.available + queue.listings.paused + queue.listings.sold;
  return published === 0 || !queue.everReplied;
}

/** The checklist's steps (plan decision 6), each done from data; nothing is stored. */
export function setupSteps(
  shop: Pick<SellerRow, "image" | "about" | "pickupPointIds">,
  queue: SellerQueue,
  campusHasPoints: boolean,
): { label: string; done: boolean; href: string }[] {
  const published = queue.listings.available + queue.listings.paused + queue.listings.sold;
  return [
    { label: "Add a photo of your shop", done: shop.image !== null, href: PROFILE_PATH },
    { label: "Say what you sell", done: shop.about.trim() !== "", href: PROFILE_PATH },
    ...(campusHasPoints
      ? [{ label: "Choose a pickup point", done: shop.pickupPointIds.length > 0, href: PROFILE_PATH }]
      : []),
    { label: "Publish your first listing", done: published > 0, href: NEW_LISTING_PATH },
    { label: "Reply to your first buyer", done: queue.everReplied, href: inboxPath("selling") },
  ];
}

/** The header's followers: a number only (spec 7.1, item 1). Never who. */
export function followerCountLabel(total: number): string {
  if (total === 0) return "No followers yet";
  return `${total} ${plural(total, "follower", "followers")}`;
}

/** Under the Followers tile: follows made in the last 7 days that still stand (spec 7.1, item 4). */
export function newFollowersLine(recent: number): string {
  return recent === 0 ? "None new this week" : `+${recent} new this week`;
}

/** "12 Oct" for each of the last `days` SAST days, oldest first: the chart's numbers table. */
export function dayLabels(days: number, now: Date): string[] {
  return lastSastDays(days, now).map(dayMonth);
}

/** The chart's takeaway (spec 5.3): the window's total and today's, in words. */
export function enquirySummary(points: readonly (number | null)[]): string {
  const total = points.reduce<number>((sum, point) => sum + (point ?? 0), 0);
  if (total === 0) return `No enquiries in the last ${points.length} days yet.`;
  const today = points.at(-1) ?? 0;
  return `${total} ${plural(total, "enquiry", "enquiries")} in the last ${points.length} days, ${today === 0 ? "none" : today} today.`;
}
```

`lib/selling/queue.ts`:

```ts
import { cache } from "react";
import { sellerQueue } from "@/lib/data/seller-queue";

/**
 * The shop's queue once per request (role views N2): the seller bar's Messages badge, the home's Needs you and a
 * thread's "Mark {title} as sold" read the same answer, so the badge always equals the row (spec 4.2). Request-time
 * only, inside <Suspense>; never "use cache": it is the owner's own state. Pass the signed-in account's own shop.
 */
export const queueFor = cache((sellerSlug: string) => sellerQueue(sellerSlug));
```

In `lib/selling/badges.ts`, after `replyRate`:

```ts
/**
 * The reply rate the badge bar's target tick marks (role views spec 7.1, item 6): Responsive's until the shop has it,
 * then Trusted's, which Trusted keeps.
 */
export function replyRateTarget(current: TrustBadge | null): number {
  return current === "responsive" || current === "trusted" ? RULES.trusted.rate : RULES.responsive.rate;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/selling && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/selling/home.ts lib/selling/home.test.ts lib/selling/queue.ts lib/selling/badges.ts lib/selling/badges.test.ts
git commit -m "feat(selling): the seller home's rows, age chips, checklist steps and words; the queue once per request (role views N2 Task 7)"
```

---

### Task 8: `ListRow` takes a name and actions; segments take a count

**Files:**
- Modify: `components/kit/ListRow.tsx`, `components/kit/ListRow.test.tsx` (N1 Task 7)
- Modify: `components/ui/LinkTabs.tsx`, `components/ui/LinkTabs.test.tsx`

- [ ] **Step 1: Write the failing tests.** Add to `components/kit/ListRow.test.tsx` (add `within` to the Testing Library import):

```tsx
  it("takes a name of its own, keeps the detail as its description, and puts actions beside the link", () => {
    render(
      <ul>
        <ListRow
          href="/sell/listings/l-a/edit"
          label="Edit Desk fan"
          lead={{ kind: "icon", icon: <span /> }}
          title="Desk fan"
          detail="R150 · Updated 13 Oct"
          actions={<button type="submit">Pause Desk fan</button>}
        />
      </ul>,
    );
    const link = screen.getByRole("link", { name: "Edit Desk fan" });
    expect(link).toHaveAccessibleDescription("R150 · Updated 13 Oct");
    const button = within(screen.getByRole("listitem")).getByRole("button", { name: "Pause Desk fan" });
    expect(link).not.toContainElement(button);
  });
```

Add to `components/ui/LinkTabs.test.tsx`:

```tsx
  it("writes a segment's count under its label, in its name", () => {
    render(
      <LinkTabs
        label="Listings by state"
        look="segmented"
        current="available"
        tabs={[
          { key: "available", label: "Available", count: 8, href: "/sell/listings" },
          { key: "paused", label: "Paused", count: 0, href: "/sell/listings?tab=paused" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Available 8" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("0")).toHaveClass("link-segment-count");
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/kit/ListRow.test.tsx components/ui/LinkTabs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** `components/kit/ListRow.tsx` becomes:

```tsx
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";

type Lead =
  | { kind: "initials"; text: string }
  | { kind: "icon"; icon: ReactNode }
  | { kind: "thumb"; node: ReactNode };

type ListRowProps = {
  href: string;
  lead: Lead;
  title: string;
  detail?: string;
  pill?: ReactNode;
  meta?: string;
  /** The link's own name ("Edit Desk fan"); the detail is then its description (role views N2 plan decision 12). */
  label?: string;
  /** Forms and links beside the row, outside its link (My listings' Pause, Mark sold, Delete). */
  actions?: ReactNode;
};

/** "Tech corner" → "TC"; one word → its first two letters. */
export function initialsOf(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** A row in a list (role views spec 5.2): one link, at least 56px tall, that goes deeper. Render it inside a <ul>. */
export function ListRow({ href, lead, title, detail, pill, meta, label, actions }: ListRowProps) {
  const detailId = useId();
  return (
    <li className={actions ? "list-row-item" : undefined}>
      <Link
        href={href}
        prefetch={false}
        transitionTypes={["nav-forward"]}
        className="list-row"
        aria-label={label}
        aria-describedby={label && detail ? detailId : undefined}
      >
        <span className="list-row-lead" aria-hidden="true">
          {lead.kind === "initials" ? initialsOf(lead.text) : lead.kind === "icon" ? lead.icon : lead.node}
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{title}</span>{" "}
          {detail && (
            <span id={detailId} className="list-row-detail">
              {detail}
            </span>
          )}
        </span>
        {pill}
        {meta && <span className="list-row-meta">{meta}</span>}
        <ChevronRightIcon className="needs-chevron" />
      </Link>
      {actions && <div className="list-row-actions">{actions}</div>}
    </li>
  );
}
```

In `components/ui/LinkTabs.tsx`, the type becomes:

```tsx
/** `count`: drawn under the label in the segmented look (role views N2 plan decision 12). */
export type LinkTab = { key: string; label: string; href: string; count?: number };
```

and the link's content:

```tsx
              {tab.count === undefined ? (
                tab.label
              ) : (
                <>
                  <span className="link-segment-label">{tab.label}</span>{" "}
                  <span className="link-segment-count">{tab.count}</span>
                </>
              )}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/kit components/ui`
Expected: PASS; N1's `ListRow` and `LinkTabs` tests unchanged.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/kit/ListRow.tsx components/kit/ListRow.test.tsx components/ui/LinkTabs.tsx components/ui/LinkTabs.test.tsx
git commit -m "feat(kit): ListRow takes a name and actions beside its link; segments show a count (role views N2 Task 8)"
```

---

### Task 9: The seller home

**Files:**
- Modify (full rewrite): `components/sell/Dashboard.tsx`, `components/sell/Dashboard.test.tsx`
- Modify: `components/sell/SellHome.tsx`, `components/sell/SellHome.test.tsx`, `components/sell/SellSkeleton.tsx`
- Modify: `app/globals.css` (the N2 block; the skeleton heights at lines 8177–8187; dead rules)

- [ ] **Step 1: Write the failing view tests.** Replace `components/sell/Dashboard.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SellerQueue } from "@/lib/types";
import { prefetchingLinks } from "@/tests/helpers/next-link";
import { Dashboard } from "./Dashboard";

// The form only needs something to post to; the actions have their own tests.
vi.mock("@/lib/selling/shop-actions", () => ({ pauseShop: async () => {}, resumeShop: async () => {} }));
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const NOW = new Date("2026-10-14T10:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const none = { enquiries: 0, due: 0, repliedInTime: 0, salesConfirmed: 0 };
const EMPTY = { count: 0, oldest: null };
const QUIET: SellerQueue = {
  replies: EMPTY,
  sales: [],
  drafts: EMPTY,
  hidden: EMPTY,
  paused: EMPTY,
  listings: { available: 2, paused: 0, sold: 1, drafts: 0 },
  everReplied: true,
};

type Props = Parameters<typeof Dashboard>[0];
const BASE: Props = {
  shop: {
    name: "Tech corner",
    slug: "tech-corner",
    badge: "responsive",
    image: null,
    about: "Calculators and cables.",
    pickupPointIds: ["pp-midrand-library"],
  },
  paused: false,
  notice: null,
  now: NOW,
  queue: QUIET,
  record: { enquiries: 4, due: 4, repliedInTime: 3, salesConfirmed: 2 },
  badgeLine: "3 more confirmed sales for Trusted.",
  week: { enquiries: 5, due: 4, repliedInTime: 4, salesConfirmed: 1, previous: { ...none, enquiries: 2, salesConfirmed: 1 } },
  daily: [0, 1, 0, 2, 0, 1, 1],
  followers: { total: 38, recent: 3 },
  campusHasPoints: true,
};
const show = (extra: Partial<Props> = {}) => render(<Dashboard {...BASE} {...extra} />);
const cardTitles = () => screen.getAllByRole("region").map((region) => region.querySelector("h2")?.textContent);

describe("the seller home (role views spec 7.1)", () => {
  it("follows the spec's order: header, Needs you, the two buttons, numbers, chart, badge, listings, pause", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(cardTitles()).toEqual(["Needs you", "In the last 7 days", "Enquiries, last 7 days", "Your badge", "Your listings"]);
    expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages?tab=selling");
    expect(screen.getByRole("button", { name: "Pause my shop" })).toHaveAttribute("type", "submit");
  });

  it("says in the header that the shop is live, its badge and how many follow it, a number only", () => {
    show();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Live")).toHaveAttribute("data-tone", "live");
    expect(within(header).getByText("Responsive")).toBeInTheDocument();
    expect(within(header).getByText("38 followers")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "View your shop" })).toHaveAttribute("href", "/sellers/tech-corner");
  });

  it("says All clear when nothing waits", () => {
    show();
    expect(screen.getByText("All clear: nothing is waiting for you.")).toBeInTheDocument();
  });

  it("lists buyers waiting, oldest first, with the wait turning warning at 24 hours", () => {
    show({ queue: { ...QUIET, replies: { count: 2, oldest: { id: "conv-1", title: "Desk lamp", at: hoursAgo(25), state: null } } } });
    const row = within(screen.getByRole("list", { name: "Needs you" })).getByRole("link");
    expect(row).toHaveAttribute("href", "/messages?tab=selling");
    expect(row).toHaveAccessibleName(/2\s*Buyers waiting for a reply\s*Oldest: Desk lamp\s*25h/);
    expect(screen.getByText("25h")).toHaveAttribute("data-tone", "warning");
  });

  it("links a sale to mark as sold to its thread", () => {
    show({ queue: { ...QUIET, sales: [{ conversationId: "conv-s2", listingId: "l-001", title: "Calculator", at: hoursAgo(20) }] } });
    expect(screen.getByRole("link", { name: /1\s*Sale to mark as sold\s*Calculator/ })).toHaveAttribute("href", "/messages/conv-s2");
  });

  it("compares the week with the week before, and says how many follows are new", () => {
    show();
    const tiles = within(screen.getByRole("list", { name: "In the last 7 days" })).getAllByRole("listitem");
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      expect.stringMatching(/^Enquiries\s*5\s*↑ 3 on the week before$/),
      expect.stringMatching(/^Sales\s*1\s*Same as the week before$/),
      expect.stringMatching(/^Followers\s*38\s*\+3 new this week$/),
    ]);
  });

  it("writes a quiet week's enquiries as words, and a busier one as a line with its numbers", () => {
    const quiet = show();
    expect(screen.getByText("5 enquiries in the last 7 days, 1 today.")).toBeInTheDocument();
    expect(quiet.container.querySelector(".sparkline svg")).toBeNull();
    quiet.unmount();
    show({ daily: [0, 4, 1, 6, 2, 5, 3] });
    expect(screen.getByRole("img", { name: "21 enquiries in the last 7 days, 3 today." })).toBeInTheDocument();
  });

  it("shows the reply rate against the next badge's target, and what the badge needs", () => {
    show();
    const meter = screen.getByRole("meter", { name: "Enquiries answered within 48 hours, last 90 days" });
    expect(meter).toHaveAttribute("aria-valuetext", "3 of 4");
    expect(screen.getByText("3 more confirmed sales for Trusted.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How badges work" })).toHaveAttribute("href", "/trust");
  });

  it("splits the listings by state, with a link to manage them", () => {
    show();
    expect(screen.getByRole("img", { name: "Your listings: 2 available, 0 paused, 1 sold, 0 drafts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage listings" })).toHaveAttribute("href", "/sell/listings");
  });

  it("shows a new shop its checklist in place of the numbers, chart and badge", () => {
    show({ queue: { ...QUIET, everReplied: false } });
    expect(cardTitles()).toEqual(["Needs you", "Get your shop going", "Your listings"]);
    expect(screen.getByText("3 of 5 done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a photo of your shop" })).toHaveClass("btn-primary");
  });

  it("shows a paused shop as paused, with Resume", () => {
    show({ paused: true });
    expect(within(screen.getByRole("banner")).getByText("Paused")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByText("Buyers can't see your listings until you resume your shop.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume my shop" })).toBeInTheDocument();
  });

  it("shows a shop the Hub paused with its reason, no Resume and no storefront link (staff tools plan decision 3)", () => {
    show({ paused: true, hubPause: "Selling exam answers." });
    expect(within(screen.getByRole("banner")).getByText("Paused by the Hub")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("region", { name: "Why the Hub paused it" })).toHaveTextContent("Selling exam answers.");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: "View your shop" })).toBeNull();
  });

  it("shows a card's error box when its reader failed, and keeps the others (spec 8)", () => {
    show({ queue: null, week: null });
    expect(screen.getByText("What needs you didn't load.")).toBeInTheDocument();
    expect(screen.getByText("Your numbers didn't load.")).toBeInTheDocument();
    expect(screen.getByText("Your listings didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toBeInTheDocument();
  });

  it("shows the last action's notice as a status line", () => {
    show({ notice: "Your shop is live again." });
    expect(screen.getByRole("status")).toHaveTextContent("Your shop is live again.");
  });

  it("never prefetches (the header prefetches /sell on every page; CLAUDE.md)", () => {
    const { container } = show({ queue: { ...QUIET, everReplied: false } });
    expect(container.querySelectorAll("a[data-prefetch]").length).toBeGreaterThan(0);
    expect(prefetchingLinks(container)).toEqual([]);
  });
});
```

`StatDelta`'s arrow is an icon plus an sr-only "↑" (N1 Task 4), so a tile's text reads "↑ 3 on the week before". `SectionError` (`components/home/SectionError.tsx`) writes "{title} didn't load."

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/sell/Dashboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the view.** Replace `components/sell/Dashboard.tsx` with:

```tsx
import Link from "next/link";
import { RatioBar } from "@/components/charts/RatioBar";
import { Sparkline } from "@/components/charts/Sparkline";
import { SplitBar } from "@/components/charts/SplitBar";
import { SectionError } from "@/components/home/SectionError";
import { Card } from "@/components/kit/Card";
import { NeedsYouList } from "@/components/kit/NeedsYouList";
import { Pill } from "@/components/kit/Pill";
import { SetupChecklist } from "@/components/kit/SetupChecklist";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import type { SellerRow } from "@/lib/data/rows";
import { badgeLabel } from "@/lib/format";
import { inboxPath } from "@/lib/messaging/paths";
import { replyRateTarget } from "@/lib/selling/badges";
import {
  dayLabels,
  enquirySummary,
  followerCountLabel,
  isNewShop,
  newFollowersLine,
  sellerNeeds,
  setupSteps,
} from "@/lib/selling/home";
import { myListingsPath, NEW_LISTING_PATH, SELL_PATH } from "@/lib/selling/paths";
import { pauseShop, resumeShop } from "@/lib/selling/shop-actions";
import type { EnquiryCounts, FollowerCounts, RecentCounts, SellerQueue } from "@/lib/types";

type DashboardProps = {
  shop: Pick<SellerRow, "name" | "slug" | "badge" | "image" | "about" | "pickupPointIds">;
  paused: boolean;
  /** The Hub's reason when the Hub paused the shop (staff tools plan decision 3); the seller can't resume it. */
  hubPause?: string | null;
  /** The words for the last action's notice, if any. */
  notice: string | null;
  /** Read after `await connection()`, for the age chips. */
  now: Date;
  /** Each reader's answer, or null when it failed: that card shows its error box (spec 8). */
  queue: SellerQueue | null;
  /** The badge rules' record (shopStats's `record`). */
  record: EnquiryCounts | null;
  /** What the next badge needs (lib/selling/badges.ts). */
  badgeLine: string;
  week: RecentCounts | null;
  /** Enquiries per SAST day, the last 7, oldest first. */
  daily: readonly (number | null)[] | null;
  followers: FollowerCounts | null;
  /** The shop's campus has pickup points to choose (the checklist's third step). */
  campusHasPoints: boolean;
};

const PERIOD = "the week before";

/**
 * The seller home (role views spec 7.1): what needs the seller now, then a few honest numbers and small charts, or the
 * setup checklist for a new shop. No view counts: nothing records views. Followers are a number, never who. A shop the
 * Hub paused says so, with the Hub's reason and no Pause or Resume (staff tools plan decision 3). Each card stands on
 * its own reader: one failing shows its error box and leaves the rest (spec 8).
 */
export function Dashboard(props: DashboardProps) {
  const { shop, paused, hubPause = null, notice, now, queue, record, badgeLine, week, daily, followers, campusHasPoints } =
    props;
  const byHub = hubPause !== null;
  const newShop = queue !== null && isNewShop(queue);
  return (
    <div className="sell-column sell-home">
      <Card>
        <header className="sell-home-head">
          <p className="eyebrow">Your shop</p>
          <h1 className="sell-title">{shop.name}</h1>
          <ul className="sell-home-facts">
            <li>
              {byHub ? (
                <Pill tone="danger">Paused by the Hub</Pill>
              ) : paused ? (
                <Pill tone="warning">Paused</Pill>
              ) : (
                <Pill tone="live">Live</Pill>
              )}
            </li>
            <li>
              <Pill tone="neutral">{shop.badge ? badgeLabel(shop.badge) : "No badge yet"}</Pill>
            </li>
            {followers && <li className="sell-home-followers">{followerCountLabel(followers.total)}</li>}
          </ul>
          {paused && (
            <p className="sell-home-note">
              {byHub
                ? "Buyers can't see your listings. Only the Hub can resume your shop."
                : "Buyers can't see your listings until you resume your shop."}
            </p>
          )}
          {/* A shop the Hub paused has no storefront while it's paused: its page answers 404 (amendment 13.2). */}
          {!byHub && (
            <Link href={`/sellers/${shop.slug}`} prefetch={false} className="sell-home-link">
              View your shop
            </Link>
          )}
        </header>
      </Card>

      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}

      {byHub && (
        <Card title="Why the Hub paused it">
          <blockquote className="staff-reason">{hubPause}</blockquote>
          <p>Only the Hub can resume it. Talk to the Hub on your campus once you&apos;ve sorted it out.</p>
        </Card>
      )}

      <Card title="Needs you">
        {queue ? (
          <NeedsYouList label="Needs you" items={sellerNeeds(queue, now)} allClear="All clear: nothing is waiting for you." />
        ) : (
          <SectionError id="sell-needs" title="What needs you" path={SELL_PATH} />
        )}
      </Card>

      <div className="sell-home-buttons">
        <Link href={NEW_LISTING_PATH} prefetch={false} className="btn btn-primary">
          New listing
        </Link>
        <Link href={inboxPath("selling")} prefetch={false} className="btn btn-outline text-navy">
          Messages
        </Link>
      </div>

      {newShop ? (
        <SetupChecklist title="Get your shop going" steps={setupSteps(shop, queue, campusHasPoints)} />
      ) : (
        <>
          <Card title="In the last 7 days">
            {week ? (
              <StatRow label="In the last 7 days">
                {[
                  <StatTile
                    key="enquiries"
                    label="Enquiries"
                    value={week.enquiries}
                    delta={{ previous: week.previous.enquiries, period: PERIOD }}
                  />,
                  <StatTile
                    key="sales"
                    label="Sales"
                    value={week.salesConfirmed}
                    delta={{ previous: week.previous.salesConfirmed, period: PERIOD }}
                  />,
                  ...(followers
                    ? [
                        <StatTile
                          key="followers"
                          label="Followers"
                          value={followers.total}
                          footer={<p className="stat-tile-note">{newFollowersLine(followers.recent)}</p>}
                        />,
                      ]
                    : []),
                ]}
              </StatRow>
            ) : (
              <SectionError id="sell-week" title="Your numbers" path={SELL_PATH} />
            )}
          </Card>

          <Card title="Enquiries, last 7 days">
            {daily ? (
              <Sparkline
                points={daily}
                labels={dayLabels(daily.length, now)}
                label="Enquiries"
                summary={enquirySummary(daily)}
              />
            ) : (
              <SectionError id="sell-daily" title="Your enquiries by day" path={SELL_PATH} />
            )}
          </Card>

          <Card title="Your badge" action={{ label: "How badges work", href: "/trust" }}>
            <p className="sell-badge">{shop.badge ? badgeLabel(shop.badge) : "No badge yet"}</p>
            {record ? (
              <RatioBar
                done={record.repliedInTime}
                total={record.due}
                target={replyRateTarget(shop.badge)}
                label="Enquiries answered within 48 hours, last 90 days"
              />
            ) : (
              <SectionError id="sell-badge" title="Your reply rate" path={SELL_PATH} />
            )}
            <p>{badgeLine}</p>
          </Card>
        </>
      )}

      <Card title="Your listings" action={{ label: "Manage listings", href: myListingsPath() }}>
        {queue ? (
          <SplitBar
            label="Your listings"
            parts={[
              { label: "available", value: queue.listings.available, tone: "navy" },
              { label: "paused", value: queue.listings.paused, tone: "sky-dark" },
              { label: "sold", value: queue.listings.sold, tone: "muted" },
              { label: "drafts", value: queue.listings.drafts, tone: "idle" },
            ]}
          />
        ) : (
          <SectionError id="sell-listings" title="Your listings" path={SELL_PATH} />
        )}
      </Card>

      {!byHub && (
        <form action={paused ? resumeShop : pauseShop} className="sell-pause">
          <p>
            {paused
              ? "Your listings come back as soon as you resume."
              : "Taking a break? Pausing hides your listings until you resume."}
          </p>
          <button type="submit" className="btn btn-outline text-navy">
            {paused ? "Resume my shop" : "Pause my shop"}
          </button>
        </form>
      )}
    </div>
  );
}
```

When the Hub paused the shop there are two regions before Needs you ("Why the Hub paused it"); the order test runs on a live shop. `SetupChecklist` is a `<section aria-label>` with an `<h2>` (N1 Task 9), so `cardTitles()` finds it.

- [ ] **Step 4: Run the view tests**

Run: `pnpm vitest run components/sell/Dashboard.test.tsx`
Expected: PASS. If the tiles' text joins differently (StatDelta's spaces), loosen only the whitespace in the regexes.

- [ ] **Step 5: Update the request-time tests first.** In `components/sell/SellHome.test.tsx`, add `import { approveShop } from "@/lib/data/staff-shops";` beside the `declineShop` import, and replace these tests:

"shows an approved seller the dashboard: this week's numbers and the next badge (spec 2.8)" becomes:

```tsx
  it("shows an approved seller the home: Needs you, the week against the week before, and the next badge (spec 7.1)", async () => {
    viewer.id = "acc-seller";
    render(await SellHome());
    expect(screen.getByRole("heading", { level: 1, name: "Tech corner" })).toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByText("Live")).toBeInTheDocument();
    // The seed's calculator sale (conv-s2) was marked done on 13 October, after l-001 last changed.
    expect(screen.getByRole("link", { name: /1\s*Sale to mark as sold\s*Casio fx-991ZA Plus calculator/ })).toHaveAttribute(
      "href",
      "/messages/conv-s2",
    );
    const week = within(screen.getByRole("list", { name: "In the last 7 days" })).getAllByRole("listitem");
    expect(week[0]).toHaveTextContent(/^Enquiries\s*2/);
    expect(week[1]).toHaveTextContent(/^Sales\s*0/);
    expect(screen.getByText("2 enquiries in the last 7 days, none today.")).toBeInTheDocument();
    expect(screen.getByText("1 more enquiry and 5 more confirmed sales for Trusted.")).toBeInTheDocument();
  });

  it("shows a buyer waiting over 24 hours in Needs you, with a warning chip (spec 7.1)", async () => {
    const at = "2026-10-13T09:00:00.000Z"; // 25 hours before the test's clock
    sampleStore().conversations.set("conv-wait", {
      id: "conv-wait",
      listingId: "l-007",
      listingTitle: "Gaming headset, barely used",
      sellerSlug: "tech-corner",
      buyerId: "acc-admin",
      sellerGone: false,
      status: "asked",
      createdAt: at,
      lastMessageAt: at,
      firstReplyAt: null,
      completedAt: null,
      confirmedAt: null,
      confirmedBy: null,
    });
    viewer.id = "acc-seller";
    render(await SellHome());
    expect(screen.getByRole("link", { name: /1\s*Buyer waiting for a reply\s*Oldest: Gaming headset, barely used\s*25h/ })).toHaveAttribute(
      "href",
      "/messages?tab=selling",
    );
    expect(screen.getByText("25h")).toHaveAttribute("data-tone", "warning");
  });

  it("shows a newly approved shop its checklist, done from its own data (spec 7.1, New shop)", async () => {
    await approveShop("crochet-corner", "acc-pending", new Date("2026-10-12T08:00:00.000Z"));
    viewer.id = "acc-pending";
    render(await SellHome());
    // No photo yet; about and a pickup point from the wizard; no listing; no reply.
    const checklist = screen.getByRole("region", { name: "Get your shop going" });
    expect(within(checklist).getByText("2 of 5 done")).toBeInTheDocument();
    expect(within(checklist).getByRole("link", { name: "Add a photo of your shop" })).toHaveClass("btn-primary");
    expect(screen.queryByRole("region", { name: "In the last 7 days" })).toBeNull();
  });
```

"tells the shop how many follow it, from the follows in the store (community actions spec 2.18)" becomes:

```tsx
  it("tells the shop how many follow it and how many are new, numbers only (spec 7.1)", async () => {
    viewer.id = "acc-seller";
    const first = render(await SellHome());
    expect(within(screen.getByRole("banner")).getByText("No followers yet")).toBeInTheDocument();
    first.unmount();
    await addFollow("acc-student", "tech-corner", new Date("2026-10-14T08:42:00.000Z"));
    render(await SellHome());
    expect(within(screen.getByRole("banner")).getByText("1 follower")).toBeInTheDocument();
    expect(screen.getByText("+1 new this week")).toBeInTheDocument();
  });
```

In "shows a paused shop as paused, with Resume", change `expect(screen.getByText("Paused: buyers can't see your listings")).toBeInTheDocument();` to `expect(within(screen.getByRole("banner")).getByText("Paused")).toBeInTheDocument();`. In "shows a shop the Hub paused…", change `screen.getByText("Paused by the Hub: buyers can't see your listings")` to `within(screen.getByRole("banner")).getByText("Paused by the Hub")`. In "shows a shop the seller paused as theirs to resume…", the same change as the paused test.

`acc-admin` is a sample account (`data/fixtures/accounts.ts:75`) that doesn't own Tech corner.

- [ ] **Step 6: Run them and watch them fail**

Run: `pnpm vitest run components/sell/SellHome.test.tsx`
Expected: FAIL (SellHome still passes the old props).

- [ ] **Step 7: Rewrite the request-time part.** In `components/sell/SellHome.tsx`, replace the imports and everything after `const standing = …`'s pending branch with:

Imports:

```tsx
import { connection } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { getPickupPoints } from "@/lib/data";
import { followerCounts } from "@/lib/data/follows";
import type { OnboardingDraftRow } from "@/lib/data/rows";
import { dailyEnquiries, recentCounts, shopStats } from "@/lib/data/shop-stats";
import { getOnboardingDraft, getShopOf } from "@/lib/data/shops";
import { shopStanding } from "@/lib/data/staff-shops";
import { DAY_MS } from "@/lib/messaging/rules";
import { signInHref } from "@/lib/next-path";
import { badgeProgress } from "@/lib/selling/badges";
import { DASHBOARD_FORM, takeNotice } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { onboardingPath, type OnboardingStep } from "@/lib/selling/paths";
import { queueFor } from "@/lib/selling/queue";
import type { PickupPoint } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { SellPitch } from "./SellPitch";
import { ShopDeclined } from "./ShopDeclined";
import { ShopWaiting } from "./ShopWaiting";
```

The end of `SellHome`, after the pending branch:

```tsx
  // The ages, the weeks and the days read the clock (decision 26).
  await connection();
  const now = new Date();
  const slug = own.shop.slug;
  // Each card stands on its own reader: a failure is null, and only that card shows its error box (spec 8). The
  // notice is taken as it is shown, so a second visit says nothing (amendment 10.6).
  const [queue, stats, week, daily, followers, state, points] = await Promise.all([
    queueFor(slug).catch(() => null),
    shopStats(slug, now).catch(() => null),
    recentCounts(slug, 7, now).catch(() => null),
    dailyEnquiries(slug, 7, now).catch(() => null),
    followerCounts(slug, new Date(now.getTime() - 7 * DAY_MS)).catch(() => null),
    takeNotice(DASHBOARD_FORM),
    getPickupPoints().catch(() => [] as PickupPoint[]),
  ]);
  return (
    <Dashboard
      shop={own.shop}
      paused={own.status === "paused"}
      hubPause={standing?.pausedByHub ? (standing.reason ?? "") : null}
      notice={noticeText(state?.notice)}
      now={now}
      queue={queue}
      record={stats?.record ?? null}
      badgeLine={stats ? badgeProgress(own.shop.badge, stats.record, account.createdAt, now) : ""}
      week={week}
      daily={daily}
      followers={followers}
      campusHasPoints={points.some((point) => point.campusSlug === own.shop.campusSlug)}
    />
  );
}
```

Update the component's comment: "…the home once it's approved or paused (role views spec 7.1)."

- [ ] **Step 8: The skeleton.** `SellSkeleton` in `components/sell/SellSkeleton.tsx` becomes:

```tsx
/**
 * /sell's shape while it streams in (role views N2 plan decision 15): the header card and one card under it, shorter
 * than every state (the shortest, a new shop's checklist, is measured in tests/e2e/role-views-writes.spec.ts).
 * `.sell-page` is a screen tall, so the footer stays below the first screen while it streams.
 */
export function SellSkeleton() {
  return (
    <div className="sell-column sell-home" aria-hidden="true">
      <span className="skeleton sell-skeleton-head" />
      <span className="skeleton sell-skeleton-body" />
    </div>
  );
}
```

In `app/globals.css`, the skeleton rules (around line 8177) become:

```css
  /* While /sell streams in (role views N2 plan decision 15): the header card and one card. Shorter than the shortest
     state (a new shop's checklist), which tests/e2e/role-views-writes.spec.ts measures; .sell-page is a screen tall,
     so the footer doesn't move. */
  .sell-skeleton-head {
    height: 9rem;
    border-radius: var(--radius-card);
  }

  .sell-skeleton-body {
    height: 7rem;
    border-radius: var(--radius-card);
  }
```

- [ ] **Step 9: The CSS block.** Append after N1's kit block (and after its media blocks), at the end of `app/globals.css`:

```css
/* --- Role views: the seller home and My listings (N2; role views spec 7.1) ------------------------------------------
   Built on the kit. Colours only from tokens; sky only as N1's solid "live" pill. Every control 44px or more. */
@layer components {
  .sell-home {
    gap: 16px;
  }

  .sell-home-head {
    display: grid;
    justify-items: start;
    gap: 8px;
  }

  .sell-home-facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .sell-home-followers {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
  }

  .sell-home-note {
    color: var(--color-ink);
    font-size: 14px;
  }

  /* Links on white are sky-dark (4.7:1), underlined. */
  .sell-home-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .sell-home-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .sell-home-buttons .btn {
    justify-content: center;
    min-height: 44px;
  }

  .stat-tile-note {
    color: var(--color-muted);
    font-size: 12px;
    font-weight: 600;
  }

  /* My listings' segments: the count under the label, so four fit one line at 360px (plan decision 12). */
  .link-segment:has(> .link-segment-count) {
    padding-inline: 4px;
    line-height: 1.15;
  }

  .link-segment-label {
    font-size: 13px;
  }

  .link-segment-count {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .link-segments li {
    min-width: 0;
  }

  /* My listings' rows: the row is the edit link; its actions sit under it, Delete apart at the far end. */
  .mylist {
    gap: 0;
  }

  .mylist-new {
    justify-self: start;
    min-height: 44px;
  }

  .mylist > li + li {
    border-top: 1px solid var(--color-line);
  }

  .mylist > li + li > .list-row {
    border-top: 0;
  }

  .list-row-lead .sell-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .list-row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding-bottom: 12px;
  }

  .list-row-actions .staff-hidden-note {
    flex-basis: 100%;
  }

  .mylist-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Danger red on white is 6.57:1. A text link, never a pill beside Mark sold (spec 7.1, Fixes). */
  .mylist-delete {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-inline-start: auto;
    color: var(--color-danger);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

@media (min-width: 48rem) and (min-height: 30rem) {
  .list-row-actions {
    padding-left: 50px;
  }
}
```

- [ ] **Step 10: Remove the dead rules.** These were the old dashboard's and My listings' and nothing uses them after this task and Task 11:

```bash
grep -rn "sell-status\|sell-rows\|sell-row\b\|sell-tabs\|sell-tab\b\|sell-tab-count\|sell-empty\|sell-followers\|sell-list\b\|sell-item\b\|sell-item-actions\|sell-action-danger" components app lib tests --include='*.tsx' --include='*.ts'
```
Expected (after Task 11): only `components/sell/DeleteListing.tsx` (`sell-item sell-item-alone`, line 21) and `components/sell/PhotoFieldset.tsx` (`sell-action-danger`, line 33), which keep `.sell-item`, `.sell-item-alone`, `.sell-item .sell-thumb` and `.sell-action-danger`; `ListingSummary` keeps `.sell-item-title` and `.sell-item-meta` (not in the grep). Then delete from `app/globals.css` the rule blocks `.sell-status`, `.sell-status-paused`, `.sell-rows`, `.sell-row`, `.sell-row svg`, `.sell-tabs ul`, `.sell-tab`, `.sell-tab[aria-current="page"]`, `.sell-tab-count`, `.sell-empty`, `.sell-followers`, `.sell-list`, `.sell-item-actions` (and its `wide:` media rule, with the `.sell-item` column change in that same media block only if nothing else needs three columns: Delete's `.sell-item-alone` has no actions, so the two-column default suits it). If the grep finds any other user, keep that rule and note it.

- [ ] **Step 11: Run the tests**

Run: `pnpm vitest run components/sell lib/selling && pnpm typecheck && pnpm lint`
Expected: PASS, clean (Step 10's grep runs again in Task 11).

- [ ] **Step 12: Commit (controller)**

```bash
git add components/sell/Dashboard.tsx components/sell/Dashboard.test.tsx components/sell/SellHome.tsx components/sell/SellHome.test.tsx components/sell/SellSkeleton.tsx app/globals.css
git commit -m "feat(sell): the seller home: Needs you, the two buttons, the week against the week before, enquiries by day, the badge bar, listings by state, the setup checklist for new shops (role views N2 Task 9)"
```

---

### Task 10: The seller bar's Messages badge

**Files:**
- Modify: `components/kit/sections.tsx` (N1 Task 11's `SellBar`), `components/kit/sections.test.tsx`
- Create: `components/kit/sell-badge.test.tsx`

- [ ] **Step 1: Update the bar's tests first.** In `components/kit/sections.test.tsx`:

The shop mock's shape gains the shop's link:

```tsx
const shop = vi.hoisted(() => ({ own: null as { status: string; shop: { slug: string } } | null }));
vi.mock("@/lib/data/shops", () => ({ getShopOf: async () => shop.own }));

const queue = vi.hoisted(() => ({ waiting: 2, failing: false, reads: 0 }));
vi.mock("@/lib/selling/queue", () => ({
  queueFor: async () => {
    queue.reads += 1;
    if (queue.failing) throw new Error("down");
    return { replies: { count: queue.waiting, oldest: null } };
  },
}));
```

In `afterEach`, add `queue.failing = false; queue.reads = 0;`. In the SellBar tests, `shop.own = { status: "approved" }` becomes `shop.own = { status: "approved", shop: { slug: "tech-corner" } }` and `{ status: "pending" }` becomes `{ status: "pending", shop: { slug: "crochet-corner" } }`. Add:

```tsx
  it("badges Messages with the buyers waiting for a reply, from the home's own reader (spec 4.2)", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "approved", shop: { slug: "tech-corner" } };
    render(await SellBar());
    const messages = within(screen.getByRole("navigation", { name: "Selling" })).getByRole("link", { name: "Messages" });
    expect(messages).toHaveAccessibleDescription(/2\s+buyers waiting for a reply/);
  });

  it("drops the badge when the queue fails, and never reads it for a waiting shop", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "approved", shop: { slug: "tech-corner" } };
    queue.failing = true;
    const failed = render(await SellBar());
    expect(within(failed.container).getByRole("link", { name: "Messages" })).not.toHaveAttribute("aria-describedby");
    failed.unmount();
    queue.reads = 0;
    shop.own = { status: "pending", shop: { slug: "crochet-corner" } };
    render(await SellBar());
    expect(queue.reads).toBe(0);
  });
```

- [ ] **Step 2: The "badge equals list" test** `components/kit/sell-badge.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellHome } from "@/components/sell/SellHome";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SellBar } from "./sections";

// The real sample store and the real readers; only the session is Tech corner's owner.
const viewer = vi.hoisted(() => ({ id: "acc-seller" }));
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  return { getViewer: async () => getAccount(viewer.id), getSessionKey: async () => null };
});
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/selling/shop-actions", () => ({
  pauseShop: async () => {},
  resumeShop: async () => {},
  sendForApprovalAgain: async () => {},
}));

const NOW = new Date("2026-10-14T10:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A buyer who asked Tech corner about its headset `hours` ago and is still waiting. */
function waiting(id: string, buyerId: string, hours: number) {
  const at = new Date(NOW.getTime() - hours * 3_600_000).toISOString();
  sampleStore().conversations.set(id, {
    id,
    listingId: "l-007",
    listingTitle: "Gaming headset, barely used",
    sellerSlug: "tech-corner",
    buyerId,
    sellerGone: false,
    status: "asked",
    createdAt: at,
    lastMessageAt: at,
    firstReplyAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
  });
}

describe("the seller bar's Messages badge equals the home's Needs-you row (role views spec 4.2)", () => {
  it("counts the same buyers waiting, from the same reader", async () => {
    waiting("conv-w1", "acc-student", 3);
    waiting("conv-w2", "acc-mentor", 30);
    waiting("conv-w3", "acc-admin", 50);
    render(
      <>
        {await SellBar()}
        {await SellHome()}
      </>,
    );
    const messages = within(screen.getByRole("navigation", { name: "Selling" })).getByRole("link", { name: "Messages" });
    expect(messages).toHaveAccessibleDescription(/^3\s+buyers waiting for a reply$/);
    const row = within(screen.getByRole("list", { name: "Needs you" })).getByRole("link", { name: /Buyers waiting for a reply/ });
    expect(row.querySelector(".needs-count")).toHaveTextContent("3");
  });
});
```

The three buyer ids are sample accounts (`data/fixtures/accounts.ts:18, 63, 75`); none owns Tech corner.

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run components/kit/sections.test.tsx components/kit/sell-badge.test.tsx`
Expected: FAIL (no badge on Messages).

- [ ] **Step 4: Implement.** In `components/kit/sections.tsx`, add `import { queueFor } from "@/lib/selling/queue";` and replace `SellBar` with:

```tsx
/**
 * Selling: only for an account that has a shop. A waiting or declined shop has no Messages yet. Messages carries the
 * buyers waiting for a reply, from the queue the home's Needs you reads in the same request (role views N2 plan
 * decision 8); a failed read shows no badge (spec 4.2).
 */
export async function SellBar() {
  const account = await getViewer().catch(() => null);
  if (!account) return null;
  const own = await getShopOf(account.id).catch(() => null);
  if (!own) return null;
  const open = own.status !== "pending";
  const waiting = open ? await queueFor(own.shop.slug).then((queue) => queue.replies.count, () => null) : null;
  const messages: SectionTab = {
    key: "messages",
    href: "/messages?tab=selling",
    label: "Messages",
    icon: <MessageIcon />,
    prefetch: false,
    badge: badge(waiting, "buyer waiting for a reply", "buyers waiting for a reply"),
  };
  const tabs: SectionTab[] = [
    { key: "overview", href: "/sell", label: "Overview", icon: <GridIcon /> },
    { key: "listings", href: "/sell/listings", label: "Listings", icon: <BagIcon />, match: "section", prefetch: false },
    ...(open ? [messages] : []),
    { key: "shop", href: "/sell/profile", label: "Shop", icon: <StoreIcon />, prefetch: false },
    EXIT,
  ];
  return <SectionBar label="Selling" tabs={tabs} />;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run components/kit && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit (controller)**

```bash
git add components/kit/sections.tsx components/kit/sections.test.tsx components/kit/sell-badge.test.tsx
git commit -m "feat(kit): the seller bar's Messages badge counts buyers waiting, from the home's own reader (role views N2 Task 10)"
```

---

### Task 11: My listings, the Delete page and the titles

**Files:**
- Modify (full rewrite): `components/sell/MyListingsView.tsx`, `components/sell/MyListingsView.test.tsx`
- Modify: `app/sell/listings/page.tsx`, `app/sell/listings/new/page.tsx`, `app/sell/listings/[id]/edit/page.tsx`, `app/sell/listings/[id]/delete/page.tsx`

- [ ] **Step 1: Write the failing tests.** Replace `components/sell/MyListingsView.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ListingsTab } from "@/lib/types";
import { makeListingRow } from "@/tests/helpers/fakes";
import { MyListingsView } from "./MyListingsView";

// The buttons only need something to post to; the actions have their own tests.
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {} }));

const rows = [
  makeListingRow({ id: "l-a", title: "Desk fan", state: "available", priceZar: 150, updatedAt: "2026-10-13T08:00:00.000Z" }),
  makeListingRow({ id: "l-p", title: "Kettle", state: "paused" }),
  makeListingRow({ id: "l-s", title: "Lamp", state: "sold" }),
  makeListingRow({ id: "l-d", title: "Bike", state: "draft" }),
];

const show = (tab: ListingsTab, extra: Partial<Parameters<typeof MyListingsView>[0]> = {}) =>
  render(
    <MyListingsView tab={tab} rows={rows} waiting={false} paused={false} notice={null} noticeListing={null} {...extra} />,
  );

/** A listing's row: the <li> holding its edit link. */
const itemFor = (title: string) => screen.getByRole("link", { name: `Edit ${title}` }).closest("li")!;

describe("Your listings (selling spec 2.9, role views spec 7.1)", () => {
  it("shows the four states as segments with their counts, marking the open one", () => {
    show("available");
    const nav = screen.getByRole("navigation", { name: "Listings by state" });
    expect(nav).toHaveClass("link-segments");
    expect(within(nav).getAllByRole("link").map((tab) => [tab.textContent, tab.getAttribute("href"), tab.getAttribute("aria-current")])).toEqual([
      ["Available 1", "/sell/listings", "page"],
      ["Paused 1", "/sell/listings?tab=paused", null],
      ["Sold 1", "/sell/listings?tab=sold", null],
      ["Drafts 1", "/sell/listings?tab=drafts", null],
    ]);
  });

  it("makes each listing one row that opens its form, named Edit {title}, with its price and last update", () => {
    show("available");
    const link = screen.getByRole("link", { name: "Edit Desk fan" });
    expect(link).toHaveAttribute("href", "/sell/listings/l-a/edit");
    expect(link).toHaveClass("list-row");
    expect(link).toHaveAccessibleDescription("R150 · Updated 13 Oct");
    expect(screen.queryByText("Kettle")).toBeNull();
  });

  it("keeps Pause and Mark sold together and Delete apart, as a text link at the end", () => {
    show("available");
    const item = itemFor("Desk fan");
    const buttons = within(item).getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["Pause Desk fan", "Mark sold Desk fan"]);
    const remove = within(item).getByRole("link", { name: "Delete Desk fan" });
    expect(remove).toHaveAttribute("href", "/sell/listings/l-a/delete");
    expect(remove).toHaveClass("mylist-delete");
    // Mark sold is never next to Delete: they are in different groups.
    expect(within(item).getByRole("button", { name: "Mark sold Desk fan" }).closest(".mylist-actions")).not.toContainElement(remove);
    expect(item.querySelector('input[name="tab"]')).toHaveValue("available");
  });

  it("offers Resume on a paused listing, Relist on a sold one, and only Delete beside a draft", () => {
    const paused = show("paused");
    expect(screen.getByRole("button", { name: "Resume Kettle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark sold Kettle" })).toBeInTheDocument();
    paused.unmount();
    const sold = show("sold");
    expect(screen.getByRole("button", { name: "Relist Lamp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mark sold/ })).toBeNull();
    sold.unmount();
    show("drafts");
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByRole("link", { name: "Edit Bike" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delete Bike" })).toBeInTheDocument();
  });

  it("offers New listing once: above the rows, or as an empty tab's button (plan review fix 10)", () => {
    show("available");
    expect(screen.getAllByRole("link", { name: "New listing" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
  });

  it("shows an empty tab as an empty state with a New listing button", () => {
    for (const [tab, title] of [
      ["available", "Nothing available right now"],
      ["paused", "Nothing paused"],
      ["sold", "Nothing sold yet"],
      ["drafts", "No drafts"],
    ] as const) {
      const { unmount } = render(
        <MyListingsView tab={tab} rows={[]} waiting={false} paused={false} notice={null} noticeListing={null} />,
      );
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
      unmount();
    }
  });

  it("shows the last action's notice with a link to the listing, and tells a waiting shop its listings are drafts", () => {
    show("available", { notice: "Published. Buyers can find it now.", noticeListing: "l-a", waiting: true });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Published. Buyers can find it now.");
    expect(within(notice).getByRole("link", { name: "See it as buyers do" })).toHaveAttribute("href", "/listings/l-a");
    expect(screen.getByText(/Your shop is waiting for the Hub/)).toBeInTheDocument();
    expect(screen.queryByText(/Your shop is paused/)).toBeNull();
  });

  it("tells a paused shop buyers can't see its listings, and offers no look as a buyer (amendment 11.6)", () => {
    const notice = "Saved. Your shop is paused, so buyers will see it when you resume your shop.";
    show("available", { paused: true, notice, noticeListing: "l-a" });
    expect(screen.getByRole("status")).toHaveTextContent(notice);
    expect(screen.queryByRole("link", { name: "See it as buyers do" })).toBeNull();
    expect(screen.getByText("Your shop is paused, so buyers can't see your listings until you resume it.")).toBeInTheDocument();
  });

  it("tells a seller the Hub paused the shop, with the Hub's reason and no promise they can resume it (staff tools plan decision 3)", () => {
    show("available", { paused: true, hubPause: "Selling exam answers." });
    const banner = screen.getByText(/^Paused by the Hub: buyers can't see your listings\./);
    expect(banner).toHaveTextContent("The Hub said: Selling exam answers.");
    expect(banner).not.toHaveTextContent(/until you resume/);
    expect(screen.queryByText(/Your shop is paused/)).toBeNull();
  });

  it("marks a listing the Hub hid, with the Hub's reason, and keeps Edit and Delete (staff tools plan decision 4)", () => {
    const hidden = makeListingRow({ hiddenAt: "2026-10-14T08:00:00.000Z", hiddenReason: "Exam papers aren't allowed." });
    render(<MyListingsView tab="available" rows={[hidden]} waiting={false} paused={false} notice={null} noticeListing={null} />);
    expect(screen.getByText("Hidden by the Hub: Exam papers aren't allowed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Test listing" })).toHaveAccessibleDescription(/Hidden by the Hub$/);
    expect(screen.getByRole("link", { name: "Delete Test listing" })).toBeInTheDocument();
  });

  it("says no reason was given when the Hub gave none", () => {
    render(
      <MyListingsView
        tab="available"
        rows={[makeListingRow({ hiddenAt: "2026-10-14T08:00:00.000Z" })]}
        waiting={false}
        paused={false}
        notice={null}
        noticeListing={null}
      />,
    );
    expect(screen.getByText("Hidden by the Hub: no reason given")).toBeInTheDocument();
  });

  // Next treats /sell/listings and /sell/listings?tab=paused as one page, so a kept page's rows meet the next tab's
  // (selling plan amendment 2). Rows are keyed by their listing, so none of them, or their forms, carries over.
  it("carries nothing over when the same page is shown for another tab", () => {
    const { rerender } = show("available");
    const fan = itemFor("Desk fan");
    rerender(<MyListingsView tab="paused" rows={rows} waiting={false} paused={false} notice={null} noticeListing={null} />);
    expect(fan.isConnected).toBe(false);
    expect(screen.queryByText("Desk fan")).toBeNull();
    expect(itemFor("Kettle").querySelector('input[name="tab"]')).toHaveValue("paused");
  });
});
```

In `components/sell/MyListings.test.tsx`, line 40 (it looked for the old `.sell-item-title` line, which rows no longer have) becomes:

```tsx
    expect(screen.getByRole("link", { name: "Edit Casio fx-991ZA Plus calculator" })).toBeInTheDocument();
```

and the comment above it ("The title is also in each control's sr-only name…") becomes "The row's link is named Edit {title}."

Then check nothing else clicks a New listing link on `/sell/listings` while its tab is empty (the header's button has gone; plan review fix 10):

```bash
grep -rn '"New listing"' tests/e2e
```
Expected: only lookups on `/sell` (the home's button) or on a tab with listings. Change any other to the empty state's button, which has the same name.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/sell/MyListingsView.test.tsx components/sell/MyListings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** Replace `components/sell/MyListingsView.tsx` with:

```tsx
import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/kit/EmptyState";
import { ListRow } from "@/components/kit/ListRow";
import { Pill } from "@/components/kit/Pill";
import { LinkTabs } from "@/components/ui/LinkTabs";
import type { ListingRow } from "@/lib/data/rows";
import { priceLabel } from "@/lib/format";
import { changeListingState } from "@/lib/selling/listing-actions";
import { deleteListingPath, editListingPath, LISTINGS_TABS, myListingsPath, NEW_LISTING_PATH } from "@/lib/selling/paths";
import { shortSastDate } from "@/lib/time";
import type { ListingsTab } from "@/lib/types";
import { Thumb } from "./Thumb";

type MyListingsViewProps = {
  tab: ListingsTab;
  /** All the shop's listings; the view picks the tab's. */
  rows: readonly ListingRow[];
  /** The shop is waiting for approval, so everything is a draft (plan decision 4). */
  waiting: boolean;
  /** The shop is paused, so buyers see none of its listings (amendment 11.6). */
  paused: boolean;
  /** The Hub's reason when the Hub paused the shop (staff tools plan decision 3); the seller can't resume it. */
  hubPause?: string | null;
  notice: string | null;
  /** The listing the notice is about, for its link. */
  noticeListing: string | null;
};

const EMPTY: Readonly<Record<ListingsTab, { title: string; line: string }>> = {
  available: { title: "Nothing available right now", line: "Add a listing and students on your campus can find it." },
  paused: { title: "Nothing paused", line: "Pause a listing to hide it from buyers for a while, then resume it here." },
  sold: { title: "Nothing sold yet", line: "When something sells, mark it sold and it moves here." },
  drafts: { title: "No drafts", line: "Save a listing as a draft to finish it later. Only you can see drafts." },
};

/**
 * Your listings (selling spec 2.9, role views spec 7.1): the last action's notice, the four states as segments with
 * their counts, and the open state's listings as rows. Each row opens the listing's form ("Edit {title}"); its Pause,
 * Resume, Relist and Mark sold sit under it, and Delete is a text link set apart at the far end, never beside Mark
 * sold. An empty state offers New listing. While the shop is paused, buyers can't see the listing, so the notice offers
 * no look as a buyer; a shop the Hub paused says so, with the Hub's reason (staff tools plan decision 3).
 */
export function MyListingsView({ tab, rows, waiting, paused, hubPause = null, notice, noticeListing }: MyListingsViewProps) {
  const open = LISTINGS_TABS.find((item) => item.tab === tab)!;
  const shown = rows.filter((row) => row.state === open.state);
  const linkable = !paused && rows.some((row) => row.id === noticeListing && row.state !== "draft");
  return (
    <>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
          {linkable && (
            <>
              {" "}
              <Link href={`/listings/${noticeListing}`} prefetch={false}>
                See it as buyers do
              </Link>
            </>
          )}
        </p>
      )}
      {waiting && (
        <p className="form-notice">
          Your shop is waiting for the Hub, so your listings stay drafts until it&apos;s approved.
        </p>
      )}
      {paused && hubPause !== null && (
        <p className="form-notice staff-hub-pause">
          {`Paused by the Hub: buyers can't see your listings.${hubPause ? ` The Hub said: ${hubPause}` : ""}`}
        </p>
      )}
      {paused && hubPause === null && (
        <p className="form-notice">Your shop is paused, so buyers can&apos;t see your listings until you resume it.</p>
      )}

      <LinkTabs
        label="Listings by state"
        look="segmented"
        current={tab}
        tabs={LISTINGS_TABS.map((item) => ({
          key: item.tab,
          label: item.label,
          count: rows.filter((row) => row.state === item.state).length,
          href: myListingsPath(item.tab),
        }))}
      />

      <section aria-labelledby="sell-list-title" className="sell-section">
        <h2 id="sell-list-title" className="sr-only">
          {open.label}
        </h2>
        {shown.length === 0 ? (
          <EmptyState
            icon={<PlusIcon />}
            title={EMPTY[tab].title}
            line={EMPTY[tab].line}
            action={{ label: "New listing", href: NEW_LISTING_PATH }}
          />
        ) : (
          <>
            <Link href={NEW_LISTING_PATH} prefetch={false} className="btn btn-primary mylist-new">
              New listing
            </Link>
            <ul className="kit-card mylist">
              {shown.map((row) => (
                <ListingItem key={row.id} row={row} tab={tab} />
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

/**
 * A listing's photo, title, price and last update. Delete listing's page shows it too. A listing the Hub hid says so,
 * with the reason (staff tools plan decision 4).
 */
export function ListingSummary({ row }: { row: ListingRow }) {
  const cover = row.photos[0]?.src ?? `/placeholders/listing/${row.categorySlug}.svg`;
  return (
    <>
      <Thumb src={cover} alt="" size={64} />
      <div>
        <p className="sell-item-title">{row.title}</p>
        <p className="sell-item-meta">
          {priceLabel(row)} · Updated {shortSastDate(row.updatedAt)}
        </p>
        {row.hiddenAt && (
          <p className="staff-hidden-note">{`Hidden by the Hub: ${row.hiddenReason ?? "no reason given"}`}</p>
        )}
      </div>
    </>
  );
}

function ListingItem({ row, tab }: { row: ListingRow; tab: ListingsTab }) {
  const cover = row.photos[0]?.src ?? `/placeholders/listing/${row.categorySlug}.svg`;
  const detail = `${priceLabel(row)} · Updated ${shortSastDate(row.updatedAt)}${row.hiddenAt ? " · Hidden by the Hub" : ""}`;
  return (
    <ListRow
      href={editListingPath(row.id)}
      label={`Edit ${row.title}`}
      lead={{ kind: "thumb", node: <Thumb src={cover} alt="" size={40} /> }}
      title={row.title}
      detail={detail}
      pill={row.hiddenAt ? <Pill tone="danger">Hidden</Pill> : undefined}
      actions={
        <>
          {row.hiddenAt && (
            <p className="staff-hidden-note">{`Hidden by the Hub: ${row.hiddenReason ?? "no reason given"}`}</p>
          )}
          <div className="mylist-actions">
            {row.state === "available" && <StateButton row={row} tab={tab} to="paused" label="Pause" />}
            {row.state === "paused" && <StateButton row={row} tab={tab} to="available" label="Resume" />}
            {row.state === "sold" && <StateButton row={row} tab={tab} to="available" label="Relist" />}
            {(row.state === "available" || row.state === "paused") && (
              <StateButton row={row} tab={tab} to="sold" label="Mark sold" />
            )}
          </div>
          <Link href={deleteListingPath(row.id)} prefetch={false} className="mylist-delete">
            Delete <span className="sr-only">{row.title}</span>
          </Link>
        </>
      }
    />
  );
}

/** One of the row's buttons (plan decision 3): a small form posting the listing, the move and the open tab. */
function StateButton({ row, tab, to, label }: { row: ListingRow; tab: ListingsTab; to: string; label: string }) {
  return (
    <form action={changeListingState}>
      <input type="hidden" name="listing" value={row.id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="tab" value={tab} />
      <button type="submit" className="sell-action">
        {label} <span className="sr-only">{row.title}</span>
      </button>
    </form>
  );
}
```

The "Hidden" pill is inside the link, which has its own `aria-label`; the detail (its description) ends "· Hidden by the Hub", so the state is read either way. The draft row has no `.mylist-actions` buttons, only the empty group and Delete.

- [ ] **Step 4: The pages.** Each keeps N1's `PageTransition` wrapper; only the words, crumbs and the Delete page's header change.

`app/sell/listings/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { PageTransition } from "@/components/kit/PageTransition";
import { MyListings } from "@/components/sell/MyListings";
import { SellFormSkeleton } from "@/components/sell/SellSkeleton";
import { SELL_PATH } from "@/lib/selling/paths";

export const metadata: Metadata = { title: "Your listings", robots: { index: false } };

/**
 * Your listings (selling spec 2.9): the heading is prerendered; the tab and its listings stream in. New listing comes
 * with them, above the rows, or as an empty tab's own button, so it is never there twice (plan review fix 10).
 */
export default function MyListingsPage({ searchParams }: PageProps<"/sell/listings">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Link href={SELL_PATH} prefetch={false} className="sell-crumb">
              <ChevronLeftIcon className="size-4" />
              Your shop
            </Link>
            <h1 className="sell-title">Your listings</h1>
          </header>
          <Suspense fallback={<SellFormSkeleton />}>
            <MyListings searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
```

In `app/sell/listings/new/page.tsx` and `app/sell/listings/[id]/edit/page.tsx`, the crumb's word `My listings` becomes `Your listings`. In the edit page, the metadata title becomes `"Edit your listing"`.

`app/sell/listings/[id]/delete/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { PageTransition } from "@/components/kit/PageTransition";
import { DeleteListing } from "@/components/sell/DeleteListing";
import { SellDeleteSkeleton } from "@/components/sell/SellSkeleton";
import { myListingsPath } from "@/lib/selling/paths";

export const metadata: Metadata = { title: "Delete your listing", robots: { index: false } };

/** One sample, so the build checks the request-time part sits inside <Suspense> (CLAUDE.md). It matches no listing. */
export async function generateStaticParams() {
  return [{ id: "l-sample" }];
}

/** Delete listing (selling spec 2.9): the heading and the way back are prerendered; the listing streams in. */
export default function DeleteListingPage({ params }: PageProps<"/sell/listings/[id]/delete">) {
  return (
    <PageTransition>
      <div className="page sell-page">
        <div className="sell-column">
          <header className="sell-head">
            <Link href={myListingsPath()} prefetch={false} className="sell-crumb">
              <ChevronLeftIcon className="size-4" />
              Your listings
            </Link>
            <h1 className="sell-title">Delete this listing?</h1>
          </header>
          <Suspense fallback={<SellDeleteSkeleton />}>
            <DeleteListing params={params} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
```

If N1's build put `PageTransition` somewhere else in these files, keep it where N1 put it and change only the words, crumb and header.

- [ ] **Step 5: Run the tests and the dead-CSS check**

Run: `pnpm vitest run components/sell app/sell && pnpm typecheck && pnpm lint`
Expected: PASS (`SellSkeleton.test.tsx` still renders the Delete page's skeleton).

Run Task 9 Step 10's `grep` again. Expected: no output; delete the rules it lists.

- [ ] **Step 6: Commit (controller)**

```bash
git add components/sell/MyListingsView.tsx components/sell/MyListingsView.test.tsx components/sell/MyListings.test.tsx app/sell/listings app/globals.css
git commit -m "feat(sell): Your listings as segments and rows, Delete apart as a text link, empty states with New listing, Your titles and the Delete page's way back (role views N2 Task 11)"
```

---

### Task 12: "Mark {title} as sold" in a selling thread

**Files:**
- Modify: `lib/selling/form-state.ts`, `lib/selling/listing-actions.ts`, `lib/selling/listing-actions.test.ts`
- Modify: `components/messages/SaleActions.tsx`, `components/messages/ThreadView.tsx`, `components/messages/OpenThread.tsx`
- Modify: `components/messages/OpenThread.test.tsx`, `components/messages/ThreadView.test.tsx`

- [ ] **Step 1: Write the failing action test.** Add to the "My listings' buttons and Delete listing" `describe` in `lib/selling/listing-actions.test.ts` (import `threadSoldForm` from `./form-state`):

```ts
  it("marks a listing sold from its selling thread and goes back there, saying so (role views N2)", async () => {
    await signedInAs("acc-seller");
    const post = form({ listing: "l-001", to: "sold", tab: "available", thread: "conv-s2" });
    expect(await redirectOf(() => changeListingState(post))).toBe("/messages/conv-s2");
    expect((await getOwnListing("tech-corner", "l-001"))?.state).toBe("sold");
    expect((await readFormState(threadSoldForm("conv-s2")))?.notice).toBe("sold");
    expect((await readFormState(MY_LISTINGS_FORM))?.notice).toBeUndefined();
    // A second press changes nothing and says nothing more.
    expect(await redirectOf(() => changeListingState(post))).toBe("/messages/conv-s2");
    expect(request.updatedTags).toEqual(["listings"]);
  });

  it("goes back to My listings when the thread field isn't an id", async () => {
    await signedInAs("acc-seller");
    const post = form({ listing: "l-001", to: "sold", tab: "available", thread: "https://example.com" });
    expect(await redirectOf(() => changeListingState(post))).toBe("/sell/listings");
  });
```

If `readFormState` on a missing state returns `null` rather than a row without a notice, write `expect(await readFormState(MY_LISTINGS_FORM)).toBeNull()`.

- [ ] **Step 2: Write the failing thread tests.** In `components/messages/OpenThread.test.tsx`, add beside the other mocks:

```tsx
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {} }));
```

and add to the `describe`:

```tsx
  it("offers the seller Mark {title} as sold once the sale is completed and the listing is still up (role views N2)", async () => {
    session.accountId = "acc-seller";
    render(await OpenThread({ id: "conv-s2" }));
    const form = screen.getByRole("button", { name: "Mark Casio fx-991ZA Plus calculator as sold" }).closest("form")!;
    expect(form.querySelector('input[name="listing"]')).toHaveValue("l-001");
    expect(form.querySelector('input[name="to"]')).toHaveValue("sold");
    expect(form.querySelector('input[name="thread"]')).toHaveValue("conv-s2");
  });

  it("never offers it to the buyer, nor once the listing is sold", async () => {
    render(await OpenThread({ id: "conv-s2" }));
    expect(screen.queryByRole("button", { name: /as sold$/ })).toBeNull();
    sampleStore().listings.get("l-001")!.state = "sold";
    session.accountId = "acc-seller";
    render(await OpenThread({ id: "conv-s2" }));
    expect(screen.queryByRole("button", { name: /as sold$/ })).toBeNull();
  });
```

In `components/messages/ThreadView.test.tsx`, add a test for the notice:

```tsx
  it("says the listing is marked sold, once, after Mark as sold (role views N2)", () => {
    render(
      <ThreadView
        thread={sellerThread}
        now={NOW}
        reply={{ body: "", errors: [], warnings: [] }}
        sent={false}
        campusName="Midrand"
        markSold={null}
        soldNotice="Marked as sold. Its page stays up and says Sold."
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Marked as sold. Its page stays up and says Sold.");
  });
```

Use the file's existing seller-side thread fixture for `sellerThread` and its `NOW` (read the file's top first; name them as it does).

`SaleActions.tsx` now imports the "use server" module `@/lib/selling/listing-actions` (Step 6), so every test that renders it without the real actions mocks that module too (plan review fix 2):
- `components/messages/ThreadView.test.tsx` and `components/messages/field-ids.test.tsx`: beside their `@/lib/messaging/actions` mock, add

```tsx
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {} }));
```

- `components/forms/summary-ids.test.tsx:62`: the existing mock becomes

```tsx
vi.mock("@/lib/selling/listing-actions", () => ({ saveListingForm: async () => {}, changeListingState: async () => {} }));
```

Then `grep -rln "SaleActions\|ThreadView\|OpenThread" components --include='*.test.tsx'` lists no other test that renders the thread without one of these mocks.

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run lib/selling/listing-actions.test.ts components/messages/OpenThread.test.tsx components/messages/ThreadView.test.tsx`
Expected: FAIL.

- [ ] **Step 4: The form state's key.** In `lib/selling/form-state.ts`, after `PROFILE_FORM`:

```ts
/** A selling thread's notice after "Mark {title} as sold" (role views N2 plan decision 4). */
export const threadSoldForm = (conversationId: string) => `thread-sold:${conversationId}`;
```

- [ ] **Step 5: The action.** In `lib/selling/listing-actions.ts`, add `threadPath` to the `@/lib/messaging/paths` import (`import { isId, threadPath } from "@/lib/messaging/paths";`), `threadSoldForm` to the `./form-state` import, and replace `changeListingState` with:

```ts
/**
 * Pause, Resume, Mark sold and Relist on My listings (selling spec 2.9, plan decision 3), back to the same tab. "Mark
 * {title} as sold" in a selling thread posts the thread too (role views N2 plan decision 4): back there, with its
 * notice. The way back is built from an id that passed isId, so a form can't send anyone elsewhere; another account's
 * thread is that page's 404.
 */
export async function changeListingState(formData: FormData): Promise<void> {
  const tab = parseListingsTab(field(formData, "tab"));
  const thread = field(formData, "thread");
  const fromThread = isId(thread);
  const back = fromThread ? threadPath(thread) : myListingsPath(tab);
  const owner = await requireShopOwner(back);
  const id = field(formData, "listing");
  const to = field(formData, "to");
  if (isId(id) && (to === "available" || to === "paused" || to === "sold")) {
    const now = new Date();
    const row = await setOwnListingState(owner.shop.slug, id, to, now);
    if (row) {
      listingsChanged();
      // Resume and Relist don't put a paused shop's listing in front of buyers (amendment 11.6).
      const pausedNotice = to === "available" ? pausedShopNotice(owner) : null;
      const notice = pausedNotice ?? NOTICE_FOR[to];
      const form = fromThread ? threadSoldForm(thread) : MY_LISTINGS_FORM;
      await writeFormState(form, { errors: [], values: { listing: row.id }, notice }, now);
    }
  }
  done(back);
}
```

- [ ] **Step 6: The form.** In `components/messages/SaleActions.tsx`, add `import { changeListingState } from "@/lib/selling/listing-actions";` and, at the end of the file:

```tsx
/**
 * "Mark {title} as sold" (role views spec 7.1, Fixes): shown to the seller in a thread whose sale is completed while
 * its listing is still up, exactly when the shop's queue lists it (N2 plan decision 3). One plain form to the listing
 * buttons' own action, which comes back here.
 */
export function MarkSoldForm({ conversationId, listingId, title }: { conversationId: string; listingId: string; title: string }) {
  return (
    <form action={changeListingState} className="thread-sale thread-sale-mark">
      <input type="hidden" name="listing" value={listingId} />
      <input type="hidden" name="to" value="sold" />
      <input type="hidden" name="tab" value="available" />
      <input type="hidden" name="thread" value={conversationId} />
      <button type="submit" className="btn btn-primary">
        Mark {title} as sold
      </button>
      <p className="form-hint">It moves to Sold in Your listings. Its page stays up and says Sold.</p>
    </form>
  );
}
```

- [ ] **Step 7: The thread.** In `components/messages/ThreadView.tsx`, import `MarkSoldForm` beside `SaleActions` (`import { MarkSoldForm, SaleActions } from "./SaleActions";`), add `import type { SaleToMark } from "@/lib/types";` to the types import (`import type { SaleToMark, Thread } from "@/lib/types";`), and add to `ThreadViewProps`:

```tsx
  /** The seller's sale whose listing is still up (role views N2), from the shop's queue; null otherwise. */
  markSold?: SaleToMark | null;
  /** "Marked as sold…", once, after the form above. */
  soldNotice?: string | null;
```

Destructure them with defaults (`markSold = null, soldNotice = null`) and render, right after `<SaleActions thread={thread} />`:

```tsx
      {soldNotice && (
        <p role="status" className="form-notice">
          {soldNotice}
        </p>
      )}
      {markSold && <MarkSoldForm conversationId={thread.id} listingId={markSold.listingId} title={markSold.title} />}
```

In `components/messages/OpenThread.tsx`, add the imports:

```tsx
import { shopSlugOf } from "@/lib/messaging/subjects";
import { takeNotice, threadSoldForm } from "@/lib/selling/form-state";
import { noticeText } from "@/lib/selling/notices";
import { queueFor } from "@/lib/selling/queue";
```

and replace the last two statements of `OpenThread` with:

```tsx
  const [sent, state, campuses] = await Promise.all([takeSentNote(id), readFormState(replyFormKey(id)), getCampuses()]);
  const campusSlug = thread.listing?.campusSlug ?? thread.shop.campusSlug;
  const campusName = campuses.find((campus) => campus.slug === campusSlug)?.name ?? "";
  // The seller's "Mark {title} as sold", exactly when the shop's queue lists this sale (role views N2 plan decision 3),
  // and its notice once. A failed queue read offers nothing.
  const shopSlug = thread.role === "seller" ? shopSlugOf(account) : null;
  const completed = thread.status === "done" || thread.status === "confirmed";
  const [queue, sold] = await Promise.all([
    shopSlug && completed ? queueFor(shopSlug).catch(() => null) : Promise.resolve(null),
    thread.role === "seller" ? takeNotice(threadSoldForm(id)) : Promise.resolve(null),
  ]);
  const markSold = queue?.sales.find((sale) => sale.conversationId === id) ?? null;
  return (
    <ThreadView
      thread={thread}
      now={now}
      reply={replyForm(state, id)}
      sent={sent}
      campusName={campusName}
      markSold={markSold}
      soldNotice={noticeText(sold?.notice)}
    />
  );
```

`takeNotice` reads through `readFormState` (mocked in `OpenThread.test.tsx` to give null), so the test needs no more mocks.

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run lib/selling components/messages components/forms && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 9: Commit (controller)**

```bash
git add lib/selling/form-state.ts lib/selling/listing-actions.ts lib/selling/listing-actions.test.ts components/messages/SaleActions.tsx components/messages/ThreadView.tsx components/messages/ThreadView.test.tsx components/messages/field-ids.test.tsx components/forms/summary-ids.test.tsx components/messages/OpenThread.tsx components/messages/OpenThread.test.tsx
git commit -m "feat(messaging): Mark {title} as sold in a selling thread once the sale is completed, back to the thread with its notice (role views N2 Task 12)"
```

---

### Task 13: The selling inbox's next step, and the owner's way back from the storefront

**Files:**
- Modify: `components/messages/InboxView.tsx`, `components/messages/InboxView.test.tsx`
- Modify: `components/seller/ViewerFollow.tsx`, `components/seller/ViewerFollow.test.tsx`

- [ ] **Step 1: Update the tests first.** In `components/messages/InboxView.test.tsx`, replace "tells a seller with no enquiries where they'll show up (plan decision 26)" with:

```tsx
  it("tells a seller with no enquiries where they'll show up, and offers the next step (role views spec 7.1)", () => {
    render(<InboxView tab="selling" hasShop conversations={[]} now={NOW} />);
    expect(screen.getByRole("heading", { name: "No enquiries yet" })).toBeInTheDocument();
    expect(screen.getByText("When a buyer messages your shop, it shows up here. A new listing brings buyers.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
    expect(screen.queryByRole("link", { name: "Browse" })).toBeNull();
  });
```

In `components/seller/ViewerFollow.test.tsx`, replace "is nothing for the shop's owner, who has Edit shop in the band" with:

```tsx
  it("gives the shop's owner the way back to their shop, in Follow's place (role views spec 7.1)", async () => {
    viewer.account = { id: "acc-seller", seller: { status: "approved", sellerSlug: "tech-corner" } };
    render((await ViewerFollow({ slug: "tech-corner", name: "Tech corner" }))!);
    expect(screen.getByRole("link", { name: "Back to your shop" })).toHaveAttribute("href", "/sell");
    expect(screen.queryByRole("button")).toBeNull();
  });
```

If the file doesn't mock `next/link`, the plain `<a>` jsdom draws is enough.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/messages/InboxView.test.tsx components/seller/ViewerFollow.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `components/messages/InboxView.tsx`, add `import { MessageIcon } from "@/components/icons";`, `import { EmptyState } from "@/components/kit/EmptyState";` and `import { NEW_LISTING_PATH } from "@/lib/selling/paths";`, and change `InboxEmpty`'s selling branch to:

```tsx
  if (tab === "selling") {
    return (
      <EmptyState
        icon={<MessageIcon />}
        title="No enquiries yet"
        line="When a buyer messages your shop, it shows up here. A new listing brings buyers."
        action={{ label: "New listing", href: NEW_LISTING_PATH }}
      />
    );
  }
```

In `components/seller/ViewerFollow.tsx`, add `import Link from "next/link";` and `import { SELL_PATH } from "@/lib/selling/paths";`, and replace `if (shopSlugOf(account) === slug) return null;` with:

```tsx
  // The owner's way back to the seller home (role views spec 7.1, Fixes), in the box Follow keeps for every viewer, so
  // nothing moves when it streams in. A white outline on the stars, as Unfollow.
  if (shopSlugOf(account) === slug) {
    return (
      <Link href={SELL_PATH} prefetch={false} className="btn seller-unfollow">
        Back to your shop
      </Link>
    );
  }
```

Update the component's comment: "…the shop's owner gets Back to your shop (F's Edit shop is in the band)…".

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/messages components/seller && pnpm typecheck`
Expected: PASS. If `components/seller/SellerHero.test.tsx` or `SellerView.test.tsx` checked that the owner's band has no link there, they use the stand-in in `tests/helpers/viewer-follow.tsx`; leave the stand-in alone unless a test fails, then make the stand-in match.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/messages/InboxView.tsx components/messages/InboxView.test.tsx components/seller/ViewerFollow.tsx components/seller/ViewerFollow.test.tsx
git commit -m "feat: the selling inbox's empty state offers New listing; the owner's storefront has Back to your shop (role views N2 Task 13)"
```

---

### Task 13b: Pending feedback on the seller's buttons (plan decision 17)

**Files:**
- Create: `components/kit/PendingButton.tsx`, `components/kit/PendingButton.test.tsx`
- Modify: `components/messages/SaleActions.tsx` (`MarkSoldForm`), `components/sell/MyListingsView.tsx` (`StateButton`), `app/globals.css`

- [ ] **Step 1: Write the failing test** `components/kit/PendingButton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PendingButton } from "./PendingButton";

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending, data: null, method: null, action: null }),
}));

describe("PendingButton (role views N2 plan decision 17)", () => {
  it("is a plain submit button named by its words while nothing is posting", () => {
    status.pending = false;
    render(<PendingButton pendingLabel="Marking as sold…">Mark Desk lamp as sold</PendingButton>);
    const button = screen.getByRole("button", { name: "Mark Desk lamp as sold" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it("says what is happening and takes no second press while its form posts", () => {
    status.pending = true;
    render(<PendingButton pendingLabel="Marking as sold…">Mark Desk lamp as sold</PendingButton>);
    const button = screen.getByRole("button", { name: "Marking as sold…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.closest("[aria-live]")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/kit/PendingButton.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `components/kit/PendingButton.tsx`:

```tsx
"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  children: ReactNode;
  /** What the button says while its form posts ("Marking as sold…"). */
  pendingLabel: string;
  className?: string;
};

/**
 * A form's submit button that says what's happening while the post is on its way, and ignores a second press then
 * (role views N2 plan decision 17). aria-disabled rather than disabled, so focus stays on it; the live region reads
 * the change. Without JavaScript it is a plain submit button.
 */
export function PendingButton({ children, pendingLabel, className }: PendingButtonProps) {
  const { pending } = useFormStatus();
  const ignore = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) event.preventDefault();
  };
  return (
    <span aria-live="polite" className="pending-button">
      <button type="submit" className={className} aria-disabled={pending || undefined} onClick={ignore}>
        {pending ? pendingLabel : children}
      </button>
    </span>
  );
}
```

Append to the N2 CSS block:

```css
  .pending-button {
    display: contents;
  }

  .pending-button [aria-disabled="true"] {
    opacity: 0.7;
    cursor: progress;
  }
```

- [ ] **Step 4: Use it.** In `components/messages/SaleActions.tsx`, import `PendingButton` from `@/components/kit/PendingButton` and replace `MarkSoldForm`'s button with:

```tsx
      <PendingButton className="btn btn-primary" pendingLabel="Marking as sold…">
        Mark {title} as sold
      </PendingButton>
```

In `components/sell/MyListingsView.tsx`, import it and replace `StateButton`'s button with:

```tsx
      <PendingButton className="sell-action" pendingLabel="Saving…">
        {label} <span className="sr-only">{row.title}</span>
      </PendingButton>
```

The idle names stay "Mark {title} as sold" and "Pause {title}", so every existing test and e2e lookup still finds them.

- [ ] **Step 5: Run the tests and check the chunks**

Run: `pnpm vitest run components/kit components/sell components/messages && pnpm typecheck && pnpm lint`
Expected: PASS.

Run: `pnpm build && grep -l "PendingButton\|useFormStatus" .next/static/chunks/*.js`
Expected: the chunks of the routes that use it (My listings and the thread). `/sell` doesn't import it; Task 15 records the bytes.

- [ ] **Step 6: Commit (controller)**

```bash
git add components/kit/PendingButton.tsx components/kit/PendingButton.test.tsx components/messages/SaleActions.tsx components/sell/MyListingsView.tsx app/globals.css
git commit -m "feat(kit): PendingButton says what's happening and takes no second press, on Mark as sold and the listing buttons (role views N2 Task 13b)"
```

---

### Task 14: End to end: the writes project, the home's checks, the existing specs, screenshots

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/role-views-writes.spec.ts`
- Modify: `tests/e2e/role-views.spec.ts`, `tests/e2e/role-views-screenshots.spec.ts` (both N1 Task 16), `tests/e2e/cls.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts` (lines 496–504), `tests/e2e/selling.spec.ts` (lines 124 and 129), `tests/e2e/staff.spec.ts` (line 95), `tests/e2e/staff-writes.spec.ts` (line 154)

- [ ] **Step 1: The project.** In `playwright.config.ts`, after `HOUSEKEEPING_WRITES`:

```ts
// Role views' writes (a new shop approved, a buyer's first message, a listing marked sold from its thread) run after
// every other test, so no count another test reads moves under them (role views spec 9; N2 plan, Task 14).
const ROLE_VIEWS_WRITES = /role-views-writes\.spec\.ts$/;
// Every write project's files: the device projects leave them all out.
const WRITES = [
  SELLING_WRITES,
  STAFF_WRITES,
  COMMUNITY_WRITES,
  ALERTS_WRITES,
  STAFF_ACCOUNTS,
  HARDENING_WRITES,
  HOUSEKEEPING_WRITES,
  ROLE_VIEWS_WRITES,
];
```

The five device projects become:

```ts
    { name: "phone-360", use: phone(360, 780), testIgnore: WRITES },
    { name: "phone-390", use: phone(390, 844), testIgnore: WRITES },
    {
      name: "tablet-768",
      use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true },
      testIgnore: WRITES,
    },
    { name: "laptop-1024", use: desktop(1024, 768), testIgnore: WRITES },
    { name: "desktop-1440", use: desktop(1440, 900), testIgnore: WRITES },
```

and after the `housekeeping-writes` project:

```ts
    // After everything else (role views spec 9). Run it alone with --project=role-views-writes --no-deps.
    {
      name: "role-views-writes",
      use: phone(390, 844),
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

- [ ] **Step 2: The writes spec** `tests/e2e/role-views-writes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { button, main, newBuyer, reply, sendFirstMessage, signUp } from "./helpers/messaging";
import { POST_LANDS, publishListing, uniqueWord } from "./helpers/selling";
import { applyToSell, newShopName, reviewShop, signedInPage, staffNotice } from "./helpers/staff";

// Role views N2's end to end that write (role views spec 7.1 and 9): a new shop's home from its checklist to All clear,
// a buyer waiting and its row, a sale marked as sold from its thread, and a paused listing's row. It runs last, in the
// role-views-writes project, with a shop, a buyer and listings of its own; the sample shops are only read.
// Every browser.newContext( here says serviceWorkers: "block" (CLAUDE.md).

const SHOTS = Boolean(process.env.SCREENSHOTS);

test("a new shop's home: the checklist, a buyer waiting, a sale marked as sold from its thread, then All clear", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const shopName = newShopName();
  await applyToSell(page, shopName);
  const admin = await signedInPage(browser, baseURL!, "Admin", "/admin/sellers");
  await reviewShop(admin, shopName);
  await button(admin, `Approve ${shopName}`).click();
  await expect(staffNotice(admin)).toContainText("Approved.", POST_LANDS);
  await admin.context().close();

  // The new shop's home (spec 7.1, New shop): no photo yet; about and a pickup point from the wizard.
  await page.goto("/sell");
  const checklist = main(page).getByRole("region", { name: "Get your shop going" });
  await expect(checklist).toContainText("2 of 5 done");
  await expect(main(page).getByRole("region", { name: "In the last 7 days" })).toHaveCount(0);
  await expect(main(page).getByText("All clear")).toBeVisible();
  expect(await seriousIssues(page), "the checklist").toEqual([]);
  if (SHOTS) await page.screenshot({ path: "docs/progress/role-views/n2-390-seller-new-shop.png", fullPage: true });

  // The skeleton is shorter than this, the shortest state (spec 9; plan decision 15). Its markup is SellSkeleton's.
  const home = main(page).locator(".sell-home").filter({ visible: true });
  const shortest = await home.evaluate((element) => element.getBoundingClientRect().height);
  const skeleton = await page.evaluate(() => {
    const box = document.createElement("div");
    box.className = "sell-column sell-home";
    box.innerHTML = '<span class="skeleton sell-skeleton-head"></span><span class="skeleton sell-skeleton-body"></span>';
    document.querySelector("main .sell-page")!.append(box);
    const height = box.getBoundingClientRect().height;
    box.remove();
    return height;
  });
  expect(skeleton, "SellSkeleton against a new shop's home").toBeLessThan(shortest);

  // The first listing ticks its step.
  const title = `Desk lamp ${uniqueWord()}`;
  const listingId = await publishListing(page, title);
  await page.goto("/sell");
  await expect(checklist).toContainText("3 of 5 done");

  // A buyer asks: the first row says so, the seller bar's Messages carries the same number, and the row opens Selling.
  const buyerContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const buyer = await buyerContext.newPage();
  await signUp(buyer, newBuyer());
  const threadId = await sendFirstMessage(buyer, listingId, "Is the lamp still available? I can collect today.");
  await page.goto("/sell");
  const waiting = main(page).getByRole("list", { name: "Needs you" }).getByRole("link", { name: /Buyer waiting for a reply/ });
  await expect(waiting).toHaveAccessibleName(new RegExp(`^1\\s*Buyer waiting for a reply\\s*Oldest: ${title}`));
  await expect(
    page.getByRole("navigation", { name: "Selling" }).getByRole("link", { name: "Messages" }),
  ).toHaveAccessibleDescription(/1\s+buyer waiting for a reply/);
  await waiting.click();
  await expect(page).toHaveURL(/\/messages\?tab=selling$/);
  await expect(main(page).getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");

  // The seller replies and marks it completed; the thread then offers Mark {title} as sold.
  await page.goto(`/messages/${threadId}`);
  await reply(page, "Yes, it's here.");
  await expect(main(page).getByText("Yes, it's here.").filter({ visible: true })).toBeVisible(POST_LANDS);
  await button(page, "Mark as completed").click();
  const markSold = button(page, `Mark ${title} as sold`);
  await expect(markSold).toBeVisible(POST_LANDS);

  // Published and replied: the numbers replace the checklist, and the sale's row opens this thread.
  await page.goto("/sell");
  await expect(main(page).getByRole("region", { name: "Get your shop going" })).toHaveCount(0);
  await expect(main(page).getByRole("region", { name: "In the last 7 days" })).toBeVisible();
  await main(page).getByRole("list", { name: "Needs you" }).getByRole("link", { name: /Sale to mark as sold/ }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${threadId}$`));
  if (SHOTS) await page.screenshot({ path: "docs/progress/role-views/n2-390-seller-mark-sold.png", fullPage: true });
  await markSold.click();
  await expect(
    main(page).getByRole("status").filter({ hasText: "Marked as sold. Its page stays up and says Sold." }),
  ).toBeVisible(POST_LANDS);
  await expect(markSold).toHaveCount(0);
  expect(await seriousIssues(page), "the thread after Mark as sold").toEqual([]);

  // Nothing waits now, and the listing is on Sold.
  await page.goto("/sell");
  await expect(main(page).getByText("All clear")).toBeVisible();
  await page.goto("/sell/listings?tab=sold");
  await expect(main(page).getByRole("link", { name: `Edit ${title}`, exact: true })).toBeVisible();

  // A paused listing has its own row, which opens the Paused tab.
  const second = `Kettle ${uniqueWord()}`;
  await publishListing(page, second);
  await button(page, `Pause ${second}`).click();
  await expect(main(page).getByRole("status")).toContainText("Paused.", POST_LANDS);
  await page.goto("/sell");
  await main(page).getByRole("list", { name: "Needs you" }).getByRole("link", { name: /Paused listing/ }).click();
  await expect(page).toHaveURL(/\/sell\/listings\?tab=paused$/);
  await expect(main(page).getByRole("link", { name: `Edit ${second}`, exact: true })).toBeVisible();
  await buyerContext.close();
});
```

`publishListing` (`tests/e2e/helpers/selling.ts:48`) fills a pickup at the shop's first point, which this shop has (Library entrance, from `applyToSell`). The paused notice's words are `noticeText("paused")`.

- [ ] **Step 3: The home's read-only checks.** Append to `tests/e2e/role-views.spec.ts` (add `holdFonts`, `recordShifts` and `expectStill` from `./helpers/shifts`, and `onlyAt` if not imported):

```ts
// N1 `/sell` main HTML, from Task 0 of the N2 plan: the home may add at most about 8 KB (spec 9).
const N1_SELL_MAIN_HTML = 0; // ← Task 0's number

test.describe("the seller home (role views N2, spec 7.1)", () => {
  test("its cards come in the spec's order, with New listing and Messages side by side", async ({ page }) => {
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    const home = main(page).locator(".sell-home").filter({ visible: true });
    await expect(home.getByRole("heading", { level: 1 })).toHaveText("Tech corner");
    const titles = await home
      .locator("section[aria-labelledby], section[aria-label]")
      .evaluateAll((sections) => sections.map((section) => section.querySelector("h2")?.textContent));
    expect(titles).toEqual(["Needs you", "In the last 7 days", "Enquiries, last 7 days", "Your badge", "Your listings"]);
    const newListing = await home.getByRole("link", { name: "New listing" }).boundingBox();
    const messages = await home.getByRole("link", { name: "Messages" }).boundingBox();
    expect(Math.round(newListing!.y)).toBe(Math.round(messages!.y));
  });

  test("the seller bar's Messages opens the inbox on Selling", async ({ page }) => {
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    await bar(page, "Selling").getByRole("link", { name: "Messages" }).click();
    await expect(page).toHaveURL(/\/messages\?tab=selling$/);
    await expect(main(page).getByRole("link", { name: "Selling" })).toHaveAttribute("aria-current", "page");
  });

  test("Your listings' four segments stay on one line at 360px, and its targets are 44px or more", async ({ page }) => {
    onlyAt("phone-360");
    await signInAsSample(page, "Seller, Tech corner", "/sell/listings");
    const nav = main(page).getByRole("navigation", { name: "Listings by state" });
    const segments = nav.getByRole("link");
    await expect(segments).toHaveCount(4);
    const tops = await segments.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
    expect(new Set(tops).size, "one line").toBe(1);
    expect(
      await nav.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          [...element.querySelectorAll("a")].every((link) => link.scrollWidth <= link.clientWidth),
      ),
      "nothing cut off or scrolled",
    ).toBe(true);
    const heights = await main(page)
      .locator(".link-segment, .list-row, .sell-action, .mylist-delete")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  test("the Delete page leads back to Your listings, and the owner's storefront back to the shop", async ({ page }) => {
    await signInAsSample(page, "Seller, Tech corner", "/sell/listings/l-001/delete");
    await expect(main(page).getByRole("link", { name: "Your listings" })).toHaveAttribute("href", "/sell/listings");
    await expect(page).toHaveTitle("Delete your listing · CampusCart");
    await page.goto("/sellers/tech-corner");
    await expect(page.getByRole("link", { name: "Back to your shop" }).filter({ visible: true })).toHaveAttribute("href", "/sell");
    await page.goto("/sell/listings");
    await expect(page).toHaveTitle("Your listings · CampusCart");
  });

  test("the skeleton is shorter than the pitch and the waiting page", async ({ page }) => {
    const skeletonAndPage = () =>
      page.evaluate(() => {
        const column = document.querySelector<HTMLElement>("main .sell-page > .sell-column")!;
        const box = document.createElement("div");
        box.className = "sell-column sell-home";
        box.innerHTML = '<span class="skeleton sell-skeleton-head"></span><span class="skeleton sell-skeleton-body"></span>';
        column.parentElement!.append(box);
        const sizes = [box.getBoundingClientRect().height, column.getBoundingClientRect().height];
        box.remove();
        return sizes;
      });
    await page.goto("/sell");
    await expect(main(page).getByRole("link", { name: "Start selling" })).toBeVisible();
    const [skeleton, pitch] = await skeletonAndPage();
    expect(skeleton).toBeLessThan(pitch);
    await signInAsSample(page, "Seller waiting for approval", "/sell");
    const [again, waiting] = await skeletonAndPage();
    expect(again).toBeLessThan(waiting);
  });

  test("no serious or critical accessibility issues on the home, Your listings and an empty tab", async ({ page }) => {
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    expect(await seriousIssues(page), "/sell").toEqual([]);
    for (const path of ["/sell/listings", "/sell/listings?tab=drafts"]) {
      await page.goto(path);
      await expect(main(page).getByRole("navigation", { name: "Listings by state" })).toBeVisible();
      expect(await seriousIssues(page), path).toEqual([]);
    }
  });

  test("the home and Your listings hold still on a short phone (375×667)", async ({ page }) => {
    onlyAt("phone-390");
    await page.setViewportSize({ width: 375, height: 667 });
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, "seller home at 375x667", "/sell");
    await expectStill(page, "Your listings at 375x667", "/sell/listings");
  });

  test("the home adds under about 8 KB of HTML (spec 9)", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    await expect(main(page).getByRole("region", { name: "Your listings" })).toBeVisible();
    const size = await main(page).evaluate((element) => element.outerHTML.length);
    console.log(`seller home main HTML: ${size} (N1: ${N1_SELL_MAIN_HTML})`);
    expect(size).toBeLessThanOrEqual(N1_SELL_MAIN_HTML + 8 * 1024);
  });
});
```

`expectStill` is cumulative per page load, and `recordShifts` keeps one list per document, so the second `expectStill` measures its own load. If the second call reports the first page's shifts too, split it into its own test.

Set `N1_SELL_MAIN_HTML` from Task 0 before running. The bar helper `bar` and `main`, `signInAsSample`, `seriousIssues` and `onlyAt` are N1's imports in this file.

- [ ] **Step 4: Screenshots.** Append to `tests/e2e/role-views-screenshots.spec.ts`:

```ts
// Role views N2 (spec 9): the seller home and the pages its fixes touched, read only. The new shop's checklist and the
// Mark as sold thread are taken by role-views-writes.spec.ts with SCREENSHOTS=1.
const N2_SHOTS = [
  ["seller-home", "Seller, Tech corner", "/sell"],
  ["seller-listings", "Seller, Tech corner", "/sell/listings"],
  ["seller-listings-empty", "Seller, Tech corner", "/sell/listings?tab=drafts"],
  ["seller-delete", "Seller, Tech corner", "/sell/listings/l-001/delete"],
  ["storefront-owner", "Seller, Tech corner", "/sellers/tech-corner"],
  ["seller-waiting", "Seller waiting for approval", "/sell"],
] as const;

for (const [name, label, path] of N2_SHOTS) {
  test(`role views N2: ${name}`, async ({ page }) => {
    const width = test.info().project.name.split("-").pop();
    test.skip(!["390", "1440"].includes(width!), "390 and 1440 only");
    await signInAsSample(page, label, path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `docs/progress/role-views/n2-${width}-${name}.png`, fullPage: true });
  });
}
```

- [ ] **Step 5: Layout shift on a slow network.** In `tests/e2e/cls.spec.ts`, add to `SLOW_PAGES`, after the inbox rows:

```ts
  // Role views N2: the seller home's cards stream in under a short skeleton, on a screen-tall page (plan decision 15).
  ["seller home", "/sell", "Seller, Tech corner"],
  ["Your listings", "/sell/listings", "Seller, Tech corner"],
  ["Your listings, an empty tab", "/sell/listings?tab=drafts", "Seller, Tech corner"],
```

The fast rows already measure `/sell` and `/sell/listings` signed in (lines 44–49).

- [ ] **Step 6: The existing specs' words.**

`tests/e2e/a11y.spec.ts`, lines 496–504:

```ts
  await expect(page.locator("main .list-row").filter({ visible: true })).toHaveCount(2);
  expect(await seriousIssues(page)).toEqual([]);
  for (const [tab, empty] of [
    ["paused", "Nothing paused"],
    ["sold", "Nothing sold yet"],
    ["drafts", "No drafts"],
  ]) {
    await page.goto(`/sell/listings?tab=${tab}`);
    await expect(page.locator("main").getByRole("heading", { name: empty })).toBeVisible();
```

`tests/e2e/selling.spec.ts`: line 124 becomes `await expect(main(page).getByText("Live", { exact: true })).toBeVisible();` and line 129 becomes `await main(page).getByRole("link", { name: "Manage listings" }).click();`.

`tests/e2e/staff.spec.ts`, line 95: `await expect(main(page).getByText("Live", { exact: true }).filter({ visible: true })).toBeVisible();`

`tests/e2e/staff-writes.spec.ts`, line 154: `await expect(main(owner).getByText("Paused by the Hub", { exact: true }).filter({ visible: true })).toBeVisible();`

Then look for any other lookup of the old words:

```bash
grep -rn "Your shop is live\|buyers can't see your listings\|follows your shop\|follow your shop\|Your shop's pages\|Messages from buyers\|sell-item\b\|Nothing paused\.\|No drafts\.\|No enquiries yet\. When" tests/e2e
```
Expected: only the "Paused by the Hub: buyers can't see your listings" lines about My listings' banner (still true there) and nothing else. Change any other hit to the new words.

- [ ] **Step 7: Run the new and changed specs**

```bash
pnpm build && pnpm e2e tests/e2e/role-views.spec.ts tests/e2e/selling.spec.ts tests/e2e/a11y.spec.ts tests/e2e/staff.spec.ts tests/e2e/messaging.spec.ts --reporter=line
```
Expected: all pass at 360, 390, 768, 1024 and 1440.

```bash
E2E_REUSE_SERVER=1 pnpm e2e --project=role-views-writes --no-deps --reporter=line
```
(with your own `pnpm start --port 3200` running from the same build; stop it by PID after)
Expected: 1 passed.

- [ ] **Step 8: Commit (controller)**

```bash
git add playwright.config.ts tests/e2e/role-views-writes.spec.ts tests/e2e/role-views.spec.ts tests/e2e/role-views-screenshots.spec.ts tests/e2e/cls.spec.ts tests/e2e/a11y.spec.ts tests/e2e/selling.spec.ts tests/e2e/staff.spec.ts tests/e2e/staff-writes.spec.ts
git commit -m "test: role views N2 end to end (the role-views-writes project: a new shop to All clear, mark sold from its thread; the home's order, segments at 360px, back links, axe, 375x667, HTML size) and screenshots"
```

---

### Task 15: The gates

**Files:** none changed unless a gate fails. Results go into "Changes made during the build".

- [ ] **Step 1: Unit, types, lint, database**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: clean; every unit test passes. Write the count down.

```bash
supabase db reset && supabase test db && pnpm test:db
```
Expected: every pgTAP file and every database contract passes.

- [ ] **Step 2: First-visit JS inside the budget, recorded against the baseline (spec §3 and §9)**

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --reporter=line
```
Expected: every page at 150 KB or under (the spec's own assertions). Write each page's `scriptBrotli`, public and signed in, beside Task 0's in "Changes made during the build". Any page that grew by more than 1 KB gets a one-line reason in the progress entry (Task 16). Expected growth: My listings and the thread page by `PendingButton`'s chunk (a few hundred bytes); `/sell` and every public page by about 0, since `/sell` doesn't use it (plan decision 17). If a public page grew, find the import that pulled code into its chunk (`.next/static/chunks` against the Task 0 build) and say why, or remove it if it buys nothing.

```bash
grep -rln "use client" components/sell components/kit components/charts components/messages components/seller lib/selling
```
Expected: Task 0's list plus `components/kit/PendingButton.tsx`, nothing else.

```bash
grep -l "serviceWorker.register" .next/static/chunks/*.js
```
Expected: no output.

```bash
grep -rn "newContext(" tests/e2e | grep -v serviceWorkers
```
Expected: no output.

- [ ] **Step 3: Layout shift at 390 and 1440 (spec 9)**

```bash
pnpm e2e tests/e2e/cls.spec.ts --project=phone-390 --project=desktop-1440 -g "sell|listings|storefront|inbox|thread" --reporter=line
```
Expected: every row 0.05 or less. With the 375×667 rows from Task 14, the short-phone gate is covered.

- [ ] **Step 4: The whole suite once**

```bash
pnpm e2e --reporter=line
```
Expected: every project passes, `role-views-writes` last. Write the counts down.

- [ ] **Step 5: Screenshots**

```bash
SCREENSHOTS=1 pnpm e2e tests/e2e/role-views-screenshots.spec.ts --project=phone-390 --project=desktop-1440 -g "N2" --reporter=line
```
Expected: 12 PNGs named `n2-390-…` and `n2-1440-…` in `docs/progress/role-views/`; the two from the writes spec are there if Step 4 ran with `SCREENSHOTS=1` (run `SCREENSHOTS=1 E2E_REUSE_SERVER=1 pnpm e2e --project=role-views-writes --no-deps` to take them).

- [ ] **Step 6: Commit (controller)**

```bash
git add docs/progress/role-views
git commit -m "docs: role views N2 screenshots (the seller home, Your listings, the Delete page, the owner's storefront, a new shop, Mark as sold)"
```

---

### Task 16: Docs

**Files:**
- Modify: `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`, and this plan's "Changes made during the build"

- [ ] **Step 1: CLAUDE.md.** Add to "Code rules", after N1's role-views bullets:

```markdown
- The seller's queue (`sellerQueue`, `lib/data/seller-queue.ts`; on Supabase the owner-only `public.seller_queue`) is read through `queueFor` (`lib/selling/queue.ts`, React `cache`, once per request), never cached across requests: the seller bar's Messages badge, the `/sell` home's Needs you and a selling thread's "Mark {title} as sold" all read it, so they always agree. A sale waits to be marked sold while its listing is an available item, not hidden, unchanged since the sale was marked completed.
- "Mark {title} as sold" posts `thread` to `changeListingState`, which goes back to `threadPath(thread)` only for an id that passes `isId`, and leaves its notice under `threadSoldForm(id)`. No one-time token: marking sold twice changes nothing.
- The `/sell` home's cards each stand on their own reader (`Promise.all` with `.catch(() => null)`): a failure shows that card's `SectionError` and leaves the rest.
- End-to-end tests for the role views' writes (a new shop approved, a buyer's message, mark sold from a thread; N4's mentor notification) go in `tests/e2e/role-views-writes.spec.ts`, which runs last, in the `role-views-writes` project, after `housekeeping-writes`. `playwright.config.ts`'s `WRITES` lists every write project's files; a new one joins it.
```

Change the selling line "The listing form's `PhotoField` is the only selling client component" to: "The listing form's `PhotoField` and `PendingButton` (`components/kit/PendingButton.tsx`, on My listings' buttons and a thread's Mark as sold) are the only client components on selling pages; `/sell` itself has none (the header prefetches it on every page)."

Add to "Privacy (POPIA)":

```markdown
- The seller home shows how many follow the shop and how many follows made in the last 7 days still stand (`followerCounts`; on Supabase the owner-only `public.follower_counts`), never who.
```

- [ ] **Step 2: The decisions log.** Read the table's last row first (N1 adds 84). Add row 85 in the table's own columns:

```markdown
| 85 | 2026-10-2X | Role views N2: the seller home (role views spec 7.1; plan decisions 1 to 17) | **`/sell` opens on Needs you (buyers waiting with an age chip, warning from 24h and danger from 48h; sales to mark as sold; drafts; Hub-hidden; paused), then New listing and Messages, the week against the week before, enquiries by SAST day, the reply rate against the next badge, and listings by state; a new shop sees a five-step checklist (four where the campus has no pickup points) in place of the numbers. A sale waits to be marked sold while its listing is an available item, not hidden, unchanged since the sale; "Mark {title} as sold" in the thread marks it, with no token. The seller bar's Messages badge counts buyers waiting, from the same reader. Your listings is segments and rows with Delete apart; empty tabs and the empty selling inbox offer New listing; the Delete page and the owner's storefront have a way back** | Plan `docs/superpowers/plans/2026-10-22-role-views-n2-seller.md`. New readers on both backends with one contract (`sellerQueue`, `recentCounts.previous`, `dailyEnquiries`, `followerCounts`); `public.seller_queue` and `public.follower_counts` owner-only, with pgTAP. JS inside the 150 KB budget, each page recorded against the baseline; `PendingButton` is N2's one client addition (pending words and no double posts on Mark as sold and the listing buttons). Open for Lama: the plan decisions, the thresholds and the sample words. |
```

- [ ] **Step 3: PROGRESS.md.** Add "## 2026-10-2X: Role views N2 built (the seller home)" before "## Next", in the style of the sections above it:
- what's built (the home, the readers and SQL, the fixes);
- where the build differed from the plan;
- checks: unit count, pgTAP and database contract counts, e2e counts per project, each page's JS against Task 0 with a one-line reason for any page up more than 1 KB, the layout shift rows, the HTML size against N1;
- open points for Lama: plan decisions 1 to 17, the thresholds (24h, 48h), the checklist's steps, the sample words, the screenshots in `docs/progress/role-views/n2-*`.

Update "## Next": "N3, the admin's Today page, can be planned."

- [ ] **Step 4: Fill in "Changes made during the build"** below, one bullet per departure, each with its commit, and this one for N4 (plan review fix 4):
  - "For N4: `lastSastDays` is in `lib/time.ts`; `dailyOver` (per-day counting) is in `lib/data/shop-stats.ts`; `recentCounts` returns `RecentCounts`; the mentor's readers wrap it in `currentOf`. Reuse these, don't redeclare them."

- [ ] **Step 5: Commit (controller), with Lama's go-ahead**

```bash
git add CLAUDE.md docs/reference/LANDING-DECISIONS.md docs/PROGRESS.md docs/superpowers/plans/2026-10-22-role-views-n2-seller.md
git commit -m "docs: role views N2 built: CLAUDE.md rules for the seller's queue, Mark as sold and the role-views-writes project; decision 85; progress"
```

Stage only these lines if other sessions have uncommitted lines in PROGRESS or the decisions log (`git add -p` there, never `git add .`).

---

## Self-review against the spec

| Spec point | Where |
|---|---|
| §3 and §9 JS: every page inside 150 KB, recorded against the baseline, a reason for any page up more than 1 KB; Server Components by default | Rules; plan decision 17; Task 0 Step 2; Task 15 Step 2 (performance spec, `use client` grep); Task 16's progress entry |
| §3 privacy: no view counts, followers a number only, account-scoped reads | Plan decision 10; Task 3; Task 5 (`follower_counts` owner-only, pgTAP "never who"); Dashboard has no view counts |
| §3 brand: sky never carries text; data marks navy or sky-dark | `Pill tone="live"` (N1's solid sky, navy text); SplitBar navy/sky-dark/muted/idle; links sky-dark; Delete danger red; Task 9 CSS |
| §3 both backends, contract tests | Tasks 2, 3, 4, 6 (`seller-home.contract.ts` on both; stats contract updated) |
| §3 house rules (Suspense, no clock while prerendering, SAST, 44px, motion, `wide:`/`desk:`) | SellHome after `connection()`; `lastSastDays`; Task 14 Step 3's 44px check; no motion added; CSS uses the `wide:` media query only |
| §4.2 badge from the list's reader, failed badge shows nothing, 99+, words | Task 10 (`queueFor`, `.then(…, () => null)`, N1's `SectionBar` caps and describes); `sell-badge.test.tsx` |
| §6 `sellerQueue` (asked + buyer last, offers out, sales to mark, drafts, hidden, paused, oldest each; feeds the bar's badge) | Plan decisions 1–3; Tasks 4, 5, 6, 10 |
| §6 `recentCounts` + `previous`, no second call | Plan decision 9; Task 2 (`recentOver` one pass; the twin's per-request `cache`) |
| §6 `dailyEnquiries` by SAST day, null before the shop | Task 2 (`dailyOver`, `lastSastDays`); contract and parity in Task 6 |
| §6 SQL functions with pgTAP | Task 5 (`seller_queue`, `follower_counts`, owner-only, anon refused, allowlist updated) |
| §7.1 items 1–8 in order | Task 9 (`Dashboard`), order test in `Dashboard.test.tsx` and Task 14 Step 3 |
| §7.1 age chip warning at 24h | Plan decision 7; `waitChip`; tests in Tasks 7, 9 |
| §7.1 Followers "+N new this week", follows that still stand | Task 3; `newFollowersLine` |
| §7.1 badge RatioBar vs the next badge's threshold, line under it | `replyRateTarget`; badge card; `badgeProgress` line |
| §7.1 Listings SplitBar with "Manage ›" | Listings card, action "Manage listings" |
| §7.1 New shop checklist (photo, about, pickup, first listing, first reply) replacing Numbers/Chart/Badge | Plan decision 6; `setupSteps`, `isNewShop`; tests in Tasks 7, 9; e2e in Task 14 |
| Fixes: My listings segments on one line at 360px, rows as ListRow | Plan decision 12; Tasks 8, 11; Task 14 Step 3 (360px check) |
| Fixes: Delete a text link set apart, never next to Mark sold | Task 11 (`.mylist-delete` outside `.mylist-actions`), test |
| Fixes: every empty tab an EmptyState with New listing | Task 11 |
| Fixes: "Mark {title} as sold" after Mark as completed, via `changeListingState` | Plan decisions 3, 4; Task 12; e2e in Task 14 (`role-views-writes`) |
| Fixes: selling inbox empty state's next step | Task 13 |
| Fixes: back links on Delete and the owner's storefront | Task 11 (Delete crumb), Task 13 ("Back to your shop"), Task 14 check |
| Fixes: seller titles say "Your" | Plan decision 13; Task 11 |
| Inbox opens on Selling from the seller bar | N1's `/messages?tab=selling`; Task 14 Step 3 check; writes spec |
| §8 a failed reader shows its card's error; other cards and bars work | Task 9 (`.catch(() => null)` per reader, `SectionError`), test |
| §8 only a shop's account sees the seller bar; waiting/declined without Messages | N1's `SellBar`, kept in Task 10 (no queue read for a pending shop) |
| §8 SAST from `now` at request time | `connection()` then `new Date()` in SellHome and OpenThread; `waitChip`, `dayLabels` take `now` |
| §8 a shop with no history shows the checklist, never empty charts | `isNewShop`; Sparkline writes words for small numbers |
| §9 unit, contract, pgTAP | Tasks 1–13 |
| §9 e2e at 360/390/768/1440, Needs-you rows open the right item, axe, writes in `role-views-writes` after `housekeeping-writes`, `serviceWorkers: "block"` | Task 14; Task 15 Step 2's grep |
| §9 screenshots in `docs/progress/role-views/` with `SCREENSHOTS=1` | Task 14 Step 4, writes spec; Task 15 Step 5 |
| §9 gates: JS, layout shift 390/1440 and 375×667, skeleton ≤ shortest state, HTML under ~8 KB | Task 15; Task 14 Steps 2, 3, 5 |
| §10 progress entry, decisions row, CLAUDE.md | Task 16 |

**Not in N2, on purpose:** N1 owns the kit, the bars and the transitions; the mentor's 14-day comparison waits for N4 (`currentOf` keeps today's numbers); `/messages` stays outside the section bars (spec §11).

**Open questions for Lama** (besides the plan decisions): **plan decision 8 departs from spec §4.2**: the Messages badge counts buyers waiting for a reply, while the selling tab it opens lists every conversation, so the badge equals the home's Needs-you row, not the list's length; the alternatives are a badge of unread selling conversations, or opening a filtered "waiting" view; whether "Sales to mark as sold" should also ignore sales older than some age (this plan relies on "unchanged since the sale" instead); whether the selling inbox's next step should be "Share your shop" rather than "New listing"; whether `/sell`'s tab title should say "Your shop" for sellers (it would need `generateMetadata` reading the session, which CLAUDE.md allows here).

---

## Changes after plan review

1. **Task 11** updates `components/sell/MyListings.test.tsx:40`, which looked for the old `.sell-item-title` line; it now finds the row's "Edit Casio fx-991ZA Plus calculator" link. The file joins Step 1 and the commit.
2. **Task 12** mocks `@/lib/selling/listing-actions` (`changeListingState`) in `ThreadView.test.tsx` and `field-ids.test.tsx`, and adds `changeListingState` to `summary-ids.test.tsx:62`'s mock, since `SaleActions.tsx` now imports that "use server" module. All three are in Step 9's commit.
3. **Plan decision 3:** a Hub hide or Show again counts as a change to the listing. Supabase already sets `updated_at = now()` in `hide_listing` and `show_listing`; Task 4 Step 3b makes the sample's `hideListing` and `showListing` set `updatedAt` (`showListing` takes `now`; its callers and tests updated), and Task 6's contract checks it on both backends (a sale waiting, hidden, shown again: nothing to mark).
4. **Task 16 Step 4** carries a note for N4: reuse `lastSastDays`, `dailyOver`, `RecentCounts` and `currentOf`.
5. **Plan decision 8** (the badge counts buyers waiting, while the tab lists every conversation) is now an open question for Lama, as a departure from spec §4.2.
6. **`public.seller_queue(p_slug text)`** finds the shop by its link inside the function and still gates on `private.owns_shop`; the twin makes one call. pgTAP calls it by link and adds "no shop by that link is null" (20 tests); the allowlist says `seller_queue(text)`.
7. **Task 9 Step 10's** dead-CSS grep also covers `.sell-list`, `.sell-item`, `.sell-item-actions` and `.sell-action-danger`; `.sell-item`, `.sell-item-alone` and `.sell-action-danger` stay for the Delete page and the photo field, and `ListingSummary` keeps `.sell-item-title` and `.sell-item-meta`.
8. **Task 2 Step 1** quotes the replaced test's full name and line (`lib/data/shop-stats.test.ts:91`).
9. **`sell-badge.test.tsx`** restores real timers after each test.
10. **Your listings' header** no longer has New listing: the button comes with the listings, above the rows, or as an empty tab's own button, so it is never there twice.
11. **JavaScript (Lama's rule of 2026-10-22):** the byte-for-byte gate is gone. Every page stays inside the 150 KB budget, each is recorded against Task 0's baseline, and any page up more than 1 KB gets a one-line reason in the progress entry (Goal, Rules, Task 0 Step 2, Task 15 Step 2, decisions row, coverage table). Revisited: the seller's buttons were plain forms only to save bytes; plan decision 17 and Task 13b add `PendingButton` (pending words, no double posts, read aloud) to Mark as sold and My listings' buttons. `/sell` stays without client code, since the header prefetches it on every page.

## Changes made during the build

- **Baseline (Task 0):** _to be filled in by the implementer: each page's `scriptBrotli`, public and signed in, and the N1 `/sell` main HTML length._
