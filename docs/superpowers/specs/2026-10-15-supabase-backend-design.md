# Vossie on Supabase: backend design spec

- **Date:** 2026-10-15
- **Status:** Draft for Lama's review. Nothing is built yet.
- **Scope:** the real backend that replaces the sample store: Supabase projects, the database schema, access rules, sign-in, photo storage, scheduled jobs, and how the app's `lib/data` layer moves across without disturbing the frontend work in progress.
- **Decided by Lama (2026-10-15):** a fresh project (the old demo's stays untouched), Ireland (London at first, changed the same day: section 2.3), Free now and Pro at launch, and Supabase Auth for sign-in. They join the decisions log when this spec is approved (another session is editing the log today, so the numbers are given then).

## Related documents

| File | What it is |
|---|---|
| `docs/reference/GO-LIVE.md` | Section 6 (backend), POPIA and legal, production, section 7 (open decisions) |
| `docs/reference/FUNCTION-MAP.md` | The old demo's schema (section 6), for reference only |
| `docs/superpowers/specs/2026-10-14-accounts-design.md` | Sign-in, sessions, consent, deletion and export: the behaviour this backend must keep |
| `docs/superpowers/specs/2026-10-14-messaging-design.md`, `…-selling-design.md` | Stages E and F: conversations, reports, notifications, shops, listings, photos |
| `docs/superpowers/specs/2026-10-14-staff-tools-design.md`, `…-community-actions-design.md`, `…-search-alerts-design.md` | Stages G, H and I: tables still to come |
| `docs/superpowers/plans/2026-10-15-supabase-foundation.md` | The build plan for phase A of this spec |

---

## 1. Goal

Real students can sign in, message, sell and report on a database that keeps working when the server restarts or runs on several machines. The app's screens and behaviour stay as built and tested in sample mode. The move happens behind `lib/data` and `lib/auth`, one area at a time, while the frontend stages carry on.

## 2. Decisions

1. **A fresh Supabase project, built only from migrations in the repo.** The old demo's project (`vxqgcaznbwhwgvauupby`, Ireland) stays as it is, so the live demo keeps working. Its schema is different, and nothing is copied from it. If it holds real students, moving them is a separate, later script.
2. **Three environments:**

   | Environment | What it is | When |
   |---|---|---|
   | Local | `supabase start` in Docker on Lama's Mac (Postgres, Auth, Storage, Studio, and Mailpit for codes). Built from the migrations and `seed.sql`; reset at will | Phase A |
   | Staging | Supabase project **"Vossie Market"** (ref `kahzsitqnocygsrdfpre`), **Free plan, Ireland (eu-west-1)**, Postgres 17. Made by Lama on 2026-10-14 | Phase A |
   | Production | Supabase project `vossie-prod`, **Pro plan, Ireland (eu-west-1)** | At launch (phase E) |

   Free projects pause after 7 days without use and have no backups; that's fine for staging. Production needs Pro for no pausing, daily backups and the CDN purge on delete. Two projects on Pro cost about $35 a month; Supabase branching is left out because its compute isn't covered by the plan's credits.
3. **Ireland, and Vercel's functions pinned there too (`dub1`).** Supabase has no African region (it was withdrawn after an alpha), and a project's region can't change after it's made. Lama first chose London, which measures about 10 ms closer to Johannesburg. The staging project Lama had already made is in Ireland, though, so both environments go there (Lama, 2026-10-15). Staging then behaves like production, the old demo was there too, and the draft privacy page's "Ireland" stays true. Delay from Johannesburg is about 160 to 170 ms. Vercel's default region is Washington (`iad1`), so the app's functions must be moved to Dublin beside the database, or every query pays the trip twice. Pages and files are still served from Vercel's edge in South Africa.
4. **Sign-in uses Supabase Auth's email code**, called only from Server Actions. Supabase generates, hashes, expires and emails the code, and keeps the session. The screens don't change (section 5).
5. **Supabase is only ever called from the server.** There's no Supabase client in the browser, so the JavaScript budget is untouched and the session cookies can be `httpOnly`. Three server clients for data:
   - **public**: no cookies, the publishable key, used inside `"use cache"` functions for what anyone may see (listings, shops, collections, requests, Hub);
   - **viewer**: the request's cookies and the publishable key, used inside `<Suspense>` for the signed-in person's own data, so the database's access rules know who is asking;
   - **admin**: the secret key, which bypasses the access rules. Only for jobs, account deletion, staff tools and photo files, and only from files that import `server-only`.

   A fourth, **auth** client (the request's cookies, the secret key and the student's IP address in `Sb-Forwarded-For`) is used only by the sign-in Server Actions, for `signInWithOtp`, `verifyOtp` and `signOut`, and never for data. Supabase accepts the forwarded address only with a secret key, and without it every student shares Vercel's address for Supabase's per-address limits (30 tries per 5 minutes).
6. **Only the new keys.** The publishable key (`sb_publishable_…`) and the secret key (`sb_secret_…`). The legacy `anon` and `service_role` keys are turned off on day one (Supabase retires them by the end of 2026). JWTs are signed with the default asymmetric keys, so checking a session is local and fast.
7. **Every table has access rules (RLS) and explicit grants.** From 30 October 2026 Supabase no longer grants new tables to its API roles automatically, so each migration grants exactly what's needed, turns RLS on, and adds the policies. Nothing is readable by default.
8. **Plain, numbered SQL migrations** in `supabase/migrations/`, written by hand and tested locally before they reach staging. Supabase's declarative schemas run on a tool that is still in alpha, so they aren't used.
9. **Access rules are tested.** Every policy has pgTAP tests in `supabase/tests/` (`supabase test db`), and Supabase's security and performance advisors must report nothing before a migration goes to staging.
10. **Sample mode stays.** Unit tests and the current Vercel preview keep using the in-memory store. A new setting, `VOSSIE_BACKEND=supabase`, switches the app to Supabase; `sample` stays the default until production.

## 3. Moving across without colliding with the frontend

The frontend is mid-stage (stage F's onboarding is in the working tree, and stages G, H and I are planned). Backend work is ordered so it never edits the same files at the same time.

| Phase | What | Touches app code? | Can run beside frontend work? |
|---|---|---|---|
| **A. Foundation** | Staging project, `supabase/` folder (config, migrations for every table stages D to F use, access rules, functions, storage, jobs, seed, pgTAP tests), generated types, `lib/supabase/` clients (not yet imported), env docs | Only new files | **Yes**, in its own git worktree and branch |
| **B. Sign-in** | `lib/auth` on Supabase Auth, `proxy.ts`, email provider, the `vossie_auth` cookie on the privacy page | `lib/auth/*`, `lib/data/accounts.ts`, `sessions.ts`, `sign-in.ts`, `form-states.ts` | After stage F lands; these files are quiet then |
| **C. Data** | Each `lib/data` module gets its Supabase version behind the same function signatures, with contract tests | `lib/data/*` | One module at a time, when no frontend stage is editing it |
| **D. Later stages** | Each of G, H and I adds its own migration as part of that stage's build | That stage's files | Part of the stage |
| **E. Launch** | `vossie-prod` on Pro, the production email domain, `VOSSIE_BACKEND=supabase`, sample mode off, backups checked | Config | At launch |

**The contract is `lib/data`'s exported functions.** Their names, arguments and results don't change. A shared set of contract tests runs against both versions: the sample store in `pnpm test`, and a local Supabase in a new `pnpm test:db` (it needs `supabase start`).

## 4. The database

### 4.1 Conventions

- **Schemas:** `public` holds the tables the app reads and writes through Supabase's API. `private` holds helper functions and tables that must never be reachable through the API (sign-in attempts, code counters, job state). `private` is not exposed.
- **Ids:**
  - Accounts use Supabase Auth's user id (`uuid`).
  - Listings, requests and Hub posts get a short random text id (10 characters, `a-z0-9`). They appear in links, and listing ids are stored in the `vossie_saved` cookie (up to 100 of them), where a 36-character uuid would come close to the 4 KB cookie limit.
  - Everything else uses `uuid` with `gen_random_uuid()`.
- **Shops have a surrogate `id`.** The slug is unique, changeable and used in links, but nothing refers to a shop by its slug, so a slug change (selling plan decision 16) changes one row instead of cascading through listings, conversations and reports.
- **Times** are `timestamptz` (UTC). Rules that count SAST days use `(at time zone 'Africa/Johannesburg')::date`, so the server's own time zone never matters.
- **Text limits are `check` constraints** that match `lib/*/rules.ts` (Postgres's `char_length` counts code points, as the app does). The app still checks first, to show its own errors; the constraints are the backstop.
- **Lists of values** (listing state, conversation status, report reasons, notification kinds and so on) are `text` with a `check (… in (…))`, so a later stage adds a value with one `alter`.
- **Copies of names are kept on purpose** where the specs keep them: a conversation keeps the listing's title, and a report keeps its target's title.

### 4.2 Tables for stages D to F (phase A)

| Table | Holds | Notes |
|---|---|---|
| `campuses` | 12 campuses and Eduvos Online: slug, name, region, sort order | Seeded. The live-listings count becomes a query |
| `categories` | The ten categories | Seeded |
| `pickup_points` | Per campus, with `retired_at` | Seeded with today's 24; stage G edits them |
| `profiles` | One per account: `id` (= auth user), first name, campus, roles (`mentor`, `admin`), created at | Made by the app on first sign-in, not by a trigger, so an unfinished sign-in leaves no profile |
| `consents` | Account, policy version, agreed at | One per account and version |
| `seller_profiles` | Account, status (`pending`, `approved`, `paused`), shop, applied at | The shop's status lives here (selling plan decision 1) |
| `shops` | Slug, owner, name, tagline, category, campus, verified, badge, about, since, image, slug changed, times | Name unique per campus by its normalised key |
| `shop_pickup_points` | Shop ↔ pickup point | Replaces the row's id array |
| `onboarding_drafts` | One per account | |
| `listings` | Everything on `ListingRow`, with `shop_id` | `first_published_at` is set once and never cleared (amendment 9.2) |
| `listing_photos` | Listing, photo, position, alt | Ordered; the first is the cover |
| `photos` | Owner, use, type, storage path, created at | The file is in Storage (section 6) |
| `conversations` | Listing (kept as a title if the listing goes), shop, buyer, seller gone, status, times, confirmed by | One per buyer and listing, and one per buyer and shop for questions |
| `messages` | Conversation, side, body, swap offer, sent at, read at | |
| `reports` | Reporter, target kind and id, target title, reason, detail, status, created at | One open per reporter and target; 10 per 24 hours |
| `notifications` | Account, kind, subject, text, link, created at, read at | One unread message notification per conversation |
| `form_states` | Session, form, errors, values, notice, expires at | Keyed by the Auth session's id |
| `private.sign_in_attempts` | The `vossie_signin` attempt: step, email, errors, wrong tries, profile answers, expiry | Keyed by an HMAC of the cookie's token (GO-LIVE: keyed hashes) |
| `private.code_sends` | Email, hour, count | The 5-codes-an-hour limit, as one atomic upsert |

Collections, hero slides, announcements and trending searches stay as fixtures in code for now: they are editorial and change with releases. The Hub's posts and requests move in stages G and H.

### 4.3 Who can see what (RLS)

| Data | Anyone | Signed in | The owner | Staff |
|---|---|---|---|---|
| Campuses, categories, live pickup points | read | read | | edit (G) |
| Shops | read if approved or paused | same | read and edit their own, any status | all (G) |
| Listings | read if not a draft and their shop is approved or paused (and not hidden, G) | same | all of their shop's, and edit them | all (G) |
| Photos | through `/photos/[id]` only (section 6) | | | |
| Profiles | no | no | read and edit their own name and campus | read (G) |
| Conversations and messages | no | no | the buyer, and the shop's current owner unless the seller has gone | reports only (G) |
| Reports | no | create | read their own | all (G) |
| Notifications, consents, form states, drafts | no | no | their own | |
| `private.*` | no | no | no | server only |

These are the rules in `lib/data/catalog.ts` (`publicListing`, `storefrontRow`, `listedListings`) and `messages.ts` (`sideOf`), written once in SQL as `security definer` helpers in `private` (with `search_path = ''`) and used by the policies. Policies use `(select auth.uid())` and every column they filter on has an index.

**Staff roles are checked against the `profiles.roles` column at the time of the request**, through `private.is_staff(area)`, not stored in the JWT. A role removed by an admin stops working at once, and a broken claims hook can't stop everyone signing in.

### 4.4 Writes that must be atomic

Steps that span several rows, or that count against a limit, are Postgres functions called as one statement, never a read followed by a write in TypeScript:

- **sign-in:** count a wrong try before comparing (`private.record_wrong_try`), and reserve one of the 5 codes an hour (`private.reserve_code_send`);
- **messaging:** start a conversation (or reuse the open one), send a message (with the first-reply time, the status move and the one-unread-notification rule), complete, confirm and reject a sale;
- **reports:** create one, within one open per target and 10 a day;
- **selling:** save or publish a listing (state moves, `first_published_at`), change a shop's slug once, pause or resume a shop;
- **account deletion:** see 4.5.

### 4.5 Deleting an account and exporting its data

- **Deletion** keeps the order and rules of `deleteAccountData` (accounts spec 13, messaging and selling specs). First `private.forget_account(uid)` runs the messaging rules (the other side keeps their messages, `seller_gone` is set, a done sale goes back to replied, empty conversations go) and removes the shop, listings, drafts, photos (their files too) and reports by the account. Then the Auth user is deleted with the admin client, and foreign keys clear the rest. It is one request, and it is immediate (POPIA).
- **The export** stays assembled in TypeScript from plain queries. Postgres's `jsonb` sorts keys, and the export's key order is tested.

## 5. Sign-in on Supabase Auth

The three steps on `/login` stay exactly as built: email and consent, the 6-digit code, then first name and campus on a first sign-in. Every step is a plain form posting to a Server Action, without the app's JavaScript.

1. **Step 1 (email):**
   - the app checks the domain and the privacy box as today;
   - it reserves one of the email's 5 codes this hour;
   - it calls `signInWithOtp({ email, options: { shouldCreateUser: true } })` with the auth client, which forwards the student's IP address, so Supabase's per-address limits apply to each student, not to all of Vercel (the address comes from Vercel's own `x-real-ip` header, which a visitor can't set);
   - Supabase emails the code.
2. **Step 2 (code):**
   - a wrong try is counted atomically before anything is compared, and the 5th ends the attempt, as today;
   - `verifyOtp({ email, token, type: "email" })`, on the auth client, checks the code and, on success, sets the session cookies (Server Actions may write cookies).
3. **Step 3 (first sign-in only):** if the account has no profile yet, the app asks for a first name and campus, then creates the profile and records consent.

**Settings:**
- codes are 6 digits and last **10 minutes** (`otp_expiry = 600`);
- the email template is Vossie's own, showing `{{ .Token }}`;
- a **"before user created" hook** refuses any address outside the allowed domains. It refuses by default, and reads the domains from `private.allowed_email_domains`, so staging can allow a test domain without a code change. The Server Action keeps its own check, for the friendly error;
- users who never finish signing in are removed after a day (section 7).

**Sessions:**
- Supabase's cookies are renamed to **`vossie_auth`**, so every cookie stays `vossie_…` (the privacy page's test enforces it). They are `httpOnly`, `SameSite=Lax` and `Secure` in production;
- `getViewer()` uses `getClaims()`, which checks the session's signature locally, then reads the profile. `requireAccount()` is unchanged;
- deleting the account and every staff action re-check with Supabase (`getUser()`), so a session ended elsewhere can't be used for them;
- a session lasts **30 days from the last visit**. Supabase renews the session while it's in use, so this is a sliding 30 days, not 30 days from sign-in (a change from accounts spec 2.5, for Lama to confirm);
- signing out ends this browser's session only (`scope: "local"`).

**`proxy.ts`** (Next 16's name for middleware) renews the session before pages render, because Server Components can't write cookies. It returns at once when there is no `vossie_auth` cookie, so signed-out visitors pay nothing. Its matcher skips static files, images and `/photos/…`. It adds Supabase's no-store headers to any response that sets a cookie, so a page carrying someone's session is never cached.

**Email** needs a sending service before anyone but Lama can sign in on staging. Supabase's built-in mail sends 2 emails an hour, only to the project's team, and Free projects on it can't change the template, so the code wouldn't even show. Locally, Mailpit catches every email. See open decision 1.

## 6. Photos

- **One private bucket, `photos`**, with a 5 MB limit and JPEG, PNG and WebP only. Files are stored as `{owner}/{photo id}`.
- **The app keeps checking and stripping photos itself** (`lib/photos`), before anything is stored. Supabase doesn't remove metadata.
- **`/photos/[id]` stays the only way to see a photo.** It reads the file with the admin client and sends it with `Cache-Control: private, max-age=31536000, immutable`, as today (amendment 9.4). A deleted photo is gone at once, with no CDN copy to purge, and Supabase's image resizing (Pro only) isn't needed, because the browser already shrinks photos to 1,600 px WebP before sending them.
- **Uploads stay in Server Actions**, since the forms work without JavaScript. Vercel refuses request bodies over 4.5 MB, though, which the 32 MB setting in `next.config.ts` can't change. With the app's JavaScript, six shrunk photos fit easily. Without it, six phone photos don't (open decision 2).
- **Waiting photos** older than a day, and files whose rows are gone, are deleted by a job (section 7).

## 7. Scheduled jobs

| Job | How often | Runs as |
|---|---|---|
| Confirm sales 7 days after "done" (`confirmed_by = 'auto'`) | Hourly | `pg_cron` |
| Delete expired sign-in attempts, code counters and form states | Hourly | `pg_cron` |
| Delete Auth users who never finished signing in, after a day | Daily | `pg_cron` |
| Delete waiting photos older than a day, and their files | Hourly | Vercel Cron calling a route protected by `CRON_SECRET` (files must be removed through the Storage API, not SQL) |
| Clear `cron.job_run_details` older than a week | Daily | `pg_cron` |
| Retention deletes for messages, reports and notifications | When Eduvos sets the periods | `pg_cron` |

The app's lazy settling (`settle()` on read) stays as well, so a sale is right on screen even between runs.

## 8. Settings and secrets

| Variable | Where | Note |
|---|---|---|
| `VOSSIE_BACKEND` | Server | `sample` (default) or `supabase` |
| `SUPABASE_URL` | Server | Not `NEXT_PUBLIC_`: the browser never talks to Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Server | |
| `SUPABASE_SECRET_KEY` | Server only | Bypasses every access rule. Never in a `NEXT_PUBLIC_` variable, a log or the repo |
| `VOSSIE_AUTH_HMAC_KEY` | Server only | Keys the hash of the sign-in attempt token |
| `CRON_SECRET` | Server only | For the Vercel Cron route |

- Real values live in `.env.local` (git ignores `.env*`) and in Vercel's environment settings; `.env.example` documents the names only.
- **The CLI's access to the account** uses a personal access token **scoped to the staging project only**, read-write, with an expiry (Supabase's scoped tokens became available on 6 October 2026). It never goes in a file in the repo. Best practice is to store it with `supabase login --no-browser`, typed into Lama's own terminal, rather than pasting it into a chat; phase A's first token was shared in chat, so it's revoked when phase A ends.
- The staging database password lives in Lama's password manager.

## 9. POPIA

- **Section 72 (data held abroad):** the data lives in Ireland (Supabase on AWS eu-west-1, and Vercel's functions in Dublin). Supabase's DPA includes the EU standard contractual clauses and a UK addendum; it doesn't mention POPIA. Whether that is an adequate safeguard under section 72(a) is for Eduvos's lawyers (added to GO-LIVE).
- **Who holds the production project:** Eduvos is the responsible party, so whose Supabase organisation and card hold `vossie-prod` is Eduvos's call before launch (open decision 3).
- **The privacy page** names Supabase and Vercel as operators, Ireland as where data is held, and the `vossie_auth` cookie, in phase B.
- **Staging holds no real student data.** Only seed data and test accounts, so it can sit on the Free plan without backups.
- **Storage objects aren't in Supabase's database backups.** Production needs its own copy of the `photos` bucket (phase E).

## 10. Open decisions

1. **The email service and sending domain.** Recommended: Resend, sending from an `auth.` subdomain of Vossie's own domain, with SPF, DKIM and DMARC. It needs the domain (not yet chosen; `NEXT_PUBLIC_SITE_URL` is a placeholder). Phase B waits on this. Test delivery to real Eduvos mailboxes first.
2. **Photos without JavaScript on Vercel.** Recommended: keep the plain form and accept fewer, smaller photos in one post without JavaScript (the total must stay under 4.5 MB), with a clear error that suggests adding them a few at a time. With JavaScript, nothing changes. This is a selling-spec amendment for Lama.
3. **Whose account holds production**, Lama's or Eduvos's (section 9).
4. **The sliding 30-day session** (section 5).
5. **Retention periods** for messages, reports and notifications (already open in GO-LIVE section 7).

## 11. Not in this spec

- Live updates (Supabase Realtime). Messaging spec 2.6 left them out.
- Search moving into Postgres. While listings number in the hundreds, the current search runs over the cached list of live listings. Full-text search with `pg_trgm` replaces it when the catalogue grows (about 2,000 listings), as the browse spec planned.
- Moving saved listings into the account (accounts spec decision 12). It follows phase C.
- Copying anything from the old demo's project.
