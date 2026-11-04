# AI round two: Shop coach in the Launchpad, "Someone's looking for this", Starter pack and photo tips: design

Date: 2026-11-04 · Status: **Design approved by Lama 2026-11-04 (decision 97), section by section; the written spec is waiting for Lama's review.** Stage G planned (2026-11-04, `docs/superpowers/plans/2026-11-04-ai-stage-g-looking-match.md`) and built (2026-11-04, not merged). Builds on decision 96 (`2026-11-03-ai-features-design.md`), whose section 9 listed these as deferred.

## Related documents

| Document | Why |
|---|---|
| `docs/superpowers/specs/2026-11-03-ai-features-design.md` | The provider door (`lib/data/ai.ts`), the settings file (`lib/ai/config.ts`), the checks, the privacy lines and what the real-key test caught |
| `docs/superpowers/specs/2026-10-26-launchpad-design.md` | The Launchpad page (`/hub`): Coming up, Tips, Verified shops |
| `lib/staff/mentor.ts`, `lib/data/mentors.ts` | The caseload's flags, Needs you and `lastCheckIns` |
| `lib/data/shop-stats.ts`, `lib/selling/queue.ts` | The seller's numbers and queue the coach reads |
| `lib/staff/numbers.ts` (`protectCounts`) | The only way staff see private counts |
| `lib/browse/results.ts` (`listingMatches`), `lib/data/index.ts` (`searchListings`) | The only search rules |

## 1. What Lama asked for

Build three of the deferred ideas (decision 96, section 9): "Someone's looking for this", Starter pack and photo tips. Go deeper on Shop coach, so that it works inside the Launchpad and is of real use to sellers.

Lama's answers (2026-11-04):

| Question | Answer |
|---|---|
| Who is Shop coach for? | The seller and their mentor together |
| What may it look at? | The shop's numbers, its listings, and public demand (open Looking For requests, similar listings' prices) |
| How often? | Weekly, made overnight |
| Which shops? | Every approved shop |
| When is an action done? | Checked by the app wherever it can be; the seller ticks the rest |
| How does it connect to the Launchpad? | All four: actions link to Launchpad items, a Coach card on `/hub`, "What shops need" for the Hub team, a check-in briefing for mentors |
| How is it built? | The app picks candidates, the model chooses and words them (approach A), with fixed wording as the fallback |
| "Someone's looking for this": who hears? | The seller at publish; the asker only when an offer is made |
| Starter pack gives | A checklist with real picks and a total |
| Photo tips | At most one tip, only when it matters, in the same call |

## 2. Shop coach: what the seller gets

Every Monday morning each approved shop has **up to three actions** for the week. They show on the `/sell` home (a "This week" card) and as a Coach card at the top of the Launchpad (`/hub`) for a signed-in seller. Each action has:

- a title of at most 70 characters ("Reply to the 3 students waiting on you");
- a "why" of at most 140, using only facts the app gave the model ("Your oldest enquiry is 2 days old");
- one link that does it: the enquiry, the listing's edit page, the Looking For request, or a Launchpad event, office hours or tip;
- whether it's done: a tick when the app sees it done, or "Mark done" on the kinds the app can't check.

Under the actions is one line about last week ("Last week: 2 of 3 done"). One notification arrives on Monday, "Your week's coaching is ready" (a new kind, `coach`, counted in For you).

### 2.1 The catalogue

The app works out a shop's candidates from this fixed list. The model never adds a kind.

| Kind | A candidate when | Done when | Checked by |
|---|---|---|---|
| `reply-waiting` | Enquiries waiting over 24 hours | All of them answered | App |
| `mark-sold` | The seller's queue (`queueFor`) has sales to mark | They're marked | App |
| `add-photos` | An available listing with one photo | It has two or more | App |
| `say-more` | An available listing whose description is under 80 characters | It's 80 or more | App |
| `refresh-quiet` | An available listing with no enquiries and no change in 21 days | It's edited, sold or removed | App |
| `check-price` | An available listing priced at 1.5 times or more the middle price of 3 or more similar available listings (found by `listingMatches` on its title's words and category, every campus) | Its price drops below that, or the seller ticks "Kept on purpose" | App, or seller |
| `answer-request` | An open Looking For request at the shop's campus that the matcher (section 5) pairs with one of its listings or its category | The shop makes an offer on it | App |
| `list-more` | Fewer than 3 available listings | It has 3 | App |
| `finish-shop` | No about text, or no shop photo | Both filled in | App |
| `go-to-launchpad` | A published event or office-hours slot in the next 14 days at the shop's campus or online | The seller RSVPs or asks for a slot (`listOwnBookings`) | App |
| `read-tip` | A published Launchpad tip | The seller ticks it | Seller |

Each candidate carries an id, its kind, its target (a listing, request, post or the shop), its evidence (the numbers behind it), and the links it may use. With no candidates, the week has no actions and the card says "Nothing to do this week. Your shop is in good shape."

## 3. Shop coach: the mentor, the Launchpad and the Hub team

**The mentor's shop page** (`/mentor/[slug]`) gets a Coaching block above the check-ins:
- this week's actions and which are done;
- last week's, and what got done;
- two suggested questions for the next check-in, written in the same overnight call.

The questions are for mentors and admins only. They're never shown to the seller and never in the data download.

**The caseload** (`/mentor`) gets a "Coaching" column ("1 of 3"). A new flag, `coaching-stalled` ("Coaching not picked up"), is added after the existing flags when a shop has had actions two weeks running and finished none of them. A flagged shop joins Needs you, as other flags do (`needsYou`).

The block never shows check-in text or notes. `mentoredShops` still leaves out the viewer's own shop.

**The Launchpad** (`/hub`): a signed-in seller sees their Coach card above Coming up. Anyone else sees the page unchanged. The card streams inside its own `<Suspense fallback={null}>`, like `YourRequestsLink`, so the static page is unchanged. Links into the Launchpad come only from published posts.

**The Hub team** gets a "What shops need" block on `/admin/numbers`. For each kind it shows how many shops had that action this week, by campus, and how many finished it. All counts go through `protectCounts`, so the same "Hidden" and "Under 5" rules apply. It never names, links to or ids a shop. It's there to help the team plan tips, workshops and office hours.

## 4. Shop coach: how it runs

**Schedule.** A new cron route, `/api/cron/coach`, follows the pattern of `/api/cron/photos` and `/api/cron/badges` (`lib/cron.ts`, the cron secret):
- **Sunday 21:00 UTC (23:00 SAST):** works out every approved shop's candidates and sends one Batch API job, one request per shop, at half price.
- **Monday 03:00 UTC (05:00 SAST):** collects the results, checks each one, stores the week and sends the notifications.

If Vercel's plan limits the number of crons, both runs share one route, which picks its job by the day. A shop whose batch result is missing on Monday gets the fixed wording.

**The request** (task `shop-coach`, Haiku and the fake only, via `featureProviders`) holds:
- the candidates;
- the shop's numbers (`shopStats`, `recentCounts`, follower counts);
- its available listings' titles and prices.

It never holds buyers' names, message text, mentor notes or check-ins.

**The reply** gives, in order, up to three `{ candidateId, title, why }`, plus `mentorQuestions` (two strings of at most 140 characters each). `checkCoaching` then:
- throws out an id that wasn't sent;
- shortens a long title or "why" at a word, as the report read does;
- throws out a "why" with any number not in that candidate's evidence.

If no action survives, or the reply fails the check, the shop gets the fixed wording for its top three candidates, ranked by the catalogue's order. No mentor questions are written that week.

**Fixed wording.** Every kind has a template, filled in from its evidence ("Reply to the {n} students waiting on you"). It's used when the model fails, when the batch is late, and always in sample mode, which has no cron. The e2e server runs the cron route once with the fake, so tests see the model's path.

**Storage.** One row per shop per SAST week: `coach_weeks` (shop, week starting Monday, actions as jsonb, mentor questions, `written_by` `model` or `fixed`, created). Done states are worked out live from each action's kind and target, so they're always current. Seller ticks go in `coach_ticks` (week, action id). Rows older than 12 weeks are deleted by the Monday run.

On Supabase:
- The seller reads their own rows through an owner-only function.
- Mentors and admins read through `private.can_mentor`'s rule.
- Writes are service role only (the cron).

The sample store keeps the same rows in memory.

**Privacy (POPIA).**
- A shop's actions are about the business. The seller, its mentor and admins see them.
- They're in the data download.
- Deleting the account deletes the shop's coach weeks.
- Mentor questions are treated like notes: staff only, never in the download, deleted with the account.
- The privacy page gets a line for Shop coach: what's sent to Anthropic and that it's read outside South Africa.

**Cost.** About 2,000 tokens in and 400 out per shop, at batch prices for Haiku 5.5 ($0.05 in and $0.25 out per million). That's roughly R5 a month for 100 shops.

**Switch.** `VOSSIE_AI_SHOP_COACH`, in `lib/ai/config.ts`. Off: no cron work, no cards, no blocks, no flag.

## 5. "Someone's looking for this"

**Reading a request once.** When a student posts or edits a Looking For request, its title and details are read into a search (`SearchQuery`) through the same parsing as search in your own words (`parseSearchWords`, cached by the words). That search is stored on the request as `match_query`. A request that can't be read, because the cap is full, the call fails or the request isn't a sentence, is stored with no query and is never matched. Requests made before this stage are read by a one-off backfill.

**Matching on publish.** On a listing's first publish, in `saveListingForm` after `notifyFollowers` and the saved-search matching and under their condition:
- `listingMatches` runs the listing against each open request's stored query at the listing's campus.
- Requests the seller made are left out.
- There's no model call here.

**What the seller sees.** The "Published" notice adds a line, "2 students are looking for something like this", linking to up to three requests, each with "Make an offer". This uses the existing offer composer. The asker hears only when an offer is made, as today. Requests still say only "Asked by a student at {campus}".

The same matcher feeds Shop coach's `answer-request` candidates, so the two always agree.

**Switch.** `VOSSIE_AI_LOOKING_MATCH`. Off: no reading and no line. Stored queries are kept but unused.

## 6. Starter pack

**The page.** `/browse/starter`, "Get a starter pack", open to everyone. It's linked from Browse's empty state, the Looking For board and the home page (`prefetch={false}`). It's one sentence field and a button, a plain GET form like Browse.

**The read.** Haiku (task `starter-pack`, quick, with a 5-second wait) turns the sentence into:
- the campus (or none);
- the budget in rand (or none);
- up to 8 items, each `{ name, words, categorySlug }`.

The reply is checked like the words search's. It's `"use cache"` by the normalised sentence for a week, and each miss takes one of a daily site-wide cap shared with the words search (`reserveWordsSearch`). Only the sentence is sent, never an account or cookie.

**The picks.**
- For each item, the app runs `searchListings` with its words and category at the campus (the viewer's campus when the sentence names none). If that finds nothing, it tries the item's name alone, as Snap to search does.
- It picks the cheapest available match that still fits the remaining budget, going through items in the model's order.
- Each line shows its pick (a listing card) and "See more" (that Browse search), or, with no match, "Ask for it on Looking For".
- The footer shows the total against the budget.

**Failure.** If the read fails, the cap is full or the switch is off, the page says it couldn't make a pack and offers Browse with the sentence as an ordinary search.

**Switch.** `VOSSIE_AI_STARTER_PACK`.

## 7. Photo tips

**The reply.** The photo-to-listing reply gets one optional field, `photoTip`: either null or `{ photo, kind, text }`.
- `photo` is the photo's number.
- `kind` is one of `dark`, `blurry`, `cluttered`, `cut-off` or `better-cover`.
- `text` is at most 100 characters, shortened at a word.

The instruction asks for a tip only when there's a real problem, and for `better-cover` only when another photo shows the item clearly better.

**On the page.** After "Fill in from my photo", the tip shows beside the photos as a hint. With `better-cover` it gets a "Make it the cover" button, which uses the existing photo move. Nothing is stored.

**Providers.** Groq sees only the cover, so its tips are about photo 1 and never `better-cover`. `checkSuggestion` throws out a tip that breaks this.

**Switch.** Photo-to-listing's existing switch (`VOSSIE_LISTING_AI`).

## 8. Stages and testing

| Stage | What | Depends on |
|---|---|---|
| F | Photo tips | — |
| G | "Someone's looking for this" (the stored query, the backfill, the publish line) | — |
| H | Starter pack | — |
| I1 | Shop coach without the model: catalogue, candidates, done checks, `coach_weeks`, fixed wording, the `/sell` and `/hub` cards | G (the matcher) |
| I2 | Shop coach with the model: the cron and Batch API, `checkCoaching`, the mentor block, the flag and column, "What shops need", the notification, the privacy line | I1 |

F, G and H can run at the same time, each in its own session and worktree. I1 starts after G is merged.

**Testing.** Each stage gets:
- unit tests next to the code: candidate rules, done checks, reply checks and fallbacks;
- contract tests for both backends (coach weeks, ticks, stored queries);
- pgTAP tests for the new tables and functions;
- end-to-end tests with the fake in a write project that runs last;
- axe, layout-shift and JavaScript-budget checks on every new or changed page.

**A real-key test by hand is part of each stage's plan,** on Haiku before the switch goes on. The real-key run of stages A to E caught two bugs the fake couldn't: the words search's schema and the report read's summary length.

**Going live.** For each stage:
1. Push its migrations after a local reset and test.
2. Set its switch on Vercel.
3. Add the cron (I2).
4. Redeploy.
5. Check it on vossie-pi.
6. Add the GO-LIVE steps to `docs/reference/GO-LIVE.md`.

## 9. Left out

- Shop coach never messages buyers, changes a listing or posts anything for the seller. It only suggests.
- No view counts and no saved-search counts, here or anywhere (CLAUDE.md privacy rules).
- No coaching from mentors' notes or check-in text.
- Suggested questions for buyers stays deferred.

## 10. Planning and building notes

### While planning stage G
1. The stored search is a `MatchQuery` (browse's `SearchQuery` without its order); its `q` is the model's, its category and campus are the request's own, and it has no price, pay or deals. A `q` with no search words stores no search.
2. What's read is "{title}. {details}", normalised like the words search and cut at 300 characters at a word; it must pass `looksLikeSentence`, and it is `parseSearchWords`' only input.
3. The read runs in `saveMyRequest` after the save, in the action (not `after()`), through the cached `parseSearchWords`; `readRequestMatch` never throws, so a request is always posted. No tag, since no cached reader reads `match_query`.
4. `match_read_at` marks a request as read, with or without a search; a request that couldn't be read is never matched and the backfill never retries it.
5. An edit (`matchStep`): same words means nothing, or a move of category and campus; changed words read again; with the switch off, changed words clear the search and the read.
6. Sample requests (no asker) are never read or matched.
7. The count is of students (distinct askers); links go to up to three requests, one per student, best match first then newest; the seller's own requests and ones the shop already offered on are left out.
8. The notice carries the count and the ids, not the titles; `MyListings` reads each through `getRequest` and keeps the open ones.
9. The line sits outside the `role="status"` paragraph, with plain `prefetch={false}` links and a hidden " on {title}" on "Make an offer".
10. The backfill is `GET /api/cron/request-matches` behind `CRON_SECRET`, by hand, 15 requests a call, calling `reserveWordsSearch` and `readSearchWords` directly so a full cap stops it without marking anything.
11. Supabase: `match_query` and `match_read_at` are in no grant to `anon` or `authenticated`; the one writer is `save_request_match`, service role only, which never touches `updated_at`.
12. The data download includes it as `matchedAs`, a label; the privacy page says what is sent to Anthropic.
13. End-to-end tests go in `community-writes.spec.ts` with axe in the same test; no new layout-shift test, and no new client code.
14. No word-dropping fallback: matching needs every `q` word, and the hand test measures how often that finds nothing.
15. Each read takes one of the words search's 2,000 daily parses on a cache miss; the model is never asked to count characters.

### While building stage G
- Built 2026-11-04 in its own worktree as a parallel stage beside F and H, committed on its branch by the controller, not merged, not pushed.
- The hand test (plan Task 10) wasn't run: this worktree has no keys. `scripts/looking-match.hand.ts` is written and the parent runs it on main after merging. Its result is still owed, so the switch stays off.
- The database tests (pgTAP `66_looking_match.test.sql` with plan(31), `request-match.db.test.ts`, the download contract on Supabase), `pnpm db:types` and Playwright weren't run here (shared local stack and port); they run once after F, G and H are merged. `lib/supabase/database.types.ts` is hand-edited.
- The plan's e2e used `toHaveText` on the status line, which also holds "See it as buyers do"; it is `toContainText`, as selling-writes does.
- The listing-actions test's request is in Res & living, since `fanForm` publishes there (the plan said Tech).
- The "Make an offer" link's hidden " on {title}" puts the space outside the sr-only span, so the accessible name reads correctly.
- `saveRequestMatch`'s "a search needs a read" check runs on both backends. Sample sorts break ties on id, as Supabase orders by created_at then id.
- The `.wanted-notice` CSS sits in `app/globals.css`'s "Selling: my listings" section beside `.sell-column .form-notice a`, and reuses the notice's link colour (no new tokens).
- Stage I's matcher API, free of the AI door, from `lib/data/request-match.ts`: `requestMatchCandidates(campusSlug, today)`, `requestsWantingListing({ listingId, sellerSlug, ownerId, now })`, `saveRequestMatch(id, query, read, now)`, `requestMatchOf(askerId, id)`, `unreadRequests(today, limit)`. The pure ones are in `lib/looking-for/match.ts`: `matchRequests`, `wantedFrom`, `wantedLine`, `requestWords`, `requestMatchQuery`, `asMatchQuery`, `matchStep`, `withPlace`.
