# Role views N3: the admin's Today — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin's Overview with "Today": a header that says how much is waiting, a Waiting queue (oldest first, each row opening its oldest item, with age chips), last week's numbers as tiles with changes (through `protectCounts` only), listings by campus as a bar chart, and the badge paragraph at the bottom. Also: `listBookings` oldest first on both backends, Next links on shop and report pages, campus chips on Shops, Reports and Hidden, bars on the numbers page, Staff's list before its form, and one set of names across the console.

**Architecture:** Server Components, built from N1's kit (`NeedsYouList`, `Card`, `StatRow`/`StatTile`, `StatDelta`, `BarList`). The page reads the four list readers it already had, plus `countByWeek`, inside `<Suspense>` after `requireStaff` and `connection()`. Pure helpers decide everything shown:
- `lib/kit/age.ts`: ages;
- `lib/staff/queue.ts`: the queue, the header line and the Next links;
- `lib/staff/today-numbers.ts`: tiles and bars from `protectCounts`' words;
- `lib/staff/campus-filter.ts`: the campus chips.

Two readers change on both backends, each with a contract test: `listBookings` (order) and the report view (its campus).

One client file changes: `components/ui/NavLink.tsx` gains `also`, so the admin bar's More is marked current on the pages it holds (plan decision 8). It is in every page's layout chunk, so its byte change is recorded against the stage baseline (Lama's JS rule, 2026-10-22).

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, TypeScript, Tailwind CSS 4.3 with component CSS in `app/globals.css`, Vitest 5 + Testing Library, Playwright + axe, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-22-role-views-design.md`: §3, §6 (the `listBookings` row), §7.2 (all of it, "Fixes in N3" included), §8, §9 and §10's N3 row.

**Builds on:** `docs/superpowers/plans/2026-10-22-role-views-n1-kit.md`, assumed built exactly as written. N3 uses its names unchanged: `NeedsYouList`/`NeedsYouItem` (with `keepWhenZero`), `StatTile`/`StatRow`, `StatDelta` (and `CountValue`), `BarList`/`BarRow`, `Card`, `LinkTabs` (`look: "chips"`), `PageTransition`, `AdminBar`, `ADMIN_MORE_PATH` and `AdminMore`. N2's plan isn't written yet; N3 doesn't depend on it (plan decision 12).

---

## Rules for whoever builds this

- **Commits:** implementers leave their work uncommitted. The controller checks each task and commits it, and only with Lama's go-ahead for the stage (project memory, CLAUDE.md). Every "Commit" step below is for the controller.
- **Git:**
  - one git command at a time;
  - run `git status` before any git command, as a separate call;
  - stage only this stage's files: other sessions share the tree.
- **Servers:** stop only your own server (by PID or port), never `pkill` by name.
- **Deleting:** Task 7 deletes two files. This plan names them, so Lama's approval of the plan is the go-ahead. List them with `ls` first, as a separate call. Delete nothing else.
- **Before Task 1:** read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`, and `.../03-file-conventions/page.md` for `searchParams`.
- **Never in a component:** a font name, a hex colour, `md:` or `lg:`. Use tokens, `wide:` and `desk:`.
- **Sky** (`#29ABE2`) never carries text, icons or thin lines on white. Links on white are sky-dark.
- **No new client components.** `NavLink`'s `also` (Task 6) is the only client change. No `Date.now()`, `new Date()` or `Math.random()` outside request-time code: Today reads the clock once, after `connection()`, and passes `now` down.
- **Links into staff pages never prefetch** (`prefetch={false}`). N1's kit components already do this.
- **The admin's private counts reach a page only through `protectCounts`.**
  - Nothing counted is named, linked or identified.
  - A masked value is "Hidden" or "Under 5", never 0.

## Plan decisions (where this plan narrows or departs from the spec; Lama to confirm at plan review)

1. **Ages are elapsed time.** "Waits over 2 days are warning" means more than 48 hours since the item started waiting.
   - The label is whole hours under a day ("Under 1h", "5h"), then whole days ("1 day", "3 days").
   - With no day boundary involved, the server's timezone can't move an age (spec §8's SAST rule holds trivially).
   - `now` is read once, after `connection()`.
   - The helper is `lib/kit/age.ts` with a `warnAfterHours` argument, so N2's 24-hour enquiry chip can reuse it.
2. **Hidden is a row, but not "waiting."** Nothing waits on the admin there: the Hub has already acted. So the Hidden row:
   - comes last, after the three waiting rows;
   - shows only when something is hidden (`keepWhenZero` isn't used: More already shows the count at zero);
   - has no age chip and isn't urgent;
   - isn't counted in the header's "N waiting".

   It uses `countHidden()`, as the spec says, so no extra reader is needed for an age.
3. **"Oldest first" orders the rows** (shops, reports and slot requests) by when each row's oldest item started waiting. Ties keep that order.
   - Each row's count is its list's length, worked out from the same list readers the admin bar's badges count. So "badge equals list" holds, and a unit test checks it on the sample store.
   - The header reads "N waiting · oldest 3 days", or "Nothing waiting".
4. **Last week compares with the week before.**
   - Each tile's change uses `period: "the week before"` ("↑ 3 on the week before"). `StatDelta`'s default, "last week", would be wrong here, because the tile *is* last week.
   - Every value comes from `protectCounts`' words through `shownCount`. Anything that isn't a plain figure or "Under 5" becomes `"hidden"`, never 0.
   - The tiles are Listings published, Shops approved and Reports made (the spec's three, under `MEASURES`' labels).
5. **The bar charts:**
   - Campuses with 0 are left out of the bars and counted in the takeaway ("11 campuses had none"), which keeps Today's HTML small.
   - When every campus is masked (a private measure with a campus from 1 to 4), one sentence replaces the chart.
   - N1's `BarList` doesn't apply the spec's too-small rule, so the caller does (`campusBars().tooSmall`): fewer than 2 values, or a largest of 3 or under, is written as text.
   - On `/admin/numbers`, bars are drawn only on the all-campus view, and only for last week. The campus view and "Since the start" stay as tables.
6. **"Last week" names the numbers page:** its h1, its tab title, its pill and its More row. Today's "Last week" card links to it as "All numbers" (the spec drew "Numbers ›"), so the link doesn't repeat the card's own title.
7. **One eyebrow: "Hub console"** on every admin page *and* the Hub's pages (`/hub/manage`, `/hub/new`, `/hub/[id]/edit`).
   - It comes from one constant, `STAFF_EYEBROW`, and a test reads the folders to keep it that way.
   - Mentor pages keep "Mentoring" (N4's).
   - The account page's row for the console says "Hub console".
   - Tab titles: Today, Shops, Last week. The pill row says Today, Shops, Hidden, Last week.
8. **What "current" means for Hidden.** Hidden now lives under More.
   - `StaffFrame` on the three Hidden pages passes `current={ADMIN_HIDDEN_PATH}`, and the pill row gains "Hidden", which is then marked. The pill row shows only outside the section shell, or where `:has` isn't supported.
   - **In the admin bar, More is the current tab on every page it holds:** Hidden, Featured, Pickup points, Staff, Last week, the Audit log, and `/mentor` for admins.
   - `NavLink` gains an optional `also?: readonly string[]`: path prefixes that also mark the link current, with `aria-current="true"`, as `match="section"` does. So screen readers hear it too.
   - `AdminBar` passes `ADMIN_MORE_SECTIONS` (`lib/staff/paths.ts`) through `SectionTab.also` to `NavLink`.
   - `NavLink` reads the pathname on the client, so a kept, hidden page can't leave More marked.
   - `NavLink` is client code in every page's layout chunk. Its byte change is recorded against the stage baseline, with a one-line reason if a page grows by more than 1 KB (Lama's rule, 2026-10-22: stay inside 150 KB; small client costs are fine when they buy function, accessibility or smoothness).
9. **Next links.** "Next waiting shop" and "Next open report" sit at the top of every shop and report page, open or closed. Each points to the oldest open item that isn't this one.
   - The campus filter isn't carried into them.
   - The next report can be about the viewing admin's own shop. Its page then says so, as today.
   - The actions' redirects don't change: Approve lands on the shop's page, which now has the Next link, and Dismiss still lands on Reports.
10. **Campus chips** are N1's `LinkTabs` with `look="chips"`: "All campuses", then the 13 campuses. They are links, so there's no form and no JS.
    - `?campus=` is read like the numbers' (`parseNumbersCampus`): an unknown or empty value shows every campus, with no error.
    - A report about something that has gone has no campus, so it shows only under All campuses.
    - Filtering reports needs their campus, so `ReportView` gains `campusSlug` on both backends (Task 2).
11. **Per-card failure (spec §8):**
    - The queue's four reads fail together, and the Waiting card shows its error box.
    - `countByWeek` failing turns the Last week and campus cards into error boxes.
    - A failed badge recalculation leaves one line in the badges card.
    - The page and both bars still work in each case.
12. **No end-to-end writes in N3.**
    - Everything new is a read, so it's tested in the device projects. The seed has Crochet corner waiting since 10 October and Thandi's slot request since 13 October: over 2 days old on any day the tests run. Other tests' writes only add newer items.
    - The "All clear" state's height is checked by turning the live page into its shortest state in the browser and measuring it beside an injected copy of the skeleton (Task 13).
    - Existing write specs (`staff-writes`, `staff-accounts-writes`) only get the renamed words.
    - So nothing goes into `tests/e2e/staff-writes.spec.ts` or into N2's `role-views-writes` project.
13. **The HTML budget is measured on Today's whole body** (`.today`, ≤ 8 KB), not on what was added. The Overview is gone, so the whole body is "added", and this is the stricter check.
14. **`AdminOverview.tsx` and its test are deleted** (Task 7). `hiddenLine` and its tests move to `lib/staff/queue.ts`.
15. **Short pages:** Reports and Hidden, filtered to Eduvos Online (which stays empty), are their shortest states. Task 13 checks each page's skeleton is no taller than that state, and that it doesn't shift by more than 0.05 on a 375×667 phone. If either check fails, the page switches to `<StaffSkeleton short />` and is measured again.

## Open questions for Lama

1. The Hidden row's behaviour: last, only when something is hidden, not counted as waiting (decision 2).
2. "All numbers" as the link to the numbers page (decision 6).
3. Mentors see "Hub console" as the eyebrow on the Hub pages (decision 7). Is that right for them?
4. The 48-hour warning threshold (decision 1; spec §12).

## File structure

**Create**
- `lib/kit/age.ts`, `lib/kit/age.test.ts`: `waitAge`.
- `lib/staff/queue.ts`, `lib/staff/queue.test.ts`: `oldestOf`, `todayQueue`, `todayLede`, `hiddenLine` (moved), `nextWaitingShop` and `nextOpenReport`.
- `lib/staff/today-numbers.ts`, `lib/staff/today-numbers.test.ts`: `shownCount`, `lastWeekTiles` and `campusBars`.
- `lib/staff/campus-filter.ts`, `lib/staff/campus-filter.test.ts`: `readCampusFilter`, `campusFilterPath`, `campusFilterTabs` and `inCampus`.
- `lib/staff/names.test.ts`: the eyebrow guard.
- `components/staff/AdminToday.tsx`, `components/staff/AdminToday.test.tsx`.
- `components/staff/NextInQueue.tsx`, `components/staff/NextInQueue.test.tsx`.
- `components/staff/CampusFilter.tsx`, `components/staff/CampusFilter.test.tsx`.
- `tests/e2e/helpers/staff-skeleton.ts`, `tests/e2e/role-views-admin.spec.ts`.

**Modify**
- **The two changed readers:**
  - `lib/data/hub-posts.ts`, `lib/data/supabase/hub-posts.ts`, `lib/data/hub-posts.test.ts`, `lib/data/contract/hub-staff.contract.ts`;
  - `components/staff/HubManage.tsx` (its caption);
  - `lib/data/staff-reports.ts`, `lib/data/supabase/staff-reports.ts`, `lib/data/contract/staff-reports.contract.ts`.
- **Paths and the frame:**
  - `lib/staff/paths.ts` and `lib/staff/paths.test.ts`;
  - `components/ui/NavLink.tsx` and `components/ui/NavLink.test.tsx` (`also`);
  - `components/kit/SectionBar.tsx`, `components/kit/sections.tsx` and their tests (More's `also`);
  - `components/staff/StaffFrame.tsx`, `components/staff/staff-parts.test.tsx`;
  - `components/staff/StaffSkeleton.test.tsx`.
- **Pages:**
  - `app/admin/page.tsx` (rewritten);
  - every other `app/admin/**/page.tsx`: the eyebrow, plus the changes listed in Tasks 8 to 10;
  - `app/hub/manage/page.tsx`, `app/hub/new/page.tsx`, `app/hub/[id]/edit/page.tsx`: the eyebrow.
- **Components:**
  - `components/staff/AdminSellers.tsx`, `AdminReports.tsx`, `AdminHidden.tsx`, `AdminNumbers.tsx`, `AdminStaff.tsx`, `AdminMore.tsx`;
  - their tests;
  - `components/account/AccountView.test.tsx`.
- **Delete:** `components/staff/AdminOverview.tsx`, `components/staff/AdminOverview.test.tsx`.
- **Styles:** `app/globals.css`: one new block at the end, "Role views N3".
- **End-to-end:**
  - `tests/e2e/staff.spec.ts`, `staff-checks.spec.ts`, `staff-accounts-checks.spec.ts`, `staff-accounts-writes.spec.ts`, `staff-accounts-screenshots.spec.ts`, `screenshots.spec.ts`, `role-views-screenshots.spec.ts`;
  - `tests/e2e-supabase/mvp.spec.ts`.
- **Docs:** `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`.

---

### Task 0: Check N1 is in, and record the baselines

**Files:** none changed. The numbers go into "Changes made during the build" at the end of this plan.

- [ ] **Step 1: Check the tree**

```bash
git status
```
Expected: nothing under `app/`, `components/`, `lib/` or `tests/` is modified. Other sessions' plans may be untracked. If anything else is dirty, stop and ask the controller.

- [ ] **Step 2: Check N1's names exist**

```bash
ls components/kit components/charts && grep -n "export function NeedsYouList\|keepWhenZero" components/kit/NeedsYouList.tsx && grep -n "export type BarRow\|export function BarList" components/charts/BarList.tsx && grep -n "export type CountValue" components/charts/StatDelta.tsx && grep -n "ADMIN_MORE_PATH" lib/staff/paths.ts && grep -n "PageTransition" app/admin/page.tsx
```
Expected: every grep prints a line. If one doesn't, N1 isn't fully built: stop and tell the controller.

- [ ] **Step 3: Measure first-visit JS**

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Expected: all pass. Copy each page's `scriptBrotli` into "Changes made during the build" under "Baseline (N3 Task 0)". They should equal N1's final numbers; if they don't, write both down. This is the stage baseline for Task 13 Step 5.

---

### Task 1: `listBookings` lists open requests oldest first (both backends)

**Files:**
- Modify: `lib/data/hub-posts.ts:290-299`, `lib/data/supabase/hub-posts.ts:373-397`, `components/staff/HubManage.tsx:39,86`
- Test: `lib/data/hub-posts.test.ts:160-176`, `lib/data/contract/hub-staff.contract.ts:162`

- [ ] **Step 1: Change the sample test first.** In `lib/data/hub-posts.test.ts`, replace the test starting at line 160 with:

```ts
  it("lists open requests first, oldest first, then answered ones; an answer is given once (role views spec 6)", async () => {
    const made = (await slot("acc-seller")) as Exclude<Awaited<ReturnType<typeof slot>>, string>;
    // bk-s1 was asked on 13 October, the new one on 14 October: the one that has waited longest comes first.
    expect((await listBookings()).map((booking) => booking.id)).toEqual(["bk-s1", made.booking.id]);
    expect(await openBookingCount()).toBe(2);
    expect(await answerBooking("bk-s1", "accepted", "acc-mentor", LATER)).toEqual({
      accountId: "acc-student",
      postId: "h-007",
      postTitle: "Office hours: your first listing",
      studentName: "Thandi",
    });
    expect(await answerBooking("bk-s1", "declined", "acc-mentor", LATER)).toBeNull();
    expect((await listBookings()).map((booking) => [booking.id, booking.status])).toEqual([
      [made.booking.id, "open"],
      ["bk-s1", "accepted"],
    ]);
    expect(sampleStore().hubBookings.get("bk-s1")).toMatchObject({ answeredAt: LATER.toISOString(), answeredBy: "acc-mentor" });
  });
```

- [ ] **Step 2: Change the contract.** In `lib/data/contract/hub-staff.contract.ts`, replace line 162:

```ts
    expect((await world.asViewer("staff", () => listBookings()))[0]).toMatchObject({ id: booking.id, studentName: "Asker", status: "open" });
```
with
```ts
    // Open requests come oldest first (role views spec 6), so the one just made is the last open one.
    const open = (await world.asViewer("staff", () => listBookings())).filter((row) => row.status === "open");
    expect(open.at(-1)).toMatchObject({ id: booking.id, studentName: "Asker", status: "open" });
```

Then add this test after the last `it(…)` in `hubStaffContract`, before its closing `}`:

```ts
  it("lists open slot requests oldest first, before the answered ones (role views spec 6)", async () => {
    await world.signedIn("asker");
    await world.signedIn("shopper");
    const post = await newPost({ ...TIP, kind: "office-hours", title: "Contract queue order", campusSlug: "pretoria", startsAt: AHEAD(), place: "The Hub" });
    const ask = async (name: "asker" | "shopper") => {
      const now = new Date();
      const made = await world.asViewer(name, (id) =>
        requestSlot({ postId: post, accountId: id, help: "Pricing.", time: "Any time", today: sastDate(now), now }),
      );
      // Two requests never share a time on either backend.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return (made as Exclude<typeof made, string>).booking.id;
    };
    const first = await ask("asker");
    const second = await ask("shopper");
    const queue = await world.asViewer("staff", () => listBookings());
    const open = queue.filter((row) => row.status === "open");
    // Every open request comes before every answered one, in the order they were asked.
    expect(queue.slice(0, open.length).every((row) => row.status === "open")).toBe(true);
    expect(open.map((row) => row.createdAt)).toEqual([...open.map((row) => row.createdAt)].sort());
    expect(open.findIndex((row) => row.id === first)).toBeLessThan(open.findIndex((row) => row.id === second));
  });
```

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run lib/data/hub-posts.test.ts lib/data/contract/hub-staff.test.ts`
Expected: FAIL. The sample test gets `[made, "bk-s1"]`, and the new contract test finds `second` before `first`.

- [ ] **Step 4: Change the sample reader.** In `lib/data/hub-posts.ts`, replace lines 290–299 with:

```ts
/**
 * The office-hours queue (plan decision 14; role views spec 6): open requests oldest first, so the one that has waited
 * longest is answered first and the admin's Today can link to it; then the 30 most recently answered.
 */
export async function listBookings(): Promise<HubBooking[]> {
  if (onSupabase()) return (await supabase()).listBookings();
  const rows = [...sampleStore().hubBookings.values()];
  const open = rows
    .filter((row) => row.status === "open")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const answered = rows
    .filter((row) => row.status !== "open")
    .sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""))
    .slice(0, 30);
  return [...open, ...answered].map(toBooking);
}
```

- [ ] **Step 5: Change the Supabase twin.** In `lib/data/supabase/hub-posts.ts`, replace lines 373–397 (`listBookings`) with:

```ts
/** The office-hours queue: open requests oldest first (role views spec 6), then the 30 most recently answered. */
export const listBookings: typeof Sample.listBookings = async () => {
  const client = await forViewer();
  const [open, answered] = await Promise.all([
    selectAll(
      () =>
        client
          .from("hub_bookings")
          .select(BOOKING_COLUMNS)
          .eq("status", "open")
          .order("created_at", { ascending: true }),
      ["id"],
    ),
    client
      .from("hub_bookings")
      .select(BOOKING_COLUMNS)
      .neq("status", "open")
      .order("answered_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
  ]);
  if (answered.error) failed("hub_bookings", answered.error);
  const oldestFirst = [...open].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
  );
  return bookingViews(client, [...oldestFirst, ...answered.data], true);
};
```

- [ ] **Step 6: The Hub's caption says the same.** In `components/staff/HubManage.tsx`:
  - line 39: "open requests first, newest first" becomes "open requests first, oldest first";
  - line 86: `caption="Slot requests, open first, newest first"` becomes `caption="Slot requests, open first, oldest first"`.

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run lib/data/hub-posts.test.ts lib/data/contract/hub-staff.test.ts components/staff/HubManage.test.tsx`
Expected: PASS.

Then, against the local stack (`supabase start`, then `supabase db reset`):
Run: `pnpm test:db lib/data/contract/hub-staff.db.test.ts`
Expected: PASS, the parity test "gives the same office-hours queue and count" included. No SQL changed, so there's no pgTAP to add.

- [ ] **Step 8: Commit (controller)**

```bash
git add lib/data/hub-posts.ts lib/data/supabase/hub-posts.ts lib/data/hub-posts.test.ts lib/data/contract/hub-staff.contract.ts components/staff/HubManage.tsx
git commit -m "feat(hub): the office-hours queue lists open requests oldest first, on both backends (role views N3 Task 1)"
```

---

### Task 2: A report's campus, for the campus chips (both backends)

**Files:**
- Modify: `lib/data/staff-reports.ts` (`ReportView` 17–50, `ReportLookups` 59–68, `reportViewOver` 134–156)
- Modify: `lib/data/supabase/staff-reports.ts:86,90,91,116-120`
- Test: `lib/data/contract/staff-reports.contract.ts`

- [ ] **Step 1: Write the failing contract checks.** In `lib/data/contract/staff-reports.contract.ts`:

In the first test ("shows a listing's report with Hide and Pause…"), add `campusSlug: "pretoria",` to the first `toMatchObject` after `shop: { slug, name: "Contract Shopper's shop" },`. The world's shops are on Pretoria (`tests/contract/world.ts:30`).

In "lets the Hub hide a reported request until it's hidden", add `campusSlug: "pretoria",` after `shop: null,`. Both worlds post requests on Pretoria (`tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`).

In "shows a shop that has gone as gone, with no shop to pause", add `campusSlug: null,` after `shop: null,` in the second `toMatchObject`, and `campusSlug: "pretoria"` to the first:

```ts
    expect(await asStaff((staffId) => getReport(id, staffId))).toMatchObject({ exists: true, campusSlug: "pretoria", can: { pause: true } });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run lib/data/contract/staff-reports.test.ts`
Expected: FAIL (no `campusSlug` on the view).

- [ ] **Step 3: The sample side.** In `lib/data/staff-reports.ts`:

In `ReportView`, after the `shop` field (line 41), add:

```ts
  /**
   * Where what was reported is, for the Reports list's campus chips (role views N3 plan decision 10): the shop's campus
   * for a listing or a shop, the request's own for a request. Null once it has gone.
   */
  campusSlug: string | null;
```

In `ReportLookups`, change the `shop` and `request` lines to:

```ts
  shop(slug: string): { slug: string; name: string; campusSlug: string | null } | undefined;
  request(id: string): { hiddenAt: string | null; campusSlug: string | null } | undefined;
```

The sample lookups need no change: `store.sellers.get` gives a `SellerRow` and `store.requests.get` a `RequestRow`, and both carry `campusSlug`.

In `reportViewOver`'s returned object, after `shop: shopRow ? { slug: shopRow.slug, name: shopRow.name } : null,` (line 150), add:

```ts
    campusSlug: row.targetKind === "request" ? (requestRow?.campusSlug ?? null) : (shopRow?.campusSlug ?? null),
```

- [ ] **Step 4: The Supabase side.** In `lib/data/supabase/staff-reports.ts`'s `lookupsFor`:

Line 86 becomes:
```ts
    rowsIn((chunk) => client.from("requests").select("id, hidden_at, campus_slug").in("id", chunk), ids("request"), "requests"),
```
Lines 90–91 become:
```ts
    rowsIn((chunk) => client.from("shops").select("id, slug, name, campus_slug").in("id", chunk), shopIds, "shops"),
    rowsIn((chunk) => client.from("shops").select("id, slug, name, campus_slug").in("slug", chunk), ids("seller"), "shops"),
```
Lines 116–120 (`shop` and `request`) become:
```ts
    shop(slug) {
      const row = shops.get(slug);
      return row ? { slug: row.slug, name: row.name, campusSlug: row.campus_slug ?? null } : undefined;
    },
    request(id) {
      const row = requestById.get(id);
      return row ? { hiddenAt: iso(row.hidden_at), campusSlug: row.campus_slug ?? null } : undefined;
    },
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run lib/data/contract/staff-reports.test.ts lib/data/staff-reports.test.ts components/staff && pnpm typecheck`
Expected: PASS, no type errors.

Run: `pnpm test:db lib/data/contract/staff-reports.db.test.ts`
Expected: PASS on the local stack.

- [ ] **Step 6: Commit (controller)**

```bash
git add lib/data/staff-reports.ts lib/data/supabase/staff-reports.ts lib/data/contract/staff-reports.contract.ts
git commit -m "feat(staff): a report's view carries its campus on both backends, for the campus chips (role views N3 Task 2)"
```

---

### Task 3: Ages (`lib/kit/age.ts`)

**Files:**
- Create: `lib/kit/age.ts`, `lib/kit/age.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { waitAge } from "./age";

// 2026-10-22 10:00 UTC (12:00 SAST).
const NOW = new Date("2026-10-22T10:00:00.000Z");

describe("waitAge (role views N3 plan decision 1)", () => {
  it("is in hours under a day", () => {
    expect(waitAge("2026-10-22T09:30:00.000Z", NOW)).toEqual({ label: "Under 1h", tone: "info" });
    expect(waitAge("2026-10-22T05:00:00.000Z", NOW)).toEqual({ label: "5h", tone: "info" });
  });

  it("is in whole days from a day on", () => {
    expect(waitAge("2026-10-21T10:00:00.000Z", NOW)).toEqual({ label: "1 day", tone: "info" });
    expect(waitAge("2026-10-10T12:20:00.000Z", NOW)).toEqual({ label: "11 days", tone: "warning" });
  });

  it("turns warning only once it's waited more than 2 days", () => {
    expect(waitAge("2026-10-20T10:00:00.000Z", NOW)).toEqual({ label: "2 days", tone: "info" });
    expect(waitAge("2026-10-20T09:59:00.000Z", NOW)).toEqual({ label: "2 days", tone: "warning" });
  });

  it("takes another threshold (N2's 24 hours)", () => {
    expect(waitAge("2026-10-21T09:00:00.000Z", NOW, 24)).toEqual({ label: "1 day", tone: "warning" });
  });

  it("is null without a time, and never negative", () => {
    expect(waitAge(null, NOW)).toBeNull();
    expect(waitAge("not a date", NOW)).toBeNull();
    expect(waitAge("2026-10-23T10:00:00.000Z", NOW)).toEqual({ label: "Under 1h", tone: "info" });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/kit/age.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/kit/age.ts`

```ts
// How long something has waited, for the role homes' age chips (role views spec 5.2 and 8; N3 plan decision 1). It is
// elapsed time from `now`, which the caller reads at request time (after connection()), so no day boundary, and no
// timezone, is involved.

export type WaitAge = { label: string; tone: "info" | "warning" };

const HOUR = 3_600_000;

/**
 * "Under 1h", "5h", "1 day", "3 days". Warning once it has waited more than `warnAfterHours` (the admin's 2 days by
 * default). Null when there's no time to count from.
 */
export function waitAge(since: string | null, now: Date, warnAfterHours = 48): WaitAge | null {
  if (since === null) return null;
  const start = Date.parse(since);
  if (Number.isNaN(start)) return null;
  const hours = Math.max(0, (now.getTime() - start) / HOUR);
  const tone = hours > warnAfterHours ? "warning" : "info";
  if (hours < 1) return { label: "Under 1h", tone };
  if (hours < 24) return { label: `${Math.floor(hours)}h`, tone };
  const days = Math.floor(hours / 24);
  return { label: `${days} ${days === 1 ? "day" : "days"}`, tone };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/kit/age.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/kit/age.ts lib/kit/age.test.ts
git commit -m "feat(kit): waitAge, elapsed waits in hours then days with a warning threshold (role views N3 Task 3)"
```

---

### Task 4: The queue and the Next links (`lib/staff/queue.ts`)

**Files:**
- Create: `lib/staff/queue.ts`, `lib/staff/queue.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { listBookings, openBookingCount } from "@/lib/data/hub-posts";
import { countHidden, listReports, openReportCount, type ReportView } from "@/lib/data/staff-reports";
import { countWaitingShops, listShopsForReview, type ShopReview } from "@/lib/data/staff-shops";
import { resetSampleStore } from "@/lib/data/store";
import type { HubBooking } from "@/lib/types";
import { hiddenLine, nextOpenReport, nextWaitingShop, oldestOf, todayLede, todayQueue } from "./queue";

// 2026-10-22 08:00 UTC.
const NOW = new Date("2026-10-22T08:00:00.000Z");

// Only the fields the queue reads; the rest of each view doesn't matter here.
const shop = (slug: string, name: string, standing: ShopReview["standing"], appliedAt: string | null) =>
  ({ shop: { slug, name, campusSlug: "pretoria" }, standing, appliedAt }) as unknown as ShopReview;
const report = (id: string, open: boolean, createdAt: string) =>
  ({ id, open, createdAt, targetTitle: `Thing ${id}` }) as unknown as ReportView;
const booking = (id: string, status: HubBooking["status"], createdAt: string) =>
  ({ id, status, createdAt, postTitle: "Office hours: your first listing" }) as unknown as HubBooking;

const SHOPS = [
  shop("tech-corner", "Tech corner", "open", "2026-03-02T09:40:00.000Z"),
  shop("crochet-corner", "Crochet corner", "waiting", "2026-10-10T12:20:00.000Z"),
  shop("bake-house", "Bake house", "waiting", "2026-10-21T08:00:00.000Z"),
  shop("old-decline", "Old decline", "declined", "2026-10-01T08:00:00.000Z"),
];
const REPORTS = [
  report("r1", true, "2026-10-20T07:00:00.000Z"),
  report("r2", true, "2026-10-21T20:00:00.000Z"),
  report("r0", false, "2026-09-01T08:00:00.000Z"),
];
const BOOKINGS = [booking("bk-s1", "open", "2026-10-13T10:15:00.000Z"), booking("bk-old", "accepted", "2026-09-01T08:00:00.000Z")];

describe("oldestOf", () => {
  it("picks the earliest, puts items without a time last, and keeps the list's order on a tie", () => {
    const items = [
      { id: "a", at: null },
      { id: "b", at: "2026-10-12T00:00:00.000Z" },
      { id: "c", at: "2026-10-11T00:00:00.000Z" },
      { id: "d", at: "2026-10-11T00:00:00.000Z" },
    ];
    expect(oldestOf(items, (item) => item.at)?.id).toBe("c");
    expect(oldestOf([items[0]], (item) => item.at)?.id).toBe("a");
    expect(oldestOf([], () => null)).toBeNull();
  });
});

describe("todayQueue (role views spec 7.2)", () => {
  it("lists shops, slot requests and reports by their oldest wait, then Hidden, each linking to its oldest item", () => {
    const queue = todayQueue({ shops: SHOPS, reports: REPORTS, bookings: BOOKINGS, hidden: { listings: 2, requests: 1 }, now: NOW });
    expect(queue.items.map((item) => item.key)).toEqual(["shops", "slots", "reports", "hidden"]);
    expect(queue.items[0]).toEqual({
      key: "shops",
      count: 2,
      title: "Shops to approve",
      detail: "Oldest: Crochet corner",
      age: { label: "11 days", tone: "warning" },
      href: "/admin/sellers/crochet-corner",
      urgent: true,
    });
    expect(queue.items[1]).toEqual({
      key: "slots",
      count: 1,
      title: "Slot request",
      detail: "Oldest: Office hours: your first listing",
      age: { label: "8 days", tone: "warning" },
      href: "/hub/manage#hub-queue",
      urgent: true,
    });
    // 49 hours: over 2 days, so warning, though it reads "2 days".
    expect(queue.items[2]).toEqual({
      key: "reports",
      count: 2,
      title: "Open reports",
      detail: "Oldest: Thing r1",
      age: { label: "2 days", tone: "warning" },
      href: "/admin/reports/r1",
      urgent: true,
    });
    expect(queue.items[3]).toEqual({
      key: "hidden",
      count: 3,
      title: "Hidden by the Hub",
      detail: "2 listings and 1 request are hidden",
      href: "/admin/hidden",
    });
    expect(queue.waiting).toBe(5);
    expect(queue.oldestAt).toBe("2026-10-10T12:20:00.000Z");
  });

  it("leaves out empty rows and declined shops, and counts nothing when nothing waits", () => {
    const queue = todayQueue({ shops: [SHOPS[0], SHOPS[3]], reports: [REPORTS[2]], bookings: [BOOKINGS[1]], hidden: { listings: 0, requests: 0 }, now: NOW });
    expect(queue).toEqual({ items: [], waiting: 0, oldestAt: null });
  });

  it("shows Hidden alone without counting it as waiting", () => {
    const queue = todayQueue({ shops: [], reports: [], bookings: [], hidden: { listings: 0, requests: 1 }, now: NOW });
    expect(queue.items.map((item) => item.key)).toEqual(["hidden"]);
    expect(queue.waiting).toBe(0);
  });

  it("gives a shop with no application date no age chip, after the timed rows", () => {
    const queue = todayQueue({
      shops: [shop("no-date", "No date", "waiting", null)],
      reports: [REPORTS[0]],
      bookings: [],
      hidden: { listings: 0, requests: 0 },
      now: NOW,
    });
    expect(queue.items.map((item) => item.key)).toEqual(["reports", "shops"]);
    expect(queue.items[1].age).toBeUndefined();
  });
});

describe("todayLede", () => {
  it("says how many wait and how long the oldest has", () => {
    expect(todayLede({ waiting: 5, oldestAt: "2026-10-10T12:20:00.000Z" }, NOW)).toBe("5 waiting · oldest 11 days");
    expect(todayLede({ waiting: 1, oldestAt: "2026-10-22T07:30:00.000Z" }, NOW)).toBe("1 waiting · oldest under 1h");
    expect(todayLede({ waiting: 1, oldestAt: null }, NOW)).toBe("1 waiting");
    expect(todayLede({ waiting: 0, oldestAt: null }, NOW)).toBe("Nothing waiting");
  });
});

describe("the Next links (role views spec 7.2)", () => {
  it("leads from a shop to the oldest waiting shop that isn't it", () => {
    expect(nextWaitingShop(SHOPS, "tech-corner")?.shop.slug).toBe("crochet-corner");
    expect(nextWaitingShop(SHOPS, "crochet-corner")?.shop.slug).toBe("bake-house");
    expect(nextWaitingShop([SHOPS[1]], "crochet-corner")).toBeNull();
  });

  it("leads from a report to the oldest open report that isn't it", () => {
    expect(nextOpenReport(REPORTS, "r1")?.id).toBe("r2");
    expect(nextOpenReport(REPORTS, "r0")?.id).toBe("r1");
    expect(nextOpenReport([REPORTS[0], REPORTS[2]], "r1")).toBeNull();
  });
});

describe("hiddenLine (stage J plan decision 17, moved from AdminOverview)", () => {
  it("names listings and requests in words, or nothing", () => {
    expect(hiddenLine({ listings: 1, requests: 0 })).toBe("1 listing is hidden");
    expect(hiddenLine({ listings: 0, requests: 1 })).toBe("1 request is hidden");
    expect(hiddenLine({ listings: 0, requests: 3 })).toBe("3 requests are hidden");
    expect(hiddenLine({ listings: 1, requests: 1 })).toBe("1 listing and 1 request are hidden");
    expect(hiddenLine({ listings: 0, requests: 0 })).toBeNull();
  });
});

describe("each row counts what its bar badge counts (role views spec 4.2)", () => {
  beforeEach(() => {
    resetSampleStore();
  });

  it("matches countWaitingShops, openReportCount and openBookingCount on the sample store", async () => {
    const queue = todayQueue({
      shops: await listShopsForReview(),
      reports: await listReports(),
      bookings: await listBookings(),
      hidden: await countHidden(),
      now: NOW,
    });
    const count = (key: string) => queue.items.find((item) => item.key === key)?.count ?? 0;
    expect(count("shops")).toBe(await countWaitingShops());
    expect(count("reports")).toBe(await openReportCount());
    expect(count("slots")).toBe(await openBookingCount());
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/staff/queue.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/staff/queue.ts`

```ts
import type { NeedsYouItem } from "@/components/kit/NeedsYouList";
import type { ReportView } from "@/lib/data/staff-reports";
import type { ShopReview } from "@/lib/data/staff-shops";
import { waitAge } from "@/lib/kit/age";
import type { HubBooking } from "@/lib/types";
import { ADMIN_HIDDEN_PATH, HUB_MANAGE_PATH, adminReportPath, adminSellerPath } from "./paths";

// The admin's Today queue and the item pages' Next links (role views spec 7.2), worked out from the lists the pages
// read (listShopsForReview, listReports, listBookings, countHidden). Each row's count is its list's length, so it
// equals the admin bar's badge. Pure: the page reads the clock and the lists; these decide.

/** The item that has waited longest: the earliest `at`. Items without a time come after every timed one; ties keep the list's order. */
export function oldestOf<T>(items: readonly T[], at: (item: T) => string | null): T | null {
  let oldest: T | null = null;
  let oldestTime = Infinity;
  for (const item of items) {
    const raw = at(item);
    const parsed = raw === null ? NaN : Date.parse(raw);
    const time = Number.isNaN(parsed) ? Infinity : parsed;
    if (oldest === null || time < oldestTime) {
      oldest = item;
      oldestTime = time;
    }
  }
  return oldest;
}

/** "2 listings and 1 request are hidden", "1 listing is hidden", or null when nothing is (stage J plan decision 17). */
export function hiddenLine({ listings, requests }: { listings: number; requests: number }): string | null {
  const parts = [
    listings > 0 ? `${listings} ${listings === 1 ? "listing" : "listings"}` : null,
    requests > 0 ? `${requests} ${requests === 1 ? "request" : "requests"}` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" and ")} ${listings + requests === 1 ? "is" : "are"} hidden`;
}

export type TodayInput = {
  shops: readonly ShopReview[];
  reports: readonly ReportView[];
  bookings: readonly HubBooking[];
  hidden: { listings: number; requests: number };
  now: Date;
};

export type TodayQueue = {
  /** The rows: the waiting ones by their oldest wait, oldest first; Hidden last (plan decisions 2 and 3). */
  items: NeedsYouItem[];
  /** Shops, reports and slot requests waiting on the Hub. Hidden isn't counted: the Hub has already acted. */
  waiting: number;
  /** When the oldest of them started waiting, or null. */
  oldestAt: string | null;
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
const timeOf = (at: string | null) => {
  const parsed = at === null ? NaN : Date.parse(at);
  return Number.isNaN(parsed) ? Infinity : parsed;
};

export function todayQueue({ shops, reports, bookings, hidden, now }: TodayInput): TodayQueue {
  const waitingShops = shops.filter((review) => review.standing === "waiting");
  const openReports = reports.filter((view) => view.open);
  const openBookings = bookings.filter((row) => row.status === "open");

  const rows: { since: string | null; item: NeedsYouItem }[] = [];
  const shop = oldestOf(waitingShops, (review) => review.appliedAt);
  if (shop) {
    rows.push({
      since: shop.appliedAt,
      item: {
        key: "shops",
        count: waitingShops.length,
        title: plural(waitingShops.length, "Shop to approve", "Shops to approve"),
        detail: `Oldest: ${shop.shop.name}`,
        age: waitAge(shop.appliedAt, now) ?? undefined,
        href: adminSellerPath(shop.shop.slug),
        urgent: true,
      },
    });
  }
  const report = oldestOf(openReports, (view) => view.createdAt);
  if (report) {
    rows.push({
      since: report.createdAt,
      item: {
        key: "reports",
        count: openReports.length,
        title: plural(openReports.length, "Open report", "Open reports"),
        detail: `Oldest: ${report.targetTitle}`,
        age: waitAge(report.createdAt, now) ?? undefined,
        href: adminReportPath(report.id),
        urgent: true,
      },
    });
  }
  const booking = oldestOf(openBookings, (row) => row.createdAt);
  if (booking) {
    rows.push({
      since: booking.createdAt,
      item: {
        key: "slots",
        count: openBookings.length,
        title: plural(openBookings.length, "Slot request", "Slot requests"),
        detail: `Oldest: ${booking.postTitle}`,
        age: waitAge(booking.createdAt, now) ?? undefined,
        href: `${HUB_MANAGE_PATH}#hub-queue`,
        urgent: true,
      },
    });
  }
  // Oldest wait first; a row without a time last. The sort is stable, so ties keep shops, reports, slots.
  rows.sort((a, b) => {
    const left = timeOf(a.since);
    const right = timeOf(b.since);
    return left === right ? 0 : left < right ? -1 : 1;
  });

  const items = rows.map((row) => row.item);
  const hiddenCount = hidden.listings + hidden.requests;
  if (hiddenCount > 0) {
    items.push({
      key: "hidden",
      count: hiddenCount,
      title: "Hidden by the Hub",
      detail: hiddenLine(hidden) ?? undefined,
      href: ADMIN_HIDDEN_PATH,
    });
  }
  return {
    items,
    waiting: waitingShops.length + openReports.length + openBookings.length,
    oldestAt: oldestOf(rows, (row) => row.since)?.since ?? null,
  };
}

/** Today's header line: "7 waiting · oldest 3 days", or "Nothing waiting" (spec 7.2). */
export function todayLede({ waiting, oldestAt }: Pick<TodayQueue, "waiting" | "oldestAt">, now: Date): string {
  if (waiting === 0) return "Nothing waiting";
  const age = waitAge(oldestAt, now);
  return age ? `${waiting} waiting · oldest ${age.label.replace(/^Under/, "under")}` : `${waiting} waiting`;
}

/** A shop page's Next link (spec 7.2): the oldest waiting shop that isn't this one. Declined shops wait on their seller. */
export function nextWaitingShop(shops: readonly ShopReview[], slug: string): ShopReview | null {
  return oldestOf(
    shops.filter((review) => review.standing === "waiting" && review.shop.slug !== slug),
    (review) => review.appliedAt,
  );
}

/** A report page's Next link (spec 7.2): the oldest open report that isn't this one. */
export function nextOpenReport(reports: readonly ReportView[], id: string): ReportView | null {
  return oldestOf(
    reports.filter((view) => view.open && view.id !== id),
    (view) => view.createdAt,
  );
}
```

The dates in the test: 22 Oct 08:00 minus 10 Oct 12:20 is 11 days 19 h 40 min ("11 days"). Minus 13 Oct 10:15 is 8 days 21 h 45 min ("8 days"). Minus 20 Oct 07:00 is 49 h ("2 days", warning). Check these by hand if a label differs, and fix the code, not the test.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/staff/queue.test.ts && pnpm typecheck`
Expected: PASS. `lib/` imports only a *type* from `components/kit/NeedsYouList`, so nothing server-only loads.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/staff/queue.ts lib/staff/queue.test.ts
git commit -m "feat(staff): Today's queue, header line and Next links from the list readers (role views N3 Task 4)"
```

---

### Task 5: Tiles and bars from `protectCounts` (`lib/staff/today-numbers.ts`)

**Files:**
- Create: `lib/staff/today-numbers.ts`, `lib/staff/today-numbers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { MEASURES, protectCounts, type Measure, type Period, type RawColumn, type RawCounts } from "./numbers";
import { campusBars, lastWeekTiles, shownCount } from "./today-numbers";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
  { slug: "durban-umhlanga", name: "Durban Umhlanga" },
];
const column = (campuses: Record<string, number> = {}, gone = 0): RawColumn => ({ campuses, gone });

function shown(overrides: Partial<Record<Measure, Partial<Record<Period, RawColumn>>>> = {}) {
  const counts = Object.fromEntries(
    MEASURES.map(({ measure }) => [measure, { last: column(), before: column(), since: column(), ...overrides[measure] }]),
  ) as Record<Measure, Record<Period, RawColumn>>;
  const raw: RawCounts = { counts, openShops: column() };
  return protectCounts(raw, CAMPUSES.map((campus) => campus.slug));
}

describe("shownCount (role views N3 plan decision 4)", () => {
  it("keeps figures and turns the masks into the kit's words, never 0", () => {
    expect(shownCount("12")).toBe(12);
    expect(shownCount("0")).toBe(0);
    expect(shownCount("Under 5")).toBe("under5");
    expect(shownCount("Hidden")).toBe("hidden");
    // Anything else (a change's "—", Since the start's tens, a missing campus) is hidden, never a number.
    expect(shownCount("—")).toBe("hidden");
    expect(shownCount("Under 10")).toBe("hidden");
    expect(shownCount(undefined)).toBe("hidden");
  });
});

describe("lastWeekTiles (spec 7.2)", () => {
  it("gives listings published, shops approved and reports made, last week against the week before", () => {
    const tiles = lastWeekTiles(
      shown({
        listings: { last: column({ midrand: 6, pretoria: 2 }), before: column({ midrand: 4 }) },
        "reports-made": { last: column({ midrand: 2 }), before: column() },
      }),
    );
    expect(tiles).toEqual([
      { key: "listings", label: "Listings published", value: 8, previous: 4 },
      { key: "shops", label: "Shops approved", value: 0, previous: 0 },
      // Private and from 1 to 4: "Under 5", so the change can't be worked out.
      { key: "reports-made", label: "Reports made", value: "under5", previous: 0 },
    ]);
  });
});

describe("campusBars (spec 7.2; N3 plan decision 5)", () => {
  it("draws campuses with something, largest first, and counts the ones with none", () => {
    const bars = campusBars(shown({ listings: { last: column({ pretoria: 4, midrand: 9 }) } }), "listings", CAMPUSES);
    expect(bars).toEqual({
      rows: [
        { label: "Midrand", value: 9 },
        { label: "Pretoria", value: 4 },
      ],
      summary: "Most at Midrand: 9. 1 campus had none.",
      tooSmall: false,
    });
  });

  it("names every campus tied for most", () => {
    const bars = campusBars(shown({ listings: { last: column({ pretoria: 5, midrand: 5 }) } }), "listings", CAMPUSES);
    expect(bars.summary).toBe("Most at Midrand and Pretoria: 5. 1 campus had none.");
  });

  it("writes small numbers as words instead of a chart", () => {
    const bars = campusBars(shown({ listings: { last: column({ midrand: 2, pretoria: 1 }) } }), "listings", CAMPUSES);
    expect(bars).toMatchObject({ tooSmall: true, summary: "Midrand 2, Pretoria 1. 1 campus had none." });
  });

  it("says when there was nothing", () => {
    expect(campusBars(shown(), "shops", CAMPUSES)).toEqual({ rows: [], tooSmall: true, summary: "None at any campus last week." });
  });

  it("draws nothing when every campus is masked, and never a 0 for a masked campus", () => {
    const bars = campusBars(shown({ enquiries: { last: column({ midrand: 3, pretoria: 12 }) } }), "enquiries", CAMPUSES);
    expect(bars.rows).toEqual([]);
    expect(bars.tooSmall).toBe(true);
    expect(bars.summary).toBe("Hidden by campus: a campus had from 1 to 4 last week, so no one can be picked out.");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/staff/today-numbers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/staff/today-numbers.ts`

```ts
import type { BarRow } from "@/components/charts/BarList";
import { isTooSmallToChart } from "@/lib/charts/scale";
import { joinWords } from "@/lib/format";
import { MEASURES, UNDER_FIVE, type Measure, type ShownCounts } from "./numbers";

// The admin's numbers as the kit draws them (role views spec 7.2 and the N3 numbers fix). Everything here starts from
// protectCounts' words (ShownCounts), never from raw counts, so a masked figure stays masked: "Hidden" or "Under 5",
// never 0. Nothing counted is named, linked or identified: rows are campuses (CLAUDE.md, the admin's numbers).

export type ShownValue = number | "hidden" | "under5";

/** A shown figure as the kit takes it. "Hidden", and anything that isn't a plain figure or "Under 5", is hidden. */
export function shownCount(text: string | undefined): ShownValue {
  if (text !== undefined && /^\d+$/.test(text)) return Number(text);
  return text === UNDER_FIVE ? "under5" : "hidden";
}

/** Today's three (spec 7.2). */
export const TODAY_MEASURES: readonly Measure[] = ["listings", "shops", "reports-made"];

export type LastWeekTile = { key: Measure; label: string; value: ShownValue; previous: ShownValue };

/** Each measure's all-campus total last week, and the week before's for the change (plan decision 4). */
export function lastWeekTiles(shown: ShownCounts, measures: readonly Measure[] = TODAY_MEASURES): LastWeekTile[] {
  return measures.map((measure) => ({
    key: measure,
    label: MEASURES.find((entry) => entry.measure === measure)?.label ?? measure,
    value: shownCount(shown.counts[measure].last.total),
    previous: shownCount(shown.counts[measure].before.total),
  }));
}

export type CampusBars = {
  rows: BarRow[];
  /** The takeaway, one sentence; when `tooSmall`, the numbers themselves in words. */
  summary: string;
  /** No chart: fewer than 2 values, a largest of 3 or under, nothing at all, or every campus masked (spec 5.3). */
  tooSmall: boolean;
};

const words = (value: ShownValue) => (value === "hidden" ? "Hidden" : value === "under5" ? "Under 5" : String(value));
const rank = (value: ShownValue) => (typeof value === "number" ? value : -1);

/** One measure, last week, by campus (plan decision 5): campuses with something, largest first; masked ones hatched. */
export function campusBars(shown: ShownCounts, measure: Measure, campuses: readonly { slug: string; name: string }[]): CampusBars {
  const column = shown.counts[measure].last;
  const all = campuses.map((place) => ({ label: place.name, value: shownCount(column.campuses[place.slug]) }));
  if (all.length > 0 && all.every((row) => typeof row.value !== "number")) {
    return {
      rows: [],
      tooSmall: true,
      summary: "Hidden by campus: a campus had from 1 to 4 last week, so no one can be picked out.",
    };
  }
  // A stable sort: ties keep the campuses' order.
  const rows: BarRow[] = all
    .filter((row) => typeof row.value !== "number" || row.value > 0)
    .sort((a, b) => rank(b.value) - rank(a.value));
  if (rows.length === 0) return { rows: [], tooSmall: true, summary: "None at any campus last week." };
  const none = all.length - rows.length;
  const noneLine = none === 0 ? "" : ` ${none} ${none === 1 ? "campus" : "campuses"} had none.`;
  const values = rows.map((row) => (typeof row.value === "number" ? row.value : null));
  if (isTooSmallToChart(values)) {
    return { rows, tooSmall: true, summary: `${rows.map((row) => `${row.label} ${words(row.value)}`).join(", ")}.${noneLine}` };
  }
  const max = Math.max(...values.filter((value): value is number => value !== null));
  const top = rows.filter((row) => row.value === max).map((row) => row.label);
  return { rows, tooSmall: false, summary: `Most at ${joinWords(top)}: ${max}.${noneLine}` };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/staff/today-numbers.test.ts lib/staff/numbers.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/staff/today-numbers.ts lib/staff/today-numbers.test.ts
git commit -m "feat(staff): last week's tiles and campus bars from protectCounts' words, masks never 0 (role views N3 Task 5)"
```

---

### Task 6: One set of names, Hidden under More, and the frame's line

**Files:**
- Modify: `lib/staff/paths.ts:41-62` (`AREA_HOME`, `STAFF_SECTIONS`, plus two new exports), `lib/staff/paths.test.ts:43-57`
- Modify: `components/staff/StaffFrame.tsx`, `components/staff/staff-parts.test.tsx`
- Modify: `components/ui/NavLink.tsx`, `components/ui/NavLink.test.tsx`, `components/kit/SectionBar.tsx`, `components/kit/SectionBar.test.tsx`, `components/kit/sections.tsx`, `components/kit/sections.test.tsx` (More's `also`, plan decision 8)
- Modify: every `app/admin/**/page.tsx` that renders `StaffFrame` (20 files), and `app/hub/manage/page.tsx`, `app/hub/new/page.tsx`, `app/hub/[id]/edit/page.tsx`
- Modify: `components/account/AccountView.test.tsx:118,125,143,152`
- Create: `lib/staff/names.test.ts`
- Modify: `app/globals.css` (start the N3 block)

- [ ] **Step 1: Write the failing tests**

In `lib/staff/paths.test.ts`, replace the test "lists the frame's sections, the admin console's eight first" with:

```ts
  it("lists the frame's sections, the Hub console's nine first (role views N3 plan decision 7)", () => {
    expect(STAFF_SECTIONS.map((section) => section.label)).toEqual([
      "Today",
      "Shops",
      "Reports",
      "Hidden",
      "Featured",
      "Pickup points",
      "Last week",
      "Staff",
      "Audit log",
      "Hub posts",
      "Mentoring",
    ]);
    expect(AREA_HOME.admin).toEqual({ href: "/admin", label: "Hub console" });
    expect(AREA_HOME.hub).toEqual({ href: "/hub/manage", label: "Hub posts and office hours" });
  });

  it("lists the pages the admin bar's More holds (plan decision 8), and the one eyebrow", () => {
    expect(ADMIN_MORE_SECTIONS).toEqual([
      "/admin/hidden",
      "/admin/featured",
      "/admin/pickup-points",
      "/admin/staff",
      "/admin/numbers",
      "/admin/audit",
      "/mentor",
    ]);
    expect(STAFF_EYEBROW).toEqual({ admin: "Hub console", hub: "Hub console", mentor: "Mentoring" });
  });
```
Add `ADMIN_MORE_SECTIONS` and `STAFF_EYEBROW` to the file's import from `./paths`.

In `components/staff/staff-parts.test.tsx`, in "gives an admin every section…", change `toHaveLength(10)` to `toHaveLength(11)` and `area="Admin console"` to `area="Hub console"`. Then add these tests inside the same `describe`:

```tsx
  it("shows one line under the title when given (Today's count)", () => {
    render(
      <StaffFrame account={{ roles: ["admin"] }} area="Hub console" title="Today" lede="3 waiting · oldest 2 days" current="/admin" notice={null}>
        <p>The page</p>
      </StaffFrame>,
    );
    expect(screen.getByText("3 waiting · oldest 2 days")).toHaveClass("staff-lede");
  });

  it("marks Hidden as the open section in the pill row (role views N3 plan decision 8)", () => {
    render(
      <StaffFrame account={{ roles: ["admin"] }} area="Hub console" title="Hidden listings and requests" current="/admin/hidden" notice={null}>
        <p>The page</p>
      </StaffFrame>,
    );
    expect(within(screen.getByRole("navigation", { name: "Staff tools" })).getByRole("link", { name: "Hidden" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
```

Create `lib/staff/names.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// One name for the console (role views spec 7.2; N3 plan decision 7): every staff page in app/admin and app/hub takes
// its eyebrow from STAFF_EYEBROW, so no page says "Admin console" or "Hub tools" again.

const pagesUnder = (folder: string) =>
  (readdirSync(folder, { recursive: true }) as string[])
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => path.join(folder, file));

describe("the console's eyebrow", () => {
  it("comes from STAFF_EYEBROW on every admin and Hub staff page", () => {
    for (const [folder, area] of [
      ["app/admin", "admin"],
      ["app/hub", "hub"],
    ] as const) {
      const staffPages = pagesUnder(folder).filter((file) => readFileSync(file, "utf8").includes("<StaffFrame"));
      expect(staffPages.length, folder).toBeGreaterThan(0);
      for (const file of staffPages) {
        const source = readFileSync(file, "utf8");
        expect(source, file).toContain(`area={STAFF_EYEBROW.${area}}`);
        expect(source, file).not.toMatch(/Admin console|Hub tools/);
      }
    }
  });
});
```

In `components/account/AccountView.test.tsx`, change `"Admin console"` to `"Hub console"` on lines 118, 125, 143 and 152.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/staff/paths.test.ts lib/staff/names.test.ts components/staff/staff-parts.test.tsx components/account/AccountView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: The paths.** In `lib/staff/paths.ts`, `AREA_HOME.admin` (line 42) becomes:

```ts
  admin: { href: ADMIN_PATH, label: "Hub console" },
```

Replace `STAFF_SECTIONS` and its comment (lines 46–62) with:

```ts
/**
 * The staff frame's row of section links (spec section 3): the Hub console's nine sections (role views N3 plan decision
 * 7's names), then the Hub's tools and the mentor dashboard. The frame shows the ones the account may use. Inside the
 * section shell the admin bar replaces this row (role views N1); it still shows on the Hub's pages.
 */
export const STAFF_SECTIONS: ReadonlyArray<{ href: string; label: string; area: StaffArea }> = [
  { href: ADMIN_PATH, label: "Today", area: "admin" },
  { href: ADMIN_SELLERS_PATH, label: "Shops", area: "admin" },
  { href: ADMIN_REPORTS_PATH, label: "Reports", area: "admin" },
  { href: ADMIN_HIDDEN_PATH, label: "Hidden", area: "admin" },
  { href: ADMIN_FEATURED_PATH, label: "Featured", area: "admin" },
  { href: ADMIN_POINTS_PATH, label: "Pickup points", area: "admin" },
  { href: ADMIN_NUMBERS_PATH, label: "Last week", area: "admin" },
  { href: ADMIN_STAFF_PATH, label: "Staff", area: "admin" },
  { href: ADMIN_AUDIT_PATH, label: "Audit log", area: "admin" },
  { href: HUB_MANAGE_PATH, label: "Hub posts", area: "hub" },
  { href: MENTOR_PATH, label: "Mentoring", area: "mentor" },
];

/** The staff pages' eyebrow (role views spec 7.2: one name for the console). A test reads app/admin and app/hub for it. */
export const STAFF_EYEBROW: Readonly<Record<StaffArea, string>> = {
  admin: "Hub console",
  hub: "Hub console",
  mentor: "Mentoring",
};

/**
 * The pages the admin bar's More holds (role views N1's /admin/more), and the mentor dashboard an admin reaches from
 * it: on these, and the pages below them, More is the current tab (N3 plan decision 8, through NavLink's `also`).
 * Add a new More page's path here.
 */
export const ADMIN_MORE_SECTIONS: readonly string[] = [
  ADMIN_HIDDEN_PATH,
  ADMIN_FEATURED_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_STAFF_PATH,
  ADMIN_NUMBERS_PATH,
  ADMIN_AUDIT_PATH,
  MENTOR_PATH,
];
```

- [ ] **Step 4: The frame.** Replace `components/staff/StaffFrame.tsx` with:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { STAFF_SECTIONS } from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
import type { Account } from "@/lib/types";

type StaffFrameProps = {
  account: Pick<Account, "roles">;
  /** The eyebrow, from STAFF_EYEBROW: "Hub console" or "Mentoring". */
  area: string;
  title: string;
  /** One line under the title (Today's "7 waiting · oldest 3 days"). */
  lede?: string;
  /** The section link this page sits under, marked as the open one. */
  current: string;
  /** The last action's notice, worded (lib/staff/notices.ts), or null. */
  notice: string | null;
  children: ReactNode;
};

/**
 * The staff frame (spec section 3): a heading, a row of links to the sections the account may use, the last action's
 * notice as a status line (spec 4), and the content. Server-rendered, with no client code (spec 2.9). Its links don't
 * prefetch: every staff page reads the session (plan decision 19).
 */
export function StaffFrame({ account, area, title, lede, current, notice, children }: StaffFrameProps) {
  const sections = STAFF_SECTIONS.filter((section) => canUse(account, section.area));
  return (
    <div className="page staff-page">
      <header className="staff-head">
        <p className="eyebrow">{area}</p>
        <h1 className="staff-title wrap-anywhere">{title}</h1>
        {lede && <p className="staff-lede">{lede}</p>}
      </header>
      <nav aria-label="Staff tools" className="staff-nav">
        <ul>
          {sections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                prefetch={false}
                aria-current={section.href === current ? "page" : undefined}
                className="staff-nav-link"
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {notice && (
        <p role="status" className="form-notice staff-notice">
          {notice}
        </p>
      )}
      <div className="staff-body">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4b: More is the current tab on the pages it holds, for screen readers too (plan decision 8)**

Write the failing tests first.

In `components/ui/NavLink.test.tsx`, add inside its `describe` (the tests' page is `/`, from `vitest.setup.ts`):
```tsx
  it("is current as a section for any path it's also given, and not for others (role views N3)", () => {
    render(
      <>
        <NavLink href="/admin/more" also={["/"]}>
          More
        </NavLink>
        <NavLink href="/admin/more" also={["/admin/hidden"]}>
          Other more
        </NavLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Other more" })).not.toHaveAttribute("aria-current");
  });

  it("matches an also path only on its own boundary", () => {
    render(
      <NavLink href="/admin/more" also={["/x"]}>
        More
      </NavLink>,
    );
    expect(screen.getByRole("link", { name: "More" })).not.toHaveAttribute("aria-current");
  });
```

In `components/kit/SectionBar.test.tsx`, add inside its `describe`:
```tsx
  it("passes a tab's other paths to NavLink, so it's current there too", () => {
    render(<SectionBar label="x" tabs={[{ key: "more", href: "/admin/more", label: "More", icon: <GridIcon />, also: ["/"] }]} />);
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "true");
  });
```

In `components/kit/sections.test.tsx`, add at the top, after the imports:
```tsx
const nav = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
```
Then add inside `describe("AdminBar", …)`:
```tsx
  it("makes More current on the pages it holds, and only there (role views N3 plan decision 8)", async () => {
    viewer.account = { id: "x", roles: ["admin"] };
    nav.pathname = "/admin/hidden/listings/l-001";
    const { unmount } = render(await AdminBar());
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "true");
    unmount();
    nav.pathname = "/admin/reports";
    render(await AdminBar());
    expect(screen.getByRole("link", { name: "More" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
    nav.pathname = "/admin";
  });
```
A test file's own `vi.mock` of `next/navigation` replaces `vitest.setup.ts`'s for that file. Check that it takes effect, as the setup file's comment asks: the other `AdminBar` tests should still pass with the page at `/admin`. If it doesn't take effect, drop this test; `NavLink`'s and `SectionBar`'s tests cover the behaviour, and Task 13's e2e checks it on the real pages.

Run: `pnpm vitest run components/ui/NavLink.test.tsx components/kit/SectionBar.test.tsx components/kit/sections.test.tsx`
Expected: FAIL (no `also`).

Then implement. In `components/ui/NavLink.tsx`, replace the props type and both functions with:
```tsx
type NavLinkProps = ComponentProps<typeof Link> & {
  href: string;
  /** "section" also marks the pages under href (aria-current="true"), as a tab bar's tab does. */
  match?: "page" | "section";
  /**
   * Other paths whose pages also mark this link current (aria-current="true"): the admin bar's More on the pages it
   * holds (role views N3 plan decision 8).
   */
  also?: readonly string[];
};

/**
 * A link that marks itself aria-current="page" on its own page. Everything else it's given goes to the link as it is
 * (props are passed through rather than named one by one: this file is in every page's layout chunk).
 * usePathname() suspends while Next builds App Shells for routes with unknown params, so the
 * read stays inside this boundary and the plain link is the fallback.
 */
export function NavLink({ match, also, ...props }: NavLinkProps) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <CurrentAwareLink match={match} also={also} {...props} />
    </Suspense>
  );
}

function CurrentAwareLink({ match, also, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const { href } = props;
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const section = (match === "section" && pathname.startsWith(`${href}/`)) || (also?.some(under) ?? false);
  const current = pathname === href ? "page" : section ? "true" : undefined;
  return <Link {...props} aria-current={current} />;
}
```

In `components/kit/SectionBar.tsx`:
- add to `SectionTab`, after `match`:
  ```ts
  /** Other paths whose pages also make this tab current (the admin bar's More, N3 plan decision 8). */
  also?: readonly string[];
  ```
- in `SectionLink`'s `NavLink`, add `also={tab.also}` after `match={tab.match}`.

In `components/kit/sections.tsx`:
- add `ADMIN_MORE_SECTIONS` to the import from `@/lib/staff/paths`;
- the More tab becomes:
  ```tsx
    { key: "more", href: ADMIN_MORE_PATH, label: "More", icon: <MenuIcon />, prefetch: false, also: ADMIN_MORE_SECTIONS },
  ```

Run: `pnpm vitest run components/ui components/kit`
Expected: PASS, and N1's existing `NavLink` and bar tests still pass.

`NavLink` is client code in every page's layout chunk. Task 13 Step 5 records its byte change on every page against Task 0's baseline. N1's `PageTransition` CSS animates only typed navigations, so `aria-current` changes nothing there.

- [ ] **Step 5: The eyebrow on every staff page.**

In each file below, make two changes:
- replace `area="Admin console"` (N1 wrote this on `app/admin/more/page.tsx` too; or `area="Hub tools"` in the Hub's three) with `area={STAFF_EYEBROW.admin}`, or with `area={STAFF_EYEBROW.hub}` in the Hub's three;
- add `STAFF_EYEBROW` to the file's import from `@/lib/staff/paths`. Every file already imports a path from there; `app/admin/staff/[id]/remove-*` included. If one doesn't, add the import line.

Admin (20 files):
- `app/admin/page.tsx` (Task 7 rewrites it; edit it here anyway, so the test passes now);
- `app/admin/more/page.tsx`;
- `app/admin/sellers/page.tsx`, `app/admin/sellers/[slug]/page.tsx`, `app/admin/sellers/[slug]/decline/page.tsx`, `app/admin/sellers/[slug]/pause/page.tsx`;
- `app/admin/reports/page.tsx`, `app/admin/reports/[id]/page.tsx`, `app/admin/reports/[id]/hide/page.tsx`, `app/admin/reports/[id]/pause/page.tsx`;
- `app/admin/hidden/page.tsx`, `app/admin/hidden/listings/[id]/page.tsx`, `app/admin/hidden/requests/[id]/page.tsx`;
- `app/admin/featured/page.tsx`, `app/admin/pickup-points/page.tsx`, `app/admin/numbers/page.tsx`, `app/admin/audit/page.tsx`;
- `app/admin/staff/page.tsx`, `app/admin/staff/[id]/remove-admin/page.tsx`, `app/admin/staff/[id]/remove-mentor/page.tsx`.

Hub (3 files): `app/hub/manage/page.tsx`, `app/hub/new/page.tsx`, `app/hub/[id]/edit/page.tsx`.

Check the count:
```bash
grep -rln "<StaffFrame" app/admin app/hub | wc -l
```
Expected: 23.

- [ ] **Step 6: The tab titles and the Hidden pages' section**

- `app/admin/sellers/page.tsx`: `staffMetadata("admin", "Sellers")` → `staffMetadata("admin", "Shops")`, and `title="Sellers"` → `title="Shops"`.
- `app/admin/numbers/page.tsx`: `staffMetadata("admin", "Numbers")` → `staffMetadata("admin", "Last week")`, and `title="Numbers"` → `title="Last week"`.
- `app/admin/page.tsx`: `staffMetadata("admin", "Admin console")` → `staffMetadata("admin", "Today")`, and `title="Overview"` → `title="Today"`. The doc comment at line 16 also says "Admin console", and `names.test.ts` reads the whole file, so it becomes `/** "Today" for admins, "Page not found" for everyone else (plan decision 1). */`. Task 7 replaces the file, with the same words.
- `app/admin/hidden/page.tsx`:
  - `current={ADMIN_REPORTS_PATH}` → `current={ADMIN_HIDDEN_PATH}`;
  - remove `ADMIN_REPORTS_PATH` from its import;
  - its doc comment's "it sits under Reports in the frame" → "it sits under More (role views N3 plan decision 8)".
- `app/admin/hidden/listings/[id]/page.tsx` and `app/admin/hidden/requests/[id]/page.tsx`:
  - `current={ADMIN_REPORTS_PATH}` → `current={ADMIN_HIDDEN_PATH}`;
  - in the import, `ADMIN_REPORTS_PATH` → `ADMIN_HIDDEN_PATH`.

- [ ] **Step 7: The CSS.** Append at the very end of `app/globals.css`, after N1's blocks:

```css
/* --- Role views N3: the admin's Today and the console's fixes ------------------------------------------------- */
@layer components {
  .staff-lede {
    color: var(--color-muted);
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}
```

Later tasks add their rules inside this block's `@layer components { … }`. (More's current state needs no CSS of its own: `NavLink` sets `aria-current`, which N1's `.section-tab[aria-current]` rules already style.)

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run lib/staff components/staff components/account components/ui components/kit && pnpm typecheck && pnpm lint`
Expected: PASS. `AdminOverview.test.tsx` still passes; it goes in Task 7.

- [ ] **Step 9: Commit (controller)**

```bash
git add lib/staff/paths.ts lib/staff/paths.test.ts lib/staff/names.test.ts components/ui/NavLink.tsx components/ui/NavLink.test.tsx components/kit/SectionBar.tsx components/kit/SectionBar.test.tsx components/kit/sections.tsx components/kit/sections.test.tsx components/staff/StaffFrame.tsx components/staff/staff-parts.test.tsx components/account/AccountView.test.tsx app/admin app/hub/manage/page.tsx app/hub/new/page.tsx "app/hub/[id]/edit/page.tsx" app/globals.css
git commit -m "feat(staff): one eyebrow, Hub console; Shops, Today and Last week; Hidden under More, and More current there through NavLink's also (role views N3 Task 6)"
```

---

### Task 7: Today

**Files:**
- Create: `components/staff/AdminToday.tsx`, `components/staff/AdminToday.test.tsx`
- Rewrite: `app/admin/page.tsx`
- Delete: `components/staff/AdminOverview.tsx`, `components/staff/AdminOverview.test.tsx`
- Modify: `app/globals.css` (the N3 block)

- [ ] **Step 1: Write the failing tests** in `components/staff/AdminToday.test.tsx`

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NeedsYouItem } from "@/components/kit/NeedsYouList";
import { AdminToday } from "./AdminToday";

const WAITING: NeedsYouItem[] = [
  { key: "shops", count: 2, title: "Shops to approve", detail: "Oldest: Crochet corner", age: { label: "11 days", tone: "warning" }, href: "/admin/sellers/crochet-corner", urgent: true },
  { key: "hidden", count: 1, title: "Hidden by the Hub", detail: "1 listing is hidden", href: "/admin/hidden" },
];

const WEEK = {
  label: "12 to 18 Oct",
  beforeLabel: "5 to 11 Oct",
  tiles: [
    { key: "listings" as const, label: "Listings published", value: 8, previous: 4 },
    { key: "shops" as const, label: "Shops approved", value: 1, previous: 1 },
    { key: "reports-made" as const, label: "Reports made", value: "under5" as const, previous: 0 },
  ],
  campuses: {
    rows: [
      { label: "Midrand", value: 6 },
      { label: "Pretoria", value: 2 },
    ],
    summary: "Most at Midrand: 6. 11 campuses had none.",
    tooSmall: false,
  },
};

const today = (overrides: Partial<Parameters<typeof AdminToday>[0]> = {}) =>
  render(<AdminToday waiting={WAITING} week={WEEK} badgesChanged={1} {...overrides} />);

describe("Today (role views spec 7.2)", () => {
  it("puts Waiting first, then Last week, Listings by campus, and the badges last", () => {
    today();
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby") && region.querySelector("h2")?.textContent)).toEqual([
      "Waiting",
      "Last week",
      "Listings by campus",
      "Trust badges",
    ]);
  });

  it("lists what's waiting, each row one link to its oldest item", () => {
    today();
    const list = within(screen.getByRole("region", { name: "Waiting" })).getByRole("list", { name: "Waiting" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/admin/sellers/crochet-corner", "/admin/hidden"]);
    expect(within(links[0]).getByText("11 days")).toHaveAttribute("data-tone", "warning");
  });

  it("says All clear when nothing is waiting", () => {
    today({ waiting: [] });
    expect(screen.getByText("All clear: nothing is waiting for the Hub.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Waiting" })).queryByRole("link")).toBeNull();
  });

  it("shows last week against the week before, masked counts in words and never compared", () => {
    today();
    const week = screen.getByRole("region", { name: "Last week" });
    expect(within(week).getByText("12 to 18 Oct, against the week before (5 to 11 Oct).")).toBeInTheDocument();
    const tiles = within(week).getByRole("list", { name: "Last week's numbers" });
    expect(within(tiles).getAllByRole("listitem")).toHaveLength(3);
    // The arrow is in a child sr-only span, so match the tile's whole text.
    expect(within(tiles).getAllByRole("listitem")[0]).toHaveTextContent("↑ 4 on the week before");
    expect(within(tiles).getByText("Same as the week before")).toBeInTheDocument();
    expect(within(tiles).getByText("Under 5")).toBeInTheDocument();
    expect(within(tiles).getByText("Can't compare")).toBeInTheDocument();
    expect(within(week).getByRole("link", { name: "All numbers" })).toHaveAttribute("href", "/admin/numbers");
  });

  it("draws listings by campus, or writes them when there's too little to draw", () => {
    const { unmount } = today();
    expect(screen.getByRole("img", { name: "Most at Midrand: 6. 11 campuses had none." })).toBeInTheDocument();
    unmount();
    today({ week: { ...WEEK, campuses: { rows: [], summary: "None at any campus last week.", tooSmall: true } } });
    const card = screen.getByRole("region", { name: "Listings by campus" });
    expect(within(card).queryByRole("img")).toBeNull();
    expect(within(card).getByText("None at any campus last week.")).toBeInTheDocument();
  });

  it("says what the badge calculation changed", () => {
    const { unmount } = today({ badgesChanged: 1 });
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("1 shop's badge changed.");
    unmount();
    const none = today({ badgesChanged: 0 });
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("None changed.");
    none.unmount();
    today({ badgesChanged: null });
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("couldn't be worked out just now");
  });

  it("shows a card's error box when its reads failed, and keeps the others (spec 8)", () => {
    today({ waiting: null, week: null });
    expect(within(screen.getByRole("region", { name: "Waiting" })).getByText("What's waiting didn't load.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Waiting" })).getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/admin?retry=today-waiting#today-waiting",
    );
    expect(within(screen.getByRole("region", { name: "Last week" })).getByText("Last week's numbers didn't load.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Listings by campus" })).getByText("Listings by campus didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Trust badges" })).toHaveTextContent("1 shop's badge changed.");
  });
});
```

If the first test's mapping is awkward, read each region's name with `screen.getAllByRole("region").map((region) => within(region).getByRole("heading", { level: 2 }).textContent)` instead. Either gives the four titles in order.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/staff/AdminToday.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `components/staff/AdminToday.tsx`

```tsx
import { BarList } from "@/components/charts/BarList";
import { SectionError } from "@/components/home/SectionError";
import { Card } from "@/components/kit/Card";
import { NeedsYouList, type NeedsYouItem } from "@/components/kit/NeedsYouList";
import { StatRow, StatTile } from "@/components/kit/StatTile";
import { ADMIN_NUMBERS_PATH, ADMIN_PATH } from "@/lib/staff/paths";
import type { CampusBars, LastWeekTile } from "@/lib/staff/today-numbers";

type Week = { label: string; beforeLabel: string; tiles: readonly LastWeekTile[]; campuses: CampusBars };

type AdminTodayProps = {
  /** The queue's rows (lib/staff/queue.ts), or null when its lists didn't load. */
  waiting: readonly NeedsYouItem[] | null;
  /** Last week through protectCounts (lib/staff/today-numbers.ts), or null when the numbers didn't load. */
  week: Week | null;
  /** How many shops' badges the calculation just changed, or null when it failed. */
  badgesChanged: number | null;
};

function badgesLine(changed: number | null): string {
  if (changed === null) {
    return "The trust badges couldn't be worked out just now. They're worked out again next time this page opens.";
  }
  const result = changed === 0 ? "None changed." : `${changed} ${changed === 1 ? "shop's badge" : "shops' badges"} changed.`;
  return `Worked out just now from each shop's conversations, by the rules on the trust page. ${result} Buyers see a change within 15 minutes. Sample shops no account owns keep their sample badges.`;
}

/**
 * The admin's Today (role views spec 7.2): what waits on the Hub, oldest first, each row opening its oldest item; last
 * week's numbers against the week before, only through protectCounts; listings by campus; and the trust badges worked
 * out as the page rendered, below the fold (staff tools spec 2.7). Each card fails on its own (spec 8). Server-only,
 * and the words are samples for Lama to change.
 */
export function AdminToday({ waiting, week, badgesChanged }: AdminTodayProps) {
  return (
    <div className="today">
      <Card title="Waiting" level={2}>
        {waiting ? (
          <NeedsYouList label="Waiting" items={waiting} allClear="All clear: nothing is waiting for the Hub." />
        ) : (
          <div id="today-waiting">
            <SectionError id="today-waiting" title="What's waiting" path={ADMIN_PATH} />
          </div>
        )}
      </Card>
      <Card title="Last week" level={2} action={{ label: "All numbers", href: ADMIN_NUMBERS_PATH }}>
        {week ? (
          <>
            <p className="chart-summary">
              {week.label}, against the week before ({week.beforeLabel}).
            </p>
            <StatRow label="Last week's numbers">
              {week.tiles.map((tile) => (
                <StatTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  delta={{ previous: tile.previous, period: "the week before" }}
                />
              ))}
            </StatRow>
          </>
        ) : (
          <div id="today-week">
            <SectionError id="today-week" title="Last week's numbers" path={ADMIN_PATH} />
          </div>
        )}
      </Card>
      <Card title="Listings by campus" level={2}>
        {!week ? (
          <div id="today-campuses">
            <SectionError id="today-campuses" title="Listings by campus" path={ADMIN_PATH} />
          </div>
        ) : week.campuses.tooSmall ? (
          <p className="chart-summary">{week.campuses.summary}</p>
        ) : (
          <BarList rows={week.campuses.rows} label="Listings published last week" summary={week.campuses.summary} rowHeader="Campus" />
        )}
      </Card>
      <Card title="Trust badges" level={2}>
        <p>{badgesLine(badgesChanged)}</p>
      </Card>
    </div>
  );
}
```

The week label sits in its own sentence, so the dates are written once ("12 to 18 Oct, against the week before (5 to 11 Oct).").

- [ ] **Step 4: Rewrite** `app/admin/page.tsx`

```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminToday } from "@/components/staff/AdminToday";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { recalculateBadges } from "@/lib/data/badges";
import { listBookings } from "@/lib/data/hub-posts";
import { countByWeek } from "@/lib/data/numbers";
import { countHidden, listReports } from "@/lib/data/staff-reports";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { protectCounts } from "@/lib/staff/numbers";
import { ADMIN_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";
import { todayLede, todayQueue } from "@/lib/staff/queue";
import { campusBars, lastWeekTiles } from "@/lib/staff/today-numbers";

/** "Today" for admins, "Page not found" for everyone else (staff tools plan decision 1). */
export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Today");
}

/** Today (role views spec 7.2). The static shell is a wordless skeleton; everything else needs the session. */
export default function AdminPage() {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Today />
      </Suspense>
    </PageTransition>
  );
}

/** The queue from its four lists, or null when one fails: the Waiting card shows its error box (spec 8). */
async function readQueue(now: Date) {
  try {
    const [shops, reports, bookings, hidden] = await Promise.all([
      listShopsForReview(),
      listReports(),
      listBookings(),
      countHidden(),
    ]);
    return todayQueue({ shops, reports, bookings, hidden, now });
  } catch {
    return null;
  }
}

/** Last week through protectCounts (CLAUDE.md), or null when the counts fail. */
async function readWeek(now: Date) {
  try {
    const [{ weeks, raw }, campuses] = await Promise.all([countByWeek(now), getCampuses()]);
    const places = campuses.map((campus) => ({ slug: campus.slug, name: campus.name }));
    const shown = protectCounts(
      raw,
      places.map((place) => place.slug),
    );
    return {
      label: weeks.last.label,
      beforeLabel: weeks.before.label,
      tiles: lastWeekTiles(shown),
      campuses: campusBars(shown, "listings", places),
    };
  } catch {
    return null;
  }
}

async function Today() {
  const account = await requireStaff("admin", ADMIN_PATH);
  // The ages, the weeks and the badges read the clock (decision 26): once, at request time.
  await connection();
  const now = new Date();
  // The badges first, as Overview did (staff tools spec 2.7, plan decision 8): a render can't expire cache tags, and
  // the queue below reads after the calculation has written.
  const badgesChanged = await recalculateBadges(now).then(
    (changed) => changed.length,
    () => null,
  );
  const [queue, week, notice] = await Promise.all([readQueue(now), readWeek(now), takeNotice()]);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title="Today"
      lede={queue ? todayLede(queue, now) : undefined}
      current={ADMIN_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminToday waiting={queue?.items ?? null} week={week} badgesChanged={badgesChanged} />
    </StaffFrame>
  );
}
```

`requireStaff` runs outside every `try`, so its redirect and 404 are never caught.

- [ ] **Step 5: Delete the Overview.** First check what's there, as a separate call:

```bash
ls components/staff/AdminOverview.tsx components/staff/AdminOverview.test.tsx && grep -rn "AdminOverview\|hiddenLine" app components lib tests
```
Expected: both files exist. The grep finds only those two files, plus `lib/staff/queue.ts` and its test (`hiddenLine`). If anything else imports them, stop and tell the controller.

```bash
rm components/staff/AdminOverview.tsx components/staff/AdminOverview.test.tsx
```

- [ ] **Step 6: The CSS.** Inside the N3 block's `@layer components { … }`, after `.staff-lede`, add:

```css
  .today {
    display: grid;
    gap: 16px;
    max-width: 48rem;
  }
```

- [ ] **Step 7: Run the tests and the build**

Run: `pnpm vitest run components/staff lib/staff && pnpm typecheck && pnpm lint`
Expected: PASS.

Run: `pnpm build`
Expected: passes. `/admin` keeps its render mode (a partial prerender: the skeleton is static, the rest streams). If the build flags `new Date()` while prerendering, check that it sits after `await connection()`.

- [ ] **Step 8: Commit (controller)**

```bash
git status
```
Then:
```bash
git add components/staff/AdminToday.tsx components/staff/AdminToday.test.tsx app/admin/page.tsx app/globals.css components/staff/AdminOverview.tsx components/staff/AdminOverview.test.tsx
git commit -m "feat(admin): Today, the queue oldest first with ages, last week through protectCounts, listings by campus, badges last (role views N3 Task 7)"
```
(`git add` on the two deleted paths stages their removal.)

---

### Task 8: Next waiting shop, Next open report

**Files:**
- Create: `components/staff/NextInQueue.tsx`, `components/staff/NextInQueue.test.tsx`
- Modify: `app/admin/sellers/[slug]/page.tsx` (`SellerReview`, lines 35–72), `app/admin/reports/[id]/page.tsx` (`Report`, lines 35–50)
- Modify: `app/globals.css` (the N3 block)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextInQueue } from "./NextInQueue";

describe("NextInQueue (role views spec 7.2)", () => {
  it("is one link to the next item, named by its label and title", () => {
    render(<NextInQueue label="Next waiting shop" next={{ title: "Crochet corner", href: "/admin/sellers/crochet-corner" }} none="No other shop is waiting." />);
    expect(screen.getByRole("link", { name: "Next waiting shop: Crochet corner" })).toHaveAttribute(
      "href",
      "/admin/sellers/crochet-corner",
    );
  });

  it("says so when nothing else waits", () => {
    render(<NextInQueue label="Next open report" next={null} none="No other report is open." />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No other report is open.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/staff/NextInQueue.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** `components/staff/NextInQueue.tsx`

```tsx
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

type NextInQueueProps = {
  /** "Next waiting shop" or "Next open report". */
  label: string;
  next: { title: string; href: string } | null;
  /** What to say when nothing else waits. */
  none: string;
};

/**
 * The next thing to do from a shop or report page (role views spec 7.2, N3 plan decision 9): the oldest open item that
 * isn't this one, one level deeper, never prefetched (staff pages read the session).
 */
export function NextInQueue({ label, next, none }: NextInQueueProps) {
  if (!next) return <p className="staff-next staff-muted">{none}</p>;
  return (
    <p className="staff-next">
      <Link href={next.href} prefetch={false} transitionTypes={["nav-forward"]} className="staff-next-link">
        <span className="staff-next-label">{label}:</span> {next.title}
        <ChevronRightIcon />
      </Link>
    </p>
  );
}
```

- [ ] **Step 4: The shop page.** In `app/admin/sellers/[slug]/page.tsx`:
- add `listShopsForReview` to the import from `@/lib/data/staff-shops`;
- add `import { NextInQueue } from "@/components/staff/NextInQueue";`;
- add `import { nextWaitingShop } from "@/lib/staff/queue";`.

Then replace `SellerReview` with:

```tsx
async function SellerReview({ params }: Pick<PageProps<"/admin/sellers/[slug]">, "params">) {
  const { slug } = await params;
  // The role first, so someone without it gets the 404 whatever the address says (plan decision 1).
  const account = await requireStaff("admin", adminSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  // The admin's own shop shows why in place of its controls, and its owner is never offered as its mentor (stage L
  // spec decisions 4 to 6).
  const own = await ownsShop(account.id, slug);
  const [campuses, categories, points, mentors, notice, admins, shops] = await Promise.all([
    getCampuses(),
    getCategories(),
    // Every point, retired ones too, on either backend (C4/C5 plan Task 17).
    listPickupPoints(),
    listMentors(review.shop.ownerId),
    takeNotice(),
    own ? countAdmins() : Promise.resolve(0),
    // For the Next link (role views spec 7.2): the oldest waiting shop that isn't this one.
    listShopsForReview(),
  ]);
  const next = nextWaitingShop(shops, slug);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title={review.shop.name}
      current={ADMIN_SELLERS_PATH}
      notice={staffNoticeText(notice)}
    >
      <NextInQueue
        label="Next waiting shop"
        next={next && { title: next.shop.name, href: adminSellerPath(next.shop.slug) }}
        none="No other shop is waiting."
      />
      <AdminSeller
        review={review}
        campusName={campuses.find((campus) => campus.slug === review.shop.campusSlug)?.name ?? ""}
        categoryName={categories.find((category) => category.slug === review.shop.categorySlug)?.name ?? ""}
        pointNames={review.shop.pickupPointIds.flatMap((id) => points.find((point) => point.id === id)?.name ?? [])}
        mentors={mentors}
        own={own}
        onlyAdmin={own && admins === 1}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 5: The report page.** In `app/admin/reports/[id]/page.tsx`:
- change the import from `@/lib/data/staff-reports` to `import { getReport, listReports } from "@/lib/data/staff-reports";`;
- add `import { NextInQueue } from "@/components/staff/NextInQueue";`;
- add `import { nextOpenReport } from "@/lib/staff/queue";`.

Then replace `Report` with:

```tsx
async function Report({ params }: Pick<PageProps<"/admin/reports/[id]">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", adminReportPath(id));
  const report = isId(id) ? await getReport(id, account.id) : null;
  if (!report) notFound();
  const [state, notice, reports] = await Promise.all([readFormState(dismissForm(id)), takeNotice(), listReports()]);
  // The Next link (role views spec 7.2): the oldest open report that isn't this one.
  const next = nextOpenReport(reports, id);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title={reportedThing(report)} current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <NextInQueue
        label="Next open report"
        next={next && { title: reportedThing(next), href: adminReportPath(next.id) }}
        none="No other report is open."
      />
      <AdminReport
        report={report}
        note={state?.values.note ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`dismiss-${id}`))}
      />
    </StaffFrame>
  );
}
```

- [ ] **Step 6: The CSS.** Inside the N3 block's `@layer components { … }`, add:

```css
  .staff-next {
    margin-bottom: 8px;
  }

  .staff-next-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
  }

  .staff-next-label {
    color: var(--color-ink);
    font-weight: 400;
  }

  .staff-next-link > svg {
    flex: none;
    width: 18px;
    height: 18px;
  }
```

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run components/staff && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit (controller)**

```bash
git add components/staff/NextInQueue.tsx components/staff/NextInQueue.test.tsx "app/admin/sellers/[slug]/page.tsx" "app/admin/reports/[id]/page.tsx" app/globals.css
git commit -m "feat(admin): Next waiting shop and Next open report on their pages (role views N3 Task 8)"
```

---

### Task 9: Campus chips on Shops, Reports and Hidden

**Files:**
- Create: `lib/staff/campus-filter.ts`, `lib/staff/campus-filter.test.ts`, `components/staff/CampusFilter.tsx`, `components/staff/CampusFilter.test.tsx`
- Rewrite: `app/admin/sellers/page.tsx`, `app/admin/reports/page.tsx`, `app/admin/hidden/page.tsx`
- Modify: `components/staff/AdminSellers.tsx`, `AdminReports.tsx`, `AdminHidden.tsx` and their tests

- [ ] **Step 1: Write the failing tests**

`lib/staff/campus-filter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { campusFilterPath, campusFilterTabs, inCampus, readCampusFilter } from "./campus-filter";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("the campus chips (role views spec 7.2; N3 plan decision 10)", () => {
  it("reads a known campus, and every campus for anything else", () => {
    expect(readCampusFilter({ campus: "pretoria" }, CAMPUSES)).toEqual({ slug: "pretoria", name: "Pretoria" });
    expect(readCampusFilter({ campus: ["midrand", "pretoria"] }, CAMPUSES)?.slug).toBe("midrand");
    expect(readCampusFilter({ campus: "nowhere" }, CAMPUSES)).toBeNull();
    expect(readCampusFilter({ campus: "" }, CAMPUSES)).toBeNull();
    expect(readCampusFilter({}, CAMPUSES)).toBeNull();
  });

  it("links each chip, All campuses first", () => {
    expect(campusFilterPath("/admin/sellers", null)).toBe("/admin/sellers");
    expect(campusFilterPath("/admin/sellers", "midrand")).toBe("/admin/sellers?campus=midrand");
    expect(campusFilterTabs("/admin/reports", CAMPUSES)).toEqual([
      { key: "all", label: "All campuses", href: "/admin/reports" },
      { key: "midrand", label: "Midrand", href: "/admin/reports?campus=midrand" },
      { key: "pretoria", label: "Pretoria", href: "/admin/reports?campus=pretoria" },
    ]);
  });

  it("keeps one campus's items, and everything (gone ones too) for every campus", () => {
    const items = [
      { id: "a", campus: "midrand" },
      { id: "b", campus: "pretoria" },
      { id: "c", campus: null },
    ];
    expect(inCampus(items, CAMPUSES[0], (item) => item.campus).map((item) => item.id)).toEqual(["a"]);
    expect(inCampus(items, null, (item) => item.campus).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
```

`components/staff/CampusFilter.test.tsx`:
```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampusFilter } from "./CampusFilter";

const CAMPUSES = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("CampusFilter", () => {
  it("is a row of links, the chosen campus marked", () => {
    render(<CampusFilter path="/admin/hidden" campuses={CAMPUSES} chosen={CAMPUSES[1]} />);
    const nav = screen.getByRole("navigation", { name: "Filter by campus" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["All campuses", "Midrand", "Pretoria"]);
    expect(within(nav).getByRole("link", { name: "Pretoria" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Pretoria" })).toHaveAttribute("href", "/admin/hidden?campus=pretoria");
  });

  it("marks All campuses when none is chosen", () => {
    render(<CampusFilter path="/admin/hidden" campuses={CAMPUSES} chosen={null} />);
    expect(screen.getByRole("link", { name: "All campuses" })).toHaveAttribute("aria-current", "page");
  });
});
```

Add to `components/staff/AdminSellers.test.tsx`, inside its `describe`:
```tsx
  it("names the campus in the captions when the list is filtered (role views spec 7.2)", async () => {
    const rows = (await listShopsForReview()).filter((row) => row.shop.campusSlug === "pretoria");
    render(<AdminSellers rows={rows} campusNames={names} campusName="Pretoria" />);
    expect(screen.getByRole("table", { name: "Shops waiting for approval, oldest first · Pretoria" })).toBeInTheDocument();
  });
```

Add to `components/staff/AdminReports.test.tsx`, in the last `describe`:
```tsx
  it("names the campus in the captions when the list is filtered (role views spec 7.2)", () => {
    // One open report on Midrand, as the page passes it after inCampus. Only the fields the queue's table reads.
    const open = {
      id: "rep-midrand",
      open: true,
      createdAt: "2026-10-20T08:00:00.000Z",
      target: { kind: "listing", id: "l-001" },
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "spam",
      reporterName: "Thandi",
      campusSlug: "midrand",
    } as unknown as ReportView;
    render(<AdminReports reports={[open]} campusName="Midrand" />);
    expect(screen.getByRole("table", { name: "Open reports, oldest first · Midrand" })).toBeInTheDocument();
    expect(screen.getByText("Nothing closed yet.")).toBeInTheDocument();
  });
```
Import `type ReportView` from `@/lib/data/staff-reports` if the file doesn't already.

Add to `components/staff/AdminHidden.test.tsx`, inside its `describe`:
```tsx
  it("names the campus in the captions when the list is filtered (role views spec 7.2)", () => {
    render(<AdminHidden listings={[listing]} requests={[request]} campusNames={campusNames} campusName="Midrand" />);
    expect(screen.getByRole("table", { name: "Hidden listings (1) · Midrand" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Hidden requests (1) · Midrand" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/staff/campus-filter.test.ts components/staff/CampusFilter.test.tsx components/staff/AdminSellers.test.tsx components/staff/AdminReports.test.tsx components/staff/AdminHidden.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** `lib/staff/campus-filter.ts`

```ts
import type { LinkTab } from "@/components/ui/LinkTabs";
import { parseNumbersCampus } from "./numbers";

// The admin lists' campus chips (role views spec 7.2, N3 plan decision 10): links that add ?campus=, read as the numbers
// read theirs (stage J spec decision 12), so an unknown or empty value shows every campus. No form, no JavaScript.

export type Place = { slug: string; name: string };

export function readCampusFilter(
  params: Readonly<Record<string, string | string[] | undefined>>,
  campuses: readonly Place[],
): Place | null {
  const slug = parseNumbersCampus(
    params,
    campuses.map((campus) => campus.slug),
  );
  return campuses.find((campus) => campus.slug === slug) ?? null;
}

export function campusFilterPath(path: string, slug: string | null): string {
  return slug ? `${path}?campus=${encodeURIComponent(slug)}` : path;
}

/** "All campuses", then each campus in the fixtures' order. */
export function campusFilterTabs(path: string, campuses: readonly Place[]): LinkTab[] {
  return [
    { key: "all", label: "All campuses", href: path },
    ...campuses.map((campus) => ({ key: campus.slug, label: campus.name, href: campusFilterPath(path, campus.slug) })),
  ];
}

/** One campus's items, or every item. Something without a campus (a report about something gone) shows only under All. */
export function inCampus<T>(items: readonly T[], chosen: Place | null, campusOf: (item: T) => string | null): T[] {
  return chosen ? items.filter((item) => campusOf(item) === chosen.slug) : [...items];
}
```

`components/staff/CampusFilter.tsx`:
```tsx
import { LinkTabs } from "@/components/ui/LinkTabs";
import { campusFilterTabs, type Place } from "@/lib/staff/campus-filter";

/** A list's campus chips (role views spec 7.2): links, never prefetched, the chosen one marked. */
export function CampusFilter({ path, campuses, chosen }: { path: string; campuses: readonly Place[]; chosen: Place | null }) {
  return <LinkTabs label="Filter by campus" look="chips" tabs={campusFilterTabs(path, campuses)} current={chosen?.slug ?? "all"} />;
}
```

- [ ] **Step 4: The three lists name the campus.**

`components/staff/AdminSellers.tsx`:
- the props become `{ rows, campusNames, campusName = null }: { rows: readonly ShopReview[]; campusNames: ReadonlyMap<string, string>; campusName?: string | null }`;
- add `const at = campusName ? \` · ${campusName}\` : "";` at the top of the function;
- the two captions become `` caption={`Shops waiting for approval, oldest first${at}`} `` and `` caption={`Open and paused shops, A to Z${at}`} ``.

`components/staff/AdminReports.tsx`:
- the props become `{ reports, campusName = null }: { reports: readonly ReportView[]; campusName?: string | null }`;
- add the same `at` line;
- the captions become `` caption={`Open reports, oldest first${at}`} `` and `` caption={`Closed recently${at}`} ``.

`components/staff/AdminHidden.tsx`:
- `AdminHiddenProps` gains `/** The campus the list is filtered to, for the captions. */ campusName?: string | null;`;
- the function takes `campusName = null`;
- add the same `at` line;
- the captions become `` caption={`Hidden listings (${listings.length})${at}`} `` and `` caption={`Hidden requests (${requests.length})${at}`} ``.

- [ ] **Step 5: Rewrite the three pages**

`app/admin/sellers/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminSellers } from "@/components/staff/AdminSellers";
import { CampusFilter } from "@/components/staff/CampusFilter";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listShopsForReview } from "@/lib/data/staff-shops";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { inCampus, readCampusFilter } from "@/lib/staff/campus-filter";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Shops");
}

/** Shops (staff tools spec 2.3): waiting for approval first, with campus chips (role views spec 7.2). Per request. */
export default function AdminSellersPage({ searchParams }: PageProps<"/admin/sellers">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Shops searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Shops({ searchParams }: Pick<PageProps<"/admin/sellers">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_SELLERS_PATH);
  const [params, rows, campuses, notice] = await Promise.all([searchParams, listShopsForReview(), getCampuses(), takeNotice()]);
  const chosen = readCampusFilter(params, campuses);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Shops" current={ADMIN_SELLERS_PATH} notice={staffNoticeText(notice)}>
      <CampusFilter path={ADMIN_SELLERS_PATH} campuses={campuses} chosen={chosen} />
      <AdminSellers
        rows={inCampus(rows, chosen, (row) => row.shop.campusSlug)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        campusName={chosen?.name ?? null}
      />
    </StaffFrame>
  );
}
```

`app/admin/reports/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminReports } from "@/components/staff/AdminReports";
import { CampusFilter } from "@/components/staff/CampusFilter";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listReports } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { inCampus, readCampusFilter } from "@/lib/staff/campus-filter";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_REPORTS_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Reports");
}

/** Reports (staff tools spec 2.3): open first, with campus chips (role views spec 7.2). */
export default function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_REPORTS_PATH);
  const [params, reports, campuses, notice] = await Promise.all([searchParams, listReports(), getCampuses(), takeNotice()]);
  const chosen = readCampusFilter(params, campuses);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Reports" current={ADMIN_REPORTS_PATH} notice={staffNoticeText(notice)}>
      <CampusFilter path={ADMIN_REPORTS_PATH} campuses={campuses} chosen={chosen} />
      <AdminReports reports={inCampus(reports, chosen, (report) => report.campusSlug)} campusName={chosen?.name ?? null} />
    </StaffFrame>
  );
}
```

`app/admin/hidden/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/kit/PageTransition";
import { AdminHidden } from "@/components/staff/AdminHidden";
import { CampusFilter } from "@/components/staff/CampusFilter";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { listHidden } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { inCampus, readCampusFilter } from "@/lib/staff/campus-filter";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_HIDDEN_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Hidden listings and requests");
}

/**
 * Hidden listings and requests (stage J spec decision 14). Admins only; it sits under More (role views N3 plan decision
 * 8), with campus chips (spec 7.2).
 */
export default function AdminHiddenPage({ searchParams }: PageProps<"/admin/hidden">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Hidden searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Hidden({ searchParams }: Pick<PageProps<"/admin/hidden">, "searchParams">) {
  const account = await requireStaff("admin", ADMIN_HIDDEN_PATH);
  const [params, hidden, campuses, notice] = await Promise.all([searchParams, listHidden(account.id), getCampuses(), takeNotice()]);
  const chosen = readCampusFilter(params, campuses);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title="Hidden listings and requests"
      current={ADMIN_HIDDEN_PATH}
      notice={staffNoticeText(notice)}
    >
      <CampusFilter path={ADMIN_HIDDEN_PATH} campuses={campuses} chosen={chosen} />
      <AdminHidden
        listings={inCampus(hidden.listings, chosen, (item) => item.campusSlug)}
        requests={inCampus(hidden.requests, chosen, (item) => item.campusSlug)}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
        campusName={chosen?.name ?? null}
      />
    </StaffFrame>
  );
}
```

`searchParams` is awaited inside `<Suspense>`, after `requireStaff` (CLAUDE.md).

- [ ] **Step 6: Run the tests and the build**

Run: `pnpm vitest run lib/staff components/staff && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS. The build keeps the three routes in their render mode.

- [ ] **Step 7: Commit (controller)**

```bash
git add lib/staff/campus-filter.ts lib/staff/campus-filter.test.ts components/staff/CampusFilter.tsx components/staff/CampusFilter.test.tsx components/staff/AdminSellers.tsx components/staff/AdminSellers.test.tsx components/staff/AdminReports.tsx components/staff/AdminReports.test.tsx components/staff/AdminHidden.tsx components/staff/AdminHidden.test.tsx app/admin/sellers/page.tsx app/admin/reports/page.tsx app/admin/hidden/page.tsx
git commit -m "feat(admin): campus chips on Shops, Reports and Hidden, links only, unknown campus shows all (role views N3 Task 9)"
```

---

### Task 10: Last week: bars on the numbers page, and its More row

**Files:**
- Modify: `components/staff/AdminNumbers.tsx` (a new section between "All campuses" and "By campus, last week", lines 114–128), `components/staff/AdminNumbers.test.tsx`
- Modify: `components/staff/AdminMore.tsx` (N1's Numbers row), `components/staff/AdminMore.test.tsx`
- Modify: `app/globals.css` (the N3 block)

The page's title and tab title changed in Task 6.

- [ ] **Step 1: Write the failing tests.** Add to `components/staff/AdminNumbers.test.tsx`, using its `shown()`, `WEEKS` and `CAMPUSES`:

```tsx
describe("each measure by campus, as bars (role views spec 7.2)", () => {
  it("draws a chart for each measure with enough to draw, and words for the rest", () => {
    render(<AdminNumbers weeks={WEEKS} shown={shown()} campuses={CAMPUSES} campus={null} sampleMode={false} />);
    const bars = screen.getByRole("region", { name: "Each measure by campus" });
    expect(within(bars).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      MEASURES.map((measure) => measure.label),
    );
    // Listings: Midrand 6, Pretoria 2.
    expect(within(bars).getByRole("img", { name: "Most at Midrand: 6." })).toBeInTheDocument();
    // Enquiries: Midrand had 3, so every campus is hidden and nothing is drawn.
    expect(within(bars).getByText("Hidden by campus: a campus had from 1 to 4 last week, so no one can be picked out.")).toBeInTheDocument();
    expect(within(bars).getAllByRole("img")).toHaveLength(1);
  });

  it("isn't on a campus's own view", () => {
    render(<AdminNumbers weeks={WEEKS} shown={shown()} campuses={CAMPUSES} campus={CAMPUSES[0]} sampleMode={false} />);
    expect(screen.queryByRole("region", { name: "Each measure by campus" })).toBeNull();
  });
});
```

In `components/staff/AdminMore.test.tsx`, add:
```tsx
  it("calls the numbers Last week (role views N3 plan decision 6)", () => {
    render(<AdminMore hidden={{ listings: 0, requests: 0 }} />);
    expect(screen.getByRole("link", { name: /^Last week\s*Every measure, by campus/ })).toHaveAttribute("href", "/admin/numbers");
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/staff/AdminNumbers.test.tsx components/staff/AdminMore.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `components/staff/AdminNumbers.tsx`:
- add `import { BarList } from "@/components/charts/BarList";`;
- add `import { campusBars } from "@/lib/staff/today-numbers";`;
- add this function above `AdminNumbers`:

```tsx
/**
 * Last week, each measure by campus (role views spec 7.2, N3 plan decision 5): a bar chart where there's enough to draw,
 * words where there isn't, and one sentence where every campus is hidden. Only protectCounts' words reach it.
 */
function MeasureBars({ shown, campuses }: { shown: ShownCounts; campuses: readonly Place[] }) {
  return (
    <section aria-labelledby="admin-numbers-bars-title" className="staff-section">
      <h2 id="admin-numbers-bars-title" className="staff-section-title">
        Each measure by campus
      </h2>
      {MEASURES.map(({ measure, label }) => {
        const bars = campusBars(shown, measure, campuses);
        return (
          <div key={measure} className="numbers-bars">
            <h3 className="numbers-bars-title">{label}</h3>
            {bars.tooSmall ? (
              <p className="chart-summary">{bars.summary}</p>
            ) : (
              <BarList rows={bars.rows} label={`${label}, last week`} summary={bars.summary} rowHeader="Campus" />
            )}
          </div>
        );
      })}
    </section>
  );
}
```

In the main (no campus) branch, put `<MeasureBars shown={shown} campuses={campuses} />` between the "All campuses" section's closing `</section>` and the "By campus, last week" section.

In `components/staff/AdminMore.tsx`, the Numbers row becomes:
```tsx
      <ListRow href={ADMIN_NUMBERS_PATH} lead={{ kind: "icon", icon: <ChartIcon /> }} title="Last week" detail="Every measure, by campus" />
```

Inside the N3 block's `@layer components { … }` in `app/globals.css`, add:
```css
  .numbers-bars {
    display: grid;
    gap: 6px;
    margin-top: 16px;
  }

  .numbers-bars-title {
    color: var(--color-navy);
    font-weight: 700;
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/staff && pnpm typecheck && pnpm lint`
Expected: PASS. The existing numbers tests still find their tables: the bars' "Show the numbers" tables have their own captions, and they sit inside closed `<details>`.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/staff/AdminNumbers.tsx components/staff/AdminNumbers.test.tsx components/staff/AdminMore.tsx components/staff/AdminMore.test.tsx app/globals.css
git commit -m "feat(admin): Last week draws each measure by campus through protectCounts; More calls it Last week (role views N3 Task 10)"
```

---

### Task 11: Staff lists people before the form

**Files:**
- Modify: `components/staff/AdminStaff.tsx:152-181`, `components/staff/AdminStaff.test.tsx`

- [ ] **Step 1: Write the failing test.** Add to `components/staff/AdminStaff.test.tsx`, using its `view()`:

```tsx
describe("the page's order (role views spec 7.2)", () => {
  it("lists who has a role before the Give a staff role form", () => {
    view();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who has a role",
      "Give a staff role",
    ]);
  });
});
```

If the error-summary test renders an `<h2>` ("There's a problem"), this test uses `view()` with no errors, so only the two sections' headings show.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/staff/AdminStaff.test.tsx`
Expected: FAIL (the form comes first).

- [ ] **Step 3: Implement.** In `AdminStaff`'s returned fragment, move `<GiveRoleForm values={values} errors={errors} once={once} />` from first to last, after the "Who has a role" section. Its doc comment becomes "Staff accounts (spec decisions 2 and 3): everyone with a role, and no one else, then the Give a staff role form (role views spec 7.2)…", with the rest unchanged. After a failed send, `ErrorSummary` still takes focus (`autoFocus`), so the order doesn't hide the errors.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/staff/AdminStaff.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/staff/AdminStaff.tsx components/staff/AdminStaff.test.tsx
git commit -m "feat(admin): Staff lists who has a role before the Give a role form (role views N3 Task 11)"
```

---

### Task 12: The existing end-to-end tests learn the new words

**Files:**
- Modify: `tests/e2e/staff.spec.ts:83-84`
- Modify: `tests/e2e/staff-checks.spec.ts:36-37,131,170-172`
- Modify: `tests/e2e/staff-accounts-checks.spec.ts:44-45,183`
- Modify: `tests/e2e/staff-accounts-writes.spec.ts:129-131,208-209`
- Modify: `tests/e2e/staff-accounts-screenshots.spec.ts:41,45-46`
- Modify: `tests/e2e/screenshots.spec.ts:578,581`
- Modify: `tests/e2e-supabase/mvp.spec.ts:166,438`

No test changes what it checks, only the words it looks for.

- [ ] **Step 1: Make the edits**
- `staff.spec.ts:83`: `name: "Overview"` → `name: "Today"`. Line 84: `"Admin console · CampusCart"` → `"Today · CampusCart"`.
- `staff-checks.spec.ts`:
  - `STAFF_PAGES`: `["/admin", "Overview"]` → `["/admin", "Today"]`, and `["/admin/sellers", "Sellers"]` → `["/admin/sellers", "Shops"]`;
  - `SHIFT_PAGES`: `["admin console's Overview", "/admin", "Admin"]` → `["Hub console's Today", "/admin", "Admin"]`;
  - `SIZE_PAGES`: `"Overview"` → `"Today"`, `"Sellers"` → `"Shops"`, `"Hub tools"` → `"Hub posts"`.
- `staff-accounts-checks.spec.ts`:
  - `PAGES`: both `"Numbers"` headings → `"Last week"`;
  - `SIZE_PAGES`: `["Overview", "/admin"]` → `["Today", "/admin"]`.
- `staff-accounts-writes.spec.ts`, lines 129–131, become:
  ```ts
    // Today's Waiting list has a Hidden row, which opens the list; the list has it.
    await admin.goto("/admin");
    await main(admin).getByRole("list", { name: "Waiting" }).getByRole("link", { name: /Hidden by the Hub/ }).click();
  ```
  Lines 208–209: `name: "Numbers"` → `name: "Last week"`, and `"Numbers · CampusCart"` → `"Last week · CampusCart"`.
- `staff-accounts-screenshots.spec.ts`:
  - line 41 → `["today", "/admin", "Today", "Hidden by the Hub"],`;
  - lines 45–46: heading `"Numbers"` → `"Last week"` (file names unchanged).
- `screenshots.spec.ts`: line 578 `heading(page, "Overview")` → `heading(page, "Today")`; line 581 `heading(page, "Sellers")` → `heading(page, "Shops")`.
- `tests/e2e-supabase/mvp.spec.ts`: line 166 `/Admin console/` → `/Hub console/`; line 438 `name: "Numbers"` → `name: "Last week"`.

- [ ] **Step 2: Find any other old words**

```bash
grep -rn 'Admin console\|"Overview"\|name: "Sellers"\|"Hub tools"\|name: "Numbers"' tests/e2e tests/e2e-supabase
```
Expected: no hits in admin lookups. Fix any left, the same way. Only admin lookups (`/admin`, the Hub console) change; the seller's Overview tab keeps its name.

- [ ] **Step 3: Check for Next-link clashes.** A link lookup by a listing's or shop's title, without `exact: true`, on a shop or report page can now also match the Next link ("Next open report: Listing: …"):

```bash
grep -rn "getByRole(\"link\", { name: title\|getByRole(\"link\", { name: shopName" tests/e2e
```
For each hit on a report or shop page, add `exact: true`. Task 13's full run catches any that remain (Playwright's strict mode fails on two matches).

- [ ] **Step 4: Commit (controller)** with Task 13, once they pass.

---

### Task 13: End-to-end checks, gates and screenshots

**Files:**
- Create: `tests/e2e/helpers/staff-skeleton.ts`, `tests/e2e/role-views-admin.spec.ts`
- Modify: `components/staff/StaffSkeleton.test.tsx`, `tests/e2e/role-views-screenshots.spec.ts`

- [ ] **Step 1: Keep a copy of the skeleton's markup, checked against the real one**

`tests/e2e/helpers/staff-skeleton.ts`:
```ts
// The staff skeleton's markup (components/staff/StaffSkeleton.tsx), for the check that Today's skeleton is no taller
// than its shortest state (role views N3 plan decision 12). StaffSkeleton.test.tsx keeps the two the same.
export const STAFF_SKELETON_HTML =
  '<div class="page staff-page" aria-hidden="true"><span class="skeleton staff-skeleton-eyebrow"></span><span class="skeleton staff-skeleton-title"></span><span class="skeleton staff-skeleton-nav"></span><span class="skeleton staff-skeleton-body"></span></div>';
```

Add to `components/staff/StaffSkeleton.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { STAFF_SKELETON_HTML } from "@/tests/e2e/helpers/staff-skeleton";
```
and inside its `describe`:
```tsx
  it("matches the copy the end-to-end height check injects (role views N3)", () => {
    expect(renderToStaticMarkup(<StaffSkeleton />)).toBe(STAFF_SKELETON_HTML);
  });
```

Run: `pnpm vitest run components/staff/StaffSkeleton.test.tsx`
Expected: PASS. If it fails, copy the rendered markup into the helper. The helper must follow the component, never the reverse.

- [ ] **Step 2: Write** `tests/e2e/role-views-admin.spec.ts`

```ts
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main, onlyAt, signInAsSample } from "./helpers/messaging";
import { expectStill, holdFonts, recordShifts } from "./helpers/shifts";
import { copySession, DESKTOP, PHONE } from "./helpers/staff-accounts";
import { STAFF_SKELETON_HTML } from "./helpers/staff-skeleton";

// Role views N3: the admin's Today and the console's fixes (spec 7.2, 8 and 9). Reads only, in the device projects
// (plan decision 12): the seed has Crochet corner waiting since 10 October and Thandi's slot request since 13 October,
// both over 2 days old whatever day this runs, and other tests' writes only ever add newer items.

test.use({ reducedMotion: "reduce" });

const BOTH = ["phone-390", "desktop-1440"];
const waitingList = (page: Page) => main(page).getByRole("list", { name: "Waiting" });
const consoleBar = (page: Page) => page.getByRole("navigation", { name: "Hub console" });

test.describe("Today (role views spec 7.2)", () => {
  test("says what's waiting, and each row opens its oldest item", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin");
    await expect(main(page).getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page).toHaveTitle("Today · CampusCart");
    await expect(main(page).locator(".staff-lede")).toHaveText(/^\d+ waiting · oldest \d+ days?$/);
    const shops = waitingList(page).getByRole("link", { name: /Shops? to approve/ });
    await expect(shops).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    await expect(shops).toContainText("Oldest: Crochet corner");
    await expect(shops.locator(".needs-age")).toHaveAttribute("data-tone", "warning");
    const slots = waitingList(page).getByRole("link", { name: /Slot requests?/ });
    if ((await slots.count()) > 0) await expect(slots).toHaveAttribute("href", "/hub/manage#hub-queue");
    // Other tests may have made reports or hidden something by now; when they have, the rows open the right place.
    const reports = waitingList(page).getByRole("link", { name: /Open reports?/ });
    if ((await reports.count()) > 0) await expect(reports).toHaveAttribute("href", /^\/admin\/reports\/[^/]+$/);
    const hidden = waitingList(page).getByRole("link", { name: /Hidden by the Hub/ });
    if ((await hidden.count()) > 0) await expect(hidden).toHaveAttribute("href", "/admin/hidden");
    await shops.click();
    await expect(page).toHaveURL(/\/admin\/sellers\/crochet-corner$/);
    await expect(main(page).getByRole("heading", { level: 1, name: "Crochet corner" })).toBeVisible();
  });

  test("puts the queue first, then last week and the campus chart, and the badges last", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    await expect(main(page).locator(".today .kit-section-title")).toHaveText(["Waiting", "Last week", "Listings by campus", "Trust badges"]);
    const week = main(page).getByRole("region", { name: "Last week" });
    await expect(week.getByRole("list", { name: "Last week's numbers" }).getByRole("listitem")).toHaveCount(3);
    await expect(week.getByRole("link", { name: "All numbers" })).toHaveAttribute("href", "/admin/numbers");
  });

  test("adds under 8 KB of HTML, and its skeleton is no taller than All clear (spec 9)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    const body = main(page).locator(".today");
    await expect(body).toBeVisible();
    const bytes = await body.evaluate((element) => new TextEncoder().encode(element.outerHTML).length);
    console.log(`Today's body (${test.info().project.name}): ${bytes} B`);
    expect(bytes, "Today's HTML").toBeLessThanOrEqual(8 * 1024);

    const heights = await page.evaluate((skeletonHtml) => {
      const today = document.querySelector<HTMLElement>("main .staff-page:has(.today)")!;
      // Today's shortest state (plan decision 12): nothing waiting, nothing listed last week, no notice.
      const list = today.querySelector(".needs-list");
      if (list) {
        const clear = document.createElement("p");
        clear.className = "needs-clear";
        clear.textContent = "All clear: nothing is waiting for the Hub.";
        list.replaceWith(clear);
      }
      const chart = today.querySelector(".today .chart");
      if (chart) {
        const line = document.createElement("p");
        line.className = "chart-summary";
        line.textContent = "None at any campus last week.";
        chart.replaceWith(line);
      }
      const lede = today.querySelector(".staff-lede");
      if (lede) lede.textContent = "Nothing waiting";
      today.querySelector(".staff-notice")?.remove();
      const shortest = today.getBoundingClientRect().height;
      const holder = document.createElement("div");
      holder.innerHTML = skeletonHtml;
      today.after(holder);
      const skeleton = (holder.firstElementChild as HTMLElement).getBoundingClientRect().height;
      holder.remove();
      return { shortest, skeleton };
    }, STAFF_SKELETON_HTML);
    console.log(`Today (${test.info().project.name}): skeleton ${heights.skeleton}px, All clear ${heights.shortest}px`);
    expect(heights.skeleton, "the skeleton against All clear").toBeLessThanOrEqual(heights.shortest);
  });
});

// Reports and Hidden filtered to Eduvos Online are those pages' shortest states (plan decision 15). Each page's
// skeleton is no taller (spec 9). SKELETONS says which skeleton each page renders: full until Step 4 finds one too tall.
const SKELETONS: Readonly<Record<string, "full" | "short">> = {
  "/admin/reports?campus=online": "full",
  "/admin/hidden?campus=online": "full",
};

test.describe("short pages' skeletons (spec 9)", () => {
  for (const [path, kind] of Object.entries(SKELETONS)) {
    test(`${path}'s ${kind} skeleton is no taller than the page`, async ({ page }) => {
      onlyAt(...BOTH);
      await signInAsSample(page, "Admin", path);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      const heights = await page.evaluate(
        ([skeletonHtml, short]) => {
          const shown = document.querySelector<HTMLElement>("main .staff-page:not([style*='display'])")!;
          shown.querySelector(".staff-notice")?.remove();
          const holder = document.createElement("div");
          holder.innerHTML = skeletonHtml;
          if (short) holder.querySelector(".staff-skeleton-body")?.remove();
          shown.after(holder);
          const skeleton = (holder.firstElementChild as HTMLElement).getBoundingClientRect().height;
          holder.remove();
          return { page: shown.getBoundingClientRect().height, skeleton };
        },
        [STAFF_SKELETON_HTML, kind === "short"] as const,
      );
      console.log(`${path} (${test.info().project.name}): ${kind} skeleton ${heights.skeleton}px, page ${heights.page}px`);
      expect(heights.skeleton, "the skeleton against the shortest state").toBeLessThanOrEqual(heights.page);
    });
  }
});

test.describe("the console's fixes (spec 7.2)", () => {
  test("a shop's page leads on to the oldest waiting shop that isn't it", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin/sellers/tech-corner");
    const next = main(page).getByRole("link", { name: "Next waiting shop: Crochet corner" });
    await expect(next).toHaveAttribute("href", "/admin/sellers/crochet-corner");
    await next.click();
    await expect(main(page).getByRole("heading", { level: 1, name: "Crochet corner" })).toBeVisible();
  });

  test("campus chips show one campus, and every campus for one that doesn't exist", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin/sellers?campus=pretoria");
    const chips = main(page).getByRole("navigation", { name: "Filter by campus" });
    await expect(chips.getByRole("link", { name: "Pretoria" })).toHaveAttribute("aria-current", "page");
    await expect(main(page).getByRole("table", { name: "Shops waiting for approval, oldest first · Pretoria" })).toContainText(
      "Crochet corner",
    );
    await expect(main(page).getByRole("link", { name: "Review Tech corner" })).toHaveCount(0);
    await page.goto("/admin/sellers?campus=nowhere");
    await expect(chips.getByRole("link", { name: "All campuses" })).toHaveAttribute("aria-current", "page");
    await expect(main(page).getByRole("link", { name: "Review Tech corner" })).toBeVisible();
    for (const path of ["/admin/reports", "/admin/hidden"]) {
      await page.goto(`${path}?campus=midrand`);
      await expect(chips.getByRole("link", { name: "Midrand" }), path).toHaveAttribute("aria-current", "page");
      await expect(chips.getByRole("link", { name: "All campuses" }), path).toHaveAttribute("href", path);
    }
  });

  test("the numbers page says Last week and draws each measure by campus", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin/numbers");
    await expect(main(page).getByRole("heading", { level: 1, name: "Last week" })).toBeVisible();
    await expect(page).toHaveTitle("Last week · CampusCart");
    await expect(main(page).getByRole("region", { name: "Each measure by campus" }).getByRole("heading", { level: 3 })).toHaveCount(7);
  });

  test("Staff lists who has a role before the Give a role form", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin/staff");
    await expect(main(page).locator(".staff-section-title")).toHaveText(["Who has a role", "Give a staff role"]);
  });

  test("More is the current tab on the pages it holds, Hidden's included, and not after leaving (plan decision 8)", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    const more = consoleBar(page).getByRole("link", { name: "More" });
    const reports = consoleBar(page).getByRole("link", { name: "Reports" });
    for (const path of ["/admin/hidden", "/admin/numbers", "/admin/staff"]) {
      await page.goto(path);
      await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
      await expect(more, path).toHaveAttribute("aria-current", "true");
      await expect(reports, path).not.toHaveAttribute("aria-current");
    }
    // Leaving Hidden through the bar: Next keeps the Hidden page, hidden, and NavLink reads the new path.
    await page.goto("/admin/hidden");
    await expect(main(page).getByRole("heading", { level: 1, name: "Hidden listings and requests" })).toBeVisible();
    await reports.click();
    await expect(main(page).getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(reports).toHaveAttribute("aria-current", "page");
    await expect(more, "after leaving Hidden").not.toHaveAttribute("aria-current");
  });

  test("no serious or critical accessibility issues on Today and the changed pages", async ({ page }) => {
    onlyAt(...BOTH);
    await signInAsSample(page, "Admin", "/admin");
    for (const path of [
      "/admin",
      "/admin/sellers?campus=pretoria",
      "/admin/sellers/tech-corner",
      "/admin/reports?campus=midrand",
      "/admin/hidden?campus=midrand",
      "/admin/numbers",
      "/admin/staff",
    ]) {
      await page.goto(path);
      await expect(main(page).getByRole("heading", { level: 1 }), path).toBeVisible();
      // The title streams in with the page's request-time parts; axe's title rule needs it.
      await expect(page, path).toHaveTitle(/· CampusCart$/);
      expect(await seriousIssues(page), path).toEqual([]);
    }
  });
});

const SHORT_PHONE = { ...PHONE, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } };

test.describe("layout shift (spec 9: under 0.05)", () => {
  for (const [name, path] of [
    ["Shops, one campus", "/admin/sellers?campus=pretoria"],
    ["Last week", "/admin/numbers"],
  ] as const) {
    for (const [size, device] of [
      ["390", PHONE],
      ["1440", DESKTOP],
    ] as const) {
      test(`${name} holds still at ${size}px`, async ({ browser, baseURL }) => {
        onlyAt("phone-390");
        const context = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
        await copySession(browser, context, baseURL!, "Admin");
        const page = await context.newPage();
        await holdFonts(page);
        await recordShifts(page);
        await expectStill(page, `${name} (${size})`, path);
        await context.close();
      });
    }
  }

  // Short pages on a short phone (plan decision 15): Eduvos Online has no reports and nothing hidden.
  for (const [name, path] of [
    ["Reports, one campus", "/admin/reports?campus=online"],
    ["Hidden, one campus", "/admin/hidden?campus=online"],
  ] as const) {
    test(`${name} holds still on a short phone, 375 by 667`, async ({ browser, baseURL }) => {
      onlyAt("phone-390");
      const context = await browser.newContext({ ...SHORT_PHONE, baseURL, serviceWorkers: "block" });
      await copySession(browser, context, baseURL!, "Admin");
      const page = await context.newPage();
      await holdFonts(page);
      await recordShifts(page);
      await expectStill(page, `${name} (375x667)`, path);
      await context.close();
    });
  }
});
```

Check before running:
- `copySession`, `PHONE` and `DESKTOP` are exported from `tests/e2e/helpers/staff-accounts.ts` (`staff-accounts-checks.spec.ts:9` imports them from there);
- `onlyAt` calls `test.skip` for other projects (`tests/e2e/helpers/messaging.ts:9`);
- every `browser.newContext(` here says `serviceWorkers: "block"`.

Today's own layout shift at 390 and 1440 is in `staff-checks.spec.ts`'s `SHIFT_PAGES` (renamed in Task 12).

- [ ] **Step 3: Add N3's screenshots** to `tests/e2e/role-views-screenshots.spec.ts`. Change its first import to `import { expect, test } from "@playwright/test";`, then append:

```ts
const N3_SHOTS = [
  ["admin-today", "/admin"],
  ["admin-shops-pretoria", "/admin/sellers?campus=pretoria"],
  ["admin-shop-next", "/admin/sellers/tech-corner"],
  ["admin-reports", "/admin/reports"],
  ["admin-hidden", "/admin/hidden"],
  ["admin-numbers", "/admin/numbers"],
  ["admin-staff", "/admin/staff"],
] as const;

for (const [name, path] of N3_SHOTS) {
  test(`role views N3: ${name}`, async ({ page }) => {
    const width = test.info().project.name.split("-").pop();
    test.skip(!["390", "1440"].includes(width!), "390 and 1440 only");
    await signInAsSample(page, "Admin", path);
    await expect(page.locator(".skeleton")).toHaveCount(0);
    await page.screenshot({ path: `docs/progress/role-views/n3-${width}-${name}.png`, fullPage: true });
  });
}
```

- [ ] **Step 4: Run everything**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: clean, every unit test passes. Write the count down.

```bash
grep -rln "use client" components/staff lib/staff lib/kit
```
Expected: no output.

```bash
pnpm build && pnpm e2e tests/e2e/role-views-admin.spec.ts tests/e2e/role-views.spec.ts tests/e2e/staff.spec.ts tests/e2e/staff-checks.spec.ts tests/e2e/performance.spec.ts tests/e2e/a11y.spec.ts --reporter=line
```
Expected: all pass in the device projects. Write down Today's bytes and the skeleton heights the log prints.

If a "short pages' skeletons" test fails, or a 375×667 test fails (plan decision 15):
1. Change that page's fallback (`app/admin/reports/page.tsx` or `app/admin/hidden/page.tsx`) to `<StaffSkeleton short />`, and set its entry in `SKELETONS` to `"short"`.
2. Run both tests again.
3. If either still fails with `short`, write down the numbers and tell the controller. Don't loosen the limit.

Record both pages' skeleton and page heights (from the log), and which skeleton each ended with, in "Changes made during the build".

Then the write projects, whose words changed in Task 12:
```bash
pnpm e2e --project=staff-writes --project=community-writes --project=staff-accounts-writes --project=housekeeping-writes --reporter=line
```
Expected: all pass. A strict-mode failure that names a "Next waiting shop" or "Next open report" link: add `exact: true` to that lookup (Task 12 Step 3).

On the local stack: `pnpm e2e:supabase tests/e2e-supabase/mvp.spec.ts`. Expected: passes.

- [ ] **Step 5: The JS gate**

From the performance run, record every page's `scriptBrotli` beside Task 0's baseline in "Changes made during the build" (Lama's rule, 2026-10-22):
- **every page stays inside the 150 KB first-visit budget**;
- any page that grows by more than 1 KB gets a one-line reason;
- small client costs are fine when they buy function, accessibility or smoothness.

N3's only client change is `NavLink`'s `also` (Task 6 Step 4b), which reaches every page through the layout chunk. Expect a few dozen bytes on each page, and record them as "NavLink `also`: More is current for screen readers on the pages it holds". Any other growth means a server file reached a client chunk: find it (`pnpm build`, then compare `.next/static/chunks`) and fix it.

```bash
grep -l "serviceWorker.register" .next/static/chunks/*.js
```
Expected: no output.

```bash
grep -rn "newContext(" tests/e2e | grep -v serviceWorkers
```
Expected: no output.

- [ ] **Step 6: Take the screenshots**

```bash
SCREENSHOTS=1 pnpm e2e tests/e2e/role-views-screenshots.spec.ts --project=phone-390 --project=desktop-1440 -g "role views N3"
```
Expected: 14 PNGs named `docs/progress/role-views/n3-*.png`.

- [ ] **Step 7: Commit (controller)**

```bash
git status
```
Then:
```bash
git add tests/e2e/helpers/staff-skeleton.ts tests/e2e/role-views-admin.spec.ts tests/e2e/role-views-screenshots.spec.ts components/staff/StaffSkeleton.test.tsx tests/e2e/staff.spec.ts tests/e2e/staff-checks.spec.ts tests/e2e/staff-accounts-checks.spec.ts tests/e2e/staff-accounts-writes.spec.ts tests/e2e/staff-accounts-screenshots.spec.ts tests/e2e/screenshots.spec.ts tests/e2e-supabase/mvp.spec.ts docs/progress/role-views
git commit -m "test: role views N3 end to end (Today's queue and links, chips, Next, Last week, More marked, axe, layout shift, size, skeleton) and screenshots"
```
If a 375×667 fix changed a page, add that page file too.

---

### Task 14: Docs

**Files:**
- Modify: `CLAUDE.md` (Code rules), `docs/reference/LANDING-DECISIONS.md` (a new row), `docs/PROGRESS.md` (a new section), and this plan's "Changes made during the build"

- [ ] **Step 1: CLAUDE.md.** Add these bullets to "Code rules", after N1's role views bullets:

```markdown
- The admin's Today (`/admin`, role views N3) builds its queue only through `todayQueue` (`lib/staff/queue.ts`) over `listShopsForReview`, `listReports`, `listBookings` and `countHidden`, so each row's count equals its list and the admin bar's badge. Its numbers come only from `protectCounts`, then `lastWeekTiles` and `campusBars` (`lib/staff/today-numbers.ts`, through `shownCount`: a mask is never 0). Ages come from `waitAge` (`lib/kit/age.ts`): elapsed time from one `now` read after `connection()`. `listBookings` lists open requests oldest first on both backends.
- Shop and report pages lead on with `NextInQueue` (`nextWaitingShop`, `nextOpenReport`). Shops, Reports and Hidden filter by campus with link chips (`CampusFilter`; `?campus=` read by `readCampusFilter`, so an unknown campus shows every campus). A report's campus is `ReportView.campusSlug`.
- Staff pages' eyebrow comes from `STAFF_EYEBROW` (`lib/staff/paths.ts`): "Hub console" on admin and Hub pages, which a test reads from the folders. The pages the admin bar's More holds are listed in `ADMIN_MORE_SECTIONS`, which `AdminBar` passes to `NavLink`'s `also`, so More is current (`aria-current="true"`) there. Add a new More page's path there.
```

Also, in the existing bullet that begins "The admin's numbers (`/admin/numbers`) show private counts…", add after its first sentence: "Today's Last week tiles and the campus bars take `protectCounts`' words through `shownCount`, never raw counts."

- [ ] **Step 2: The decisions log.** Read the table's header and its last row number first; N1 used 84 and N2 may have used 85. Add the next row, matching the table's columns:

```markdown
| 8X | 2026-10-2X | What does the admin open on? | **Today** (role views N3): "N waiting · oldest X days"; Waiting oldest first (shops, reports, slot requests, then Hidden), each row opening its oldest item with an age chip (warning after 48 hours); last week's tiles against the week before and listings by campus, only through protectCounts; badges last. Next links on shop and report pages, campus chips on Shops, Reports and Hidden, Last week as the numbers page's name, one eyebrow ("Hub console"), and More current in the bar on the pages it holds (`NavLink`'s `also`). Lama, 2026-10-2X. |
```

- [ ] **Step 3: PROGRESS.md.** Add "## 2026-10-2X: Role views N3 built (the admin's Today)" before "## Next", in the style of the stage sections above it:
- what's built;
- where the build differed from this plan;
- the checks:
  - the unit count and the e2e counts;
  - Today's HTML bytes, and the skeleton against All clear;
  - JS against Task 0's baseline;
  - the 375×667 results;
- the open points for Lama:
  - plan decisions 2, 6, 7 and 8;
  - the 48-hour threshold;
  - the sample words;
  - the screenshots in `docs/progress/role-views/n3-*`.

Update "## Next" with "N4, the mentor's caseload, can be planned".

- [ ] **Step 4: Fill in "Changes made during the build"** below, one bullet per departure, each with its commit.

- [ ] **Step 5: Commit (controller), with Lama's go-ahead**

```bash
git status
```
Then:
```bash
git add CLAUDE.md docs/reference/LANDING-DECISIONS.md docs/PROGRESS.md docs/superpowers/plans/2026-10-22-role-views-n3-admin.md
git commit -m "docs: role views N3 built: CLAUDE.md rules for Today, the chips, Next links and the eyebrow; decision row; progress"
```
If other sessions have uncommitted lines in PROGRESS or the decisions log, stage only this stage's lines (`git add -p`, never `git add .`).

---

## Self-review: spec coverage

| Spec item | Where |
|---|---|
| §7.2.1 Header "Today", "N waiting · oldest X days" | Task 4 (`todayLede`), Task 6 (`StaffFrame` `lede`), Task 7 (page), Task 13 e2e |
| §7.2.2 Waiting oldest first: shops, reports, slot requests, hidden | Task 4 (`todayQueue`), Task 7, Task 13 e2e; plan decisions 2 and 3 |
| Each row links straight to its oldest item (`adminSellerPath`, `adminReportPath`, `/hub/manage#hub-queue`, `/admin/hidden`) | Task 4 tests, Task 13 e2e (opens Crochet corner) |
| Age chip; over 2 days is warning; SAST, at request time | Task 3 (`waitAge`, threshold tests), Task 7 (`now` after `connection()`); plan decision 1 |
| "All clear" at zero | Task 7 test; Task 13 skeleton-height check |
| Badge paragraph below the fold, `recalculateBadges` kept | Task 7 (last card, same words, runs first as before) |
| §7.2.3 Last week `StatTile` + `StatDelta`, only through `protectCounts`, masked "Hidden"/"Under 5", "Can't compare"; link to `/admin/numbers` | Task 5 (`shownCount`, `lastWeekTiles`), Task 7 test; plan decisions 4 and 6 |
| §7.2.4 Listings by campus `BarList`, masked hatched | Task 5 (`campusBars`), Task 7; N1's `BarList` hatches masks; plan decision 5 |
| §6 `listBookings` open requests oldest first, both backends, contract test | Task 1 (sample, Supabase, unit, contract, db parity) |
| Fix: Next waiting shop / Next open report | Task 4 helpers, Task 8, Task 13 e2e; plan decision 9 |
| Fix: campus chips (`?campus=`) on Shops, Reports, Hidden, link-only, unknown handled | Task 2 (report campus, both backends), Task 9, Task 13 e2e; plan decision 10 |
| Fix: `/admin/numbers` `BarList` per measure, says "Last week" | Task 6 (titles), Task 10, Task 13 e2e |
| Fix: Staff lists people before the form | Task 11, Task 13 e2e |
| Fix: names (Shops, Hub posts, "Hub console" eyebrow, `StaffFrame` area strings, `staffMetadata` titles) | Task 6 (constant, guard test, 23 pages), Task 12 |
| Fix: Hidden's pages mark Hidden current; More in the admin bar | Task 6 (`current`, pill, `NavLink` `also` through `SectionTab` and `AdminBar`), Task 13 e2e (`aria-current`); plan decision 8 |
| §8 a failed reader shows its card's error box | Task 7 (`readQueue`/`readWeek` → null, `SectionError`), test; plan decision 11 |
| §8 masked counts never 0, no arrow | Task 5 tests, Task 7 test ("Can't compare") |
| §3 JS: every page inside 150 KB, each page recorded against the stage baseline, >1 KB growth explained; Server Components except `NavLink`'s `also` | Task 0 baseline, Task 13 Step 5, `use client` grep |
| §3 staff links never prefetch | `NextInQueue`, `LinkTabs`, the kit's links (all `prefetch={false}`) |
| §3 brand: sky-dark links, status tokens with words | Task 6/8/10 CSS; N1's tokens; age chips carry words |
| §3 touch targets ≥ 44px | `.staff-next-link`, N1's `.needs-row`, `.link-chip`, `.chart-numbers summary` |
| §9 unit tests for every view and helper | Tasks 3–11 |
| §9 contract tests for changed readers | Tasks 1 and 2 (no SQL changed, so no pgTAP) |
| §9 e2e at device sizes, axe, layout shift < 0.05 at 390/1440 and 375×667 short pages | Task 13 (+ `staff-checks`' Today); plan decision 15 |
| §9 skeleton no taller than the shortest state | Task 13 (injected skeleton against All clear) |
| §9 added HTML under about 8 KB | Task 13 (Today's whole body ≤ 8 KB); plan decision 13 |
| §9 screenshots with `SCREENSHOTS=1` into `docs/progress/role-views/` | Task 13 Step 3 and Step 6 |
| Writes: `staff-writes` or `role-views-writes`? | Neither: no writes (plan decision 12) |
| §10 docs: progress, decisions row, CLAUDE.md | Task 14 |

## Changes after plan review (2026-10-22)

1. Task 6 Step 7: the More-marking CSS was made to ignore kept pages. It was then dropped altogether by change 12 below. Task 13's More test leaves Hidden for Reports through the bar and checks More is no longer current.
2. Task 7 Step 1: the change line is checked on its tile's whole text. The arrow is in a child sr-only span, so `getByText` couldn't match it.
3. Task 10 Step 1: `AdminMore` takes `hidden={{ listings: 0, requests: 0 }}` (N1's type). The hedge is gone.
4. Task 6 Steps 5 and 6:
   - `app/admin/page.tsx`'s doc comment loses "Admin console";
   - Step 5 says N1 wrote `area="Admin console"` on `app/admin/more/page.tsx`.
5. Task 12 Step 2: only admin lookups change; the seller's Overview tab keeps its name.
6. Task 13: a skeleton-height check for Reports and Hidden at `?campus=online` (`SKELETONS`). Each switches to `short` if its full skeleton is taller, and the heights are recorded.
7. `rowHeader="Campus"` on `BarList` in `AdminToday` and `MeasureBars`.
8. Each `SectionError` box in Today sits in `<div id="today-…">`, so "Try again"'s anchor exists.
9. Today's e2e checks the Reports row (`/admin/reports/…`) and the Hidden row (`/admin/hidden`) when they're present.
10. `AdminReports`' caption test uses one open Midrand report and checks the table name "Open reports, oldest first · Midrand".
11. Open questions for Lama are listed after the plan decisions. They include mentors seeing "Hub console" on the Hub pages.

**After Lama's JS rule (2026-10-22):** "I'm not obsessed with saving bytes for JavaScript, the app just needs to be smooth, functional and fast."

12. **Plan decision 8 is reversed.** More is current properly, for screen readers too:
    - `NavLink` gains `also?: readonly string[]` (`aria-current="true"` under those paths);
    - `SectionTab.also` passes it on;
    - `AdminBar` gives More `ADMIN_MORE_SECTIONS`: Hidden, Featured, Pickup points, Staff, Last week, Audit log, and `/mentor` for admins.

    `StaffFrame`'s `data-under-more`, `isUnderMore` and the More CSS are gone. Unit tests were added for `NavLink`, `SectionBar` and `sections`. The e2e test checks `aria-current` on More, including after leaving Hidden for Reports. The open question about a visual-only mark is gone.
13. **The JS gate is Lama's rule, not byte-for-byte:**
    - every page stays inside 150 KB;
    - each page is recorded against Task 0's baseline;
    - growth over 1 KB gets a one-line reason.

    `NavLink` is in every page's layout chunk, so its byte change is recorded (Task 13 Step 5).

## Changes made during the build

- **Baseline (N3 Task 0):** not re-measured (Lama: reuse N2's). N2's numbers (N2 plan, "Baseline (Task 0)"), at 390px: homepage, info, Hub, sell, account and most signed-in pages 150,674 B; listing 151,830 B; browse 151,421 B; storefront 151,434 B; Saved 151,309 B; request and collection 151,150 B; new and edit listing forms 152,347 B.
- **Tasks 0 to 5 (batch 1):** N1 is in (git log; N2 on top). Tasks 1 to 5 built as written, code copied from the plan unchanged. No red-green run (Lama's speed rule), and only the tests for the two backend changes, `waitAge`, the queue and `protectCounts` handling were kept. Task 1's and 2's contract scenarios pass on both backends (`pnpm test:db` on hub-staff and staff-reports, local stack already running, no reset).
- **Tasks 6 to 11 (batch B, ba2f394):** built as written, with two changes from Lama during the build: plan decision 8 reversed (More is `aria-current="true"` through `NavLink`'s `also`, change 12 above), and a mentor without the admin role sees "Hub tools" as the eyebrow on the Hub's pages (`STAFF_EYEBROW.hubTools`, `hubEyebrow`); admins see "Hub console".
- **Task 12:** the admin lookups learned the new words as listed (staff, staff-checks, staff-accounts-checks, staff-accounts-writes, `tests/e2e-supabase/mvp.spec.ts`). The seller's Overview tab keeps its name. No Next-link clashes (Step 3's grep found none on shop or report pages). The two screenshot specs were left alone (Lama: no screenshots in N3).
- **Task 13, trimmed to behaviour (Lama, 2026-10-22):** `tests/e2e/role-views-admin.spec.ts` keeps Today's rows and their links, Today's HTML size and its skeleton against All clear, masked numbers (Today's Reports made tile says what the numbers page's table says; masked tiles and bars read Hidden or Under 5), the Reports and Hidden skeleton heights, Next waiting shop, the campus chips (with an unknown campus, and a page-width guard), More's `aria-current` (and not after leaving Hidden for Reports through the bar), axe on `/admin`, `/admin/reports?campus=midrand` and `/admin/numbers`, and layout shift for Reports and Hidden at 390 and 1440 and at 375x667 filtered to Online. Dropped: the card-order, Staff-order and numbers-page heading tests (unit-tested or covered by the masked test), the Shops and Last week shift rows (Last week's is in staff-accounts-checks), and all screenshots. Today's own shift stays in staff-checks (fast) and cls.spec (slow network); cls.spec gains slow-network rows for Reports and Hidden.
- **Next open report** needs reports, which the seed doesn't have, so it's checked in `staff-writes.spec.ts`'s pause test (which makes two): the newer report's Next link and Today's Reports row both open the oldest open report in the Reports list.
- **Short skeletons (plan decision 15):** the full skeleton was 634px against 507px for Reports and Hidden at `?campus=online` (390), so both pages render `<StaffSkeleton short />` (`SKELETONS` says "short"). Now 222px against 529px (Reports) and 554px (Hidden) at 1440; at 390 both are 780px, the new phone minimum below.
- **Three CSS fixes found by the e2e run (app/globals.css, the N3 block):**
  - the campus chips row is a grid item of `.staff-body` and grew to its chips' width, so Shops, Reports and Hidden were 1986px wide on a 390 phone (the bar's tabs and the review links couldn't be pressed): `.staff-page .link-chips { min-width: 0 }`;
  - from the tablet step the chips wrapped, and took an extra row when the fonts swapped in (0.0699 at 1440): they stay one row that scrolls sideways at every size, with a thin scrollbar for a mouse, the chosen chip scrolled into view;
  - under the short skeleton, Reports and Hidden let the footer into a phone's first screen on a slow network (0.52 and 0.39 at 390): a section's `.staff-page` is at least a screen tall less the 64px header on phones, as `.sell-page` is.
- **role-views.spec.ts (N2's skeleton test)** measured the waiting seller's skeleton against itself (272 against 272) before the page streamed in; it now waits for the waiting page's heading. A test race, not an N3 change.
- **Numbers:** Today's body 3,385 B at 390 and 4,021 B at 1440 (limit 8 KB). Today's skeleton 634px against All clear 781px at 1440 (780 against 872 at 390). Layout shift: Today 0.0007 (390 and 1440), 0.0012 or less on the slow network; Reports 0.0005 / 0.0006, Hidden 0.0202 / 0.0009 (390 / 1440); slow network 0.0011 or less for both; 375x667 Online: Reports 0.0017, Hidden 0.0333.
- **JS against N2's baseline (390, brotli):** every page +25 B (NavLink `also`: More is current for screen readers on the pages it holds). Homepage, info, Hub, sell, account and the signed-in pages 150,699 B; listing 151,855; browse 151,446; storefront 151,459; Saved 151,334; request and collection 151,175; new and edit listing forms 152,372 (the largest, inside 153,600). No page grew by more than 1 KB. The three grep gates print nothing.
- **Not run:** `pnpm e2e:supabase tests/e2e-supabase/mvp.spec.ts` (Lama's targeted run; only its two lookups changed), and the screenshot step (skipped by Lama).
- **The build's security notice:** `pnpm build` stopped twice with Next's "SecurityFatalError" upgrade notice (a known vulnerability in 16.4.0) and passed when run again. Nothing was upgraded; that's for Lama.

## Progress entry (for docs/PROGRESS.md)

## 2026-10-23: Role views N3 built (the admin's Today)

**Built.** `/admin` is Today: "N waiting · oldest X days", then Waiting oldest first (shops to approve, open reports, slot requests, then Hidden by the Hub, which isn't counted as waiting), each row opening its oldest item with an age chip (warning after 48 hours) and "All clear" at zero; Last week's three tiles against the week before and listings by campus as bars, only through `protectCounts` (a masked figure reads Hidden or Under 5, never 0); the trust badges last. Each card fails on its own. Shop and report pages lead on to the next waiting shop or open report. Shops, Reports and Hidden filter by campus with link chips (an unknown campus shows all). The numbers page is called Last week and draws each measure by campus. Staff lists people before the form. One set of names: Today, Shops, Hidden, Last week; "Hub console" as the eyebrow (a mentor sees "Hub tools" on the Hub's pages). In the admin bar, More is current on the pages it holds. `listBookings` lists open requests oldest first on both backends, and a report carries its campus.

**Where the build differed from the plan.** Decision 8 reversed (More current through `NavLink`'s `also`, for screen readers too); "Hub tools" for mentors; e2e trimmed to behaviour, no screenshots; Next open report checked in staff-writes (the seed has no reports); Reports and Hidden use the short skeleton; three CSS fixes the e2e run found (the chips widened the whole page on phones, wrapped differently once the fonts swapped in at 1440, and the footer could rise into a phone's first screen on a slow network); N2's skeleton test now waits for the waiting page. Details in the N3 plan's "Changes made during the build".

**Checks.** Lint and types clean. Unit: 3,079 tests; on a machine under heavy load 13 files timed out, and all 13 pass run again. E2E (staff, staff-checks, role-views, role-views-admin, a11y, cls, performance at 360, 390, 768, 1024 and 1440): 757 passed, 2 failed, of which N2's skeleton race is fixed and passes, and the signed-out /sell pitch at 390 (0.0598) predates N1. Write projects (staff-writes, staff-accounts-writes, housekeeping-writes): 40 passed. Today's body 3.4 KB (390) and 4.0 KB (1440). Layout shift 0.0333 or less everywhere measured (Today 0.0007; Reports and Hidden 0.0202 or less; 375x667 0.0333 or less; slow network 0.0012 or less). JS: every page +25 B on N2 (NavLink `also`), the largest 152,372 B, inside 150 KB.

**Open points for Lama.**
- Plan decisions 2 (Hidden's row: last, only when something is hidden, not counted), 6 ("All numbers" as the link), 7 (the eyebrow; mentors see "Hub tools") and 8 (More current on the pages it holds).
- The 48-hour warning threshold.
- The sample words on Today and the empty states.
- The campus chips now scroll sideways at every size (14 chips) rather than wrapping from the tablet step.
- Next.js 16.4.0's security notice at build time: an upgrade is waiting for your go-ahead.
- No N3 screenshots were taken (Lama's call); `SCREENSHOTS=1` can make them later.

**Next.** N4, the mentor's caseload, can be planned.
