# Role views N5: "You", the buyer's hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/account` into "You": a greeting, a For you queue (unread messages, new offers, new saved-search matches, followed shops' new listings), a closing-soon banner, Your stuff, and Settings, with Edit details moved to `/account/details`; make the You tab's badge the sum of For you from the same reader; add `listOwnBookings` on both backends; and land the four small fixes (Looking For in the menu, "Your requests (N open)" on the board, the dead `savedItemsBack` gone, a notifications line on the home strip), and the header's quick links gain Looking For; the header icon and the You tab share one count. JS rule (Lama, 2026-10-22): every page stays inside the 150 KB first-visit JS budget; each page's number is recorded against the stage baseline (Task 0); any page that grows by more than 1 KB gets a one-line reason; small client costs are fine when they buy function, accessibility or smoothness.

**Architecture:** Every new piece is a Server Component or a plain function. `lib/you/model.ts` holds the pure parts (For you's items and their sum, Your stuff's numbers and words); `lib/you/read.ts` reads them (`readForYou`, cached per request with React's `cache`, shared by the You page and the tab's badge; `readYourStuff`). Two new data readers have sample and Supabase versions with contract tests: `newNotificationsByKind` (unread notifications of some kinds, grouped) and `listOwnBookings` (upcoming RSVPs and slot requests). The page uses N1's kit (`Card`, `NeedsYouList`, `Banner`, `ListRow`, `PageTransition`). Looking For joins the menu drawer's and the header's own link lists (both client components, a few bytes each); the strip's lines are drawn on the server and passed into `ContextStripView` as a node, because that keeps the words and the link in one testable server file.

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, TypeScript, Tailwind CSS 4.3 with component CSS in `app/globals.css`, Vitest 5 + Testing Library, Playwright + axe, Supabase (local stack for `pnpm test:db`).

**Spec:** `docs/superpowers/specs/2026-10-22-role-views-design.md` (sections 3, 4.3, 6's `listOwnBookings` row, 7.4 with its "Fixes in N5", 8, 9 and the N5 row of 10).

---

## Rules for whoever builds this

- **N1 must be built first,** as `docs/superpowers/plans/2026-10-22-role-views-n1-kit.md` writes it: `components/kit/{Card,Banner,ListRow,NeedsYouList,PageTransition}.tsx`, the new icons (`AlertIcon`, `InfoIcon`, `CalendarIcon`, `StoreIcon`, `GridIcon`), and the tab bar's "You" label. Task 0 checks. N2 to N4 are not needed.
- **Commits:** implementers leave their work uncommitted. The controller checks each task and commits it, only with Lama's go-ahead for the stage (project memory, CLAUDE.md). Every "Commit" step below is for the controller.
- **One git command at a time.** Run `git status` before any git command, as a separate call. Stage only this stage's files (other sessions share the tree): never `git add .`.
- **Stop only your own server** (by PID or port), never `pkill` by name. Never kill an install or a build mid-flight.
- **JS (Lama, 2026-10-22):** every page stays inside the 150 KB first-visit JS budget; each page's number is recorded against the stage baseline (Task 0); any page that grows by more than 1 KB gets a one-line reason. Small client costs are fine when they buy function, accessibility or smoothness; nothing here is contorted to save bytes. This stage edits three client files: `components/menu/MenuDrawer.tsx` (Task 8), `components/header/SiteHeader.tsx` (Task 11) and `components/home/ContextStripView.tsx` (Task 10). It adds no new client component.
- Never write a font name, a hex colour, `md:` or `lg:` in a component. Sky never carries text, icons or thin lines on white; on the navy strip, small text is white.
- No `Date.now()`, `new Date()` or `Math.random()` in anything that can prerender. Every reader here runs after `getViewer()` or `requireAccount()` found an account, which awaited `connection()` (decision 26).
- Touch targets at least 44px. `ListRow` (56px) and `NeedsYouList` rows (48px) already are.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` before Task 7 if `transitionTypes` or `prefetch` behaves unexpectedly.

## Plan decisions (where this plan narrows or departs from the spec; Lama to confirm at plan review)

1. **For you's offers row counts new offers, not all offers.** The spec says "offers on my requests (`listOwnRequests` with `offerThreadCount`)". A total never goes down while a request is open, so the You badge would stay lit for as long as anyone had offered. The row counts unread `offer` notifications instead (the asker gets one per new offer, `lib/data/messages.ts:303`, and opening its thread reads it). With one, the row opens that thread; with several, Your requests. The Your requests row in Your stuff shows open and closed counts, as the spec asks. An unread offer notification always has its own unread thread (`startOffer`, `lib/data/messages.ts:276-310`, writes the shop's message and the notification together; opening the thread reads both, `markConversationNotificationsRead`, `lib/data/notifications.ts:137-149`), so the messages row counts `conversations - offers` (never below 0) and a new offer counts once, in the offers row. `ForYou.conversations` and Your stuff's Messages "N unread" stay the raw count.
2. **Matches and new listings link to Notifications.** Opening Notifications is what reads them (spec 7.4: "Showing these doesn't mark them read; opening Notifications still does"), so the row clears the badge. Linking to the listing would leave the badge lit.
3. **"on this device", not "on this phone".** The You page is the same at 1440px, where "phone" is wrong.
4. **Messages and Notifications rows head Your stuff.** The spec's list leaves them out, but the old Account rows were the only way to an empty inbox or the notifications list on a phone. They show "2 unread" and "3 new" from the same `readForYou` read.
5. **Students without a shop get no "Start selling" row** (spec: "Your shop: shown only to sellers"). The Sell tab and `/sell`'s pitch remain the way in.
6. **Staff tools are all three `AREA_HOME` rows** (`lib/staff/paths.ts:41`): Admin console, Hub posts and office hours, Mentor dashboard, by role, none prefetched (`ListRow` never prefetches). The spec named only `/admin` and `/mentor`; dropping the Hub's row would hide a tool mentors use.
7. **The header's account icon and the You tab share one count: For you's sum.** Spec 4.3 named only the tab, but two numbers on one account (For you on phones, all new notifications from the tablet step) would read as a bug when someone switches devices, and the icon leads to the same page. `HeaderAccount` reads `readForYou` (one read per request, shared with the tab and the page) and describes the icon "3 things for you" (Task 5b). Notifications keeps its own count on its You row and on the home strip. `AccountLink` is a server component, so this costs no client code.
8. **The banner uses the reminder's words and window.** "Your request {title} closes automatically on {24 Oct}." (as `requestCloseReminderText` and Your requests say it), shown from the reminder day to the day before the closing day (`closesSoon`, built on `reminderDay`), whether or not the reminder has been sent. With several, "2 of your requests close automatically soon, the first on 24 Oct."
9. **`listOwnBookings` needs no SQL.** RSVPs, and each office hours' newest slot request in any status (declined included, so the answer shows), for published posts whose SAST day hasn't passed, soonest first. On Supabase it reads `hub_rsvps`, `hub_bookings` and `hub_posts` with the student's own session, whose policies already limit a student to their own rows and to published posts; so there is no new function and no new pgTAP test, and the contract test proves another account's bookings never show. RSVPs and slot requests are already in the data download (`lib/data/accounts.ts:224-225`), so the export doesn't change.
10. **Looking For is in the header's quick links** (Task 11, required). The list sits inside `SiteHeader`, a client component, so the link adds a few bytes to every page (estimated 25 to 40 B brotli), well inside the rule above.
11. **Looking For in the menu sits beside Hub,** in `MenuDrawer`'s own list (Task 8), where a reader looks for it. (An earlier draft used the drawer's server `account` slot to save bytes, which put it after Safety.)
12. **The strip's lines are drawn on the server,** in `ActivityLines`, and passed to `ContextStripView` as a node. Kept on its merits, not for bytes: the counted words and the new Notifications link live in one server file with plain unit tests, the client view only places them, and the homepage's JS happens to get a little smaller. Recorded against the baseline like every page.
13. **The heading is "Hi, {first name}", streamed.** The page's static shell is its skeleton; the `h1` arrives with the content (as on the staff pages). The tab title is "You". The email, campus, Hub role and "Member since" card moves with the form to `/account/details` ("Your details"). The `h1` keeps the class `account-title`, which `tests/e2e/sign-in-return.spec.ts` uses as its marker. The greeting is one text node (`{`Hi, ${firstName}`}`), so tests can find "Hi, Thandi" in the document.
14. **`readForYou(accountId)` takes no `now`** and reads the clock itself, so React's `cache()` can share one read between the page and the tab in a request. It is only called after `getViewer()` found the account. The tab now makes two reads per signed-in page (`my_unread_counts` and one notifications select on Supabase) where it made one count. Like the header's badge, the tab sits in the root layout, which isn't drawn again on a client navigation: the badge is as fresh as the last full page load or form post (messaging plan decision 11), so it can lag the You page until then.
15. **The badge says "3 things for you"** (its description; the tab's name stays "You"), capped at "99+" like `NeedsYouList`.
16. **"Your requests (N open)" shows only with at least one open request,** beside Post a request, in its own `<Suspense fallback={null}>`. The button holds the row at 44px, so nothing moves when the link arrives.
17. **The 8 KB HTML gate is measured on `.you-body`'s HTML** for the Admin sample account (the most rows), in `tests/e2e/you.spec.ts`.
18. **The badge-and-reply e2e test writes,** so it goes in `tests/e2e/role-views-writes.spec.ts` in the `role-views-writes` project (spec 9). Task 13 creates the project if N2 to N4 haven't.
19. **The strip's notifications line counts every new notification,** the same number as You's Notifications row (the header icon now shows For you, decision 7). **For Lama, because it changes who gets the signed-in strip:** `worthShowing` now counts notifications, so an account whose only news is a notification (a staff role, a report outcome, a booking answer) gets "Welcome back" where it used to get the trust or recently-viewed strip; and one reply shows as both "1 new message" and "1 new notification". The alternative is to leave `worthShowing` on messages and sales only, so the line shows only beside them.

## File structure

**Create**
- `lib/you/model.ts`, `lib/you/model.test.ts`: For you's items and sum; Your stuff's numbers and row words.
- `lib/you/read.ts`, `lib/you/read.test.ts`: `readForYou` and `readYourStuff`.
- `lib/you/paths.ts`: `DETAILS_PATH`.
- `components/account/DetailsView.tsx`, `components/account/DetailsView.test.tsx`: the details card and Edit details form, moved from `AccountView.tsx`.
- `components/account/you-skeleton.ts`: the You skeleton's blocks (no JSX, so the e2e check can import it).
- `components/account/YouBadge.test.tsx`: "the badge equals the list".
- `app/account/details/page.tsx`.
- `components/home/ActivityLines.tsx`, `components/home/ActivityLines.test.tsx`.
- `components/looking-for/YourRequestsLink.tsx`, `components/looking-for/YourRequestsLink.test.tsx`.
- `tests/e2e/you.spec.ts`.
- `tests/e2e/role-views-writes.spec.ts` (only if N2 to N4 haven't created it; otherwise add to it).

**Modify**
- `lib/types.ts`: `NewNotifications`, `NewNotificationsByKind`, `OwnBooking`; `ViewerActivity` loses `savedItemsBack` and gains `newNotifications`.
- `lib/data/notifications.ts` and `lib/data/supabase/notifications.ts`: `groupNewByKind`, `newNotificationsByKind`.
- `lib/data/hub-posts.ts` and `lib/data/supabase/hub-posts.ts`: `ownBookingsFrom`, `listOwnBookings`.
- `lib/data/accounts.ts`, `lib/data/supabase/accounts.ts`, `lib/data/viewer.ts`: the strip's numbers.
- `lib/looking-for/rules.ts` and its test: `closesSoon`.
- `lib/auth/actions.ts` and `lib/auth/account-actions.test.ts`: `updateDetails` lands on `/account/details`.
- `components/account/AccountView.tsx` (keeps its name, now renders You), `AccountView.test.tsx`, `AccountSkeleton.tsx`.
- `components/forms/summary-ids.test.tsx`: `DetailsView` in place of `AccountView`.
- `app/account/page.tsx`.
- `components/tabbar/TabBar.tsx` and its test.
- `components/menu/MenuDrawer.tsx` and its test.
- `components/header/AccountLink.tsx` and its test (the shared count).
- `app/looking-for/page.tsx`.
- `components/home/ContextStrip.tsx`, `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`.
- Contract tests: `lib/data/contract/notifications.contract.ts`, `lib/data/contract/hub-staff.contract.ts`, `lib/data/contract/messages-read.db.test.ts`; `lib/data/accounts.test.ts`, `lib/data/viewer.test.ts`.
- `app/globals.css`: the board's actions row, `.you-page` in the screen-tall lists, and one new block "Role views: You (N5)" at the end.
- E2E: `accounts.spec.ts`, `a11y.spec.ts`, `messaging.spec.ts`, `sign-in-return.spec.ts`, `account-delete-return.spec.ts`, `screenshots.spec.ts`, `cls.spec.ts`, `performance.spec.ts`, `community-writes.spec.ts`, `role-views-screenshots.spec.ts`; `tests/e2e-supabase/account.spec.ts` and `tests/e2e-supabase/sign-in.spec.ts`; `playwright.config.ts` (only if the `role-views-writes` project is missing).
- `app/privacy/page.tsx` (one sentence), `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`, this plan's "Changes made during the build".
- `components/header/SiteHeader.tsx` and its test (Looking For in the quick links).

---

### Task 0: Check N1 and record the baselines

**Files:** none changed. The numbers go into "Changes made during the build" at the end of this plan.

- [ ] **Step 1: The tree and N1**

```bash
git status
```
Expected: nothing under `app/`, `components/`, `lib/` or `tests/` changed by anyone else. If it is, stop and ask the controller.

```bash
ls components/kit/Card.tsx components/kit/Banner.tsx components/kit/ListRow.tsx components/kit/NeedsYouList.tsx components/kit/PageTransition.tsx
```
Expected: all five listed.

```bash
grep -n 'label="You"' components/tabbar/TabBar.tsx && grep -n "CalendarIcon\|StoreIcon\|GridIcon\|InfoIcon\|AlertIcon" components/icons.tsx | head
```
Expected: the label, and the five icons. If any is missing, N1 isn't built: stop.

```bash
grep -n "role-views-writes" playwright.config.ts
```
Write down whether the project exists (Task 13 needs to know).

- [ ] **Step 2: The JS baseline**

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Expected: all pass. Copy every public page's `scriptBrotli` (the first `PAGES` list, `tests/e2e/performance.spec.ts:6-26`) into "Changes made during the build" under "Baseline". Task 14 compares against them.

- [ ] **Step 3: The unit count**

```bash
pnpm test
```
Expected: all pass. Write the count down.

---

### Task 1: `newNotificationsByKind` on both backends

For you counts unread notifications of three kinds without reading them all (`getNotifications` has a limit) and without marking anything read.

**Files:**
- Modify: `lib/types.ts` (after `NotificationItem`, line 425)
- Modify: `lib/data/notifications.ts` (after `countNewNotifications`, line 108)
- Modify: `lib/data/supabase/notifications.ts` (after `countNewNotifications`)
- Test: `lib/data/contract/notifications.contract.ts` (runs on both through `notifications.test.ts` and `notifications.db.test.ts`), `lib/data/notifications.test.ts`

- [ ] **Step 1: Write the failing contract test.** In `lib/data/contract/notifications.contract.ts`, add `newNotificationsByKind` to the import from `@/lib/data/notifications`, and add this test at the end of `notificationsContract`, before its closing `}`:

```ts
  it("groups the unread ones of the asked kinds for For you, newest first, and reading them marks nothing (role views N5)", async () => {
    const start = Date.now() - 10 * MINUTE;
    const add = (name: "shopper" | "asker", kind: string, word: string, minute: number) =>
      world.addNotification(
        name,
        { kind, subjectId: `contract-${word}`, text: `Contract ${word}`, href: `/contract/${word}` },
        new Date(start + minute * MINUTE),
      );
    await add("shopper", "search-match", "match-old", 0);
    await add("shopper", "search-match", "match-new", 1);
    await add("shopper", "new-listing", "listing", 2);
    await add("shopper", "booking", "booking", 3);
    await add("asker", "offer", "not-yours", 4);
    const kinds = ["offer", "search-match", "new-listing"] as const;
    expect(await world.asViewer("shopper", (id) => newNotificationsByKind(id, kinds))).toEqual({
      "search-match": { count: 2, newestHref: "/contract/match-new", newestText: "Contract match-new" },
      "new-listing": { count: 1, newestHref: "/contract/listing", newestText: "Contract listing" },
    });
    // Reading them changed nothing: all four are still new.
    expect(await world.asViewer("shopper", (id) => countNewNotifications(id))).toBe(4);
    expect(await world.asViewer("shopper", (id) => newNotificationsByKind(id, []))).toEqual({});
    await world.asViewer("shopper", (id) => markNotificationsRead(id, new Date()));
    expect(await world.asViewer("shopper", (id) => newNotificationsByKind(id, kinds))).toEqual({});
  });
```

In `lib/data/notifications.test.ts`, add a unit test of the pure grouping (add `groupNewByKind` to its import from `./notifications`):

```ts
describe("groupNewByKind (role views N5)", () => {
  it("counts by kind and keeps the newest one's link and words, by time then id", () => {
    const row = (id: string, kind: "offer" | "search-match", createdAt: string) => ({
      id,
      kind,
      text: `Text ${id}`,
      href: `/to/${id}`,
      createdAt,
    });
    expect(
      groupNewByKind([
        row("a", "offer", "2026-10-20T08:00:00.000Z"),
        row("c", "search-match", "2026-10-21T08:00:00.000Z"),
        row("b", "offer", "2026-10-21T08:00:00.000Z"),
        row("d", "search-match", "2026-10-21T08:00:00.000Z"),
      ]),
    ).toEqual({
      offer: { count: 2, newestHref: "/to/b", newestText: "Text b" },
      "search-match": { count: 2, newestHref: "/to/d", newestText: "Text d" },
    });
    expect(groupNewByKind([])).toEqual({});
  });
});
```

Check that `notifications.test.ts` already imports `describe`, `expect` and `it` from `vitest`; add any that are missing.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/notifications.test.ts lib/data/contract/notifications.test.ts`
Expected: FAIL (`groupNewByKind` and `newNotificationsByKind` are not exported).

- [ ] **Step 3: The types.** In `lib/types.ts`, after the `NotificationItem` type, add:

```ts
/** Unread notifications of one kind, for For you (role views spec 7.4): how many, and the newest one's link and words. */
export type NewNotifications = { count: number; newestHref: string; newestText: string };

/** Unread notifications by kind. A kind with none is absent. */
export type NewNotificationsByKind = Partial<Record<NotificationKind, NewNotifications>>;
```

- [ ] **Step 4: The sample reader.** In `lib/data/notifications.ts`, change the types import to

```ts
import type { NewNotificationsByKind, NotificationItem, NotificationKind } from "@/lib/types";
```

and add after `countNewNotifications`:

```ts
/** A notification as newNotificationsByKind reads it, on either backend. */
export type NewNotificationRow = { id: string; kind: NotificationKind; text: string; href: string; createdAt: string };

/**
 * Unread notifications grouped by kind, each with the newest one's link and words (role views spec 7.4). Newest by
 * time, then by id. Pure, so the Supabase twin shares it.
 */
export function groupNewByKind(rows: readonly NewNotificationRow[]): NewNotificationsByKind {
  const newestFirst = [...rows].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
  );
  const groups: NewNotificationsByKind = {};
  for (const row of newestFirst) {
    const group = groups[row.kind];
    if (group) group.count += 1;
    else groups[row.kind] = { count: 1, newestHref: row.href, newestText: row.text };
  }
  return groups;
}

/**
 * For you's notification rows (role views spec 7.4): the account's unread notifications of `kinds`, by kind. Reading
 * them marks nothing read; opening /notifications, or the thread a notification is about, still does (spec 2.9).
 */
export async function newNotificationsByKind(
  accountId: string,
  kinds: readonly NotificationKind[],
): Promise<NewNotificationsByKind> {
  if (onSupabase()) return (await supabase()).newNotificationsByKind(accountId, kinds);
  return groupNewByKind(ofAccount(accountId).filter((row) => row.readAt === null && kinds.includes(row.kind)));
}
```

- [ ] **Step 5: The Supabase twin.** In `lib/data/supabase/notifications.ts`, change the imports to

```ts
import "server-only";
import type { NotificationKind } from "@/lib/types";
import type * as Sample from "../notifications";
import { groupNewByKind } from "../notifications";
import { iso, selectAll } from "./rows";
import { forViewerAs } from "./viewer";
```

and add after `countNewNotifications`:

```ts
/**
 * For you's unread notifications of some kinds, with the account's own session (the notifications policy lets it read
 * only its own). Every unread row of those kinds, a page at a time, grouped as the sample groups them.
 */
export const newNotificationsByKind: typeof Sample.newNotificationsByKind = async (accountId, kinds) => {
  if (kinds.length === 0) return {};
  const client = await forViewerAs(accountId);
  const rows = await selectAll(
    () =>
      client
        .from("notifications")
        .select("id, kind, text, href, created_at")
        .eq("account_id", accountId)
        .is("read_at", null)
        .in("kind", [...kinds]),
    ["id"],
  );
  return groupNewByKind(
    rows.map((row) => ({
      id: row.id,
      kind: row.kind as NotificationKind,
      text: row.text,
      href: row.href,
      createdAt: iso(row.created_at),
    })),
  );
};
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run lib/data/notifications.test.ts lib/data/contract/notifications.test.ts && pnpm typecheck`
Expected: PASS.

Against the local stack (`supabase start`, then `supabase db reset`; ask the controller if it isn't running):
Run: `pnpm test:db lib/data/contract/notifications.db.test.ts`
Expected: PASS, the new test included.

- [ ] **Step 7: Commit (controller)**

```bash
git add lib/types.ts lib/data/notifications.ts lib/data/supabase/notifications.ts lib/data/notifications.test.ts lib/data/contract/notifications.contract.ts
git commit -m "feat: newNotificationsByKind on both backends, unread notifications of some kinds grouped for For you, reading none (role views N5 Task 1)"
```

---

### Task 2: `listOwnBookings` on both backends

**Files:**
- Modify: `lib/types.ts` (after `HubBooking`, line 552)
- Modify: `lib/data/hub-posts.ts` (after `latestBooking`, line 288)
- Modify: `lib/data/supabase/hub-posts.ts` (after `latestBooking`, line 372)
- Test: `lib/data/contract/hub-staff.contract.ts` (both backends), `lib/data/hub-posts.test.ts`

- [ ] **Step 1: Write the failing contract test.** In `lib/data/contract/hub-staff.contract.ts`, add `listOwnBookings` to the import from `@/lib/data/hub-posts` (keep the list sorted), and add at the end of `hubStaffContract`, before its closing `}`:

```ts
  it("lists a student's own upcoming bookings, soonest first, never another's, a past one or a draft's (role views N5)", async () => {
    const eventStart = AHEAD();
    const hoursStart = `${addDays(sastDate(new Date()), 8)}T08:00:00.000Z`;
    const eventFields: PostFields = { ...TIP, kind: "event", title: "Contract market day", campusSlug: "pretoria", startsAt: eventStart, place: "The Hub", capacity: null };
    const event = await newPost(eventFields);
    const hours = await newPost({ ...TIP, kind: "office-hours", title: "Contract office hours", campusSlug: "pretoria", startsAt: hoursStart, place: "The Hub" });
    const now = new Date();
    const today = sastDate(now);
    await world.asViewer("asker", (id) => addRsvp(event, id, today, now));
    await world.asViewer("shopper", (id) => addRsvp(event, id, today, now));
    await world.asViewer("asker", (id) =>
      requestSlot({ postId: hours, accountId: id, help: "How to price a braid.", time: "After 13:00", today, now }),
    );
    const mine = (at = new Date()) => world.asViewer("asker", (id) => listOwnBookings(id, at));

    expect(await mine()).toEqual([
      { kind: "rsvp", postId: event, title: "Contract market day", startsAt: eventStart, status: "going" },
      { kind: "slot", postId: hours, title: "Contract office hours", startsAt: hoursStart, status: "open" },
    ]);
    expect(await world.asViewer("shopper", (id) => listOwnBookings(id, new Date()))).toEqual([
      { kind: "rsvp", postId: event, title: "Contract market day", startsAt: eventStart, status: "going" },
    ]);

    const booking = (await world.asViewer("staff", () => listBookings())).find((row) => row.postId === hours)!;
    await world.asViewer("staff", (id) => answerBooking(booking.id, "accepted", id, new Date()));
    expect((await mine())[1]).toMatchObject({ kind: "slot", status: "accepted" });

    // Two days after the office hours, nothing is upcoming.
    expect(await mine(new Date(Date.parse(hoursStart) + 2 * 86_400_000))).toEqual([]);

    // An event taken back to a draft leaves the list.
    await save("staff", event, { ...eventFields, published: false });
    expect((await mine()).map((item) => item.postId)).toEqual([hours]);
  });
```

In `lib/data/hub-posts.test.ts`, add a test on the sample seed (add `listOwnBookings` to its import from `./hub-posts`; the file already resets the store in `beforeEach`, check it does):

```ts
describe("listOwnBookings on the seed (role views N5)", () => {
  it("gives Thandi her open slot request at h-007, and no one else's", async () => {
    const now = new Date("2026-10-22T08:00:00.000Z");
    expect(await listOwnBookings("acc-student", now)).toEqual([
      {
        kind: "slot",
        postId: "h-007",
        title: "Office hours: your first listing",
        startsAt: "2026-11-19T11:00:00Z",
        status: "open",
      },
    ]);
    expect(await listOwnBookings("acc-mentor", now)).toEqual([]);
    expect(await listOwnBookings("acc-student", new Date("2026-11-20T08:00:00.000Z"))).toEqual([]);
  });
});
```

The seed's `startsAt` for h-007 is `"2026-11-19T11:00:00Z"` (`data/fixtures/hub.ts:170`), copied as it is.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/hub-posts.test.ts lib/data/contract/hub-staff.test.ts`
Expected: FAIL (`listOwnBookings` is not exported).

- [ ] **Step 3: The type.** In `lib/types.ts`, after the `HubBooking` type, add:

```ts
/** One of the student's own Hub bookings (role views spec 6): an RSVP to an event, or a slot request at office hours. */
export type OwnBooking = {
  kind: "rsvp" | "slot";
  postId: string;
  /** The post's title. */
  title: string;
  /** When it starts, ISO 8601 in UTC. */
  startsAt: string;
  /** "going" for an RSVP; the slot request's own status otherwise. */
  status: "going" | BookingStatus;
};
```

- [ ] **Step 4: The sample reader.** In `lib/data/hub-posts.ts`, change the types import (line 6) to

```ts
import type { Account, BookingStatus, HubBooking, HubPost, HubPostKind, ImageRef, OwnBooking } from "@/lib/types";
```

add `import { sastDate } from "@/lib/time";` after the `@/lib/staff/post-rules` import, and add after `latestBooking`:

```ts
// --- The student's own bookings (role views N5, spec 6) -------------------------------------------------------------

/** What ownBookingsFrom needs of a published post. */
export type BookedPost = { id: string; title: string; startsAt: string | null };

/**
 * The student's upcoming bookings (role views spec 6, plan decision 9): an item per RSVP, and one per office hours for
 * its newest slot request, whatever its answer. Only published posts whose SAST day hasn't passed on `today` (today's
 * still count, as on the feed). Soonest first, then by title. Pure, so the Supabase twin shares it.
 */
export function ownBookingsFrom({
  rsvpPostIds,
  requests,
  posts,
  today,
}: {
  rsvpPostIds: readonly string[];
  requests: readonly { id: string; postId: string; status: BookingStatus; createdAt: string }[];
  posts: ReadonlyMap<string, BookedPost>;
  today: string;
}): OwnBooking[] {
  const upcoming = (postId: string): (BookedPost & { startsAt: string }) | null => {
    const post = posts.get(postId);
    if (!post || post.startsAt === null || hasPassed(post, today)) return null;
    return { ...post, startsAt: post.startsAt };
  };
  const items: OwnBooking[] = [];
  for (const postId of new Set(rsvpPostIds)) {
    const post = upcoming(postId);
    if (post) items.push({ kind: "rsvp", postId, title: post.title, startsAt: post.startsAt, status: "going" });
  }
  const newest = new Map<string, (typeof requests)[number]>();
  for (const request of requests) {
    const kept = newest.get(request.postId);
    const later =
      !kept ||
      Date.parse(request.createdAt) > Date.parse(kept.createdAt) ||
      (request.createdAt === kept.createdAt && request.id > kept.id);
    if (later) newest.set(request.postId, request);
  }
  for (const request of newest.values()) {
    const post = upcoming(request.postId);
    if (post) items.push({ kind: "slot", postId: post.id, title: post.title, startsAt: post.startsAt, status: request.status });
  }
  return items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.title.localeCompare(b.title));
}

/** The student's upcoming RSVPs and slot requests, for You (role views spec 6). Only their own. */
export async function listOwnBookings(accountId: string, now: Date): Promise<OwnBooking[]> {
  if (onSupabase()) return (await supabase()).listOwnBookings(accountId, now);
  const { hubPosts, hubRsvps, hubBookings } = sampleStore();
  const posts = new Map<string, BookedPost>();
  for (const row of hubPosts.values()) {
    if (row.published) posts.set(row.id, { id: row.id, title: row.title, startsAt: row.startsAt });
  }
  return ownBookingsFrom({
    rsvpPostIds: [...hubRsvps.values()].filter((row) => row.accountId === accountId).map((row) => row.postId),
    requests: [...hubBookings.values()].filter((row) => row.accountId === accountId),
    posts,
    today: sastDate(now),
  });
}
```

- [ ] **Step 5: The Supabase twin.** In `lib/data/supabase/hub-posts.ts`, change `import { HUB_BANNER_IMAGE, toHubPost } from "../hub-posts";` to

```ts
import { HUB_BANNER_IMAGE, ownBookingsFrom, toHubPost } from "../hub-posts";
```

add `import { sastDate } from "@/lib/time";` after the `@/lib/types` import, and add after `latestBooking`:

```ts
/**
 * The student's upcoming RSVPs and slot requests (role views N5, plan decision 9), with their own session: hub_rsvps
 * and hub_bookings let a student read only their own rows, and hub_posts only published posts, so a post taken back
 * to a draft drops out as it does in the sample.
 */
export const listOwnBookings: typeof Sample.listOwnBookings = async (accountId, now) => {
  const client = await forViewerAs(accountId);
  const [rsvps, requests] = await Promise.all([
    selectAll(() => client.from("hub_rsvps").select("post_id").eq("account_id", accountId), ["post_id"]),
    selectAll(
      () => client.from("hub_bookings").select("id, post_id, status, created_at").eq("account_id", accountId),
      ["id"],
    ),
  ]);
  const ids = [...rsvps.map((row) => row.post_id), ...requests.map((row) => row.post_id)];
  const posts = ids.length === 0 ? [] : await postTitles(client, ids, false);
  return ownBookingsFrom({
    rsvpPostIds: rsvps.map((row) => row.post_id),
    requests: requests.map((row) => ({
      id: row.id,
      postId: row.post_id,
      status: row.status as BookingStatus,
      createdAt: iso(row.created_at),
    })),
    posts: new Map(
      posts.flatMap((post) =>
        post.id && post.title ? [[post.id, { id: post.id, title: post.title, startsAt: iso(post.starts_at) }] as const] : [],
      ),
    ),
    today: sastDate(now),
  });
};
```

`postTitles` is the file's own function declaration (line 300), hoisted, reading `hub_posts` for a student (`staff` false).

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run lib/data/hub-posts.test.ts lib/data/contract/hub-staff.test.ts && pnpm typecheck`
Expected: PASS.

Run: `pnpm test:db lib/data/contract/hub-staff.db.test.ts`
Expected: PASS, the new test included.

Run: `supabase test db`
Expected: PASS, unchanged (no SQL changed; this confirms the policies the twin relies on).

- [ ] **Step 7: Commit (controller)**

```bash
git add lib/types.ts lib/data/hub-posts.ts lib/data/supabase/hub-posts.ts lib/data/hub-posts.test.ts lib/data/contract/hub-staff.contract.ts
git commit -m "feat: listOwnBookings on both backends, a student's upcoming RSVPs and newest slot request per office hours (role views N5 Task 2)"
```

---

### Task 3: `closesSoon` and the You model

**Files:**
- Modify: `lib/looking-for/rules.ts` (after `reminderDue`), `lib/looking-for/rules.test.ts`
- Create: `lib/you/paths.ts`, `lib/you/model.ts`, `lib/you/model.test.ts`

- [ ] **Step 1: Write the failing tests.** In `lib/looking-for/rules.test.ts`, add `closesSoon` to the import from `./rules` and add:

```ts
describe("closesSoon (role views N5: the You banner, plan decision 8)", () => {
  it("is true from the reminder day to the day before the closing day", () => {
    expect(closesSoon("2026-10-24", "2026-10-21")).toBe(false);
    expect(closesSoon("2026-10-24", "2026-10-22")).toBe(true);
    expect(closesSoon("2026-10-24", "2026-10-23")).toBe(true);
    expect(closesSoon("2026-10-24", "2026-10-24")).toBe(false);
  });

  it("is false for a request that never closes by itself (a sample one)", () => {
    expect(closesSoon(null, "2026-10-22")).toBe(false);
  });
});
```

`lib/you/model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayMonth } from "@/lib/format";
import { sastDateTime } from "@/lib/time";
import type { OwnBooking, OwnRequest } from "@/lib/types";
import {
  bookingsRow,
  closingSoonText,
  forYouItems,
  forYouTotal,
  requestsDetail,
  savedDetail,
  searchesDetail,
  shopDetail,
  yourStuffFrom,
} from "./model";

const note = (count: number, href = "/to/newest", text = "The newest") => ({ count, newestHref: href, newestText: text });

describe("For you (role views spec 7.4)", () => {
  it("lists messages, offers, matches and new listings, in that order", () => {
    const items = forYouItems({ conversations: 5, byKind: { offer: note(3), "search-match": note(1), "new-listing": note(2) } });
    expect(items.map((item) => [item.key, item.count, item.href])).toEqual([
      ["messages", 2, "/messages"],
      ["offers", 3, "/account/requests"],
      ["matches", 1, "/notifications"],
      ["listings", 2, "/notifications"],
    ]);
    expect(items.map((item) => item.title)).toEqual([
      "Conversations with new messages",
      "New offers on your requests",
      "New match for your saved searches",
      "New listings from shops you follow",
    ]);
  });

  it("opens one new offer's thread, and names it", () => {
    const [, offers] = forYouItems({ conversations: 0, byKind: { offer: note(1, "/messages/conv-9", "Tech corner offered") } });
    expect(offers).toMatchObject({ count: 1, href: "/messages/conv-9", detail: "Tech corner offered", urgent: true });
  });

  it("counts a new offer once, in the offers row, though its thread is unread too (plan decision 1)", () => {
    const items = forYouItems({ conversations: 1, byKind: { offer: note(1) } });
    expect(items.map((item) => [item.key, item.count])).toEqual([
      ["messages", 0],
      ["offers", 1],
      ["matches", 0],
      ["listings", 0],
    ]);
    expect(forYouTotal(items)).toBe(1);
  });

  it("counts nothing when nothing is new", () => {
    const items = forYouItems({ conversations: 0, byKind: {} });
    expect(items.every((item) => item.count === 0)).toBe(true);
    expect(forYouTotal(items)).toBe(0);
  });

  it("sums to the badge: every row's count, once (5 conversations, 3 of them offers)", () => {
    const items = forYouItems({ conversations: 5, byKind: { offer: note(3), "search-match": note(1), "new-listing": note(2) } });
    expect(forYouTotal(items)).toBe(8);
  });
});

const own = (title: string, state: OwnRequest["state"], closesOn: string | null) =>
  ({ state, request: { title, closesOn } }) as Pick<OwnRequest, "state"> & { request: Pick<OwnRequest["request"], "title" | "closesOn"> };

describe("Your stuff (role views spec 7.4)", () => {
  it("counts the device's saved listings, the follows, the requests by state and the searches with alerts on", () => {
    const stuff = yourStuffFrom({
      savedIds: ["l-001", "l-026"],
      shops: [{ slug: "tech-corner" }],
      own: [own("Desk lamp", "open", "2026-11-30"), own("Kettle", "closed", null), own("Fan", "hidden", null)],
      searches: [{ paused: false }, { paused: true }],
      bookings: [],
      today: "2026-10-22",
    });
    expect(stuff).toEqual({
      savedListings: 2,
      followedShops: 1,
      requests: { open: 1, closed: 1, hidden: 1 },
      closingSoon: null,
      searches: { count: 2, alertsOn: 1 },
      bookings: [],
    });
  });

  it("finds the open requests that close within the reminder's window, soonest first", () => {
    const stuff = yourStuffFrom({
      savedIds: [],
      shops: [],
      own: [
        own("Later lamp", "open", "2026-10-24"),
        own("Sooner kettle", "open", "2026-10-23"),
        own("Far fan", "open", "2026-11-30"),
        own("Hidden desk", "hidden", "2026-10-23"),
      ],
      searches: [],
      bookings: [],
      today: "2026-10-22",
    });
    expect(stuff.closingSoon).toEqual({ title: "Sooner kettle", closesOn: "2026-10-23", count: 2 });
  });

  it("words each row", () => {
    expect(savedDetail({ savedListings: 1, followedShops: 0 })).toBe("1 listing on this device · 0 shops followed");
    expect(savedDetail({ savedListings: 2, followedShops: 1 })).toBe("2 listings on this device · 1 shop followed");
    expect(requestsDetail({ open: 0, closed: 0, hidden: 0 })).toBe("None yet");
    expect(requestsDetail({ open: 2, closed: 1, hidden: 0 })).toBe("2 open · 1 closed");
    expect(requestsDetail({ open: 0, closed: 0, hidden: 1 })).toBe("0 open · 1 hidden by the Hub");
    expect(searchesDetail({ count: 0, alertsOn: 0 })).toBe("None yet");
    expect(searchesDetail({ count: 2, alertsOn: 2 })).toBe("2 saved · alerts on");
    expect(searchesDetail({ count: 2, alertsOn: 0 })).toBe("2 saved · alerts paused");
    expect(searchesDetail({ count: 3, alertsOn: 1 })).toBe("3 saved · alerts on for 1");
    expect(shopDetail({ status: "pending", sellerSlug: null })).toBe("Waiting for the Hub's approval");
    expect(shopDetail({ status: "paused", sellerSlug: "tech-corner" })).toBe("Paused");
    expect(shopDetail({ status: "approved", sellerSlug: "tech-corner" })).toBe("Open to buyers");
  });

  it("points Hub bookings at the soonest, or at the Hub when there's none", () => {
    expect(bookingsRow([])).toEqual({ href: "/hub", detail: "Nothing coming up" });
    const bookings: OwnBooking[] = [
      { kind: "slot", postId: "h-007", title: "Office hours: your first listing", startsAt: "2026-11-19T11:00:00Z", status: "open" },
      { kind: "rsvp", postId: "h-001", title: "Pitch night", startsAt: "2026-11-26T16:00:00Z", status: "going" },
    ];
    expect(bookingsRow(bookings)).toEqual({
      href: "/hub/h-007",
      detail: `Office hours: your first listing, ${sastDateTime("2026-11-19T11:00:00Z")} · Waiting for an answer · 1 more`,
    });
  });

  it("says when requests close, in the reminder's words", () => {
    expect(closingSoonText({ title: "Desk lamp", closesOn: "2026-10-24", count: 1 })).toBe(
      `Your request Desk lamp closes automatically on ${dayMonth("2026-10-24")}.`,
    );
    expect(closingSoonText({ title: "Desk lamp", closesOn: "2026-10-24", count: 2 })).toBe(
      `2 of your requests close automatically soon, the first on ${dayMonth("2026-10-24")}.`,
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/looking-for/rules.test.ts lib/you/model.test.ts`
Expected: FAIL (`closesSoon` and `./model` missing).

- [ ] **Step 3: `closesSoon`.** In `lib/looking-for/rules.ts`, after `reminderDue`, add:

```ts
/**
 * Whether a request with this closing day is in its last days (role views spec 7.4, plan decision 8): from its
 * reminder day to the day before it closes, on `today`, a SAST date. The You page's banner uses it, whether or not the
 * reminder has been sent. False for a request that never closes by itself (null). Reads no clock.
 */
export function closesSoon(closesOn: string | null, today: string): boolean {
  return closesOn !== null && reminderDay(closesOn) <= today && today < closesOn;
}
```

- [ ] **Step 4: `lib/you/paths.ts`**

```ts
// You's addresses (role views N5). Plain strings, so a Server Action, a view and a test can share them without
// importing server code.

/** You, the buyer's hub (role views spec 7.4). The URL is unchanged from Your account. */
export const YOU_PATH = "/account";

/** Your details: the details card and Edit details, moved off You (role views spec 7.4). */
export const DETAILS_PATH = "/account/details";
```

- [ ] **Step 5: `lib/you/model.ts`**

```ts
import type { NeedsYouItem } from "@/components/kit/NeedsYouList";
import { dayMonth } from "@/lib/format";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { closesSoon } from "@/lib/looking-for/rules";
import { sastDateTime } from "@/lib/time";
import type {
  NewNotifications,
  NewNotificationsByKind,
  NotificationKind,
  OwnBooking,
  OwnRequest,
  SellerProfile,
} from "@/lib/types";

// You (role views spec 7.4): what For you lists, what the You tab's badge counts, and the words of Your stuff's rows.
// Plain values and functions over what lib/you/read.ts reads. The page and the tab share them, so the badge is always
// the list's sum (spec 4.2). The words are samples for Lama to change.

/** The notification kinds For you counts: new offers, saved-search matches, followed shops' new listings. */
export const FOR_YOU_KINDS: readonly NotificationKind[] = ["offer", "search-match", "new-listing"];

/** For you's line when nothing is waiting. */
export const ALL_CLEAR = "All clear. Nothing needs you right now.";

/** What readForYou gives: the list, and two counts the Messages and Notifications rows show. */
export type ForYou = {
  items: NeedsYouItem[];
  /** Conversations with a message the account hasn't opened (unreadCounts). */
  conversations: number;
  /** Every new notification, of any kind. */
  newNotifications: number;
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The newest one's words, when there's only one to describe. */
const onlyOne = (group: NewNotifications | undefined) => (group?.count === 1 ? group.newestText : undefined);

/**
 * For you's rows (spec 7.4, plan decisions 1 and 2): conversations with new messages, new offers on the account's
 * requests, new saved-search matches and new listings from followed shops. NeedsYouList hides the rows at 0.
 */
export function forYouItems({
  conversations,
  byKind,
}: {
  conversations: number;
  byKind: NewNotificationsByKind;
}): NeedsYouItem[] {
  const offers = byKind.offer?.count ?? 0;
  const matches = byKind["search-match"]?.count ?? 0;
  const listings = byKind["new-listing"]?.count ?? 0;
  // An unread offer notification always has its own unread thread (startOffer writes both; opening the thread reads
  // both), so a new offer counts once, in the offers row.
  const messages = Math.max(0, conversations - offers);
  return [
    {
      key: "messages",
      count: messages,
      title: plural(messages, "Conversation with new messages", "Conversations with new messages"),
      href: "/messages",
      urgent: true,
    },
    {
      key: "offers",
      count: offers,
      title: plural(offers, "New offer on your requests", "New offers on your requests"),
      detail: onlyOne(byKind.offer),
      // One offer opens its thread, which reads it; several open Your requests, where each shows its offers.
      href: offers === 1 && byKind.offer ? byKind.offer.newestHref : YOUR_REQUESTS_PATH,
      urgent: true,
    },
    {
      key: "matches",
      count: matches,
      title: plural(matches, "New match for your saved searches", "New matches for your saved searches"),
      detail: onlyOne(byKind["search-match"]),
      href: "/notifications",
    },
    {
      key: "listings",
      count: listings,
      title: plural(listings, "New listing from a shop you follow", "New listings from shops you follow"),
      detail: onlyOne(byKind["new-listing"]),
      href: "/notifications",
    },
  ];
}

/** The You tab's badge: the sum of For you's counts (spec 4.3). */
export function forYouTotal(items: readonly Pick<NeedsYouItem, "count">[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

/** The soonest of the account's open requests in its last days, and how many are. */
export type ClosingSoon = { title: string; closesOn: string; count: number };

/** Your stuff's numbers (spec 7.4). */
export type YourStuff = {
  /** From the vossie_saved cookie: this device only (plan decision 3). */
  savedListings: number;
  followedShops: number;
  requests: { open: number; closed: number; hidden: number };
  closingSoon: ClosingSoon | null;
  searches: { count: number; alertsOn: number };
  bookings: readonly OwnBooking[];
};

type OwnPart = Pick<OwnRequest, "state"> & { request: Pick<OwnRequest["request"], "title" | "closesOn"> };

export function yourStuffFrom({
  savedIds,
  shops,
  own,
  searches,
  bookings,
  today,
}: {
  savedIds: readonly string[];
  shops: readonly unknown[];
  own: readonly OwnPart[];
  searches: readonly { paused: boolean }[];
  bookings: readonly OwnBooking[];
  today: string;
}): YourStuff {
  const inState = (state: OwnRequest["state"]) => own.filter((item) => item.state === state).length;
  const soon = own
    .filter((item) => item.state === "open" && closesSoon(item.request.closesOn, today))
    .sort((a, b) => (a.request.closesOn ?? "").localeCompare(b.request.closesOn ?? ""));
  return {
    savedListings: savedIds.length,
    followedShops: shops.length,
    requests: { open: inState("open"), closed: inState("closed"), hidden: inState("hidden") },
    closingSoon:
      soon.length === 0 ? null : { title: soon[0].request.title, closesOn: soon[0].request.closesOn!, count: soon.length },
    searches: { count: searches.length, alertsOn: searches.filter((search) => !search.paused).length },
    bookings,
  };
}

export function savedDetail({ savedListings, followedShops }: Pick<YourStuff, "savedListings" | "followedShops">): string {
  return (
    `${savedListings} ${plural(savedListings, "listing", "listings")} on this device · ` +
    `${followedShops} ${plural(followedShops, "shop", "shops")} followed`
  );
}

export function requestsDetail({ open, closed, hidden }: YourStuff["requests"]): string {
  if (open + closed + hidden === 0) return "None yet";
  const parts = [`${open} open`];
  if (closed > 0) parts.push(`${closed} closed`);
  if (hidden > 0) parts.push(`${hidden} hidden by the Hub`);
  return parts.join(" · ");
}

export function searchesDetail({ count, alertsOn }: YourStuff["searches"]): string {
  if (count === 0) return "None yet";
  if (alertsOn === count) return `${count} saved · alerts on`;
  if (alertsOn === 0) return `${count} saved · alerts paused`;
  return `${count} saved · alerts on for ${alertsOn}`;
}

const BOOKING_WORDS: Readonly<Record<OwnBooking["status"], string>> = {
  going: "Going",
  open: "Waiting for an answer",
  accepted: "Accepted",
  declined: "Declined",
};

/** Hub bookings' row: the soonest one's page and words, or the Hub when nothing is booked. */
export function bookingsRow(bookings: readonly OwnBooking[]): { href: string; detail: string } {
  if (bookings.length === 0) return { href: "/hub", detail: "Nothing coming up" };
  const [next] = bookings;
  const more = bookings.length > 1 ? ` · ${bookings.length - 1} more` : "";
  return {
    href: `/hub/${next.postId}`,
    detail: `${next.title}, ${sastDateTime(next.startsAt)} · ${BOOKING_WORDS[next.status]}${more}`,
  };
}

/** Your shop's line (as the old account row said it, selling plan decision 21). */
export function shopDetail(seller: SellerProfile): string {
  if (seller.status === "pending" || !seller.sellerSlug) return "Waiting for the Hub's approval";
  if (seller.status === "paused") return "Paused";
  return "Open to buyers";
}

/** The banner's sentence (plan decision 8), in the reminder's words. */
export function closingSoonText({ title, closesOn, count }: ClosingSoon): string {
  if (count === 1) return `Your request ${title} closes automatically on ${dayMonth(closesOn)}.`;
  return `${count} of your requests close automatically soon, the first on ${dayMonth(closesOn)}.`;
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run lib/looking-for/rules.test.ts lib/you/model.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit (controller)**

```bash
git add lib/looking-for/rules.ts lib/looking-for/rules.test.ts lib/you/paths.ts lib/you/model.ts lib/you/model.test.ts
git commit -m "feat: the You model, For you's rows and sum, Your stuff's numbers and words, and closesSoon for the banner (role views N5 Task 3)"
```

---

### Task 4: The You readers

**Files:**
- Create: `lib/you/read.ts`, `lib/you/read.test.ts`

- [ ] **Step 1: Write the failing tests** `lib/you/read.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFollow } from "@/lib/data/follows";
import { countNewNotifications, notify } from "@/lib/data/notifications";
import { resetSampleStore } from "@/lib/data/store";
import { forYouTotal } from "./model";
import { readForYou, readYourStuff } from "./read";

// The saved cookie is the browser's; here it's whatever the test says.
const saved = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("@/lib/data/saved", () => ({ getSavedIds: async () => saved.ids }));

// The fixtures' day: Thandi (acc-student) has one unread conversation and two new notifications.
const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  saved.ids = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

describe("readForYou (role views spec 7.4)", () => {
  it("counts Thandi's unread conversation, and nothing else waiting", async () => {
    const forYou = await readForYou("acc-student");
    expect(forYou.items.map((item) => [item.key, item.count])).toEqual([
      ["messages", 1],
      ["offers", 0],
      ["matches", 0],
      ["listings", 0],
    ]);
    expect(forYou.conversations).toBe(1);
    expect(forYou.newNotifications).toBe(2);
    expect(forYouTotal(forYou.items)).toBe(1);
  });

  it("counts her new saved-search match, and reading it marks nothing read", async () => {
    await notify({
      accountId: "acc-student",
      kind: "search-match",
      subjectId: "ss-1",
      text: "Casio calculator matches your search",
      href: "/listings/l-001",
      now: NOW,
    });
    const before = await countNewNotifications("acc-student");
    const matches = (await readForYou("acc-student")).items.find((item) => item.key === "matches");
    expect(matches).toMatchObject({ count: 1, detail: "Casio calculator matches your search", href: "/notifications" });
    expect(await countNewNotifications("acc-student")).toBe(before);
  });

  it("never counts another account's", async () => {
    await notify({ accountId: "acc-seller", kind: "offer", subjectId: "c-1", text: "Offer", href: "/messages/c-1", now: NOW });
    expect((await readForYou("acc-student")).items.find((item) => item.key === "offers")?.count).toBe(0);
  });
});

describe("readYourStuff (role views spec 7.4)", () => {
  it("counts the device's saved listings, her follows and her Hub booking", async () => {
    saved.ids = ["l-001", "l-026"];
    await addFollow("acc-student", "tech-corner", NOW);
    const stuff = await readYourStuff("acc-student", NOW);
    expect(stuff).toMatchObject({
      savedListings: 2,
      followedShops: 1,
      requests: { open: 0, closed: 0, hidden: 0 },
      closingSoon: null,
      searches: { count: 0, alertsOn: 0 },
    });
    expect(stuff.bookings.map((booking) => booking.postId)).toEqual(["h-007"]);
  });
});
```

Check `addFollow`'s answer for `"tech-corner"` is `"followed"` on the seed (`lib/data/follows.ts:29`); if the seed's student can't follow it, pick another approved shop from `data/fixtures/sellers.ts`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/you/read.test.ts`
Expected: FAIL (`./read` missing).

- [ ] **Step 3: Implement** `lib/you/read.ts`

```ts
import { cache } from "react";
import { listFollowedShops } from "@/lib/data/follows";
import { listOwnBookings } from "@/lib/data/hub-posts";
import { unreadCounts } from "@/lib/data/messages";
import { newNotificationsByKind } from "@/lib/data/notifications";
import { listOwnRequests } from "@/lib/data/requests";
import { getSavedIds } from "@/lib/data/saved";
import { listSavedSearches } from "@/lib/data/saved-searches";
import { sastDate } from "@/lib/time";
import { FOR_YOU_KINDS, forYouItems, yourStuffFrom, type ForYou, type YourStuff } from "./model";

// You's reads (role views spec 7.4). Request-time only: call them inside <Suspense>, after getViewer() or
// requireAccount() found the account, which awaited connection(), so they may read the clock (decision 26).

/**
 * For you, and the You tab's badge from the same read (spec 4.2, plan decision 14). React's cache() makes it one read
 * per request, shared by the page and the tab, so it takes no `now`: it reads the clock itself. Reading marks nothing
 * read.
 */
export const readForYou = cache(async (accountId: string): Promise<ForYou> => {
  const [counts, byKind] = await Promise.all([
    unreadCounts(accountId, new Date()),
    newNotificationsByKind(accountId, FOR_YOU_KINDS),
  ]);
  return {
    items: forYouItems({ conversations: counts.conversations, byKind }),
    conversations: counts.conversations,
    newNotifications: counts.notifications,
  };
});

/**
 * Your stuff (spec 7.4): the saved listings on this device (the vossie_saved cookie), followed shops, the account's
 * requests (settled first, so the banner and the counts agree with Your requests), saved searches and upcoming Hub
 * bookings. Every reader is the account's own.
 */
export async function readYourStuff(accountId: string, now: Date): Promise<YourStuff> {
  const [savedIds, shops, own, searches, bookings] = await Promise.all([
    getSavedIds(),
    listFollowedShops(accountId),
    listOwnRequests(accountId, now),
    listSavedSearches(accountId),
    listOwnBookings(accountId, now),
  ]);
  return yourStuffFrom({ savedIds, shops, own, searches, bookings, today: sastDate(now) });
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/you && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/you/read.ts lib/you/read.test.ts
git commit -m "feat: readForYou (one read per request, shared by the page and the tab) and readYourStuff (role views N5 Task 4)"
```

---
### Task 5: The You tab's badge counts For you

**Files:**
- Modify: `components/tabbar/TabBar.tsx` (the imports, `AccountTab` and `TabAccount`)
- Modify: `components/tabbar/TabBar.test.tsx`

- [ ] **Step 1: Update the test first.** Replace the whole of `components/tabbar/TabBar.test.tsx` with the version below. The first five tests are the existing ones (with N1's "You"); the mock and the last three are new.

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savedCookieString } from "@/lib/saved";
import { AccountTab, TabAccount, TabBar } from "./TabBar";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

// For you's reader (role views N5): the tab's badge is the sum of what it lists.
const forYou = vi.hoisted(() => ({ counts: [] as number[], failing: false }));
vi.mock("@/lib/you/read", () => ({
  readForYou: async () => {
    if (forYou.failing) throw new Error("The store didn't answer");
    return {
      items: forYou.counts.map((count, i) => ({ key: `item-${i}`, count, title: `Item ${i}`, href: "/account" })),
      conversations: 0,
      newNotifications: 0,
    };
  },
}));

afterEach(() => {
  viewer.account = null;
  forYou.counts = [];
  forYou.failing = false;
});

function renderBar(account = <AccountTab signedIn={false} />) {
  render(<TabBar account={account} />);
  return screen.getByRole("navigation", { name: "Main" });
}

describe("the phone tab bar (spec section 6.2)", () => {
  it("has Home, Shop, Sell, Saved and You, in that order, each with a visible label", () => {
    const bar = renderBar();
    const links = within(bar).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Shop", "Sell", "Saved", "You"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/browse", "/sell", "/saved", "/login"]);
  });

  it("marks the current page's tab (the tests' page is /)", () => {
    const bar = renderBar();
    expect(within(bar).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("link", { name: "Shop" })).not.toHaveAttribute("aria-current");
  });

  it("gives Sell its own look", () => {
    const bar = renderBar();
    expect(within(bar).getByRole("link", { name: "Sell" })).toHaveClass("tab", "tab-sell");
  });

  it("badges the saved count on this device, and describes the tab with it", () => {
    document.cookie = savedCookieString(["a", "b"], false);
    const bar = renderBar();
    const saved = within(bar).getByRole("link", { name: "Saved" });
    expect(saved).toHaveAccessibleDescription("2 items");
    expect(saved.querySelector(".hdr-badge")).toHaveTextContent("2");
  });

  it("has no badge and an empty description with nothing saved", () => {
    const bar = renderBar();
    const saved = within(bar).getByRole("link", { name: "Saved" });
    expect(saved).toHaveAccessibleDescription("");
    expect(saved.querySelector(".hdr-badge")).toBeNull();
  });

  it("goes to sign-in signed out, and to You with a red badge that sums For you (role views spec 4.3)", async () => {
    viewer.account = { id: "acc-student" };
    forYou.counts = [1, 0, 2];
    const bar = renderBar(await TabAccount());
    const you = within(bar).getByRole("link", { name: "You" });
    expect(you).toHaveAttribute("href", "/account");
    expect(you).toHaveAccessibleDescription("3 things for you");
    expect(you.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
    expect(you.querySelector(".hdr-badge")).toHaveTextContent(/^3 /);
  });

  it("says one thing, caps the number at 99+, and shows no badge with nothing for you", () => {
    const one = render(<AccountTab signedIn forYou={1} />);
    expect(screen.getByRole("link", { name: "You" })).toHaveAccessibleDescription("1 thing for you");
    one.unmount();
    const many = render(<AccountTab signedIn forYou={140} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toHaveTextContent(/^99\+ /);
    many.unmount();
    render(<AccountTab signedIn forYou={0} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toBeNull();
  });

  it("shows no badge when the count fails, and none signed out", async () => {
    viewer.account = { id: "acc-student" };
    forYou.failing = true;
    const { unmount } = render(await TabAccount());
    const you = screen.getByRole("link", { name: "You" });
    expect(you).toHaveAttribute("href", "/account");
    expect(you.querySelector(".hdr-badge")).toBeNull();
    unmount();
    render(<AccountTab signedIn={false} forYou={4} />);
    expect(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/tabbar`
Expected: FAIL (`forYou` isn't a prop; the description still counts notifications).

- [ ] **Step 3: Change the tab.** Read `components/tabbar/TabBar.tsx` first (N1 changed `AccountTab`'s label). Replace the import

```tsx
import { countNewNotifications } from "@/lib/data/notifications";
```

with

```tsx
import { forYouTotal } from "@/lib/you/model";
import { readForYou } from "@/lib/you/read";
```

In `TabBar`'s doc comment, change "Home, Shop, Sell, Saved and Account" to "Home, Shop, Sell, Saved and You". Then replace everything from the doc comment above `export function AccountTab` to the end of the file with:

```tsx
/**
 * You (/account) when signed in, with a red badge that counts For you (role views spec 4.3): the sum of the rows the
 * You page lists, from the same reader, so the two always agree. It describes the tab ("3 things for you") without
 * changing its name. Sign-in when signed out, never the gated page itself (CLAUDE.md).
 */
export function AccountTab({ signedIn, forYou = 0 }: { signedIn: boolean; forYou?: number }) {
  const badge = signedIn && forYou > 0;
  return (
    <Tab
      href={signedIn ? "/account" : "/login"}
      icon={<UserIcon />}
      label="You"
      match="section"
      prefetch={false}
      describedBy={badge ? "tab-account-new" : undefined}
    >
      {badge && (
        // Hidden from the name (the tab has no aria-label), still read as its description.
        <span id="tab-account-new" className="hdr-badge hdr-badge-alert" aria-hidden="true">
          {forYou > 99 ? "99+" : forYou}{" "}
          <span className="sr-only">{`${forYou === 1 ? "thing" : "things"} for you`}</span>
        </span>
      )}
    </Tab>
  );
}

/** The tab for this request's session. Request-time, so the layout puts it inside <Suspense>. */
export async function TabAccount() {
  // As the header's icon: a failed lookup counts as signed out, a failed count shows no badge, never a guess (spec 4.2).
  // getViewer is one lookup per render (React's cache), shared with the header; readForYou is one read per request,
  // shared with the You page.
  const account = await getViewer().catch(() => null);
  if (!account) return <AccountTab signedIn={false} />;
  const forYou = await readForYou(account.id)
    .then((read) => forYouTotal(read.items))
    .catch(() => 0);
  return <AccountTab signedIn forYou={forYou} />;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/tabbar && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/tabbar/TabBar.tsx components/tabbar/TabBar.test.tsx
git commit -m "feat: the You tab's badge sums For you from the same reader as the page (role views N5 Task 5, spec 4.3)"
```

---

### Task 5b: The header icon shares the count

Plan decision 7: the header's account icon (from the tablet step) shows the same number as the You tab.

**Files:**
- Modify: `components/header/AccountLink.tsx`, `components/header/AccountLink.test.tsx`

- [ ] **Step 1: Update the test first.** In `components/header/AccountLink.test.tsx`:
  - replace the `notifications` hoisted object and its `vi.mock("@/lib/data/notifications", …)` with

    ```tsx
    const forYou = vi.hoisted(() => ({ counts: [] as number[], failing: false }));

    vi.mock("@/lib/you/read", () => ({
      readForYou: async () => {
        if (forYou.failing) throw new Error("The store didn't answer");
        return {
          items: forYou.counts.map((count, i) => ({ key: `item-${i}`, count, title: `Item ${i}`, href: "/account" })),
          conversations: 0,
          newNotifications: 0,
        };
      },
    }));
    ```
    and in `afterEach`, `notifications.count = 0; notifications.failing = false;` becomes `forYou.counts = []; forYou.failing = false;`;
  - replace the last three tests with

    ```tsx
      it("shows a red badge with the For you count, keeping the name (role views N5, plan decision 7)", () => {
        render(<AccountLink signedIn forYou={2} />);
        const link = screen.getByRole("link", { name: "Your account" });
        expect(link).toHaveAccessibleDescription("2 things for you");
        expect(link.querySelector(".hdr-badge")).toHaveClass("hdr-badge-alert");
      });

      it("says one thing, caps the number at 99+, and has no badge signed out or with nothing for you", () => {
        const { unmount } = render(<AccountLink signedIn forYou={1} />);
        expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("1 thing for you");
        unmount();
        const many = render(<AccountLink signedIn forYou={120} />);
        expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("99+ things for you");
        many.unmount();
        const none = render(<AccountLink signedIn forYou={0} />);
        expect(none.container.querySelector(".hdr-badge")).toBeNull();
        none.unmount();
        render(<AccountLink signedIn={false} forYou={3} />);
        expect(screen.getByRole("link", { name: "Sign in" })).not.toHaveAttribute("aria-describedby");
      });

      it("counts the session's For you, the same sum as the You tab, and shows no badge when the read fails", async () => {
        viewer.account = { id: "acc-student" };
        forYou.counts = [1, 0, 1];
        const { unmount } = render(await HeaderAccount());
        expect(screen.getByRole("link", { name: "Your account" })).toHaveAccessibleDescription("2 things for you");
        unmount();
        forYou.failing = true;
        render(await HeaderAccount());
        expect(screen.getByRole("link", { name: "Your account" })).not.toHaveAttribute("aria-describedby");
      });
    ```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/header/AccountLink.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `components/header/AccountLink.tsx`, replace `import { countNewNotifications } from "@/lib/data/notifications";` with

```tsx
import { forYouTotal } from "@/lib/you/model";
import { readForYou } from "@/lib/you/read";
```

and replace everything from the doc comment above `export function AccountLink` to the end of the file with:

```tsx
/**
 * The header's account icon (accounts spec 3.4): "Sign in" to /login when signed out, "Your account" to /account when
 * signed in. The layout renders it on the server and hands it to SiteHeader (accounts plan decision 1). No prefetch,
 * like the Saved link: the header is on every page.
 *
 * Signed in, a red badge counts For you, the same sum as the You tab (role views N5, plan decision 7), from the same
 * read. It sits inside the icon's box, so nothing moves as it streams in, and it describes the link ("3 things for
 * you") without changing its name. Like everything in the layout, it's as fresh as the last full page load or post.
 */
export function AccountLink({ signedIn, forYou = 0 }: { signedIn: boolean; forYou?: number }) {
  const badge = signedIn && forYou > 0;
  // Phones have the tab bar's You tab instead (components/tabbar/TabBar.tsx).
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      prefetch={false}
      aria-label={signedIn ? "Your account" : "Sign in"}
      aria-describedby={badge ? "hdr-account-new" : undefined}
      className="hdr-item icon-btn relative hidden wide:inline-grid"
    >
      <UserIcon />
      {badge && (
        <span id="hdr-account-new" className="hdr-badge hdr-badge-alert">
          {forYou > 99 ? "99+" : forYou}{" "}
          <span className="sr-only">{`${forYou === 1 ? "thing" : "things"} for you`}</span>
        </span>
      )}
    </Link>
  );
}

/** The icon for this request's session. Request-time, so the layout puts it inside <Suspense>. */
export async function HeaderAccount() {
  // A failed lookup counts as signed out rather than breaking the header; a failed read shows no badge.
  const account = await getViewer().catch(() => null);
  if (!account) return <AccountLink signedIn={false} />;
  const forYou = await readForYou(account.id)
    .then((read) => forYouTotal(read.items))
    .catch(() => 0);
  return <AccountLink signedIn forYou={forYou} />;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/header components/tabbar && pnpm typecheck`
Expected: PASS. `grep -rn "countNewNotifications" components` now prints nothing outside tests (the reader stays for `unreadCounts`).

- [ ] **Step 5: Commit (controller)**

```bash
git add components/header/AccountLink.tsx components/header/AccountLink.test.tsx
git commit -m "feat: the header's account icon shows For you's count, the same as the You tab (role views N5 Task 5b, plan decision 7)"
```

---

### Task 6: Your details at `/account/details`

The details card and the Edit details form move off You, unchanged, onto their own page.

**Files:**
- Create: `components/account/DetailsView.tsx`, `components/account/DetailsView.test.tsx`, `app/account/details/page.tsx`
- Modify: `lib/auth/actions.ts` (`updateDetails`, lines 82–101), `lib/auth/account-actions.test.ts`
- Modify: `components/forms/summary-ids.test.tsx` (lines 3 and 222–227)

- [ ] **Step 1: Write the failing tests.** `components/account/DetailsView.test.tsx` (the old `AccountView.test.tsx`'s details tests, moved):

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { campuses } from "@/data/fixtures/campuses";
import type { FormStateRow } from "@/lib/data/rows";
import type { Account } from "@/lib/types";
import { DetailsView, detailsForm } from "./DetailsView";

// The form only needs something to post to; the action has its own tests.
vi.mock("@/lib/auth/actions", () => ({ updateDetails: async () => {} }));

const account: Account = {
  id: "acc-student",
  email: "student@eduvos.com",
  firstName: "Thandi",
  campusSlug: "midrand",
  roles: [],
  seller: null,
  createdAt: "2026-09-01T07:30:00.000Z",
};

const state = (fields: Partial<FormStateRow>): FormStateRow => ({
  key: "session-key:details",
  sessionKey: "session-key",
  form: "details",
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

function renderDetails(who: Account = account, formState: FormStateRow | null = null) {
  return render(<DetailsView account={who} campuses={campuses} details={detailsForm(who, formState)} />);
}

describe("Your details (accounts spec 3.2; role views spec 7.4)", () => {
  it("shows the first name, the email, the campus and when they joined", () => {
    renderDetails();
    expect(screen.getByRole("heading", { level: 2, name: "Thandi" })).toBeInTheDocument();
    expect(screen.getByText("Email").nextElementSibling).toHaveTextContent("student@eduvos.com");
    expect(screen.getByText("Campus").nextElementSibling).toHaveTextContent("Midrand");
    expect(screen.getByText("Member since September 2026")).toBeInTheDocument();
    expect(screen.queryByText("Hub role")).toBeNull();
  });

  it("starts Edit details on the account's details", () => {
    renderDetails();
    const edit = screen.getByRole("region", { name: "Edit details" });
    expect(within(edit).getByLabelText("Your first name")).toHaveValue("Thandi");
    expect(within(edit).getByRole("combobox", { name: "Your campus" })).toHaveValue("midrand");
    expect(within(edit).getByRole("button", { name: "Save changes" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the details were saved (plan decision 13)", () => {
    renderDetails(account, state({ notice: "saved" }));
    expect(screen.getByRole("status")).toHaveTextContent("Your details are saved.");
  });

  it("shows what was typed and what's wrong after a failed save", () => {
    renderDetails(account, state({ errors: ["first-name-length", "campus-missing"], values: { firstName: "T", campus: "" } }));
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    const name = screen.getByLabelText("Your first name");
    expect(name).toHaveValue("T");
    expect(name).toHaveAccessibleDescription(
      "Sellers see it when you message them. 2 to 40 characters. Error: Your first name must be 2 to 40 characters.",
    );
    expect(screen.getByRole("combobox", { name: "Your campus" })).toHaveValue("");
  });

  it("names a mentor's or an admin's Hub role (plan decision 16)", () => {
    renderDetails({ ...account, roles: ["admin"] });
    expect(screen.getByText("Hub role").nextElementSibling).toHaveTextContent("Admin");
  });
});
```

In `lib/auth/account-actions.test.ts`, change the two places that expect the old address:

```ts
    expect([redirect.url, redirect.type]).toEqual(["/account/details", "replace"]);
```

```ts
    expect(await redirectOf(() => updateDetails(form({ firstName: "Thandi", campus: "midrand" })))).toBe(
      "/login?next=%2Faccount%2Fdetails",
    );
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/account/DetailsView.test.tsx lib/auth/account-actions.test.ts`
Expected: FAIL (no `DetailsView`; the action still lands on `/account`).

- [ ] **Step 3: `components/account/DetailsView.tsx`**

```tsx
import { CampusSelect } from "@/components/forms/CampusSelect";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { updateDetails } from "@/lib/auth/actions";
import { DETAILS_FIELDS } from "@/lib/auth/form-state";
import { errorFor, formErrors, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sastMonthYear } from "@/lib/time";
import type { Account, Campus, StaffRole } from "@/lib/types";

export type DetailsForm = { firstName: string; campus: string; errors: FormError[]; saved: boolean };

/** Edit details' state: after a failed save, what was typed and what's wrong; otherwise the account's own details. */
export function detailsForm(account: Account, state: FormStateRow | null): DetailsForm {
  if (state && state.errors.length > 0) {
    return {
      firstName: state.values.firstName ?? account.firstName,
      campus: state.values.campus ?? account.campusSlug,
      errors: formErrors(state.errors, DETAILS_FIELDS),
      saved: false,
    };
  }
  return { firstName: account.firstName, campus: account.campusSlug, errors: [], saved: state?.notice === "saved" };
}

const ROLE_NAMES: Record<StaffRole, string> = { mentor: "Mentor", admin: "Admin" };

type DetailsViewProps = {
  account: Account;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  details: DetailsForm;
};

/**
 * Your details (accounts spec 3.2, moved off You by role views spec 7.4): who you are, and Edit details. The same card
 * and form the account page had, on a page of their own.
 */
export function DetailsView({ account, campuses, details }: DetailsViewProps) {
  const campusName = campuses.find((campus) => campus.slug === account.campusSlug)?.name ?? "None chosen";
  const nameError = errorFor(details.errors, DETAILS_FIELDS.firstName);
  const campusError = errorFor(details.errors, DETAILS_FIELDS.campus);
  return (
    <div className="account-body">
      <section aria-labelledby="account-you-title" className="account-card">
        <h2 id="account-you-title" className="account-name">
          {account.firstName}
        </h2>
        <dl className="account-facts">
          <div>
            <dt>Email</dt>
            <dd>{account.email}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          {account.roles.length > 0 && (
            <div>
              <dt>Hub role</dt>
              <dd>{account.roles.map((role) => ROLE_NAMES[role]).join(" and ")}</dd>
            </div>
          )}
        </dl>
        <p className="account-since">Member since {sastMonthYear(account.createdAt)}</p>
      </section>

      <section aria-labelledby="account-edit-title" className="account-section">
        <h2 id="account-edit-title" className="account-section-title">
          Edit details
        </h2>
        {details.saved && (
          <p role="status" className="form-notice">
            Your details are saved.
          </p>
        )}
        <ErrorSummary id="account-details-summary" errors={details.errors} />
        <form action={updateDetails} noValidate className="form-stack">
          <div className="form-field">
            <label htmlFor={DETAILS_FIELDS.firstName} className="form-label">
              Your first name
            </label>
            <p id="details-first-name-hint" className="form-hint">
              Sellers see it when you message them. 2 to 40 characters.
            </p>
            <FieldError id="details-first-name-error" message={nameError} />
            <input
              id={DETAILS_FIELDS.firstName}
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              maxLength={40}
              defaultValue={details.firstName}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={describedBy("details-first-name-hint", nameError && "details-first-name-error")}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label htmlFor={DETAILS_FIELDS.campus} className="form-label">
              Your campus
            </label>
            <FieldError id="details-campus-error" message={campusError} />
            <CampusSelect
              id={DETAILS_FIELDS.campus}
              defaultValue={details.campus}
              campuses={campuses}
              invalid={Boolean(campusError)}
              describedBy={describedBy(campusError && "details-campus-error")}
            />
          </div>
          <button type="submit" className="btn btn-primary form-submit">
            Save changes
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: The page** `app/account/details/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/AccountSkeleton";
import { DetailsView, detailsForm } from "@/components/account/DetailsView";
import { ArrowLeftIcon } from "@/components/icons";
import { PageTransition } from "@/components/kit/PageTransition";
import { DETAILS_FORM, readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { DETAILS_PATH, YOU_PATH } from "@/lib/you/paths";

/** Like every account page, kept out of search engines (accounts spec 3.3; `/account` is in robots.txt too). */
export const metadata: Metadata = { title: "Your details", robots: { index: false } };

/**
 * Your details (role views spec 7.4): the heading and the way back are prerendered; the card and the form need the
 * session, so they render per request inside <Suspense>, and a signed-out visitor is sent to sign in first (spec 2.10).
 */
export default function DetailsPage() {
  return (
    <PageTransition>
      <div className="page account-page">
        <Link href={YOU_PATH} className="account-crumb">
          <ArrowLeftIcon />
          Back to You
        </Link>
        <h1 className="account-title">Your details</h1>
        <Suspense fallback={<AccountSkeleton />}>
          <DetailsContent />
        </Suspense>
      </div>
    </PageTransition>
  );
}

async function DetailsContent() {
  const account = await requireAccount(DETAILS_PATH);
  const [campuses, state] = await Promise.all([getCampuses(), readFormState(DETAILS_FORM)]);
  return <DetailsView account={account} campuses={campuses} details={detailsForm(account, state)} />;
}
```

The crumb prefetches `/account` as the privacy page's crumb does (`app/account/privacy/page.tsx:24`): You has no client component of its own, so only its static shell comes.

- [ ] **Step 5: The action lands on Your details.** In `lib/auth/actions.ts`, add `import { DETAILS_PATH } from "@/lib/you/paths";` after the `@/lib/data/rows` import, and in `updateDetails` change

```ts
  const account = await requireAccount("/account");
```
to
```ts
  const account = await requireAccount(DETAILS_PATH);
```
and
```ts
  redirect("/account", RedirectType.replace);
```
to
```ts
  redirect(DETAILS_PATH, RedirectType.replace);
```

Change its doc comment's "on the account page (spec 3.2)" to "on Your details (spec 3.2; role views spec 7.4)".

Before that `redirect`, call `refresh()` so the browser drops its kept pages and Back to You shows the new name (as messaging's `done()` does): add `import { refresh } from "next/cache";` and

```ts
  // Drop the browser's kept pages, so Back to You shows the new name and campus (role views N5).
  refresh();
  redirect(DETAILS_PATH, RedirectType.replace);
```

In `lib/auth/account-actions.test.ts`, "saves the first name and campus, and says so" also checks `expect(request.refreshed).toBe(true);` (the `nextCache` stand-in records it, `tests/helpers/next-request.ts`).

The two crumbs that lead back here say "Back to You": in `app/account/privacy/page.tsx:26` and `components/looking-for/YourRequestsView.tsx:27`, "Back to your account" becomes "Back to You". Then `grep -rn "Back to your account" app components tests` must print nothing (update any test that looks for the old words).

- [ ] **Step 6: The ids test.** In `components/forms/summary-ids.test.tsx`, change line 3 to

```tsx
import { DetailsView, detailsForm } from "@/components/account/DetailsView";
```

and the `<AccountView … />` element (lines 222–227) to

```tsx
        <DetailsView
          account={account}
          campuses={campuses}
          details={{ ...detailsForm(account, null), errors: oops }}
        />
```

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run components/account/DetailsView.test.tsx lib/auth/account-actions.test.ts components/forms/summary-ids.test.tsx && pnpm typecheck`
Expected: `DetailsView` and the action pass. `summary-ids` passes. `typecheck` fails only in `app/account/page.tsx` and `components/account/AccountView.test.tsx` if they still import `detailsForm` from `AccountView`; Task 7 rewrites both. If anything else fails, fix it here.

- [ ] **Step 8: Commit (controller)** after Task 7, with it: the account page still imports the old form until then.

---

### Task 7: You

**Files:**
- Modify: `components/account/AccountView.tsx` (whole file: it now renders You), `components/account/AccountView.test.tsx` (whole file)
- Create: `components/account/you-skeleton.ts`, `components/account/YouBadge.test.tsx`
- Modify: `components/account/AccountSkeleton.tsx`, `app/account/page.tsx`, `app/globals.css`

- [ ] **Step 1: Write the failing tests.** Replace the whole of `components/account/AccountView.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dayMonth } from "@/lib/format";
import type { Account } from "@/lib/types";
import { ALL_CLEAR, forYouItems, type ForYou, type YourStuff } from "@/lib/you/model";
import { YouView } from "./AccountView";

// next/link draws a plain <a> in jsdom; this one shows `prefetch` as data, for the tests that check it.
vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const account: Account = {
  id: "acc-student",
  email: "student@eduvos.com",
  firstName: "Thandi",
  campusSlug: "midrand",
  roles: [],
  seller: null,
  createdAt: "2026-09-01T07:30:00.000Z",
};

const quiet: ForYou = { items: forYouItems({ conversations: 0, byKind: {} }), conversations: 0, newNotifications: 0 };
const busy: ForYou = {
  items: forYouItems({
    conversations: 2,
    byKind: { "search-match": { count: 1, newestHref: "/listings/l-001", newestText: "A calculator matches your search" } },
  }),
  conversations: 2,
  newNotifications: 3,
};
const empty: YourStuff = {
  savedListings: 0,
  followedShops: 0,
  requests: { open: 0, closed: 0, hidden: 0 },
  closingSoon: null,
  searches: { count: 0, alertsOn: 0 },
  bookings: [],
};

function renderYou({
  who = account,
  forYou = quiet,
  stuff = empty,
}: { who?: Account; forYou?: ForYou | null; stuff?: YourStuff | null } = {}) {
  return render(<YouView account={who} campusName="Midrand" forYou={forYou} stuff={stuff} />);
}

/** A card's rows as [title, address]. */
function rowsIn(card: string) {
  return within(screen.getByRole("region", { name: card }))
    .getAllByRole("link")
    .map((link) => [link.querySelector(".list-row-title")?.textContent, link.getAttribute("href")]);
}

describe("You (role views spec 7.4)", () => {
  it("greets the student by first name, with their campus", () => {
    renderYou();
    expect(screen.getByRole("heading", { level: 1, name: "Hi, Thandi" })).toBeInTheDocument();
    expect(screen.getByText("Midrand")).toBeInTheDocument();
  });

  it("says All clear when nothing is for you", () => {
    renderYou();
    const card = screen.getByRole("region", { name: "For you" });
    expect(within(card).getByText(ALL_CLEAR)).toBeInTheDocument();
    expect(within(card).queryByRole("list")).toBeNull();
  });

  it("lists only what's waiting, each one link", () => {
    renderYou({ forYou: busy });
    const list = screen.getByRole("list", { name: "For you" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/messages", "/notifications"]);
    expect(links[0]).toHaveAccessibleName(/2\s*Conversations with new messages/);
    expect(links[1]).toHaveAccessibleName(/1\s*New match for your saved searches\s*A calculator matches your search/);
  });

  it("lists Your stuff in order, the Messages and Notifications rows counting from For you", () => {
    renderYou({ forYou: busy });
    expect(rowsIn("Your stuff")).toEqual([
      ["Messages", "/messages"],
      ["Notifications", "/notifications"],
      ["Saved", "/saved"],
      ["Your requests", "/account/requests"],
      ["Saved searches", "/saved?tab=searches"],
      ["Hub bookings", "/hub"],
    ]);
    expect(screen.getByRole("link", { name: /^Messages\s+2 unread$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Notifications\s+3 new$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Saved\s+0 listings on this device · 0 shops followed$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Hub bookings\s+Nothing coming up$/ })).toBeInTheDocument();
  });

  it("never prefetches a row (decision 53; staff pages read the session)", () => {
    renderYou({ who: { ...account, roles: ["admin"], seller: { status: "approved", sellerSlug: "tech-corner" } } });
    for (const link of within(screen.getByRole("region", { name: "Your stuff" })).getAllByRole("link")) {
      expect(link.dataset.prefetch, link.textContent ?? "").toBe("false");
    }
  });

  it("shows Your shop only to a seller, with where it stands (plan decision 5)", () => {
    const student = renderYou();
    expect(screen.queryByRole("link", { name: /^Your shop/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Start selling/ })).toBeNull();
    student.unmount();
    const waiting = renderYou({ who: { ...account, seller: { status: "pending", sellerSlug: null } } });
    expect(screen.getByRole("link", { name: /^Your shop\s+Waiting for the Hub's approval$/ })).toHaveAttribute("href", "/sell");
    waiting.unmount();
    renderYou({ who: { ...account, seller: { status: "paused", sellerSlug: "tech-corner" } } });
    expect(screen.getByRole("link", { name: /^Your shop\s+Paused$/ })).toHaveAttribute("href", "/sell");
  });

  it("gives staff their tools by role, after Your shop (plan decision 6)", () => {
    const admin = renderYou({ who: { ...account, roles: ["admin"] } });
    expect(rowsIn("Your stuff").slice(6)).toEqual([
      ["Admin console", "/admin"],
      ["Hub posts and office hours", "/hub/manage"],
      ["Mentor dashboard", "/mentor"],
    ]);
    admin.unmount();
    renderYou({ who: { ...account, roles: ["mentor"] } });
    expect(rowsIn("Your stuff").slice(6)).toEqual([
      ["Hub posts and office hours", "/hub/manage"],
      ["Mentor dashboard", "/mentor"],
    ]);
  });

  it("warns when a request closes soon, linking to Your requests (plan decision 8)", () => {
    renderYou({ stuff: { ...empty, requests: { open: 1, closed: 0, hidden: 0 }, closingSoon: { title: "Desk lamp", closesOn: "2026-10-24", count: 1 } } });
    expect(screen.getByText(`Your request Desk lamp closes automatically on ${dayMonth("2026-10-24")}.`, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your requests" })).toHaveAttribute("href", "/account/requests");
  });

  it("has no banner when nothing closes soon", () => {
    renderYou();
    expect(screen.queryByText(/closes automatically/)).toBeNull();
  });

  it("ends with Settings: Your details, Privacy and Sign out", () => {
    renderYou();
    expect(rowsIn("Settings")).toEqual([
      ["Your details", "/account/details"],
      ["Privacy", "/account/privacy"],
    ]);
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(signOut).toHaveAttribute("type", "submit");
    expect(signOut.closest("form")).toHaveAttribute("action", "/logout");
    expect(signOut.closest("form")).toHaveAttribute("method", "post");
  });

  it("keeps working when a reader fails: that card says so, the rest stays (role views spec 8)", () => {
    renderYou({ forYou: null, stuff: null });
    expect(within(screen.getByRole("region", { name: "For you" })).getByText("For you didn't load.")).toBeInTheDocument();
    const stuff = screen.getByRole("region", { name: "Your stuff" });
    expect(within(stuff).getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages");
    expect(within(stuff).getByText("Your saved things, requests and bookings didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
```

`components/account/YouBadge.test.tsx`, the "badge equals the list" check (spec 4.2):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabAccount } from "@/components/tabbar/TabBar";
import { forYouItems, forYouTotal } from "@/lib/you/model";
import { YouView } from "./AccountView";

const parts = vi.hoisted(() => ({
  // Three unread conversations, one of them the offer's thread: the messages row counts 2 (plan decision 1).
  conversations: 3,
  byKind: {
    offer: { count: 1, newestHref: "/messages/conv-9", newestText: "Tech corner offered" },
    "search-match": { count: 3, newestHref: "/browse", newestText: "Matches" },
    "new-listing": { count: 1, newestHref: "/listings/l-001", newestText: "Tech corner listed a kettle" },
  },
}));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => ({ id: "acc-student" }) }));
vi.mock("@/lib/you/read", async () => {
  const { forYouItems: items } = await import("@/lib/you/model");
  return { readForYou: async () => ({ items: items(parts), conversations: parts.conversations, newNotifications: 9 }) };
});

describe("the You tab's badge equals For you's list (role views spec 4.2)", () => {
  it("shows the sum of the rows the page lists", async () => {
    const forYou = { items: forYouItems(parts), conversations: parts.conversations, newNotifications: 9 };
    const tab = render(await TabAccount());
    const badge = Number.parseInt(screen.getByRole("link", { name: "You" }).querySelector(".hdr-badge")!.textContent!, 10);
    tab.unmount();

    render(
      <YouView
        account={{ id: "acc-student", email: "s@eduvos.com", firstName: "Thandi", campusSlug: "midrand", roles: [], seller: null, createdAt: "2026-09-01T07:30:00.000Z" }}
        campusName="Midrand"
        forYou={forYou}
        stuff={null}
      />,
    );
    const listed = [...document.querySelectorAll(".needs-count")].reduce((sum, el) => sum + Number(el.textContent), 0);
    expect(badge).toBe(7);
    expect(listed).toBe(badge);
    expect(forYouTotal(forYou.items)).toBe(badge);
  });
});
```

In `tests/helpers/next-link.tsx`, keep N1's `transitionTypes` off the `<a>`, so React doesn't warn about an unknown attribute: add `transitionTypes,` after `children,` in `nextLinkShowingPrefetch`'s parameter list, `transitionTypes?: readonly string[];` to its props type, and `void transitionTypes;` as the first line of a block body:

```tsx
export const nextLinkShowingPrefetch = {
  default: ({
    href,
    prefetch,
    children,
    transitionTypes,
    ...rest
  }: {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
    className?: string;
    transitionTypes?: readonly string[];
  }) => {
    // next/link's own prop (N1's ListRow and NeedsYouList pass it): not an attribute of the <a>.
    void transitionTypes;
    return (
      <a href={href} data-prefetch={prefetch === undefined ? "auto" : String(prefetch)} {...rest}>
        {children}
      </a>
    );
  },
};
```

If N1 already did this, leave it.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/account`
Expected: FAIL (`YouView` doesn't exist).

- [ ] **Step 3: The skeleton.** `components/account/you-skeleton.ts`:

```ts
/**
 * YouSkeleton's blocks, top to bottom (role views N5): the greeting, For you, and the rows. A plain list with no JSX,
 * so tests/e2e/you.spec.ts can build the same shape and check it is no taller than the shortest You (spec 9).
 */
export const YOU_SKELETON_BLOCKS = ["you-skeleton-head", "you-skeleton-card", "you-skeleton-rows"] as const;
```

In `components/account/AccountSkeleton.tsx`, add below `AccountSkeleton`:

```tsx
/**
 * You's shape while it streams in (role views spec 9): shorter than its shortest state, a new account's (All clear,
 * six rows, Settings), so nothing below moves up when the page arrives; the page is a screen tall, so the footer
 * stays below the first screen meanwhile.
 */
export function YouSkeleton() {
  return (
    <div className="you-skeleton-body" aria-hidden="true">
      {YOU_SKELETON_BLOCKS.map((block) => (
        <span key={block} className={`skeleton ${block}`} />
      ))}
    </div>
  );
}
```

and at its top:

```tsx
import { YOU_SKELETON_BLOCKS } from "./you-skeleton";
```

Change `AccountSkeleton`'s comment to "Your details' and privacy settings' shape while they stream in (spec 3.2): the details card and the form."

- [ ] **Step 4: You.** Replace the whole of `components/account/AccountView.tsx` with:

```tsx
import type { ReactNode } from "react";
import { SectionError } from "@/components/home/SectionError";
import {
  AlertIcon,
  CalendarIcon,
  FlagIcon,
  GridIcon,
  HeartIcon,
  InfoIcon,
  MapPinIcon,
  MessageIcon,
  SearchIcon,
  ShieldIcon,
  StoreIcon,
  UserIcon,
} from "@/components/icons";
import { Banner } from "@/components/kit/Banner";
import { Card } from "@/components/kit/Card";
import { ListRow } from "@/components/kit/ListRow";
import { NeedsYouList } from "@/components/kit/NeedsYouList";
import { SIGN_OUT_PATH } from "@/lib/auth/post-paths";
import { savedTabPath } from "@/lib/following/rules";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { AREA_HOME } from "@/lib/staff/paths";
import { staffAreasOf } from "@/lib/staff/roles";
import type { Account } from "@/lib/types";
import {
  ALL_CLEAR,
  bookingsRow,
  closingSoonText,
  requestsDetail,
  savedDetail,
  searchesDetail,
  shopDetail,
  type ForYou,
  type YourStuff,
} from "@/lib/you/model";
import { DETAILS_PATH, YOU_PATH } from "@/lib/you/paths";

const icon = (node: ReactNode) => ({ kind: "icon" as const, icon: node });

type YouViewProps = {
  account: Account;
  campusName: string;
  /** Null when its read failed: the card says so (role views spec 8). */
  forYou: ForYou | null;
  stuff: YourStuff | null;
};

/**
 * You (role views spec 7.4): the greeting, For you, a banner when a request closes soon, Your stuff and Settings, in
 * one column of kit cards. Every row is a ListRow, which never prefetches (decision 53; staff pages read the session).
 * A failed reader shows its card's error and leaves the rest working.
 */
export function YouView({ account, campusName, forYou, stuff }: YouViewProps) {
  return (
    <div className="you-body">
      <header className="you-head">
        {/* One text node, so "Hi, Thandi" is one string in the document (plan decision 13). */}
        <h1 className="account-title">{`Hi, ${account.firstName}`}</h1>
        <p className="you-campus">
          <MapPinIcon /> {campusName}
        </p>
      </header>

      <div id="you-for-you">
        <Card title="For you">
          {forYou ? (
            <NeedsYouList label="For you" items={forYou.items} allClear={ALL_CLEAR} />
          ) : (
            <SectionError id="you-for-you" title="For you" path={YOU_PATH} />
          )}
        </Card>
      </div>

      {stuff?.closingSoon && (
        <Banner tone="warning" icon={<AlertIcon />} action={{ label: "Your requests", href: YOUR_REQUESTS_PATH }}>
          {closingSoonText(stuff.closingSoon)}
        </Banner>
      )}

      <div id="you-stuff">
        <Card title="Your stuff">
          <ul className="you-rows">
            <ListRow
              href="/messages"
              lead={icon(<MessageIcon />)}
              title="Messages"
              detail={forYou && forYou.conversations > 0 ? `${forYou.conversations} unread` : undefined}
            />
            <ListRow
              href="/notifications"
              lead={icon(<InfoIcon />)}
              title="Notifications"
              detail={forYou && forYou.newNotifications > 0 ? `${forYou.newNotifications} new` : undefined}
            />
            {stuff ? (
              <StuffRows stuff={stuff} />
            ) : (
              <li className="you-rows-error">
                <SectionError id="you-stuff" title="Your saved things, requests and bookings" path={YOU_PATH} />
              </li>
            )}
            {account.seller && (
              <ListRow href="/sell" lead={icon(<StoreIcon />)} title="Your shop" detail={shopDetail(account.seller)} />
            )}
            {staffAreasOf(account).map((area) => (
              <ListRow key={area} href={AREA_HOME[area].href} lead={icon(<GridIcon />)} title={AREA_HOME[area].label} />
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Settings">
        <ul className="you-rows">
          <ListRow href={DETAILS_PATH} lead={icon(<UserIcon />)} title="Your details" detail="Your name and campus" />
          <ListRow
            href="/account/privacy"
            lead={icon(<ShieldIcon />)}
            title="Privacy"
            detail="Your data, and deleting your account"
          />
        </ul>
        <form action={SIGN_OUT_PATH} method="post" className="you-signout">
          <button type="submit" className="btn btn-outline text-navy">
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}

/** The rows that come from readYourStuff. */
function StuffRows({ stuff }: { stuff: YourStuff }) {
  const bookings = bookingsRow(stuff.bookings);
  return (
    <>
      <ListRow href="/saved" lead={icon(<HeartIcon />)} title="Saved" detail={savedDetail(stuff)} />
      <ListRow
        href={YOUR_REQUESTS_PATH}
        lead={icon(<FlagIcon />)}
        title="Your requests"
        detail={requestsDetail(stuff.requests)}
      />
      <ListRow
        href={savedTabPath("searches")}
        lead={icon(<SearchIcon />)}
        title="Saved searches"
        detail={searchesDetail(stuff.searches)}
      />
      <ListRow href={bookings.href} lead={icon(<CalendarIcon />)} title="Hub bookings" detail={bookings.detail} />
    </>
  );
}
```

`SectionError` (`components/home/SectionError.tsx`) says "{title} didn't load." with a Try again link to `{path}?retry={id}#{id}`; the two wrapper `div`s carry those ids.

- [ ] **Step 5: The page.** Replace the whole of `app/account/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { YouSkeleton } from "@/components/account/AccountSkeleton";
import { YouView } from "@/components/account/AccountView";
import { PageTransition } from "@/components/kit/PageTransition";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { YOU_PATH } from "@/lib/you/paths";
import { readForYou, readYourStuff } from "@/lib/you/read";

/** One person's hub, so search engines leave it out (accounts spec 3.3; `/account` is in robots.txt too). */
export const metadata: Metadata = { title: "You", robots: { index: false } };

/**
 * You (role views spec 7.4): everything needs the session, so the static shell is the skeleton and the page renders per
 * request inside <Suspense> (plan decision 13). A signed-out visitor is sent to sign in, and comes back here (spec 2.10).
 */
export default function YouPage() {
  return (
    <PageTransition>
      <div className="page account-page you-page">
        <Suspense fallback={<YouSkeleton />}>
          <YouContent />
        </Suspense>
      </div>
    </PageTransition>
  );
}

async function YouContent() {
  const account = await requireAccount(YOU_PATH);
  // requireAccount awaited connection() as it found the session, so the readers may read the clock (decision 26).
  const now = new Date();
  // Each card's read fails on its own: its card says so, and the rest of the page works (role views spec 8).
  const [campuses, forYou, stuff] = await Promise.all([
    getCampuses().catch(() => []),
    readForYou(account.id).catch(() => null),
    readYourStuff(account.id, now).catch(() => null),
  ]);
  const campusName = campuses.find((campus) => campus.slug === account.campusSlug)?.name ?? "No campus chosen";
  return <YouView account={account} campusName={campusName} forYou={forYou} stuff={stuff} />;
}
```

- [ ] **Step 6: The CSS.** In `app/globals.css`'s "Streaming: the footer stays below the first screen" block (lines 2021–2075), add `.you-page,` to each of its three selector lists, before `.notes-page`. The first list becomes

```css
  .page-fallback,
  .saved-page,
  .browse,
  .request-form-page,
  .requests-page,
  .offer-page,
  .inbox-page,
  .thread-page,
  .you-page,
  .notes-page {
```

and the two inside the media queries the same, at their own indent. Add to the block's comment, after its last sentence: "So is You (role views N5), whose skeleton is shorter than any of its states."

At the very end of `app/globals.css`, add:

```css
/* --- Role views: You (N5; role views spec 7.4) -----------------------------------------------------------------------
   /account as the buyer's hub: the greeting, For you, the closing-soon banner, Your stuff and Settings, as kit cards in
   one readable column. The page is a screen tall (the streaming block above), so the footer stays below the first
   screen while it arrives. */
@layer components {
  /* The page and its skeleton share the column; the skeleton has a class of its own, so tests can tell them apart. */
  .you-body,
  .you-skeleton-body {
    display: grid;
    gap: 20px;
    max-width: 40rem;
  }

  .you-head {
    display: grid;
    gap: 8px;
  }

  /* Muted on white is 5.9:1; the pin is sky-dark, 4.7:1, beside the words. */
  .you-campus {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 14px;
  }

  .you-campus svg {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--color-sky-dark);
  }

  .you-rows li + li {
    border-top: 1px solid var(--color-line);
  }

  .you-rows-error {
    padding-block: 8px;
  }

  .you-signout {
    justify-self: start;
    margin-top: 4px;
  }

  /* YouSkeleton (components/account/you-skeleton.ts): together shorter than a new account's You (spec 9), checked by
     tests/e2e/you.spec.ts at 390 and 1440. */
  .you-skeleton-head {
    height: 3.5rem;
    border-radius: var(--radius-card);
  }

  .you-skeleton-card {
    height: 6rem;
    border-radius: var(--radius-card);
  }

  .you-skeleton-rows {
    height: 22rem;
    border-radius: var(--radius-card);
  }
}
```

`--radius-card` is the kit card's radius (N1 Task 2). If N1 named it otherwise, use N1's.

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run components/account components/forms lib/you && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Look at it.** Start the dev server (`pnpm dev --port 3100`, or the `vossie-dev` preview), sign in as "Student, Midrand", and open `/account` at 390 and 1440px, then `/account/details`. Check: the greeting and campus; "Conversation with new messages" in For you; the six rows; Your details opens the form, and Save changes lands back on Your details with "Your details are saved.". Stop your own server by its PID when done.

- [ ] **Step 9: Commit (controller)** — Tasks 6 and 7 together

```bash
git status
```

```bash
git add components/account app/account/page.tsx app/account/details app/account/privacy/page.tsx components/looking-for/YourRequestsView.tsx tests/helpers/next-link.tsx lib/auth/actions.ts lib/auth/account-actions.test.ts components/forms/summary-ids.test.tsx app/globals.css
git commit -m "feat: You at /account (greeting, For you, the closing-soon banner, Your stuff, Settings) and Your details at /account/details, with the badge-equals-list test (role views N5 Tasks 6 and 7)"
```

---

### Task 8: Looking For in the menu

Beside Hub, in the drawer's own list (plan decision 11).

**Files:**
- Modify: `components/menu/MenuDrawer.tsx` (the main list, after the Hub item, lines 127–129), `components/menu/MenuDrawer.test.tsx`

- [ ] **Step 1: Update the test first.** In `components/menu/MenuDrawer.test.tsx`, "shows the main links" (line 47): change the names list to `["Sell", "Hub", "Looking For", "How it works", "Safety", "Sign in"]`, and add

```tsx
    expect(within(menu).getByRole("link", { name: "Looking For" })).toHaveAttribute("href", "/looking-for");
    const names = within(menu).getAllByRole("link").map((link) => link.textContent);
    expect(names.indexOf("Looking For")).toBe(names.indexOf("Hub") + 1);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/menu`
Expected: FAIL (no Looking For link).

- [ ] **Step 3: Implement.** In `components/menu/MenuDrawer.tsx`, after

```tsx
              <li>
                <NavLink href="/hub">Hub</NavLink>
              </li>
```

add

```tsx
              <li>
                {/* No prefetch (decision 53): the menu's links come into view together when it opens. */}
                <NavLink href="/looking-for" prefetch={false}>
                  Looking For
                </NavLink>
              </li>
```

The drawer's own `closeOnLink` closes it when the link is followed.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/menu && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/menu/MenuDrawer.tsx components/menu/MenuDrawer.test.tsx
git commit -m "feat: Looking For in the menu, beside Hub (role views N5 Task 8)"
```

---

### Task 9: "Your requests (N open)" on the board

**Files:**
- Create: `components/looking-for/YourRequestsLink.tsx`, `components/looking-for/YourRequestsLink.test.tsx`
- Modify: `app/looking-for/page.tsx`, `app/globals.css` (`.board-post`, lines 6091–6093 and 6283–6287; the N5 block)

- [ ] **Step 1: Write the failing test** `components/looking-for/YourRequestsLink.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourRequestsLink } from "./YourRequestsLink";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null, open: 0, failing: false }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/data/requests", () => ({
  countOpenRequests: async () => {
    if (viewer.failing) throw new Error("The store didn't answer");
    return viewer.open;
  },
}));

afterEach(() => {
  viewer.account = null;
  viewer.open = 0;
  viewer.failing = false;
});

describe("Your requests on the board (role views spec 7.4)", () => {
  it("is nothing signed out", async () => {
    expect(await YourRequestsLink()).toBeNull();
  });

  it("is nothing with no open request, or when the count fails", async () => {
    viewer.account = { id: "acc-student" };
    expect(await YourRequestsLink()).toBeNull();
    viewer.open = 2;
    viewer.failing = true;
    expect(await YourRequestsLink()).toBeNull();
  });

  it("links an asker to Your requests with the open count, with no prefetch", async () => {
    viewer.account = { id: "acc-student" };
    viewer.open = 2;
    render((await YourRequestsLink())!);
    const link = screen.getByRole("link", { name: "Your requests (2 open)" });
    expect(link).toHaveAttribute("href", "/account/requests");
    expect(link.dataset.prefetch).toBe("false");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/looking-for/YourRequestsLink.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `components/looking-for/YourRequestsLink.tsx`

```tsx
import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { countOpenRequests } from "@/lib/data/requests";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";

/**
 * "Your requests (N open)" beside Post a request (role views spec 7.4, plan decision 16), for a signed-in student with
 * an open request. Request-time: the board gives it a <Suspense> of its own with nothing as the fallback; the button
 * holds the row's height, so nothing moves when it arrives. A failed read shows nothing. No prefetch (decision 53).
 */
export async function YourRequestsLink() {
  const account = await getViewer().catch(() => null);
  if (!account) return null;
  // getViewer awaited connection() before it found the account, so the clock can be read (decision 26). The count
  // settles first, as Your requests does (stage L).
  const open = await countOpenRequests(account.id, new Date()).catch(() => 0);
  if (open === 0) return null;
  return (
    <Link href={YOUR_REQUESTS_PATH} prefetch={false} className="board-yours">
      {`Your requests (${open} open)`}
    </Link>
  );
}
```

- [ ] **Step 4: The board.** In `app/looking-for/page.tsx`, add `import { YourRequestsLink } from "@/components/looking-for/YourRequestsLink";` after the `RequestBoard` import, and replace

```tsx
        <PostRequestLink className="btn btn-primary board-post">Post a request</PostRequestLink>
```

with

```tsx
        <div className="board-actions">
          <PostRequestLink className="btn btn-primary board-post">Post a request</PostRequestLink>
          <Suspense fallback={null}>
            <YourRequestsLink />
          </Suspense>
        </div>
```

Add to the page's doc comment: "A signed-in asker also gets Your requests with their open count beside it (role views N5)."

- [ ] **Step 5: The CSS.** In `app/globals.css`, replace

```css
  .board-post {
    margin-top: 4px;
  }
```

with

```css
  /* Post a request, and Your requests once the session says there are some (role views N5). The button sets the row's
     height, so the link arriving moves nothing; its words wrap inside it on a narrow phone. */
  .board-actions {
    display: flex;
    align-items: center;
    gap: 8px 16px;
    margin-top: 4px;
  }

  .board-post {
    flex: none;
  }
```

and in the tablet rule (lines 6283–6287) replace

```css
    .board-post {
      grid-column: 2;
      grid-row: 1 / span 2;
      margin-top: 0;
    }
```

with

```css
    .board-actions {
      grid-column: 2;
      grid-row: 1 / span 2;
      margin-top: 0;
    }
```

Check nothing else styles `.board-post` by grid position: `grep -n "board-post" app/globals.css components tests -r`. In the N5 block at the end of the file, before its closing `}`, add:

```css
  /* Your requests beside Post a request on the board. Sky-dark on white, 4.7:1, underlined. */
  .board-yours {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run components/looking-for && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit (controller)**

```bash
git add components/looking-for/YourRequestsLink.tsx components/looking-for/YourRequestsLink.test.tsx app/looking-for/page.tsx app/globals.css
git commit -m "feat: the board shows a signed-in asker Your requests with their open count (role views N5 Task 9)"
```

---

### Task 10: The home strip: no `savedItemsBack`, a notifications line

The strip's lines move to the server (plan decision 12); `ContextStripView` (client) only places them, so it gets smaller.

**Files:**
- Modify: `lib/types.ts` (`ViewerActivity`, line 222), `lib/data/accounts.ts` (lines 158–168), `lib/data/supabase/accounts.ts` (lines 139–147), `lib/data/viewer.ts` (line 12)
- Create: `components/home/ActivityLines.tsx`, `components/home/ActivityLines.test.tsx`
- Modify: `components/home/ContextStrip.tsx`, `components/home/ContextStripView.tsx`, `components/home/ContextStrip.test.tsx`
- Modify: `lib/data/accounts.test.ts` (lines 111–115), `lib/data/viewer.test.ts` (lines 39, 76–77), `lib/data/contract/messages-read.db.test.ts` (lines 67–79)
- Modify: `app/globals.css` (the N5 block)

- [ ] **Step 1: Update the tests first.**

`lib/data/accounts.test.ts`, the strip's test becomes:

```ts
  it("counts new messages, sales to confirm and new notifications for the context strip (spec 2.9; role views N5)", async () => {
    expect(await getAccountActivity("acc-student", NOW)).toEqual({ newMessages: 1, salesToConfirm: 1, newNotifications: 2 });
    expect(await getAccountActivity("acc-mentor", NOW)).toEqual({ newMessages: 0, salesToConfirm: 0, newNotifications: 0 });
    expect(await getAccountActivity("acc-nope", NOW)).toBeNull();
  });
```

(Thandi's two are `note-s1` and `note-s2`, `data/fixtures/messages.ts:89-110`.)

`lib/data/viewer.test.ts`: in the `./accounts` mock, `{ newMessages: 0, salesToConfirm: 0, savedItemsBack: 0 }` becomes `{ newMessages: 0, salesToConfirm: 0, newNotifications: 0 }`; in "passes the account's activity on when there is some", both `{ newMessages: 2, salesToConfirm: 0, savedItemsBack: 0 }` become `{ newMessages: 2, salesToConfirm: 0, newNotifications: 0 }`. Add:

```ts
  it("shows the strip for new notifications alone (role views N5)", async () => {
    session.accountId = "acc-student";
    session.activity = { newMessages: 0, salesToConfirm: 0, newNotifications: 1 };
    expect((await getViewerContext()).activity).toEqual({ newMessages: 0, salesToConfirm: 0, newNotifications: 1 });
  });
```

Check the `session` hoisted object's `activity` type in that file and widen it if it names `savedItemsBack`.

`lib/data/contract/messages-read.db.test.ts`, the strip's test's first expectation becomes:

```ts
    const activity = await world.asViewer("shopper", () => getAccountActivity(shopper, new Date()));
    expect(activity).toMatchObject({ newMessages: 1, salesToConfirm: 0 });
    expect(Object.keys(activity!).sort()).toEqual(["newMessages", "newNotifications", "salesToConfirm"]);
```

`components/home/ActivityLines.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityLines } from "./ActivityLines";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

describe("the signed-in strip's lines (spec 7.4; role views N5)", () => {
  it("says what's new, each count in words", () => {
    render(<ActivityLines activity={{ newMessages: 2, salesToConfirm: 1, newNotifications: 0 }} />);
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("1 sale to confirm")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links new notifications to Notifications, with no prefetch", () => {
    render(<ActivityLines activity={{ newMessages: 1, salesToConfirm: 0, newNotifications: 1 }} />);
    expect(screen.getByText("1 new message")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "1 new notification" });
    expect(link).toHaveAttribute("href", "/notifications");
    expect(link.dataset.prefetch).toBe("false");
  });

  it("says nothing about saved items coming back: that line is gone (role views N5)", () => {
    render(<ActivityLines activity={{ newMessages: 0, salesToConfirm: 0, newNotifications: 3 }} />);
    expect(screen.queryByText(/saved/i)).toBeNull();
    expect(screen.getByRole("link", { name: "3 new notifications" })).toBeInTheDocument();
  });
});
```

Replace `components/home/ContextStrip.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import { ContextStripContent } from "./ContextStrip";
import { ContextStripView } from "./ContextStripView";

const viewer = vi.hoisted(() => ({ signedIn: true }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({
    campus: "all",
    signedIn: viewer.signedIn,
    activity: viewer.signedIn ? { newMessages: 2, salesToConfirm: 1, newNotifications: 3 } : null,
  }),
}));

describe("ContextStripView (spec 7.4)", () => {
  it("shows the trust strip on a first visit", () => {
    render(<ContextStripView activity={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Why you can trust CampusCart" })).toBeInTheDocument();
    expect(screen.getByText("Verified Incubation Hub sellers")).toBeInTheDocument();
    expect(screen.getByText("Never pay before you see it")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How trust works" })).toHaveAttribute("href", "/trust");
  });

  it("picks up where a returning visitor left off", () => {
    recordRecentlyViewed({ id: "l-001", title: "Casio calculator", image: { src: "/p.svg", alt: "" } });
    render(<ContextStripView activity={null} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pick up where you left off" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Casio calculator" })).toHaveAttribute("href", "/listings/l-001");
  });

  it("places the server's lines when signed in, with the inbox link", () => {
    render(<ContextStripView activity={<ul className="context-activity"><li>2 new messages</li></ul>} />);
    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open inbox" })).toHaveAttribute("href", "/messages");
  });
});

describe("ContextStripContent", () => {
  it("draws the viewer's activity on the server and hands it to the strip", async () => {
    viewer.signedIn = true;
    render(await ContextStripContent());
    expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("1 sale to confirm")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "3 new notifications" })).toHaveAttribute("href", "/notifications");
  });

  it("shows the trust strip to a signed-out first visitor", async () => {
    viewer.signedIn = false;
    render(await ContextStripContent());
    expect(screen.getByRole("heading", { level: 2, name: "Why you can trust CampusCart" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/data/accounts.test.ts lib/data/viewer.test.ts components/home/ContextStrip.test.tsx components/home/ActivityLines.test.tsx`
Expected: FAIL.

- [ ] **Step 3: The numbers.** In `lib/types.ts`, `ViewerActivity` becomes:

```ts
export type ViewerActivity = {
  newMessages: number;
  salesToConfirm: number;
  /** New notifications, of any kind: the strip's link to Notifications (role views N5). */
  newNotifications: number;
};
```

In `lib/data/accounts.ts`, replace `getAccountActivity` and its comment with:

```ts
/**
 * The numbers for the context strip (spec 2.9 and 3.4; role views N5), or null when the account has gone: its unread
 * messages, the sales it has to confirm and its new notifications, from stage E's store (messaging spec 3.6). `now`
 * settles the 7-day auto-confirm (messaging spec 2.5).
 */
export async function getAccountActivity(accountId: string, now: Date): Promise<ViewerActivity | null> {
  if (onSupabase()) return (await supabase()).getAccountActivity(accountId, now);
  if (!sampleStore().accounts.has(accountId)) return null;
  const counts = await unreadCounts(accountId, now);
  return { newMessages: counts.messages, salesToConfirm: counts.salesToConfirm, newNotifications: counts.notifications };
}
```

In `lib/data/supabase/accounts.ts`, `getAccountActivity`'s return becomes

```ts
  return { newMessages: counts.messages, salesToConfirm: counts.salesToConfirm, newNotifications: counts.notifications };
```

In `lib/data/viewer.ts` (this changes who gets the signed-in strip: plan decision 19, for Lama), `worthShowing`'s test becomes

```ts
  return activity.newMessages + activity.salesToConfirm + activity.newNotifications > 0 ? activity : null;
```

- [ ] **Step 4: The server lines** `components/home/ActivityLines.tsx`

```tsx
import Link from "next/link";
import type { ViewerActivity } from "@/lib/types";

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The signed-in strip's lines (spec 7.4; role views N5, plan decision 12), drawn on the server and handed to
 * ContextStripView as a node, so a line costs the homepage no client code. New notifications is a link to
 * Notifications, white on the navy strip and 44px tall. Add strip lines here, never in the client view.
 */
export function ActivityLines({ activity }: { activity: ViewerActivity }) {
  const { newMessages, salesToConfirm, newNotifications } = activity;
  return (
    <ul className="context-activity">
      {newMessages > 0 && (
        <li>
          <span className="context-dot" aria-hidden="true" />
          {counted(newMessages, "new message", "new messages")}
        </li>
      )}
      {salesToConfirm > 0 && (
        <li>
          <span className="context-dot" aria-hidden="true" />
          {counted(salesToConfirm, "sale to confirm", "sales to confirm")}
        </li>
      )}
      {newNotifications > 0 && (
        <li>
          <span className="context-dot" aria-hidden="true" />
          {/* No prefetch (decision 53). Opening Notifications reads them (messaging spec 2.9). */}
          <Link href="/notifications" prefetch={false} className="context-activity-link">
            {counted(newNotifications, "new notification", "new notifications")}
          </Link>
        </li>
      )}
    </ul>
  );
}
```

- [ ] **Step 5: The strip.** In `components/home/ContextStrip.tsx`, add `import { ActivityLines } from "./ActivityLines";` and change `ContextStripContent` to:

```tsx
export async function ContextStripContent() {
  const { activity } = await getViewerContext();
  // The lines are drawn here, on the server; the client view only places them (role views N5, plan decision 12).
  return <ContextStripView activity={activity ? <ActivityLines activity={activity} /> : null} />;
}
```

In `components/home/ContextStripView.tsx` (the one client file this stage edits; it only loses code):
- replace `import type { ViewerActivity } from "@/lib/types";` with `import type { ReactNode } from "react";`;
- change the component's signature and first branch to

```tsx
export function ContextStripView({ activity }: { activity: ReactNode }) {
  const viewed = useRecentlyViewed();
  if (activity) return <SignedInStrip lines={activity} viewed={viewed} />;
```

- replace the whole `SignedInStrip` function with

```tsx
function SignedInStrip({ lines, viewed }: { lines: ReactNode; viewed: readonly ViewedItem[] }) {
  return (
    <div className="context-strip context-signed-in surface-navy">
      <h2 id="context-title" className="context-welcome">
        Welcome back
      </h2>
      {/* The lines come drawn from the server (ActivityLines, role views N5). */}
      {lines}
      {viewed.length > 0 && <ViewedThumbs viewed={viewed} />}
      {/* No prefetch (CLAUDE.md, decision 53). The inbox is messaging's (messaging spec 3.6). */}
      <Link href="/messages" prefetch={false} className="context-link">
        Open inbox
      </Link>
    </div>
  );
}
```

Update the doc comment above `ContextStripView` to say "activity when signed in (lines drawn on the server)".

In `app/globals.css`'s N5 block, before its closing `}`, add:

```css
  /* The strip's notifications line (ActivityLines): a link on the navy strip, white and underlined, 44px tall. */
  .context-activity-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-white);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
```

- [ ] **Step 6: Nothing else names the old field**

```bash
grep -rn "savedItemsBack" app components lib tests supabase
```
Expected: no output.

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run lib/data/accounts.test.ts lib/data/viewer.test.ts components/home && pnpm typecheck && pnpm lint`
Expected: PASS.

Run: `pnpm test:db lib/data/contract/messages-read.db.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit (controller)**

```bash
git add lib/types.ts lib/data/accounts.ts lib/data/supabase/accounts.ts lib/data/viewer.ts lib/data/accounts.test.ts lib/data/viewer.test.ts lib/data/contract/messages-read.db.test.ts components/home/ActivityLines.tsx components/home/ActivityLines.test.tsx components/home/ContextStrip.tsx components/home/ContextStripView.tsx components/home/ContextStrip.test.tsx app/globals.css
git commit -m "feat: the home strip's lines are drawn on the server, the dead savedItemsBack line is gone from both backends, and new notifications link to Notifications (role views N5 Task 10)"
```

---

### Task 11: Looking For in the header's quick links

Plan decision 10. The quick links show from the desktop step.

**Files:**
- Modify: `components/header/SiteHeader.tsx` (the quick links, lines 62–85), `components/header/SiteHeader.test.tsx`

- [ ] **Step 1: Update the test first.** In `components/header/SiteHeader.test.tsx`, using the file's own way of rendering the header, add:

```tsx
  it("has Looking For in the quick links, after Hub (role views N5)", () => {
    // Render as the file's other tests do.
    const quick = screen.getByRole("navigation", { name: "Quick links" });
    const link = within(quick).getByRole("link", { name: "Looking For" });
    expect(link).toHaveAttribute("href", "/looking-for");
    const names = within(quick).getAllByRole("link").map((item) => item.textContent);
    expect(names.indexOf("Looking For")).toBe(names.indexOf("Hub") + 1);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/header/SiteHeader.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add the link** after the Hub item in the `hdr-quick` list:

```tsx
          <li>
            <NavLink href="/looking-for" prefetch={false}>
              Looking For
            </NavLink>
          </li>
```

Check the row still fits at 1024 and 1440px (`pnpm dev --port 3100`, then look; stop your own server by PID). If it wraps at 1024, tell the controller rather than shrinking the type.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/header && pnpm typecheck`
Expected: PASS. Task 13's menu test checks the link at desktop width too (add `if (project() === "desktop-1440") await expect(page.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name: "Looking For" })).toHaveAttribute("href", "/looking-for");` before opening the menu, importing `project`).

- [ ] **Step 5: Commit (controller)**

```bash
git add components/header/SiteHeader.tsx components/header/SiteHeader.test.tsx
git commit -m "feat: Looking For in the header's quick links (role views N5 Task 11)"
```

---

### Task 12: Existing end-to-end tests follow the move

Edit details moved to `/account/details`; `/account`'s heading is now "Hi, {first name}"; its rows are `ListRow`s, named by their title and detail ("Messages 1 unread"); the tab's badge describes For you. Change only the lookups below. The `accountIcon` patterns ("Account" to "You"), in `tests/e2e/helpers/messaging.ts` and in the e2e-supabase specs, are N1 Task 14's change; this task doesn't touch them.

**Files:** `tests/e2e/accounts.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/messaging.spec.ts`, `tests/e2e/sign-in-return.spec.ts`, `tests/e2e/account-delete-return.spec.ts`, `tests/e2e/screenshots.spec.ts`, `tests/e2e-supabase/account.spec.ts`, `tests/e2e-supabase/sign-in.spec.ts`

- [ ] **Step 1: `tests/e2e/accounts.spec.ts`**
  - Line 182, in "each button signs straight in as its account": `{ level: 2, name: firstName }` becomes `{ level: 1, name: `Hi, ${firstName}` }`. Line 184 (the Admin's "Hub role") becomes:
    ```ts
    await page.goto("/account/details");
    await expect(main(page).getByText("Hub role", { exact: true })).toBeVisible();
    ```
  - Line 194: `{ name: "Your shop" }` becomes `{ name: /^Your shop/ }`.
  - Line 293 (`waitForFunction`) keeps its `main a[href="/saved"]` selector; line 295's `main(page).getByRole("link", { name: "Saved" })` becomes `main(page).locator('a[href="/saved"]')` ("Saved searches" also starts with "Saved").
  - Line 307: `{ level: 2, name: "Thandi" }` becomes `{ level: 1, name: "Hi, Thandi" }`.
  - "shows your details, and Edit details saves them or says what's wrong" (lines 313–333): after `await expect(page).toHaveURL(/\/account$/);` insert
    ```ts
    await expect(main(page).getByRole("heading", { level: 1, name: "Hi, Ayanda" })).toBeVisible();
    await main(page).getByRole("link", { name: /^Your details/ }).click();
    await expect(page).toHaveURL(/\/account\/details$/);
    ```
    and after the first `Save changes` click add `await expect(page).toHaveURL(/\/account\/details$/);`. The rest (the `h2` names, "Member since", the campus) is on Your details as before.
  - Line 338: `{ name: "Privacy settings" }` becomes `{ name: /^Privacy/ }`.
  - Line 416: `["/account", "Your account · CampusCart"]` becomes `["/account", "You · CampusCart"]`, and add `["/account/details", "Your details · CampusCart"],` after it.
  - Line 449: `{ level: 2, name: "Ayanda" }` becomes `{ level: 1, name: "Hi, Ayanda" }`.
  - "Edit details and Delete my account work" (no JavaScript): before `await field(page, "Your first name").fill("Zola");` add `await page.goto("/account/details");`.
  - Line 476: `{ level: 2, name: "Thandi" }` becomes `{ level: 1, name: "Hi, Thandi" }`.
  - Add, in the "sample accounts" describe, a check that Looking For is in the menu (plan decision 11), after the existing menu assertions at line 212:
    ```ts
    await expect(menu.getByRole("link", { name: "Looking For" })).toHaveAttribute("href", "/looking-for");
    ```

- [ ] **Step 2: `tests/e2e/a11y.spec.ts`**
  - "your account, after a save that went wrong" (line ~291): after `await signInAsSample(page);` add `await page.goto("/account/details");`. Rename the test "your details, after a save that went wrong".
  - Line 449: `{ name: /^Notifications\s*,\s*1 new$/ }` becomes `{ name: /^Notifications\s+1 new$/ }`.
  - Add a test after it:
    ```ts
    test("You, signed in as the sample student", async ({ page }) => {
      await signInAsSample(page, "Student, Midrand");
      await expect(page.getByRole("heading", { level: 1, name: "Hi, Thandi" })).toBeVisible();
      expect(await seriousIssues(page)).toEqual([]);
    });
    ```

- [ ] **Step 3: `tests/e2e/messaging.spec.ts`**, "the header counts new notifications…" (lines 396–434): rename it "the account icon counts For you, and the notifications page lists them".
  - Line 418 becomes (the icon and the tab share For you's count at every width, plan decision 7)
    ```ts
    await expect(accountIcon(page)).toHaveAccessibleDescription("1 thing for you");
    ```
  - Line 421: `/^Messages\s*,\s*1 unread$/` becomes `/^Messages\s+1 unread$/`; line 422: `/^Notifications\s*,\s*1 new$/` becomes `/^Notifications\s+1 new$/`.
  - Update the comment on `accountIcon` in `tests/e2e/helpers/messaging.ts:25` to "…which carries For you's badge (role views N5)". Only the comment: its pattern is N1 Task 14's.

- [ ] **Step 4: `tests/e2e/sign-in-return.spec.ts`**
  - Every `staysOn(page, /\/account$/, "Your account")` (lines 120, 147, 162, 169) becomes `staysOn(page, /\/account$/, /^Hi, /)`. The `"account-title"` markers stay: You's `h1` keeps that class.
  - "the account's email isn't in the document after signing out…" (lines 205–228) keeps its email checks, moved to Your details (the email is there now, plan decision 13): it signs in with `signInAsSample(page, "Student, Midrand", "/account/details")`, checks `main(page).getByText("student@eduvos.com").filter({ visible: true })` is visible, then client-navigates away with `await main(page).getByRole("link", { name: "Back to You" }).click();`, `await expect(page).toHaveURL(/\/account$/);` and `await main(page).locator('a[href="/saved"]').click();`. Its three `page.content()` checks on `"student@eduvos.com"` stay as they are (the kept `/account/details` must be in the document before signing out and gone after).

- [ ] **Step 5: `tests/e2e/account-delete-return.spec.ts`**
  - The first test keeps its email checks, moved to Your details: after `await signUp(page, buyer);` add `await page.goto("/account/details");`; line 18's `getByText(buyer.email)` stays; the client navigation becomes `await main(page).getByRole("link", { name: "Back to You" }).click();`, `await expect(page).toHaveURL(/\/account$/);`, then line 19's link as `main(page).getByRole("link", { name: /^Privacy/ })`. The `toContain(buyer.email)` and `not.toContain(buyer.email)` checks stay.
  - Line 41: `await page.goto("/account");` becomes `await page.goto("/account/details");`; its `getByText(buyer.email)` stays.

- [ ] **Step 6: `tests/e2e/screenshots.spec.ts`** (only runs with `SCREENSHOTS=1`)
  - Lines 371–377: `page.goto("/account")` becomes `page.goto("/account/details")`; the rest stays (it's Your details now). Rename the files `06-your-details` and `07-your-details-saved`.
  - Line 453: `{ name: /^Notifications/ }` stays (it still starts with "Notifications").

- [ ] **Step 7: `tests/e2e-supabase/account.spec.ts`**, "Edit details saves…" (line 36): after `await signIn(page, email);` add `await page.goto("/account/details");`.

- [ ] **Step 8: `tests/e2e-supabase/sign-in.spec.ts`**
  - Line 100: `await expect(main(page).getByText(email)).toBeVisible();` becomes `await expect(main(page).getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();` (You shows the name, not the email).
  - Line 255: `{ level: 2, name: "Ayanda" }` becomes `{ level: 1, name: "Hi, Ayanda" }`.

- [ ] **Step 8b: `tests/e2e/routes.spec.ts`** "account pages send a signed-out visitor to sign in…" (line 53): after the `/account/privacy` lines add
  ```ts
  await page.goto("/account/details");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fdetails$/);
  ```

- [ ] **Step 9: Nothing else looks for the old page**

```bash
grep -rn 'level: 2, name: "\(Thandi\|Ayanda\|Sipho\|Lerato\|Naledi\|Pieter\|Lindiwe\|Zola\)"' tests/e2e tests/e2e-supabase
```
Expected: only lines on `/account/details` (after a `goto("/account/details")` or the details link).

```bash
grep -rn 'Messages\\s\*,\|Notifications\\s\*,\|"Privacy settings" })\|"Your account · CampusCart"\|savedItemsBack' tests/e2e tests/e2e-supabase
```
Expected: no output.

- [ ] **Step 10: Run them** (a fresh build: `pnpm build` first if Task 7 changed anything since the last)

```bash
pnpm e2e tests/e2e/accounts.spec.ts tests/e2e/a11y.spec.ts tests/e2e/messaging.spec.ts tests/e2e/sign-in-return.spec.ts tests/e2e/account-delete-return.spec.ts tests/e2e/routes.spec.ts tests/e2e/shell.spec.ts --reporter=line
```
Expected: all pass in the device projects.

Against the local stack: `pnpm e2e:supabase tests/e2e-supabase/account.spec.ts tests/e2e-supabase/sign-in.spec.ts --reporter=line`
Expected: PASS.

- [ ] **Step 11: Commit (controller)**

```bash
git add tests/e2e/accounts.spec.ts tests/e2e/a11y.spec.ts tests/e2e/messaging.spec.ts tests/e2e/sign-in-return.spec.ts tests/e2e/account-delete-return.spec.ts tests/e2e/screenshots.spec.ts tests/e2e/routes.spec.ts tests/e2e/helpers/messaging.ts tests/e2e-supabase/account.spec.ts tests/e2e-supabase/sign-in.spec.ts
git commit -m "test: the end-to-end tests follow Edit details to /account/details, You's greeting and rows, and the You badge (role views N5 Task 12)"
```

---

### Task 13: New end-to-end tests, layout shift and screenshots

**Files:**
- Create: `tests/e2e/you.spec.ts`
- Modify: `tests/e2e/cls.spec.ts`, `tests/e2e/performance.spec.ts`, `tests/e2e/community-writes.spec.ts`, `tests/e2e/role-views-screenshots.spec.ts`
- Create or modify: `tests/e2e/role-views-writes.spec.ts`; `playwright.config.ts` only if Task 0 found no `role-views-writes` project

- [ ] **Step 1: `tests/e2e/you.spec.ts`** (device projects; reads, and fresh accounts of its own)

```ts
import { expect, test, type Page } from "@playwright/test";
import { YOU_SKELETON_BLOCKS } from "../../components/account/you-skeleton";
import { seriousIssues } from "./helpers/axe";
import { main, newBuyer, onlyAt, settled, signInAsSample, signUp } from "./helpers/messaging";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";

// You (role views N5, spec 7.4 and 9). Reads only, in the device projects: the tests that need an empty You sign up an
// account of their own, and the sample accounts are only read. The reply that lights the badge is a write, in
// role-views-writes.spec.ts.

const card = (page: Page, name: string) => main(page).getByRole("region", { name });

test.describe("You (role views spec 7.4)", () => {
  test("a new account: the greeting, All clear, Your stuff and Settings, with no serious axe issues", async ({ page }) => {
    onlyAt("phone-360", "phone-390", "tablet-768", "desktop-1440");
    const buyer = newBuyer();
    await signUp(page, buyer);
    await expect(main(page).getByRole("heading", { level: 1, name: `Hi, ${buyer.firstName}` })).toBeVisible();
    await expect(main(page).locator(".you-campus")).toHaveText("Midrand");
    await expect(card(page, "For you").getByText("All clear. Nothing needs you right now.")).toBeVisible();
    const rows = await card(page, "Your stuff")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => [link.querySelector(".list-row-title")?.textContent, link.getAttribute("href")]));
    expect(rows).toEqual([
      ["Messages", "/messages"],
      ["Notifications", "/notifications"],
      ["Saved", "/saved"],
      ["Your requests", "/account/requests"],
      ["Saved searches", "/saved?tab=searches"],
      ["Hub bookings", "/hub"],
    ]);
    await expect(card(page, "Settings").getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(await seriousIssues(page)).toEqual([]);
  });

  test("Saved counts the listings saved on this device, from its cookie", async ({ page, context, baseURL }) => {
    onlyAt("phone-390");
    await signUp(page, newBuyer());
    await context.addCookies([{ name: "vossie_saved", value: "l-001.l-026", url: baseURL! }]);
    await page.goto("/account");
    await expect(card(page, "Your stuff").getByRole("link", { name: /^Saved 2 listings on this device/ })).toBeVisible();
  });

  test("Hub bookings shows the sample student's office hours while they're coming up", async ({ page }) => {
    onlyAt("phone-360", "phone-390", "tablet-768", "desktop-1440");
    await signInAsSample(page, "Student, Midrand");
    const bookings = card(page, "Your stuff").getByRole("link", { name: /^Hub bookings/ });
    // Her slot request is for h-007 on 19 November 2026 (data/fixtures/staff.ts:57); after that day there's none.
    const upcoming = new Date() < new Date("2026-11-19T22:00:00Z");
    if (upcoming) {
      await expect(bookings).toHaveAttribute("href", "/hub/h-007");
      await expect(bookings).toContainText("Office hours: your first listing");
      await expect(bookings).toContainText("Waiting for an answer");
    } else {
      await expect(bookings).toHaveAttribute("href", "/hub");
    }
  });

  test("a seller sees Your shop, and staff their tools, none prefetched", async ({ page, context }) => {
    onlyAt("phone-360", "phone-390", "tablet-768", "desktop-1440");
    await signInAsSample(page, "Seller, Tech corner");
    await expect(card(page, "Your stuff").getByRole("link", { name: /^Your shop/ })).toHaveAttribute("href", "/sell");
    await context.clearCookies();
    await signInAsSample(page, "Admin");
    const stuff = card(page, "Your stuff");
    await expect(stuff.getByRole("link", { name: "Admin console" })).toHaveAttribute("href", "/admin");
    await expect(stuff.getByRole("link", { name: "Mentor dashboard" })).toHaveAttribute("href", "/mentor");
    expect(await seriousIssues(page)).toEqual([]);
  });

  test("Your details opens the form, one level deeper, and comes back", async ({ page }) => {
    onlyAt("phone-360", "phone-390", "tablet-768", "desktop-1440");
    await signInAsSample(page, "Student, Midrand");
    await card(page, "Settings").getByRole("link", { name: /^Your details/ }).click();
    await expect(page).toHaveURL(/\/account\/details$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
    await expect(page.getByLabel("Your first name", { exact: true })).toHaveValue("Thandi");
    expect(await seriousIssues(page)).toEqual([]);
    await main(page).getByRole("link", { name: "Back to You" }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("the menu has Looking For, signed in or out (plan decision 11)", async ({ page }) => {
    onlyAt("phone-360", "phone-390", "tablet-768", "desktop-1440");
    await page.goto("/");
    await settled(page);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("link", { name: "Looking For" }).click();
    await expect(page).toHaveURL(/\/looking-for$/);
    await expect(menu).toBeHidden();
  });
});

test.describe("You's gates (role views spec 9)", () => {
  test("the skeleton is no taller than the shortest You, a new account's", async ({ page }) => {
    onlyAt("phone-390", "desktop-1440");
    await signUp(page, newBuyer());
    // The content, not the skeleton: wait for the greeting before measuring.
    await expect(main(page).getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();
    const content = (await main(page).locator(".you-body").boundingBox())!.height;
    // The same blocks YouSkeleton draws, measured in the page's own CSS.
    const skeleton = await page.evaluate((blocks) => {
      const shell = document.createElement("div");
      shell.className = "you-skeleton-body";
      shell.setAttribute("aria-hidden", "true");
      for (const block of blocks) {
        const span = document.createElement("span");
        span.className = `skeleton ${block}`;
        shell.append(span);
      }
      document.querySelector("main .you-page")!.append(shell);
      const height = shell.getBoundingClientRect().height;
      shell.remove();
      return height;
    }, [...YOU_SKELETON_BLOCKS]);
    console.log(`You [${test.info().project.name}]: skeleton ${skeleton}px, shortest content ${content}px`);
    expect(skeleton).toBeLessThanOrEqual(content);
  });

  test("You adds under about 8 KB of HTML, with every row an admin has (plan decision 17)", async ({ page }) => {
    onlyAt("desktop-1440");
    await signInAsSample(page, "Admin");
    await expect(main(page).getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();
    const bytes = await main(page)
      .locator(".you-body")
      .evaluate((el) => new TextEncoder().encode(el.outerHTML).length);
    console.log(`You (Admin): ${bytes} B of HTML`);
    expect(bytes).toBeLessThan(8 * 1024);
  });

  test("a new account's You holds still on a short phone, 375 by 667 (CLS 0.05 or less)", async ({ browser, baseURL }) => {
    onlyAt("phone-390");
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      screen: { width: 375, height: 667 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      baseURL,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await signUp(page, newBuyer());
    await holdFonts(page);
    await recordShifts(page);
    await expectStill(page, "You, a new account (375x667)", "/account");
    await context.close();
  });
});
```

Check `settled` is exported from `tests/e2e/helpers/messaging.ts` (it is, line 53). Check how `expectStill` uses the page (`tests/e2e/helpers/shifts.ts:34`): it navigates to `path` itself.

- [ ] **Step 2: Layout shift rows.** In `tests/e2e/cls.spec.ts`, add to `PAGES`, after `["privacy settings page", …]`:

```ts
  ["Your details page", "/account/details", undefined, "Student, Midrand"],
```

and to `SLOW_PAGES`, after `["Your requests", "/account/requests", "Student, Midrand"],`:

```ts
  // Role views N5: You streams in behind a skeleton shorter than its shortest state; the page is a screen tall.
  ["You page", "/account", "Student, Midrand"],
  ["Your details page", "/account/details", "Student, Midrand"],
```

The existing `["account page", "/account", …]` row now measures You at full speed. Rename it `"You page"`.

- [ ] **Step 3: Size.** In `tests/e2e/performance.spec.ts`'s `SIGNED_IN_PAGES`, rename `"account page"` to `"You page"` and add `["Your details page", "/account/details", "Student, Midrand"],` after it.

- [ ] **Step 4: The writes project.** If Task 0 found no `role-views-writes` project, add to `playwright.config.ts`, after `HOUSEKEEPING_WRITES`:

```ts
// Role views' writes (role views spec 9): a fresh buyer's message and the sample seller's reply light the You badge,
// and they'd show in the sample seller's counts, so they run after every other test.
const ROLE_VIEWS_WRITES = /role-views-writes\.spec\.ts$/;
```

add `ROLE_VIEWS_WRITES` to the end of every device project's `testIgnore` list (all five), and add the project after `housekeeping-writes`:

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

If the project exists already (N2 to N4), change nothing in the config.

- [ ] **Step 5: The badge-and-reply write.** Add to `tests/e2e/role-views-writes.spec.ts` (create it with the imports below if it doesn't exist; if it does, merge the imports):

```ts
import { expect, test } from "@playwright/test";
import { main, newBuyer, reply, sellerPage, sendFirstMessage, signUp } from "./helpers/messaging";

const ALL_CLEAR = "All clear. Nothing needs you right now.";

test.describe("You (role views N5)", () => {
  test("the You badge is For you's sum, its row opens the inbox, and the strip links to Notifications", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, newBuyer());
    await expect(main(page).getByText(ALL_CLEAR)).toBeVisible();
    await expect(page.locator(".tabbar #tab-account-new")).toHaveCount(0);

    const id = await sendFirstMessage(page, "l-001", "Hi! Is it still available?");
    const seller = await sellerPage(browser, baseURL!);
    await seller.goto(`/messages/${id}`);
    await reply(seller, "Yes, it is.");
    await expect(seller.locator("main").getByText("Yes, it is.").first()).toBeVisible();
    await seller.context().close();

    // For you lists the conversation, and the tab's badge says the same number (spec 4.2).
    await page.goto("/account");
    const row = main(page).getByRole("list", { name: "For you" }).getByRole("link", { name: /Conversation with new messages/ });
    await expect(row).toContainText("1");
    await expect(page.locator(".tabbar #tab-account-new")).toHaveText(/^1 thing for you$/);

    // The homepage's strip links the new notification to Notifications.
    await page.goto("/");
    await expect(page.locator(".context-strip")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "1 new notification" })).toHaveAttribute("href", "/notifications");

    // The row opens the inbox; opening the thread reads it, and You is all clear again.
    await page.goto("/account");
    await main(page).getByRole("list", { name: "For you" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/messages$/);
    await page.goto(`/messages/${id}`);
    await page.goto("/account");
    await expect(main(page).getByText(ALL_CLEAR)).toBeVisible();
    await expect(page.locator(".tabbar #tab-account-new")).toHaveCount(0);
  });
});
```

Every `browser.newContext(` in this file must say `serviceWorkers: "block"`; `sellerPage` (`tests/e2e/helpers/messaging.ts:104`) already does.

- [ ] **Step 6: The board's link.** Add to `tests/e2e/community-writes.spec.ts`, inside its first `describe`:

```ts
  test("the board points a signed-in asker at Your requests, with the open count (role views N5)", async ({ page }) => {
    await signUp(page, newBuyer());
    await page.goto("/looking-for");
    await expect(main(page).getByRole("heading", { level: 1, name: "Looking For" })).toBeVisible();
    await expect(main(page).getByRole("link", { name: /^Your requests/ })).toHaveCount(0);
    await postRequest(page, `Desk lamp ${uniqueWord()}`, { campus: "Mbombela" });
    await page.goto("/looking-for");
    await expect(main(page).getByRole("link", { name: "Your requests (1 open)" })).toHaveAttribute("href", "/account/requests");
  });
```

In the same file's offer test ("a shop offers: the asker is told…", around line 127), before `await page.goto("/notifications");` (which reads the notification), add:

```ts
    // You counts the new offer once, linking to its thread, and the tab's badge says the same (role views N5).
    await page.goto("/account");
    const offerRow = main(page).getByRole("list", { name: "For you" }).getByRole("link", { name: /New offer on your requests/ });
    await expect(offerRow).toHaveAttribute("href", `/messages/${conversation}`);
    await expect(page.locator(".tabbar #tab-account-new")).toHaveText(/^1 thing for you$/);
```

- [ ] **Step 7: Screenshots.** In `tests/e2e/role-views-screenshots.spec.ts` (N1 made it), add at the end:

```ts
const N5_SHOTS = [
  ["you-student", "Student, Midrand", "/account"],
  ["you-admin", "Admin", "/account"],
  ["your-details", "Student, Midrand", "/account/details"],
  ["board-signed-in", "Student, Midrand", "/looking-for"],
] as const;

for (const [name, label, path] of N5_SHOTS) {
  test(`role views N5: ${name}`, async ({ page }) => {
    const width = test.info().project.name.split("-").pop();
    test.skip(!["390", "1440"].includes(width!), "390 and 1440 only");
    await signInAsSample(page, label, path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `docs/progress/role-views/n5-${width}-${name}.png`, fullPage: true });
  });
}
```

- [ ] **Step 8: Run them**

```bash
pnpm build && pnpm e2e tests/e2e/you.spec.ts tests/e2e/cls.spec.ts tests/e2e/performance.spec.ts --reporter=line
```
Expected: all pass. Write down the skeleton and content heights and the HTML bytes the tests log. If the skeleton check fails, shorten `.you-skeleton-rows` until it passes at both widths, and note it.

```bash
pnpm e2e --project=community-writes --project=role-views-writes --no-deps --reporter=line
```
Expected: PASS.

```bash
grep -rn "newContext(" tests/e2e | grep -v serviceWorkers
```
Expected: no output.

- [ ] **Step 9: Commit (controller)**

```bash
git add tests/e2e/you.spec.ts tests/e2e/cls.spec.ts tests/e2e/performance.spec.ts tests/e2e/community-writes.spec.ts tests/e2e/role-views-writes.spec.ts tests/e2e/role-views-screenshots.spec.ts
git commit -m "test: You end to end (rows, saved cookie, bookings, menu, axe, skeleton height, HTML size, short-phone layout shift), the badge write and the board's link (role views N5 Task 13)"
```

If Step 4 changed `playwright.config.ts`, add it to the same commit.

---

### Task 14: The gates

**Files:** none changed, unless a gate fails.

- [ ] **Step 1: Unit, lint, types**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: clean; every unit test passes. Write the count down (Task 0's plus the new ones).

- [ ] **Step 2: First-visit JS**

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Compare every public page's `scriptBrotli` with Task 0's baseline (Lama, 2026-10-22): every page stays inside the 150 KB first-visit JS budget; each page's number is recorded against the stage baseline (Task 0); any page that grows by more than 1 KB gets a one-line reason. The performance spec itself fails any page over 150 KB. Write every page's number and its difference in "Changes made during the build". Expected: every page grows by a few tens of bytes at most (the menu's and the header's new link) and the homepage's change is small either way; anything over 1 KB gets its one-line reason there, after checking it isn't a mistake (a server module pulled into a client chunk: `grep -l '"use client"' $(git diff --name-only -- '*.tsx' '*.ts')` should list only `MenuDrawer.tsx`, `SiteHeader.tsx` and `ContextStripView.tsx`).

```bash
grep -rln '"use client"' components/account components/kit lib/you components/home/ActivityLines.tsx components/looking-for/YourRequestsLink.tsx components/header/AccountLink.tsx
```
Expected: no output (no new client component).

```bash
grep -l "serviceWorker.register" .next/static/chunks/*.js
```
Expected: no output (CLAUDE.md).

- [ ] **Step 3: The full end-to-end run**

```bash
pnpm e2e --reporter=line
```
Expected: every project passes (devices at 360, 390, 768, 1024 and 1440, then the write projects in order). Write the counts down. If a failure is in a test this stage didn't touch and also fails on `main`, note it and tell the controller; don't fix it here.

- [ ] **Step 4: The database**

```bash
pnpm test:db && supabase test db
```
Expected: PASS (needs the local stack: `supabase start`, then `supabase db reset`).

- [ ] **Step 5: Screenshots**

```bash
SCREENSHOTS=1 pnpm e2e tests/e2e/role-views-screenshots.spec.ts --project=phone-390 --project=desktop-1440 --grep "N5"
```
Expected: 8 PNGs in `docs/progress/role-views/` named `n5-…`. Look at each: sky never carries text on white, the rows are 44px or more, nothing is cut off at 390.

- [ ] **Step 6: Commit (controller)**

```bash
git add docs/progress/role-views
git commit -m "docs: role views N5 screenshots (You, Your details, the board signed in)"
```

---

### Task 15: Docs

**Files:** `app/privacy/page.tsx` (one sentence), `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`, this plan's "Changes made during the build"

- [ ] **Step 1: The privacy page.** You reads the `vossie_saved` cookie on the server to count the device's saved listings, and stores nothing. In `app/privacy/page.tsx` (lines 60–61), the sentence

```tsx
            Your saved listings, in a cookie called <code>vossie_saved</code> that lasts up to a year. Your browser sends
            the listing ids to CampusCart with each visit so the Saved page can show them; nothing is stored on a server.
```

becomes

```tsx
            Your saved listings, in a cookie called <code>vossie_saved</code> that lasts up to a year. Your browser sends
            the listing ids to CampusCart with each visit so the Saved page can show them and your You page can count
            them; nothing is stored on a server.
```

No new cookie or storage key: the privacy test is unchanged. Run `pnpm vitest run app/privacy`. Expected: PASS.

- [ ] **Step 2: CLAUDE.md.** Add to "Code rules", after the role views bullets N1 added:

```markdown
- `/account` is You (role views spec 7.4): For you comes only from `readForYou` (`lib/you/read.ts`, built by `forYouItems` in `lib/you/model.ts`, cached per request), and the You tab's badge is `forYouTotal` of the same read, so the badge always equals the list. Reading it marks nothing read; opening Notifications or a thread still does. Your stuff comes from `readYourStuff`. Edit details lives at `/account/details` (`DETAILS_PATH`, `lib/you/paths.ts`); `updateDetails` lands there.
- The home strip's lines are a Server Component (`components/home/ActivityLines.tsx`) passed to `ContextStripView` as a node: add a line there. The header's account icon and the You tab show the same badge, For you's sum (`HeaderAccount` and `TabAccount` both read `readForYou`).
- `listOwnBookings(accountId, now)` (`lib/data/hub-posts.ts`, Supabase twin through the student's own session) is the student's upcoming RSVPs and newest slot request per office hours, published posts only. `newNotificationsByKind(accountId, kinds)` (`lib/data/notifications.ts`) groups unread notifications for For you.
```

In "Privacy (POPIA)", after "the campus choice and saved listings are first-party cookies,", add "(You counts the saved listings from the cookie on the server and stores nothing),".

If N1 or the spec's update hasn't already put Lama's JS rule in CLAUDE.md, add it to "Code rules": "First-visit JS: every page stays inside the 150 KB first-visit JS budget; each page's number is recorded against the stage baseline (Task 0); any page that grows by more than 1 KB gets a one-line reason. Small client costs are fine when they buy function, accessibility or smoothness (Lama, 2026-10-22)."

- [ ] **Step 3: The decisions log.** Read the table's header and last row in `docs/reference/LANDING-DECISIONS.md`, and add the next number:

```markdown
| N | 2026-10-2X | Role views N5: the buyer's hub ("You") | **`/account` is You: "Hi, {first name}" and the campus; For you (conversations with new messages, new offers, new saved-search matches and followed shops' new listings, the last three from unread notifications, read without marking them read); a banner while an open request is in its last 2 days; Your stuff (Messages, Notifications, Saved with the device's listings and followed shops, Your requests, Saved searches, Hub bookings, Your shop for sellers, staff tools by role); Settings (Your details at `/account/details`, Privacy, Sign out). The You tab's badge is For you's sum from the same reader. Looking For is in the menu beside Hub; the board shows "Your requests (N open)"; `savedItemsBack` is gone; the strip links new notifications. Looking For is in the header's quick links too, and the header icon and the You tab share For you's count.** | Plan: `docs/superpowers/plans/2026-10-22-role-views-n5-buyer.md`, decisions 1 to 19. JS: every page inside 150 KB, each recorded against the baseline (Lama's rule of 2026-10-22). Open for Lama: the offers row (1), the strip for notification-only accounts (19), the sample words. |
```

Match the table's real columns.

- [ ] **Step 4: PROGRESS.md.** Add "## 2026-10-2X: Role views N5 built (You)" before "## Next", in the style of the stage sections above it: what's built; where the build differed from the plan; checks (unit count, e2e counts, the JS bytes against the baseline, the skeleton heights, the HTML bytes); open points for Lama (plan decisions 1, 7, 10 and 12, the sample words, the screenshots to review). Update "## Next".

- [ ] **Step 5: Fill in "Changes made during the build"** below, one bullet per departure, each with its commit.

- [ ] **Step 6: Commit (controller), with Lama's go-ahead**

```bash
git status
```

```bash
git add app/privacy/page.tsx CLAUDE.md docs/reference/LANDING-DECISIONS.md docs/PROGRESS.md docs/superpowers/plans/2026-10-22-role-views-n5-buyer.md
git commit -m "docs: role views N5 built: CLAUDE.md rules for You, the strip's server lines and the menu's slot; the decisions log; progress; the privacy page's saved-cookie sentence"
```

Stage only this stage's lines if other sessions have uncommitted lines in PROGRESS or the decisions log (use `git add -p` there, never `git add .`).

---

## Self-review: what the plan covers

| Ask | Where |
|---|---|
| `listOwnBookings(accountId, now)` on both backends, upcoming only, filtered by account | Task 2 (sample, Supabase twin, contract on both, seed test); plan decision 9 |
| Bookings in the data download | Already there (`lib/data/accounts.ts:224-225`); decision 9 |
| pgTAP for SQL | No SQL changed (decision 9); `supabase test db` re-run in Tasks 2 and 14 |
| `/account` rebuilt in §7.4 order: header, For you, banner, Your stuff, Settings | Task 7 (`YouView`, page, CSS), tested in order |
| For you: unread messages, offers, matches, new listings; not marked read | Tasks 1, 3, 4 (`newNotificationsByKind`, `forYouItems`, `readForYou`); "marks nothing" in Tasks 1 and 4; decisions 1, 2 |
| Closing-soon banner from the reminder rule | Task 3 (`closesSoon` on `reminderDay`), Task 7; decision 8 |
| Saved from the cookie ("on this device") and followed shops | Tasks 3, 4, 7; e2e in Task 13; decision 3 |
| Your requests, Saved searches, Hub bookings rows | Tasks 3, 4, 7 |
| Your shop only for sellers; staff tools only for staff, no prefetch | Task 7 (tests check `data-prefetch`); decisions 5, 6 |
| Settings: Your details (new page), Privacy, Sign out | Tasks 6, 7 |
| Edit details at `/account/details`: form, action, redirects, sign-in inside Suspense, tests | Task 6 (page with `requireAccount(DETAILS_PATH)` in Suspense; action and its tests; ids test) |
| You badge = sum of For you from the same reader; "badge equals list" | Tasks 4, 5, 7 (`YouBadge.test.tsx`), Task 13 (write e2e); decisions 14, 15 |
| Looking For in the menu | Task 8 (beside Hub); decision 11 |
| Looking For in the header quick links | Task 11 (required); decision 10 |
| One count for the tab and the header icon | Task 5b; decision 7 |
| Board "Your requests (N open)" via `countOpenRequests` inside Suspense | Task 9; community-writes e2e in Task 13; decision 16 |
| `savedItemsBack` removed from both backends and the strip | Task 10 (types, both `getAccountActivity`s, viewer, tests, grep) |
| Strip's notifications line | Task 10 (`ActivityLines` on the server); decisions 12, 19 |
| Unit tests | Every task, test first |
| Contract tests on both backends | Tasks 1, 2 (`*.contract.ts` via `*.test.ts` and `*.db.test.ts`), Task 10 (`messages-read.db.test.ts`) |
| E2E reads in device projects; updates for moved Edit details and changed lookups | Tasks 12, 13 |
| Axe | Task 12 (a11y.spec), Task 13 (you.spec: new account, admin, details) |
| Layout shift < 0.05 at 390/1440 and 375×667 | Task 13 (cls rows, slow rows, short-phone test) |
| Skeleton no taller than the shortest state | Task 7 (`YouSkeleton`, `you-skeleton.ts`), Task 13 (measured at 390 and 1440) |
| HTML under ~8 KB added | Task 13; decision 17 |
| First-visit JS inside 150 KB, recorded against a baseline, >1 KB growth explained | Tasks 0, 14 |
| Screenshots via `SCREENSHOTS=1` into `docs/progress/role-views/` | Tasks 13, 14 |
| Docs: privacy text, CLAUDE.md, decisions log, progress | Task 15 |
| No new client component (three small client edits); 44px; brand colours | Rules; Tasks 7, 9, 10 CSS (sky-dark text, white on navy, 44px links); Task 14 grep |

## Changes made during the build

- **Baseline (Task 0):** _to be filled in by the implementer: each public page's `scriptBrotli`, whether `role-views-writes` existed, and the unit count._

## Changes after plan review

The plan review's fixes, applied to this plan before any code (2026-10-22):

1. **A new offer counts once** (must-fix 1): `startOffer` writes the shop's message and the offer notification together, and opening the thread reads both, so `forYouItems`' messages row counts `Math.max(0, conversations - offers)`. `ForYou.conversations` and Your stuff's "N unread" stay raw. Decision 1 rewritten; `model.test.ts` fixtures use 5 conversations beside 3 offers and gain a one-offer test; `YouBadge.test.tsx` uses 3 conversations.
2. **`tests/e2e-supabase/sign-in.spec.ts:100`** looks for the "Hi, " heading instead of the email (Task 12 Step 8).
3. **The `accountIcon` patterns** are N1 Task 14's, in both e2e folders; Task 12 no longer touches `tests/e2e/helpers/messaging.ts`.
4. **The privacy email checks stay,** on Your details: `sign-in-return.spec.ts` and `account-delete-return.spec.ts` sign in or go to `/account/details`, check the email, and navigate away through "Back to You" (Task 12 Steps 4 and 5).
5. **YouSkeleton has its own wrapper class,** `you-skeleton-body` (same grid and gap), and `you.spec.ts` waits for the `h1` before measuring `.you-body` (Tasks 7 and 13).
6. **The JS rule** is "every page: never larger; pages that share `ContextStripView`'s chunk may shrink; record each new number" (Task 14 Step 2), put to Lama beside decision 12.
7. **`worthShowing`'s change** (notification-only accounts now get "Welcome back"; a reply shows as both lines) is put to Lama in decision 19 and Task 10.
8. Nice-to-haves applied: `nextLinkShowingPrefetch` drops `transitionTypes` (Task 7 Step 1); You's read tests also run at 360 and 768 (Task 13); the community-writes offer test checks the For you offers row and the badge (Task 13 Step 6); `routes.spec.ts` checks `/account/details` sends a signed-out visitor to sign in (Task 12 Step 8b); `updateDetails` calls `refresh()` before its redirect, with a unit check (Task 6 Step 5); decision 14 notes the layout's badge isn't redrawn on a client navigation; the privacy settings and Your requests crumbs say "Back to You" (Task 6 Step 5).

### Lama's JS rule (2026-10-22)

Lama: "I'm not obsessed with saving bytes for JavaScript, the app just needs to be smooth, functional and fast." Applied:

1. **The gate everywhere** (goal, rules, Task 14 Step 2, the docs, the self-review) is now: every page stays inside the 150 KB first-visit JS budget; each page's number is recorded against the stage baseline (Task 0); any page that grows by more than 1 KB gets a one-line reason; small client costs are fine when they buy function, accessibility or smoothness. The byte-for-byte and "never larger / may shrink" wording is gone, superseding item 6 above.
2. **Looking For in the header's quick links is in scope:** Task 11 is required, with a unit test; decision 10 rewritten.
3. **Decisions made only to save client JS, revisited:** Looking For in the menu moves from the drawer's server slot (after Safety) to `MenuDrawer`'s own list beside Hub (decision 11, Task 8 rewritten; `MenuAccount.tsx` is no longer touched). The server-drawn strip (decision 12) stays, on its merits: one testable server file for the words and the new link.
4. **One count for the tab and the header icon** (decision 7, new Task 5b): `HeaderAccount` reads `readForYou` too and says "N things for you", so a person sees the same number on a phone and a laptop. `AccountLink` is a server component, so no client code changes. Task 12 Step 3 expects "1 thing for you" at every width.
