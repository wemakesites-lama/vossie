# Supabase schema catch-up (step 2): build plan

- **Programme:** `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, step 2. **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` (sections 4, 7 and 8), with the stage specs it names for G (staff tools), H (community actions), I (saved-search alerts) and J (staff accounts and numbers).
- **Goal:** the database holds everything stages G to J keep in the sample store, with the same rules, access rules and atomic writes as phase A: new tables, new columns on phase A's tables, every staff and community write as a Postgres function, the admin's raw weekly counts, a complete `forget_account`, stage K's two message limits, and a seed that matches the fixtures. Every migration runs clean from empty locally, the pgTAP suite passes, and the advisors report nothing.
- **Not in this step:** any change to `lib/data`, `lib/auth`, pages or components (phase C and B). The app keeps running on the sample store. Badges are still worked out in TypeScript (`lib/data/badges.ts`): phase C writes `shops.badge` with the admin client.
- **Where:** a new worktree, `../Vossie-backend` on branch `backend/phases-b-c`, made from main at or after `84f61a1`. Only `supabase/`, `scripts/seed-sql*.ts`, `scripts/make-seed.ts` and `lib/supabase/database.types.ts` change. None are on stage K's file list.
- **How the SQL is written:** test first, as phase A. Each task writes its pgTAP file in `supabase/tests/`, sees it fail on `supabase test db`, then writes the migration. The column lists and rules below are the contract. The SQL is written in the task, and every rule cites the TypeScript constant it mirrors.

## Safety (from CLAUDE.md, highest priority)

- Lama's go-ahead before `git worktree add` (Task 0) and before each commit; one git command per tool call; implementers never commit.
- The local stack (`supabase_*_vossie` containers) is shared by every Vossie checkout. `supabase db reset` (local only) wipes local data, which is fine; never `--linked`. Leave the `supabase_*_autoyard` containers alone (another project).
- Staging changes only in Task 12, with `--dry-run` output shown first and Lama's go-ahead for that run.
- No token or password in chat or in a file in the repo.

---

## Decisions made in this plan

**Confirmed by Lama on 2026-10-20: all nine as recommended** ("pick recommended decision"). Decision 8 keeps the sample store's behaviour.

1. **Staff writes are `public` functions called with the staff member's own session, not the admin client.** Each checks `private.is_staff(area)` first, inside the same transaction as the write and its one audit row. That closes the go-live item "re-check the actor's role inside the transaction" (a just-demoted admin can't finish an action), and the audit row can't be skipped. **This changes spec decision 5,** which listed staff tools under the admin client; account deletion, jobs and photo files stay there.
2. **"Every campus" is `null`, not `'all'`.** `hub_posts`, `featured_pins`, `featured_draws` and `saved_searches` keep `campus_slug` as a real foreign key to `campuses`, with null meaning every campus; phase C maps `'all'` to null and back.
3. **A saved search's identity is a `search_key` the app works out** (`searchKey`, `lib/saved-searches/rules.ts:58`), unique per account. Copying `queryWords` into SQL would break the CLAUDE.md rule that only browse's code knows its search rules. A wrong key can only harm its own owner's list.
4. **Matching a new listing against saved searches stays in TypeScript** (through `listingMatches`, as CLAUDE.md requires). The database gives one server-only function, `record_search_matches(listing_id, search_ids)`, that rechecks the first-publish conditions and applies the one-per-account and once-a-day rules. Followers are told inside `save_listing` itself, since that needs no search rules.
5. **Featured draws are kept by the server only** (`service_role`). The draw is chosen in TypeScript on first view (`featuredFor`), so phase C writes it with the admin client. No API role can write a draw.
6. **Hub covers are photos with no owner.** `photos.owner_id` may be null only when `use` is `post:<id>`, and the file sits at `hub/<photo id>`. Deleting the staff member who added the cover then doesn't take it off the post.
7. **A shop's old links get their own table**, `shop_previous_slugs` (slug primary key, `shop_id` cascading), checked by every slug choice. When a shop is deleted its old links free up with it, as in the sample store.
8. **Reports about a deleted request keep `target_gone = false`,** as the sample store does today (only a deleted shop sets it). Considered and not chosen: setting it for requests too, so such a report could only be dismissed, as with shops. That would be an app change as well, so it waits for a stage that needs it.
9. **The message limits apply to every account on Supabase.** Stage K exempts the five sample accounts only in sample mode (`isSampleAccount` needs `isSampleMode()`), so the database has no exemption.

---

## Task 0: Worktree and baseline

1. `git status` on main (separate call), then, with Lama's go-ahead and a "go" from main's controller:
   ```bash
   git worktree add ../Vossie-backend -b backend/phases-b-c main
   ```
2. `pnpm install --frozen-lockfile` in the worktree.
3. Baseline: `supabase db reset` then `supabase test db` from the worktree (803 pass), `pnpm vitest run scripts lib/supabase` (pass).

## Task 1: Migration `…_widen.sql` (phase A's tables, for G to J)

Tests: `supabase/tests/13_widen.test.sql`.

Every new check is preceded by a backfill, because staging already holds rows (`paused_by = 'seller'` where a profile is paused; `approved_at` from `applied_at` for approved or paused profiles). Offers' columns and indexes are Task 3's, after `requests` exists.

- **notifications:**
  - `kind` check widened to the app's 11 kinds (`NotificationKind`, `lib/types.ts:330`): adds `shop-update`, `booking`, `offer`, `request-update`, `new-listing`, `search-match`, `staff-role`;
  - `count int check (count >= 1)`, null meaning one (`NotificationRow.count`; `notifications.ts:207` writes 1);
  - a partial unique index for the once-a-day kinds: one row per `(account_id, kind, subject_id, private.sast_day(created_at))` where `kind in ('new-listing', 'search-match')`, so `notify_once_per_day` is one `insert … on conflict … do update`.
- **reports:** `outcome` in `('dismissed', 'hidden', 'paused')`, `note` (≤ 500, `REASON_MAX`), `closed_at`, `closed_by uuid references profiles on delete set null`, `target_gone bool not null default false`; check: `status = 'closed'` exactly when `outcome` and `closed_at` are set. **The whole-table grant to `authenticated` (`messaging.sql:133`) becomes a column grant without `note` and `closed_by`:** a dismissal's note is for staff only (`lib/staff/rules.ts`).
- **listings:** `hidden_at`, `hidden_reason` (≤ 500), both set or both null. The public and signed-in read policies and the listing-photo policy add `hidden_at is null`. The owner still reads their hidden listing and its reason (`own-listings.ts:75`).
- **seller_profiles:** `declined_at`, `paused_by` in `('seller', 'staff')`, `seller_paused_too bool not null default false`, `staff_reason` (≤ 500), `mentor_id uuid references profiles on delete set null` (indexed), `approved_at` (set once: a trigger keeps it, as `keep_first_published_at` does). Checks: `mentor_id <> account_id`; `paused_by` set exactly when `status = 'paused'`. The owner's grant becomes a column grant: they read `declined_at`, `staff_reason` and `paused_by`, never `mentor_id`. **Phase A's `set_shop_paused` (`actions.sql:1144`) is replaced in this migration**, so the new check holds from the start: it sets `paused_by = 'seller'` and refuses to resume a pause with `paused_by = 'staff'`.
- **form_states:** `taken bool not null default false` (one-time tokens, `lib/staff/once.ts`). `authenticated` loses update on `taken` (column grant), so a person can't clear their own token; only `private.take_once_token` sets it.
- **photos** (decision 6): `owner_id` may be null only for Hub photos, `use = 'hub-draft'` (uploaded, waiting for its form) or `use ~ '^post:'` (on a post), stored at `hub/<id>`. The waiting-photo sweep treats `hub-draft` as it treats `draft` (a day).
- **pickup_points:** the read policy returns retired points too (listing pages show "no longer used", `pickup-points.ts:28`). Queries for live points filter `retired_at is null`.
- **shop_previous_slugs** (decision 7): `slug text primary key` (same format check as `shops.slug`), `shop_id uuid not null references shops on delete cascade`, `created_at`. No API grants. `private.free_shop_slug` and `change_shop_slug` are replaced so a slug in this table, or a shop's current slug, is never free; `change_shop_slug` records the old one and keeps phase A's report move (`actions.sql:1136`), now only for reports `and not target_gone` (`shops.ts:87`).

## Task 2: Migration `…_staff_tables.sql` (G)

Tests: `14_staff_tables.test.sql`. Every table has RLS on, explicit grants, indexes on each column a policy or foreign key uses, and no insert, update or delete grant to API roles (writes are Task 5's functions).

| Table | Columns and rules | Who reads |
|---|---|---|
| `audit_log` | `id uuid`, `at`, `staff_id → profiles` (null once deleted), `staff_name`, `action` (the 27 `AuditAction` values, `types.ts:479`), `target_kind` (the 8 `AuditTargetKind` values, `:520`), `target_id text` (no FK: it outlives its target), `target_name`, `detail text default ''`, `subject_id → profiles` (nullable). Index `(at desc)`, `staff_id`, `subject_id` | admins (`is_staff('admin')`) |
| `featured_pins` | `id`, `shop_id → shops on delete cascade`, `campus_slug` (null = every campus), `day date`, `pinned_by → profiles` (nullable), `created_at`. Unique `(campus_slug, day, shop_id)` with nulls not distinct; at most 4 per `(campus_slug, day)` (`FEATURED_PLACES`), checked in Task 5's function | admins |
| `featured_draws` | `id uuid` primary key, `campus_slug` (null = every campus), `day`, `shop_ids uuid[]` (in order, pins first); `unique nulls not distinct (campus_slug, day)` | `service_role` only (decision 5) |
| `mentor_notes` | `id`, `owner_id → profiles on delete cascade`, `kind in ('note', 'check-in')`, `check_in_on date` (set exactly for a check-in), `text` (1 to 1,000, clean text, `MENTOR_NOTE_MAX`), `author_id → profiles` (nullable), `author_name`, `created_at` | the owner's assigned mentor and admins, only while the owner's shop isn't pending (`mentors.ts:20`), and **never the owner, even when the owner is staff** (`mentors.ts:23`, amendment 15.3) |
| `hub_posts` | `id text` (`h-001` style or `new_short_id()`), `kind in ('event', 'office-hours', 'tip')`, `title` ≤ 70, `summary` ≤ 160, `place` ≤ 80, `body` ≤ 4,000 (`lib/staff/post-rules.ts:12-15`), `campus_slug` (null = every campus; a tip always null), `starts_at` and `place` set exactly for events and office hours, `capacity` 1 to 1,000 for events only, `going int` (the seed's count; null for non-events), `image_src`, `image_alt`, `cover_photo_id → photos` (nullable), `published bool`, `published_at` (first publish only, kept by a trigger), `author_id → profiles` (nullable), `created_at`, `updated_at` | anyone: published posts, through a column grant without `author_id`; hub staff: all, drafts and `author_id` included, through `public.staff_hub_posts` (a view whose `security definer` helper checks `is_staff('hub')`) |
| `hub_rsvps` | primary key `(post_id, account_id)`, `created_at`; both cascade | the account its own; anyone the count (a `security definer` function `hub_going(post_id)`, `going` plus RSVPs) |
| `hub_bookings` | `id`, `post_id → hub_posts on delete cascade`, `account_id → profiles on delete cascade`, `help` 1 to 300, `time` 0 to 100 one line (`HELP_MAX`, `TIME_MAX`), `status in ('open', 'accepted', 'declined')`, `created_at`, `answered_at`, `answered_by → profiles on delete set null`; one open booking per `(post_id, account_id)` | the account its own; hub staff all |

**Staff reads of phase A's tables** (spec 4.3, "Staff: all (G)"), as `is_staff` read policies, so a role removed by an admin stops working at once, as decision 1 does for writes. Staff reads go through the staff member's own session, not the admin client:
- admins (`is_staff('admin')`): every shop and listing in any status, hidden ones and their reasons included; every seller profile, `mentor_id` included; every report, `note` and `closed_by` included (through `public.staff_reports`, a view behind an `is_staff` helper, since reporters' column grant leaves those out); pickup points; the audit log;
- mentors (`is_staff('mentor')`): the seller profiles, shops and listings of the shops assigned to them, and `public.mentor_shop_numbers(shop)` (the 14-day counts, `security definer`, assigned mentor or admin only);
- a pgTAP case for each: a mentor reads an assigned shop but not another; a demoted admin reads nothing.

## Task 3: Migration `…_community_tables.sql` (H, I)

Tests: `15_community_tables.test.sql`.

- **requests:** `id text`, `asker_id → profiles on delete cascade` (null for the 16 samples), `title` 5 to 70 one clean line, `category_slug → categories`, `campus_slug → campuses`, `details` 20 to 600 clean text, `budget_zar int` 1 to 100,000 or null, `swap_welcome bool`, `needed_by date`, `status in ('open', 'closed')`, `created_at`, `updated_at`, `closed_at` (set exactly when closed), `seed_offers int not null default 0`, `hidden_at`, `hidden_reason` ≤ 500 (both or neither). Constants: `lib/looking-for/rules.ts:7-17`. The 90-day `needed_by` window and the contact-details rule stay app checks (they depend on today and on regexes the app owns), noted in the migration.
  - **The asker is never public:** column grants leave `asker_id` out for `anon` and `authenticated`; a policy lets anyone read requests where `hidden_at is null`. Your requests (every state, with the hidden reason) is a second policy through `private.is_my_request(id)` (`security definer`, compares `asker_id` with `auth.uid()`), so no API role ever needs the column. A pgTAP test reads it as `authenticated` and checks `asker_id` is refused.
  - `public.request_offer_count(id)`: `seed_offers` plus every offer thread, gone shops included (`offers.ts:31`). Only the asker reads the offers themselves (through `my_conversations`).
- **Offers on conversations** (here, after `requests` exists):
  - `is_offer bool not null default false`, set when the thread starts and never changed (a trigger refuses a change). **An offer is marked by this, not by `request_id`**, which is a plain pointer: `request_id text references requests on delete set null`, so a deleted request's offer threads stay offers and never become enquiries (`messages.ts:159`; CLAUDE.md: "F's counting leaves offer threads out of enquiries"). `request_title` (≤ 70, one clean line) is kept for when the request has gone;
  - status check adds `'offered'` (`messages.ts:245`);
  - the two "one open thread" indexes (`messaging.sql:39-42`) gain `and not is_offer`; a new unique index allows one offer per `(request_id, shop_id)` where `is_offer and not seller_gone and request_id is not null` (`offers.ts:21`);
  - **phase A's `start_conversation` is replaced in this same migration**: its `on conflict … where` targets must match the new index predicates exactly, its fallback lookups skip offer threads, and it refuses a hidden listing (`hidden_at is null`);
  - `my_conversations` and the conversations column grant gain `is_offer`, `request_id` and `request_title`, and a column (worked out by `private` helper) that applies "the asker is unnamed until they write" (`messages.ts:116`) and "request hidden" (`messages.ts:436`), so a shop never reads the asker's profile;
  - pgTAP: deleting a request while the asker has a question thread with the same shop leaves both threads, the offer still an offer; phase A's test 07 still passes.
- **follows:** `id`, `account_id → profiles on delete cascade`, `shop_id → shops on delete cascade`, `created_at`; unique `(account_id, shop_id)`. The account reads its own; `public.follower_count(shop_id)` gives the number, never who (`follows.ts:91`).
- **saved_searches:** `id text` (`ss-…` or `new_short_id()`), `account_id → profiles on delete cascade`, `q` (≤ 100, null when empty), `category → categories`, `campus_slug → campuses` (null = every campus; decision 2), `price in ('free', 'under-50', 'under-100', 'under-250', 'under-500')`, `pay in ('cash', 'swap')`, `deals in ('free-and-swaps')`, `search_key text not null` (decision 3), `created_at`, `paused_at`. Unique `(account_id, search_key)`; a check that it has words, a category or a filter (`rules.ts:44`). SQL can only test `q is not null` for "words": whether they're more than stop words is `queryWords`, which stays app-only. Owner only.

## Task 4: Migration `…_staff_actions.sql`: shops, reports, hiding (G, J's Show again)

Tests: `16_staff_shop_actions.test.sql`. Each function: `security definer`, `search_path = ''`, `private.is_staff(area)` first (else `forbidden`), the write, **one `audit_log` row only when something changed**, then the notifications the spec names. Each returns a small result (`changed`, `nothing`, or an error code the app maps to its words). Granted to `authenticated` and `service_role`; never `anon`.

**Notification wording is built in SQL, never passed in** by a function `authenticated` can call (Tasks 4 to 6). Otherwise anyone could call the function through the API with their own session and send any text to other people. As phase A's `message_note_text`, each kind gets a `private.*_note_text` function that mirrors the app's words (`lib/staff/notification-text.ts`, `lib/data/notifications.ts`), and a pgTAP case compares its output with strings printed from the TypeScript, as `name_key` was tested. Only `service_role` functions (`record_search_matches`) may take wording.

| Function | Area | Rules (from) | Notifies |
|---|---|---|---|
| `approve_shop(account)` | admin | pending, not declined; sets `approved_at` once (`staff-shops.ts:125`) | `shop-approved` → owner |
| `decline_shop(account, reason)` | admin | pending; reason ≤ 500 (`:143`) | `shop-update` → owner |
| `resend_for_approval()` | the owner | clears the decline, `applied_at = now()` (`:157`) | none, no audit |
| `set_shop_verified(shop, on)` | admin | not pending; only on change (`:167`) | `shop-update` |
| `staff_pause_shop(shop, reason)` | admin | records `seller_paused_too`; closes open, not-gone reports on the shop and its listings as `paused` (`staff-reports.ts:175`) | `shop-update` → owner; `report-handled` → each reporter |
| `staff_resume_shop(shop)` | admin | puts the seller's own pause back when `seller_paused_too` (`staff-shops.ts:173-202`) | `shop-update` ("lifted" or "resumed") |
| `set_shop_mentor(shop, mentor)` | admin | the mentor holds the role and isn't the owner (`:219`) | none |
| `dismiss_report(report, note)` | admin | open only; note ≤ 500 | `report-handled` → reporter |
| `hide_listing(listing, reason)` | admin | closes open reports on it as `hidden` | `shop-update` → owner; `report-handled` → reporters |
| `hide_request(request, reason)` | admin | same, for requests | `request-update` → asker (not a sample); `report-handled` |
| `show_listing(listing)`, `show_request(request)` | admin | hidden only; reports stay closed, reporters not told; `show_request` sets `updated_at` (`requests.ts:193`) | `shop-update` / `request-update` → owner or asker |

(The seller-side `set_shop_paused` was replaced in Task 1.) Also here: phase A's `reports_one_open_per_target` index becomes `where status = 'open' and not target_gone`, and `create_report` is replaced to match (`reports.ts:54`), so an open report on a deleted shop doesn't block one on a new shop with the same link.

## Task 5: Migration `…_staff_tools_actions.sql`: points, featured, Hub, mentors, roles (G, J)

Tests: `17_staff_tools_actions.test.sql`. Same pattern as Task 4.

- **Pickup points** (admin): `add_pickup_point`, `rename_pickup_point`, `retire_pickup_point`, `restore_pickup_point`, null on no change, unique name per campus (`pickup-points.ts:52-90`).
- **Featured** (admin): `pin_shop(shop, campus, day)` (today to 60 days ahead in SAST, `PIN_DAYS_AHEAD`; at most 4, counted under an advisory lock on `(campus, day)`; eligible: verified, approved, not paused, at least one listed listing that isn't hidden, `featured.ts:27`), `unpin_shop(pin)`. Each deletes that day's draw (`featured.ts:106`).
- **Hub covers** (hub; decision 6): `add_hub_photo(type, alt)` makes a `hub-draft` photo row with no owner and returns its id and Storage path (`hub/<id>`). The app uploads the file with the admin client, as phase A's `add_photos` flow does. `save_hub_post` takes `cover_photo_id`, moves that photo to `post:<id>`, and returns the replaced cover's path for the caller to delete from Storage. Waiting `hub-draft` photos are swept after a day.
- **Hub posts** (hub): `save_hub_post(id or null, fields, cover_photo_id, once_token)`. A new post takes a one-time token (`form_states`, `taken`), so a second press makes nothing. Mentors edit only their own posts, admins any (`hub-posts.ts:98`). An unchanged edit makes no audit row and doesn't touch `updated_at`.
- **RSVPs and slots** (any signed-in account): `rsvp(post)` (published event, not past, not full: `going` plus RSVPs below `capacity`, counted after `select … for update` on the post), `cancel_rsvp(post)`, `request_slot(post, help, time)` (published office hours, not past, one open per student; `booking` → the post's author, unless that's the student). `answer_booking(booking, accept)` (hub; open only; `booking` → the student).
- **Mentor notes** (mentor): `add_mentor_note(owner, text, once_token)`, `add_check_in(owner, day, text, once_token)` (day not after today in SAST; the token required, else `once-expired`). Only the owner's assigned mentor or an admin.
- **Roles** (admin): `give_role(email, role, once_token)`: exact address match on a signed-in-once account (never a search), `no-account` or `held`, roles stored in the order `{mentor, admin}`. `remove_role(account, role)`: `own-admin` or `last-admin` refused, the admin count taken under `pg_advisory_xact_lock` so two removals can't both pass (GO-LIVE: last-admin rule in the database); removing `mentor` clears `mentor_id` on their shops and the audit detail names them. Both send `staff-role` with `subject_id` the role.
- **One-time tokens:** `private.take_once_token(token)` marks the `form_states` row `taken` and returns whether it was free, so every function above shares one rule. **Review fix (I1 of the Tasks 1–3 review):** Task 1's column grant is undone. It let a person delete their taken row and insert it again (the token free again), and it broke the app's own save of a row with `taken: true` (`lib/staff/once.ts:76`, `lib/selling/form-state.ts:115`). Instead:
  - a `BEFORE UPDATE` trigger keeps `new.taken := old.taken or new.taken`, so it can be set but never cleared;
  - a `BEFORE DELETE` trigger refuses an unexpired taken row when `current_user` is `authenticated`, so the hourly sweep (`service_role` and `postgres`) still works;
  - pgTAP covers delete-then-insert and an upsert with `taken = true`.
- **Hiding needs an open report** (Task 4's open question 2, recommended answer): `hide_listing` and `hide_request` are replaced here so they refuse with `no-open-report` unless an open, not-gone report is on the target. The app offers Hide only from an open report, and CLAUDE.md says hiding again after Show again "needs a new report".
- `start_offer`'s `on conflict` (Task 6) repeats `conversations_one_offer_per_shop`'s predicate exactly: `is_offer and not seller_gone and request_id is not null`.

## Task 6: Migration `…_community_actions.sql` (H, I)

Tests: `18_community_actions.test.sql`. Granted to `authenticated` and `service_role` unless marked server only.

- **Requests:** `save_request(id or null, fields, once_token)` (at most 5 open and not hidden, and 5 made in any 24 hours, counting requests that still exist, `OPEN_REQUESTS_MAX`, `REQUESTS_PER_DAY`; edit only while open), `set_request_open(id, open)` (reopening counts toward the 5), `delete_request(id)` (deletes its `request-update` notifications; offer threads stay with `request_title`). Counts taken under an advisory lock on the asker, so posts at the same moment can't slip past.
- **Offers:** `start_offer(request, shop, listing or null, body)` (an approved, unpaused shop; not the asker's own shop; the request open and not a sample; body ≤ 1,000; 20 offers a shop in any 24 hours, `OFFERS_PER_DAY`, counted under an advisory lock on the shop; reuses the shop's existing offer; status `offered`; `offer` → the asker). `send_message` (phase A) is replaced: a shop can't write again while the thread is `offered` (`waiting`), and the asker's reply moves it to `replied`.
- **Reports on requests** (Task 4's open question 1, recommended answer): `create_report` is replaced so a request's title comes from `requests`, not the caller (phase A's "until stage H" path), and a report on a hidden or missing request is refused.
- **Follows:** `follow_shop(shop)` (a shop with a storefront, not your own, at most 200, `FOLLOW_LIMIT`, counted under an advisory lock on the account), `unfollow_shop(shop)`.
- **Saved searches:** `save_search(fields, search_key)` (`already` on a duplicate key, `limit` at 20, counted under an advisory lock on the account), `set_search_paused(id, paused)` (pausing again keeps the first time), `delete_search(id)` (deletes its `search-match` notifications).
- **First publish:** `save_listing` (phase A) is replaced so a first publish by an approved shop of a listing that isn't hidden tells every follower but the owner with `new-listing`, under `private.notify_once_per_day` (one row per account, kind, subject and SAST day; while unread it counts up and moves to the newer wording and `created_at`; once read, `new-listing` stays read and `search-match` comes back unread at one, `notifications.ts:182`), as one `insert … on conflict … do update` on Task 1's index. The wording is built in SQL from the shop's name and the listing's title (see Task 4's note).
- **`record_search_matches(listing, search_ids, texts)`** (server only, decision 4; the only function that takes wording): rechecks first publish, approved shop and not hidden; skips paused searches and the shop owner's own; tells each account once under its oldest matching search.
- **Deleting a listing** (`delete_listing`, phase A, replaced) also deletes the `new-listing` and `search-match` notifications that link to it (`own-listings.ts:106`). **Changing a shop's link** (`change_shop_slug`) rewrites the `/sellers/…` links of its `new-listing` notifications.

## Task 6b: Migration `…_staff_pause_storefront.sql` (found in Task 6)

Tests: `18b_staff_pause_storefront.test.sql`.

- **The gap.** Phase A's `private.shop_is_public` treats every paused shop as public. The app's `hasStorefront` (`lib/data/catalog.ts:28`) doesn't: a shop the Hub paused (`paused_by = 'staff'`) has no storefront, and its listings have no pages (`publicListing`, `:114`). So anyone can still read a Hub-paused shop and its listings through the API: a moderation leak.
- **The fix.** `private.shop_is_public` becomes the app's `hasStorefront`: approved, or paused by the seller. Task 6's `private.shop_has_storefront` becomes the same function (or calls it), so one rule serves every policy, `start_conversation`, `create_report` and the follow check.
- **Tests:**
  - anon and a signed-in student can't read a Hub-paused shop, its listings or its listing photos;
  - its owner and admins still can;
  - a seller-paused shop stays public;
  - starting a conversation and reporting follow the app for a Hub-paused shop.

## Task 7: Migration `…_numbers.sql` (J)

Tests: `19_numbers.test.sql`.

- `public.admin_weekly_counts(now timestamptz)`, admin only, returns `(measure, period, campus_slug, count)` for periods `last`, `before` and `since` (SAST weeks Monday to Monday, `date_trunc('week', at at time zone 'Africa/Johannesburg')`; `since` ends where `last` ends; the current week is never counted), with `campus_slug` null for a gone or unknown campus. Measures and sources as `lib/data/numbers.ts:70-109`: listings (`first_published_at`), shops (`approved_at`, or `created_at` for an ownerless shop), requests, enquiries (conversations where `not is_offer`; gone when `seller_gone` or no shop), reports made, reports closed (`closed_at`; campus from the target, gone when `target_gone`), follows. Plus `open_shops` per campus now. **Saved searches never.**
- `protectCounts` stays in TypeScript (`lib/staff/numbers.ts:190`); the function returns raw counts only and is never granted to anyone but admins through `is_staff('admin')`.
- A test fixes a `now` and checks each measure's week edges against hand-worked rows, including Sunday 21:59 and 22:00 UTC.

## Task 8: Migration `…_forget_account.sql`

Tests: extend `10_account_deletion.test.sql` (new cases only; phase A's stay).

`public.forget_account(uid)` is replaced, keeping `deleteAccountData`'s order (`lib/data/accounts.ts:237-278`) and phase A's messaging and photo steps:

1. messaging (phase A's rules; offer threads included);
2. reports by the account;
3. its requests (other people's offer threads keep `request_title`; `request_id` goes null);
4. its follows, every follow of its shop, and the `new-listing` notifications about that shop;
5. its saved searches and their `search-match` notifications;
6. its shop's extras: `search-match` notifications linking to the shop's listings, `target_gone = true` on reports about the shop or its listings (other reporters' too), its featured pins (cascade);
7. staff tools: audit rows it wrote → `staff_id` null, `staff_name` "Deleted account"; audit rows about it → `subject_id` null, `target_id` '', `target_name` "Deleted account", `detail` ''; notes about it deleted, notes it wrote → `author_id` null and "Deleted account"; `mentor_id` cleared; its RSVPs and bookings (and the `booking` notifications about them) deleted; `answered_by`, `hub_posts.author_id`, `featured_pins.pinned_by` and `reports.closed_by` set null (foreign keys where they can, explicit SQL for the renames);
8. the profile and what cascades from it, returning the photo paths for the caller to remove from Storage.

A test deletes each sample account in turn and checks what must survive (the other side's messages, other reporters' reports, audit rows, posts).

## Task 9: Migration `…_message_limits.sql` (stage K)

Tests: `20_message_limits.test.sql`. Written after stage K's Task 6 lands on main, so the constants and error codes match `lib/messaging/limits.ts`. If K changes them, this task follows. The worktree's base doesn't have K's file: the task reads it from main's checkout. Bringing main into this branch is a merge, a git write, and needs Lama's go-ahead.

- **Unblocked 2026-10-20:** K's rules are on main (`9d58e72`, wiring `40a9e76`). Mirror them exactly:
  - `lib/messaging/limits.ts` `messageLimitErrors`;
  - `lib/messaging/rules.ts` (`CONVERSATIONS_PER_DAY = 40`, `MESSAGES_PER_HOUR = 120`);
  - `lib/data/messages.ts:176-200`.
- `start_conversation` refuses with **`conversation-rate`** when the buyer has started 40 or more conversations in the last 24 hours, only when the post would start a new thread. The count covers `buyer_id` = the account, `not is_offer` and `created_at > now() - 24 h`; re-joining an existing thread isn't new.
- `start_conversation`, `send_message` and `start_offer` refuse with **`message-rate`** at 120 or more messages in the last hour. A message is the account's when it was sent as the buyer in its own conversations, or as the seller in its shop's conversations while not `seller_gone`. Offers' first messages count for the shop.
- The conversations limit is checked first. Both windows slide; nothing resets at midnight. `start_offer` checks the hour's messages after its 20 offers a day.
- The count and the write run under `pg_advisory_xact_lock` on the sender (stage K spec item 11), so messages sent at the same moment can't slip past.
- No sample-account exemption (decision 9).
- **Also here (found in Task 6b):** `create_report` refuses a hidden listing (`hidden_at is null`), as the app's `reportSubject` does through `publicListing`. Today a student can report a hidden listing through the API.

## Task 10: Seed

Tests: `scripts/seed-sql.test.ts` (extended).

`scripts/seed-sql.ts` also emits, from the fixtures the sample store uses:
- the 16 Looking For requests (`data/fixtures/request-rows.ts`), no asker, `seed_offers` kept;
- the 18 Hub posts (`data/fixtures/staff.ts:24`; h-002, h-007 and h-012 by the sample mentor), the two mentor notes (`:34`) and the open booking (`:58`);
- pickup points from `samplePickupPointRows` (`:16`, with `retired_at`);
- the seller profiles' `mentor_id` and `approved_at` (`data/fixtures/accounts.ts:43`).

The notification check (`:431`) accepts the new kinds. The generated `supabase/seed.sql` is regenerated with `pnpm tsx scripts/make-seed.ts` and committed. The fixtures themselves don't change.

## Task 11: Types, advisors, docs

1. `supabase gen types typescript --local > lib/supabase/database.types.ts`; `pnpm typecheck`.
2. `supabase db reset`, `supabase test db` (all pass), `supabase db lint`, and the security and performance advisors on the local stack: nothing reported, or each item explained in the migration.
3. A grant test across the whole schema: `anon` executes only a named allowlist of read-only helpers (phase A's `private.shop_is_public`, and `request_offer_count`, `follower_count`, `hub_going`), no API role has insert, update or delete on any table (the `form_states` exception named), and every `public` table has RLS on (extends phase A's check).
4. Docs: this plan's "Changes made during the build" and its ledger, on the branch. `docs/PROGRESS.md` and the spec's section 4.2 table plus an amendment for decisions 1, 2 and 6 are written on main at merge time, since main has other sessions' uncommitted edits to `PROGRESS.md`.

## Task 12: Staging checkpoint 1 (Lama's go-ahead)

1. Lama logs the CLI in to "Vossie Market" from their own terminal (a scoped token).
2. `supabase migration list --linked`: confirm phase A's eight are there.
3. `supabase db push --linked --dry-run`: show Lama the list.
4. On Lama's go-ahead: `supabase db push --linked`. Seeding staging again only if Lama asks (it holds no real data).
5. `migration list --linked` shows local and remote equal; the advisors on staging report nothing.

---

## Review

One combined reviewer (plan, then quality) after Tasks 1 to 3 (schema), and one after Tasks 4 to 9 (functions), each time-boxed to about 25 minutes, read-only, running `supabase test db` only. The final review of the step, by the most capable model, checks every access rule against the stage specs' "who sees what" before Task 12.

## Ledger

| Task | Status | Commit |
|---|---|---|
| 0 Worktree | done: `../Vossie-backend` at `0b969aa`; local reset, 803 pgTAP pass | none |
| 1 Widen | done, checked by the controller: 914 pgTAP pass (803 + 111) | `20cbcbc` |
| 2 Staff tables | done, checked by the controller: 1,080 pgTAP pass (914 + 166) | `a933bc3` |
| 3 Community tables | done, checked by the controller: 1,204 pgTAP pass (1,080 + 124) | `334baa0` |
| 4 Staff shop actions | done, checked by the controller: 1,357 pgTAP pass (1,204 + 153) | `4e14d3b` |
| 5 Staff tools actions | done, checked by the controller: 1,565 pgTAP pass (1,357 + 208) | `1caeb05` |
| 6 Community actions | done, checked by the controller: 1,732 pgTAP pass (1,565 + 167) | `4135704` |
| 6b Staff-paused storefront | done, checked by the controller: 1,797 pgTAP pass (1,732 + 65) | `a6004e7` |
| 7 Numbers | done, checked by the controller: 1,876 pgTAP pass (1,850 + 26) | `1dd53b8` |
| 8 forget_account | done, checked by the controller: 1,930 pgTAP pass (1,876 + 54) | `1cc0850` |
| 9 Message limits | done, checked by the controller: 1,850 pgTAP pass (1,797 + 53) | `89fe8a7` |
| 10 Seed | done, checked by the controller: 1,930 pgTAP, 23 seed tests | `1e88878` |
| 11 Types, advisors, docs | done: types regenerated, grants test (1,934 pgTAP), advisors info-only | `f69327d` |
| Final review fixes (I1, M1, M2) | done, checked by the controller: 1,957 pgTAP pass (1,934 + 23) | `00b8a78` |
| Mentor name blanked on deletion (M3, Lama's choice) | done, checked by the controller: unit 2,476, pgTAP 1,976 | `b7bf6a9` |
| 12 Staging | waits on Lama's login | |

## Changes made during the build

**Plan review (2026-10-20, read-only, before any SQL).** Three critical findings, all fixed in this plan:
- An offer is marked by `is_offer`, never cleared, not by `request_id`, which a deleted request nulls. Otherwise its threads would turn into enquiries, or `delete_request` would fail on the question-thread index.
- `start_conversation` is replaced in the same migration as the indexes it targets (Task 3, not Task 9). Otherwise its `on conflict` would stop matching them.
- `featured_draws` has a surrogate key, because a primary key can't hold "every campus" (null).

Important findings, also fixed:
- **Order:** the offer columns moved to Task 3; `set_shop_paused` is replaced in Task 1; backfills come before each new check.
- **Column grants:** the reports `note` and `closed_by` columns are hidden from reporters; `mentor_id` is hidden from owners; `taken` can't be updated by its owner.
- **Helpers:** `private.is_my_request` gives the asker their requests and `public.staff_hub_posts` gives staff `author_id`, both without exposing the column.
- **Staff reads:** `is_staff` read policies on phase A's tables (Task 2).
- **Wording:** notification wording is built in SQL for every function `authenticated` can call.
- **Locks:** follows, saved searches, offers, pins and RSVPs are counted under a lock.
- **Notifications:** `count >= 1`.
- **Grants:** the anon grant test uses an allowlist.
- **Hub covers:** the flow is named (`add_hub_photo`, `hub-draft`).

Minor findings folded in:
- the slug change's report move;
- the shop never reading the asker's profile;
- mentor notes hidden while the shop is pending;
- pins only for shops with a listing that isn't hidden;
- SQL's limited "has words" check;
- docs written on main at merge time;
- where Task 9 reads stage K's constants.

**Mentor name blanked on deletion** (Lama's answer to M3, 2026-10-20; `20261020121100_audit_related_account.sql`, `23_audit_related_account.test.sql`; app files too):
- Only `mentor-assigned` names a third person in its detail. `mentor-removed` names nobody, `role-removed` names shops, and a booking entry names its own subject.
- The entry now records the mentor as `relatedId` (store) or `related_id` (database, readable by no API role, set null on delete).
- Deleting that account replaces the detail with "Deleted account", so a namesake keeps her name.
- `private.record_audit` was dropped and recreated with an optional `related` argument, since an overload would make the six-argument calls ambiguous.
- The privacy settings' staff line and the stage J spec say so.
- `STORE_VERSION` goes to 11 at the merge (main's stage K already took 10).

**Final review (2026-10-20, opus, read-only): ready for staging; no critical findings.** Checked against the specs and confirmed:
- every access rule, read against the specs' "who sees what";
- the final version of each function replaced several times keeps every change;
- the migration order is safe on staging's data;
- `forget_account` against `deleteAccountData`;
- every limit is counted under a lock;
- every planned task was built.

Fixed in `20261020121000_review_fixes.sql`:
- **I1:** `audit_log` was granted to `authenticated` whole, so an admin could read `subject_id` and, through staff's read of profiles, name a hidden request's asker. The spec says the asker is never shown, and the app never shows `subject_id`. It's now a column grant without `subject_id`.
- **M1:** `mentor_shop_numbers` caps `p_now` at `now()`, as `admin_weekly_counts` does. Otherwise a mentor could slide the window to time single enquiries.
- **M2:** `set_shop_mentor` locks the mentor's profile (`for share`), so it can't race `remove_role('mentor')`.

Left as they are:
- **M3, a POPIA question for Lama:** a deleted mentor's first name stays in the `detail` of `mentor-assigned` audit rows. The app's `forgetAccountInStaffTools` does the same, so any change would be to both.
- **M5:** a rare four-way deadlock between account deletion, an offer and a message would abort one transaction, which is the accepted Task 8 retry.
- **M4, for phase C:** `/photos/[id]` must refuse `hub-draft` photos, covers of unpublished posts and hidden listings' photos. The user's session can't delete a taken, unexpired one-time token, so sign-out-style clean-ups use the admin client or the session cascade.

**Task 11:**
- **Types:** regenerated with `pnpm db:types`. Lint and types are clean.
- **Grants:** `21_grants.test.sql` (4 tests) pins the schema's grants.
  - The API roles write no `public` or `private` table directly, except their own `form_states`. Storage keeps Supabase's default grants, locked by RLS with no policies.
  - Every public table has RLS.
  - anon runs only `hub_going`, `request_offer_count` and `shop_is_public`.
- **Advisors** (local, all levels): no warnings or errors. The info-level items, each expected:
  - unused indexes, because the local stack has no traffic;
  - RLS on with no policies on `private.code_sends`, `policy_versions`, `sign_in_attempts`, `featured_draws` and `shop_previous_slugs`, all server-only by design;
  - phase A's `consents_version_fkey` without a covering index, on a table of a few policy versions.

**Task 10:**
- **Seed:** the 16 requests, 18 Hub posts, two mentor notes, the open slot request, pickup points with retirement (same 24 ids, now with the fixtures' `created_at`), and seller profiles' staff fields.
- **The generator refuses what it can't place:** it throws on an unknown author or post, and on a fixture conversation with a `requestId` (sample requests have no asker).
- **Tests 08, 14 and 17** now use their own request ids (`r-901`…) or filter to their own rows, since the seed fills those tables. The controller made those three edits, because the implementer's brief kept it to the seed files.

**Task 8** (`20261020120900_forget_account.sql`, `10b_account_deletion_g_to_j.test.sql`; 54 new tests):
- **Every step is explicit SQL, with the foreign keys as a backstop.**
  - Deleting the Auth user without `forget_account` fails (23503 on `conversations_request_id_fkey`) when the user has an offer thread: Task 3's catch.
  - Clearing two links on one row through cascades is fragile, for example an audit row the account both wrote and is the subject of.
- **Phase A's steps are kept line for line.** Test 10 is unchanged; the new cases are in 10b.
- **Open questions, recommended answers taken:**
  - `featured_draws.shop_ids` may keep a deleted shop's id, as the app's store does, and `featuredFor` skips it.
  - There's no profile lock at the start, as in phase A. A deadlock with a message being sent at that moment would abort one transaction, and phase C retries the deletion once.

**Task 7** (`20261020120800_numbers.sql`, `19_numbers.test.sql`; 26 new tests):
- **Server only (the recommended answer to the implementer's question).** No API role can run `admin_weekly_counts`, admins included, so the raw counts of 1 to 4 never reach an API caller (CLAUDE.md: private counts only through `protectCounts`). Phase C calls it with the admin client after `requireStaff('admin')`. This is the one staff read that doesn't go through the staff member's session (decision 1 covers writes).
- **Shape:** one row per non-zero count, `(measure, period, campus_slug, count)`. `open-shops` has period `now`, and a gone campus is null. The migration's header shows how phase C builds `RawCounts`.
- **Open shops follows the app's `liveSellerRows` and `listedListings`, not Task 6b's storefront rule:**
  - an approved or ownerless shop with an available listing that isn't hidden counts;
  - a paused shop, whoever paused it, doesn't.
- **`p_now` is capped at `now()`,** so a future date can't turn the current week into "last".

**Task 9** (`20261020120700_message_limits.sql`, `20_message_limits.test.sql`; 53 new tests):
- **The sender's lock.** It is `pg_advisory_xact_lock(hashtext('vossie:messages:<uuid>'), 1)`. Its second key, 1, is a namespace of its own: every other lock uses key 0 or the one-key form.
  - `start_conversation` decides whether a thread is new under that lock, so two posts at the same moment can't both count as new.
  - `send_message` takes it before locking the conversation row, so a re-join and a reply can't deadlock.
  - `start_offer` takes the shop's offer lock and then the sender's, always in that order.
- **Kept on purpose, the recommended answer: a different order from the app.** In `send_message`, `not-found`, `closed` and `waiting` come before `message-rate`, where the app's `sendReply` checks the limit first. Both refuse and write nothing. The only difference is which message someone at the limit sees when replying in a thread that's also closed. Stage K's rule on check order concerns the scam-words warning, which this doesn't affect.
- **For Task 10:** the seed keeps `student@vossie.test`, which the no-exemption test looks up.

**Task 6b** (`20261020120600_staff_pause_storefront.sql`, `18b_staff_pause_storefront.test.sql`; 65 new tests):
- **One storefront rule.** `private.shop_is_public` matches `hasStorefront` (no owner, approved, or paused by the seller), and `shop_has_storefront` calls it.
- **Every place that decides visibility was checked against the app:**
  - the shops, listings, photo and pickup-point policies now follow it;
  - `start_conversation`, `create_report` and `follow_shop` answer `not-found` for a Hub-paused shop, as the app's null subject does;
  - `send_message` in an existing thread, and `start_offer`'s `paused`, are unchanged, as in the app;
  - first publish, search matches and pins already needed `approved`.
- **Kept, the recommended answer:** a buyer with a conversation, or a follower, still reads a paused shop's row through `private.is_shop_contact`. The app shows its name in their threads (`messages.ts:90`, amendment 19.3) and on Saved for unfollowing (amendment 17.6). Its listings and photos stay hidden from them. They can also see its pickup points, which are public campus places.
- **Found:** `create_report` doesn't refuse a hidden listing. Fixed in Task 9.
- **Environment:** the machine's load was high (about 80), so the CLI's local connections sometimes timed out and were retried.

**Task 6** (`20261020120500_community_actions.sql`, `18_community_actions.test.sql`; 167 new tests):
- **`start_offer(request, listing, body)`** takes the shop from the session (identity from the session). It returns `listing-invalid` for a listing that isn't one of the shop's listed ones, where the app silently drops it.
- **Offer threads are named by the request's current title** in message and sale notifications, as the app does. `private.tell_other_side` and `mark_completed` are replaced through a new `private.conversation_title`.
- **`record_search_matches`** takes its texts as `{"<search id>": {"label", "href"}}` and builds the sentences in SQL.
- **`shop_link_moved`** first deletes new-listing notifications already on the new link. Only a shop that has gone could own them, and they would break the once-a-day index.
- **Test 08:** its four request-title checks became `is()` checks, because the caller's title is now ignored.
- **Open questions, recommended answers taken:**
  - `create_report` keeps its now-unused `p_target_title`, so its signature doesn't change; lint's warning is expected.
  - The staff-paused storefront gap became Task 6b.
  - Task 8's `forget_account` deletes `new-listing` notifications whose subject is a deleted shop's link.

**Task 5** (`20261020120400_staff_tools_actions.sql`, `17_staff_tools_actions.test.sql`; 208 new tests):
- **One-time tokens (I1):** the fix is tighter than planned. For `authenticated`, a taken token also can't change its session, form or account, and its expiry can only move later. Otherwise someone could expire it early, then delete it and insert it again. `take_once_token` returns `first`, `again` or `none`, and callers take the token only after every other check passes.
- **Hub covers:** `add_hub_photo(type)` takes no alt, because covers are decorative (alt ''). It also sweeps the Hub's waiting photos (over a day old, or beyond the newest 12) and returns their paths.
- **`save_hub_post`** adds the app's `date-past` and `cover-invalid` refusals.
- **`add_pickup_point`** refuses Online by `campuses.is_online`, and an unknown campus by its foreign key. The app's "campus already has points" test stands for the same thing.
- **`remove_role`** takes the lock only to remove an admin role from someone else, and re-checks the remover's role under it.
  - `last-admin` can't be reached from one session, because the caller is always a second admin, and there's no dblink for a true concurrency test.
  - The tests show instead that the lock is held, that a removed admin's own removal attempt is `forbidden`, and that one admin remains.
- **Earlier tests changed:** 13 asserts the triggers instead of the grant; 16 adds open reports before hiding.
- **For phase C:**
  - `leaveOnceToken` must upsert, not delete and insert;
  - a draft's fields are read through `staff_hub_posts`.

**Task 4** (`20261020120300_staff_shop_actions.sql`, `16_staff_shop_actions.test.sql`; 153 new tests):
- **Arguments:** shop actions take the shop's uuid, so a new shop on an old link is a different shop (amendment 14.6). `approve_shop` and `decline_shop` take the owner's account.
- **Shop references keep the app's form:** audit `target_id` and notification `subject_id` stay the shop's link, as the app writes them.
- **Results:** `changed`, `nothing` or `forbidden`; a bad reason raises `check_violation`. `service_role` has execute but no session, so it always gets `forbidden`.
- **Helpers:** `private.record_audit` takes the staff member's id and name from the session, and `private.notify` skips a null account, so sample shops and requests tell nobody.
- **Wording:** seven `*_note_text` functions, checked against strings printed from the TypeScript.
- **Open questions answered** with the recommended choices: hiding needs an open report (Task 5), and `create_report` reads a request's title from the database (Task 6).

**Review of Tasks 1–3 (2026-10-20, read-only, no database commands):** approved.
- **Access:** no leaks of `asker_id`, followers, mentor notes, hidden listings or their photos, Hub drafts or authors, reports' notes, `mentor_id`, the audit log or the draws.
- **Replaced phase A functions:** each one was diffed and keeps its behaviour.
- **Correctness:** the value lists and limits match the TypeScript.
- **I1 (one-time tokens):** fixed in Task 5 (see that task).
- **Minor findings:**
  - Backfills can't be tested from an empty database. Read Task 12's dry run with this in mind; staging's seed has no paused profiles, reports or used link changes.
  - An admin who owns a shop sees its mentor through `staff_seller_profiles`. This matches the app, whose admin shop pages show every shop's mentor; notes stay hidden from the owner.
  - `request_offer_count` stays null for hidden requests to admins too: `/admin/hidden` shows no counts.
  - **For phase C:** `/photos/[id]` reads with the admin client, so it must refuse photos of hidden listings itself.
  - **For phase C:** `keep_is_offer` fires only on updates that name the column, which is enough while only definer functions write conversations.

**Task 3** (`20261020120200_community_tables.sql`, `15_community_tables.test.sql`; 124 new tests):
- **`my_conversations` gains columns.** Phase A gave a shop no way to name a buyer, so these are new:
  - `buyer_name` (`messages.ts:116`): null while an asker hasn't written in an offer thread, and once the buyer has gone;
  - `buyer_gone`, a generated column, so the shop tells "Deleted account" from the unnamed asker without reading `buyer_id`;
  - `request_state` (`live`, `gone` or `hidden`; the shop sees a hidden request as `gone`, `OfferAbout.tsx:40`).
- **`public.my_requests`** lists an asker's own requests, since no API role can read `asker_id`.
- **Requests' policies are one per role,** with the plan's two conditions joined by OR, to avoid the advisor's multiple-permissive-policies warning.
- **Admins read every request** (for Show again).
- **The "closed exactly when `closed_at` is set" check excludes samples.** Two fixture samples are closed with no `closedAt` (`request-rows.ts:21`).
- **`follower_count` is for the shop's owner only.** The count is shown only on the seller's own dashboard (`SellHome`, `Dashboard`); the admin's numbers count follows through their own function.
- **`request_offer_count` is null for a hidden request,** except to the asker.
- **For Task 8:** a cascade that deletes a request and nulls `buyer_id` on an offer thread touched earlier in the same transaction fails its foreign key check. So `forget_account` nulls `buyer_id` before deleting the profile, as phase A already does, and deletes requests first.

**Task 2** (`20261020120100_staff_tables.sql`, `14_staff_tables.test.sql`; 166 new tests):
- Staff read phase A's tables through replaced signed-in policies (one policy per role).
- The staff views (`staff_hub_posts`, `staff_reports`, `staff_seller_profiles`) are `security_invoker` views over `private` helpers that return rows only to the right staff, so the advisor doesn't flag them. They don't push filters down, which is fine at Vossie's sizes.
- Mentor notes and numbers need an assigned mentor, admins included (`mentors.ts:20` skips shops without one).
- A mentor reads an assigned shop's listings in every state, drafts included, as an admin does.
- Mentor-number enquiries count `listing_title is not null`, because SQL nulls `listing_id` when a listing goes.
- A post has either placeholder art (`image_src`) or a cover photo, never both.
- Test 06's allowlists name the new read helpers.

**Task 1** (`20261020120000_widen.sql`, `13_widen.test.sql`; 111 new tests):
- `update_shop` is replaced too. Its link change is the same one as `change_shop_slug`, so both now check old links and record them.
- Two more checks mirror the app: `seller_paused_too` only under a pause by staff, and `declined_at` only while the shop is pending.
- The listing-photo policy needed no change: it reads through the listings policies, so a hidden listing's photos are hidden too.
- There's no SQL sweep for waiting photos (phase A has none; the file sweep is phase C's Vercel Cron), so `hub-draft` is a comment for now and Task 5 does the row side.
- Phase A tests 01, 03, 04, 07 and 08 now state the new rules: retired points are readable, a pause sets `paused_by`, a closed report has an outcome and `closed_at`.
- **Open, moved to Task 4:** phase A's `reports_one_open_per_target` ignores `target_gone`, but the app's duplicate check doesn't (`reports.ts:54`). So an open report on a deleted shop would block a report on a new shop with the same link. Task 4 replaces the index (`where status = 'open' and not target_gone`) and `create_report`.
- **Open, for phase C:** `shop_previous_slugs` has no API read, so the owner's list of old links (`shops.ts:443`) needs a function or the admin client.

**Task 0:** `supabase db reset` timed out waiting for the storage container's health check after the database had been rebuilt. The container came up healthy on its own a minute later. The reset itself completed: 8 migrations, 38 listings, 30 shops, 5 accounts and the `photos` bucket, and 803 pgTAP tests pass.
