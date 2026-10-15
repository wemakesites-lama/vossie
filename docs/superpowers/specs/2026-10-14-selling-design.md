# Vossie selling: design spec

- **Date:** 2026-10-14
- **Status:** Built (2026-10-15), in sample mode. Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log. Section 8 holds what the plan review and the build changed; it wins over the decisions above.
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
   - **Without JavaScript:** the plain file input uploads the originals. The server strips the metadata itself: it removes JPEG's APP1 Exif and XMP segments, PNG's `eXIf` and text chunks, and WebP's `EXIF` and `XMP ` chunks.
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
   - a status line ("Your shop is live", or "Paused: buyers can't see your listings");
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

## 8. Changes on plan review and build (2026-10-14 to 2026-10-15)

The plan (`docs/superpowers/plans/2026-10-14-selling.md`) and the build refine these points; where they differ, these win. Items 1 to 10 came at plan review; items 11 to 21 came from the plan's decisions and its amendments while building, and the plan's "Changes made during the build" gives each with its commit.

1. **No test-only routes.** End-to-end tests apply as a new student (who stays waiting) and use the seeded approved seller (`seller@eduvos.com`, Tech corner) for listing flows, only on each test's own listing. Approval itself arrives in stage G.
2. **Uploads on a real host.** The 32 MB Server Action body works on `next start` but not on many hosts (Vercel's functions take 4.5 MB). Go-live needs direct-to-storage uploads, and the no-JavaScript path then needs its own answer; it's on the go-live checklist.
3. **No resized copies of deleted photos.** The image optimiser's disk cache is off (`images.maximumDiskCacheSize: 0`), so a deleted photo can't keep being served in another size (POPIA).
4. **The metadata stripper keeps only what the image needs** (selling plan amendment 8): an allowlist for each format, with everything else dropped, so Exif, XMP, IPTC, C2PA, comments and anything unknown go. It keeps:
   - JPEG: the tables (DQT, DHT, DAC), DRI, the frame (SOFn), the scans, DNL and EXP; APP0 only for JFIF, APP2 only for a colour profile (`ICC_PROFILE`), APP14 only for Adobe's. When the Exif held an Orientation other than 1, a minimal APP1 holding only that is written back (no location), so a portrait photo doesn't show sideways;
   - PNG: `IHDR`, `PLTE`, `IDAT`, `IEND`, `tRNS`, `gAMA`, `cHRM`, `sRGB`, `iCCP`, `sBIT`, `cICP`, `mDCV`, `cLLI`, `pHYs`, `bKGD`, `acTL`, `fcTL` and `fdAT`;
   - WebP: `VP8X` (its EXIF and XMP flags cleared), `VP8 `, `VP8L`, `ALPH`, `ICCP`, `ANIM` and `ANMF` (with only each frame's `VP8 `, `VP8L` and `ALPH`);
   - in every format, nothing after the image's end, such as a phone's appended motion video. A file with no image in it is refused.
5. **The dashboard counts the last 7 days** (not "this week"). Only messages about a listing count as enquiries, as the trust page defines them. Replies show as "3 of 4 within 48 hours".
6. **Sold listings can be relisted,** so a mistaken "Mark sold" can be undone.
7. **Drafts stay drafts after approval:** the seller publishes them one by one.
8. **A paused shop** disappears from every list, but its listing and storefront pages stay up, marked paused, so saved links still work.
9. **The owner on their own paused or sold listing** sees "See similar items", and edits from My listings.
10. **To fix in stage G:** part C's trust page says "Verified means the Hub … approved their shop". Approval (which lets someone sell) and Verified (a badge the Hub gives after checking) are separate, so the trust page's wording changes with stage G.
11. **A shop's status stays on its owner's seller profile** (the account's link to its shop), and the shop's details live on a `sellers` row. A waiting shop has a link, made from its name and following it, but no storefront until approval; its drafts have no pages. Sample shops with no owner account are always open (plan decisions 1 and 16).
12. **Listings have one state:** draft, available, paused or sold. Save and publish makes a new listing or a draft available; on a paused or sold listing the button says Save changes and keeps the state; Save as draft always makes a draft. A listing's date is when it was first published and doesn't change if it is saved back as a draft and published again. Drafts pass the same checks as published listings, and a shop waiting for approval can only save drafts (plan decisions 3 to 5; amendment 9.2).
13. **The photo field is one list of saved and new photos.** Without the app's JavaScript its buttons post the form and the server does the work; with it, photos are re-encoded in the browser (WebP; JPEG on Safari, which can't encode WebP), one at a time, and a save waits up to 15 seconds for that, then sends once with the last button pressed (plan decisions 9 and 10; amendments 11 and 13).
14. **Photos are cached on the device only** (`private, max-age=31536000, immutable`) and sent with `nosniff`, so no shared cache or CDN keeps a photo after its listing is deleted. A photo uploaded on a form that hasn't saved yet waits a day, up to 12 per account (amendment 9, items 4 and 5; plan decision 11).
15. **A new listing is made once, however many times its form is sent.** The new-listing form carries a one-time token, good for an hour; a second post with the same token goes where the first went and makes nothing (amendment 14.1).
16. **The wizard's Back is a link;** step 4 comes back with the new campus's pickup points; Send for approval goes to the first step with a problem; a student on Eduvos Online, who has no pickup points, resumes at the review (plan decision 15; amendment 10.4).
17. **The shop's link changes once,** and the change carries the shop's listings, conversations and reports with it. The old link can't be taken by another shop (it stays reserved) and shows the 404, so a saved link never opens someone else's shop; the data export lists previous links. A new campus moves the shop's listings, and a pickup point the new campus doesn't have moves to its first one (plan decisions 16 and 17; amendments 13.7 and 14.2).
18. **Prices are whole rand,** from R1 to R100,000 ("R1 200", "1,200" and "R250,00" are fine; "99,99" is refused). Shop names are compared in any alphabet, without case, accents or punctuation (amendment 8, items 5 and 6).
19. **The dashboard counts only conversations that still have their seller,** so a shop that comes back, or a new shop that reuses a deleted shop's link, doesn't inherit enquiries and sales its owner can't open (amendment 9.1).
20. **The owner's links:** the owner of a listing sees Edit listing on its page, and on their own storefront Edit shop, streamed in from the server with no client code; everyone else sees Message seller (plan decision 19). The account page's Selling row goes to the dashboard (plan decision 21).
21. **Sample-mode limits** (not for go-live): pages Next re-renders after a write are kept on disk while the store is in memory, so restarting `next start` without a rebuild serves an earlier server's pages; a missing storefront answers 200 to a plain request and 404 to a browser's. The hosted preview takes request bodies of 4.5 MB at most, and a photo may not show from another server instance (plan decision 8; amendments 6, 10.9 and 14.4).
