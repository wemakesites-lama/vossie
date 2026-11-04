# AI round two: Shop coach in the Launchpad, "Someone's looking for this", Starter pack and photo tips: design

Date: 2026-11-04 · Status: **Design approved by Lama 2026-11-04 (decision 97), section by section; the written spec is waiting for Lama's review.** Builds on decision 96 (`2026-11-03-ai-features-design.md`), whose section 9 listed these as deferred.

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

## 10. While planning and building

### Stage H: Starter pack

Stage H built (2026-11-04, plan `docs/superpowers/plans/2026-11-04-ai-stage-h-starter-pack.md`), off behind `VOSSIE_AI_STARTER_PACK`.

Planning decisions:

1. **The sentence** is the `q` parameter, at most 200 characters (`STARTER_SENTENCE_MAX`; Browse's 100 is too short for a list). The field shows it as typed (trimmed, spaces collapsed); the cache key and the only thing sent is `normaliseSentence` (also lowercased).
2. **No sentence gate.** Unlike Browse, the page is an explicit "Make my pack" press, so any non-empty sentence is read. The shared cap is the brake.
3. **The reply check** (`checkStarter`) refuses only a reply of the wrong shape (not JSON, missing or extra fields, wrong types). Text is clipped, never refused: a name to 40 characters at a word, words cleaned as Snap to search cleans them and kept to 4, the first 8 items kept, duplicates (same words and category) dropped, an item with no usable words dropped. An unknown category slug becomes null on that item and an unknown campus becomes null (structured outputs shouldn't send either; the fake and a schema slip might). A budget of 0 or less is no budget. No items left is a failure. The schema has no `maxItems` (structured outputs refuses it, `lib/search/photo.ts`) and its enum fields have no `type` (Anthropic rejects an enum beside `type: ["string", "null"]`, `lib/browse/words.ts`).
4. **The fallback search** is the item's name alone, cleaned the same way, with the same category and campus (spec: "as Snap to search does"). It runs only when the words found nothing and the name's words differ from them.
5. **Picks:** only listings with a price (`priceZar !== null`); swap-only listings are never picked. A "From" price counts at its from amount (as Browse's price filters do), and the pack says "Prices marked From can cost more." when a pick has one. A listing is picked at most once. `searchListings` is asked for cheapest first (`sort: "price-low"`), so the first unpicked priced match is the cheapest; it's picked when it fits what's left of the budget. With no pick, the line says why: over what's left of the budget, only swaps, or its only match is already in the pack. Every line with matches has "See more".
6. **"See more"** is Browse with the words that were searched (the item's or its name's), its category, the pack's campus (`campusFromLink: true`), cheapest first and `exact=1`, so Browse never reads those words again (stage E decision 3).
7. **"Ask for it on Looking For"** is `/looking-for/new?title=<the item's name>`, as Browse's empty state does with search words (stage D decision 3).
8. **The campus:** the one the sentence names, else the viewer's campus cookie (`getViewerContext().campus`, which may be every campus). The campus is never sent to the model.
9. **Failure** (no read, a full cap, a reply with no usable items, or any item's search throwing) shows one message, keeps the form with the sentence, and offers Browse with the sentence as an ordinary search: `/browse?q=<sentence cut to 100>` with no `exact`, so it behaves exactly as if typed into Browse's search box (Browse's own words search may read it).
10. **Switch off: a static page with no form** ("Starter packs aren't on right now." and a link to Shop), and no link anywhere points to it. A deviation from the spec's "offers Browse with the sentence" for the off case only: reading the sentence would need `searchParams` and a Suspense boundary whose shortest state (one line) is shorter than the form's skeleton. Only an old link can reach it with a sentence.
11. **The total** shows only when the pack has a pick: "Total R430 of your R1,000 budget, R570 left", or "Total R1,630" with no budget.
12. **Links in**, each `prefetch={false}` and shown only while `aiFeatureOn("starter-pack")`: Browse's empty state (under "Search with a photo"), the Looking For board (a second sentence in its line), and the home page's Looking For band (under Post a request). All three are static, so they shift nothing.
13. **Metadata:** "Get a starter pack"; a page with a sentence is `noindex` (`generateMetadata` reads `searchParams`, allowed because the page's content is request-time inside `<Suspense>`). Not in the sitemap.
14. **The e2e test is a device spec** (`tests/e2e/starter-pack.spec.ts`), not a write project: it reads only, and the cap's count lives in server memory, which no buyer sees (as `words-search.spec.ts`).
15. **The fake** (`fakeStarter`) reads a campus from the schema's list and a budget ("R1000", "1000 rand") from the sentence, and always answers four fixed items chosen against the fixtures: one that matches (the Casio calculator, R250), one found only by its name (a lamp, R180), one over a R1,000 budget once those two are picked (the bar fridge, R1,200), and one with no match at Midrand (a kettle). A sentence with "[no pack]" in it gets a reply that isn't JSON, so the e2e test sees the failure.

While building:

- `checkStarter`: a name with no letters or digits ("!!") falls back to the searched words, capitalised, so a line's heading, its Looking For title and the name search never use punctuation alone. A budget must be a safe integer (`1e20` refuses the reply, as a budget of the wrong type does).
- `pickPack`: when an item's priced matches are all already in the pack and only swaps are left, the line says "Its only match is already in your pack." ("taken"), not "Only swaps so far."; "swaps" is only for an item none of whose matches has a price.
- The home band's link has a 10px top margin, not `.looking-for-action`'s 18px, which read too loose under the button. `.looking-for` sets `--focus-ring: var(--color-on-sky)` so focus on the band is navy in every theme (white on sky was about 2.6:1 in Dark).
- The off page's `generateMetadata` checks the switch before it reads `searchParams`, so with the switch off the page never reads the request.
- A picked line's card title is an h4 under the item's h3 (`ListingCard` takes `titleTag`), so heading navigation reads each item once with its listing under it.
- The failure link's words are the sentence cut to Browse's 100 characters, the same words its link searches.
- The real-key hand check (`scripts/starter-pack.hand.ts`, plan Task 9) was not run while building: the stage's worktree had no keys. It runs on `main` after the merge, before the switch goes on anywhere; its outcome goes here.
