# CampusCart photo-to-listing: design spec

- **Date:** 2026-10-24
- **Status:** Draft for Lama. Not planned or built. Revised 2026-10-26: Groq's `qwen/qwen3.8-27b` (free tier) first, behind a provider-neutral module, with Claude Haiku 5.5 as the fallback (decisions 9 to 13). The open questions (section 12) are Lama's to answer before a plan is written.
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
- No client JavaScript is added. The form keeps working without JavaScript, and the feature fails quietly into the form as it is today.

## 2. What the seller sees

1. **Photos first on a new listing.** On `/sell/listings/new` the photo field moves to the top of the form, under a short line: "Start with a photo and we'll fill in what we can." The edit form keeps today's order (photos last, [ListingFormView.tsx:200](../../../components/sell/ListingFormView.tsx)).
2. **"Fill in from my photo".** A second submit button in the photo field, shown whenever the feature is on (decision 14). It uses the first photo (the cover). Without JavaScript the server can't know a file has been chosen, so the button is always there; pressed with no photo, the form comes back with "Add a photo first."
3. **The form comes back filled in.** Empty fields get the suggestion; anything the seller typed stays as typed (decision 5). A notice above the form: "We filled in what we could see. Check every field before you publish." Focus lands on the notice, as for every form notice today.
4. **A price hint under the price field, not a price.** "Similar on CampusCart: R150 to R220 (4 listings)." The price field stays empty. No hint when fewer than 3 similar listings exist (decision 8).
5. **Textbooks.** When the photo is a textbook cover, the title carries the book's title and edition, the description starts with the module code if the cover or spine shows one, and, when open Looking For requests match, a line under the notice: "3 students at Pretoria are Looking For this." with a link to the board filtered to it (`prefetch={false}`).
6. **When it can't help.** A timeout, a busy service, a reply that fails our check, a refusal, a low-confidence read or a photo whose main subject is a person: the form comes back exactly as sent, with "We couldn't read that photo. Fill it in yourself." Selling is never blocked.
7. **When the day's limit is reached.** "You've used today's photo fills. Fill it in yourself, or try again tomorrow." (decision 12).

## 3. Decisions

### The flow

1. **It's a form post, like the photo buttons.** `saveListingForm` already handles a photo button: it applies the move, keeps everything typed in form state, and redirects back to the form ([listing-actions.ts:184](../../../lib/selling/listing-actions.ts)). The suggest button is one more branch of the same kind: `name="intent" value="suggest"`. No new client component, no Route Handler, no fetch from the browser.
2. **Where the branch sits.** After photos are checked, stripped and stored (so the cover is a stored, metadata-free photo), and after the photo-move branch; before `checkListing`. No one-time token is taken and no listing is made, so a suggest on a new listing can be followed by Save as usual.
3. **Only the cover photo is sent**, shrunk on the server to at most 1024px on the long side (enough to read a cover, about a third of the tokens of 1600px). One photo per call keeps cost and transfer to the minimum.
4. **Edit forms don't offer it** in the first build. A listing being edited already has its words, and a suggestion there would mostly be overwritten fields the seller chose.

### The merge

5. **Typed fields are never overwritten.** A field is filled only when its posted value is empty (after `cleanLine`). Kind is set to "An item" only if unset. The photo description is filled only for the cover, and only when empty. A second press fills only what's still empty.
6. **Suggestions are values, not decisions.** They go into the form state's `values`, the same as typed text. `checkListing` runs on Save exactly as today, with every limit (`TITLE_MAX`, `DESCRIPTION_MAX`, `ALT_MAX`). The model's text is cut to those limits before the merge.
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

    Text is then trimmed with `cleanLine` and cut to the form's limits before the merge. Anything else is a quiet failure: the unchanged form and the "couldn't read" notice. Failures are logged by provider and kind only (`timeout`, `rate-limited`, `refusal`, `bad-output`, `low-confidence`, `person`, `model-gone`, `api-error`), never the photo or text, like the demo sign-in's logging.

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

- The button is a real submit button, at least 44px, with a visible label.
- The notice is announced and focused, as form notices are today.
- The suggested photo description improves the alt text sellers often leave empty. It's an editable field, never applied silently.
- The price hint is text tied to the price field with `aria-describedby`.

## 6. Performance

- **No client JavaScript is added.** Both SDKs are server-only. After `pnpm build`, `grep -lE "groq|anthropic" .next/static/chunks/*.js` must print nothing (one more line beside the existing chunk greps).
- **A fallback adds time only when it's needed.** With Groq answering, a suggestion is fast. When Groq is busy, the 429 comes back at once and Haiku answers in a few seconds; only a Groq timeout costs its full 10 seconds before the fallback starts.
- Moving the photo field to the top changes markup order only. The new listing form's JS stays at its recorded figure.
- The suggest post takes a few seconds. The button shows the form's existing pending state; nothing animates beyond what the form already does.

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
| `lib/selling/notices.ts` | The `suggested`, `suggest-failed` and `suggest-limit` notices |
| `components/sell/ListingFormView.tsx` | Photos first on a new listing, the button, the hint, the Looking For line |
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
- **End-to-end:** one write test with the fake in `tests/e2e/selling-writes.spec.ts` (photo, suggest, fields filled, Save publishes), and an axe check of the filled form.
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
