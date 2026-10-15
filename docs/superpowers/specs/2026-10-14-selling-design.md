# Vossie selling: design spec

- **Date:** 2026-10-14
- **Status:** Built (2026-10-15), in sample mode. Sections 8 and 9 say where the plan and the build refined it.
- **Approved** under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log.
- **Scope:** stage F, the seller's side:
  - the "Sell on Vossie" pitch;
  - becoming a seller, and waiting for approval;
  - the seller dashboard and my listings;
  - creating and editing listings, with photos;
  - editing the shop.

  It builds on stages D (accounts, the sample store) and E (messages, which feed the dashboard).

## Related documents

| File | What it is |
|---|---|
| `docs/reference/FUNCTION-MAP.md` | G (selling) and the rules in section 6 (shop name 2 to 60 characters and unique per campus, tagline up to 80, title up to 70, photos compressed with location removed, the first photo is the cover) |
| `docs/superpowers/specs/2026-10-13-browse-and-listing-design.md` | The listing model (spec 6.1) that the form fills |
| `docs/superpowers/specs/2026-10-14-accounts-design.md` | Sessions, roles, the sample store |

---

## 1. Goal

A student can apply to sell, the Hub can approve them (stage G), and an approved seller can list, edit, pause, mark sold and delete their listings, with photos, and see how their shop is doing. New listings appear in browse, the listing page, their storefront and collections straight away.

## 2. Decisions

1. **Listings and sellers move into the sample store.**
   - The cached data functions read them from the store, tagged `listings` and `sellers`.
   - Every write calls `updateTag` for those tags, so browse, storefronts and collections show the change on the next request.
   - The fixtures stay as the seed.
   - New listing ids aren't in `generateStaticParams`, so their pages render on first request and are cached from then on.
2. **Every form works without JavaScript.**
   - The onboarding steps, the listing form and the shop form are plain forms posting to Server Actions.
   - Onboarding's step is in the URL (`?step=2`), which holds no personal data.
   - A draft is kept in the store between steps.
3. **Photos have two paths.**
   - **With the app's JavaScript:** a small client component on the listing form shrinks each photo before upload. The longest side becomes 1,600px, it's re-encoded as WebP at quality 0.8, and drawing to a canvas drops the hidden metadata, location included. It also shows previews and lets the seller reorder them and add alt text.
   - **Without JavaScript:** the plain file input uploads the originals. The server strips the metadata itself, on every file, re-encoded or not: it keeps only what a decoder needs (section 8, item 4).
   - That stripper is a small, tested function in `lib/photos/strip-metadata.ts`, so no image library has to be installed.
   - The server accepts JPEG, PNG and WebP up to 5 MB each and up to 6 photos per listing. It checks each file's signature, not just its name.
   - Server Actions' body limit is raised to 32 MB (`serverActions.bodySizeLimit`) for this.
4. **Photos are stored in the sample store and served by a route handler,** `/photos/[id]`, with long cache headers. Supabase Storage replaces both later. `next/image` loads them through the same `Photo` component.
5. **The first photo is the cover;** "Make cover" moves another to the front. Each photo has alt text, defaulting to the title, which the seller can change.
6. **Onboarding has five steps** (the old demo's):
   1. **Basics:** shop name (2 to 60 characters, unique on your campus), tagline (up to 80), main category.
   2. **About:** two or three sentences (up to 600).
   3. **Photo:** a shop photo, or skip and use the category's placeholder.
   4. **Campus and pickup points:** your campus, then the campus's approved points you'll use (at least one).
   5. **Review**, a checkbox "I've read the seller guidelines" (linked), and **Send for approval**.

   Contact details aren't asked for: buyers use in-app messages (stage E, decision 7).
7. **Waiting for approval:** `/sell` shows "The Hub is checking your shop", what happens next, and that they can prepare listings now. Those listings save as drafts, invisible until the shop is approved. The admin approves in stage G. In sample mode, the `pending@eduvos.com` account is the test case.
8. **The dashboard (`/sell`, approved shops):**
   - a status line ("Your shop is live", or "Paused: your listings are off every list");
   - this week's numbers: new enquiries, replied within 48 hours, sales confirmed;
   - the trust badge, and what the next one needs ("2 more confirmed sales for Trusted");
   - quick links: New listing, My listings, Messages (Selling), Edit shop, View your shop;
   - "Pause my shop" and "Resume", a form button.

   No view counts: nothing records views yet.
9. **My listings (`/sell/listings`):**
   - tabs Available, Paused, Sold and Drafts as links;
   - each row: photo, title, price, last updated, and actions: Edit, Pause/Resume, Mark sold, Delete;
   - Delete goes to a confirm page (`/sell/listings/[id]/delete`) with **Delete listing** and **Keep it**. Deleting removes it from the store, and its conversations keep a "listing removed" note.
10. **The listing form** (`/sell/listings/new`, `/sell/listings/[id]/edit`) follows the listing model:
    - kind (an item or a service);
    - title (up to 70);
    - category;
    - condition (items);
    - price, with "This is a starting price" for services;
    - "It's free";
    - payment: cash, swap or both, with "What would you swap for?" when swaps are on;
    - description (up to 1,000);
    - handover, with a pickup point from the shop's points when it's a pickup;
    - photos.

    Errors are listed at the top and next to each field. **Save and publish**, or **Save as draft**.
11. **Editing the shop** (`/sell/profile`) uses the onboarding fields on one page. The shop's link (slug) can be changed once (the old demo's rule), with a warning that old links stop working.
12. **The listing page and storefront recognise the owner.** On their own listing a seller sees **Edit listing** instead of Message, and on their storefront **Edit shop**. Both are read inside `<Suspense>` from the session, with the visitor's version as the fallback.

---

## 3. Screens (summary)

| Route | Who | What |
|---|---|---|
| `/sell` | Signed out or no shop | The pitch: why sell on Vossie, three steps, the fees (none), **Start selling** (sign-in first, then onboarding) |
| `/sell` | Pending | Waiting for approval (decision 7) |
| `/sell` | Approved | The dashboard (decision 8) |
| `/sell/onboarding?step=1…5` | Signed in, no shop or draft | The wizard (decision 6). A progress line "Step 2 of 5", Back and Continue |
| `/sell/listings` | Shop owner | My listings (decision 9) |
| `/sell/listings/new`, `/sell/listings/[id]/edit` | Shop owner | The listing form (decision 10) |
| `/sell/listings/[id]/delete` | Shop owner | Confirm delete |
| `/sell/profile` | Shop owner | Edit shop (decision 11) |
| `/photos/[id]` | Anyone | A stored photo |

All `/sell` pages are `noindex` and render per request inside `<Suspense>`, with `requireAccount`.

## 4. Accessibility

- Every field is labelled, and character counts are text. The error summary links to its fields.
- The photo reorder works with buttons ("Move earlier", "Move later", "Make cover"), not drag only.
- Each step's progress is text.
- Targets are at least 44px.

## 5. Performance

- The pitch, dashboard, lists and wizard add no client code.
- The listing form adds the photo component, only on its two routes. Its budget is measured, and those pages stay under the limit.
- The rest of the site doesn't change.

## 6. Testing

- **Unit:**
  - the store's listing and seller writes and their tags;
  - validation (each field's limits, unique shop name per campus, the pickup point belonging to the campus);
  - the metadata stripper, against fixture bytes for JPEG, PNG and WebP with and without metadata;
  - file signature checks;
  - the dashboard numbers and the badge progress;
  - each component's states.
- **End to end:**
  - apply as a student, then approve (as admin in stage G, or straight in the store for this stage's tests);
  - create a listing with a photo, then find it in browse, on its page and on the storefront;
  - edit, pause, mark sold and delete;
  - the bundle-blocked form path (upload without client code);
  - the owner's view of a listing.
- **Checks:** axe on each page, the JS budget for the listing form, layout shift and screenshots.

## 7. Not in this stage

Stats beyond the dashboard's numbers, view counts, bulk actions, scheduled listings, and paid features (there are none).

## 8. Changes on plan review (2026-10-14)

The plan (`docs/superpowers/plans/2026-10-14-selling.md`) refines these points; where they differ, these win.

1. **No test-only routes.** End-to-end tests apply as a new student (who stays waiting) and use the seeded approved seller (`seller@eduvos.com`, Tech corner) for listing flows, only on each test's own listing. Approval itself arrives in stage G.
2. **Uploads on a real host.** The 32 MB Server Action body works on `next start` but not on many hosts (Vercel's functions take 4.5 MB). Go-live needs direct-to-storage uploads, and the no-JavaScript path then needs its own answer; it's on the go-live checklist.
3. **No resized copies of deleted photos.** The image optimiser's disk cache is off (`images.maximumDiskCacheSize: 0`), so a deleted photo can't keep being served in another size (POPIA).
4. **What the metadata stripper keeps** (changed in the build, plan amendment 8: it keeps a list rather than dropping one, because phones and editors hide data in more places than any list of removals names):
   - JPEG: the frame, table and scan segments, plus APP0's JFIF (its 14-byte core, with no thumbnail), APP2's `ICC_PROFILE` and APP14's `Adobe` (its 12 bytes). Everything else goes: Exif and XMP (APP1), IPTC (APP13, which can hold a location), C2PA content credentials (APP11), JFXX thumbnails, makers' segments and comments;
   - PNG: the image and colour chunks (`IHDR`, `PLTE`, `IDAT`, `IEND`, `tRNS`, `cHRM`, `gAMA`, `iCCP`, `sBIT`, `sRGB`, `cICP`, `mDCV`, `cLLI`, `bKGD`, `pHYs`) and the animation chunks (`acTL`, `fcTL`, `fdAT`). `eXIf`, the text chunks, `tIME`, `caBX` and unknown chunks go;
   - WebP: `VP8X` (its Exif and XMP flags cleared), `VP8 `, `VP8L`, `ALPH`, `ANIM`, `ANMF` and `ICCP`. `EXIF`, `XMP `, `C2PA` and unknown chunks go;
   - in every format: anything after the image's end, such as a phone's appended motion video. A file with no image in it is refused.
5. **The dashboard counts the last 7 days** (not "this week"). Only messages about a listing count as enquiries, as the trust page defines them. Replies show as "3 of 4 within 48 hours".
6. **Sold listings can be relisted,** so a mistaken "Mark sold" can be undone.
7. **Drafts stay drafts after approval:** the seller publishes them one by one.
8. **A paused shop** disappears from every list, but its listing and storefront pages stay up, marked paused, so saved links still work.
9. **The owner on their own paused or sold listing** sees "See similar items", and edits from My listings.
10. **To fix in stage G:** part C's trust page says "Verified means the Hub … approved their shop". Approval (which lets someone sell) and Verified (a badge the Hub gives after checking) are separate, so the trust page's wording changes with stage G.

## 9. Changes in the build (2026-10-15)

The plan's decisions and the build refined these points too; where they differ from sections 2 and 3, these win. The plan's "Changes made during the build" has every change with its commit.

1. **A shop's status stays on its owner's seller profile;** its details are a row of their own. A waiting shop has a link but no storefront until approval; the 28 sample shops no account owns are always open (plan decision 1).
2. **A paused shop keeps its storefront** ("Nothing listed right now") **and its listings' pages,** marked paused; its listings leave every list. It takes no new messages: its storefront says "Not taking orders right now" in Message's place, and the server refuses a first message while replies in existing conversations still go. Its owner still sees Edit shop on the storefront (plan decision 2, amendments 10 and 16).
3. **Listings have one state:** draft, available, paused or sold. Save and publish says Save changes on a paused or sold listing and keeps its state; a sold listing can be relisted; drafts pass the same checks as published listings; a listing is dated once, when it's first published, so a draft round trip doesn't put it back at the top of Just listed (plan decisions 3 and 5, amendment 13).
4. **Photos.** Resized copies aren't kept on the server's disk (plan decision 12), and `/photos/[id]` sends photos as private, so a shared cache in front of the site never keeps one deleted with its listing or account (amendment 12). The photo field is one list of saved and new photos; without the app's JavaScript its buttons post the form; Safari's photos are re-encoded as JPEG (plan decisions 9 and 10). Photos uploaded on a form that hasn't saved are kept for at least a day, the newest 12 per account, and a form's own upload never trims a photo the form names (amendment 13).
5. **The wizard's Back is a link;** step 4 comes back with the new campus's pickup points without client code; Send for approval goes to the first step with a problem; each step has its own page title, so a screen reader hears the step change (plan decision 15).
6. **Shop names and links.** A name is unique on its campus compared without case, accents or punctuation, keeping letters from every script. A waiting shop's link follows its name; the one change of link carries the shop's listings, conversations and reports with it; a link buyers saw is never given to another shop. A new campus moves the shop's listings (plan decisions 16 and 17, amendments 11 and 15).
7. **The dashboard counts the last 7 days,** enquiries about listings only, and "replied within 48 hours" as "3 of 4"; the status line for a paused shop is "Paused: your listings are off every list" (plan decision 18, amendment 14).
8. **Prices** take "R1 200" and "1,200" but a separator only between groups of three, so "R250,00" isn't read as R25,000.
9. **The account page's Selling row** goes to `/sell` (the dashboard or the waiting page), not the storefront (plan decision 21).
10. **The end-to-end tests that change listings run after all others,** as the teardown of a setup project; no test approves a shop (approval is stage G's), so listing flows use the sample seller (plan decision 25).
11. **The listing form's two pages** carry 153,086 B of JS on a first visit at 390px, over the 152,305 B stop line and under the 153,600 B limit. Lama accepted 152,950 B for those two pages only; Task 12's review fixes added 136 B, which Lama may still veto (decision 70). The display font has matched fallbacks, so headings don't rewrap when it loads (decision 71).
