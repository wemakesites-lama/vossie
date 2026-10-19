# Vossie community actions: design spec

- **Date:** 2026-10-14
- **Status:** Built (2026-10-19), in sample mode. Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log. Section 8 holds what the plan review and the build changed; it wins over the decisions above.
- **Scope:** stage H, the signed-in actions no earlier stage covers:
  - posting a Looking For request; editing, closing, reopening and deleting your own; a "Your requests" page;
  - making an offer on a request;
  - following shops, the shops you follow on Saved, and a notification when one lists something new;
  - the offline page and a small service worker.

  It builds on stages D (accounts), E (conversations, reports, notifications), F (shops and listings) and G (the reports queue and the audit log). Hub RSVPs and slot requests are stage G's (staff tools spec 2.5).

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-14-community-pages-design.md` | The board and request pages (4.1 to 4.3), and decision 2: requests name no one |
| `docs/superpowers/specs/2026-10-13-shopping-pages-design.md` | The storefront's band (4.1) and Saved (section 5) |
| `docs/superpowers/specs/2026-10-14-messaging-design.md` | Conversations, the composer, the scam check, reports and notifications. Its section 9 wins |
| `docs/superpowers/specs/2026-10-14-selling-design.md` | Shops, listings, the dashboard. Its section 8 wins |
| `docs/superpowers/specs/2026-10-14-staff-tools-design.md` | The reports queue, confirm pages and the audit log |
| `docs/reference/FUNCTION-MAP.md` | E2 and E3 (follows), N1 (Looking For), G9 and G12 (the worker and offline page) |
| `docs/reference/GO-LIVE.md` | Sections 1 and 2: `/offline`, and "followed sellers once accounts exist" |

---

## 1. Goal

A signed-in student can ask for what they need and manage the request; Vossie's shops can offer to help, and the asker answers in the inbox they already use. Students can follow shops, find them on Saved, and hear when one lists something new. When the network drops, Vossie says so in its own words instead of the browser's error. None of it adds client code to a shared page.

## 2. Decisions

### Looking For requests

1. **Requests move into the sample store,** as F moved listings (selling spec 2.1).
   - The cached data functions read them from the store, tagged `requests`. Every write calls `updateTag("requests")`, so the board, the homepage's band, request pages and the sitemap follow on the next request.
   - The 16 fixtures are the seed and have no asker. New ids are `r-` and a UUID; their pages render on first request and are cached from then on. `STORE_VERSION` goes up.
   - A row adds the asker's account id (never shown), `seedOffers` (decision 11), when it was closed, and G's `hiddenAt` and `hiddenReason` (decision 14). `LookingForRequest` keeps its shape, so part B's rows and pages don't change.
2. **Every form is a plain form posting to a Server Action, and works without JavaScript.** Each action takes identity from the session, checks the request is the viewer's own where it must be, keeps errors and typed values in D's form state (never the URL) and ends with `redirect()`. Each error summary has its own id (`request-form-summary`, `offer-summary`).
3. **The request form** (`/looking-for/new`, `/looking-for/[id]/edit`):
   - what you need (the title, 5 to 70 characters) and the category;
   - the campus, prefilled from the account's;
   - details (20 to 600 characters, line breaks kept), hinted "Say what you need and when. Shops will message you on Vossie.";
   - a budget in rand (optional: empty means "Open to offers"), and "A swap is welcome";
   - needed by (optional: today or later in SAST, and within 90 days).

   **Post request** opens the new request's page, with "Your request is up." as a status line.
4. **Requests carry no contact details.** The server refuses a title or details holding a phone number or an email address: "Take out the phone number or email. Shops will message you on Vossie." The plan sets the patterns, and an ISBN must pass. It keeps the asker unnamed (community spec decision 2) and keeps contact where reports and the scam check can see it.
5. **Limits:** 5 open requests per account at a time, and 5 new ones a day. The board stays readable and a spammer runs out quickly, as E's 10 reports a day do.
6. **The asker manages their own requests.**
   - **Edit** while it's open.
   - **Close** ("Found it? Close it so shops stop offering.") and **Reopen** are one form button each. Neither loses anything, so neither has a confirm page. Reopening counts towards the 5 open.
   - **Delete** goes to a confirm page (`/looking-for/[id]/delete`) with **Delete request** and **Keep it**. The page then 404s, and its offer threads stay with the note "This request was removed", as F's deleted listings do (selling spec 2.9).
   - Nothing closes on its own. Closing by date would read the clock on prerendered pages and empty the sample board as its October dates pass. It joins the scheduled jobs on the go-live checklist.

### Offers

7. **An offer is a conversation, not a separate record:** the first message of an E conversation between the asker (the buyer's side) and the shop.
   - `ConversationRow` gains `requestId` and `requestTitle` (kept for when the request has gone, as `listingTitle` is). `ConversationStatus` gains `"offered"`.
   - It reuses E's inbox, thread, scam check, reports, sale status, notifications and deletion rules. An offer record would still need a conversation for the asker to answer, and a second inbox to read it in.
   - Offer threads show under Buying for the asker and Selling for the shop, titled with the request ("Your request: Accounting 1 tutor this week").
8. **Only shops offer:** an approved shop that isn't paused, answered for by its owner (messaging spec 9.1).
   - Conversations belong to shops, and shops are businesses that show their names; askers are private people (community spec decision 2). The homepage already promises "sellers on your campus come to you with offers".
   - The Hub has checked every shop. That protects askers, who are easy to scam ("pay a deposit and I'll bring it").
   - A signed-in student without a shop sees "Offers come from shops on Vossie, so the Hub has checked who's offering." and **Start selling** (`/sell`). If Eduvos opens selling to every student (GO-LIVE section 7, "Who can sell?"), offers open with it.
9. **The offer composer is a page,** `/looking-for/[id]/offer`, like E's composer (messaging spec 2.1).
   - The request's summary (title, campus, budget, needed by), an h1 "Offer to help", the message (up to 1,000 characters, a static hint) and an optional "Point to one of your listings" select of the shop's available listings, which the thread then shows as E's listing summary. E's three scam tips sit beside it, and E's scam check runs on the offer.
   - **Send offer** opens the thread with E's "Sent." note.
   - One offer per shop per request. **Offer to help** always opens the composer, which then says "You've offered already" and links to the thread (messaging spec 9.2).
   - No offers on a closed or hidden request, or on the owner's own; at most 20 offers a shop a day.
   - Until the asker replies, the shop can't write again ("You can write again when they reply."), so askers aren't chased.
   - E's lookup of a buyer's thread about a listing skips offer threads, so pointing to a listing never merges an offer into an enquiry.
10. **The asker stays unnamed to the shop until they reply.** The thread and inbox say "The student who asked" until the asker writes; then their first name, as for any buyer (messaging spec 2.11). Posting a request never hands a name to every shop that offers.
11. **The offers count comes from the store.** Today it's the fixture's `offers` number. From this stage it's the request's offer threads, plus `seedOffers`: the fixture's number, kept only on the 16 sample requests (which have no asker, so no threads). Requests posted on Vossie count only real offers. The board, the request page and the homepage show it as now.
12. **Offers and trust badges.** An offer thread isn't an enquiry, because the shop wrote first: it stays out of the 48-hour reply rate, the dashboard's enquiries and the mentor numbers. "Offered" becomes "Replied" when the asker writes back, and only then does the shop see **Mark as completed**, so a shop can't offer widely, mark each done and let the 7-day auto-confirm count sales. A sale confirmed through an offer counts like any other.
13. **The asker's view.**
    - On their request's page, the offers panel (read from the session in its own `<Suspense>`, the public panel as fallback) shows "Your request", the count, each offer (shop name, first line, time in SAST, linking to the thread), and **Edit**, **Close** or **Reopen**, and **Delete**.
    - **Your requests** (`/account/requests`, a new row on the account page): open first, then closed, then hidden, newest first, each with its count and the same actions.
    - Each offer sends the asker an `offer` notification: "Tech corner offered to help with Accounting 1 tutor this week", linking to the thread.
14. **Moderation reuses G's reports queue.** G lets a report about a request only be dismissed (staff tools plan decision 5); this stage adds **Hide the request**.
    - It uses G's confirm page (`/admin/reports/[id]/hide`), which asks for the reason. It closes every open report on that request, tells each reporter (`report-handled`), writes an audit entry ("Hid a request") and sends the asker a new `request-update` notification linking to Your requests, where the reason shows.
    - A hidden request leaves the board, the homepage and the sitemap, and its page 404s. The asker can delete it, not edit or reopen it. Showing it again waits, as for G's hidden listings.

### Following shops

15. **Follows are a store table,** `follows`: the account, the shop's slug, and when. They point at F's shops, and F's `moveShop` moves them with everything else when a shop changes its link. Up to 200 per account; an owner can't follow their own shop.
16. **Follow is a form button in the storefront's band,** in a part read from the session inside `<Suspense>`. The fallback, and the signed-out version, is a **Follow** link to sign-in that comes back to the shop. Signed in: **Follow**, or "You follow this shop" and **Unfollow**; the owner sees F's Edit shop instead. The words say what the button does, so it needs no pressed state.
17. **Shops you follow live on Saved,** as the go-live checklist asks: two tabs as links, **Listings** (`/saved`, as now) and **Shops** (`/saved?tab=shops`).
    - Shops: newest follow first, as the Hub's small seller cards (round photo, name, campus, "Paused" when it is), each with its number of available listings and an **Unfollow** button.
    - Signed out: "Sign in to follow shops. They'll show here." with a sign-in link back to the tab.
    - The device note ("Saved on this device…") belongs to Listings; Shops says "Kept with your account."
18. **Followers are private.** A shop sees only how many follow it, on its dashboard ("12 people follow your shop"), never who. The storefront shows no count, so a new shop doesn't open on "0 followers".
19. **A followed shop's new listing makes a notification,** kind `new-listing`, at most one per shop per follower per SAST day.
    - "Tech corner listed Casio fx-991ZA Plus calculator", linking to the listing. Another listing that day, while it's unread, updates it ("Tech corner listed 2 new things", linking to the shop) and moves it to the top.
    - Only publishing makes one (a new listing, or a draft published); edits, relists and a shop resuming don't. Unfollowing is the off switch.

### Offline

20. **`/offline` is a self-contained page** from a route handler: inline styles, no scripts, no images, under 4 KB.
    - An h1 "You're offline", "Vossie needs a connection to show listings and messages. Check your data or Wi-Fi.", and **Try again**, a link to the same address.
    - "Vossie" is set as text (the crest PNG is 35 KB), in the system fonts the brand faces fall back to, set once as `--vos-font-*` in its inline CSS.
    - `noindex` (an `X-Robots-Tag` header), and not in the sitemap. A Next page would need the site's hashed script and style files, which an offline browser doesn't have.
21. **A small service worker, `/sw.js`, shows it.** It's worth having: installed Vossie (the footer offers it) has no address bar or reload button, so a dropped connection otherwise strands the student on a browser error.
    - It keeps one thing, the offline page, in a cache named `vossie_offline`. It answers only GET page loads whose network request fails, with navigation preload so pages aren't slowed.
    - It never touches posts, data fetches or other sites, and never stores a page, so nothing personal stays on a shared phone (POPIA).
    - A route handler serves it with `Cache-Control: no-cache`, so a fix arrives on the next visit. The kill switch is a version that removes itself and its cache.
22. **Registering it costs no script file.** One statement joins the inline boot script (`lib/boot-script.ts`), in production builds only, running after the page's `load`: about 120 characters in each page's HTML. The worker and the offline page download once per device, after load. Next 16.4's `experimental.useOffline` isn't used: it's experimental, it changes the framework's code on every page, and most of Vossie's links don't prefetch, so there'd be little to show offline.

### Privacy

23. **What's stored, and what deletion removes** (POPIA):
    - A request holds only what the form asks and the asker's account id, which is never shown. A follow holds the account, the shop and when.
    - Deleting a request removes it. Deleting an account removes its requests, its follows, the follows of its shop (which goes, as in F) and its notifications. Its offer threads follow messaging spec 9.8 ("This person has left Vossie").
    - The data export gains your requests and the names of the shops you follow, with no ids.
    - The privacy page names the `vossie_offline` cache (the privacy test finds the name in `lib/`). Its "Your account" section adds requests (public, never naming you) and follows (a shop sees only the count). No new cookie.

---

## 3. Screens (summary)

| Route | Who | What |
|---|---|---|
| `/looking-for` | Anyone | As now. **Post a request** (here, in its empty states and on the homepage's band) goes to `/looking-for/new` |
| `/looking-for/new` | Signed in | The request form (decision 3) |
| `/looking-for/[id]` | Anyone | As now, with the asker's panel (decision 13). **Offer to help** opens the composer |
| `/looking-for/[id]/edit` | The asker | The request form, filled in |
| `/looking-for/[id]/delete` | The asker | Confirm delete |
| `/looking-for/[id]/offer` | Signed in | The offer composer (decision 9), or why you can't offer |
| `/account/requests` | Signed in | Your requests (decision 13) |
| `/sellers/[slug]` | Anyone | Follow in the band (decision 16) |
| `/saved?tab=shops` | Anyone | Shops you follow (decision 17) |
| `/messages`, `/messages/[id]` | The asker and the shop | Offer threads (decisions 7 to 12) |
| `/admin/reports/[id]`, `/admin/reports/[id]/hide` | Admin | Hide the request (decision 14) |
| `/offline` | Anyone | The offline page (decision 20) |
| `/sw.js` | The browser | The worker (decision 21) |

The new pages are `noindex` and render per request inside `<Suspense>`, with `requireAccount`, which sends signed-out visitors to sign-in and back. Public pages keep their prerendered shells: only the request page's panel and the storefront's Follow read the session, each in its own `<Suspense>`.

## 4. Accessibility

- Every field is labelled and limits are text. The error summary links to its fields; it's focused on a full page load and announced with `role="alert"` otherwise (accounts spec 6).
- Buttons name their target ("Unfollow Tech corner", "Close Accounting 1 tutor this week"), the name in visually hidden text where the visible word is short.
- A status line (`role="status"`) confirms each action: "Your request is up.", "Request closed.", "You follow Tech corner."
- Saved's current tab has `aria-current="page"`. Dates and times are `<time>`, in SAST. Confirm pages repeat what will happen.
- Every target is at least 44px, Follow on the band included. Small text on the stars stays white; Follow is a sky pill with navy text, Unfollow a white outline.
- The offline page has `lang="en-ZA"`, one h1, navy on white and a 44px **Try again**.

## 5. Performance

- No new client code. Every action is a form posting to a Server Action, Saved's tabs are links, and the session's parts are server slots.
- The listing page is at 151,770 B: 535 B under the stop line (152,305 B) and 1,830 B under the limit (153,600 B). Every existing page's first-visit JavaScript stays the same to the byte. The performance test adds the storefront, Saved (both tabs), the board and a request page, and the new pages carry only the shell. If any figure moves, the build stops to find out why.
- New links into pages that read the session, or into routes with client code (storefronts from Saved, Saved's tabs), have `prefetch={false}` (decision 53).
- The boot script's addition is measured with each page's HTML and recorded. If it reaches 100 B compressed, or moves any script figure, the worker is cut and `/offline` goes back on the checklist.
- The offline page stays under 4 KB and the worker under 1 KB.

## 6. Testing

- **Unit:**
  - the request rules: each field's limits, the needed-by date in SAST, contact details, the open and daily limits;
  - the store's request writes and their tag: edit, close, reopen and delete by the asker only, and hide;
  - offers: who can offer, one per shop, the daily limit, the shop waiting for a reply, "offered" to "replied", the unnamed asker, the count with `seedOffers`, offers left out of the reply rate;
  - follows: follow and unfollow, the cap, not your own shop, `moveShop` moving them, deletion;
  - the `new-listing` notification's one-a-day rule;
  - the export and deletion, and the privacy page naming `vossie_offline`;
  - the offline page's HTML (no script, no outside file, under 4 KB) and the worker's source (GET page loads only).
- **End to end** (each test on its own new accounts, requests and listings, found by a word no other test uses, as in G's plan):
  - post a request, find it on the board and the homepage at its campus, edit, close, reopen and delete it; post one with the app's bundle blocked;
  - the contact-details refusal;
  - a shop offers (two browser contexts): the asker's notification and count, the unnamed asker, a reply, Mark as completed and Confirm;
  - a student without a shop on the composer;
  - report a request, hide it as admin, and see it gone and the asker told;
  - follow from a storefront, find it on Saved's Shops tab, the shop lists twice and the follower gets one notification, then unfollow;
  - offline (Chromium): the worker installs, an offline page load shows the offline page, and Try again works once back online. Every other test blocks service workers.
- **Checks:** axe on each new page and state, the JS budget for every changed and new page, layout shift, and review screenshots in `docs/progress/community-actions/`.

## 7. Not in this stage

- Requests closing on their own by date or age (a scheduled job, go-live).
- Telling shops about new requests in their category, and saved-search alerts.
- Offers from students without a shop (it follows Eduvos's "Who can sell?" decision).
- Photos on requests.
- Follow on the listing page's seller card, public follower counts, and a feed of followed shops' listings.
- Showing a hidden request again, and suspending a student's account.
- Pages kept for offline reading, background sync and push notifications.
- Hub RSVPs and slot requests (stage G).

---

## 8. Changes on plan review and build (2026-10-14 to 2026-10-19)

The plan (`docs/superpowers/plans/2026-10-14-community-actions.md`, with its amendments) and the build refine these points; where they differ, these win. Items 1 to 12 came from the plan's own decisions; items 13 to 24 came from its reviews and the build, and the plan's "Changes made during the build" gives each with its commit. Claude, under decision 54.

1. **Every id is per page** (plan decision 2), instead of one `request-form-summary` and one `offer-summary`: `request-new-…` and `request-<id>-…` on the request form (its summary `request-new-summary`, `request-r-001-summary`), `offer-<id>-…` on the composer. Next keeps earlier pages hidden in the DOM, so two forms can be on screen together.
2. **Contact details are refused by pattern, and ISBNs pass** (plan decision 3). After ISBNs are taken out (anything after "ISBN", a 13-digit number starting 978 or 979, a dashed ISBN-10 whose check digit is right), a title or details holding an email address or a phone number (10 digits starting 0, or 11 starting 27) are refused. Words for numbers get through: reports and the scam check cover that. Review made the check wider (item 14) and the refusal says "If it's an ISBN, write ISBN before it."
3. **"A day" is the last 24 hours** (plan decision 4), as messaging's 10 reports a day. The 5 new requests and 20 offers a day count rows that still exist, so deleting a request gives its slot back. The open limit counts open requests that aren't hidden, and Reopen counts towards it.
4. **Sample requests can't take offers** (plan decision 12): the 16 seeds have no asker to answer. The composer says "This is one of Vossie's sample requests, so it can't take offers." and their edit and delete pages are the 404. It also says why anyone else can't offer: no shop, a shop waiting for approval, a paused shop, your own request, an offer made already, or a closed request.
5. **An offer thread is named by its request** (plan decision 8): "Your request: {title}" for the asker, "Request: {title}" for the shop. The pill says Offered until the asker replies, the shop's reply form is replaced by "You can write again when they reply.", and the sent note is "Sent. The student who asked gets a notification."
6. **Offers stay out of enquiries and the reply rate** (plan decision 11): shop counts leave out conversations with a `requestId`, and a shop that has gone isn't counted toward the 20 a day. A first publish is decided once, by selling's `isFirstPublish`.
7. **The new-listing notification comes only from an open shop's first publish** (plan decision 15): a new listing, or a draft published for the first time, by an approved shop that isn't paused, and not hidden. Publishing, saving back to a draft and publishing again tells followers once.
8. **Follow has its own 44px row in the storefront's band** (plan decision 16), at every size, inside a box that's always there: the signed-out link, Follow, "You follow Tech corner." with Unfollow, or nothing for the owner. After an unfollow the row says "Unfollowed." The band keeps its width (the box has zero width and a full minimum width). The owner's row stays empty and reserved on phones and tablets, so nothing moves when the session's part streams in.
9. **Saved's tabs stream in together** (plan decision 17): the h1 is the static shell, and the tabs, the note and the list sit behind one skeleton, keyed by tab so a client-side switch never shows the other tab's content. A shop the Hub paused stays on Saved, marked Paused, with Unfollow and no storefront link, and still counts toward the 200.
10. **A new request is made once, however many times its form is sent** (amendment 3): a one-time token in a hidden field, made when the form is drawn and taken in one step by the first post. A second send lands on the first request's page; a missing or made-up token is refused with "This form has expired. Check it and send it again." and what was typed.
11. **One offer per shop per request, even when sent twice at once** (amendment 7), and the asker's offers count keeps threads whose shop has gone.
12. **The offline page and worker as built** (plan decision 25, amendments 5 and 6): the registration is 132 characters in each page's HTML (`;if("serviceWorker"in navigator)addEventListener("load",…)`), added only in production builds and only while `WORKER_ON` is set. It costs 65 to 89 B brotli in a page's HTML (the cut was 100 B), moves no script file, and client code never imports `lib/boot-script.ts` or `lib/offline.ts` (the install event's name is in `lib/install-event.ts`; importing them had cost 527 B on every page). `/sw.js` is sent per request with `no-cache`. The worker's first line carries a hash of the offline page, so editing the page makes a different worker. The kill switch (`WORKER_ON = false`) serves a worker that deletes `vossie_offline` and unregisters itself, and the page stops registering; a device that already has the worker gets it through the browser's own update check, which can take up to about a day.
13. **The budget reads South African money** (amendment 17.1): "R250,00" is 250, and "99,99" and "1,2" are invalid; the plan stripped every comma, which read cents as rand and showed "R250,00" as R25,000 on the board.
14. **The contact check catches numbers joined by anything** (amendments 17.2 and 19.1): dates are taken out, then runs split on spaces, brackets, dots, slashes, plus signs, dashes, commas, underscores and colons, so "082 123 4567-083 123 4567", "082/123/4567" and "082,123,4567" are refused, while "2026-10-01 - 2026-10-05", "R1 200 - R2 000" and "R1,200" pass.
15. **The limits say what they count** (amendment 17.3): "You've posted 5 requests in the last 24 hours. Try again later."
16. **An offer thread shows the request's current title** while its page is up (amendments 17.4 and 19.5), in the inbox, thread, export and reply notifications; the kept title is only for once the request has gone.
17. **A shop that has gone is "A closed shop"** in every offer thread (amendment 17.5), and its asker reads "This shop has closed, so you can't reply." (amendment 19.2). A shop the Hub paused keeps its real name (amendment 19.3). A hidden request's threads say "The Hub hid this request." to the asker and "This request was removed." to the shop (amendment 19.4). The sent note shows only while the status is Offered.
18. **Post a request, Offer to help and Follow follow the session** (amendment 18): each is a `<Suspense>` whose fallback is the sign-in link (`signInHref(next)`) and whose server child streams in the real one, on the board's head and empty state and the homepage's band, with no prefetch and no client code. A signed-out visitor sent straight at a page that needs sign-in was stranded after signing in, because the browser replayed that page's earlier redirect; the replay itself lives in stage D's sign-in flow and is left open (an open point in `docs/PROGRESS.md`, and on the go-live checklist). Signed out, Post a request goes through sign-in and ends on the form; signed in, it opens the form.
19. **A hidden request shows as hidden on its reports** (amendment 8): the queue and the report's page say "Students can't see this request: the Hub has hidden it." and the queue's Hide button is offered only for an open report about a request that's there and not hidden.
20. **Editing a request whose needed-by date has passed** accepts the date unchanged (amendment 19.6); only a changed date must be today or later. A paused shop that already offered can still open its offer (amendment 19.7). `typedValues` keeps a category and campus only when they're known slugs (amendment 19.8).
21. **Every page that streams is at least a screen tall, less the header** (the footer must stay below the first screen while content arrives): the listing, storefront, request, collection and Hub post pages wait behind `PageFallback` (a screen tall) instead of `null`, and Saved, browse, the request form (with Edit and Delete request), Your requests, the offer composer, and messaging's inbox, thread and notifications have a minimum height. On a slow network, with the CSS cached, React shows a finished boundary no sooner than 300 ms after the first paint, so a short fallback let the footer into the first screen and it jumped when the content took over (up to 1.05). The homepage's hero holds its photo's row too (0.2532 at 390).
22. **Delete request has its own skeleton, sized to its content** (amendment 13), not the form's.
23. **The JavaScript figures** (section 5): the install event's name moved out of the boot script, so every page's first-visit JavaScript fell by 22 B (the listing page 151,747 B, the new listing form 152,265 B, 40 B under the stop line). New pages carry only the shell. The homepage's first-visit `total` is measured as spec 11 defines it (before below-the-fold photos, leaving out link prefetches and lazy photos): 313,540 B, steady to 2 B.
24. **Sample wording** the spec doesn't give (plan decision 26) is for Lama to change: the request form's hints and errors and the composer's notes (`lib/looking-for/errors.ts`, `components/looking-for/`), the status lines and notification sentences (`lib/looking-for/words.ts`, `lib/following/rules.ts`), Your requests' and Saved's Shops empty states, the delete page's lines, the dashboard's followers line, the offline page's words beyond the spec's (`lib/offline.ts`), and the privacy policy's and settings' new sentences.
