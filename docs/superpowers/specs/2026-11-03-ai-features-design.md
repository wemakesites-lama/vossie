# AI features: Haiku first, search by photo or in your own words, a listing check, and a read of each report: design

Date: 2026-11-03 · Status: **Approved by Lama 2026-11-03 (decision 96).** Stages A (Haiku first) and B (the listing check) built; C to E not planned. Lama's answers are in section 11.

## Related documents

| Document | Why |
|---|---|
| `docs/superpowers/specs/2026-10-24-photo-to-listing-design.md` | The provider door, the checks and the privacy rules this builds on |
| `app/seller-guidelines/page.tsx` ("What can't be sold") | The list the listing check and the report read work from |
| `lib/browse/results.ts` (`listingMatches`), `lib/types.ts` (`SearchQuery`) | The only search rules: the AI only fills in a query |
| [Meta: AI listings and replies](https://techcrunch.com/2026/03/12/facebook-marketplace-now-lets-meta-ai-respond-to-buyers-messages), [eBay Magical Listing](https://innovation.ebayinc.com/stories/magical-listing-tool-harnesses-the-power-of-ai-to-make-selling-on-ebay-faster-easier-and-more-accurate/), [Marqo: product discovery 2026](https://marqo.ai/blog/ecommerce-product-discovery-ai-2026) | What other marketplaces have shipped (read 2026-11-02) |

## 1. What Lama asked for

Switch photo-to-listing to Claude Haiku for better results. Then, from the ideas list (2026-11-02), build these four first:

1. **Snap to search:** search with a photo of something you want.
2. **Search in your own words:** "graphing calculator under R300 at Pretoria".
4. **A listing check** against the seller guidelines before a listing goes live.
5. **A read of each report** for staff.

The rest go on the deferred list (section 9), to build later if time allows.

## 2. Stage A: Haiku first for photo-to-listing

Haiku 5.5 (`claude-haiku-5-5`) is already built as the fallback (`lib/data/listing-ai/anthropic.ts`). Making it first is mostly settings; the rest makes its answers better.

1. **Haiku first, Groq behind it.** `VOSSIE_AI_PROVIDERS=anthropic,groq` (section 7.2). Groq's free tier answers only when Haiku couldn't (busy, timeout, model gone), as decision 11 already works.
2. **Up to three photos go to Haiku**, in the seller's order; Groq still gets the cover only. The back of a book or a label shot is often where the brand, model or edition is. `ProviderRequest.image` becomes `images` (section 7.1).
3. **Category names as well as slugs.** The instruction gets one line per category ("tech: Tech, such as laptops, calculators and chargers"), so the enum isn't a guess from a slug.
4. **The instruction moves into `system`,** with campus context: prices in Rand (never guessed, as now), Eduvos module codes, the things students sell.
5. **Effort and timeout come from the photo test** (section 8): `low` against `medium`. If `medium` wins, the timeout goes from 10 to 15 seconds.
6. **Cost:** under $0.001 a fill with three photos, about R15 to R20 per 1,000 fills. The limit of 20 fills per account a day stays. A monthly spend limit is set in the Anthropic console.
7. **Prices stay out of the model.** The price hint keeps reading real listings.

## 3. Feature 4: the listing check

**What the seller sees.** On Publish (and on Save when the title, description or photos changed), the server reads the listing against "What can't be sold". When it looks like a match, the form comes back with a notice in place of publishing:

> This may break the seller guidelines: *counterfeit goods.* If it doesn't, publish it anyway and the Hub will take a look.
> [Edit listing] [Publish anyway]

The same pattern as the composer's scam words and Send anyway.

Decisions:

1. **Input:** title, description, category and the cover photo. Never the seller's name or shop.
2. **Output (structured):** `concern` (one of the guideline's kinds: weapons, alcohol-or-tobacco, medicines, counterfeit, academic-dishonesty, stolen, illegal, or none) and `confidence`.
3. **Only `high` confidence stops the publish.** Anything less publishes without a word, so an honest seller is rarely slowed down.
4. **Publish anyway files a report** for the Hub with the reason "prohibited", from a system reporter ("The listing check"), so it joins the Reports queue and its counts the same way any report does. (Q2)
5. **It fails open.** No provider, a timeout or a bad reply publishes as normal and logs the kind. Reports from students still catch what it misses.
6. **Academic dishonesty is the student-specific case:** "I'll write your FAC1501 assignment" stops; "FAC1501 tutoring" and study notes don't (the guidelines welcome both). The instruction gives both as examples.
7. **Sample mode:** the fake provider stops any listing whose title contains "fake" (for the e2e test).

## 4. Feature 5: a read of each report

**What staff see.** On `/admin/reports/[id]`, above the reporter's words, a box headed "First read (may be wrong)":

- one line on what the report is about (at most 140 characters);
- the guideline it may break, or "No guideline clearly broken";
- whether that agrees with the reporter's reason.

Decisions:

1. **Staff decide everything.** The read has no buttons, changes no outcome, and is never written to the audit log.
2. **Input:** the reported listing's title, description and cover photo, the request's text, or the shop's name and about text; plus the reporter's reason and detail. Never the reporter's name or anyone's account. Reports never cover messages, so no message text goes to a model.
3. **Made when the report is filed,** with `after()` so the reporter isn't kept waiting, and stored on the report (a `first_read` column on Supabase). A failure leaves the box out; a "Read again" press makes one more try. (Q5)
4. **Deleting an account** strips the read with the reporter's detail, as the report's other fields are already handled.
5. **Not used for counts or the queue's order** for now: `todayQueue` and the badges stay as they are.

## 5. Feature 1: Snap to search

**What the buyer sees.** The search overlay and Browse's empty state get "Search with a photo". It opens `/browse/photo`: one photo field (camera or gallery) and a Search button. The search results that come back show the words used ("Searching for: Casio fx-991 calculator"), which the buyer can edit like any search. With nothing found, the empty state offers "Ask for it on Looking For" with the title filled in.

Decisions:

1. **The photo is never stored.** It's re-encoded in the browser (the listing form's code, so its hidden data is gone and it's at most 1600px), stripped again on the server, sent once, and dropped.
2. **The model answers with search words only:** `words` (at most 6), `categorySlug`, `moduleCode` (a textbook's), `personIsSubject`, `confidence`. A person as the subject, or low confidence, comes back as "Couldn't tell what that is. Try a closer photo, or type it."
3. **Browse does the searching.** The answer becomes a `SearchQuery`, and the action ends with `redirect(browseHref(query))`. The URL holds only the search words, never the photo.
4. **Signed in only,** 30 photo searches per account a day (sample accounts exempt in sample mode). Signed-out visitors see the sign-in link. (Q3)
5. **Performance:** the page's client component (the re-encode) loads only on `/browse/photo`, and every link to it is `prefetch={false}`.
6. **Accessibility:** a labelled file field, a 44px Search button, and the "couldn't tell" message in the form's notice region.

## 6. Feature 2: search in your own words

**What the buyer sees.** They type into the usual search box. When the words read like a sentence (four or more words, or a price, campus or "cheap"/"free"), Browse shows results with the filters filled in and one line above them:

> Showing calculators under R500 at Pretoria. [Search for exactly what I typed]

Decisions:

1. **The model only fills in a `SearchQuery`:** `q` (the item words), `category`, `campus` (a slug or "all"), `price` (the filter steps: free, under 50, 100, 250, 500), `pay`, `deals` and `sort`, each from its own enum. "Under R300" takes the next step up (under R500), and the line says what was used. `listingMatches` does all the matching.
2. **Short searches never reach the model.** "calculator" and "FAC1501" search exactly as today.
3. **The parse is cached by the words typed** (`"use cache"`, a week, its own tag), so a repeated search is instant and costs nothing. The search words are the only input; no account, no campus cookie.
4. **Open to everyone, with a site-wide daily cap** (2,000 new parses a day to start). Over the cap, or on any failure, Browse searches the words exactly, as today, with no message. (Q3)
5. **"Search for exactly what I typed"** adds `exact=1`, which skips the parse.
6. **Waiting:** the parse runs inside Browse's existing `<Suspense>` with its skeleton, so a sentence search shows the skeleton for about a second longer. Nothing changes for short searches.

## 7. What all four share

### 7.1 One provider door

`lib/data/listing-ai.ts` becomes `lib/data/ai.ts`, still the only place that loads a provider (each by dynamic import, so no SDK reaches a browser chunk; `grep -lE "groq|anthropic" .next/static/chunks/*.js` prints nothing). `ProviderRequest` takes `images` (none to three), an optional `text` and the schema. Each feature has its own reader beside it (`readListingPhotos`, `readSearchPhoto`, `readSearchWords`, `checkListingGuidelines`, `readReport`) and its own pure check in `lib/` (as `checkSuggestion`), so every reply is checked before it's used. Groq stays a fallback for the photo features only; the listing check, the words search and the report read are Haiku only (Groq's free tier is too small to share).

### 7.2 Settings

All settings move to `lib/ai/config.ts`: one provider list, `VOSSIE_AI_PROVIDERS` (the old `VOSSIE_LISTING_AI_PROVIDERS` still read until it's removed from Vercel), and one switch per feature: `VOSSIE_LISTING_AI` (as now), `VOSSIE_AI_PHOTO_SEARCH`, `VOSSIE_AI_WORDS_SEARCH`, `VOSSIE_AI_LISTING_CHECK`, `VOSSIE_AI_REPORT_READ`. A feature shows only when its switch is "1" and a provider can answer. The fake is never used on Supabase.

### 7.3 Privacy (POPIA)

- The privacy page names Anthropic (and Groq while it's listed): what goes (photos and the words of listings, requests, searches and reports), that Anthropic doesn't train on it, and how long it's kept (30 days unless zero retention is arranged). Photos and words leave South Africa, so the page says so (POPIA section 72).
- Nothing about a person is sent: no names, accounts or messages. A person as a photo's subject is never described.
- Logs hold the provider and the failure kind only, never a photo or text.

### 7.4 Cost at launch traffic (rough, 2,000 active students)

| Feature | Calls a month | Cost a month |
|---|---|---|
| Photo-to-listing (3 photos) | 1,500 | about R30 |
| Listing check | 2,000 | about R25 |
| Snap to search | 1,000 | about R10 |
| Words search (after the cache) | 3,000 | about R10 |
| Report read | 100 | under R2 |

Under R100 a month together. The console's spend limit is the backstop.

## 8. Testing

- **The photo test, by hand with real keys, before Stage A goes on:** about 30 photos (textbooks front and back, calculators, laptops, clothes, furniture, res kitchen kit, one with a person, three that break a guideline, two that look close but don't, such as tutoring). Groq against Haiku `low` and `medium`: title, category, condition, module code, concern, time taken. Costs a few cents. The same photos then test Snap to search.
- **Unit tests** for each pure check and each query builder (the enums, the price steps, short searches never parsed, the cap).
- **End-to-end on the fake provider:** a listing stopped and published anyway (its report in the queue), a photo search landing on Browse, a sentence search with its line and the exact-search link, a report's first read. The listing check's test goes in `selling-writes`; the report read's in `staff-writes`.
- **After every build:** the chunk grep in 7.1, and every page inside the 150 KB budget.

## 9. Deferred (if time allows)

| Idea | What it would reuse |
|---|---|
| **3. "Someone's looking for this":** on publish, tell the seller about open Looking For requests the listing may answer, and suggest an offer | The words search's parse, and the listing check's moment on publish |
| **6. Starter pack:** "Starting at Midrand in February, kitchen stuff, R800" returns a basket of real listings | The words search, run once per item in the plan |
| **7. Shop coach:** three tips a week for Launchpad sellers from their own numbers | The Batch API overnight at half price; only counts the seller already sees |
| Photo tips: "your cover is dark or blurry, try photo 2" | One more field on the photo-to-listing call |
| Suggested questions for buyers ("Does it come with the charger?") | The listing's category; could be a fixed list per category with no model at all |

Left out on purpose: AI replies on a seller's behalf (trust matters more on a campus market) and anything that reads mentors' notes.

## 10. Build order

**A** Haiku first and the shared door (7.1, 7.2) → **B** the listing check → **C** the report read → **D** Snap to search → **E** search in your own words. Each stage is off by its switch until the privacy line names Anthropic and the key is in Vercel. E comes last because it touches Browse, the busiest page.

## 11. Lama's answers (2026-11-03)

- **Q1. Providers?** ⟶ **Haiku first, Groq as the fallback** (section 2, decision 1).
- **Q2. The listing check?** ⟶ **Warn, with Publish anyway, which files a report for the Hub** (section 3, decisions 3 and 4).
- **Q3. Who can search?** ⟶ **Snap to search signed in only; the words search for everyone, with the daily cap** (sections 5.4 and 6.4).
- **Q4. When does it go on?** ⟶ **Built behind the switches, turned on after the submission,** as photo-to-listing is (section 10).
- **Q5. When is the report read made?** ⟶ **When the report is filed,** with `after()` (section 4, decision 3).

## 12. Changes made while planning and building

### While planning stage A (2026-11-03, plan `docs/superpowers/plans/2026-11-03-ai-stage-a-haiku-first.md`)

1. **The category lines live in code** (`CATEGORY_HINTS` in `lib/selling/suggest.ts`), keyed by slug, not in the categories' data: the categories table has no description column, and a test fails when a category has no line.
2. **Haiku's effort is a setting,** `VOSSIE_HAIKU_EFFORT` (low by default), so the photo test can compare low and medium without a code change; medium gets 15 seconds.
3. **The photo test is a Vitest file run by hand** (`scripts/photo-test.hand.ts`, `vitest.hand.config.mts`), outside `pnpm test`, so it can use the real providers.
4. **`VOSSIE_LISTING_AI_PROVIDERS` is still read** when `VOSSIE_AI_PROVIDERS` is unset, until it's removed from Vercel.

### While building stage A (2026-11-03)

1. **Two more importers of the old settings** the plan missed: the listing form (`components/sell/ListingForm.tsx`) and the old door; both now use `lib/ai/config.ts`.
2. **The old door's test** (`lib/data/listing-ai.test.ts`) wasn't in the plan. Its five cases (the four failures that move on, the answers that don't, a provider without its key, the log line) moved into `lib/data/ai.test.ts`, with Haiku first.
3. **Groq's reply variable is `content`,** since the request's `text` now names the prompt.
4. **Still to do:** the photo test with Lama's keys (plan Task 9), which sets `VOSSIE_HAIKU_EFFORT`.

### While planning stage B (2026-11-04, plan `docs/superpowers/plans/2026-11-04-ai-stage-b-listing-check.md`)

1. **A report with no reporter account is the listing check's.** `reports.reporter_id` is nullable; staff see "The listing check". At most one open listing-check report per listing.
2. **Publish anyway posts the concern** (`anyway=counterfeit`), so nothing is kept between the two posts. A forged one only files a report against the seller's own listing.
3. **When it runs:** a publish of a new listing or a draft, and a save of a live, paused or sold listing whose title, description or photos changed. Never Save as draft or a waiting shop.
4. **After the field checks, before the one-time token is taken,** so a stopped publish keeps the form, its photos and its token.
5. **The report is filed only for a listing saved as available.** A failure to file it is logged by kind and doesn't undo the save.
6. **The seller isn't told about the report:** the notice already says the Hub will take a look.
7. **Dismissing it says "Dismissed."** and tells no one.
8. **The provider request names its task** (`photo-to-listing` or `listing-check`): the fake answers each, and the log line names it.
9. **The e2e test dismisses its own report,** so `staff-writes`' "Open reports" link still finds the oldest report it made.

### While building stage B (2026-11-04)

1. **The database types were edited by hand** (`lib/supabase/database.types.ts`: `file_listing_check_report`, a nullable `reports.reporter_id`) while the local stack was down. Regenerated on the stack afterwards: byte-identical.
2. **The database checks ran once the stack was up** (2026-11-04): the migration applies, pgTAP 2,615 passed (46 files, the new one's 14 included) and `test:db` 357 passed (51 files). `06_account_actions.test.sql` lists the functions signed-in users may run, so `file_listing_check_report(text,text)` joined it, and the new test's hidden listing needed a hide reason (`listings_hidden_with_reason`).
3. **"What can't be sold" in the notice is sky-dark and underlined** (`.msg-check-hint a`): the hint's grey was the wrong colour for a link on white.
4. **Focus:** with the app's JavaScript the notice is announced as an alert rather than focused, as the error summary and the composer's scam check are (accounts plan decision 11).
5. **Planning decision 5 changed (final review):** the report is filed for any listing saved anyway that isn't a draft or hidden, not only an available one. A save leaves a paused or sold listing as it is, so the old rule filed nothing there, and Resume or Relist would then have put it live unchecked. On a paused or sold listing the notice says "Check this before you save" and "Save anyway".
6. **The instruction says the listing is data:** anything in the title, description or photo that tells the model how to answer is ignored. The check still fails open, so students' reports stay the backstop.
7. **The privacy line** says "when you publish a listing or change its words or photos", since edits are checked too.
8. **The pgTAP test closed the report with `'hidden'`,** an outcome `reports.outcome` allows (it had `'acted'`, the notification's wording only), and gained a hidden listing, a paused one and a new report after the open one closes.
