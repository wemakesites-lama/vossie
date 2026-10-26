# Role bars: the phone's main bar fits who is signed in: design

Date: 2026-10-26 · Status: built (decision 92). Section 13 lists what the build changed.

## 1. What Lama asked for

The phone's bottom bar should change with the kind of account that is signed in, so navigation stays simple, each tab is useful, and the app isn't the same for mentors, admins, sellers and students.

Lama's answers (2026-10-26):

| # | Question | Decision |
|---|---|---|
| 1 | How does a role's main bar relate to the section bars in `/sell`, `/admin` and `/mentor`? | **The main bar is shaped by role, and the section bars stay.** Outside the workspaces, the main bar fits the account. Inside them, the section bar still takes over with its deeper tools and Exit (role views decision 1 and spec 4.1 are unchanged). |
| 2 | Which bar does an account with several roles get? | **The highest role wins:** admin, then mentor, then seller, then student. Their own shop stays reachable through You and `/sell`. |
| 3 | The tab sets | **Approved as drafted** (section 3). |

## 2. What's wrong today

Everyone gets Home, Shop, Sell, Saved and You (decision 75). A seller's shop sits behind the Sell pill, which looks like a pitch. Messages, the thing sellers and staff answer every day, is two taps away behind You. An admin's Today and a mentor's caseload have no tab at all outside their workspace.

## 3. The tab sets

Home, Shop and You never move, so a person keeps their thumb memory whatever their role. The centre pill is the role's main job and opens its workspace. Slot four is Saved for students and Messages for everyone else.

| Bar | 1 | 2 | 3 (pill) | 4 | 5 |
|---|---|---|---|---|---|
| Student, and signed out | Home `/` | Shop `/browse` | Sell `/sell` | Saved `/saved` | You `/account` (sign-in when signed out) |
| Seller | Home | Shop | My shop `/sell` | Messages `/messages` | You |
| Mentor | Home | Shop | Mentoring `/mentor` | Messages | You |
| Admin | Home | Shop | Today `/admin` | Messages | You |

- The student bar is today's bar, unchanged.
- Icons come from `components/icons.tsx`: My shop `StoreIcon`, Mentoring `UserIcon` (as the console's mentoring section), Today `GridIcon` (as the admin bar), Messages `MessageIcon`. If one is missing, it is added there.
- Tapping a pill opens the workspace, where the section bar replaces the main bar, as it does today.

## 4. Who gets which bar

- `barFor(account, hasShop)` in `lib/nav/bar.ts` is a pure function returning `"student" | "seller" | "mentor" | "admin"`.
  - It returns `"admin"` when `canUse(account, "admin")`, else `"mentor"` when `canUse(account, "mentor")`, else `"seller"` when the account has a shop (any status, pending and declined included: `/sell` is their home either way), else `"student"`.
  - Signed out (`null`) is `"student"`.
- It is the only place that decides. The tab bar and the header's phone heart (section 6) both use it.
- Roles are read through `getViewer()` on every request, as now. Nothing cached reads roles.

## 5. The tab bar

- `TabBar` (`components/tabbar/TabBar.tsx`) keeps Home, Shop and the You slot as they are.
- Slots 3 and 4 become one streamed piece, `RoleTabs`. The layout passes it to `TabBar` the way it passes the account tab: `<Suspense fallback={<StudentTabs />}>` around `<RoleTabs />`.
  - `StudentTabs` is today's Sell and Saved, so the static shell is the same for everyone. Signed-out visitors and students never see the bar change after paint.
  - Sellers and staff see slots 3 and 4 swap once, on a full page load. Client navigations keep the layout, so the bar stays put.
  - Every slot keeps its size and the pill keeps its shape, so the swap shifts nothing (layout shift 0 from the bar).
- `RoleTabs` is a Server Component. It reads `getViewer()` (shared with the header through React's `cache`), then `getShopOf` only when `barFor` needs it (not staff).
- Links:
  - Sell keeps prefetching, as today (decision 53). My shop, Mentoring, Today and Messages use `prefetch={false}`. Links into staff pages never prefetch, and the selling pages carry client chunks.
  - Every tab goes through `Tab`, so each has the `TAB` link type, `NavLink`'s `aria-current` and `<NavPending />`.
  - The pill uses `tab tab-sell`'s styling whatever its label.
  - My shop, Mentoring and Today use `match="section"`. The main bar is hidden inside the workspaces anyway, but it can still show for a moment while a page arrives.
- The main bar's `aria-label` stays "Main".

## 6. Saved for sellers and staff

- The header's Saved heart is hidden on phones today (`hidden wide:inline-grid`), because the bar has Saved.
- For any bar but the student one, the heart also shows on phones. A streamed `PhoneSaved` next to it uses `barFor` from the same `getViewer()` read, with `fallback={null}`. The phone header has room for it, since only Menu, the pennant and Search are there.
- You's Your stuff already links to Saved, with the device's count.

## 7. Badges

Every badge comes from the reader that builds the list it opens (role views spec 4.2).

| Tab | Badge counts | Reader | Words |
|---|---|---|---|
| My shop | Needs you's items | `queueFor(slug)`, as `/sell`'s Needs you (React `cache`, once per request) | "N things need you" |
| Mentoring | Slot requests waiting | `openBookingCount()`, as the Mentoring bar | "N slot requests waiting" |
| Today | Today's waiting total (shops, reports and slot requests; Hidden isn't waiting) | the admin bar's counters: `countWaitingShops`, `openReportCount`, `openBookingCount` | "N waiting" |
| Messages | Conversations with new messages, sales to confirm and new offers | the `messages`, `sales` and `offers` rows of `readForYou` (`MESSAGE_ROWS`) | "N new messages" |
| You | For you's total, without the `messages` and `offers` rows when the bar has Messages | `readForYou` | "N things for you", or "N other things for you" when the bar has Messages |

- So one new message shows once, under Messages. The header's account icon shows only from the tablet step, where no bar shows, so it keeps For you's full total.
- You's page itself still lists messages and offers in For you. The tab's badge then counts For you without those two rows. Its words say "N other things for you" so the badge matches what it counts.
- A seller can see one buyer waiting under both My shop and Messages: both lists really show it.
- Failures: a failed read shows no badge, never a guess or a 0. Counts over 99 show "99+". A badge is `aria-hidden` and the tab is described through `aria-describedby`, as the Saved and You tabs are today.

## 8. What stays the same

- The section bars, `body:has(.section-shell:not([style*="display"]) > .section-bar) .tabbar` hiding the main bar, and the slim footer.
- The menu drawer, the header from the tablet step, and desktop (no bar there).
- The breadcrumbs: every place a bar opens already has its trail (`/browse`, `/saved`, `/messages`, `/account`, `/sell` and `/admin` sit under Home in `PARENTS`; `/mentor` is in `ROLE_PARENTS`, `lib/nav/trail.ts`). No new page, so no change there.
- The listing dock still takes the bar's place on a listing (decision 75).
- Privacy: no new cookie, storage key or data. The bar shows only the viewer's own counts.

## 9. Accessibility (WCAG 2.2 AA)

- Labels stay visible under every icon. Tabs are at least 44px.
- The badge colours and the pill are today's, so their contrast is already checked: navy on sky for the pill, white on the danger red for badges.
- The swap doesn't move focus. It happens before any tap can land on slot 3 or 4, in the first moments of a full load.
- axe runs on each bar (section 11).

## 10. Performance

- No new client component. `RoleTabs` and `PhoneSaved` are Server Components that use `NavLink` and `SavedLink`, which the layout already loads (decision 78's rule: client code only through modules the layout already loads).
- One more Suspense boundary in the layout adds a few hundred bytes of HTML at most. Every page's first-visit JS is measured and recorded against `271399c`, and stays inside 150 KB.
- The badge reads are per request, as the You and admin badges are today. `getViewer()` and `readForYou` are each read once per request, shared with the header.

## 11. Testing

Only tests that guard a real risk (Lama's efficient-testing rule).

- **Unit, `lib/nav/bar.test.ts`:** `barFor` for signed out, student, a seller (open, pending), a mentor, an admin, a mentor who sells, and an admin who sells.
- **Unit, `components/tabbar/TabBar.test.tsx`:**
  - Each bar renders the right labels, links and prefetch flags.
  - A failed count shows no badge.
  - You's badge leaves out messages and offers only when the bar has Messages.
- **E2E, `tests/e2e/role-bars.spec.ts` (device project, 390):**
  - Sign in as each of the five sample accounts and check slots 3 and 4, with axe on the bar.
  - Signed out, check today's bar.
  - Measure layout shift on a cold load of `/` for the seller and the admin (the swap must add nothing).
  - The spec writes nothing, so it runs with the device projects.
- The existing `TabBar`, header and You tests are updated where they pin today's labels.

## 12. Not in this part

- Changing the section bars or the desktop sidebar.
- Any role switcher or remembered mode (role views decision 1).
- A bar for tablets or desktop.
- Renaming internal names (decision 83's second pass).

## 13. What the build changed

Plan `docs/superpowers/plans/2026-10-26-role-bars.md`, plan decisions 1 to 6:

1. One streamed piece, `RoleTabs`, renders slots 3 to 5 (it replaces `TabAccount`), so the session and For you are read once. `TabBar` takes `tail`.
2. `barFor` reads `Account.seller`, with no shop lookup. A pending shop has no `sellerSlug`, so its My shop has no badge.
3. The header's account icon is unchanged: it shows only from the tablet step (section 7).
4. Messages counts sales to confirm too, since they open `/messages`.
5. Today's badge sums the admin bar's three counters, which equal Today's waiting total, instead of reading four lists on every page an admin opens.
6. My shop's badge is the sum of `sellerNeeds(queue, now)`, after `connection()`.

Also:

- `components/account/YouBadge.test.tsx` now renders `RoleTabs`.
- The layout-shift e2e waits for the five tabs rather than for "networkidle": on a signed-in home the router's prefetches keep the network busy.
- The phone heart sits before Search, not after it: the header's end group is end-aligned, so the streamed heart moves nothing already on screen. Measured on the seller's and the admin's cold load of `/` at 390: a layout shift of 0 (0.0007 with the heart after Search).
- `RoleTabs` reads For you and the pill's count together (`Promise.all`).
