# Supabase phase C2 (selling) and C3 (messaging): build plan

- **Programme:** `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, step 3 (C2 and C3). **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md`, sections 3 to 8 and the amendments in 12. **Stage specs:** selling (`2026-10-14-selling-design.md`), messaging (`2026-10-14-messaging-design.md`), stage K's message limits (`2026-10-20-hardening.md`).
- **The pattern this follows:** `docs/superpowers/plans/2026-10-21-supabase-step-2b-and-phase-c-foundation.md`. That means its decisions 15 to 22 (the twin pattern, contract tests in two layers, the minted viewer, the "never trust an account id" rule, the shared row mapping), its Tasks 12 to 17b, its amendments and the controller's answers. The committed C0 code is `lib/backend.ts`, `lib/data/supabase/{clients,rows}.ts`, `lib/data/boundaries.test.ts`, `tests/contract/*`, `tests/db/*`, `lib/data/contract/smoke.*` and `vitest.db.config.mts`.
- **Phase B:** `docs/superpowers/plans/2026-10-21-supabase-phase-b-sign-in.md`. It wires `forViewer()`. Its decision 15 leaves `takeFormState` on Supabase to phase C, and its amendments 4, 7, 8 and 10 bear on this plan.
- **Format:** as the foundation plan. Each task is test first and has one writer per file. Implementers never `git add` or `git commit`; the controller commits.
- **Status:** draft for review, 2026-10-21. Nothing is built.

## Goal

After this plan, each selling and messaging module in `lib/data` has a Supabase twin under `lib/data/supabase/`. The twin keeps the module's exported signatures and is picked by `onSupabase()`. The same contract scenarios pass on the sample store (`pnpm test`) and on the local stack (`pnpm test:db`):

- **C2, selling:**
  - `shops.ts`: the owner's shop, applying, Edit shop, the one change of link, Pause and Resume, the wizard's draft and the export;
  - `own-listings.ts`, with the new listing's one-time token taken in the database;
  - `photos.ts`, on Supabase Storage;
  - `/photos/[id]`, served with the admin client, with the right refusals and cache headers;
  - the waiting-photo sweep, as a Vercel Cron Route Handler behind `CRON_SECRET`;
  - photo ids that are uuids;
  - a recommendation, sized, for Vercel's 4.5 MB request body.
- **C3, messaging:**
  - `messages.ts` (conversations, messages, the sale and its 7-day auto-confirm on read);
  - `notifications.ts`;
  - `reports.ts`;
  - `offers.ts` (offers are conversations);
  - the message limits enforced by the database under the sender's lock, with the app's own check kept so its error order doesn't change;
  - message text still React text.

Every write still calls `listingsChanged()` or `sellersChanged()` before `done()` where it does today. The JavaScript budget doesn't move. The one possible exception is Task 10, which waits on Lama.

**Not in this plan:**
- phase B's files: `lib/auth/*`, `lib/data/{accounts,sessions,sign-in,form-states}.ts`, `proxy.ts`. Deleting an account and the data download are phase B's; they call this plan's twins;
- C4 (requests' writes, follows, saved searches, alert matching) and C5 (audit, staff shops, staff reports, mentors, Hub management, staff accounts, numbers, Show again, staff privacy). Where those modules meet this plan's (notifications, photos, offers), "Files shared with other plans" says who does what;
- running the whole app on Supabase. That is step 5. Until then `VOSSIE_BACKEND=supabase` is for the contract tests only.

## Where and safety (from CLAUDE.md, highest priority)

- **Worktree:** `/Users/LamaNkuna/Projects/Vossie-backend`, branch `backend/phases-b-c`. Main's tree (`/Users/LamaNkuna/Projects/Vossie`) is never edited from here.
- **Git:** implementers never `git add` or `git commit`. The controller checks each task, stages files by path and commits with Lama's go-ahead. One git command per tool call.
- **The local stack** (`supabase_*_vossie`, ports 5532x) is shared by every Vossie checkout:
  - `supabase db reset` (local only) is fine, but only when no other session on this branch is running `pnpm test:db` or `supabase test db`. The controller says when;
  - never `--linked`;
  - never stop or kill `supabase start`, `pnpm install`, a build or a migration mid-run;
  - stop only servers this session started, by PID or port.
- **Secrets:** `CRON_SECRET`, the Supabase keys and session tokens never pass through chat or a file in the repo. Lama sets `CRON_SECRET` in Vercel (Production only, as phase B's decision 13). Tests use a value made inside the test process.
- **Other sessions right now:**
  - C1's implementer writes `lib/data/supabase/*`, `tests/contract/*`, `tests/db/*`, `lib/data/contract/*` and some `app/**/page.tsx`;
  - the controller has step 2b's Task 9b uncommitted (`20261021120800_review_fixes_2b.sql`, `32_review_fixes_2b.test.sql`, and edits to tests 06 and 28);
  - the C4/C5 planner is writing `2026-10-21-supabase-phase-c4-c5-community-staff.md`.

  Nothing in this plan starts before C1 is committed (Recheck 2).

## Recheck before starting

Run each as its own command and compare. If anything differs, stop and tell the controller.

1. `git status` in the worktree: clean, on `backend/phases-b-c`. `git log --oneline` includes C1's Tasks 14 to 20 and 17b, and step 2b's Task 9b.
2. **C1's exports this plan imports.** Note the real names and use them in place of this plan's:
   - in `lib/data/supabase/catalog.ts`, the shop-row and listing-row mappers that `catalogSourceFrom` uses. This plan calls them `sellerRowFrom(shop, pointIds, extra)` and `listingRowFrom(listing, photos, sellerSlug)`. If they aren't exported, Task 4 exports them (a one-word change each, with C1's controller told);
   - in `lib/data/supabase/pickup-points.ts`, `pickupPointById(id)`;
   - C1's world verbs (`hideListing`, `pauseShop`, `addRequest`, `notificationsOf`, …) in `tests/contract/world.ts`.
3. **The last migration and pgTAP numbers.** `ls supabase/migrations | tail -3` and `ls supabase/tests | tail -3`.
   - This plan's files are `20261022120000_c2_selling.sql`, `20261022120100_c2_photos.sql` and `20261022120200_c3_messaging.sql`, with pgTAP files `40_c2_selling`, `41_c2_photos` and `42_c3_messaging` (decision 1).
   - If any later file exists, rename this plan's files to follow it, keeping their order.
4. **The latest definition of each function or policy this plan replaces.** The file is the base to copy, never an earlier one:

   | Function, view or policy | Latest definition |
   |---|---|
   | `public.save_listing` | `20261020120500_community_actions.sql:806` |
   | `private.take_once_token` | `20261020120400_staff_tools_actions.sql:85` |
   | `private.slugify` | `20261015120000_actions.sql:210` |
   | `private.shop_slug_in_use`, `private.free_shop_slug` | `20261020120000_widen.sql:242`, `:255` |
   | policy "Owners keep their form states, per session" | `20261015004614_sign_in.sql:84` |
   | policy "Owners read their photos" | `20261015004015_selling.sql:243` |

   Check with `grep -n "function public.<name>\|function private.<name>\|policy \"<name>" supabase/migrations/*.sql`: the last match must be the one listed.
5. **Phase B's state.**
   - Has phase B's Task 4 landed? If it has: `forViewer()` and `getFormState`/`saveFormState` have Supabase versions, and `takeFormState` throws on Supabase (its decision 15).
   - Does phase B's `getFormState` twin return `taken`? Decision 7 needs it. If it doesn't, tell phase B's controller; it's a one-field mapping (`taken ? { taken: true } : {}`).
   - Whether phase B has landed or not, this plan's db tests mock the seam (decision 2).
6. **Counts.** `supabase db reset`, then `supabase test db`: record the count (2,277 plus Task 9b's). `pnpm test` and `pnpm test:db`: record both counts. `pnpm lint` and `pnpm typecheck`: clean.
7. **Read-only facts this plan relies on.** Checked 2026-10-21; check again:
   - `postgres` may select and delete on `storage.objects`: `select has_table_privilege('postgres','storage.objects','select')` is true locally. On the live project it's checked in step 5's dry run (decision 13);
   - `cron.job` has `settle-sales` hourly (the auto-confirm job);
   - the only policy on `public.photos` is "Owners read their photos";
   - no `public` function sweeps photos (`\df public.*photo*` lists only `add_photos` and `add_hub_photo`).
8. **The C4/C5 plan:** read its decisions on `notify`, `notifyFollowers`, `notifySavedSearches`, `offerStatus` and `saveHubPost` against this plan's decisions 17 and 21 and "Files shared with other plans". If the two disagree, the controller settles it before Task 12.
9. `grep -rn "/photos/" tests/e2e`. Decision 11 makes the Hub's waiting covers and unpublished covers staff-only. If an e2e test fetches one signed out, Task 6 changes that test too.

---

## Decisions made in this plan (for Lama to confirm or veto)

**Shared**

1. **File names and numbers.**
   - **Migrations:** `20261022120000_c2_selling.sql`, `20261022120100_c2_photos.sql` and `20261022120200_c3_messaging.sql`.
   - **pgTAP files:** `40_c2_selling`, `41_c2_photos` and `42_c3_messaging`.
   - **Suggested blocks for the other plans** (the controller confirms with each planner):
     - phase B, which still names `32_sign_in_phase_b` though step 2b's Task 9b took 32: 33 to 39, with its migration `20261021130000_sign_in_phase_b.sql` (after 2b's `20261021120800`);
     - C4/C5: 50 to 69, and `20261023120000_c4_c5_reads.sql` (its plan already says so).
   - **No numbering collision:** the timestamps keep the order whoever finishes first.
2. **A viewer id without a round trip.** Decision 20 says a twin never trusts an account id over the session. To enforce it cheaply:
   - `lib/data/supabase/clients.ts` gains `viewerId(): Promise<string>`, which throws "wired by phase B" as `forViewer()` does. Phase B points it at `currentClaims().userId`;
   - a new `lib/data/supabase/viewer.ts` exports `forViewerAs(accountId)`. It awaits `forViewer()` and `viewerId()`, throws on a mismatch, and returns the client. It lives in its own module so that `vi.mock` of `clients.ts` reaches it: a function inside `clients.ts` would call the unmocked `forViewer`;
   - `tests/db/viewer.ts`'s `withViewerSeam` also replaces `viewerId`.

   The alternative, a `whoami()` SQL call on every twin call, was considered and not chosen.
3. **Refusals that only a race can produce become one error class.**
   - `lib/data/refused.ts` is a plain module that imports nothing. It holds `class Refused extends Error { code }` and a helper, `refusalOf(promise)`, which resolves to `{ ok }` or `{ refused: code }` and rethrows anything else.
   - A twin throws `Refused` when the database refuses something the action's own checks normally catch first. Examples: a message limit reached by two posts at once, or a report past the 10th.
   - Exported signatures stay exactly as they are, and the sample never throws it.
   - Actions that can meet one wrap the single data call in `refusalOf` and show their usual form error. `redirect()` stays outside the `try`.
4. **Twins are never cached.** Every C2 and C3 read is the viewer's own, request-time, through `forViewerAs()`. The two exceptions use `forServer()`: `/photos/[id]`'s file lookup and the sweep (the spec's "photo files"). Neither is ever inside `"use cache"`. The public reads they lean on (listings, sellers, requests, pickup points) are C1's cached readers, unchanged.
5. **Cache tags don't change.** Every existing call stays where it is, and the actions' unit tests already pin them:
   - `listingsChanged()`: `saveListingForm`, `changeListingState`, `deleteListingForm`;
   - `sellersChanged()`: `sendForApproval`, `saveShopProfile`, Pause and Resume, and badge changes after a reply or a sale;
   - `requestsChanged()`: `sendOffer`.

   One thing is new: the database does work in the same transaction (followers told, listings moved to the shop's campus, reports following a link), and all of it is already covered by the same tags (`tagListings` carries `sellers`). C1's `catalogSnapshot` is tagged `listings` and `sellers`, so a selling write refreshes it.

**C2, selling**

6. **The owner's shop is read with the viewer client.** `getShopOf` reads three things:
   - `seller_profiles` (status, `shop_id`, `paused_by`, `approved_at`; all granted to the owner);
   - `shops` by id (the owner reads their own in any status);
   - `shop_pickup_points`.

   Three small `security definer` functions cover what RLS rightly hides:
   - `public.my_previous_shop_slugs()`: the owner's old links, oldest first (`shop_previous_slugs` has no API read);
   - `public.shop_name_taken(p_name, p_campus_slug, p_except_slug)`;
   - `public.shop_slug_taken(p_slug)`.

   The two checks must see shops that are waiting, declined or Hub-paused, as the sample's do. Each answers only true or false.

   `updateShop` and `changeShopSlug` stay two calls, as in the sample: `update_shop` with `p_slug` null, then `change_shop_slug`. A refusal only a race can produce (`name-taken`, `slug-taken`, `points-invalid`, `photo-invalid` after the action's checks passed) throws `Refused`. `createShop`'s refusals return null, which the action already turns into `send-failed`.
7. **Reserved links in SQL.** Today `private.slugify('Export')` gives `export`, but `slugify` (`lib/selling/rules.ts:56`) gives `export-shop`, and `/mentor/export` is the CSV. So a waiting shop named "Export" would get a link the app reserves.
   - A new immutable `private.reserved_shop_slugs()` returns `{export}`.
   - `private.slugify` adds `-shop` to a reserved word, as the app does.
   - `private.shop_slug_in_use` counts reserved words as in use.
   - A db test compares the function's array with `RESERVED_SLUGS`, so a new reserved word fails until both have it. CLAUDE.md's line about `RESERVED_SLUGS` gains "and `private.reserved_shop_slugs()`" at merge.
8. **`OwnShop` gains `pausedByHub: boolean`.**
   - The sample sets it from `profile.pausedBy === "staff"`; Supabase from `seller_profiles.paused_by`.
   - `pausedShopNotice` in `lib/selling/listing-actions.ts` reads `owner.pausedByHub` instead of C5's `shopStanding()`, so selling on Supabase never waits on C5.
   - The notice is unchanged, and so are its tests (their fixture gains the field).
9. **The new listing's one-time token is taken in the database.**
   - `take_once_token` knows only `staff-once:` forms. A new `private.take_form_once(p_form)` holds its body, and `take_once_token(p_token)` becomes a wrapper over it, unchanged in behaviour. A new `private.take_listing_token(p_token)` takes `listing-once:<token>`.
   - `save_listing` gains a last argument, `p_once_token text default null`. Adding an argument needs `drop function` and `create`, with the grants stated again; a second overload would make PostgREST's call ambiguous.
   - For a new listing with a token, `save_listing` takes the token after every other check has passed and right before the insert, so a refused save keeps it. It answers `once-expired` or `once-taken` as `save_request` does. With a null token it takes none: the token guards against a double post, not against an attacker.
   - On Supabase:
     - `takeListingToken` (`lib/selling/form-state.ts`) only looks: `getFormState`, then `first` if the row is there and not taken;
     - `ListingSave` gains an optional `onceToken`, which the sample ignores;
     - `saveListingForm` passes it for a new listing;
     - the twin answers null for `once-expired` and `once-taken`, and the action already sends a null to My listings.

   So two posts at once still make one listing; only the second lands on My listings rather than where the first went. That is the same as the sample's "again" before the first has said where it went.
10. **Form states may run 65 minutes, not 60.**
    - The `form_states` policy's `with check` allows `expires_at <= now() + interval '1 hour'`.
    - Listing and staff tokens last exactly an hour from the app's clock (`LISTING_TOKEN_TTL_MS`, `ONCE_TTL_MS`). So an app clock even a millisecond ahead of the database's refuses the insert.
    - The policy is recreated with `interval '65 minutes'`. The hourly sweep still removes every row.

    This touches phase B's table. It is written here because C2 is the first to save a 1-hour state on Supabase; phase B's and C5's controllers are told.

**Photos**

11. **`/photos/[id]` asks the database one question.**
    - A new `public.photo_file(p_photo uuid)` (service role only) returns the file's `path` and `type`, plus who may see it:
      - `owner_only`: the uploader, for a photo of a listing the Hub hid;
      - `hub_only`: true for a Hub cover that is still waiting (`hub-draft`) or is on a post that isn't published;
      - nothing at all: for a waiting photo (a student's, or `hub-draft`) a day old or more.
    - A new `photoFor(id, viewer, now)` in `lib/data/photos.ts` serves the route on both backends. `viewer` is a function, so the route reads the session only when the answer needs it (`getViewer()`, and `canUse(account, "hub")` for Hub staff). Most photos are public and cost no session read.
    - The sample gains the same two Hub rules: the Hub's waiting covers (owner `"hub"`, no use) and covers of unpublished posts go to Hub staff only. That is the step 2 review's M4, in both backends so the contract holds. The Hub editor reaches them through a plain link, as signed-in staff.
    - The response headers don't change: `private, max-age=31536000, immutable` with the real `Content-Type` and `Content-Length`, or 404 with `no-store`.
    - Waiting photos less than a day old stay visible to anyone holding the random address, as in the sample. The listing form's thumbnails go through next/image, and Vercel's optimizer doesn't forward cookies, so an owner-only rule would break them (Open question 3).
12. **Uploads: rows first, then files.**
    - **Rows:** `storePhotos` calls `add_photos(types)` with the viewer client. For the Hub (`ownerId === "hub"`, `HUB_PHOTOS` in `lib/staff/hub-actions.ts:27`) it calls `add_hub_photo(type)` once per file.
    - **Files:** it uploads each file with the admin client to the returned path (`{owner}/{id}` or `hub/{id}`), with `contentType` and `upsert: false`.
    - **If an upload fails,** the twin deletes the rows it just made (admin), removes any of its files already uploaded, and throws. A row never points at a missing file for longer than the request.
    - **Files a call no longer needs:** `removed_paths` from every function that returns them (`add_photos`, `add_hub_photo`, `create_shop`, `update_shop`, `save_onboarding_draft`, `save_listing`, `delete_listing`) goes to `removePhotoFiles(paths)`. It removes 100 at a time, never throws, and logs only the status and the count. Its failures are left to the sweep.
    - **Phase B and C5:** `removePhotoFiles` is exported from `lib/data/supabase/photos.ts` for phase B's `deleteAccountData` (its amendment 7) and C5's Hub post save.
13. **Photo ids.** `isPhotoId` and `photoIdOf` accept both `ph-<uuid>` (the sample's) and a bare lower-case uuid (Supabase's), in both backends. A uuid that matches no row is a 404 in either. The Supabase twin refuses anything but a bare uuid before it reaches the database, since a malformed uuid is a Postgres error, not a miss.
14. **The Hub's photos on Supabase.**
    - `storePhotos("hub", …)` goes through `add_hub_photo`.
    - `photoSrcsOf("hub", null, now)` reads `owner_id is null and use = 'hub-draft'` through a policy that replaces "Owners read their photos": "Owners read their photos, and Hub staff the Hub's". It is one permissive policy, as phase A's rule asks.
    - `attachPhotos("hub", …)` and `deletePhotosUsedBy("hub", …)` do nothing on Supabase, because `save_hub_post` already moves and deletes covers. C5's `saveHubPost` twin passes the paths it returns to `removePhotoFiles`.
    - For any other owner, those two and `deletePhotosOf` throw on Supabase. Only the sample's `shops.ts` and `own-listings.ts` call them, and their twins call the database functions instead.
15. **The sweep is a Vercel Cron Route Handler.**
    - **The route:** `GET /api/cron/photos`. It refuses unless the header is `Authorization: Bearer ${CRON_SECRET}`, which Vercel sends when the project has `CRON_SECRET`.
    - **The check:** compared with `timingSafeEqual` (`lib/cron.ts`). The secret must be at least 32 characters, or the route refuses every call.
    - **Sample mode:** the route answers 404 and touches nothing.
    - **The work:**
      - `public.sweep_waiting_photos()` deletes waiting photos (`use` null) and the Hub's waiting covers (`hub-draft`) that are a day old or more, and returns their paths;
      - `public.orphan_photo_paths(p_limit)` lists files in the `photos` bucket that no row names and that are more than an hour old;
      - both are service role only, and every path goes to `removePhotoFiles`.
    - **The answer:** `{ "rows": n, "files": m }`, `no-store`.
    - **The schedule:** `vercel.json` has `20 3 * * *`, daily at 05:20 SAST. A Hobby team allows only daily cron jobs. Nothing depends on it running hourly: a waiting photo a day old is already refused by `photo_file`, `photo_usable` and `photoSrcsOf`. On a Pro team it may run hourly, as spec section 7 says (Open question 2).
16. **Vercel's 4.5 MB request body (spec open decision 2), recommended and sized.**
    - **Why:** Vercel refuses a body over 4.5 MB before the action runs, and the visitor sees Vercel's error page. `next.config.ts`'s 32 MB can't change that.
    - **The sizes:** in a listing post, the text fields are bounded by `keepTyped` to about 300 KB at the very worst (13 fields and 6 descriptions of up to 4,000 characters). So photos must stay under about 4 MiB (4,194,304 bytes) per post: 4,194,304 + 300,000 < 4,500,000.
    - **The recommendation:**
      - `PHOTO_MAX_MB` goes from 5 to 4, the per-photo rule both modes check. The bucket's 5 MiB stays as the backstop;
      - with JavaScript, the photo field's lazily loaded shrink module re-encodes at quality 0.7, then 0.6, until the post's photos total 4 MiB or less. Six 1,600 px WebPs are usually 1 to 3 MB, so this is rare;
      - without JavaScript, the photo field's help text says to add one photo at a time, and the shop photo's says "up to 4 MB".

      This is a selling-spec amendment, so **Task 10 runs only on Lama's go-ahead**. Without it, Supabase works as it is. No-JavaScript posts of more than one large photo then fail on Vercel, as they would today.

**C3, messaging**

17. **On Supabase, notifications are written only inside database functions.**
    - **Reads become twins:** `getNotifications`, `countNewNotifications`, `markNotificationsRead` (`mark_notifications_read`) and `exportNotifications`.
    - **Writers throw `Refused("written-in-the-database")` on Supabase:** `notify`, `notifyAboutMessage`, `markSaleNotificationsRead`, `markConversationNotificationsRead`, `deleteNotifications`, `deleteNotificationsAbout`, `notifyNewListing` and `notifySearchMatch`. The database already does each of their jobs inside the action that needs it:
      - `tell_other_side` and `notify_message`;
      - `read_sale_notes`;
      - `mark_thread_read`;
      - `forget_account`;
      - `delete_listing`;
      - `tell_followers`, through `private.notify_once_per_day`;
      - `record_search_matches`;
      - the staff and request functions.
    - **`notifyOncePerDay`** is `private.notify_once_per_day` on Supabase. A contract scenario pins it from the outside: two first publishes in a SAST day by a followed shop give the follower one notification with `newListingsText(name, 2)`, linking to the shop. Once that is read, a third publish gives nothing.
18. **The message limits are the database's, and the app keeps its own first look.**
    - **Why both:** stage K's order (the limits after the fields, before the scam words, so a refusal never follows "Check this before you send") needs the app to look before the write. The database's look under the sender's lock (`private.message_limit_error`, `20261020120700_message_limits.sql:67`) is the one that counts.
    - **The first look:** `countConversationsStartedSince` and `countMessagesSentSince` become twins over two new read-only functions, `public.my_conversations_started_since(p_since)` and `public.my_messages_sent_since(p_since)`. They call the same private counters as the lock's check, so both looks count the same way.
    - **The race:** `start_conversation`, `send_message` and `start_offer` refusing with `conversation-rate` or `message-rate` becomes `Refused(code)` in the twin. `sendFirstMessage` and `sendReply` catch it with `refusalOf` and write the same form error as `messageLimitErrors` would. `SendResult` and `startConversation`'s result type don't change.
    - **The sample accounts:** exempt only in sample mode, as today. The database has no exemption (step 2 decision 9), and phase B makes `isSampleAccount()` false on Supabase.
19. **The 7-day auto-confirm on read.**
    - `getInbox`, `getThread` and `exportConversations` call `settle_sales()` (viewer) before they read, as the sample settles on read. The sale functions settle inside `private.sale_row`, and `send_message` settles too.
    - `unreadCounts`, in every signed-in header, makes no write. One read-only call, `public.my_unread_counts()`, returns the four counts. It treats a sale whose 7 days have passed as already settled: it is not a sale to confirm, and its "sale to confirm" notification isn't new. So the header agrees with what the thread shows once opened.
    - The hourly `settle-sales` job stays.
20. **The inbox in a fixed number of queries.**
    - A new `security_invoker` view, `public.my_conversation_tails`, gives each of the reader's conversations its last message (body, side, time) and how many of the other side's messages are unread.
    - `getInbox` reads `my_conversations` by side, this view, and the shops by id through the viewer (the "shops the reader deals with" policy keeps a Hub-paused shop's name and photo). The listings' images and the requests' titles come from C1's cached readers, as in the sample.
    - Without the view, the inbox would fetch every message of every conversation.
21. **Account deletion's paths throw on Supabase.** `forgetShopOf`, `forgetAccountInMessaging`, `deleteReportsBy` and `forgetReportOwner` (and `deletePhotosOf`, decision 14) throw `Refused("forget-account")`, because phase B's `deleteAccountData` runs `forget_account`. `restoreSampleShop` returns false, since phase B's sample mode is off on Supabase.
22. **Reports.**
    - **`createReport` keeps its signature.** `create_report` answers `'created'` with no id, so the twin reads the reporter's newest open report on that target (RLS: their own) and returns its id. `'already-open'` returns that report's id too.
    - **Race refusals:** `'rate-limited'` and `'not-found'` throw `Refused`; `sendReport` catches them as `report-rate` and as a redirect home, as its own checks do.
    - **The other reads are twins:** `hasOpenReport`, `countReportsSince`, `listReportsBy` and `exportReports`, through the viewer.
23. **Offers.**
    - **`startOffer`** calls `start_offer`. It ignores `askerId`: the database reads the asker, whom no API role can see.
    - **Refusals** throw `Refused(code)`. C4's `sendOffer` (`lib/looking-for/actions.ts`, C4's file) may catch `offer-rate` and `message-rate` with `refusalOf`; until it does, a race shows the error page.
    - **The reads:** `findOffer`, `offersForRequest` and `countOffersSince` read `my_conversations`, plus the first seller message and the shop by id.
    - **Sample only:** the synchronous `offerRow` and `offerThreadCount`. C1's request cards count offers in SQL.
24. **Message text stays React text.** Twins return `body` and `swap_offer` exactly as stored, never HTML, and nothing makes links. A contract scenario sends `"<b>hi</b>\nhttps://example.test"` and reads back the same string in the thread and the export. The thread's component tests are unchanged.

## Missing SQL found (and where this plan adds it)

| What's missing | Why it matters | Added in |
|---|---|---|
| `save_listing` takes no one-time token; `take_once_token` knows only `staff-once:` forms | the new listing's double-post guard (selling amendment 14.1) can't be atomic on Supabase | Task 1: `private.take_form_once`, `private.take_listing_token`, `save_listing(…, p_once_token)` |
| `private.slugify` and `shop_slug_in_use` don't know `RESERVED_SLUGS` | "Export" gets `export` in SQL, `export-shop` in the app | Task 1: `private.reserved_shop_slugs()` |
| No API read of `shop_previous_slugs` | the export's `previousLinks` and the owner's `previousSlugs` | Task 1: `public.my_previous_shop_slugs()` |
| Name and link checks can't see waiting, declined or Hub-paused shops through RLS | `isShopNameTaken`, `isSlugTaken` | Task 1: `public.shop_name_taken`, `public.shop_slug_taken` |
| `form_states` caps expiry at exactly 1 hour | 1-hour tokens fail on any clock skew | Task 1: the policy at 65 minutes |
| No function says who may see a photo | `/photos/[id]` must refuse hidden listings' photos, waiting and unpublished Hub covers, and stale waiting photos | Task 2: `public.photo_file` |
| Hub staff can't read the Hub's waiting photos | `photoSrcsOf("hub", null)` | Task 2: the photos policy |
| No sweep of waiting photos or orphan files | spec section 7; phase B's amendment 7 relies on it | Task 2: `public.sweep_waiting_photos`, `public.orphan_photo_paths` |
| No read-only message counts for the viewer | the app's first look at the limits (decision 18) | Task 3: `public.my_conversations_started_since`, `public.my_messages_sent_since` |
| No unread counts in one call | the header on every signed-in page | Task 3: `public.my_unread_counts` |
| No per-conversation last message and unread count | the inbox | Task 3: view `public.my_conversation_tails` |
| `create_report` returns no id | `createReport`'s `Promise<string>` | none: the twin reads it back (decision 22) |

## Open questions for Lama

1. **Photos without JavaScript (spec open decision 2; decision 16).** Lower each photo to 4 MB, keep each post's photos to 4 MB with JavaScript by shrinking harder, and say "one photo at a time" without it? (Recommended: yes; Task 10.)
2. **Is the Vercel team on Hobby or Pro?** Hobby runs cron jobs at most once a day, so the sweep is daily (decision 15). Pro allows hourly, as spec section 7 says. (Recommended: daily either way. Nothing is served or used after a day, so the sweep only frees storage.)
3. **Waiting photos.** In the sample, anyone holding a waiting photo's random address can see it for its one day; the listing form's thumbnails rely on that, because Vercel's image optimizer sends no cookies. Keep that on Supabase? (Recommended: keep. Owner-only would need the thumbnails unoptimised, which adds bytes.)
4. **The Hub's covers in sample mode (decision 11).** Should waiting and unpublished covers become Hub-staff-only in sample mode too, so both backends behave the same? (Recommended: yes.)
5. **`CRON_SECRET`.** Lama makes one (at least 32 random characters, for example `openssl rand -hex 32` in their own terminal) and sets it in Vercel → Settings → Environment Variables, Production only. Never in chat or the repo.

---

## Order, and files each task writes

| Task | Writes | After |
|---|---|---|
| 0 Baseline | nothing | |
| 1 Selling SQL | `supabase/migrations/20261022120000_c2_selling.sql`, `supabase/tests/40_c2_selling.test.sql`, `supabase/tests/06_account_actions.test.sql` (allowlists) | 0 |
| 2 Photos SQL | `…20261022120100_c2_photos.sql`, `41_c2_photos.test.sql`, `06_account_actions.test.sql` | 1 (for `06`) |
| 3 Messaging SQL | `…20261022120200_c3_messaging.sql`, `42_c3_messaging.test.sql`, `06_account_actions.test.sql` | 2 (for `06`) |
| 4 Types, seam, world | `lib/supabase/database.types.ts` (regenerated), `lib/data/supabase/clients.ts`, new `lib/data/supabase/viewer.ts`, `tests/db/viewer.ts`, `tests/db/accounts.ts`, `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`, new `lib/data/refused.ts` (+ test), C1's two mapper exports if missing | 3 |
| 5 Photos data | `lib/data/photos.ts` (+ test), new `lib/data/supabase/photos.ts`, `lib/data/contract/photos.*`, world verbs | 4 |
| 6 `/photos/[id]` | `app/photos/[id]/route.ts`, `route.test.ts`, new `route.db.test.ts` | 5 |
| 7 Sweep | new `app/api/cron/photos/route.ts` (+ `route.test.ts`, `route.db.test.ts`), new `lib/cron.ts` (+ test), new `vercel.json` (+ `lib/cron-config.test.ts`), `.env.example` | 5 |
| 8 Shops and drafts | `lib/data/shops.ts` (+ test), new `lib/data/supabase/shops.ts`, `lib/selling/listing-actions.ts` (+ test; `pausedShopNotice` only), `lib/selling/owner.ts`, `lib/data/contract/shops.*`, world verbs | 5 |
| 9 Own listings and the token | `lib/data/own-listings.ts` (+ test), new `lib/data/supabase/own-listings.ts`, `lib/selling/form-state.ts` (+ test), `lib/selling/listing-actions.ts` (+ test; the token line), `lib/data/contract/own-listings.*`, world verbs | 8 |
| 10 Photo size (Lama's go-ahead) | `lib/photos/rules.ts`, `lib/photos/shrink.ts` (+ test), `components/sell/PhotoField*.tsx` (+ test), `components/sell/PhotoFieldset.tsx`, `components/sell/ShopFields.tsx`, `lib/selling/errors.ts` (+ test) | 9 |
| 11 C2 check and review | the ledger only | 6 to 9 (and 10 if run) |
| 12 Notifications | `lib/data/notifications.ts` (+ test), new `lib/data/supabase/notifications.ts`, `lib/data/contract/notifications.*`, world verbs | 11 |
| 13 Reports | `lib/data/reports.ts` (+ test), new `lib/data/supabase/reports.ts`, `lib/messaging/actions.ts` (+ test; `sendReport` only), `lib/data/contract/reports.*` | 12 |
| 14 Messages: reads and the settle | `lib/data/messages.ts` (+ test), new `lib/data/supabase/messages.ts`, `lib/data/contract/messages-read.*`, world verbs | 12 |
| 15 Messages: writes and limits | `lib/data/messages.ts`, `lib/data/supabase/messages.ts`, `lib/messaging/actions.ts` (+ test), `lib/data/contract/messages-write.*`, `lib/data/contract/limits.*` | 13, 14 |
| 16 Offers | `lib/data/offers.ts` (+ test), new `lib/data/supabase/offers.ts`, `lib/data/messages.ts` (`startOffer`'s switch line), `lib/data/supabase/messages.ts`, `lib/data/contract/offers.*` | 15 |
| 17 C3 check, JS budget, docs | this plan, the programme plan | 12 to 16 |

- Tasks 1, 2 and 3 each write their own migration and pgTAP file, and all three add lines to `06_account_actions.test.sql`. They run one after another (each is small), never side by side.
- Tasks 6, 7 and 8 may run side by side after 5. Each adds world verbs, so the controller merges `tests/contract/world.ts`, `sample-world.ts` and `supabase-world.ts`, or runs them in order (the foundation plan's Task 13 note).
- `lib/selling/listing-actions.ts` is written by 8, then 9.
- `lib/messaging/actions.ts` is written by 13, then 15.
- `lib/data/messages.ts` and `lib/data/supabase/messages.ts` are written by 14, 15 and 16, in that order.

## Files shared with other plans

| File | Who else writes it | Rule |
|---|---|---|
| `lib/data/supabase/clients.ts`, `tests/db/viewer.ts` | phase B (wires `forViewer`, and `viewerId` from decision 2); C4/C5 (use `forViewerAs`) | Task 4 adds `viewerId()` and the seam; whoever lands second rebases. Phase B's controller is told the new name |
| `lib/data/supabase/viewer.ts`, `lib/data/refused.ts` | C4/C5 use them | Made in Task 4; C4/C5 import, never copy |
| `tests/contract/world.ts`, `sample-world.ts`, `tests/db/supabase-world.ts`, `tests/db/accounts.ts` | C1 (now), C4/C5 | Verbs added test first, merged by the controller. `WORLD_ACCOUNTS` gains `"seller"` here; four sessions a run stays far under Auth's 30 per 5 minutes |
| `lib/supabase/database.types.ts` | every plan with a migration | Regenerated (`pnpm db:types`), never merged by hand |
| `supabase/tests/06_account_actions.test.sql` | phase B, C4/C5 | Allowlists only; one writer at a time |
| `lib/data/supabase/catalog.ts`, `pickup-points.ts` | C1 | This plan imports their mappers; adding an `export` is the only edit |
| `lib/data/notifications.ts` | C4 (`notifyNewListing`, `notifySearchMatch`, `deleteNotificationsAbout` callers), C5 (`notify` callers) | Decision 17: on Supabase their twins write in SQL and never call the TypeScript writers, which throw |
| `lib/data/follows.ts` (`notifyFollowers`), `lib/data/saved-searches.ts` (`notifySavedSearches`) | C4 | `save_listing` already tells followers. C4's `notifyFollowers` twin does nothing; `notifySavedSearches` calls `record_search_matches` (admin). `saveListingForm`'s calls stay as they are |
| `lib/data/staff-shops.ts` (`shopStanding`, `resendForApproval`) | C5 | Decision 8 removes selling's use of `shopStanding`. `sendForApprovalAgain` still calls `resendForApproval`, whose twin (`resend_for_approval`, a seller's own action) is C5's |
| `lib/staff/hub-actions.ts`, `lib/data/hub-posts.ts` | C5 | Decision 14: C2 gives the Hub's `storePhotos` and `photoSrcsOf`. C5's `saveHubPost` twin hands `save_hub_post`'s removed paths to `removePhotoFiles` |
| `lib/looking-for/actions.ts`, `lib/looking-for/subjects.ts` | C4 | Decision 23: `startOffer`'s twin ignores `askerId` and throws `Refused` on a race. C4 decides how `offerStatus` learns "own request" without `asker_id` (`my_requests`) |
| `lib/data/form-states.ts` | phase B | Its `getFormState` twin returns `taken` (Recheck 5); `takeFormState`'s listing caller is gone on Supabase (decision 9). C5 replaces `lib/staff/once.ts`'s use the same way, with `take_once_token` unchanged |
| `lib/data/accounts.ts` | phase B | `deleteAccountData` imports `removePhotoFiles`; `exportAccountData` calls this plan's export twins |
| `.env.example` | phase B's Task 10 | Task 7 adds `CRON_SECRET` with a comment; keep both sides |
| `vercel.json` (new) | phase B's runbook, step 5 (`regions: ["dub1"]`, spec decision 3) | Task 7 creates it with `crons` only; the other key is added beside it |
| `proxy.ts` | phase B | No change. Phase B's matcher covers every Route Handler on purpose, and the proxy returns at once without a `vossie_auth` cookie, which a Vercel Cron call never has |
| `CLAUDE.md`, `GO-LIVE.md`, `docs/PROGRESS.md` | main's sessions | Lines prepared in Task 17, written on main at merge time |

## Shared commands

- **SQL tasks:** `supabase db reset` (local), then `supabase test db`. Run a single file with `supabase test db supabase/tests/<file>`. Then `supabase db lint` and `supabase db advisors --local --type all`: nothing new at warn or error. Each user action's comment says "A user action (advisor 0029 lists it on purpose)", as phase A's do.
- **TypeScript tasks:** `pnpm lint`, `pnpm typecheck`, `pnpm test`; then, after a fresh `supabase db reset`, `pnpm test:db`. Single files: `pnpm vitest run <path>`, `pnpm vitest run --config vitest.db.config.mts <path>`.
- **The wording rule (step 2's):** every sentence SQL builds is pinned by the same literal string in pgTAP and in a Vitest case. This plan adds no new sentence; it only reuses existing ones.
- **Contract files** follow the foundation's layout:
  - `lib/data/contract/<area>.contract.ts` exports `<area>Contract(makeWorld)`;
  - `<area>.test.ts` runs it on `sampleWorld`;
  - `<area>.db.test.ts` runs it on `supabaseWorld`, with `vi.mock("@/lib/data/supabase/clients", …withViewerSeam…)`, and adds db-only cases (refusals, files in Storage, account-id mismatches).

---

## Task 0: Baseline

1. Run "Recheck before starting", items 1 to 9.
2. Record in the ledger: HEAD, pgTAP, unit and db counts, and the real names from Recheck 2.

## Task 1: Selling SQL (decisions 6, 7, 9, 10)

**Files:** `supabase/migrations/20261022120000_c2_selling.sql`, `supabase/tests/40_c2_selling.test.sql`, `supabase/tests/06_account_actions.test.sql`.

**Failing test first:** `40_c2_selling.test.sql`, about 45 tests. Accounts are `pg_temp` ones signed in as test 18 does.
- **Reserved links:**
  - `private.reserved_shop_slugs()` is `{export}`;
  - `private.slugify('Export')` is `export-shop`, `slugify('Ex')` is `ex-shop` and `slugify('!!')` is `shop`, as before;
  - `private.shop_slug_in_use('export', null)` is true;
  - `create_shop` named "Export" gets `export-shop`;
  - `change_shop_slug('export')` answers `taken`.
- **`shop_name_taken`:**
  - true for another campus shop's name in any case and punctuation (`'CROCHET  corner!'`), including a waiting, a declined and a Hub-paused shop's;
  - false on another campus;
  - false with `p_except_slug` set to that shop's link;
  - anon can't execute it; authenticated can.
- **`shop_slug_taken`:**
  - true for a current link, an old link kept after `change_shop_slug`, and `export`;
  - false for a free one;
  - anon can't execute it.
- **`my_previous_shop_slugs`:**
  - the owner sees `{old}` after a change;
  - another account sees `{}`;
  - a shop that never changed gives `{}`;
  - anon can't execute it.
- **The listing token:**
  - a `form_states` row `listing-once:<uuid>` for the signed-in session: a new `save_listing(…, p_once_token)` answers `saved`, and the row is now `taken`;
  - the same token again answers `once-taken` and makes no listing (with `p_photos '[]'`: a repeat naming the first save's photos meets `photos-invalid` first, since they are now the listing's);
  - a token of another session, or an expired one, answers `once-expired`;
  - a refused save (`pickup-invalid`, `photos-invalid`) leaves the token free;
  - an edit (`p_listing_id` set) ignores the token;
  - `p_once_token` null makes the listing and takes nothing.
- **`take_once_token` behaves as before:**
  - `staff-once:` rows give `first`, then `again`; a missing row gives `none`;
  - `listing-once:` rows are never taken by it;
  - test 17's cases still pass, unchanged.
- **The `form_states` policy:**
  - a row expiring at `now() + interval '64 minutes'` is accepted;
  - one at `now() + interval '66 minutes'` is refused.
- **The old signature has gone:** `save_listing` has exactly one signature in `pg_proc`, with 15 arguments.
- **`06_account_actions`:** the authenticated list gains `shop_name_taken(text,text,text)`, `shop_slug_taken(text)`, `my_previous_shop_slugs()`, and `save_listing` with its new signature. The private list gains `take_form_once(text)` and `take_listing_token(text)`, revoked from every API role.

**Implementation** (the header cites decisions 6, 7, 9 and 10, `lib/selling/rules.ts:30` and `:56`, `lib/selling/form-state.ts`, and phase B's decision 15):

```sql
-- RESERVED_SLUGS (lib/selling/rules.ts:30): words a fixed route uses beside a shop's link. Add a word here and there
-- together; a db test compares them.
create function private.reserved_shop_slugs() returns text[] language sql immutable set search_path = '' as $$
  select array['export']::text[];
$$;

create or replace function private.slugify(name text) returns text language sql immutable strict set search_path = '' as $$
  select case
    when char_length(s) >= 3 and not (s = any (private.reserved_shop_slugs())) then s
    when s <> '' then s || '-shop'
    else 'shop'
  end
  from (select regexp_replace(left(regexp_replace(regexp_replace(private.name_key(name), '[^a-z0-9]+', '-', 'g'),
    '^-+', ''), 40), '-+$', '') as s) x;
$$;

create or replace function private.shop_slug_in_use(link text, own uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select link = any (private.reserved_shop_slugs())
    or exists (select 1 from public.shops s where s.slug = link and s.id is distinct from own)
    or exists (select 1 from public.shop_previous_slugs p where p.slug = link);
$$;

-- isShopNameTaken (lib/data/shops.ts:29): true or false only; sees shops RLS hides.
create function public.shop_name_taken(p_name text, p_campus_slug text, p_except_slug text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shops s where s.campus_slug = p_campus_slug
    and s.name_key = private.name_key(coalesce(p_name, '')) and s.slug is distinct from p_except_slug);
$$;
-- isSlugTaken (shops.ts:48).
create function public.shop_slug_taken(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$ select private.shop_slug_in_use(p_slug, null); $$;
-- The owner's old links, oldest first (SellerRow.previousSlugs; ShopExport.previousLinks).
create function public.my_previous_shop_slugs() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.slug order by p.created_at, p.slug), '{}')
  from public.shop_previous_slugs p where p.shop_id = private.shop_of((select auth.uid()));
$$;

-- take_once_token's body, for any form name: 'first', 'again' or 'none'.
create function private.take_form_once(p_form text) returns text language plpgsql volatile set search_path = '' as $$
  … the body of take_once_token (20261020120400_staff_tools_actions.sql:85), with f.form = p_form …
$$;
create or replace function private.take_once_token(p_token text) returns text … as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return 'none'; end if;
  return private.take_form_once('staff-once:' || p_token);
end; $$;
create function private.take_listing_token(p_token text) returns text … -- the same, with 'listing-once:'
```

- **The new `save_listing`:**
  - `drop function public.save_listing(text, text, text, text, text, integer, boolean, text, text, text, text, uuid, jsonb, boolean);`
  - then `create function public.save_listing(…, p_publish boolean, p_once_token text default null)`, the latest body (`community_actions.sql:806`) copied word for word, with `token text;` added to its `declare` list and one block added after the photos check and before `new_state`:

    ```sql
    if existing.id is null and p_once_token is not null then
      token := private.take_listing_token(p_once_token);
      if token = 'none' then return '{"result": "once-expired"}'::jsonb;
      elsif token = 'again' then return '{"result": "once-taken"}'::jsonb; end if;
    end if;
    ```
  - its grants stated again: `revoke all … from public, anon; grant execute … to authenticated, service_role`.
- **The `form_states` policy:** `drop policy "Owners keep their form states, per session"`, then created again word for word, with `interval '65 minutes'` and a comment citing decision 10.
- **Grants:** the new `public` functions are executable by `authenticated` and `service_role` only. The private ones are revoked from `public, anon, authenticated, service_role`; only the definer functions call them.

**Commands:** `supabase db reset`, then `supabase test db` (all pass, test 17 included), `supabase db lint`, and the advisors.

## Task 2: Photos SQL (decisions 11, 14, 15)

**Files:** `supabase/migrations/20261022120100_c2_photos.sql`, `supabase/tests/41_c2_photos.test.sql`, `supabase/tests/06_account_actions.test.sql`.

**Failing test first:** `41_c2_photos.test.sql`, about 35 tests. Photos and `storage.objects` rows are inserted as `postgres`.
- **`photo_file(id)`:**
  - **unknown id:** no row;
  - **waiting student photo:**
    - 1 hour old: a row with `owner_only` null and `hub_only` false;
    - 25 hours old: no row;
  - **a listing's photo:**
    - published: anyone;
    - hidden by the Hub: `owner_only` is the uploader;
    - shown again: anyone;
    - a draft's photo: anyone (decision 11, parity);
  - **a Hub cover:**
    - `hub-draft`, 1 hour old: `hub_only` true;
    - `hub-draft`, 25 hours old: no row;
    - on a published post: anyone;
    - on an unpublished post: `hub_only`;
  - **`shop` and `draft`:** anyone;
  - **grants:** only `service_role` may execute it.
- **The photos policy:**
  - a student reads their own photos and none of anyone else's;
  - a mentor (`hub` area) reads the Hub's photos;
  - a student can't read the Hub's photos;
  - there is exactly one select policy on `public.photos`.
- **`sweep_waiting_photos()`:**
  - removes a 25-hour-old waiting photo and a 25-hour-old `hub-draft`, and returns their paths, sorted;
  - keeps a fresh waiting photo, a `draft`, a `shop` and a listing's photo, however old;
  - a second call returns `{}`;
  - an onboarding draft's photo (use `draft`) is kept however old: `save_onboarding_draft` gives a draft's photo that use, so the sweep never meets a draft's photo;
  - service role only.
- **`orphan_photo_paths(p_limit)`:**
  - lists a `storage.objects` row in bucket `photos` that no photo names and that is 2 hours old;
  - leaves out one 10 minutes old, one a photo names, and one in another bucket;
  - `p_limit` is capped at 1,000 and at least 1;
  - service role only.
- **`06_account_actions`:** the service-role-only list gains the three.

**Implementation:**

```sql
-- Who may see a photo (/photos/[id]; lib/data/photos.ts photoFor). One row, or none for a photo that isn't there or a
-- waiting one a day old (amendment 9.5). owner_only: a photo of a listing the Hub hid goes to its uploader only (staff
-- tools amendment 13.5). hub_only: the Hub's waiting covers and covers of unpublished posts (step 2 review M4).
create function public.photo_file(p_photo uuid)
returns table (path text, type text, owner_only uuid, hub_only boolean)
language sql stable security definer set search_path = '' as $$
  select p.path, p.type,
    case when p.use like 'listing:%' and exists (
      select 1 from public.listings l where l.id = substr(p.use, 9) and l.hidden_at is not null
    ) then p.owner_id end,
    p.use = 'hub-draft' or (p.use like 'post:%' and not exists (
      select 1 from public.hub_posts h where h.id = substr(p.use, 6) and h.published
    ))
  from public.photos p
  where p.id = p_photo
    and not ((p.use is null or p.use = 'hub-draft') and p.created_at <= now() - interval '24 hours');
$$;

drop policy "Owners read their photos" on public.photos;
create policy "Owners read their photos, and Hub staff the Hub's" on public.photos for select to authenticated
using (owner_id = (select auth.uid()) or (owner_id is null and (select private.is_staff('hub'))));

-- The sweep's rows (spec section 7): waiting photos and the Hub's waiting covers a day old. Their files' paths, sorted.
create function public.sweep_waiting_photos() returns text[] language sql volatile security definer set search_path = '' as $$
  with gone as (
    delete from public.photos p
    where (p.use is null or p.use = 'hub-draft') and p.created_at <= now() - interval '24 hours'
    returning p.path
  )
  select coalesce(array_agg(path order by path), '{}') from gone;
$$;

-- Files no photo row names, more than an hour old (a removal that failed: forget_account, a replaced photo). The
-- caller removes them through the Storage API; SQL never deletes storage.objects.
create function public.orphan_photo_paths(p_limit int default 1000) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.name order by o.name), '{}') from (
    select o.name from storage.objects o
    where o.bucket_id = 'photos' and o.created_at <= now() - interval '1 hour'
      and not exists (select 1 from public.photos p where p.path = o.name)
    order by o.name
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
  ) o;
$$;
```

Each is granted to `service_role` only: `revoke all on function … from public, anon, authenticated;` then `grant execute … to service_role;` (Supabase's default privileges give every new function to `anon` and `authenticated`, so the revoke must be written). The header says the order of every upload is rows first, then files (decision 12), so an orphan is only ever a file whose row has gone.

**Commands:** as Task 1.

## Task 3: Messaging SQL (decisions 18, 19, 20)

**Files:** `supabase/migrations/20261022120200_c3_messaging.sql`, `supabase/tests/42_c3_messaging.test.sql`, `supabase/tests/06_account_actions.test.sql`.

**Failing test first:** `42_c3_messaging.test.sql`, about 35 tests, with a buyer, a seller with a shop, and a third account.
- **`my_conversations_started_since(p_since)`:**
  - counts the caller's enquiries and questions after `p_since`, never offers;
  - equals `private.conversations_started_since(caller, p_since)` in 3 cases;
  - a caller with none gets 0;
  - anon can't execute it.
- **`my_messages_sent_since(p_since)`:**
  - counts the buyer's own messages and the seller's messages in their shop's conversations, including an offer's first message;
  - leaves out a conversation whose seller has gone;
  - equals `private.messages_sent_since`.
- **Neither takes the sender's lock:** checked through `pg_locks` from inside a wrapper, as test 17 checks `remove_role`'s, and none is held.
- **`my_unread_counts()`:**
  - **messages and conversations:** with 3 unread messages in one conversation and 1 in another, `messages` is 4 and `conversations` is 2; the caller's own unread messages don't count;
  - **sales to confirm:**
    - the buyer's `done` sale completed 1 day ago counts 1;
    - one completed 8 days ago counts 0, and its unread `sale-to-confirm` notification doesn't count;
    - the seller's own `done` sale isn't theirs to confirm;
  - **notifications:** the caller's unread ones, others' never;
  - **anon** can't execute it.
- **`my_conversation_tails`:**
  - one row per conversation the reader is in;
  - `last_body`, `last_side` and `last_sent_at` are the newest message's;
  - `unread` counts the other side's unread messages only;
  - a stranger sees no rows;
  - `security_invoker=true` is in `pg_class.reloptions`;
  - select is granted to authenticated and service_role only.
- **`06_account_actions`:** the authenticated list gains the three functions.

**Implementation:**

```sql
-- countConversationsStartedSince and countMessagesSentSince (lib/data/messages.ts:176, :188) for the signed-in
-- account: the app's first look at the limits, before the scam words (stage K spec decision 9). The look that counts
-- is private.message_limit_error, under the sender's lock, inside start_conversation, send_message and start_offer;
-- these call the same counters and take no lock.
create function public.my_conversations_started_since(p_since timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  select private.conversations_started_since((select auth.uid()), p_since);
$$;
create function public.my_messages_sent_since(p_since timestamptz) returns integer … -- the same over messages_sent_since

-- unreadCounts (messages.ts:470) without a write: a sale due its 7 days counts as settled (settle_conversation's rule,
-- completed_at + 168 hours), as the thread will show it once opened.
create function public.my_unread_counts() returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  mine as (
    select c.id, c.status, c.completed_at, private.conversation_side(c.id) as side
    from public.conversations c, me
    where c.buyer_id = me.id or (not c.seller_gone and c.shop_id = private.shop_of(me.id))
  ),
  unread as (
    select m.conversation_id, count(*) as n from public.messages m join mine on mine.id = m.conversation_id
    where m.side <> mine.side and m.read_at is null group by m.conversation_id
  )
  select jsonb_build_object(
    'messages', coalesce((select sum(n) from unread), 0),
    'conversations', (select count(*) from unread),
    'sales_to_confirm', (select count(*) from mine where side = 'buyer' and status = 'done'
      and completed_at + interval '168 hours' > now()),
    'notifications', (select count(*) from public.notifications n, me where n.account_id = me.id and n.read_at is null
      and not (n.kind = 'sale-to-confirm' and exists (select 1 from public.conversations c where c.id::text = n.subject_id
        and c.status = 'done' and c.completed_at + interval '168 hours' <= now())))
  );
$$;

-- Each of the reader's conversations' last message and the other side's unread count (getInbox, messages.ts:396).
-- security_invoker: my_conversations' and messages' policies apply.
create view public.my_conversation_tails with (security_invoker = true) as
select c.id as conversation_id, t.body as last_body, t.side as last_side, t.sent_at as last_sent_at,
  (select count(*)::int from public.messages u
   where u.conversation_id = c.id and u.side <> c.viewer_side and u.read_at is null) as unread
from public.my_conversations c
left join lateral (
  select m.body, m.side, m.sent_at from public.messages m
  where m.conversation_id = c.id order by m.sent_at desc, m.id desc limit 1
) t on true;
revoke all on table public.my_conversation_tails from public, anon, authenticated, service_role;
grant select on table public.my_conversation_tails to authenticated, service_role;
```

The three functions: `revoke all … from public, anon;` then `grant execute … to authenticated, service_role;`. Supabase's default privileges give a new view every privilege for `anon` and `authenticated`, which `21_grants` (no API role writes any table but `form_states`) would catch; the revoke above is what keeps it green.

**Commands:** as Task 1.

## Task 4: Types, the viewer seam, the world, `Refused` (decisions 2, 3)

**Files:**
- `lib/supabase/database.types.ts`;
- `lib/data/supabase/clients.ts`;
- new `lib/data/supabase/viewer.ts`;
- `tests/db/viewer.ts`, `tests/db/accounts.ts`;
- `tests/contract/world.ts`, `tests/contract/sample-world.ts`, `tests/db/supabase-world.ts`;
- new `lib/data/refused.ts` (+ `.test.ts`);
- `lib/data/supabase/catalog.ts` and `pickup-points.ts` only if Recheck 2 found a mapper unexported.

**Failing tests first.**
1. `lib/data/refused.ts`'s test:
   - `new Refused("message-rate")` has `code` and `name` `"Refused"`;
   - `refusalOf(Promise.resolve(1))` is `{ ok: 1 }`;
   - `refusalOf(Promise.reject(new Refused("x")))` is `{ refused: "x" }`;
   - any other error rethrows;
   - the module imports nothing (a source check, as `lib/backend.test.ts`).
2. `lib/data/contract/smoke.db.test.ts` gains three cases:
   - `forViewerAs(id)` returns the viewer's client inside `asViewer`;
   - it throws "isn't the signed-in account" for another id;
   - outside `asViewer`, `viewerId()` rejects with "No viewer".
3. `smoke.contract.ts`: `world.signedIn("seller")` gives an id with a profile on Pretoria, in both worlds.

**Implementation.**
- `pnpm db:types` regenerates the types; never edit them by hand.
- `clients.ts`: `export async function viewerId(): Promise<string> { throw new Error("viewerId() is wired by phase B"); }`. Its comment adds: "phase B: `(await currentClaims())?.userId`, or throw when signed out".
- `viewer.ts` (`server-only`):

  ```ts
  import { forViewer, viewerId, type DbClient } from "./clients";
  /** The viewer's client, once `accountId` is checked to be the signed-in account (2b plan decision 20). */
  export async function forViewerAs(accountId: string): Promise<DbClient> {
    const [client, id] = await Promise.all([forViewer(), viewerId()]);
    if (id !== accountId) throw new Error("A Supabase twin was asked about an account that isn't the signed-in one");
    return client;
  }
  ```
- `tests/db/viewer.ts`: `withViewerSeam` also returns `viewerId: async () => { if (current === null) throw new Error("No viewer: call setViewer(name) first"); return inject("dbSessions")[current].id; }`.
- `WORLD_ACCOUNTS` becomes `["asker", "shopper", "staff", "seller"]`. `seller` gets a profile on Pretoria and no shop; the verbs give it one.
- **World verbs** are added by the task whose scenario needs them, test first (the foundation's rule). On the Supabase side each records an undo.

**Commands:** `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 5: Photos data layer (decisions 11 to 14)

**Files:**
- `lib/data/photos.ts` (+ `photos.test.ts`);
- new `lib/data/supabase/photos.ts`;
- `lib/data/contract/photos.contract.ts`, `.test.ts`, `.db.test.ts`;
- world verbs: `ageWaitingPhoto(src, hours)`, `addHubPost({ published, coverSrc })`, `hideListing` (C1's), `fileExists(path)` (Supabase only), `orphanFile(path, ageHours)` (Supabase only).

**Failing tests first.**
- **`photos.test.ts` (sample):**
  - `isPhotoId` accepts `ph-<uuid>` and a bare uuid, and refuses `ph-x`, upper case and `../`;
  - `photoIdOf("/photos/<uuid>")` is the uuid;
  - `photoFor`:
    - the Hub's waiting cover is null for no viewer and for a student, and the bytes for Hub staff (the viewer callback answers `{ id, hubStaff: true }`);
    - an unpublished post's cover is the same;
    - a published one is anyone's;
    - the callback isn't called for a public photo (a spy).
- **`photos.contract.ts`** (both worlds, signed in as `seller` unless noted):
  - **storing:** `storePhotos(seller, [jpeg], now)` returns one `/photos/<id>`. `photoSrcsOf(seller, null, now)` has it, and `photoFor(id, noViewer, now)` gives the same type and bytes;
  - **the newest 12:** 13 stored one at a time keep the newest 12; the first's `photoFor` is null;
  - **a day old:** after `world.ageWaitingPhoto(src, 25)` it's out of `photoSrcsOf` and `photoFor` is null;
  - **the Hub** (as `staff`): `storePhotos("hub", [png], now)` is in `photoSrcsOf("hub", null, now)`. `photoFor` is null for no viewer and the bytes for a Hub-staff viewer;
  - **a hidden listing's photo:** after `world.hideListing`, null for no viewer and for `shopper`, and the bytes for `seller`. The listing is made through `saveOwnListing` once Task 9 lands; until then, through a world verb;
  - **an unpublished post's cover:** `world.addHubPost({ published: false, coverSrc })`: Hub staff only.
- **`photos.db.test.ts` only:**
  - the file is at `{seller id}/{photo id}` with the photo's content type (`world.fileExists`). The Hub's is at `hub/{id}`;
  - storing the 13th removes the oldest file too;
  - an upload failure, mocked at the Storage call, leaves no row and no file, and rejects;
  - `photoFor("ph-<uuid>")` is null with no database call (a spy on `forServer`);
  - `storePhotos(shopper, …)` while the viewer is `seller` throws (decision 2);
  - `removePhotoFiles([])` makes no call; with paths, a Storage error is logged with the status and count only, and nothing throws.

**Implementation.**
- **`lib/data/photos.ts`:**
  - `PHOTO_ID = /^(ph-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`;
  - the new export:

    ```ts
    export type PhotoViewer = { id: string; hubStaff: boolean };
    /** A photo for /photos/[id] (decision 11), or null. `viewer` is asked only when the photo isn't everyone's. */
    export async function photoFor(id: string, viewer: () => Promise<PhotoViewer | null>, now: Date):
      Promise<Pick<PhotoRow, "type" | "bytes"> | null>
    ```

    The sample's version uses the existing `isStale` and `isHiddenFrom`. Hub-only means owner `"hub"` with no use, or a `post:<id>` use whose post isn't published (`sampleStore().hubPosts`);
  - each switched function's first line is `if (onSupabase()) return (await supabase()).<fn>(…)`, with `const supabase = () => import("./supabase/photos")`. That covers `storePhotos`, `photoSrcsOf`, `photoFor`, `attachPhotos`, `deletePhotosUsedBy` and `deletePhotosOf`;
  - `getPhoto` and `isHiddenFrom` stay sample-only (the route stops calling them, Task 6). `isHiddenFrom` is synchronous and can't switch;
  - a new `sweepPhotos(now): Promise<{ rows: number; files: number }>`. The sample's deletes stale waiting photos and returns `{ rows: n, files: n }`.
- **`lib/data/supabase/photos.ts`** (`server-only`): the twins `storePhotos`, `photoSrcsOf`, `photoFor`, `attachPhotos`, `deletePhotosUsedBy`, `deletePhotosOf` and `sweepPhotos`, plus the exported helpers `removePhotoFiles(paths)` and `uploadPhotoFiles(made, uploads)`. Each twin is typed `typeof Sample.<fn>`.

  ```ts
  export const storePhotos: typeof Sample.storePhotos = async (ownerId, uploads, now) => {
    if (uploads.length === 0) return [];
    const made = ownerId === HUB_OWNER ? await addHubRows(uploads) : await addOwnRows(ownerId, uploads);
    await uploadPhotoFiles(made.photos, uploads); // on failure: delete made.photos' rows and files (admin), then throw
    await removePhotoFiles(made.removed);
    return made.photos.map((photo) => `/photos/${photo.id}`);
  };
  export const photoFor: typeof Sample.photoFor = async (id, viewer) => {
    if (!UUID.test(id)) return null;
    const { data, error } = await forServer().rpc("photo_file", { p_photo: id }).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    if (data.owner_only || data.hub_only) {
      const who = await viewer();
      if (data.owner_only && who?.id !== data.owner_only) return null;
      if (data.hub_only && !who?.hubStaff) return null;
    }
    const file = await forServer().storage.from("photos").download(data.path);
    if (file.error) return null;
    return { type: data.type as PhotoType, bytes: new Uint8Array(await file.data.arrayBuffer()) };
  };
  ```

  - `addOwnRows` is `(await forViewerAs(ownerId)).rpc("add_photos", { p_types })`. `addHubRows` calls `rpc("add_hub_photo", { p_type })` once per file through `forViewer()`. `forbidden` throws `Refused("forbidden")`, since only Hub staff reach it.
  - `photoSrcsOf` reads with the viewer. For the Hub: `is("owner_id", null).eq("use", "hub-draft")`. For anyone else, through `forViewerAs`: `eq("owner_id", ownerId)`, with `use` null as `.is("use", null)`. A waiting one older than `now - LOOSE_PHOTO_TTL_MS` is left out.
  - `sweepPhotos` (`forServer()`): `sweep_waiting_photos`, then `orphan_photo_paths(1000)`. Each list goes to `removePhotoFiles`; the result is the counts.
  - `removePhotoFiles` removes 100 at a time. Its log line is `[vossie] photo files not removed (<status>, <n>)`: never a path or an id.

**Commands:** `pnpm test`, `supabase db reset`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`.

## Task 6: `/photos/[id]` (decision 11)

**Files:** `app/photos/[id]/route.ts`, `app/photos/[id]/route.test.ts`, new `app/photos/[id]/route.db.test.ts`. Also any e2e spec Recheck 9 found.

**Failing tests first.**
- **`route.test.ts` (sample):** the existing cases stay. New ones:
  - a bare-uuid id that matches nothing gives 404 with `no-store`;
  - the Hub's waiting cover gives 404 signed out, and 200 for a mentor (`getViewer` mocked);
  - `getViewer` isn't called for a public photo.
- **`route.db.test.ts`:**
  - `GET` on a stored listing photo gives 200 with `Content-Type`, `Content-Length` equal to the stored bytes, and `Cache-Control: private, max-age=31536000, immutable`, and the body equals the bytes;
  - an unknown uuid, a 25-hour-old waiting photo, a hidden listing's photo signed out, and a `hub-draft` signed out each give 404 with `Cache-Control: no-store`;
  - the hidden listing's photo for its owner gives 200 (`getViewer` mocked to the seller's `Account`);
  - `connection` comes from `next/server`, which `tests/db/setup.ts` does **not** stub (it mocks only `next/cache`). The file mocks it as `route.test.ts` does: `vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer())`, and mocks `@/lib/auth/session`'s `getViewer`. The route is called as `GET(new Request(url), { params: Promise.resolve({ id }) })`. Task 7's `route.db.test.ts` mocks `next/server` the same way.

**Implementation:**

```ts
export async function GET(_request: Request, { params }: RouteContext<"/photos/[id]">): Promise<Response> {
  await connection();
  const { id } = await params;
  const viewer = async () => {
    const account = await getViewer();
    return account ? { id: account.id, hubStaff: canUse(account, "hub") } : null;
  };
  const photo = isPhotoId(id) ? await photoFor(id, viewer, new Date()) : null;
  if (!photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(photo.bytes, { headers: { "Content-Type": photo.type,
    "Content-Length": String(photo.bytes.byteLength), "Cache-Control": "private, max-age=31536000, immutable" } });
}
```

The header comment drops "Supabase Storage replaces this route": the route stays, and Storage holds the files (spec section 6).

**Commands:** as Task 5.

## Task 7: The sweep, a Vercel Cron Route Handler (decision 15)

**Files:**
- new `app/api/cron/photos/route.ts` (+ `route.test.ts`, `route.db.test.ts`);
- new `lib/cron.ts` (+ `lib/cron.test.ts`);
- new `vercel.json` (+ `lib/cron-config.test.ts`);
- `.env.example`.

**Read first:** `node_modules/next/dist/docs/` on Route Handlers and on `connection()` with Cache Components. Vercel's cron docs say a job gets `Authorization: Bearer <CRON_SECRET>`, and on Hobby runs once a day. Recheck both before writing.

**Failing tests first.**
- **`lib/cron.test.ts`:** `cronAllowed(header, secret)`:
  - true for `Bearer <secret>`;
  - false for a missing header, the wrong secret, the wrong scheme, extra spaces, a secret one character shorter, a secret under 32 characters (even when it matches), and an unset secret;
  - it never throws on unequal lengths.
- **`route.test.ts` (sample):** `GET` gives 404 with `no-store`, and `sweepPhotos` isn't called (a spy).
- **`route.db.test.ts`:** `CRON_SECRET` is stubbed with a value made in the test (`randomBytes(32).toString("hex")`).
  - With no header, or a wrong one: 401, and nothing changes.
  - With the right header: 200 and `{ rows: 2, files: 3 }`:
    - a 25-hour-old waiting photo and a 25-hour-old `hub-draft` go, rows and files;
    - a fresh waiting photo stays;
    - an orphan file 2 hours old goes;
    - an orphan 10 minutes old stays.
  - A second call gives `{ rows: 0, files: 0 }`.
  - With `CRON_SECRET` unset: 401 even with `Bearer `.
- **`lib/cron-config.test.ts`:**
  - `vercel.json`'s `crons` has one entry;
  - its `path` has a route file under `app/`;
  - its schedule is a valid five-field expression that runs at most once a day.

**Implementation:**
- `lib/cron.ts` (plain): `cronAllowed(header: string | null, secret: string | undefined): boolean`. It compares `Buffer.from(header)` with `Buffer.from("Bearer " + secret)` using `timingSafeEqual`, after checking the lengths match, and requires `secret.length >= 32`.
- **The route:**
  - `await connection()`;
  - `if (!onSupabase())`: 404;
  - `if (!cronAllowed(request.headers.get("authorization"), process.env.CRON_SECRET))`: 401;
  - `return Response.json(await sweepPhotos(new Date()), { headers: { "Cache-Control": "no-store" } })`;
  - it reads `CRON_SECRET` on each call, never at module scope.
- `vercel.json`: `{ "$schema": "https://openapi.vercel.sh/vercel.json", "crons": [{ "path": "/api/cron/photos", "schedule": "20 3 * * *" }] }`.
- `.env.example`: `# CRON_SECRET: Vercel Cron's bearer for /api/cron/photos (Supabase only). At least 32 random characters; Production only. Lama sets it in Vercel; never in the repo.`
- `app/api/` is a new top-level folder, not beside `[slug]`, so `RESERVED_SLUGS` doesn't change. `boundaries.test.ts` passes: the route imports `lib/data` and `lib/backend`, never `lib/supabase`.

**Commands:** as Task 5. Also `pnpm build` (sample mode), which lists `ƒ /api/cron/photos` (dynamic).

## Task 8: Shops and the wizard's draft (decisions 6, 7, 8, 21)

**Files:**
- `lib/data/shops.ts` (+ `shops.test.ts`);
- new `lib/data/supabase/shops.ts`;
- `lib/selling/owner.ts` (the type follows `OwnShop`);
- `lib/selling/listing-actions.ts` and `listing-actions.test.ts` (`pausedShopNotice` only);
- `lib/data/contract/shops.contract.ts`, `.test.ts`, `.db.test.ts`;
- world verbs: `openShop(name, { status, pausedBy? })`, `addListing(slug, fields)`, `pauseShop` (C1's).

**Failing tests first.**
- **`shops.test.ts` (sample):** `getShopOf` gives `pausedByHub` true after `staffPauseShop`, and false after the seller's own pause.
- **`listing-actions.test.ts`:** the paused-shop notices come from `owner.pausedByHub`; `shopStanding` is no longer imported (a source check).
- **`shops.contract.ts`** (both worlds; the owner is `seller`):
  - **applying:**
    - `getShopOf(seller)` is null at first;
    - `saveOnboardingDraft` with a stored photo, then `getOnboardingDraft`, gives the same answers and `photoSrc`;
    - replacing the photo makes the old one's `photoFor` null;
    - `createShop` gives status `pending`, a link from the name, badge `new-seller`, `since` as the SAST month, the draft's photo as the shop's, and no draft left;
  - **links:**
    - a shop named "Export" gets `export-shop`;
    - a second "Crochet corner" on another campus gets `crochet-corner-2` (links are site-wide);
  - **`isShopNameTaken`:**
    - true for `"crochet  CORNER!"` on the same campus;
    - false on another;
    - false with the shop's own link as `exceptSlug`;
    - true against a waiting shop (`world.openShop("shopper", { status: "pending" })`);
  - **`isSlugTaken`:** `"export"`, an existing link and an old link after a change are true; a free one is false;
  - **while waiting:** `updateShop` changes the link with the name. Listings follow a new campus, and a pickup on a point the shop no longer uses moves to its first point, or to online when it has none;
  - **`changeShopSlug`:**
    - null while waiting;
    - once approved (`world.openShop` approved), `"changed"`, and then `"same"` and `"used"`;
    - another shop trying the old link gets `"taken"`;
    - `exportShop` lists `previousLinks: ["/sellers/<old>"]`;
  - **`setShopPaused`:**
    - approved to `"paused"` and back to `"approved"`;
    - a Hub-paused shop (`world.pauseShop(slug, "staff")`) can't resume (null), and `getShopOf(...).pausedByHub` is true;
  - **`exportShop`:** pickup points by name, the photo by its address, no ids, and `approvedAt` from the seller profile.
- **`shops.db.test.ts` only:**
  - every function throws when the viewer isn't the given account (decision 2);
  - `forgetShopOf` throws `Refused("forget-account")`;
  - `restoreSampleShop` is false;
  - `updateShop` with a name another shop on the campus took, through `world.openShop` between the action's check and the call, throws `Refused("name-taken")`;
  - replaced and removed photos' files are gone from Storage.

**Implementation.**
- **`shops.ts`:**
  - `OwnShop` gains `pausedByHub: boolean`;
  - each function's first line switches;
  - `emptyDraft` stays pure and shared;
  - `listingExport` and `draftExport` become exports, unchanged in what they return, so the twin reuses them.
- **`supabase/shops.ts`:**
  - **`getShopOf`:** through `forViewerAs(accountId)`, it reads `seller_profiles`, then `shops` (C1's shop columns), `shop_pickup_points` (ordered by the points' campus order) and `rpc("my_previous_shop_slugs")`, in parallel. The result is `{ shop: sellerRowFrom(...), status, pausedByHub }`, with `ownerId = accountId`;
  - **the two checks:** `isShopNameTaken` and `isSlugTaken` call the two functions through `forViewer()` (any signed-in account);
  - **`createShop`:**
    - `rpc("create_shop", { …details, p_photo_id: photoIdOf(details.image?.src ?? "") })`;
    - on `created`: `removePhotoFiles(removed_paths)`, then `(await getShopOf(accountId))!.shop`;
    - any other result: null;
  - **`updateShop`:**
    - `rpc("update_shop", { …, p_photo_id, p_remove_photo: details.image === null, p_slug: null })`. A placeholder image (a sample shop's) sends neither, so the shop keeps it;
    - `no-shop`: null;
    - `saved`: remove the files, then return `getShopOf`'s shop;
    - the four race refusals: throw `Refused`;
  - **`changeShopSlug`:** `rpc("change_shop_slug")`. `not-allowed` gives null; the rest are passed through as `SlugChange`;
  - **`setShopPaused`:** `rpc("set_shop_paused")`. `not-allowed` gives null;
  - **the draft:**
    - `getOnboardingDraft` reads `onboarding_drafts` and maps it: `photo_id` to `/photos/<id>`, a null category or campus to `""`, `pickup_point_ids` to strings;
    - `saveOnboardingDraft(draft)` checks `draft.accountId` and calls `rpc("save_onboarding_draft")`;
    - on `photo-invalid` (a waiting photo that ran out), it saves again with no photo, rather than keep a dead address as the sample would;
    - the removed files go;
  - **`exportShop`:** `getShopOf`, `approved_at`, the shop's listings through Task 9's reader, and the draft. Names come from C1's `pickupPointById` and the category fixtures, through the exported `listingExport` and `draftExport`;
  - **deletion and the sample button:** `forgetShopOf` throws `Refused("forget-account")`; `restoreSampleShop` returns false.
- **`listing-actions.ts`:** `pausedShopNotice(owner)` returns `owner.pausedByHub ? "saved-shop-hub-paused" : "saved-shop-paused"` when `owner.status === "paused"`, and the `shopStanding` import goes.
- **Tags:** `sendForApproval`, `saveShopProfile` and Pause/Resume keep `sellersChanged()` before `done()`. Their unit tests are unchanged and must pass.

**Commands:** as Task 5.

## Task 9: Own listings and the new listing's token (decision 9)

**Files:**
- `lib/data/own-listings.ts` (+ test);
- new `lib/data/supabase/own-listings.ts`;
- `lib/selling/form-state.ts` (+ test);
- `lib/selling/listing-actions.ts` (+ test);
- `lib/data/contract/own-listings.contract.ts`, `.test.ts`, `.db.test.ts`;
- world verbs: `onceRow(name, form, { taken?, expiresInMinutes? })` (Supabase: a `form_states` row for that session's id, decoded from its access token; sample: `saveFormState` with the world's session key), and `follow(follower, slug)` (shared with C4; added here if C4's isn't in).

**Failing tests first.**
- **`own-listings.contract.ts`** (both worlds; `seller` with an approved shop, `world.openShop`):
  - **a new publish:** state `available`, `createdAt === firstPublishedAt`, and the photos become the listing's (`photoSrcsOf(seller, null)` no longer has them);
  - **draft, then publish:** `createdAt` moves to the publish and `firstPublishedAt` is set;
  - **publish, draft, publish:** `firstPublishedAt` doesn't change;
  - **a waiting shop** (`status: "pending"`) saves drafts only;
  - **a hidden listing** (`world.hideListing`) stays hidden when its seller saves it;
  - **photos:** replacing a photo makes the old one's `photoFor` null;
  - **the list:** `listOwnListings` is newest-changed first, drafts and hidden ones included;
  - **another shop's listing:** `getOwnListing(slug, theirId)` is null;
  - **the row buttons:** `setOwnListingState` follows `MOVES_TO` and refuses the rest (null);
  - **deleting:** `deleteOwnListing` removes the listing and its photos, and the `new-listing` and `search-match` notifications that link to it (`world.notificationsOf`).
- **`own-listings.db.test.ts` only:**
  - **the token:**
    - `world.onceRow("seller", "listing-once:<t>")`, then `saveOwnListing({ …, id: null, onceToken: t })`, makes one listing;
    - the same call again gives null, and the listing count is unchanged;
    - an expired row, or one another session made, gives null;
    - a save refused for its pickup point leaves the row untaken (the next save makes the listing);
  - **the files:** they are in Storage until the listing is deleted, then gone;
  - **the account:** `ownerId` that isn't the viewer throws.
- **`lib/selling/form-state.test.ts`:** with `onSupabase()` stubbed true and `getFormState` mocked, `takeListingToken`:
  - gives `first` for an untaken row, and doesn't call `takeFormState`;
  - gives `again` with `sent` for a taken row with values;
  - gives `none` for no row.
- **`listing-actions.test.ts`:** a new listing's `saveOwnListing` call carries `onceToken: <the posted token>`; an edit's carries none. Every existing case passes unchanged.
- **`own-listings.test.ts` (sample):** `onceToken` is ignored.

**Implementation.**
- **`own-listings.ts`:** `ListingSave` gains `onceToken?: string` ("Supabase only: the new-listing token, taken by `save_listing`; the sample takes it in the action"). Each function switches.
- **`supabase/own-listings.ts`:**
  - `listOwnListings` and `getOwnListing`: the viewer's own shop id from `getShopOf` (the twin). If `shop.slug !== sellerSlug` they throw (decision 20). Then `listings` with `listing_photos(position, photo_id, placeholder_src, alt)`, mapped by C1's `listingRowFrom`. `hiddenAt` and `hiddenReason` are present only when set, as in the sample's rows;
  - `saveOwnListing`:

    ```ts
    const { data, error } = await (await forViewerAs(save.ownerId)).rpc("save_listing", {
      p_listing_id: save.id, p_kind: f.kind, p_title: f.title, p_category_slug: f.categorySlug, p_condition: f.condition,
      p_price_zar: f.priceZar, p_price_is_from: f.priceIsFrom, p_pay_mode: f.payMode, p_swap_for: f.swapFor,
      p_description: f.description, p_handover: f.handover, p_pickup_point_id: f.pickupPointId,
      p_photos: save.photos.map((p) => photoIdOf(p.src) ? { photo_id: photoIdOf(p.src), alt: p.alt } : { placeholder_src: p.src, alt: p.alt }),
      p_publish: save.intent === "publish", p_once_token: save.id ? null : (save.onceToken ?? null),
    });
    ```
    - on `saved`: remove the files, then return `getOwnListing(save.sellerSlug, data.listing_id)`;
    - every other result: null;
    - `save.now` is unused: the database's clock stamps the row;
  - `setOwnListingState`: `rpc("set_listing_state")`. `moved` returns the row; anything else, null;
  - `deleteOwnListing`: `rpc("delete_listing")`. On `deleted`, remove the files and return true.
- **`lib/selling/form-state.ts`:** `takeListingToken` gains, after its session and shape checks:

  ```ts
  if (onSupabase()) {
    const state = await getFormState(sessionKey, tokenForm(token), now);
    if (!state) return { kind: "none" };
    return state.taken ? { kind: "again", sent: sentFrom(state) } : { kind: "first" };
  }
  ```

  Its comment says that on Supabase it only looks, and `save_listing` takes the token in the same transaction as the insert (decision 9).
- **`listing-actions.ts`:** `saveOwnListing({ …, onceToken: existing ? undefined : once })`. `listingsChanged()` stays right after a successful save and before `done()`. So does the order: `notifyFollowers`, then `notifySavedSearches`, under the same condition.

**Commands:** as Task 5.

## Task 10: Photos under Vercel's 4.5 MB (decision 16; only on Lama's go-ahead)

**Files:**
- `lib/photos/rules.ts`;
- `lib/photos/shrink.ts` (+ test);
- `components/sell/PhotoField.tsx` (+ test);
- `components/sell/PhotoFieldset.tsx`;
- `components/sell/ShopFields.tsx`;
- `lib/selling/errors.ts` (+ test).

**Failing tests first.**
- `PHOTO_MAX_MB` is 4, and the error reads "Each photo must be 4 MB or less.".
- A new `POST_PHOTOS_MAX_BYTES` is 4 MiB.
- `shrinkAll(blobs, budget)` in `shrink.ts` re-encodes at 0.8, then 0.7, then 0.6 until the total is at most the budget, and returns what it has if 0.6 is still over. It is tested with a fake encoder whose sizes depend on quality.
- The photo field's help text names 4 MB, and without JavaScript says "Add one photo at a time" (`PhotoFieldset`'s text, server-rendered).
- `ShopFields`' text says "up to 4 MB".

**Implementation:**
- **Where the code goes:** only into `shrink.ts`, which loads with `import()` on the first photo picked, so no page's first load grows.
- **The guard:** `PhotoField`'s submit path calls `shrinkAll` once.
- **Copy:** the words change in `PhotoFieldset` and `ShopFields`.

**Commands:** `pnpm test`, `pnpm lint`, `pnpm typecheck`, then `pnpm build` and `tests/e2e/performance.spec.ts` on a fresh server:
- every page's first-visit JavaScript is equal to the byte to Task 0's (the listing forms included, since `shrink.ts` isn't in their first load);
- `tests/e2e/selling-writes.spec.ts` passes.

## Task 11: C2 check and review

1. `supabase db reset`, then:
   - `supabase test db`, `pnpm test` and `pnpm test:db`: all pass;
   - `pnpm lint` and `pnpm typecheck`: clean.
2. `grep -rn "shopStanding" lib/selling` prints nothing.
3. `grep -rn "takeFormState" lib/selling` shows only the sample path.
4. **One combined reviewer**, read-only, about 25 minutes. It checks:
   - each twin against its sample function, line by line;
   - every result a function can return, mapped;
   - no `forServer()` outside `photos.ts`'s file work and the route's lookup;
   - `removed_paths` reaching `removePhotoFiles` everywhere;
   - the tags unchanged;
   - Task 1's `save_listing` diffed against `community_actions.sql:806`.
5. Ledger.

## Task 12: Notifications (decision 17)

**Files:**
- `lib/data/notifications.ts` (+ test);
- new `lib/data/supabase/notifications.ts`;
- `lib/data/contract/notifications.contract.ts`, `.test.ts`, `.db.test.ts`;
- world verbs: `follow` (Task 9's), `markRead(name)`.

**Failing tests first.**
- **`notifications.contract.ts`** (both worlds):
  - **the list:**
    - `getNotifications(shopper, 10)` is newest first, with `isNew`;
    - the limit cuts it;
    - `countNewNotifications` counts the new ones;
    - `markNotificationsRead` leaves 0 new;
    - `exportNotifications` gives `{ text, at, read }` with no ids;
  - **once a day** (`notifyOncePerDay`): `shopper` follows `seller`'s approved shop.
    - Two first publishes the same SAST day leave `shopper` one `new-listing` notification. It is new, reads `newListingsText(shopName, 2)` and links to `/sellers/<slug>`. The test builds the words with the TypeScript functions: the wording rule.
    - The first alone gave `newListingText(shopName, title)`, linking to the listing.
    - After `markNotificationsRead`, a third publish that day adds none.
    - The scenario runs `saveOwnListing` and then `notifyFollowers`, as the action does. On Supabase the database told the followers, and C4's `notifyFollowers` adds nothing (in mixed mode it writes only the unused sample store).
- **`notifications.db.test.ts` only:**
  - `notify(…)`, `notifyAboutMessage(…)`, `deleteNotifications(…)` and `deleteNotificationsAbout(…)` reject with `Refused("written-in-the-database")`;
  - another account's notifications are never returned.

**Implementation:**
- **The reads** go through `forViewerAs`:
  - `notifications`, ordered `created_at desc, id desc` (ties are rare; the contract uses distinct times);
  - `count: "exact", head: true` where `read_at is null`;
  - `rpc("mark_notifications_read")`.

  The `now` parameter is unused there: the database stamps the time.
- **The writers** throw on Supabase; their sample bodies are unchanged.
- **The module's comment** names the SQL that writes each kind on Supabase.

**Commands:** as Task 5.

## Task 13: Reports (decision 22)

**Files:**
- `lib/data/reports.ts` (+ test);
- new `lib/data/supabase/reports.ts`;
- `lib/messaging/actions.ts` (+ `actions.test.ts`; `sendReport` only);
- `lib/data/contract/reports.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.**
- **`reports.contract.ts`:**
  - `createReport` about a public listing returns an id;
  - `hasOpenReport` is true;
  - `countReportsSince(dayAgo)` is 1;
  - `listReportsBy` gives `{ kind, title, reason, createdAt, open: true }`;
  - `exportReports` gives `reasonLabel`'s words;
  - another account's `hasOpenReport` is false;
  - a second `createReport` on the same target returns the same id (Supabase: `already-open`; sample: the action never asks, so the sample case checks `hasOpenReport` before calling, as the action does).
- **`reports.db.test.ts` only:**
  - the 11th in 24 hours, made directly while `countReportsSince` was mocked to 0, throws `Refused("rate-limited")`;
  - `deleteReportsBy` and `forgetReportOwner` throw `Refused("forget-account")`.
- **`actions.test.ts`:**
  - `sendReport` with `createReport` rejecting `Refused("rate-limited")` writes `report-rate` and goes back to the form;
  - with `Refused("not-found")` it redirects to `/`.

**Implementation:**
- **`createReport`:** `rpc("create_report", { p_target_kind, p_target_id, p_target_title: targetTitle, p_reason, p_detail })`, through `forViewerAs(reporterId)`.
  - `created` and `already-open`: select `id` from `reports` where the reporter, kind and target match and `status = 'open'`, newest first, limit 1.
  - The others throw `Refused`.
- **The reads:** `select` on `reports` (granted columns only), mapped as the sample's.
- **`sendReport`:** `const sent = await refusalOf(createReport(...))`. Then:
  - `if ("refused" in sent && sent.refused === "rate-limited")` → `writeFormState(form, { errors: ["report-rate"], values, notice: null })` and `back(path)`;
  - another refusal → `redirect("/")`.

  Every `redirect`, `back` and `done` call stays outside the `try`.

**Commands:** as Task 5.

## Task 14: Messages, the reads and the auto-confirm (decisions 19, 20, 24)

**Files:**
- `lib/data/messages.ts` (+ test);
- new `lib/data/supabase/messages.ts`;
- `lib/data/contract/messages-read.contract.ts`, `.test.ts`, `.db.test.ts`;
- world verbs:
  - `addConversation({ buyer, slug, listingId?, offerOn?, messages: [{ side, body, sentAt, readAt? }] })`;
  - `markDone(conv, completedAt)`;
  - `sellerGone(conv)`;
  - `buyerGone(conv)`.

  On Supabase each writes with the admin client; in the sample, the store.

**Failing tests first.** `messages-read.contract.ts` (both worlds; `shopper` buys from `seller`'s approved shop):
- **`getInbox(shopper, "buying")`:**
  - the conversation, with `otherName` the shop's name, the listing's title and image, `preview` the last message's first line, `lastFromViewer`, `status` and `unread`;
  - newest activity first across two conversations.
- **`getInbox(seller, "selling")`:**
  - `otherName` is `"Shopper"`;
  - an offer thread is `UNNAMED_ASKER` until the asker writes, then `"Asker"`;
  - after `world.buyerGone`, `"Deleted account"`.
- **`getThread`:**
  - null for `asker` (not theirs) and for an unknown id;
  - for the buyer:
    - messages oldest first, authored `"You"` or the other side;
    - `otherPresent` false after `world.sellerGone`;
  - an offer thread's `request` is `{ id, title, live, hidden }` (`world.hideRequest` makes `hidden` true for the asker only).
- **Reading a thread:** `markThreadRead(shopper)` makes `unread` false and reads `shopper`'s notifications about it.
- **`unreadCounts(shopper)`:** `{ notifications, conversations, messages, salesToConfirm }` as the sample counts them.
- **The 7-day auto-confirm:**
  - after `world.markDone(conv, now - 8 days)`, `unreadCounts(shopper).salesToConfirm` is 0 before anything is opened;
  - `getThread` then shows `status: "confirmed"`, `confirmedBy: "auto"` and `confirmedAt = completedAt + 7 days` (ISO);
  - the "sale to confirm" notification is read;
  - a sale done 6 days ago stays `done` and counts 1.
- **`findConversation`:**
  - the listing's conversation;
  - the shop question's;
  - null for an offer thread.
- **`exportConversations`:**
  - oldest first;
  - `about` is the listing's title or `offerAbout(side, title)`;
  - a `"done"` sale past its 7 days reads `"confirmed"`.
- **Message text:** a message `"<b>hi</b>\nhttps://example.test"` comes back as exactly that string in `getThread` and `exportConversations`.

`messages-read.db.test.ts` only: another account's conversation is never in `getInbox`; `forgetAccountInMessaging` throws `Refused("forget-account")`.

**Implementation** (`supabase/messages.ts`, through `forViewerAs(accountId)`):
- **`settle(db)`:** `db.rpc("settle_sales")`. `getInbox`, `getThread` and `exportConversations` await it first.
- **`getInbox`:**
  - `my_conversations` with `viewer_side = side`, ordered `last_message_at desc, id`;
  - `my_conversation_tails` for those ids;
  - `shops` by the ids, with C1's shop columns, mapped through `sellerRowFrom` and `toSeller` (a gone shop is `CLOSED_SHOP` with no image);
  - `getListingsByIds` and `getRequest` from `lib/data/index.ts`, as the sample does;
  - `otherName` mirrors the sample. For a seller, `buyer_name` is used when set; otherwise `buyer_gone` gives `"Deleted account"`, and an offer gives `UNNAMED_ASKER`.
- **`getThread`:** `my_conversations` by id, then `messages` ordered `sent_at, id`. `request_state` gives `live` and `hidden`.
- **`unreadCounts`:** `rpc("my_unread_counts")` mapped to `UnreadCounts`. There is no settle.
- **`markThreadRead`:** `rpc("mark_thread_read")`.
- **`findConversation`:** `my_conversations` with `viewer_side = 'buyer'`, `not seller_gone` and `not is_offer`, plus the listing id. For a shop question: `listing_title is null` and the shop's id from its slug.
- **`forgetAccountInMessaging`:** throws.

**Commands:** as Task 5.

## Task 15: Messages, the writes and the limits (decisions 3, 18)

**Files:**
- `lib/data/messages.ts`, `lib/data/supabase/messages.ts`;
- `lib/messaging/actions.ts` (+ `actions.test.ts`);
- `lib/data/contract/messages-write.contract.ts`, `.test.ts`, `.db.test.ts`;
- `lib/data/contract/limits.contract.ts`, `.test.ts`, `.db.test.ts`;
- world verb: `addMessages(conv, side, n, sentAt)`.

**Failing tests first.**
- **`messages-write.contract.ts`:**
  - **starting:**
    - `startConversation` about a listing gives `{ created: true }`;
    - again, `{ created: false }` with the same id;
    - a shop question is its own conversation;
  - **one unread message notification** per conversation: the seller has one, with `messageNoteText` words ("Shopper asked about …"), and the second message updates it ("asked" again before a reply);
  - **`sendMessage`:**
    - the seller's first reply gives `"sent"`, status `replied` and `firstReplyAt` set;
    - an offer's shop writing again before the asker gives `"waiting"`;
    - after `world.buyerGone`, the seller gets `"closed"`;
    - a stranger gets `"not-found"`;
  - **the sale:**
    - `markCompleted` gives `"done"`, and the buyer's `sale-to-confirm` notification reads `saleNoteText`'s words;
    - `confirmSale` gives `"done"` and reads it;
    - `rejectSale` from `done` gives `"done"`, status `replied` and no `completedAt`;
    - any wrong side or state gives `"not-allowed"`.
- **`limits.contract.ts`:**
  - after `world.addMessages(conv, "buyer", 120, now - 10 min)`, `countMessagesSentSince(shopper, null, hourAgo)` is 120 and `messageLimitErrors(shopperAccount, { newConversation: false }, now)` is `["message-rate"]`;
  - 40 conversations made by `world.addConversation` in the last day give `["conversation-rate"]` for a new conversation and `[]` for a message into one that exists;
  - a seller's replies in their shop's conversations count for them; a gone seller's don't.
- **`limits.db.test.ts` only:**
  - **the database's own look:** with `countMessagesSentSince` mocked to 0, 120 sent and one more `sendMessage`, the call rejects `Refused("message-rate")`, and no message is added;
  - **under the lock:** with 119 sent, two `sendMessage` at once (`Promise.all`) give exactly one `"sent"` and one `Refused("message-rate")`;
  - **conversations:** the same for `startConversation` at 40 conversations (`conversation-rate`);
  - **no exemption:** the sample accounts have none on Supabase. This is checked through the database function, whatever `isSampleAccount` says.
- **`actions.test.ts`:**
  - `sendFirstMessage` with `startConversation` rejecting `Refused("conversation-rate")` or `Refused("message-rate")` writes that error and the typed values, then goes back to the composer;
  - with `Refused("own-shop" | "closed" | "not-found")` it goes back with nothing written;
  - `sendReply` with `sendMessage` rejecting `Refused("message-rate")` writes `message-rate` and the body;
  - every existing case passes, including "the limits before the scam words".

**Implementation:**
- **`startConversation`:** `rpc("start_conversation", { p_listing_id: input.listing?.id ?? null, p_shop_slug: input.listing ? null : input.sellerSlug, p_body, p_swap_offer: input.swapOffer })`, through `forViewerAs(input.buyerId)`.
  - `started` and `added` map to `{ conversationId, created }`;
  - any other result throws `Refused(result)`.
- **`sendMessage`:** `rpc("send_message")`. `"message-rate"` throws `Refused`; the other answers come back as `SendResult`.
- **The sale moves:** `rpc("mark_completed" | "confirm_sale" | "reject_sale")`.
- **The counts:** `countConversationsStartedSince` and `countMessagesSentSince` call `my_conversations_started_since` and `my_messages_sent_since` with `p_since: since.toISOString()`. Each checks the account first (decision 2). `countMessagesSentSince`'s `shopSlug` isn't sent: the database knows the shop.
- **`lib/messaging/actions.ts`:**
  - `sendFirstMessage` wraps `startConversation` with `refusalOf`. A limit code writes `{ errors: [code], values }` and goes `back(path)`; any other refusal goes `back(path)`;
  - `sendReply` wraps `sendMessage` the same way;
  - `limits.ts` is unchanged.

**Commands:** as Task 5.

## Task 16: Offers (decision 23)

**Files:**
- `lib/data/offers.ts` (+ test);
- new `lib/data/supabase/offers.ts`;
- `lib/data/messages.ts` and `lib/data/supabase/messages.ts` (`startOffer` only);
- `lib/data/contract/offers.contract.ts`, `.test.ts`, `.db.test.ts`.

**Failing tests first.** `offers.contract.ts` (an `asker` request through C1's `world.addRequest`; `seller` with an approved shop):
- **`startOffer`:**
  - gives a conversation id;
  - again for the same shop and request, the same id;
- **`findOffer(requestId, sellerSlug)`** is that id, read as the seller;
- **`offersForRequest(requestId)`**, read as the asker:
  - newest first;
  - `shopName`, the first seller message's first line as `preview`, and `offeredAt`;
  - after `world.sellerGone`, `"A closed shop"`;
- **`countOffersSince(sellerSlug, dayAgo)`** is 1;
- **the asker's inbox:** the offer reads `"offered"`, and the seller's side is unnamed (`UNNAMED_ASKER`) until the asker replies.

`offers.db.test.ts` only:
- `startOffer` on a request past its closing day rejects `Refused("closed")`;
- the 21st offer in a day, with `countOffersSince` mocked, rejects `Refused("offer-rate")`;
- `askerId` is ignored: a wrong one still offers to the real asker.

**Implementation:**
- **`startOffer`:** `rpc("start_offer", { p_request_id, p_listing_id: input.listing?.id ?? null, p_body })`. `offered` and `already` give `conversation_id`; anything else throws `Refused(result)`.
- **The three reads** go through `forViewer()`: `my_conversations` with `is_offer`, `request_id` and the side, plus the earliest `messages` row with `side = 'seller'` for the preview, and the shops by id. Each checks the slug against the viewer's own shop where it takes one (decision 2).
- **`offerRow` and `offerThreadCount`** stay sample-only and synchronous. Their comments say so, and say where Supabase counts offers instead (`request_cards`, `request_offer_count`).

**Commands:** as Task 5.

## Task 17: C3 check, JS budget and docs

1. `supabase db reset`, then:
   - `supabase test db`, `pnpm test` and `pnpm test:db`: all pass;
   - `pnpm lint` and `pnpm typecheck`: clean.
2. **The JS budget:**
   - `pnpm build` (sample), then `tests/e2e/performance.spec.ts` on a fresh server: every page equal to the byte to Task 0's, or to Task 10's if it ran;
   - `grep -l "supabase" .next/static/chunks/*.js` prints nothing;
   - `grep -l "serviceWorker.register" .next/static/chunks/*.js` prints nothing;
   - the build lists `ƒ /photos/[id]` and `ƒ /api/cron/photos`.
3. **A Supabase build:** `VOSSIE_BACKEND=supabase pnpm build` against the local stack. The keys are exported in the shell from `supabase status -o env`, never written to a file. It builds with no cookie read inside a cache and no clock warning.
4. **Docs on the branch:** this plan's ledger and "Changes made during the build", and the programme plan's C2 and C3 lines.
5. **Lines for main at merge time,** prepared here, not written into main:
   - **CLAUDE.md:**
     - "`RESERVED_SLUGS` and `private.reserved_shop_slugs()` change together";
     - "on Supabase, notifications are written only inside database functions";
     - "the message limits are counted by the database under the sender's lock; the app's first look keeps the error order";
     - "photo files: rows first, then files; `removePhotoFiles` never throws; `/api/cron/photos` sweeps daily behind `CRON_SECRET`";
     - "`/photos/[id]` asks `photo_file`: Hub covers that are waiting or unpublished go to Hub staff, hidden listings' photos to their owner".
   - **GO-LIVE section 6:**
     - set `CRON_SECRET` in Vercel (Production);
     - confirm the team's plan for the cron frequency;
     - check the photos behind Vercel's image optimizer (no cookies): an owner's hidden listing and the Hub's waiting covers through `next/image`;
     - check on the live project that `postgres` reads `storage.objects` (`orphan_photo_paths`).
   - **PROGRESS:** a section for C2 and C3.

## Review

- **One combined reviewer** after Task 4, read-only, about 25 minutes. It checks:
  - each new SQL function against the TypeScript it mirrors;
  - grants, against the 06 allowlists;
  - the seam's mock reaching `forViewerAs`.
- **One after Task 11** (C2) and **one after Task 17** (C3), each read-only and time-boxed.
- **The last one checks:**
  - every twin's result mapping;
  - the race refusals reaching the right form errors;
  - no `forServer()` in a user's path except the photo files and the route's lookup;
  - no Supabase twin inside `"use cache"`;
  - every `done()` still preceded by the same tag call.

---

## Self-review

- **Coverage of the brief.**
  - **C2:**
    - shops: Tasks 1 and 8;
    - own listings: Task 9;
    - the onboarding drafts: Task 8;
    - photos in Storage: Tasks 2 and 5;
    - `/photos/[id]` with its refusals (hidden listings, `hub-draft`, unpublished covers) and its headers: Tasks 2 and 6;
    - the Vercel Cron sweep, with its secret header and `CRON_SECRET` named: Task 7;
    - uuid photo ids: decision 13;
    - the 4.5 MB limit, recommended and sized: decision 16 and Task 10;
    - one-time tokens: decision 9;
    - `shop_previous_slugs` read through a function: decision 6;
    - `takeFormState`'s selling caller: decision 9.
  - **C3:**
    - messages and the auto-confirm on read: Tasks 3 and 14;
    - the writes and the limits in the database under the lock: Task 15;
    - notifications and `notifyOncePerDay`: Task 12;
    - reports: Task 13;
    - offers: Task 16;
    - React text: decision 24.
  - **Cache tags:** decision 5, and every action's unit tests stay green.
  - **The contract on both backends:** every data task.
- **Checked against the code, not the brief:**
  - `save_listing` takes no token, and `take_once_token` only knows `staff-once:`;
  - SQL's `slugify` misses the reserved words;
  - `isHiddenFrom` is synchronous, so the route needs an async `photoFor`;
  - the Hub's photo owner is `"hub"` in the sample and null in SQL;
  - `getShopOf`'s callers always pass the viewer;
  - `listing-actions` reaches into C5's `shopStanding`;
  - `startOffer`'s `askerId` is unreadable on Supabase;
  - `unreadCounts` runs in every signed-in header, so it must not write;
  - `form_states`' 1-hour cap meets the 1-hour tokens;
  - `vi.mock` doesn't reach a function inside the mocked module, hence `viewer.ts`;
  - the photos table's two policies would trip the multiple-permissive-policies advisor, hence one policy.
- **Found beyond the brief:**
  - the `form_states` margin (decision 10);
  - reserved links in SQL (decision 7);
  - `create_report` returns no id (decision 22);
  - pgTAP number 32 is now taken, which phase B's plan still names (decision 1);
  - Vercel's image optimizer and cookies (Open question 3, GO-LIVE).
- **Risks:**
  - **(1) Shared harness files with C1 in flight.** Recheck 2 and the controller's merge cover it.
  - **(2) Mixed mode until C4 and C5.**
    - The TypeScript writers throw on Supabase, which surfaces any missed path at once.
    - C5's staff actions and C4's request actions must not call `notify` on Supabase.
    - The app as a whole isn't run on Supabase before step 5.
  - **(3) The orphan sweep relies on `postgres` reading `storage.objects`.** True locally; checked on the live project (GO-LIVE line).
  - **(4) The race refusals become `Refused` errors.** An action that forgot `refusalOf` shows the error page, not a form error. Each such action has a test.
  - **(5) Tie order.** Inboxes, notifications and messages sorted by time with `id` as a tie-break may differ from the sample's insertion order when two rows share a millisecond. The contracts use distinct times.
  - **(6) Vercel Hobby's cron** runs once a day at an unspecified minute within the hour.
  - **(7) Storage outages.** An upload failure throws the action's error page (decision 12). It never leaves a row without a file.
- **No placeholders:**
  - every task names its files, its failing tests, its implementation and its commands;
  - pgTAP counts are approximate ("about"). The implementer sets `plan(n)` exactly, and the ledger records it;
  - C1's mapper names are confirmed at Recheck 2.
- **One writer per file:** see the order table. `06_account_actions.test.sql` is written by 1, 2 and 3 in order; `listing-actions.ts` by 8, then 9; `lib/messaging/actions.ts` by 13, then 15; `messages.ts` by 14, 15 and 16.

## Ledger

| Task | Status | Commit |
|---|---|---|
| 0 Baseline | done: `37b0e92`, pgTAP 2,337 (36 files), unit 2,933, db 60 (12 files) | |
| 1 Selling SQL | done: `40_c2_selling` 50 tests; `take_form_state` (controller's answer), `save_listing` unchanged | |
| 2 Photos SQL | done: `41_c2_photos` 38 tests; test 13's Hub-photo read case follows decision 14 | |
| 3 Messaging SQL | done: `42_c3_messaging` 38 tests; pgTAP 2,463 (39 files) | |
| 4 Types, seam, world | done: unit 2,948, db 64; C1's mappers extracted (amendment 8) | |
| 5 Photos data | | |
| 6 `/photos/[id]` | | |
| 7 Sweep | | |
| 8 Shops and drafts | | |
| 9 Own listings, token | | |
| 10 Photo size | runs; Lama may veto | |
| 11 C2 check | | |
| 12 Notifications | | |
| 13 Reports | | |
| 14 Messages: reads | | |
| 15 Messages: writes, limits | | |
| 16 Offers | | |
| 17 C3 check, docs | | |

## Changes made during the build

- Task 0: baseline on `37b0e92` (phase B committed): pgTAP 2,337 in 36 files, unit 2,933, db 60 in 12 files; lint and typecheck clean. Recheck 2: `pickupPointById` is exported; the catalog's row mappers weren't (amendment 8), so Task 4 extracts them. Recheck 4: every latest definition is as listed. Recheck 5: phase B's `getFormState` twin returns `taken`; `takeFormState` throws on Supabase (C4's Task 2 points it at `take_form_state`). Recheck 7: `postgres` may select and delete on `storage.objects`; `settle-sales` is hourly; "Owners read their photos" is the photos table's only policy; `add_photos` and `add_hub_photo` are the only photo functions. Recheck 9: the e2e suite fetches only made-up photo ids (`system.spec.ts:121`) and a stored listing photo signed in (`selling-writes.spec.ts`), so Task 6 changes no e2e test.
- Task 1, following the controller's answer to amendment 2: `save_listing` is unchanged (one signature, 14 arguments; pgTAP checks it), and no `take_listing_token`. `public.take_form_state(p_key text)` takes `staff-once:<uuid>` through `private.take_once_token` and `listing-once:<uuid>` through a new `private.take_form_once(p_form)`, which holds `take_once_token`'s rule; `take_once_token` is now a wrapper over it (test 17 passes unchanged). Any other key, no session id, another session's or account's row, or a run-out one is `none`. pgTAP covers each prefix, a taken token, an expired one, another session's, another account's, malformed keys and a sessionless token. Decision 7's "db test" comparing `RESERVED_SLUGS` with `private.reserved_shop_slugs()` is a source check in `pnpm test` (`lib/selling/reserved-slugs-sql.test.ts`, reading the function's latest definition in the migrations), since the private schema has no API read. Test 06 gains the four new `public` functions; the two new private helpers are revoked from every API role (checked in test 40, since test 06's private lists name only what roles may run).
- Task 2: `photo_file`'s `hub_only` is `coalesce(…, false)`, so a waiting student photo answers false, not null. Supabase's new select policy lets Hub staff read the Hub's photo rows, which `13_widen.test.sql`'s "nobody reads Hub photo rows through the API" (signed in as an admin) contradicted: that case now signs in as a student and expects none (decision 14's intent; same count). The orphan tests check membership, not equality, since the shared local stack may hold real orphan files; the 1,000 cap is checked with 1,001 rows inside the rolled-back transaction.
- Task 3: `my_unread_counts` works out the reader's side inline (`buyer_id`, or the shop from `private.shop_of`, while the seller hasn't gone) rather than calling `private.conversation_side` per row; the same rule. The lock check reads `pg_locks` for `private.lock_sender`'s two-key form (classid, objid 1, objsubid 2), and a last case proves the check sees the lock once `message_limit_error` takes it.
- Task 4: `viewerId()` is wired at once (phase B has landed): `viewerSession()`'s `userId`, rejecting "viewerId() needs a signed-in session" when signed out. `forViewerAs` is in `lib/data/supabase/viewer.ts`, with a unit test (`viewer.test.ts`) besides the smoke db cases. `lib/data/refused.ts` exports `Refused` (with `code: RefusalCode`), `RefusalCode` (this plan's codes and C4/C5's: `own-request`, `once-expired`, `once-taken`, `open-limit`, `daily-limit`, `reopen-limit`, `day-past`, `day-far`, `date-past`, `cover-invalid`, `check-in-day-future`), `isRefused(error, ...codes)` and `refusalOf(promise)`; it imports nothing (a source check). Amendment 8: `lib/data/supabase/catalog.ts` now exports `SHOP_COLUMNS`, `LISTING_COLUMNS`, the row types `ShopRecord` and `ListingRecord`, `sellerRowFrom(shop, pickupPointIds, { ownerId?, previousSlugs? })` and `listingRowFrom(row, sellerSlug)` (the listing's photos come in the row), and `catalogSourceFrom` uses them; behaviour unchanged (the catalog contract and parity tests pass). The fourth account `seller` is in `WORLD_ACCOUNTS` (both worlds; profile on Pretoria, no roles, no shop); the smoke contract checks it through `getViewerAccount`. No world verbs yet: each task adds its own.

## Amendments on review (2026-10-21)

Read-only review against the migrations (local stack, read-only SQL), the code at `5fc41ff` plus C1's uncommitted files, phase B's plan and the C4/C5 plan as it stood. Small errors fixed in the text above: Task 6's `next/server` mock (setup.ts stubs only `next/cache`); `token text;` in `save_listing`'s `declare`; the repeat-token pgTAP case uses `p_photos '[]'`; Task 2's explicit `revoke … from public, anon, authenticated`; Task 3's view and function grants (Supabase's default privileges would give the view to `anon`, failing `21_grants`); Task 2's unreachable "draft whose photo it removed" case replaced; decision 1's numbers for phase B and C4/C5; the `proxy.ts` row (no change needed).

1. **The controller's answers.**
   1. Open question 1: 4 MB a photo and 4 MiB a post are accepted (Vercel's 4.5 MB body forces it). Task 10 runs after Task 9; its ledger line reads "runs; Lama may veto".
   2. Open question 2: daily cron, `20 3 * * *`, on any plan. Drop the GO-LIVE line "confirm the team's plan for the cron frequency".
   3. Open question 3: a waiting photo's unguessable link works for its one day. Decision 11 stands as written.
   4. Open question 4: **sample mode doesn't change.** Strike decision 11's "The sample gains the same two Hub rules". The sample's `photoFor` is `getPhoto` plus `isHiddenFrom`, nothing more. The Hub-only refusals are Supabase's only:
      - Task 5: drop `photos.test.ts`'s two Hub cases. In `photos.contract.ts`, "the Hub" keeps only "stored, listed in `photoSrcsOf`, and the bytes for a Hub-staff viewer"; "null for no viewer" and "an unpublished post's cover" move to `photos.db.test.ts`, and `world.addHubPost` becomes a Supabase-only helper there;
      - Task 6: drop `route.test.ts`'s "the Hub's waiting cover gives 404 signed out"; `route.db.test.ts` keeps it;
      - Task 17: the CLAUDE.md line says the Hub-staff rule holds "on Supabase".
   5. Open question 5: Lama makes `CRON_SECRET` and sets it in Vercel Production at go-live.
2. **Blocker: the new listing's token is designed twice.** This plan takes it inside `save_listing` (decision 9). C4/C5 adds `public.take_form_state(p_form)` for `staff-once:` and `listing-once:` (its missing SQL 5 and decision 6), and its Task 2 points phase B's `takeFormState` twin at it. Recommended: **C4/C5's.** It keeps the sample's order (take, then save) and needs no `drop function` and 150-line copy of `save_listing`. If the controller agrees:
   - strike decision 9's SQL, `private.take_form_once`, `private.take_listing_token`, the new `save_listing` signature, Task 1's token and `take_once_token` tests, and the `06` lines for them;
   - strike `ListingSave.onceToken` and Task 9's `form-state.ts` change: `takeListingToken` is unchanged;
   - `take_form_state` is written once, in C4's text, by whichever of this plan's Task 1 and C4's Task 1 runs first. The `takeFormState` twin in phase B's `lib/data/supabase/form-states.ts` is written by C4's Task 2;
   - Task 9's Supabase token cases (`world.issueOnceToken`) wait for C4's Task 2.

   If the controller keeps this plan's design instead, C4 drops `listing-once:` from `take_form_state`.
3. **Blocker: `lib/data/refused.ts` is designed twice** (this plan: `refusalOf`; C4/C5: `isRefused`, a typed `RefusalCode`). One module, written by whichever of this plan's Task 4 and C4's Task 2 runs first, exports `Refused`, `RefusalCode` (both plans' codes), `isRefused(error, ...codes)` and `refusalOf(promise)`. This plan's codes are `forbidden`, `name-taken`, `slug-taken`, `points-invalid`, `photo-invalid`, `rate-limited`, `not-found`, `conversation-rate`, `message-rate`, `offer-rate`, `own-shop`, and every refusal `start_offer` returns (`own`, `no-shop`, `pending`, `paused`, `closed`, `sample`, `listing-invalid`). The other plan imports it.
4. **Programming errors aren't `Refused`.** `Refused("written-in-the-database")` and `Refused("forget-account")` would be turned into form errors by any `refusalOf` around them. Decisions 14, 17 and 21 throw a plain `Error` instead ("<fn> runs in the database on Supabase"). The db tests in Tasks 8, 12, 13 and 14 assert that message.
5. **`forViewerAs` lives in this plan's `lib/data/supabase/viewer.ts`.** C4's plan puts it in `clients.ts`, where `vi.mock` of `forViewer` can't reach it. C4's Task 2 imports this one. `viewerId()` and the seam are written by whichever of this plan's Task 4 and C4's Task 2 runs first.
6. **`offers.ts` is C4's.** C4's Task 5 owns `lib/data/offers.ts`, its twin and `lib/data/contract/offers.*`, including `offersForRequest` through its `my_request_offers`.
   - Task 16 shrinks to `startOffer` in `messages.ts` and its twin, with `lib/data/contract/messages-offer.*`:
     - the same id twice;
     - the asker's inbox reads "offered" and the shop's side shows `UNNAMED_ASKER`;
     - db only: `closed`, `offer-rate`, `askerId` ignored.
   - Decision 23's "reads" bullet moves to C4.
   - For C4's open question 4: `start_offer` makes the asker the thread's `buyer_id`, so `private.is_shop_contact` already lets the asker, and any buyer, read a Hub-paused shop's row. C3 needs no view. Task 14 adds a contract case: after `world.pauseShop(slug, "staff")`, the buyer's inbox and thread still name the shop.
7. **World accounts and verbs.**
   - C4's decision 14 keeps three accounts; Task 4 adds `seller`. The controller decides. Recommended: four, since an admin as the seller muddies Hub, staff and report reads.
   - Shared verbs take C4's names: `openShop`, `addListing`, and `issueOnceToken` (in place of `onceRow`). The first of this plan's Task 4 and C4's Task 3 fixes each signature.
8. **Recheck 2.** C1's uncommitted `catalog.ts` exports no row mappers (only `catalogSnapshot` and `catalogSourceFrom`). Extracting `sellerRowFrom` and `listingRowFrom` is a refactor of C1's file, not a one-word export. Agree it with C1's controller after C1 is committed, as Task 4's first step.
9. **Shop race refusals reach a form error.** Task 8 adds `lib/selling/shop-actions.ts` (+ test). `saveShopProfile` wraps `updateShop` in `refusalOf`: `name-taken`, `slug-taken`, `points-invalid` and `photo-invalid` write the same error its own check writes for that field. Without this, risk 4's "each such action has a test" is false.
10. **Only bare uuids reach SQL as photo ids.** `lib/data/supabase/photos.ts` exports `dbPhotoId(src)`: a bare uuid, or null.
    - `save_listing`'s `p_photos`, `create_shop`, `update_shop` and `save_onboarding_draft` use it. A `/photos/ph-…` address goes as a `placeholder_src`, so the answer is `photos-invalid`.
    - Without it, a forged `ph-` id is a uuid cast error (22P02), which shows the error page.
    - Each of Tasks 8 and 9 has a db case.
11. **`getAccountActivity`** (`lib/data/accounts.ts:118`, phase B's file) checks the sample store, so it's null on Supabase. Phase B's plan (line 899) gives its counts to C3. Task 14 adds a test and its Supabase line, `unreadCounts`' twin, once phase B's Task 4 has landed. Phase B's controller is told. Or phase B writes it; the controller picks.
12. **Reports match `create_report`'s rule.** A report about something gone doesn't count. `hasOpenReport` and `createReport`'s read-back filter `status = 'open' and not target_gone`. No caller uses `createReport`'s id (`sendReport` ignores it), so the read-back exists only to keep the signature.
13. **Upload failure tidies everything.** `storePhotos` calls `removePhotoFiles(made.removed)` whether the upload succeeds or fails, in a `finally`. The rows `add_photos` trimmed are gone either way.
14. **Numbering across the plans.**
    - **pgTAP:** step 2b up to 32; phase B 33 to 39 (`33_sign_in_phase_b`; phase B's amendment 14 changes); C2/C3 40 to 49; C4/C5 50 to 69.
    - **Migrations:** phase B `20261021130000`, C4/C5 `20261023120000` (as its plan now says), this plan `20261022120000` to `…200`.
    - **The order rule:** a migration that replaces another plan's function must sort after it. Otherwise the order is free, since nothing is pushed before step 5.
    - **`06_account_actions.test.sql`:** one writer at a time across all three plans, by the controller's say.
15. **GO-LIVE, one more line.** Vercel's image optimizer fetches `/photos/…` without cookies and may keep a resized copy for the source's `max-age` (a year). Check on the preview that a deleted listing's photo, resized, is no longer served (amendment 9.4, POPIA). If it is, Lama chooses a shorter `max-age` or unoptimised photos. This happens in sample mode on Vercel today too.

### The controller's answers to the review (2026-10-21)
- **Amendment 2 (one-time tokens):** keep `save_listing` as it is; the new listing's token is taken by a separate `public.take_form_state(p_key text)` before `save_listing`, keeping the sample's order. This plan lands before C4/C5, so **this plan creates `take_form_state`**, accepting both the `listing-once:` and `staff-once:` prefixes (wrapping `take_once_token` for the staff one), with pgTAP for each prefix, a taken token, an expired one and another account's. C4/C5 then reuses it (its amendment 5 is superseded on this point; noted there).
- **`lib/data/refused.ts`:** one module. This plan writes it first and exports both plans' helpers and every refusal code named in either plan (read C4/C5's plan and its amendments 4 and 11 for theirs). Unexpected calls on Supabase throw a plain `Error` (amendment 3).
- **World accounts:** four, adding `seller` (C4/C5's amendment 6 agrees). This plan adds it.
- **Numbering:** as set in C4/C5's amendment 2 and phase B's notes: step 2b/C1 pgTAP up to 35 and migrations up to `20261021129900`; phase B `20261021130000` and pgTAP 36–39; this plan `20261022…` and 40–49; C4/C5 `20261023…` and 50–59. Amendment 13's phase B range (33–39) is superseded.
- **Task 10 (4 MB a photo, 4 MiB a post):** accepted by the controller; Lama may still veto.
- **Order:** this plan starts after phase B lands, so `forViewer()` and phase B's shapes exist; reuse them and record any differences under "Changes made during the build".
