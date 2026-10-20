# Vossie saved-search alerts: design spec

- **Date:** 2026-10-14
- **Status:** Built (2026-10-20), in sample mode. Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log.
- **Scope:** stage I, after stages D to H. It is the last functional item on the go-live list ("After launch: saved-search alerts") that no stage covers:
  - saving a search from the browse page;
  - your saved searches on a new Searches tab on Saved, where you can pause and delete them;
  - a notification when a newly published listing matches one.

  It builds on stages D (sessions and form state), E (notifications), F (listings and publishing), G (hidden listings) and H (the one-a-day `new-listing` notification and Saved's tabs). No email: no stage sends any yet.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md` | Browse's parameters (3.2), links (3.3), search rules (4.8) and filter rules (4.9). Its section 12 left saved searches and alerts out |
| `docs/superpowers/specs/2026-10-14-community-actions-design.md` | Saved's tabs (2.17) and the `new-listing` notification (2.19), whose one-a-day rule this stage reuses. Its section 7 left saved-search alerts out |
| `docs/superpowers/specs/2026-10-14-messaging-design.md` | Notifications (2.9 and 3.5). Its section 9 wins |
| `docs/superpowers/specs/2026-10-14-selling-design.md` | Publishing, pausing and relisting listings. Its section 8 wins |
| `docs/superpowers/specs/2026-10-14-accounts-design.md` | Sessions, `getViewer()`, `requireAccount()`, form state, the data export and deletion |
| `docs/reference/FUNCTION-MAP.md` | Section 10's "Add" list: "Saved-search or new-listing alerts by category and campus" |
| `docs/reference/GO-LIVE.md` | "After launch: saved-search alerts" |

---

## 1. Goal

A signed-in student who can't find what they need today can save the search and hear when it's listed. They save it with one tap on the results, get a notification when a new listing matches (at most one a day for each search), and pause or delete it from Saved. The alert uses browse's own rules, so it never disagrees with the results page. It uses H's new-listing pattern, so there's one way of saying "something new". It adds no client code and needs no scheduler.

## 2. Decisions

### What a saved search is

1. **A saved search is browse's parsed query, without the parts that only change how results are shown.** It's a store table, `savedSearches`, holding the account, `q`, `category`, `campus`, `price`, `pay` and `deals`, when it was saved, and when its alerts were paused (null while they're on). Ids are `ss-` and a UUID.
   - The Server Action reads the posted fields with browse's own `parseBrowseParams`, so the `max` alias, unknown values and the 100-character cut work as they do on the page. Sort and `n` are dropped: they change the order, not what matches.
   - The campus is always stored, as a slug or `all`: the campus in the link, or else the viewer's chosen campus, which browse already shows as a chip (decision 40). An alert mustn't depend on one device's cookie.
   - Category and campus names aren't stored. The label (decision 3) looks them up whenever it's shown.

   Using one parser means the saved search, its link and its alert all agree.
2. **Words match exactly as they do in browse's search** (browse spec 4.8), through the same functions. The text searched is the listing's title, description, category name and shop name. Words are lowercased, accents are removed, and text is split on anything that isn't a letter or digit. Stop words and single letters are ignored, and digits are kept. Every word must match, by its start or, for words of 5 letters or more, with one typo.

   The per-listing test inside `findListings` becomes its own function, `listingMatches(listing, query, names)`, which browse and the alerts both call. Matching the title only would be quieter, but then a listing the results page shows might never alert, and two sets of rules would drift apart. The daily cap (decision 12) keeps the noise down.
3. **A saved search is named after what it searches for, and can't be renamed.** The label is built from the query. It starts with the words in curly quotes, followed by " in {Category}" when there's a category too; or with the category name alone, or "Everything" when there are neither. Then comes " at {Campus}", " on Eduvos Online" or " at every campus", then the active filters, after commas, in the browse chips' words and order ("under R100", "cash", "free & swaps").

   For example: "“calculator” in Tech at Midrand, under R100". A name the student types could drift from what the search matches, and would need its own form, checks and errors. To change a search, the student runs it again and saves it.
4. **What's worth saving, and duplicates.**
   - A search can be saved only if it has words (other than stop words), a category, or a price, pay or deals filter. A campus on its own would match every listing there, and the homepage's Just listed already does that. Plain `/browse` shows no Save row.
   - Two searches are the same when they have the same set of words and the same filters, so "Calculator casio" is the same as "casio calculator". Saving it again says "You've saved this search already."
   - Up to 20 per account. That covers a semester's textbooks and a few other things, and keeps the matching on each publish short (decision 11).

### Saving from browse

5. **Save this search is a plain form posting to a Server Action, in its own server slot.** It adds no client code to browse.
   - The row sits under the active filter chips (or under the toolbar when there are none), above the results or the empty state. That way it's also there when nothing matches yet, which is when a student needs it most.
   - It reads the session with `getViewer()` inside its own `<Suspense>`, so the results never wait for it.
   - The form posts hidden fields: `q`, `cat`, `campus` (always included), `price`, `pay` and `deals`, plus `from`, the browse link it came from.
   - The action takes the account from the session, never from the form. It accepts `from` only if `safeNextPath` allows it and it starts with `/browse`. It checks decision 4's rules, writes through `lib/data`, and leaves its note or error in D's form state, never in the URL. It refreshes and ends with `redirect(from)`, as every write does (messaging spec 9.6).
6. **The row's states.** Each state is one short line and one 44px control, in a box of fixed height, so nothing moves when the session's part streams in (as with H's Follow row, community actions plan decision 16):
   - **Signed out, and the fallback:** "Hear when something new matches." and a **Save this search** link to `/login?next=…`, which brings the student back to the same browse link (decision 44). Signing in doesn't save the search, because a GET never writes; the student presses Save once they're back.
   - **Signed in:** the same line, with a **Save this search** button.
   - **Already saved:** "You've saved this search." and **Manage saved searches** (`/saved?tab=searches`).
   - **At the limit:** "You have 20 saved searches." and **Manage saved searches**.

   After a save, the line reads "Search saved." as a status. If the server refuses a save (a duplicate, or the limit reached in another tab), the reason shows in the line with `role="alert"`.

### Managing them on Saved

7. **Saved searches live on Saved, as a third tab.** The tabs become **Listings**, **Shops** and **Searches** (`/saved?tab=searches`), all links, like H's two (community actions spec 2.17). Saved already holds what a student keeps, the header links to it from every page, and H put follows there for the same reason (decision 67).
   - The list is newest first. Each row has the label, linking to its results (with the campus pinned); "Saved 12 October", as a `<time>` in SAST; "Alerts on" or "Paused"; and two form buttons, **Pause alerts** (or **Resume alerts**) and **Delete**.
   - The tab's note: "Kept with your account. Each search sends at most one notification a day."
   - When there are none: "No saved searches yet. Search on Browse and press Save this search." with a **Browse** link. Signed out: "Sign in to save searches. They'll show here." with a sign-in link back to the tab.
8. **Pause and Delete have no confirm page.**
   - Pausing loses nothing. It's the "not now" switch for exams or a holiday, so a student keeps a search they'll want again. Resuming doesn't look back: only listings published after that count.
   - Deleting loses only a set of filters. Its status line ("Deleted “calculator” at Midrand.") links to the search's results, where the student can save it again with one tap.
   - Deleting a search also removes its notifications, because its words are the student's own (decision 15).

### Matching and the notification

9. **Matching runs when a listing is published, on the same write as H's new-listing hook, with no scheduler.**
   - F has no `publishListing` data function: publishing is F's `saveListingForm` with the intent `publish`, which writes through `saveOwnListing` (selling plan, Task 8).
   - In `saveListingForm`, straight after H's `notifyFollowers` call and under the same condition, the action calls `notifySavedSearches` in `lib/data`. The condition is a first publish (a new listing, or a draft published) by an approved shop, of a listing that isn't hidden.
   - Using one condition for both notifications means they can't disagree about what's new. Sample mode has no scheduler to run a sweep later.
10. **What doesn't send an alert:**
    - edits, even one that makes a listing match (a price cut, say), because price-drop alerts are a different feature;
    - **relisting** a sold listing, and **resuming** a paused listing or a paused shop (F's `setOwnListingState`, and the shop's Resume). Relist exists to undo a mistaken Mark sold (selling spec 8.6). The listing keeps the date it was first published, so it doesn't sort as new in browse either, and H treats it the same way;
    - a listing published while its shop is paused, or one the Hub has hidden (stage G);
    - the searcher's own listings: an account is never told about its own shop's listings;
    - paused searches.
11. **How a listing is matched.** Each active saved search is tested against the new listing with `listingMatches` (decision 2), using the listing's category name and shop name. However many of an account's searches match, the listing tells that account only once: under its oldest matching search that can still notify that day (decision 12). In sample mode this is a loop over every saved search, which the 20-per-account cap keeps bounded.
12. **One notification per saved search per SAST day, using H's rule** (community actions spec 2.19, plan decision 15). The rule moves into one helper that both kinds of notification call, rather than being copied.
    - The first match of the day names the listing and links to it: "Casio fx-991ZA Plus calculator matches your search “calculator” at Midrand".
    - Another match that day, while the first is still unread, updates it rather than adding one: "3 new listings match your search “calculator” at Midrand" (using `NotificationRow.count`). It then links to the search's results, Newest first, and moves to the top of the list.
    - A match after it's been read **makes the same notification unread again**, counting only the listings since it was read ("2 new listings match…"), and moves it to the top. So a search never has more than one notification a day, and never more than one unread, however busy it is ("Tech at every campus" shows one line whose count grows, not a line per listing); but a match is never missed, which matters for scarce things like a cheap textbook. This differs from H's follows on purpose: a student asked for these matches. The shared helper takes a `reopenWhenRead` option, off for H's new-listing notifications and on for `search-match`.
    - The new kind is `search-match`, shown with the search icon already in `components/icons.tsx`. Its `subjectId` is the saved search's id.
13. **No "new since" marker on the results.** The link opens the results sorted Newest, so new listings are at the top, and the sentence says how many there are. A `since` parameter would change browse's parser and links, and would make a link that goes stale.
14. **No email.** Stage E sends no email or push notifications (messaging spec 8), and the go-live email service is for sign-in codes. Email alerts wait for that service and a consent choice the student makes. Until then, alerts reach students through the header's count and `/notifications`. If a followed shop's new listing also matches a search, the student gets both notifications, because each says why.

### Privacy

15. **What's stored, and what deletion removes** (POPIA):
    - A saved search holds the account, the filters, when it was saved and when it was paused.
    - Only its owner sees it. Shops never learn who was told, staff tools don't show saved searches, and they're used for nothing but these notifications.
    - Deleting a search removes it and its notifications. Deleting an account removes its saved searches and, as it already does, its notifications.
    - The data export gains `savedSearches`: each search's label, its filters by name, whether it's on or paused, and when it was saved. No ids.
    - No new cookie or browser-storage key is needed, so the privacy test needs no new name. The privacy page's "Your account" section adds saved searches: kept with your account, seen by no one else, and used only to tell you about new listings.

---

## 3. Screens (summary)

| Route | Who | What |
|---|---|---|
| `/browse` | Anyone | As now. The Save this search row (decisions 5 and 6) appears when the search has words, a category or a filter |
| `/login?next=…` | Signed out | Sign-in from the row, then back to the same browse link |
| `/saved`, `/saved?tab=shops` | Anyone | As now, with a third tab link |
| `/saved?tab=searches` | Anyone | Saved searches (decisions 7 and 8); signed out, a sign-in link back to the tab |
| `/notifications` | Signed in | `search-match` notifications (decision 12) |

There are no new routes. On browse, only the row reads the session, in its own `<Suspense>`. Saved's tabs read it as H's Shops tab does. `/saved` is already blocked in robots.txt and `noindex`.

## 4. Accessibility

- The row is a `<p>` and a button or link named "Save this search". Browse shows one search, so the name needs no target. The line after a save has `role="status"`, and a refusal has `role="alert"`.
- On the Searches tab, buttons name their search in visually hidden text: "Pause alerts for “calculator” at Midrand", "Delete saved search “calculator” at Midrand". Each action's status line has `role="status"`: "Alerts paused for …", "Alerts on for …", "Deleted …".
- The open tab has `aria-current="page"`. Rows are a list, and dates are `<time>` in SAST.
- Every target is at least 44px. Save this search is a white button with a navy outline and navy text, because sky never carries text on white. Links on white use sky-dark.
- A notification's sentence is text, and its icon is decorative.
- Every flow works without the app's JavaScript.

## 5. Performance

- No new client code. Save, Pause, Resume and Delete are forms posting to Server Actions, Saved's tabs are links, and the session's parts are server slots.
- At the last measure, browse's first visit was 151,361 B: 944 B under the stop line (152,305 B) and 2,239 B under the limit (153,600 B). Browse's and Saved's first-visit JavaScript stay the same to the byte. The performance test adds browse with a search and Saved's Searches tab. If any figure moves, the build stops to find out why.
- New links into browse (the labels, the delete line, the notifications' links) and into Saved (Manage saved searches) have `prefetch={false}` (decision 53), because both routes carry client code: browse's `ScrollToResult` and Save hearts, and Saved's hearts.
- Publishing waits for the match. The match reads only saved searches, never listings, so its cost grows with the number of searches. A real backend may run it as a database query or from a queue (a go-live note).

## 6. Testing

- **Unit:**
  - building a saved search from posted fields: through `parseBrowseParams`, the `max` alias, the campus always stored, sort and `n` dropped;
  - what's worth saving, duplicates (case, accents and word order), and the limit of 20;
  - the label for each shape, including the online campus and every campus;
  - `listingMatches` agreeing with `findListings` on every fixture listing for a set of queries, so browse and alerts can't drift apart;
  - what sends an alert and what doesn't: a first publish and a published draft do; edits, relists, resumes, a paused shop, a hidden listing, the searcher's own shop and a paused search don't;
  - the one-a-day rule: the first match, an update while unread, a read one made unread again with the count since it was read (and H's new-listing notifications still not reopened), and a new SAST day. Also, a listing telling an account only once across its searches;
  - pause, resume and delete, by the owner only, and deleting removing the search's notifications;
  - the export and account deletion, and the privacy page's names unchanged.
- **End to end:** each test uses its own new account and listing, found by a word no other test uses. Tests that publish run in F's `selling-writes` project (selling plan decision 25).
  - Signed out on a search: press Save this search, sign in, land back on the same link, and save. The row then says it's saved.
  - Save with the app's JavaScript bundle blocked.
  - Saved's Searches tab: the label's link, pause, resume, and delete with its status line.
  - Two browser contexts: a student saves a search, and Tech corner publishes a matching listing. The notification names the listing and opens it. A second matching listing that day turns it into "2 new listings", linking to results with them at the top.
  - An edit and a relist send no alert.
- **Checks:** axe on each state of the row and on the Searches tab (with rows, empty and signed out); the JS budget for browse and Saved; layout shift on browse with a search, signed out; and review screenshots in `docs/progress/search-alerts/`.

## 7. Not in this stage

- Email or push alerts, and choosing how often to get them (a digest).
- Alerts on edits, price drops, relists or a shop resuming.
- Renaming a search, or changing its filters in place.
- A "new since" marker on the results.
- Saved searches without an account, kept on the device.
- Telling shops about new Looking For requests in their category (community actions spec section 7).
- A scheduler or queue for matching (a go-live note).
- Showing staff or shops what students search for.

## 8. Changes on plan review and build

The plan and the build refined this spec. Where they differ from the decisions above, these win (plan decision numbers are in `docs/superpowers/plans/2026-10-14-search-alerts.md`; the build's changes are in its "Changes made during the build").

- Words that are all stop words or single letters are kept as no words, and a post without a campus is for every campus (plan decision 2).
- The Save row also shows above browse's error, and its states stack on phones and sit side by side from the tablet step (plan decision 6).
- Status lines wait under `save-search:<the search's key>` and `saved-searches` (plan decision 7), and no form has an error summary (plan decision 8).
- The Searches tab's count line and the date "Saved 12 Oct" go through the existing `shortSastDate`, not a new helper and not "12 October" (plan decision 10; the build's Task 5 entry).
- A read notification made unread again counts from one and names that listing. "Never more than one unread" holds within a SAST day (plan decision 12).
- The match also refuses a hidden listing, a draft and a shop that isn't approved on its own, not only through F's condition (plan decision 13).
- The export's fields, and other students' notifications naming a deleted shop's listing staying (plan decision 15); privacy settings' words too (plan decision 16).
- The refusal at the limit is "You're at the 20-search limit.": one line at 320px, and the same sentence before and after a press, so the 72px row never grows (review fix `e1de51a`). This replaces the plan's "You have 20 saved searches. Delete one first." (plan decision 18).
- Deleting one listing deletes the `search-match` and `new-listing` notifications that link to it, and a deleted shop's listing-link alerts go too. Both match on the notification's `/listings/<id>` href, because a `search-match` row's `subjectId` is the saved search's id (plan amendment 11; review fix `e1de51a`).
- Save this search carries a one-time token (plan amendment 3, decision 21). A missing or unknown token isn't refused, and nothing is recorded under it. The token is issued only in the `new` state with no status note. It costs one form-state row per signed-in browse view that offers Save, kept for an hour (a go-live note).
- The views are in `components/browse/SaveSearchViews.tsx` (plan amendment 2), and the row is keyed by its search so a client move to another search never shows the previous one's line (plan amendment 6).
- `SearchIcon` already existed, so only `NotificationsView` changed for the search-match icon.
- The end-to-end tests that publish run in their own `alerts-writes` project after H's `community-writes`, not in F's `selling-writes` (plan decision 19). The at-the-limit row is held at 72px at 360px with no layout shift in that project.
- The axe checks live in `tests/e2e/alerts-checks.spec.ts`, not `a11y.spec.ts`, which another session had open.
- The review screenshots are taken by `tests/e2e/alerts-screenshots.spec.ts`, not `screenshots.spec.ts`, for the same reason.
- The saved-search JavaScript figures did not move: every page's first visit is unchanged to the byte.
