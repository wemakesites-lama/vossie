# CampusCart photo-to-listing: design spec

- **Date:** 2026-10-24
- **Status:** Draft for Lama. Not planned or built. Revised 2026-10-26: Groq's `qwen/qwen3.8-27b` (free tier) first, behind a provider-neutral module, with Claude Haiku 5.5 as the fallback (decisions 9 to 13); the screens chosen with Lama from mockups (section 2). The open questions (section 12) are Lama's to answer before a plan is written.
- **Scope:** a seller adds a photo on the new listing form, presses one button, and the form comes back with a suggested title, category, condition, description and photo description, plus a price hint from similar CampusCart listings. Textbooks also get their module code and, where one exists, a line about open Looking For requests. Nothing is published or priced for the seller.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-14-selling-design.md` | The listing form (2.10), photos (decisions 9 and 11) |
| `docs/superpowers/specs/2026-10-14-community-actions-design.md` | Looking For requests (2.6), used by the textbook line |
| `docs/superpowers/specs/2026-10-20-hardening-design.md` | The message limits, the model for this feature's daily limit |
| `docs/superpowers/specs/2026-10-21-follow-ups-design.md` | The listing forms' recorded JS figures |
| `docs/reference/GO-LIVE.md` | Gains this feature's switch and privacy line (section 9) |
| [Groq: vision](https://console.groq.com/docs/vision), [models](https://console.groq.com/docs/models), [structured outputs](https://console.groq.com/docs/structured-outputs), [your data](https://console.groq.com/docs/your-data), [deprecations](https://console.groq.com/docs/deprecations) | What decision 9 and section 4 rest on (read 2026-10-26) |

---

## 1. Goal

- Listing an item takes a photo and a check, not a blank form. A marketplace with few listings fails, so making listing easier is the biggest lever there is.
- What's suggested is grounded: the category and condition can only be ones the form offers, and the price hint comes only from real CampusCart listings, never from the model.
- It stands out by knowing the campuses: a textbook's module code, and "students are Looking For this".
- No new client component: the form keeps working without JavaScript, and the feature fails quietly into the form as it is today. The only client code it adds to the form is the existing `PendingButton` (section 6).

## 2. What the seller sees

Chosen with Lama on 2026-10-26 from mockups in the brainstorm companion (kept untracked in `.superpowers/brainstorm/`): the entry point, the reading state, how suggestions are marked, the fallback states and the tablet layout.

### 2.1 The photo card (new listings only)

1. **A navy "Start with a photo" card at the top of `/sell/listings/new`,** above the "What are you listing?" field. It holds:
   - the heading "Start with a photo";
   - the line "We'll fill in what we can see. You check it before anything goes live.";
   - the photo field (today's `PhotoFieldset`, moved into the card: thumbnails, Add photos, each photo's buttons, the descriptions);
   - the "Fill in from my photo" button: a solid sky pill with navy text, the card's main action.
2. **Then a divider, "or fill it in yourself",** and the form as it is today, without the photo field.
3. **The edit form is unchanged** (photos last, [ListingFormView.tsx:200](../../../components/sell/ListingFormView.tsx)), with no card and no button (decision 4).
4. **On navy:** small text is white; sky is only the button (a solid pill). The thumbnails' "add" tile is a white dashed outline. The photo buttons inside the card use the card's white-on-navy variant of `.sell-action`.
5. **Tablet and desktop** (`wide:`): the card becomes two columns, the cover large on the left (about 120px, the other photos small beneath it) and the heading, line and button on the right. It stays inside the form's column, beside the seller bar's sidebar; the form below keeps its width.
6. **The button is always there while the feature is on** (decision 14). Without JavaScript the server can't know a file has been chosen, so it never hides; pressed with no photo, it answers with a notice (2.4).
7. **Not borrowed from the AI SDK's Attachments component:** its remove button that shows on hover (CampusCart has no hover-only features) and its hover-card previews. Kept: a clear thumbnail row with the cover first and large.

### 2.2 While the photo is read

1. **The button is a `PendingButton`** (`components/kit/PendingButton.tsx`): while the post is pending it reads "Reading your photo…" and ignores a second press.
2. **A status line appears under it,** inside the card: "Looking for a title, category and condition. This takes a few seconds." (`role="status"`, so it's announced once). It's in the markup but hidden until the button is pending.
3. **A soft band of light sweeps the cover photo,** up and down, so it's clear which photo is being read (the "image processing" idea from AICSS, rebuilt in CSS).
4. **The fields that are still empty shimmer** below the card, so the seller sees where the result will land. Fields the seller already filled stay still: text fields through `:placeholder-shown` (each gets `placeholder=" "`), selects through `:has(option[value=""]:checked)`, radio groups through `:not(:has(:checked))`.
5. **All of it is CSS keyed off the pending button:** `.photo-start:has([aria-disabled="true"])` for the card, and `form:has(.photo-start [aria-disabled="true"])` for the fields. Only `transform` and `opacity` animate (the sweep and shimmer are pseudo-elements moved with `translate`). Under `prefers-reduced-motion` and data saver (`html[data-low-data]`) nothing moves: the status line and the button's words carry it.
6. **Without JavaScript,** there's no pending state, so the browser's own loading indicator is all there is. That's fine.
7. **No fake progress.** No "Matching a category… Checking prices…" steps: it's one request, and the words would claim steps that don't happen.

### 2.3 The filled form

1. **A notice above the form:** "**We filled in {n} fields from your photo.** Check each one before you publish." ({n} is the fields actually filled; "1 field" for one.) Announced and focused, as every form notice is today.
2. **A "Suggested" tag on each filled field's label:** a small pill, pale (`#E1F0F7`) with navy text, inside the `<label>` (or `<legend>`), so it's read with the label. It's words, not colour, so it meets WCAG 1.4.1. Only the fields filled by this press get one (decision 5: a typed field is never filled, so never tagged). The tags live in form state with the values, and are gone once the form is saved or reloaded.
3. **The price hint under the price field,** in the field's hint position and in its `aria-describedby`: "Similar on CampusCart: R180 to R260 (5 listings)." The price box stays empty. No hint with fewer than 3 similar listings (decision 8).
4. **Textbooks:** the title carries the book's title and edition, and the description starts with the module code when the cover or spine shows one. When open Looking For requests match (decision 15), a line under the notice: "{n} students at {campus} are Looking For this." with "See their requests", a link to the board filtered to it (`prefetch={false}`).
5. **The photo's description** (the cover's alt text) is filled only when empty, and tagged like the other fields.

### 2.4 When there's no suggestion

The form always comes back exactly as it was sent, so nothing typed is lost. Each case is a form notice above the form (announced and focused), and the fields are untouched.

| Case | Notice | Why it says what it says |
|---|---|---|
| Couldn't read it: a timeout, a busy service, a reply that failed our check, a refusal or a low-confidence read | "**We couldn't read that photo.** Fill it in yourself below, or try a clearer, closer photo of the item." | The seller can't act on which one, so it doesn't say. |
| A person is the main subject | "**We don't fill in listings from photos of people.** Fill it in yourself below. If a person is in the photo, make sure they're happy to be in it." | The seller can act on it (photograph the item), and it repeats the consent rule. |
| No photo yet | "**Add a photo first.** Choose one above, then press Fill in from my photo." | The button never hides (2.1, item 6). |
| Today's limit reached (decision 12) | "**You've used today's photo fills.** Fill it in yourself below, or try again tomorrow." | The button stays (no disabled controls), drawn as a secondary button (white outline on navy), with a line in the card: "You can still add photos. Filling in from them is back tomorrow." Pressing it again repeats the notice. |

Selling is never blocked: Save works in every case.

## 3. Decisions

### The flow

1. **It's a form post, like the photo buttons.** `saveListingForm` already handles a photo button: it applies the move, keeps everything typed in form state, and redirects back to the form ([listing-actions.ts:184](../../../lib/selling/listing-actions.ts)). The suggest button is one more branch of the same kind: `name="intent" value="suggest"`. No new client component, no Route Handler, no fetch from the browser.
2. **Where the branch sits.** After photos are checked, stripped and stored (so the cover is a stored, metadata-free photo), and after the photo-move branch; before `checkListing`. No one-time token is taken and no listing is made, so a suggest on a new listing can be followed by Save as usual.
3. **Only the cover photo is sent**, shrunk on the server to at most 1024px on the long side (enough to read a cover, about a third of the tokens of 1600px). One photo per call keeps cost and transfer to the minimum.
4. **Edit forms don't offer it** in the first build. A listing being edited already has its words, and a suggestion there would mostly be overwritten fields the seller chose.

### The merge

5. **Typed fields are never overwritten.** A field is filled only when its posted value is empty (after `cleanLine`). Kind is set to "An item" only if unset. The photo description is filled only for the cover, and only when empty. A second press fills only what's still empty.
6. **Suggestions are values, not decisions.** They go into the form state's `values`, the same as typed text, with a `suggested` list of the field names this press filled (for the tags, 2.3). `checkListing` runs on Save exactly as today, with every limit (`TITLE_MAX`, `DESCRIPTION_MAX`, `ALT_MAX`). The model's text is cut to those limits before the merge. Any later post of the form (a photo button, a Save that fails) drops `suggested`, so a tag never outlives the press that filled its field.
7. **Category and condition are closed lists.** The model is given the category slugs and the four conditions as an enum in the output schema, so it can't return anything else. A slug not in `getCategories()` at merge time is dropped.

### The price hint

8. **Prices come only from CampusCart.** `lib/selling/price-hint.ts` reads available and sold listings in the suggested category through `lib/data/catalog.ts`, matches them to the suggested title with browse's `listingMatches` (never a copy of browse's rules), and shows the lowest and highest price of the middle half when 3 or more match. "From" prices and free listings are left out. The seller's own campus first; all campuses when the campus has fewer than 3. The hint is computed at render from the values in form state, so it isn't stored.

### The model call

9. **One provider-neutral, server-only module.** `lib/data/listing-ai.ts` (`import "server-only"`) is the only thing the selling code calls: `readCoverPhoto(photo, categories): Promise<Suggestion | SuggestFailure>`. It owns the instruction, the JSON schema and the output check (decision 10), and hands the provider only an image, an instruction and a schema. Each provider is one small file under `lib/data/listing-ai/` that turns those into one request and returns the reply's raw JSON text, or a failure kind:
   - **`groq.ts`, the first choice.** Groq's `qwen/qwen3.8-27b` on the free tier, through Groq's official SDK (`groq-sdk`), key `GROQ_API_KEY`. The image goes as a base64 data URL in `image_url`. The reply is asked for with `response_format: { type: "json_schema", json_schema: { strict: true, … } }`. Groq documents strict mode for this model, but not with an image in the same request, so the plan's first task tries it on a real photo. If it's refused, the provider asks for `json_object` instead and relies on decision 10.
   - **`anthropic.ts`, the fallback.** Claude Haiku 5.5 (`claude-haiku-5-5`) through `@anthropic-ai/sdk`, key `ANTHROPIC_API_KEY`, structured outputs (`output_config.format`), effort `low`. `stop_reason` is checked before content is read, and a refusal is a quiet failure. About $0.0004 a suggestion (roughly R7 per 1,000).
   - **`fake.ts`** for tests and the demo (decision 13).
   - **Common to all:** keys are read on first use, never at module scope or in a build. 10-second timeout, no retry within a provider (a second provider is the retry, decision 11), typed SDK errors only.
   - **Why Groq first, and why it's swappable:** it costs nothing for the submission's traffic. But Qwen 3.8 is a Groq preview model, which Groq may withdraw (Llama 4 Scout, the vision model before it, was retired on 2026-07-17), and the free tier's limits (about 30 requests a minute, 1,000 a day and 6,000 to 8,000 tokens a minute; each image counts as 2,048 tokens) allow only about 2 or 3 suggestions a minute across the whole site. Changing a provider or a model is a setting, never a change to the selling code.
   - **The instruction and schema are the same for every provider:** the cover image (JPEG, at most 1024px), a short fixed instruction, and the category list. The instruction says not to describe people, not to guess a price, and to write in plain South African English. The schema: `{ title, categorySlug, condition, description, alt, isTextbook, moduleCode | null, edition | null, personIsSubject, confidence: "high" | "medium" | "low" }`, every field required and no others allowed.
10. **Our own output check, whatever the provider promises.** Constrained output can still fail (a Groq community report has about 10% of strict requests answered with `json_validate_failed`), and `json_object` mode promises only JSON. So `checkSuggestion` (`lib/selling/suggest.ts`, pure and unit-tested) parses the text and accepts it only when:
    - every field is present with the right type, and no others;
    - `categorySlug` is one of `getCategories()`' slugs and `condition` one of the four;
    - `confidence` isn't `"low"` and `personIsSubject` is `false`.

    Text is then trimmed with `cleanLine` and cut to the form's limits before the merge. Anything else is a quiet failure: the unchanged form and a notice (2.4), the person notice for `person` and the "couldn't read" notice for every other kind. Failures are logged by provider and kind only (`timeout`, `rate-limited`, `refusal`, `bad-output`, `low-confidence`, `person`, `model-gone`, `api-error`), never the photo or text, like the demo sign-in's logging.

### Limits and switches

11. **The fallback.** `VOSSIE_LISTING_AI_PROVIDERS` lists the providers in order, for example `groq,anthropic`. `readCoverPhoto` tries the first, and moves to the next only when the first couldn't answer: `timeout`, `rate-limited` (Groq's 429), `model-gone` (a 404 or a withdrawn model) or `api-error`. A reply that fails the output check, a refusal or a person in the photo is an answer, so it isn't sent to a second provider (that would cost money and send the photo twice for the same result). A provider without its key is skipped. With only `groq` listed, a busy minute is a quiet failure. **Open question Q6** asks whether Haiku is listed at all.
12. **A daily limit per account.** 10 suggestions in any 24 hours, counted in the store like the message limits (`lib/messaging/limits.ts` is the pattern). The five sample accounts are exempt only in sample mode. Counted once per button press that reaches a provider, whichever answers. It also keeps one account from using up Groq's free daily requests for the whole site.
13. **Tests and the demo never call a provider.** `VOSSIE_LISTING_AI_PROVIDERS=fake` uses `fake.ts` (fixed replies keyed by a fixture photo, including a bad reply and a rate-limited one, so the check and the fallback are tested), so the demo and the e2e tests are deterministic.
14. **The switch.** The button renders only when `VOSSIE_LISTING_AI=1` and at least one listed provider has its key (or is `fake`). Off by default. Turning it off removes the button; nothing else changes.

### Textbooks and Looking For

15. **The Looking For line reads open requests** through `lib/data/requests.ts` with today's `requestOpenOn`, matched to the suggested title and module code, and shows only a count and the seller's campus. It never names or links an asker, as the board never does. It shows only when the count is 1 or more.

## 4. Privacy (POPIA)

- **Opt-in per photo.** Nothing is sent unless the seller presses the button.
- **Hidden data is gone first.** The cover sent is the stored photo, already stripped (`lib/photos/strip-metadata.ts`), and re-encoded at 1024px.
- **People.** The instruction tells the model not to describe people, and a photo whose main subject is a person gets no suggestion (decision 10). Photos of people still need consent, as today.
- **Cross-border transfer (section 72).** The photo leaves South Africa for every provider: Groq stores what it keeps in Google Cloud in the United States, and Anthropic is in the United States too. That needs a lawful ground (each provider's terms as the operator agreement under section 21) and a line on the privacy page naming each listed provider, the purpose, whether API data is used for training, and how long it's kept. **Open question Q3.**
- **Groq's retention.** Groq keeps no inputs or outputs by default, but may keep them for up to 30 days for reliability and abuse checks. Turn on Zero Data Retention in Groq's Data Controls before going live (it's self-serve), so nothing is kept. Groq's data page doesn't say whether inputs are used for training: confirm it in Groq's Services Agreement before the privacy line is written.
- **Groq's terms.** Reported summaries say the terms rule out consumer use and cap Groq's liability at $5,000 for free services. Read the agreement itself before going live (part of Q3).
- **Only listed providers see a photo.** A photo goes to a second provider only when the first couldn't answer (decision 11), never for a second opinion.
- **Nothing new is stored** but the daily count (a number and a time per account), which is in the data download and removed with the account.

## 5. Accessibility

- The button is a real submit button, at least 44px, with a visible label. Nothing is hover-only, and no control is ever disabled (the limit state is a secondary button, 2.4).
- The notice is announced and focused, as form notices are today. While pending, one status line is announced once (2.2); there's no running commentary.
- "Suggested" is a word inside each label, not a colour (WCAG 1.4.1), so a screen reader hears "Title, Suggested".
- Colour on the navy card: white small text, sky only for the solid button (its navy text on sky passes AA), as the brand rules say.
- The sweep and shimmer are decoration (pseudo-elements, no text) and still under reduced motion and data saver.
- The suggested photo description improves the alt text sellers often leave empty. It's an editable field, never applied silently.
- The price hint is text tied to the price field with `aria-describedby`.
- Axe runs on the filled form and on one fallback state.

## 6. Performance

- **No new client component.** Both SDKs are server-only. After `pnpm build`, `grep -lE "groq|anthropic" .next/static/chunks/*.js` must print nothing (one more line beside the existing chunk greps).
- **A fallback adds time only when it's needed.** With Groq answering, a suggestion is fast. When Groq is busy, the 429 comes back at once and Haiku answers in a few seconds; only a Groq timeout costs its full 10 seconds before the fallback starts.
- **The form's JavaScript grows only by `PendingButton`**, an existing component not yet on the listing form (it's on Your listings and a thread). The plan records the new and edit forms' bytes before and after, and keeps each page inside the 150 KB first-visit budget. The edit form doesn't render the button, so it shouldn't change.
- Moving the photo field into the card changes markup order only.
- The reading state is CSS only (2.2), about 30 lines in `app/globals.css` under `.photo-start*`, using brand tokens and the motion rules.

## 7. Files

| File | Change |
|---|---|
| `lib/selling/listing-actions.ts` | The `intent=suggest` branch (decisions 1, 2) |
| `lib/selling/suggest.ts` | New: the merge and `checkSuggestion` (decisions 5 to 7, 10) |
| `lib/selling/price-hint.ts` | New: the price hint (decision 8) |
| `lib/data/listing-ai.ts` | New, server-only: `readCoverPhoto`, the instruction, the schema, the provider order and fallback (decisions 9 to 11) |
| `lib/data/listing-ai/groq.ts` | New, server-only: Groq's `qwen/qwen3.8-27b` (decision 9) |
| `lib/data/listing-ai/anthropic.ts` | New, server-only: Claude Haiku 5.5 (decision 9) |
| `lib/data/listing-ai/fake.ts` | New: fixed replies for tests and the demo (decision 13) |
| `lib/data/listing-ai-limits.ts` | New: the daily count (decision 12), with a Supabase twin |
| `package.json` | `groq-sdk` and `@anthropic-ai/sdk` (server-only) |
| `lib/selling/notices.ts` | The `suggested` notice (with its count) and the four fallback notices: `suggest-failed`, `suggest-person`, `suggest-no-photo`, `suggest-limit` (2.3, 2.4) |
| `components/sell/ListingFormView.tsx` | The photo card on a new listing, the divider, the "Suggested" tags, the price hint, the Looking For line (2.1, 2.3) |
| `components/sell/PhotoStart.tsx` | New, a Server Component: the navy card around `PhotoFieldset`, the button (`PendingButton`), the status line and the limit line (2.1, 2.2, 2.4) |
| `components/forms/*` (`TextField`, `SelectField`, `RadioGroup`) | An optional `tag` beside the label, and `placeholder=" "` on text fields for the shimmer (2.2, 2.3) |
| `app/globals.css` | `.photo-start*`: the card, its two-column `wide:` layout, the sweep, the shimmer, the tag, the reduced-motion and data saver stills (2.1 to 2.3) |
| `app/privacy/page.tsx` | The provider line (section 4) |
| `docs/reference/GO-LIVE.md` | The switch, the key, and the privacy line before turning it on |

## 8. Testing

Risk-guarding only:
- **Unit:**
  - The merge never overwrites a typed field. Text is cut to the form's limits.
  - `checkSuggestion` refuses bad JSON, a missing or extra field, a category or condition not allowed, low confidence and a person.
  - The fallback moves on only for `timeout`, `rate-limited`, `model-gone` and `api-error`, skips a provider without a key, and never sends a refused or bad reply to a second provider.
  - The price hint needs 3 or more matches and leaves out "from" and free.
  - Every failure kind leaves the form unchanged. The limit refuses the 11th call in 24 hours.
- **Once, by hand, with real keys (not in CI):** Groq's strict `json_schema` with an image, on 3 photos (decision 9).
  - Tags show only on the fields this press filled, and a later post drops them (decision 6).
- **End-to-end:** one write test with the fake in `tests/e2e/selling-writes.spec.ts` (photo, suggest, fields filled and tagged, the notice, Save publishes), and axe on the filled form and on the "couldn't read" state.
- **Screenshots** (only with `SCREENSHOTS=1`): the card at 390 and 1440, the filled form, and the four fallback states. The reading state is checked by eye in the plan's review, since it lasts only while a post is pending.
- **Build:** the chunk grep in section 6.

## 9. Go-live

- Off until Lama has answered Q1 to Q3 and Q6, the privacy line is published, Zero Data Retention is on in Groq's Data Controls, and `VOSSIE_LISTING_AI=1`, `VOSSIE_LISTING_AI_PROVIDERS` and the listed providers' keys (`GROQ_API_KEY`, and `ANTHROPIC_API_KEY` if Haiku is listed) are set in Vercel.
- Try it on 20 real Eduvos photos (books, calculators, clothes, a service flyer) on both Groq and Haiku before turning it on, and note how often each field was kept as suggested.
- **Watch Groq.** Check Groq's deprecations page before go-live and then monthly: a withdrawn model fails quietly (or falls back), but it should be swapped in the setting before then. Before real students arrive, read the logs' `rate-limited` count: if busy minutes are common, list Haiku (Q6) or move to Groq's paid tier.

## 10. How we'll know it works

- More first listings finished per new shop, and less time from opening the form to publishing.
- Most suggested titles and categories are kept as suggested.
- More listings have a photo description.

## 11. Not in this stage

- Suggestions on the edit form (decision 4).
- Reading more than the cover photo.
- Plain-language search and the scam check's second opinion (separate ideas).
- Any price set by the model.

## 12. Open questions for Lama

- **Q1. Is Groq's `qwen/qwen3.8-27b` good enough as the first provider?** ⟶ _Lama to decide after the 20-photo test (section 9)._ Lama chose Groq first on 2026-10-26 for its free tier; the test confirms it reads Eduvos photos well enough. If it doesn't, Haiku becomes the first provider (one setting).
- **Q2. Before or after the submission?** ⟶ _Lama to decide._ It's off by default, so it can be built before and turned on after.
- **Q3. Are you happy for photos to leave South Africa** (to Groq in the US, and to Anthropic if Haiku is listed; only when the seller presses the button), and are the providers' terms enough as the operator agreement for the submission, given Groq's reported consumer-use and $5,000 liability clauses? ⟶ _Lama to decide._
- **Q4. The daily limit:** is 10 suggestions per account per day right? ⟶ _Lama to decide._
- **Q5. The textbook Looking For line:** ship it in the first build, or after? ⟶ _Lama to decide._
- **Q6. Is Claude Haiku 5.5 listed as the fallback from the start** (`groq,anthropic`), or only `groq` until busy minutes show up? ⟶ _Lama to decide._ Listing it costs about R7 per 1,000 fallbacks, and only when Groq is busy, down or withdrawn; without it, those presses fail quietly.
