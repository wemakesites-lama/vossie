# CampusCart photo-to-listing: design spec

- **Date:** 2026-10-24
- **Status:** Draft for Lama. Not planned or built. The open questions (section 12) are Lama's to answer before a plan is written.
- **Scope:** a seller adds a photo on the new listing form, presses one button, and the form comes back with a suggested title, category, condition, description and photo description, plus a price hint from similar CampusCart listings. Textbooks also get their module code and, where one exists, a line about open Looking For requests. Nothing is published or priced for the seller.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-14-selling-design.md` | The listing form (2.10), photos (decisions 9 and 11) |
| `docs/superpowers/specs/2026-10-14-community-actions-design.md` | Looking For requests (2.6), used by the textbook line |
| `docs/superpowers/specs/2026-10-20-hardening-design.md` | The message limits, the model for this feature's daily limit |
| `docs/superpowers/specs/2026-10-21-follow-ups-design.md` | The listing forms' recorded JS figures |
| `docs/reference/GO-LIVE.md` | Gains this feature's switch and privacy line (section 9) |

---

## 1. Goal

- Listing an item takes a photo and a check, not a blank form. A marketplace with few listings fails, so making listing easier is the biggest lever there is.
- What's suggested is grounded: the category and condition can only be ones the form offers, and the price hint comes only from real CampusCart listings, never from the model.
- It stands out by knowing the campuses: a textbook's module code, and "students are Looking For this".
- No client JavaScript is added. The form keeps working without JavaScript, and the feature fails quietly into the form as it is today.

## 2. What the seller sees

1. **Photos first on a new listing.** On `/sell/listings/new` the photo field moves to the top of the form, under a short line: "Start with a photo and we'll fill in what we can." The edit form keeps today's order (photos last, [ListingFormView.tsx:200](../../../components/sell/ListingFormView.tsx)).
2. **"Fill in from my photo".** A second submit button in the photo field, shown whenever the feature is on (decision 13). It uses the first photo (the cover). Without JavaScript the server can't know a file has been chosen, so the button is always there; pressed with no photo, the form comes back with "Add a photo first."
3. **The form comes back filled in.** Empty fields get the suggestion; anything the seller typed stays as typed (decision 5). A notice above the form: "We filled in what we could see. Check every field before you publish." Focus lands on the notice, as for every form notice today.
4. **A price hint under the price field, not a price.** "Similar on CampusCart: R150 to R220 (4 listings)." The price field stays empty. No hint when fewer than 3 similar listings exist (decision 8).
5. **Textbooks.** When the photo is a textbook cover, the title carries the book's title and edition, the description starts with the module code if the cover or spine shows one, and, when open Looking For requests match, a line under the notice: "3 students at Pretoria are Looking For this." with a link to the board filtered to it (`prefetch={false}`).
6. **When it can't help.** A timeout, a refusal, a low-confidence read or a photo whose main subject is a person: the form comes back exactly as sent, with "We couldn't read that photo. Fill it in yourself." Selling is never blocked.
7. **When the day's limit is reached.** "You've used today's photo fills. Fill it in yourself, or try again tomorrow." (decision 11).

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

9. **One server-only module.** `lib/data/listing-ai.ts` starts with `import "server-only"`, reads `ANTHROPIC_API_KEY` on first use (never at module scope or in a build), and makes one Messages call:
   - **Input:** the cover image (base64 JPEG), a short fixed instruction, and the category list. The instruction says not to describe people, not to guess a price, and to write in plain South African English.
   - **Output:** structured outputs (`output_config.format`, a JSON schema): `{ title, categorySlug, condition, description, alt, isTextbook, moduleCode | null, edition | null, personIsSubject, confidence: "high" | "medium" | "low" }`.
   - **Effort `low`.** 10-second timeout, one retry on a 429 or 5xx, typed SDK errors only.
   - **`stop_reason` is checked** before content is read; a refusal is a quiet failure (section 2, item 6).
   - **Model:** open question Q1.
10. **Quiet failure is the default.** Any error, `confidence: "low"` or `personIsSubject: true` gives the unchanged form and the "couldn't read" notice. The error is logged by kind only (`timeout`, `refusal`, `low-confidence`, `person`, `api-error`), never the photo or text, like the demo sign-in's logging.

### Limits and switches

11. **A daily limit per account.** 10 suggestions in any 24 hours, counted in the store like the message limits (`lib/messaging/limits.ts` is the pattern). The five sample accounts are exempt only in sample mode. Counted only when a call is made.
12. **Tests and sample mode never call the API.** `listing-ai.ts` has a fake (fixed suggestions keyed by a fixture photo) used whenever `VOSSIE_LISTING_AI` isn't `1` but `VOSSIE_LISTING_AI_FAKE=1` is set, so the demo and the e2e tests are deterministic.
13. **The switch.** The button renders only when `VOSSIE_LISTING_AI=1` and a key is set (or the fake is on). Off by default. Turning it off removes the button; nothing else changes.

### Textbooks and Looking For

14. **The Looking For line reads open requests** through `lib/data/requests.ts` with today's `requestOpenOn`, matched to the suggested title and module code, and shows only a count and the seller's campus. It never names or links an asker, as the board never does. It shows only when the count is 1 or more.

## 4. Privacy (POPIA)

- **Opt-in per photo.** Nothing is sent unless the seller presses the button.
- **Hidden data is gone first.** The cover sent is the stored photo, already stripped (`lib/photos/strip-metadata.ts`), and re-encoded at 1024px.
- **People.** The instruction tells the model not to describe people, and a photo whose main subject is a person gets no suggestion (decision 10). Photos of people still need consent, as today.
- **Cross-border transfer (section 72).** The photo goes to Anthropic outside South Africa. That needs a lawful ground (Anthropic's commercial terms as the operator agreement under section 21) and a line on the privacy page naming the provider, the purpose, that API data isn't used for training, and how long Anthropic keeps it. **Open question Q3.**
- **Nothing new is stored** but the daily count (a number and a time per account), which is in the data download and removed with the account.

## 5. Accessibility

- The button is a real submit button, at least 44px, with a visible label.
- The notice is announced and focused, as form notices are today.
- The suggested photo description improves the alt text sellers often leave empty. It's an editable field, never applied silently.
- The price hint is text tied to the price field with `aria-describedby`.

## 6. Performance

- **No client JavaScript is added.** The Anthropic SDK is server-only. After `pnpm build`, `grep -l "anthropic" .next/static/chunks/*.js` must print nothing (one more line beside the existing chunk greps).
- Moving the photo field to the top changes markup order only. The new listing form's JS stays at its recorded figure.
- The suggest post takes a few seconds. The button shows the form's existing pending state; nothing animates beyond what the form already does.

## 7. Files

| File | Change |
|---|---|
| `lib/selling/listing-actions.ts` | The `intent=suggest` branch (decisions 1, 2) |
| `lib/selling/suggest.ts` | New: the merge (decisions 5 to 7) |
| `lib/selling/price-hint.ts` | New: the price hint (decision 8) |
| `lib/data/listing-ai.ts` | New, server-only: the call and its fake (decisions 9, 10, 12) |
| `lib/data/listing-ai-limits.ts` | New: the daily count (decision 11), with a Supabase twin |
| `lib/selling/notices.ts` | The `suggested`, `suggest-failed` and `suggest-limit` notices |
| `components/sell/ListingFormView.tsx` | Photos first on a new listing, the button, the hint, the Looking For line |
| `app/privacy/page.tsx` | The provider line (section 4) |
| `docs/reference/GO-LIVE.md` | The switch, the key, and the privacy line before turning it on |

## 8. Testing

Risk-guarding only:
- **Unit:** the merge never overwrites a typed field; category and condition are dropped when not allowed; text is cut to the form's limits; the price hint needs 3 or more matches and leaves out "from" and free; every failure kind leaves the form unchanged; the limit refuses the 11th call in 24 hours.
- **End-to-end:** one write test with the fake in `tests/e2e/selling-writes.spec.ts` (photo, suggest, fields filled, Save publishes), and an axe check of the filled form.
- **Build:** the chunk grep in section 6.

## 9. Go-live

- Off until Lama has answered Q1 to Q3, the privacy line is published, and `VOSSIE_LISTING_AI=1` and `ANTHROPIC_API_KEY` are set in Vercel.
- Try it on 20 real Eduvos photos (books, calculators, clothes, a service flyer) before turning it on, and note how often each field was kept as suggested.

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

- **Q1. Which model?** ⟶ _Lama to decide._
  - Claude Opus 5.5: best at reading cover text; about $0.02 to $0.03 per suggestion (roughly 40c to 50c).
  - Claude Haiku 5.5: roughly 1c per suggestion; likely fine for titles and categories, weaker on cover text.
  - Suggestion: try both on the 20 photos in section 9 and pick from that.
- **Q2. Before or after the submission?** ⟶ _Lama to decide._ It's off by default, so it can be built before and turned on after.
- **Q3. Are you happy for photos to leave South Africa** (to Anthropic, only when the seller presses the button), and is Anthropic's commercial terms enough as the operator agreement for the submission? ⟶ _Lama to decide._
- **Q4. The daily limit:** is 10 suggestions per account per day right? ⟶ _Lama to decide._
- **Q5. The textbook Looking For line:** ship it in the first build, or after? ⟶ _Lama to decide._
