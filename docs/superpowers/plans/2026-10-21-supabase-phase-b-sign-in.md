# Supabase phase B: sign-in and accounts on Supabase Auth (build plan)

- **Programme:** `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md`, step 4. **Spec:** `docs/superpowers/specs/2026-10-15-supabase-backend-design.md`, section 5 (sign-in), 4.4 and 4.5 (atomic writes, deletion, export), 8 (settings) and 9 (POPIA); phase A's "Found for phase B" (`docs/superpowers/plans/2026-10-15-supabase-foundation.md`); stage K's spec and plan amendment 7 (`docs/superpowers/plans/2026-10-20-hardening.md:279`); the accounts spec (`docs/superpowers/specs/2026-10-14-accounts-design.md`, sections 2 and 3).
- **Goal:** with `VOSSIE_BACKEND=supabase`, a student signs in with the 6-digit code Supabase Auth emails them, the session lives in the `vossie_auth` cookie for a sliding 30 days, `getViewer()` reads the verified claims and the profile (roles read on every request), and sign-out, the data download and account deletion work on Supabase. Every screen, every form and stage K's shape stay as they are. Sample mode is untouched and stays the default.
- **Not in this phase:** phase C's data modules (catalog, selling, messaging, community, staff), the `VOSSIE_BACKEND` switch itself, allowed domains and reference data as migrations (all three in `2026-10-21-supabase-step-2b-and-phase-c-foundation.md`, written at the same time as this plan). Staff actions' own `getUser()` re-check goes in with their Supabase versions (C5); this phase provides `requireLiveAccount()` for them.
- **Where:** worktree `/Users/LamaNkuna/Projects/Vossie-backend`, branch `backend/phases-b-c`. Its base is level with main at `04aa943`, which has all of stage K (`fa71050`, `33acfcb`, `534af03`, `5aae6b0`), so no merge from main is needed to start (recheck at Task 0).
- **Status:** draft, 2026-10-21, for Lama's review. Nothing is built.

## Lama's decisions for this phase (2026-10-21)

1. **The live site uses the existing Supabase project "Vossie Market"** (ref `kahzsitqnocygsrdfpre`, Ireland, Free plan) and the Vercel address **https://vossie-pi.vercel.app** (no own domain yet).
2. **Allowed sign-in addresses:** any `@vossie.net` address (students are `eduv` + 7 digits, but the pattern isn't enforced) and `@eduvos.com`.
3. **Sessions:** a sliding 30 days, renewed while the student uses Vossie (closes the spec's open decision 4).
4. **Codes are emailed through Resend's custom SMTP from Lama's own verified domain, `wemakesites.co.za`** (amendment 21, Lama, 2026-10-21, replacing the first answer, Microsoft 365). Vossie goes live first as Lama's submission; Eduvos's official domain and mail come only if it wins, as a dashboard change. Lama types the Resend API key into the Supabase dashboard; secrets never pass through chat or code. The plan includes a one-email delivery test and a Brevo fallback that is only a dashboard change. The template must show the 6-digit code (it can only be changed once custom SMTP is on).

These change the spec in three places, recorded as spec amendments in Task 12: the staging project becomes the live one (spec 2.2), the email decision (spec open decision 1) is Resend from `wemakesites.co.za` for now, and the live project holds real student data (spec 9, "staging holds no real student data").

## Safety (from CLAUDE.md, highest priority)

- Implementers don't run `git add` or `git commit`; the controller checks and commits, staging files by path, one git command per tool call, with Lama's go-ahead. Main's controller and this one never commit at the same time.
- Local stack only (`supabase_*_vossie` containers, shared by every Vossie checkout): `supabase db reset` (local) is fine; **never `--linked` resets**. Leave `supabase_*_autoyard` containers alone.
- **Anything that changes the live project** (`db push`, `config push`, SQL in the dashboard, Vercel settings) is shown to Lama first (`--dry-run`, `config diff`, or a rolled-back dry run) and runs only on Lama's go-ahead for that run. Only Task 13 touches it.
- **No secret in chat, in a file in the repo, in a log or in a test.** Lama types the SMTP password, the Supabase secret key and `VOSSIE_AUTH_HMAC_KEY` straight into the dashboards. Local e2e generates its own throwaway HMAC key per run and reads the local stack's well-known keys from `supabase status -o env` at run time.
- Never kill `supabase start`, `pnpm install`, a build or a migration mid-run. Start only the servers a task names (ports 3300 and 3301 for this phase), and stop them by PID or port.

---

## Decisions made in this plan (for Lama to confirm or veto)

1. **`VOSSIE_BACKEND=supabase` turns sample mode off, whatever `VOSSIE_SAMPLE_MODE` says.** `isSampleMode()` becomes "sample backend and `VOSSIE_SAMPLE_MODE` isn't `0`". That one rule gives stage K's amendment 7: `authKey()` refuses the development key, `isSampleAccount()` is false, the sample buttons and the on-screen code disappear, and `/login/sample` signs nobody in. A new `signInMode()` says `"sample"`, `"supabase"` or `"off"`, and the sign-in code branches on it.
2. **Every code try is counted before Supabase checks it.** Supabase can't compare a code without `verifyOtp`, so "count a wrong try before comparing" (spec 4.4) becomes "count every try, atomically, before calling `verifyOtp`" (`record_wrong_try`, unchanged SQL). The 5th wrong try ends the attempt, as today, and a 6th post is refused without reaching Supabase. "That code isn't right. N tries left." stays exact.
3. **The sliding 30 days is built on the Free plan in two parts.** Supabase's inactivity timeout is Pro only (cited below), and refresh tokens never expire on their own. So:
   - the `vossie_auth` cookie gets `maxAge` 30 days instead of `@supabase/ssr`'s 400, and is rewritten at every renewal (about hourly while the student uses Vossie), so a browser forgets it after 30 idle days;
   - an hourly `pg_cron` job, `private.sweep_idle_sessions()`, deletes `auth.sessions` not refreshed for 30 days, so a copied cookie can't be renewed after that either. An access token already issued lasts at most its hour.
   If the project moves to Pro, Auth's own inactivity timeout replaces the job (a go-live line).
4. **The proxy renews sessions with the secret key and the student's address** (`Sb-Forwarded-For`), like the sign-in client, so Supabase's per-address refresh limit (150 per 5 minutes) counts each student, not all of Vercel. Its client exposes one call, `renew()`.
5. **`lib/auth` and `proxy.ts` reach Supabase only through `lib/data`.** The ESLint rule (only `lib/data` and `lib/supabase` import `lib/supabase` or `@supabase/*`) stays as it is. New `lib/data` modules: `auth-session.ts` (send, verify, sign out, claims, the live re-check, clearing the cookie) and `session-renewal.ts` (the proxy's renewal).
6. **Three new sign-in errors**, each with its own words, because Supabase can refuse in ways sample mode never did:
   - `code-soon`: "We sent you a code less than a minute ago. Wait a minute, then ask again." (Supabase's 60-second limit per address, `over_email_send_rate_limit`);
   - `ip-rate`: "Too many sign-ins from your network just now. Try again in a few minutes." (Supabase's per-address limits, `over_request_rate_limit`);
   - `send-failed`: "We couldn't send the code just now. Try again in a few minutes." (anything else, an SMTP failure included). The code count reserved for that send isn't given back: the 5 an hour count sends attempted.
7. **`getViewer()` on Supabase:** `getClaims()` checks the session, then the viewer client reads the profile, its roles and the seller profile, every request (React `cache()` per render only; nothing in `"use cache"` reads roles). The email comes from the verified claims. **A session with no profile is signed out** for every page (a student between step 2 and step 3), so an unfinished sign-in is never an account.
8. **Account deletion re-checks with Supabase** (`getUser()`, so a session ended elsewhere can't delete). Then `forget_account` with the admin client, retried once if Postgres reports a deadlock (`40P01`), then the photo files it returns are removed from Storage, then the Auth user is hard-deleted. If the Auth delete fails after `forget_account` succeeded, the account has no profile, so the daily `sweep_unfinished_users` job removes the Auth user within a day, and the page still answers with the "deleted" toast.
9. **Consent at a first sign-in is recorded when step 3 finishes** (`complete_profile` stamps `now()`), not at the moment the box was ticked on step 1, at most 30 minutes earlier. Returning sign-ins record it through `record_consent` at step 2, as today. Changing the SQL to take the tick time would let any caller back-date consent.
10. **The live project's sample data is cleared by a reviewed SQL script, not `supabase db reset --linked`.** `supabase/ops/clear-sample-data.sql` deletes the seed's accounts and content and keeps the reference data, inside one transaction. Lama runs it in the dashboard's SQL editor, first as a dry run that prints the counts and ends in `rollback`, then for real. A `--linked` reset drops everything the migrations made and needs explicit go-ahead every time (CLAUDE.md); the script needs neither.
11. **Auth settings reach the live project through `supabase config push`, never with SMTP in `config.toml`.** The CLI pushes only what the file declares and asks before each changed group, showing the diff (`supabase config push --help`, CLI 2.118). `config.toml` never declares `[auth.email.smtp]`, so the dashboard's SMTP settings, password included, are never overwritten. The code template is pushed only after custom SMTP is on (phase A: Supabase refuses template changes on its built-in email).
12. **The first admin is made outside the app by `private.make_first_admin(email)`**, which Lama runs in the SQL editor after signing in once. It refuses when any admin already exists, needs a finished profile, and writes one audit row ("Set up outside Vossie"). No API role can run it, and no page links to it. Every later role is given in the app (`giveRole`, stage J).
13. **Vercel's Supabase settings are for Production only.** Preview deployments (other branches) keep sample mode, so a branch preview never reads or writes the live database.
14. **The privacy page names both session cookies:** `vossie_session` (the preview, sample mode) and `vossie_auth` (the live site, with its possible `.0`/`.1` parts), Supabase and Ireland, Vercel's functions in Dublin, and who sends the code email (Microsoft 365 now, Brevo if the fallback is used). Wording in Task 9, for Lama.
15. **`takeFormState` on Supabase is phase C's.** Its callers (a new listing, staff one-time tokens) take the token inside their own SQL functions (`private.take_once_token`), and `authenticated` can't write `taken` (column grant). Phase B's Supabase form states do get, save and clear; `takeFormState` throws a named error on Supabase until C2/C5 replace its callers, and a test proves nothing in phase B's paths calls it.
16. **Live rate limits** (in `[remotes.staging.auth.rate_limit]`, Task 10): `email_sent = 100` an hour for the whole project (custom SMTP starts at 30 an hour; Microsoft 365 allows 30 messages a minute and 10,000 recipients a day, Brevo's free plan 300 a day), `sign_in_sign_ups = 60` and `token_verifications = 60` per 5 minutes per address (from 30), since a campus's Wi-Fi puts many students behind one address. Locally `email_sent = 1000`, so the e2e suite never waits.
17. **The CLI's remote stays named `staging` in `config.toml`,** with a comment that it's the live project, and its seeding is turned off (`[remotes.staging.db.seed] enabled = false`), so no `db push` can ever seed it.

## Open questions for Lama

1. **Real student data on the Free plan.** Free projects have no backups, pause after 7 days without use, and lack the session inactivity timeout. The spec put real data only on Pro (`vossie-prod`). Upgrade "Vossie Market" to Pro (about $25 a month) before real students sign in, or accept no backups until launch?
2. ~~Your student mailbox as the sender.~~ Closed by amendment 21: Resend from `wemakesites.co.za`, so no mailbox keeps copies. Resend keeps its own sending logs (with the recipient's address) for its retention period, so the privacy page names Resend as the email sender, in the US (POPIA section 72).
3. **The privacy page's wording** for the live site (Task 9), and whether Eduvos's sign-off is needed before any real student signs in.
4. **Plus addresses** (`eduv1234567+2@vossie.net`) still count as new addresses (GO-LIVE section 7). Unchanged here.

---

## What Supabase's docs say (checked 2026-10-21) and what this plan relies on

| Fact | Source | Used in |
|---|---|---|
| `signInWithOtp` makes the user unless `shouldCreateUser: false`; `verifyOtp({ email, token, type: "email" })` returns the session; a code is requested at most once every 60 seconds; the code email uses the Magic Link template with `{{ .Token }}` | supabase.com/docs/guides/auth/auth-email-passwordless | Tasks 4, 5 |
| Refresh tokens never expire but work once; the reuse interval is 10 seconds; time-boxed sessions and the inactivity timeout are "only available on Pro Plans and up"; access tokens default to 1 hour | supabase.com/docs/guides/auth/sessions | Decision 3, Task 2 |
| The proxy refreshes with `getClaims()`, writes the new cookies to the request (so Server Components don't refresh again) and to the response, and must copy `Cache-Control`, `Expires` and `Pragma` from `setAll`'s second argument; never trust `getSession()` on the server | supabase.com/docs/guides/auth/server-side/nextjs | Task 6 |
| `getClaims()` verifies against the project's JWKS when the signing key is asymmetric; with a symmetric key "it always sends a request to the Auth server" | supabase.com/docs/reference/javascript/auth-getclaims | Task 4, Task 13 (B5) |
| Custom SMTP: host, port, user, password, sender address and name; Supabase's own mailer sends 2 an hour to team members only; with custom SMTP the limit starts at 30 an hour, changed under Auth → Rate Limits | supabase.com/docs/guides/auth/auth-smtp | Task 13 |
| **How Auth stores email codes:** `GenerateTokenHash(emailOrPhone, otp)` is `sha256.Sum224(emailOrPhone + otp)` in hex, unkeyed, kept in `auth.one_time_tokens.token_hash` (and the user's `confirmation_token` / `recovery_token`) | github.com/supabase/auth, `internal/crypto/crypto.go`; local `auth.one_time_tokens` columns | GO-LIVE line (Task 12) |
| `@supabase/ssr` 0.12.7: cookie defaults `path "/"`, `sameSite "lax"`, `httpOnly false`, `maxAge` 400 days; `cookieOptions` overrides the others but **not `maxAge`**: every write forces `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge` (and 0 for removals) after spreading `cookieOptions` (`cookies.js:228-231`, `:466-471`; amendment 1); values written `base64-` + base64url; `setAll(cookies, headers)` | `node_modules/@supabase/ssr/dist/main/utils/constants.js`, `createServerClient.js:20`, `types.d.ts:48` | Tasks 3, 6, 11 |
| supabase-js 2.117.3 refreshes a session that expires within 90 seconds (`EXPIRY_MARGIN_MS` = 3 × 30 s) | `@supabase/auth-js/dist/main/lib/constants.js:13` | Task 6 |
| Next 16.4: `proxy.ts` runs on the Node.js runtime by default (no `runtime` option); without a matcher it runs on every request, static files included; a Server Function is a POST to its page's route, so the matcher must cover pages | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:75, 249, 255` | Task 6 |
| Next 16.4: in a Route Handler or Server Action, `cookies()` reads back what was set earlier in the same request (`MutableRequestCookiesAdapter` copies the request's cookies into the response store and reads from it) | `node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js:113-170` | Task 5 (`finishCode` reads the profile after `verifyOtp`) |
| Microsoft: SMTP AUTH is off when the tenant uses security defaults, and off when the authentication policy blocks Basic auth for SMTP; it's set per mailbox ("Authenticated SMTP") by an admin | learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission (updated 2026-10-07) | Task 13, risk |
| Microsoft MC786329 (updated 2026-01-27): Basic auth for SMTP AUTH unchanged until December 2026, then **off by default for existing tenants** (admins can turn it back on); the final removal date is announced in the second half of 2027. Refusals read `550 5.7.30 Basic authentication is not supported for Client Submission` | mc.merill.net/message/MC786329 | Task 13, risk |
| Brevo: SMTP relay on port 587 with an SMTP key, 300 emails a day free, single-sender verification (third-party guides; confirm in Brevo's dashboard) | brevo.com/features/email-api; freecodecamp.org "bypass cloud SMTP restrictions using Brevo" | Task 13 fallback |

## The risk with Microsoft 365 (read before Task 13)

> **Superseded by amendment 21 (2026-10-21):** Lama chose Resend from `wemakesites.co.za`. This section stays only as the record of why Microsoft 365 was dropped; Resend's own risks are in amendment 21.

- **It may not work at all.** Supabase's custom SMTP takes only a username and password (Basic auth); it can't do OAuth. Eduvos's tenant, not Lama, decides whether SMTP AUTH is allowed for student mailboxes. If the tenant uses security defaults or blocks Basic auth for SMTP, the delivery test fails with a `535 5.7.139` or `5.7.30` refusal in Supabase's Auth logs. If Lama's account has MFA, the normal password won't work; an app password works only if the tenant offers them.
- **It may stop working at the end of December 2026,** about ten weeks from today, when Microsoft turns Basic auth for SMTP AUTH off by default for existing tenants. A passing test today doesn't cover that.
- **The From address must be the mailbox itself,** or Exchange refuses (`5.7.60 SendAsDenied`). Students then see codes from a student's personal address.
- **Brevo is the fallback, but its deliverability into Eduvos's Microsoft tenant is unknown without a domain.** A message "from" an `@vossie.net` address sent by Brevo isn't DKIM-aligned with vossie.net, so Microsoft may file it as spoofed or junk. The delivery test (Task 13, A5) checks the inbox, not just the send. The lasting fix is the spec's open decision 1: a domain with SPF, DKIM and DMARC.
- **The mailbox keeps copies** (open question 2).

---

## Recheck before starting (Task 0 does these, read-only)

1. `git status` (clean), `git log --oneline -3` on the worktree; main hasn't moved past `04aa943` with `lib/auth`, `app/login`, `app/logout`, `app/account` or `app/privacy` changes. If it has, stop: bringing main in is a merge and needs Lama's go-ahead.
2. **The step 2b and phase C plan has landed its C0 plumbing** (`2026-10-21-supabase-step-2b-and-phase-c-foundation.md`). Read and note, then use its names in every task below instead of this plan's placeholders:
   - where `VOSSIE_BACKEND` is read (this plan writes `usesSupabase()` from a module importable by `lib/auth`; if C0 put the reader only in `lib/supabase`, add a re-export in `lib/data` and use that);
   - how a `lib/data` module picks its Supabase version (this plan writes the Supabase code in `lib/data/supabase/<module>.ts`, chosen in `lib/data/<module>.ts`);
   - the `pnpm test:db` command and its file pattern (this plan writes `*.db.test.ts`).
   If C0 hasn't landed, Tasks 0 to 3 can still run; Tasks 4 onwards wait.
3. **Step 2b's migrations are in:** allowed domains as a migration (`vossie.net` and `eduvos.com` only, never `vossie.test`, which stays in `seed.sql` for local and e2e), and campuses, categories and pickup points as a migration (Task 13's clean-up keeps them; without them the live project would have no campuses for step 3).
4. Stage K's facts this plan builds on still hold: `lib/auth/secrets.ts` (`authKey`, `token:`/`code:` prefixes), `lib/auth/sign-in-finish.ts` (`finishCode`, `finishProfile`, `finishSample`), `lib/auth/same-origin.ts`, `lib/auth/post-paths.ts`, `app/account/privacy/delete/route.ts`.
5. Local stack: `docker ps` shows `supabase_*_vossie`; `supabase migration list --local` matches `supabase/migrations/` (20 today, more after 2b); Mailpit answers at `http://127.0.0.1:55324/api/v1/messages`.
6. Package versions: `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.3 (the facts above were checked against these). If either moved, recheck the cookie defaults, `setAll`'s headers argument and `getClaims`.
7. Microsoft's MC786329 timeline, if more than a few weeks have passed.

---

## Task 0: Baseline

1. The recheck list above.
2. `pnpm install --frozen-lockfile` (only if `node_modules` is missing or the lockfile changed).
3. `supabase db reset` (local) then `supabase test db`: all pass (1,976 or more after 2b). `pnpm lint`, `pnpm typecheck`, `pnpm test`: clean (2,701 unit or more).
4. Record the counts in this plan's ledger.

## Task 1: The sign-in mode, and sample mode off on Supabase (amendment 7)

**Files:** `lib/auth/config.ts`, `lib/auth/config.test.ts`, `lib/auth/secrets.test.ts`, `lib/auth/sample-accounts.test.ts`, `components/auth/SignIn.test.tsx` (or the nearest existing test of the sample buttons).

**Failing tests first** (`config.test.ts`):

```ts
describe("the sign-in mode (Supabase phase B, decision 1)", () => {
  it("is sample by default, off with VOSSIE_SAMPLE_MODE=0, and supabase whenever VOSSIE_BACKEND says so", () => {
    expect(signInMode({})).toBe("sample");
    expect(signInMode({ VOSSIE_SAMPLE_MODE: "0" })).toBe("off");
    expect(signInMode({ VOSSIE_BACKEND: "supabase" })).toBe("supabase");
    expect(signInMode({ VOSSIE_BACKEND: "supabase", VOSSIE_SAMPLE_MODE: "1" })).toBe("supabase");
    expect(signInMode({ VOSSIE_BACKEND: "supabase", VOSSIE_SAMPLE_MODE: "0" })).toBe("supabase");
  });

  it("never counts as sample mode on Supabase, whatever VOSSIE_SAMPLE_MODE says", () => {
    expect(isSampleMode({ VOSSIE_BACKEND: "supabase" })).toBe(false);
    expect(isSampleMode({ VOSSIE_BACKEND: "supabase", VOSSIE_SAMPLE_MODE: "1" })).toBe(false);
    expect(isSampleMode({})).toBe(true);
  });
});
```

`secrets.test.ts` gains: with `VOSSIE_BACKEND=supabase` and `VOSSIE_AUTH_HMAC_KEY` unset, `authKey()` throws "VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off." and logs nothing; with a 44-character key it hashes, and `hashToken("t")` equals `HMAC-SHA-256(key, "token:t")` (the prefix is unchanged). `sample-accounts.test.ts` gains: `isSampleAccount({ email: "student@vossie.test" })` and every fixture email are false on Supabase. The sign-in card test: on Supabase, step 1 renders no "Sign in as a sample account" buttons and step 2 shows no "Sample mode: your code is".

Run `pnpm vitest run lib/auth components/auth`: the new cases fail.

**Code** (`lib/auth/config.ts`):

```ts
import { backend } from "@/lib/backend"; // C0's plain module (2b plan decision 16); never imports lib/supabase
const usesSupabase = (env: Env) => backend(env) === "supabase";

/** How this server signs people in: the sample store, Supabase Auth, or not at all (Supabase phase B decision 1). */
export type SignInMode = "sample" | "supabase" | "off";

export function signInMode(env: Env = process.env): SignInMode {
  if (usesSupabase(env)) return "supabase";
  return env.VOSSIE_SAMPLE_MODE !== "0" ? "sample" : "off";
}

/** Sample mode (spec 2.1): the sample backend with VOSSIE_SAMPLE_MODE not "0". Never on Supabase (stage K amendment 7). */
export function isSampleMode(env: Env = process.env): boolean {
  return signInMode(env) === "sample";
}
```

`secrets.ts` and `sample-accounts.ts` need no code change: both already ask `isSampleMode()`. `SESSION_TTL_MS` gains a comment: "On Supabase, the cookie's lifetime and the idle job's window (decision 3)."

**Check:** `pnpm vitest run lib/auth components/auth app/admin` pass (the admin numbers page's `sampleMode` prop follows `isSampleMode()`, so on Supabase it's false, which is right). `pnpm typecheck`.

## Task 2: Migration `…_sign_in_phase_b.sql`

**Files:** `supabase/migrations/<timestamp after 2b's last, 20261021120700_public_reads.sql>_sign_in_phase_b.sql`, `supabase/tests/36_sign_in_phase_b.test.sql` (2b's plan takes 24 to 31; recheck at Task 0), `lib/supabase/database.types.ts` (regenerated).

**pgTAP first**, then the migration. Run `supabase test db` and see the new file fail.

1. **Three new error codes.** `private.sign_in_attempts.errors` check gains `code-soon`, `send-failed`, `ip-rate` (decision 6). Test: an insert with each passes; `'nonsense'` fails.
2. **Attempt functions for the admin client** (`private` isn't exposed through the API), each `security definer`, `search_path = ''`, granted to `service_role` only:
   - `public.get_sign_in_attempt(p_key text) returns jsonb`: the row while `expires_at > now()`, as camel-case JSON matching `SignInAttemptRow` (`codeHash` always null; Supabase holds the code), or null;
   - `public.save_sign_in_attempt(p_attempt jsonb) returns void`: an upsert on `key`, every column from the JSON, with the table's own checks as the backstop; `expires_at` more than 31 minutes ahead is refused (`ATTEMPT_TTL_MS`);
   - `public.delete_sign_in_attempt(p_key text) returns void`.
   - `record_wrong_try` and `reserve_code_send` keep their phase A wrappers. A comment on `record_wrong_try` says it now counts every try, before `verifyOtp` (decision 2).
   - Tests: as `anon` and `authenticated`, each raises `42501`; as `service_role`, save then get round-trips every field; an expired row reads null; two `record_wrong_try` calls return 1 then 2.
3. **The sessions for the data download:** `public.account_sessions(p_account uuid) returns table (signed_in_at timestamptz, expires_at timestamptz)`, `service_role` only, from `auth.sessions` for that user, oldest first: `signed_in_at = created_at`, `expires_at = coalesce(refreshed_at at time zone 'UTC', updated_at, created_at) + interval '30 days'` (decision 3). No session id leaves the function. Test with two sessions inserted as `postgres`.
4. **The idle-session job** (decision 3):
   ```sql
   create function private.sweep_idle_sessions()
   returns integer
   language plpgsql
   volatile
   set search_path = ''
   as $$
   declare
     n integer;
   begin
     -- refreshed_at is a timestamp without time zone, in UTC.
     delete from auth.sessions s
     where coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) < now() - interval '30 days';
     get diagnostics n = row_count;
     return n;
   end;
   $$;
   revoke all on function private.sweep_idle_sessions() from public, anon, authenticated, service_role;
   select cron.schedule('sweep-idle-sessions', '20 * * * *', 'select private.sweep_idle_sessions()');
   ```
   As phase A's `sweep_unfinished_users` does with `auth.users`, it writes Auth's table from a job (that migration was pushed to staging on 2026-10-15; Task 13 B12 checks `cron.job_run_details` shows both jobs succeeding on the live project). Tests: a session refreshed 31 days ago goes, one refreshed 29 days ago stays, one never refreshed but made 31 days ago goes; the job is scheduled once (unschedule-then-schedule, as phase A).
5. **The first admin** (decision 12):
   ```sql
   -- Run by hand in the SQL editor, as postgres, once: select private.make_first_admin('someone@vossie.net');
   -- Returns 'made' | 'no-account' (no finished profile with that exact address) | 'admin-exists'.
   create function private.make_first_admin(p_email text)
   returns text
   language plpgsql
   volatile
   set search_path = ''
   as $$
   declare
     wanted text := lower(btrim(coalesce(p_email, '')));
     target public.profiles;
   begin
     lock table public.profiles in share row exclusive mode;
     if exists (select 1 from public.profiles p where 'admin' = any (p.roles)) then
       return 'admin-exists';
     end if;
     select p.* into target from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = wanted;
     if target.id is null then
       return 'no-account';
     end if;
     update public.profiles p
     set roles = array(select r from unnest(array['mentor', 'admin']) with ordinality as x(r, o)
                       where r = 'admin' or r = any (target.roles) order by o)
     where p.id = target.id;
     insert into public.audit_log (staff_id, staff_name, action, target_kind, target_id, target_name, detail, subject_id)
     values (null, 'Set up outside Vossie', 'role-given', 'account', target.id::text, target.first_name, 'Admin', target.id);
     return 'made';
   end;
   $$;
   revoke all on function private.make_first_admin(text) from public, anon, authenticated, service_role;
   ```
   Match the audit columns and the `role-given` row to `give_role`'s `record_audit` call at Task 0 (column names may differ after 2b). Tests: no admin, a profile → `made`, roles `{admin}` and one audit row; a second call → `admin-exists`; an unknown address → `no-account`; `anon`, `authenticated` and `service_role` can't execute it.
6. **`forget_account` already clears sign-in rows for the address** (phase A): a test asserts an attempt and a code count for the deleted account's email are gone, and another email's stay. If not, add it here (`delete from private.sign_in_attempts where email = address; delete from private.code_sends where email = address;`).
7. **No HMAC in Postgres** (amendment 7's second half): a test asserts no function in `public` or `private` calls `hmac(` (`pg_proc.prosrc`), so the `token:`/`code:` prefixes live only in `lib/auth/secrets.ts`. If a later migration adds one, the test names the prefixes it must use.

**Check:** `supabase db reset`, `supabase test db` (all pass), `supabase db lint --fail-on error`, `supabase db advisors --local` (nothing new beyond the explained INFO items), `pnpm db:types`, `pnpm typecheck`.

## Task 3: The Supabase clients: cookie lifetime, renewal client, clearing the cookie

**Files:** `lib/supabase/cookies.ts`, `lib/supabase/auth.ts`, `lib/supabase/auth.test.ts`, new `lib/supabase/renewal.ts` and `renewal.test.ts`, `lib/supabase/cookies.test.ts` (new).

**Failing tests first:**
- `cookies.test.ts`: `authCookieOptions()` is `{ name: "vossie_auth", httpOnly: true, sameSite: "lax", secure: <isHttps>, path: "/", maxAge: 2592000 }` (30 days, from `SESSION_TTL_MS`); `isAuthCookie(name)` is true for `vossie_auth`, `vossie_auth.0`, `vossie_auth.12`, false for `vossie_authx`, `vossie_session`, `vossie_auth-code-verifier`.
- `auth.test.ts` gains: `verifySignInCode` passes the 30-day `maxAge` in `cookieOptions`; `clearHere()` deletes every `vossie_auth` and `vossie_auth.N` cookie the request carries and nothing else.
- `renewal.test.ts` (Supabase's two makers mocked, as `auth.test.ts` does): `renewalClient(request, onSet)` builds a server client with the secret key, `cookieOptions` as above, `Sb-Forwarded-For` from the request's `x-real-ip` (none when absent); its type has only `renew()`, which calls `auth.getClaims()` and returns `{ signedIn: boolean }`; `setAll`'s cookies and headers go to `onSet`.

**Code:**

```ts
// lib/supabase/cookies.ts (additions)
/** Supabase's session cookie, or one of its chunks: vossie_auth, vossie_auth.0, vossie_auth.1, … */
export function isAuthCookie(name: string): boolean {
  return name === AUTH_COOKIE || /^vossie_auth\.\d+$/.test(name);
}
// authCookieOptions(): adds maxAge: SESSION_TTL_MS / 1000 (decision 3), read from lib/auth/config.
```

```ts
// lib/supabase/renewal.ts
import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { SESSION_TTL_MS } from "@/lib/auth/config";
import { AUTH_COOKIE } from "./cookies";
import type { Database } from "./database.types";
import { secretKey, supabaseUrl } from "./env";

export type RenewalWrites = {
  cookies: { name: string; value: string; options: CookieOptions }[];
  headers: Record<string, string>;
};
export type RenewalClient = { renew(): Promise<{ signedIn: boolean }> };

/**
 * The proxy's client (plan decision 4): the request's cookies, the secret key and the student's address, so a refresh
 * counts against that student's limit. One call: renew(), which checks the session and refreshes it when it ends within
 * 90 seconds. Writes go to `onSet`, for the proxy to put on the request and the response.
 */
export function renewalClient(request: NextRequest, onSet: (writes: RenewalWrites) => void): RenewalClient {
  const address = request.headers.get("x-real-ip")?.trim();
  const client = createServerClient<Database>(supabaseUrl(), secretKey(), {
    cookieOptions: {
      name: AUTH_COOKIE,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    },
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookies, headers) => onSet({ cookies, headers }),
    },
    global: { headers: address ? { "Sb-Forwarded-For": address } : {} },
  });
  return {
    async renew() {
      const { data, error } = await client.auth.getClaims();
      return { signedIn: !error && Boolean(data?.claims?.sub) };
    },
  };
}
```

`secure` here follows the request's own protocol. Behind Vercel the proxy sees `https:`; check it at Task 11 by reading the `Set-Cookie` on the live smoke test (Task 13, B8). If it reads `http:` there, use `x-forwarded-proto` as `isHttps()` does.

**Check:** `pnpm vitest run lib/supabase`, `pnpm typecheck`, `pnpm lint`.

## Task 4: `lib/data` on Supabase: auth session, sign-in, sessions, form states, accounts

**Files:** new `lib/data/auth-session.ts` (+ `.test.ts`), new `lib/data/session-renewal.ts` (+ `.test.ts`), new `lib/data/supabase/sign-in.ts`, `sessions.ts`, `form-states.ts`, `accounts.ts` (+ unit tests, + `*.db.test.ts`), and the switch lines in `lib/data/sign-in.ts`, `sessions.ts`, `form-states.ts`, `accounts.ts` (C0's convention).

The exported signatures of `lib/data/sign-in.ts`, `sessions.ts`, `form-states.ts` and `accounts.ts` don't change (spec 3: the contract is `lib/data`'s exports). Where a sample function has no Supabase meaning, its Supabase version says so (below).

**`lib/data/auth-session.ts`** (the façade `lib/auth` uses; decision 5):

```ts
/** Who the verified session says this is, or null: no cookie, a bad signature, or an ended session. Request-time. */
export async function currentClaims(): Promise<{ userId: string; sessionId: string; email: string } | null>;
/** The same, re-checked with Supabase Auth (getUser), so a session ended elsewhere fails (spec 5). */
export async function liveUserId(): Promise<string | null>;
export async function sendSignInCode(email: string): Promise<SendOutcome>;     // "sent" | "too-soon" | "ip-rate" | "refused" | "failed"
export async function verifySignInCode(email: string, code: string): Promise<VerifyOutcome>; // { ok: true, userId } | "wrong" | "failed" | "ip-rate"
export async function signOutHere(): Promise<void>;   // signOut({ scope: "local" }); then clears every vossie_auth cookie, error or not
export async function clearAuthCookies(): Promise<void>;
```

- `currentClaims()` is wrapped in React `cache()`, uses `viewerClient().auth.getClaims()`, and returns null on any error. `sub`, `session_id` and `email` must all be present strings.
- The mapping from Auth's refusal (code and status only, never its message; phase A's `AuthRefusal`):

  | Auth says | `sendSignInCode` | `verifySignInCode` |
  |---|---|---|
  | `over_email_send_rate_limit` (429) | `too-soon` → `code-soon` | |
  | `over_request_rate_limit` (429) | `ip-rate` | `ip-rate` |
  | 403 from the `before_user_created` hook, or `email_address_not_authorized` | `refused` → `email-domain` | |
  | `otp_expired` (403; Auth uses it for wrong and expired codes alike) | | `wrong` |
  | anything else | `failed` → `send-failed` | `failed` (shown as `send-failed`'s words, "try again in a few minutes"; the try still counts) |

  Each row is a unit test with the client mocked.

**`lib/data/session-renewal.ts`** (decision 5): `renewFromProxy(request: NextRequest): Promise<NextResponse>` (Task 6 writes its body; here only its file and the import rule).

**`lib/data/supabase/sign-in.ts`** (admin client, through Task 2's functions):
- `getSignInAttempt`, `saveSignInAttempt`, `deleteSignInAttempt`: the three RPCs; `saveSignInAttempt` ignores `now` (the hourly job sweeps), sends `codeHash` as null.
- `recordWrongTry(key)`: `rpc("record_wrong_try")`, null → 0.
- `reserveCodeSend(email, now, limit)`: `rpc("reserve_code_send", { p_email, p_max_sends: limit })` (Postgres's clock; the counter is per UTC hour, phase A's change).
- `countCodesSent`, `recordCodeSent`: test helpers; on Supabase they throw "test-only on the sample store".
- `saveSampleEmail`, `getSampleEmail`: no outbox on Supabase. `saveSampleEmail` throws (nothing may call it there); `getSampleEmail` returns null.

**`lib/data/supabase/sessions.ts`:**
- `listSessions(accountId)`: `admin.rpc("account_sessions")`, mapped to `SessionRow`'s `createdAt` and `expiresAt` (no key or id).
- `createSession`, `findSessionAccountId`, `deleteSession`: Supabase Auth owns sessions; each throws "Supabase Auth keeps sessions" (a test proves `lib/auth` never calls them on Supabase).

**`lib/data/supabase/form-states.ts`** (viewer client; the table's RLS checks the account and the JWT's `session_id`):
- `getFormState(sessionKey, form, now)`: select where `session_id = sessionKey`, `form`, `expires_at > now`.
- `saveFormState(state, now)`: upsert on `(session_id, form)` with `account_id` from `currentClaims()`; `taken` left to the trigger.
- `clearFormState`: delete.
- `takeFormState`: throws "takeFormState runs in SQL on Supabase (phase C)" (decision 15).
- `clearSessionFormStates(sessionId)` (new export, both versions): deletes this session's rows; used by sign-out.

**`lib/data/supabase/accounts.ts`:**
- `getViewerAccount(claims)` (new export): the viewer client reads `profiles` (`id, first_name, campus_slug, roles, created_at`) for `claims.userId`, and `seller_profiles` with its shop's slug; null when there's no profile. `email` comes from the claims. Never cached beyond React's per-render `cache()`.
- `getAccount(id)`: the viewer's own account when `id` is the signed-in user (through `getViewerAccount`); any other id is phase C's (staff reads) and throws until then.
- `findAccountByEmail(email)`: not used on Supabase's sign-in path (`finishCode` asks `hasProfile(userId)` instead, Task 5). On Supabase it throws until a phase C caller needs it.
- `hasProfile(userId)` (new export, both versions): the viewer client, after `verifyOtp`, selects the profile's id.
- `completeProfile(firstName, campusSlug)` (new export): `rpc("complete_profile", { p_first_name, p_campus_slug, p_policy_version: POLICY_VERSION })`. The sample version is `createAccount` plus `recordConsent`.
- `createAccount`: on Supabase, throws (accounts are made by Auth and `complete_profile`).
- `updateAccountDetails(id, details)`: `rpc("update_profile")`; then `getViewerAccount`.
- `recordConsent(accountId, version, at)`: `rpc("record_consent", { p_policy_version: version })` (the database stamps the time; decision 9).
- `getLatestConsent(accountId)`: the viewer client, newest `agreed_at`.
- `getAccountActivity`: unchanged in phase B (it asks `lib/data/messages.ts`, which C3 moves).
- `getSampleSignIns`, `restoreSampleAccount`: never reached on Supabase (`isSampleMode()` is false); `restoreSampleAccount` returns null there.
- `exportAccountData`: the `account`, `consents` and `sessions` sections from Supabase; every other section from its own module (whichever backend that module is on; phase C moves them). Key order unchanged (the existing export test's order check runs against the Supabase version too).
- `deleteAccountData(accountId)` (decision 8):
  ```ts
  export async function deleteAccountData(accountId: string): Promise<void> {
    const admin = adminClient();
    const forget = () => admin.rpc("forget_account", { p_account_id: accountId });
    let { data: paths, error } = await forget();
    // A rare deadlock with a message or an offer sent at the same moment aborts one transaction (schema catch-up,
    // Task 8): try once more.
    if (error?.code === "40P01") ({ data: paths, error } = await forget());
    if (error) throw new Error(`forget_account failed (${error.code})`);
    if (paths && paths.length > 0) await removePhotoFiles(paths); // C2's helper when it exists; else Storage remove in 1,000s
    const { error: authError } = await admin.auth.admin.deleteUser(accountId, false);
    // No profile is left, so sweep_unfinished_users removes the Auth user within a day if this failed.
    if (authError) console.error(`[vossie] Auth user delete failed (${authError.status}); the daily sweep removes it.`);
  }
  ```
  The log line names only a status, never the id or the email.

**Unit tests** (clients mocked) for every function above, including: the deadlock retry happens once and only for `40P01`; a second failure throws; Storage removal runs only with paths; an Auth delete failure doesn't throw.

**Local integration tests** (`*.db.test.ts`, run by `pnpm test:db` against `supabase start`; users made through the admin client, cleaned up after):
- attempts round-trip through the RPCs; `record_wrong_try` from two promises at once returns 1 and 2;
- `reserveCodeSend` five times true, sixth false;
- `deleteAccountData` on a user with a shop and a listing: profile, shop and listing gone, `auth.users` row gone, another user's conversation kept;
- `listSessions` after a sign-in shows one session, `expiresAt` 30 days after its last refresh.

**Check:** `pnpm vitest run lib/data`, `pnpm test:db`, `pnpm lint` (no `lib/supabase` import outside `lib/data` and `lib/supabase`), `pnpm typecheck`.

## Task 5: `lib/auth` on Supabase

**Files:** `lib/auth/session.ts`, `sign-in-finish.ts`, `actions.ts`, `sign-in-view.ts`, `messages.ts`, `form-state.ts` (no change expected; it goes through `getSessionKey`), `lib/data/rows.ts` (`SignInError`), and their tests: `session.test.ts`, `sign-in-finish.test.ts`, `sign-in-actions.test.ts`, `sign-in-view.test.ts`, `messages.test.ts`.

Every test here mocks `lib/data/auth-session` and the Supabase versions of the data modules; the sample tests stay as they are and must still pass.

**Failing tests first** (each with `VOSSIE_BACKEND=supabase` and a 44-character key stubbed):

`session.test.ts`
- `getSessionKey()` returns the claims' `sessionId`; null with no claims.
- `getViewer()` returns the account for the claims (roles from the profile), null with no claims, and **null with claims but no profile**; it never reads `vossie_session`.
- `getViewer()` reads the profile on every request: two renders with roles changed between them see the change (no module-level memo).
- `requireLiveAccount(next)` redirects to sign-in when `liveUserId()` is null, even when `getViewer()` has an account.
- `endSession()` on Supabase clears this session's form states, then calls `signOutHere()`; when `signOutHere` rejects, the cookies are still cleared and nothing throws.

`sign-in-finish.test.ts`
- Step 1 (through `startSignIn` in `sign-in-actions.test.ts`): an allowed address with the box ticked reserves a send, calls `sendSignInCode`, moves to `code`, sets `codeExpiresAt` to now + 10 minutes; `too-soon` → `code-soon` on step 1 (the attempt stays on `email`, so the visitor can try again), `ip-rate` → `ip-rate`, `refused` → `email-domain`, `failed` → `send-failed`; reserve false → `email-rate` without calling Supabase.
- `finishCode`: not 6 digits → `code-missing`, no try counted, no Supabase call; expired by the attempt's clock → `code-expired`, no try; otherwise `recordWrongTry` is called **before** `verifySignInCode` (call order asserted); a count above 5 → `locked` without calling Supabase; `wrong` with count 3 → "2 tries left"; `wrong` with count 5 → `locked`, back to step 1, the email kept; ok with a profile → `recordConsent`, the attempt deleted, the attempt cookie cleared, returns `afterSignInPath(next)`; ok without a profile → step `profile`.
- A browser that already carries a session is signed out locally before `verifySignInCode` (so a session id is never reused, as `startSession` did).
- `finishProfile` on Supabase: errors as today; valid → `completeProfile(name, campus)`, the attempt ends, returns `afterSignInPath(next)`; no session (`currentClaims` null, the session ended between steps) → back to step 1 with the attempt ended.
- `finishSample` on Supabase → `signInPath(next)`, no account touched (already true through `isSampleMode()`; asserted).
- `resendCode` on Supabase: as step 1's send, `too-soon` → `code-soon` on step 2.

`sign-in-view.test.ts`: on Supabase the view is never `unavailable`; step 2's `sampleCode` is null; signed in → `{ step: "signed-in", email }` from the claims.

`messages.test.ts`: the three new codes have the words in decision 6 and belong to the `email` field. On step 2, which has no email field, `formErrors` gives them `fieldId: null`, so they show in the summary without a link (as `code-rate`'s words do today on step 1).

**Code, in outline:**

```ts
// lib/auth/session.ts
export async function getSessionKey(): Promise<string | null> {
  switch (signInMode()) {
    case "supabase":
      return (await currentClaims())?.sessionId ?? null;
    case "sample": {
      const token = await readCookieValue(SESSION_COOKIE);
      return token ? hashToken(token) : null;
    }
    default:
      return null;
  }
}

export const getViewer = cache(async (): Promise<Account | null> => {
  const mode = signInMode();
  if (mode === "supabase") {
    const claims = await currentClaims();
    // Roles come from the profile on every request (spec 4.3): nothing cached reads them.
    return claims ? getViewerAccount(claims) : null;
  }
  if (mode !== "sample") return null;
  // … the sample path, unchanged
});

/** As requireAccount, re-checked with Supabase Auth, for account deletion and staff actions (spec 5). */
export async function requireLiveAccount(nextPath: string): Promise<Account> {
  const account = await requireAccount(nextPath);
  if (signInMode() === "supabase" && (await liveUserId()) !== account.id) redirect(signInHref(nextPath));
  return account;
}

export async function endSession(): Promise<void> {
  if (signInMode() === "supabase") {
    const sessionId = await getSessionKey();
    if (sessionId) await clearSessionFormStates(sessionId).catch(() => {});
    await signOutHere();
    return;
  }
  // … the sample path, unchanged
}
```

```ts
// lib/auth/sign-in-finish.ts, Supabase paths (the sample paths are unchanged)
export async function currentAttempt(now: Date): Promise<SignInAttemptRow | null> {
  if (signInMode() === "off") return null;
  const token = await readCookieValue(SIGN_IN_COOKIE);
  return token ? getSignInAttempt(hashToken(token), now) : null;
}

/** Sends a code (spec 5): one of the 5 an hour first, then Supabase. The error to show, or null when it went. */
export async function sendCode(attempt: SignInAttemptRow, now: Date): Promise<SignInError | null> {
  if (!(await reserveCodeSend(attempt.email, now, CODES_PER_HOUR))) return "email-rate";
  if (signInMode() === "sample") { /* today's sample code, unchanged */ return null; }
  const sent = await sendSignInCode(attempt.email);
  if (sent !== "sent") return SEND_ERRORS[sent]; // too-soon → code-soon, ip-rate → ip-rate, refused → email-domain, failed → send-failed
  attempt.codeExpiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  attempt.wrongTries = 0;
  return null;
}

async function finishCodeOnSupabase(attempt: SignInAttemptRow, code: string, next: string | null, now: Date) {
  // Every try is counted, in one statement, before Supabase sees the code (plan decision 2).
  const tries = await recordWrongTry(attempt.key);
  if (tries > MAX_WRONG_TRIES) return lockOut(attempt, now, next);
  if ((await currentClaims()) !== null) await signOutHere(); // a session id is never reused (spec 2.5)
  const verified = await verifySignInCode(attempt.email, code);
  if (verified === "ip-rate" || verified === "failed") {
    attempt.wrongTries = tries;
    attempt.errors = [verified === "ip-rate" ? "ip-rate" : "send-failed"];
    return save(attempt, now, next);
  }
  if (verified === "wrong") {
    attempt.wrongTries = tries;
    return tries < MAX_WRONG_TRIES ? wrongCode(attempt, now, next) : lockOut(attempt, now, next);
  }
  // verifyOtp has set vossie_auth; cookies() reads it back in this same request (Next's MutableRequestCookiesAdapter).
  if (await hasProfile(verified.userId)) {
    await recordConsent(verified.userId, POLICY_VERSION, now);
    await endAttempt(now);
    return afterSignInPath(next);
  }
  attempt.step = "profile";
  attempt.codeExpiresAt = null;
  attempt.errors = [];
  return save(attempt, now, next);
}
```

`finishCode` keeps its shape: the guards (attempt on step `code`, `codeExpiresAt` set; on Supabase `codeHash` isn't required), the `code-expired` and `code-missing` checks without a try, then the sample or Supabase path. `startSignIn` drops its `if (!isSampleMode()) backToSignIn(next)` for `if (signInMode() === "off")`. `resendCode` likewise. `SignInError` in `lib/data/rows.ts` gains the three codes; `messages.ts` gains their words.

**Check:** `pnpm vitest run lib/auth lib/data app/login app/logout app/account components/auth`, `pnpm typecheck`, `pnpm lint`. The sample-mode suites pass unchanged (2,701 or more).

## Task 6: `proxy.ts`: renewing the session before pages render

**Files:** new `proxy.ts` (repo root), `lib/data/session-renewal.ts` (body), `lib/data/session-renewal.test.ts`, new `proxy.test.ts`.

**Failing tests first** (`session-renewal.test.ts`, with `renewalClient` mocked, real `NextRequest`/`NextResponse`):
1. Sample backend: returns `NextResponse.next()` without making a client.
2. No `vossie_auth` or `vossie_auth.N` cookie: returns `NextResponse.next()` without making a client ("signed-out visitors pay nothing", spec 5).
3. A cookie, and `renew()` writes nothing: `NextResponse.next()`, no `Set-Cookie`, no cache headers added.
4. A cookie, and `renew()` writes new cookies with Supabase's headers: the request passed on carries the new cookie values (so the render doesn't refresh again), the response carries each `Set-Cookie` with the 30-day `Max-Age`, `HttpOnly`, `SameSite=Lax`, and `Cache-Control`, `Expires` and `Pragma` exactly as Supabase passed them.
5. `renew()` throws (Supabase down): `NextResponse.next()`, nothing deleted, the error logged without the cookie's value. The page then renders signed out for that request; the next request tries again.

`proxy.test.ts`: the exported `config.matcher` excludes `_next/static`, `_next/image`, `photos/`, `sw.js`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `icons/` and any path with a file extension; it includes `/`, `/account`, `/login/code`, `/logout`, `/account/privacy/delete`, `/account/privacy/export`, `/sellers/tech-corner`, `/sell/listings/new` (checked with `unstable_doesMiddlewareMatch` from `next/experimental/testing/server`: the docs name `unstable_doesProxyMatch`, but the installed 16.4 exports only the Middleware name; amendment 13).

**Code:**

```ts
// proxy.ts
import type { NextRequest } from "next/server";
import { renewFromProxy } from "@/lib/data/session-renewal";

/**
 * Renews the Supabase session before pages render, since Server Components can't write cookies (backend spec 5).
 * It returns at once on the sample backend and for visitors with no vossie_auth cookie.
 */
export function proxy(request: NextRequest) {
  return renewFromProxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|photos/|sw\\.js|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|icons/|.*\\.[a-z0-9]+$).*)",
  ],
};
```

```ts
// lib/data/session-renewal.ts
export async function renewFromProxy(request: NextRequest): Promise<NextResponse> {
  if (!usesSupabase() || !request.cookies.getAll().some(({ name }) => isAuthCookie(name))) return NextResponse.next();
  let writes: RenewalWrites | null = null;
  try {
    await renewalClient(request, (w) => (writes = w)).renew();
  } catch {
    console.error("[vossie] session renewal failed");
    return NextResponse.next();
  }
  if (!writes) return NextResponse.next();
  for (const { name, value } of writes.cookies) request.cookies.set(name, value);
  const response = NextResponse.next({ request });
  for (const { name, value, options } of writes.cookies) response.cookies.set(name, value, options);
  // A response that sets someone's session is never cached (spec 5; Supabase's guide).
  for (const [header, value] of Object.entries(writes.headers)) response.headers.set(header, value);
  return response;
}
```

(The names `isAuthCookie` and `renewalClient` come from `lib/supabase`, which `lib/data` may import. The exact file of `usesSupabase` is C0's.)

**Spike, before moving on (time-boxed to 30 minutes): do Supabase's no-store headers survive Next's own `Cache-Control` on a prerendered page?** With the local stack and a production build on port 3300 (`VOSSIE_BACKEND=supabase`, local keys from `supabase status -o env`, a throwaway key from `openssl rand -base64 32` in the shell only):
1. Sign in by code (Mailpit) with `curl` or Playwright, keep the cookie jar.
2. Rewrite the `vossie_auth` cookie's JSON `expires_at` to a past time (decode `base64-…`, edit, encode), so supabase-js sees an expired session.
3. `curl -sI http://localhost:3300/` and `/how-it-works` with that jar. Expect a `Set-Cookie: vossie_auth=…; Max-Age=2592000; HttpOnly; SameSite=Lax` and `Cache-Control` containing `no-store`.
4. If Next replaces `Cache-Control` on a prerendered page, report to the controller with the fallback: `next.config.ts` `headers()` with `has: [{ type: "cookie", key: "vossie_auth" }]` setting `Cache-Control: private, no-store` (the cookie isn't chunked at 2.4 KB; check the chunked name too). Don't build the fallback without the controller.

**Check:** `pnpm vitest run lib/data/session-renewal proxy`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (the build lists `ƒ Proxy (Middleware)`; every page's JS is the same to the byte: the performance test compares, Task 11).

## Task 7: The Route Handlers on Supabase

**Files:** `app/logout/route.ts` (+ test), `app/account/privacy/delete/route.ts` (+ test), `app/account/privacy/export/route.ts` (+ test), `app/login/{code,profile,sample}/route.test.ts`.

Stage K's shape doesn't change: `isSameOrigin` first, the body read with `.catch(() => null)`, a 303 through `seeOther()` with `Cache-Control: no-store`, GET answers 303 after `connection()`.

**Failing tests first:**
- `/logout` on Supabase: `endSession()` called (Supabase branch), the flash set, 303 to `/`; a cross-site post → 403 and `endSession` not called.
- `/account/privacy/delete` on Supabase:
  - signed in by claims but `liveUserId()` null (session ended elsewhere) → 303 to sign-in, nothing deleted;
  - box not ticked → the form state written, 303 to the page, nothing deleted;
  - ticked → `deleteAccountData(id)`, the three tag helpers as today, `clearAuthCookies()` (not `SESSION_COOKIE`), the `deleted` flash, 303 to `/`;
  - `deleteAccountData` throws → 303 to the page with a `delete-failed` notice in form state ("We couldn't delete your account just now. Try again in a minute."), the session kept. (New: sample mode never failed here.) Add `delete-failed` to the privacy page's notices and `messages.ts`.
- `/account/privacy/export` on Supabase: the JSON's `sessions` come from `listSessions` (Supabase), no session id anywhere in the output, `Cache-Control: no-store`.
- `/login/code`, `/login/profile` on Supabase: post through to `finishCode`/`finishProfile` (mocked) and 303 to their result; `/login/sample` → 303 to `/login`, nobody signed in.

**Code:** the delete route takes the live re-check and the cookie clearing:

```ts
const account = await getViewer();
if (!account) return seeOther(signInHref(PAGE));
if (signInMode() === "supabase" && (await liveUserId()) !== account.id) return seeOther(signInHref(PAGE));
// … confirm check as today
try {
  await deleteAccountData(account.id);
} catch {
  await writeFormState(DELETE_FORM, { errors: ["delete-failed"], values: {}, notice: null }, new Date());
  return seeOther(PAGE);
}
// … tags as today
await endSessionAfterDeletion(); // sample: deleteCookie(SESSION_COOKIE); Supabase: clearAuthCookies()
```

`endSessionAfterDeletion()` is a new `lib/auth/session.ts` export, so the route stops importing `SESSION_COOKIE`.

**Check:** `pnpm vitest run app lib/auth`, `pnpm typecheck`, `pnpm lint`.

## Task 8: The sign-in card on Supabase

**Files:** `components/auth/SignIn.tsx`, `components/auth/SignInSteps.tsx` (only if a test needs a change), their tests.

- `samples={isSampleMode() ? await getSampleSignIns() : null}` already hides the buttons on Supabase (Task 1). `CodeStep`'s sample line already hides when `sampleCode` is null.
- Step 2's line "We sent a code to t•••@vossie.net" stays; on Supabase add nothing about spam folders unless Lama asks (open point after Task 13's delivery test: if codes land in Junk, a line "Can't find it? Check your Junk folder." is a one-line change, for Lama).
- Tests: on Supabase, no element with "sample" in the card; the three new errors render in the summary linked to the email field (step 1) or listed at the top (step 2).

**Check:** `pnpm vitest run components/auth`.

## Task 9: The privacy page

**Files:** `app/privacy/page.tsx`, `app/privacy/page.test.tsx`.

**Failing tests first:**
- `NOT_YET_SET` is empty, and the "lets a cookie go unnamed" test now asserts that `vossie_auth` is named on the page (the importer list is no longer empty after Tasks 4 to 7).
- The sign-in cookies list names `vossie_session`, `vossie_auth`, `vossie_signin` and `vossie_flash`.
- The hosting section names Supabase, Ireland, Vercel and Dublin, and no longer says the hosting is to be decided.
- The page names who sends the code email.

**Wording for Lama** (plain English, the page's voice; replaces "Three sign-in cookies"):

> **Sign-in cookies.** These belong to Vossie. The first three can only be read by Vossie's server, never by scripts on the page.
> - `vossie_auth`: keeps you signed in on the live site. It holds a signed sign-in token from Supabase, our database provider, and may be split into parts named `vossie_auth.0`, `vossie_auth.1`. It lasts 30 days from your last visit, so it ends if you don't use Vossie for 30 days. Signing out or deleting your account ends it.
> - `vossie_session`: does the same on the preview, which keeps everything in memory. Vossie's server keeps only a fingerprint of it, made with a secret key. Signing out or deleting your account ends it.
> - `vossie_signin`: a random code that holds your place while you sign in, for up to 30 minutes.
> - `vossie_flash`: a one-off message such as "You're signed out", for up to a minute.

> **Where it is hosted.** Vossie's data is stored by Supabase in Ireland (Amazon Web Services, eu-west-1), and its pages are served by Vercel, whose servers that handle your requests are in Dublin. Sign-in codes are emailed through Microsoft 365. Storing personal information outside South Africa is allowed under POPIA section 72 where the country, the company or a binding agreement gives protection at least as strong as POPIA; Supabase's and Vercel's data processing agreements include the EU's standard contractual clauses. Eduvos will confirm this before launch.

The "kept in memory" lines (`page.tsx:43` and `:246`) gain "on the preview" and a sentence for the live site ("On the live site, it's kept in Supabase's database until you delete it or Eduvos's retention periods remove it"), for Lama to confirm. If the Brevo fallback is used, "through Microsoft 365" becomes "through Brevo".

**Check:** `pnpm vitest run app/privacy`.

## Task 10: Config, environment and the two ops scripts

**Files:** `supabase/config.toml`, `.env.example`, new `supabase/ops/clear-sample-data.sql`. No README: Task 13's runbook is the instruction.

1. **`config.toml`:**
   - `[auth.rate_limit] email_sent = 1000` locally (decision 16), with a comment;
   - `[remotes.staging]` gains a comment that it is the live project (Lama, 2026-10-21) and:
     ```toml
     [remotes.staging.auth.rate_limit]
     email_sent = 100
     sign_in_sign_ups = 60
     token_verifications = 60
     token_refresh = 150
     [remotes.staging.db.seed]
     enabled = false
     ```
   - no `[auth.email.smtp]` block, anywhere (decision 11); a comment says why;
   - no `[auth.sessions]` block (Pro only; decision 3).
2. **`.env.example`:** `VOSSIE_EMAIL_DOMAINS` comment gives the live value `vossie.net,eduvos.com` (Lama's decision 2) and keeps `eduvos.com` as the code default; `VOSSIE_BACKEND` says that `supabase` turns sample mode off whatever `VOSSIE_SAMPLE_MODE` says; `VOSSIE_AUTH_HMAC_KEY` adds "On Supabase it keys only the sign-in attempt cookie: changing it ends sign-ins in progress, not sessions."
3. **`supabase/ops/clear-sample-data.sql`** (decision 10), one transaction, written so the same file is the dry run (its last line `rollback;`) and Lama changes only that line to `commit;` for the real run:
   ```sql
   -- Clears the sample seed from the live project (Supabase phase B, Task 13 B4). Keeps campuses, categories, pickup
   -- points, policy versions and allowed domains. Run in the dashboard's SQL editor. Dry run as written: it ends in
   -- rollback and prints the counts. For the real run, Lama changes the last line to commit.
   begin;
   select 'before' as at, (select count(*) from auth.users) as users, (select count(*) from public.shops) as shops,
          (select count(*) from public.listings) as listings, (select count(*) from public.requests) as requests,
          (select count(*) from public.hub_posts) as hub_posts, (select count(*) from storage.objects) as files;
   -- Content first (none of it is real: the project has only ever held the seed and test accounts) …
   delete from public.featured_draws; delete from public.featured_pins; delete from public.hub_bookings;
   delete from public.hub_rsvps; delete from public.hub_posts; delete from public.mentor_notes;
   delete from public.saved_searches; delete from public.follows; delete from public.notifications;
   delete from public.reports; delete from public.messages; delete from public.conversations;
   delete from public.requests; delete from public.listing_photos; delete from public.listings;
   delete from public.shop_pickup_points; delete from public.shop_previous_slugs; delete from public.shops;
   delete from public.onboarding_drafts; delete from public.seller_profiles; delete from public.photos;
   delete from public.audit_log; delete from public.form_states; delete from public.consents;
   delete from public.profiles;
   delete from private.sign_in_attempts; delete from private.code_sends;
   -- … then every Auth user (the five @vossie.test accounts and any test sign-ups) and their sessions.
   delete from auth.users;
   -- Only the live domains may sign in.
   delete from private.allowed_email_domains where domain not in ('vossie.net', 'eduvos.com');
   select 'after' as at, (select count(*) from auth.users) as users, (select count(*) from public.shops) as shops,
          (select count(*) from public.campuses) as campuses, (select count(*) from public.categories) as categories,
          (select count(*) from public.pickup_points) as pickup_points,
          (select string_agg(domain, ', ' order by domain) from private.allowed_email_domains) as domains;
   rollback;
   ```
   The table list is checked at Task 10 against `\dt public.*` on the local stack (after 2b), so no content table is missed and no reference table is emptied; the `audit_log` has no delete grant for API roles but `postgres` may delete. **Tested locally:** run it with `commit` against a freshly reset local stack, then assert 0 users, 0 shops, 13 campuses, 10 categories, 24 pickup points, and domains `eduvos.com, vossie.net`; then `supabase db reset` to restore the local seed. Storage objects: if `files` isn't 0, the runbook says so and Lama empties the `photos` bucket in the dashboard (deleting rows in `storage.objects` by SQL leaves the files).
4. The first-admin call is in Task 2's migration; nothing to add here.

**Check:** `supabase db reset` (config is valid), `pnpm vitest run app/privacy` (no new cookie names), the clear-out test above.

## Task 11: Local integration and the end-to-end sign-in specs on Supabase

**Files:** new `playwright.supabase.config.ts`, new `tests/e2e-supabase/sign-in.spec.ts`, `tests/e2e-supabase/account.spec.ts`, `tests/e2e-supabase/helpers/mailpit.ts`, `package.json` (script `e2e:supabase`), `lib/data/auth-session.db.test.ts`.

**`playwright.supabase.config.ts`:** its own `testDir: "./tests/e2e-supabase"` (so `pnpm e2e` never runs these), port **3300**, two projects (`phone-390`, `desktop-1440`), `serviceWorkers: "block"`, and a `webServer` whose `env` is built at run time:

```ts
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

// The local stack's URL and keys (well known, local only), read now, never written to a file.
const local = Object.fromEntries(
  execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" })
    .split("\n").map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);

webServer: {
  command: "pnpm build && pnpm start --port 3300",
  url: "http://localhost:3300",
  reuseExistingServer: false,
  timeout: 240_000,
  env: {
    VOSSIE_BACKEND: "supabase",
    SUPABASE_URL: local.API_URL,
    SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: local.SECRET_KEY,
    VOSSIE_EMAIL_DOMAINS: "vossie.net,eduvos.com,vossie.test",
    VOSSIE_AUTH_HMAC_KEY: randomBytes(32).toString("base64"), // throwaway, per run
  },
},
```

(Check the variable names `supabase status -o env` prints with CLI 2.118 at Task 0; phase A's `.env.example` note says it prints the keys.) The build here uses `.next` in the worktree; it must not run while another build in the same worktree runs.

**`helpers/mailpit.ts`:** `latestCode(address, after: Date)` polls `GET http://127.0.0.1:55324/api/v1/search?query=to:"<address>"` every 250 ms for up to 10 s, takes the newest message after `after`, reads `GET /api/v1/message/{ID}`, asserts the subject is "Your Vossie sign-in code", and returns the one 6-digit run in its text. Each test uses a fresh address `e2e-<random>@vossie.test`; an `afterAll` deletes those users with the admin client (local only).

**`sign-in.spec.ts`** (each also run without the app's JavaScript where marked):
1. A new address: step 1 → step 2 ("We sent a code to e•••@vossie.test") → code from Mailpit → step 3 → name and campus → `/account` shows the address. Cookies afterwards: exactly the `vossie_auth` cookie (or its chunks) and no `vossie_session`, `HttpOnly`, `SameSite=Lax`, `Max-Age` about 30 days, and **no `…-code-verifier` cookie**. (Also without JavaScript.)
2. A returning address: no step 3; lands on `next`.
3. A wrong code four times says 4, 3, 2, 1 tries left; the fifth says "Too many tries. Start again." on step 1 with the email kept; Mailpit's code no longer signs in through the app (a new attempt is needed).
4. "Send a new code" straight away says the `code-soon` words (Supabase's 60 seconds); "Use a different email" starts empty.
5. A `@gmail.com` address: "Use your Eduvos email address.", and no message reaches Mailpit. This is the app's own check; the hook's refusal is covered by pgTAP and by `auth-session.db.test.ts` below.
6. No sample buttons on `/login`; a post to `/login/sample` with a sample address returns to `/login` signed out.
7. Sign out from the menu: 303 to `/` with the toast; the `vossie_auth` cookie is gone; Back to `/account` asks to sign in. A cross-site post to `/logout` is refused (stage K's test, repeated here).
8. **Renewal:** with the session's `expires_at` rewritten to the past (as Task 6's spike), loading `/account` returns `Set-Cookie: vossie_auth=…` and `Cache-Control` with `no-store`, the page shows the account, and a second load sets no cookie.
9. **Idle sweep:** with the session's `refreshed_at` moved 31 days back through the admin client's SQL (local `psql`), `select private.sweep_idle_sessions()` deletes it; the next load with an expired access token is signed out.
10. The header and menu say "Your account" and "Sign out" when signed in (axe: no serious or critical issues on steps 1 to 3 at 390).

**`account.spec.ts`:** Edit details saves; Download your data has `account.email`, one consent, one session and no ids; Delete my account without the box says so; with the box: 303 to `/` with the toast, the user gone from `auth.users`, signing in again with the same address starts at step 3 (a new account).

**`auth-session.db.test.ts`** (Vitest against the local stack, `pnpm test:db`): the hook refuses `@gmail.com` (403, mapped to `refused`, nothing in Mailpit); the code email's HTML has the 6-digit code in the template's large line; `verifySignInCode` with the Mailpit code returns the user id; a password sign-up gets no session (phase A's C1, repeated as a guard).

**The sample suites run unchanged:** `pnpm e2e` (default sample backend) passes as before; `performance.spec.ts` shows every page's JS the same to the byte (no Supabase code reaches the browser; `proxy.ts` is server-only).

**Check:** `pnpm test:db`; `pnpm e2e:supabase` (both projects pass); `pnpm e2e` as before; after `pnpm build`, `grep -l "supabase" .next/static/chunks/*.js` prints nothing.

## Task 12: Docs

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` (section 13, amendments), `docs/reference/GO-LIVE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/superpowers/plans/2026-10-20-supabase-phases-b-c.md` ("Changes made during the build"), this plan's ledger, `docs/PROGRESS.md` (on main at merge time, since other sessions edit it there).

- **CLAUDE.md**, Code rules:
  - "On Supabase (`VOSSIE_BACKEND=supabase`), sample mode is off whatever `VOSSIE_SAMPLE_MODE` says (`signInMode()`, `lib/auth/config.ts`). `lib/auth` and `proxy.ts` reach Supabase only through `lib/data` (`auth-session.ts`, `session-renewal.ts`)."
  - "Who's signed in on Supabase: `getClaims()` then the profile, every request; a session without a profile is signed out. Account deletion and staff actions use `requireLiveAccount()` (`getUser()`)."
  - "`proxy.ts` renews the Supabase session before pages render and copies Supabase's no-store headers; it returns at once without a `vossie_auth` cookie. Its matcher must cover every page and Route Handler (Server Functions post to their page)."
  - "The `vossie_auth` cookie lasts 30 days from the last renewal; `private.sweep_idle_sessions()` ends sessions idle for 30 days (the Free plan has no inactivity timeout)."
  - Commands: `pnpm test:db`, `pnpm e2e:supabase` (needs `supabase start`).
- **Spec amendments (section 13):** the staging project is the live one (Lama, 2026-10-21); allowed domains `vossie.net` and `eduvos.com`; the sliding 30 days built as decision 3; email through Resend's SMTP from `wemakesites.co.za` with Brevo as fallback (open decision 1 closed for the submission; Eduvos's domain later); the live project holds real student data (section 9 changes); decisions 2, 7, 8 and 13 of this plan.
- **GO-LIVE.md**, Backend section:
  - tick: "Phase B: `authKey()` refuses the development key, and `isSampleAccount()` is false, whenever `VOSSIE_BACKEND=supabase`…" (Task 1), and "Counting tries" (decision 2);
  - replace "Phase B: confirm … how Supabase Auth stores email codes" with a ticked line: "Supabase Auth stores a sign-in code as an unkeyed SHA-224 of the address and the code (`GenerateTokenHash`, supabase/auth `internal/crypto/crypto.go`), in `auth.one_time_tokens`, for its 10 minutes. A leaked database could reveal a live code by trying the million values; the 10-minute life and the database's own protection are what guard it. Accepted (phase B)."
  - add: "[ ] Sign-in email: Resend from `wemakesites.co.za` for the submission (free plan, 100 emails a day); move to Eduvos's own domain with SPF, DKIM and DMARC, and a paid plan if needed, once Eduvos is on board (spec open decision 1)";
  - add: "[ ] On Pro: turn on Auth's inactivity timeout (30 days) and retire `sweep_idle_sessions`";
  - add: "[ ] Back up the live project (Free has no backups)" (open question 1);
  - "Sign-in rate limits … per IP address as well as per email": tick, naming Supabase's per-address limits with `Sb-Forwarded-For` and the 5 codes an hour.
- **LANDING-DECISIONS.md:** Lama's four decisions of 2026-10-21 and this plan's numbered decisions, numbered when written (check the last number first).

---

## Task 13: Go-live runbook (Lama and the controller)

Two parts. **Part A** can run now, before any of this plan's code: it settles whether email works. **Part B** runs only when its preconditions hold. Every step that changes the live project or Vercel waits for Lama's go-ahead for that step. Nothing secret is typed into chat; where a step needs a secret, Lama types it into the dashboard or their own terminal.

### Part A: email (now)

| Step | Who | What | Expected |
|---|---|---|---|
| A1 | Lama | In your own terminal: `supabase login`, with a new personal access token scoped to "Vossie Market", read-write, with an expiry. Revoke the phase A token if it still exists | "You are now logged in" |
| A2 | Controller | Read only: `supabase projects list`, `supabase migration list --linked` from the worktree | The project is listed; the migration list shows what's applied (record it) |
| A3 | Lama | In Resend: Domains shows `wemakesites.co.za` as **Verified** (SPF and DKIM green; add a DMARC record such as `v=DMARC1; p=none;` at `_dmarc` if Resend flags it). API Keys → create a key named `vossie-supabase` with **Sending access** only, restricted to `wemakesites.co.za`. Copy it straight into A4; never into chat | Verified domain; a sending-only key |
| A4 | Lama | Dashboard → Authentication → Emails → SMTP Settings → enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key (typed by you, here only), sender email `codes@wemakesites.co.za` (or the address you chose on the verified domain; no mailbox needs to exist), sender name `Vossie`. Then Authentication → Rate Limits → emails sent per hour: **30** (amendments 9 and 21: `config push` never sends it, and Resend's free plan allows 100 a day) | Saved |
| A5 | Lama | Dashboard → Authentication → Emails → Templates: **Magic link** and **Confirm signup**: subject `Your Vossie sign-in code`, body = the contents of `supabase/templates/sign-in-code.html`. Authentication → Sign In / Providers → Email: OTP length 6, expiry 600 seconds | Saved (this works only now that custom SMTP is on) |
| A6 | Lama | SQL editor, so the hook lets your address through for the test (step 2b's migration makes this permanent later): `insert into private.allowed_email_domains (domain) values ('vossie.net') on conflict do nothing;` | 1 row (or 0 if there already) |
| A7 | Lama | **The one-email test**, in your own terminal (the publishable key is typed at the prompt, not pasted into chat): `read -s SB_KEY` then `curl -sS -X POST "https://kahzsitqnocygsrdfpre.supabase.co/auth/v1/otp" -H "apikey: $SB_KEY" -H "Content-Type: application/json" -d '{"email":"<your student address>","create_user":true}'` | `{}` within a few seconds |
| A8 | Lama | Your inbox within 2 minutes | Subject "Your Vossie sign-in code", a large 6-digit code, from `Vossie <codes@wemakesites.co.za>`, **in Inbox, not Junk**. Resend → Emails shows it as Delivered |
| A9 | Lama | If nothing came: Resend → Emails (Bounced or Failed, with the reason), then Dashboard → Logs → Auth, the newest error | An authentication error means the key or username is wrong (redo A3 and A4); "domain not verified" means the sender isn't on `wemakesites.co.za`; a delivered email in Junk means DMARC or content: add the DMARC record (A3) and retest. If Resend can't deliver, go to A10 |
| A10 | Lama | **Fallback, a dashboard change only:** make a Brevo account; Senders → add and verify a sender address on `wemakesites.co.za` (and, if offered, authenticate the domain); SMTP & API → generate an SMTP key. Then Authentication → Emails → SMTP Settings: host `smtp-relay.brevo.com`, port `587`, username = the SMTP login Brevo shows, password = the SMTP key, sender = the verified sender. Repeat A7 and A8 | A code in your Inbox |
| A11 | Lama | Authentication → Users: delete the test user A7 made (or leave it: having no profile, the daily job removes it after a day) | Gone |
| A12 | Controller | Write the outcome in `docs/PROGRESS.md` and this plan: which provider, Inbox or Junk, the date. No addresses, no secrets | Recorded |

### Part B: switching the live site to Supabase (later)

**Preconditions (all, checked by the controller and shown to Lama):** this plan merged to main; phase C (C1 to C5) merged; step 5 (the whole e2e suite with `VOSSIE_BACKEND=supabase` on the local stack) green; step 2b's migrations (allowed domains, reference data) merged; Part A passed; open question 1 (Free or Pro) answered.

| Step | Who | What | Expected |
|---|---|---|---|
| B1 | Controller | `git status` (clean, separate call); `supabase migration list --linked` | Local is ahead of the live project by the new migrations only |
| B2 | Controller, then Lama | `supabase db push --linked --dry-run`; show Lama the list. **On Lama's go-ahead:** `supabase db push --linked` (never `--include-seed`) | The list applies; `migration list --linked` shows local and remote equal |
| B3 | Lama, controller watching | SQL editor: paste `supabase/ops/clear-sample-data.sql` as it is (dry run, ends in `rollback`). Read the counts with the controller | "before" shows the seed (30 shops, 38 listings, 5 or more users); "after" shows 0 users, 0 shops, 13 campuses, 10 categories, the pickup points, domains `eduvos.com, vossie.net` |
| B4 | Lama | **On your own go-ahead:** the same file with the last line changed to `commit;`. If `files` wasn't 0, empty the `photos` bucket in Storage | Committed; a second dry run's "before" shows the "after" numbers |
| B5 | Lama | Dashboard checks: Settings → JWT Keys: the current key is asymmetric (ECC P-256 or RSA), so `getClaims()` checks locally; Settings → API Keys: the legacy `anon` and `service_role` keys **disabled** (spec decision 6); Authentication → Rate Limits: **IP address forwarding on** (phase A Task 13 step 7); Authentication → Settings (or Logs): **turn off writing Auth audit logs to the database** if the dashboard offers it (amendment 17, controller's decision; otherwise the privacy page's sentence on Supabase Auth's security records covers `auth.audit_log_entries`) | All as stated (the audit-log switch only if offered: say which). If the JWT key is the legacy shared secret, rotate to an asymmetric key now (no real sessions exist yet) |
| B6 | Controller, then Lama | `supabase config diff` (preview; phase A found it can show stale auth values, so the per-group prompts are what count), then `supabase config push`: the CLI shows each changed group's diff and asks. Lama answers each prompt: yes for auth (6-digit codes, 10 minutes, the two hooks, the templates, the rate limits from `[remotes.staging.auth.rate_limit]`), api and storage; no for anything that would change SMTP (it can't: the file declares none) | Pushed. Then repeat A7 once: the code still arrives (SMTP untouched) |
| B7 | Lama | Vercel → Settings → Functions → Function Region: **Dublin (dub1)** (spec decision 3) | Saved |
| B8 | Lama | Vercel → Settings → Environment Variables, **Production only** (decision 13). See the table below | Saved |
| B9 | Lama | Vercel → Deployments → the latest production deployment → Redeploy, without the build cache (`NEXT_PUBLIC_SITE_URL` and `VOSSIE_NOINDEX` are read at build) | "Ready" |
| B10 | Lama, controller reading headers | **Smoke test on https://vossie-pi.vercel.app** (below) | Every line passes |
| B11 | Lama | **Become admin:** after B10's first sign-in, SQL editor: `select private.make_first_admin('<your student address>');` then reload `/admin` | `made`; the admin console opens; the audit log shows "Set up outside Vossie" |
| B12 | Lama, then controller | The next day, SQL editor: `select jobname, status, max(end_time) from cron.job_run_details join cron.job using (jobid) group by 1, 2;` Then the controller writes `docs/PROGRESS.md`: the switch, the date, the smoke test's results | `sweep-idle-sessions` and `sweep-unfinished-users` show `succeeded`; recorded |

**Vercel environment variables (Production only):**

| Variable | Value | Secret? | Who enters it, how |
|---|---|---|---|
| `VOSSIE_BACKEND` | `supabase` | No | Lama or controller |
| `VOSSIE_SAMPLE_MODE` | `0` | No | Belt and braces: Supabase already turns sample mode off |
| `VOSSIE_EMAIL_DOMAINS` | `vossie.net,eduvos.com` | No | |
| `SUPABASE_URL` | `https://kahzsitqnocygsrdfpre.supabase.co` | No | |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` from Settings → API Keys | Low (server only, never `NEXT_PUBLIC_`) | Lama copies from the dashboard into Vercel |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` from Settings → API Keys | **Yes: bypasses every access rule** | **Lama only**, dashboard to Vercel, never chat, never a file. Mark it "Sensitive" in Vercel |
| `VOSSIE_AUTH_HMAC_KEY` | 44 characters | **Yes** | **Lama only:** `openssl rand -base64 32 \| pbcopy` in your own terminal, paste into Vercel (Sensitive), keep a copy in your password manager. Changing it later ends sign-ins in progress only |
| `CRON_SECRET` | 64 hex characters | **Yes** | Lama, `openssl rand -hex 32 \| pbcopy` (phase C2's photo sweep) |
| `NEXT_PUBLIC_SITE_URL` | `https://vossie-pi.vercel.app` | No | Check it's already set |
| `VOSSIE_NOINDEX` | `1` | No | **Stays until Lama says launch** |

The SMTP password lives only in Supabase's dashboard. Preview and Development environments get none of the Supabase variables, so branch previews stay on sample mode.

**B10, the smoke test** (Lama on a phone on mobile data, and a laptop; the controller checks headers with `curl -sI`, no cookies needed for the public checks):
1. `curl -sI https://vossie-pi.vercel.app/` has `X-Robots-Tag: noindex, nofollow` and no `Set-Cookie`.
2. `/login`: no sample buttons; step 1 with a `@gmail.com` address says "Use your Eduvos email address."
3. Your student address: a code arrives (Inbox), step 2 accepts it, step 3 asks for name and campus, `/account` shows your address.
4. In the browser's developer tools (laptop): cookies for the site are `vossie_auth` (HttpOnly, Secure, Lax, expiring in 30 days), maybe `vossie_campus`, nothing named `sb-…`, nothing `…code-verifier`.
5. Sign out: the toast; `/account` asks you to sign in. Sign in again: no step 3.
6. A wrong code: "That code isn't right. 4 tries left."
7. Download your data: your address, one consent, sessions with dates, no ids.
8. B11 (admin), then `/admin` opens; a second test account (a willing classmate, or a second address you hold) can't open `/admin`.
9. With a second test account: Delete my account → toast; that address signs in again as new (step 3).
10. Dashboard → Logs → Auth shows no errors for these sign-ins.

**Rollback (any step from B8 on):** in Vercel, set `VOSSIE_BACKEND` back to `sample` (or delete it) and remove `VOSSIE_SAMPLE_MODE`, then redeploy. The site returns to sample mode; the live project's data stays as it is. Nothing in the database needs undoing.

---

## Which tasks share files

| File | Tasks |
|---|---|
| `lib/auth/config.ts` | 1, 3 (reads `SESSION_TTL_MS`), 5 |
| `lib/auth/session.ts` | 5, 7 (`endSessionAfterDeletion`) |
| `lib/auth/sign-in-finish.ts`, `actions.ts`, `messages.ts` | 5 (and 7 adds `delete-failed` to `messages.ts`) |
| `lib/data/rows.ts` | 5 (`SignInError`), 7 (`delete-failed` if form errors are typed there) |
| `lib/data/auth-session.ts` | 4, 5 (consumer), 7 (consumer) |
| `lib/data/session-renewal.ts` | 4 (file), 6 (body) |
| `lib/data/accounts.ts`, `form-states.ts`, `sessions.ts`, `sign-in.ts` (switch lines) | 4 only, but **C0 and C-modules also edit `lib/data/*`**: coordinate with phase C's controller; these four are phase B's (spec section 3) |
| `lib/supabase/cookies.ts`, `auth.ts` | 3 |
| `supabase/config.toml` | 10 (and 2b may touch `[auth]` or seeds: merge by hand) |
| `app/privacy/page.tsx`, `page.test.tsx` | 7 (`delete-failed` notice, only if it shows there), 9 |
| `.env.example` | 10 (2b and C0 may add lines: keep both) |
| `CLAUDE.md`, `GO-LIVE.md`, the spec | 12 (main's controller edits these too: a quiet window) |

Tasks 1, 2 and 3 are independent and may run in parallel (different files). Task 4 needs 2 and 3 (and C0). Task 5 needs 1 and 4. Tasks 6 and 7 need 4 and 5. Tasks 8 and 9 need 5. Task 10 needs 2. Task 11 needs 1 to 10. Task 12 after 11. Task 13 Part A any time; Part B last.

## Dependencies on the step 2b and phase C plan

- **C0's `VOSSIE_BACKEND` reader**, importable by `lib/auth` (Task 1), and its per-module switch convention (Task 4).
- **C0's `pnpm test:db`** and its local-stack setup (Tasks 4, 11).
- **2b's allowed-domains migration** with exactly `vossie.net` and `eduvos.com` (no `vossie.test` outside `seed.sql`), so the hooks and `VOSSIE_EMAIL_DOMAINS` agree (Task 13 B3; A6 is the stopgap for the email test).
- **2b's reference-data migration** (campuses, categories, pickup points), so B3's clean-up leaves step 3's campus list intact.
- **C2's photo-file removal helper**, if it lands first (Task 4's deletion uses it; otherwise the deletion removes Storage paths itself).
- **C3** moves `getAccountActivity`'s counts; **C5** uses `requireLiveAccount()` for staff actions and replaces `takeFormState`'s callers (decision 15).
- **Part B of the runbook needs all of phase C** (every module on Supabase): flipping `VOSSIE_BACKEND` with half the modules still on the sample store would show uuid accounts against fixture data.

## Review

One combined reviewer (plan, then quality) after Tasks 1 to 5 and one after Tasks 6 to 11, each time-boxed to about 25 minutes, read-only, running `pnpm test`, `pnpm test:db` and `supabase test db` only. The final review, by the most capable model, checks the session and cookie handling against Supabase's guide and the privacy page against the code before the merge.

## Self-review

- **Spec coverage:** section 5's three steps (Tasks 4, 5), the cookieless code send and the cookie client for `verifyOtp` (phase A's `authClient`, kept), `vossie_auth` (Tasks 3, 9), `proxy.ts` with no-store (Task 6, with a spike for Next's own `Cache-Control`), `getClaims` (Tasks 4, 5), roles every request (decision 7), deletion and export (Tasks 4, 7), sign-out local scope (Task 5), the privacy page (Task 9). Stage K's shape (Route Handlers, `isSameOrigin`, 303s, prefixes, amendment 7) is kept and tested (Tasks 1, 7). The rate limits: per email in the app, per address by Supabase with `Sb-Forwarded-For` (decisions 4, 16).
- **Things I checked rather than assumed:** the cookie defaults and `setAll`'s headers in the installed `@supabase/ssr`; that Next reads back a cookie set earlier in the same Route Handler; that the inactivity timeout is Pro-only; how Auth stores codes; that `config push` leaves undeclared settings alone and prompts per group; Microsoft's current timeline.
- **Gaps left on purpose:** the expired-code path is unit-tested only (10 minutes is too long for e2e); `takeFormState` waits for phase C; Next's `Cache-Control` on prerendered pages is a spike, not an assumption; the privacy wording is Lama's.
- **Placeholders to resolve at Task 0:** C0's module names and the `test:db` pattern; migration and pgTAP file numbers after 2b; the audit log's column names for `make_first_admin`.
- **Risk ranking:** (1) Microsoft 365 SMTP failing now or at the end of December 2026; (2) the live project on Free (no backups); (3) the proxy's headers on prerendered pages; (4) campus networks sharing one address against Supabase's per-address limits (raised in decision 16, watched in Auth's logs after launch).

## Ledger

| Task | Status | Commit |
|---|---|---|
| 0 Baseline | Done: pgTAP 2,289 (35 files), unit 2,768, db 51; main still at `04aa943` | |
| 1 Sign-in mode | Done | |
| 2 Migration | Done: `20261021130000_sign_in_phase_b.sql`, pgTAP 2,337 (36 files) | |
| 3 Supabase clients | Done | |
| 4 `lib/data` on Supabase | Done: unit 2,903 (353 files), db 57 (11 files) | |
| 5 `lib/auth` on Supabase | Done | |
| 6 `proxy.ts` | Done: spike passed (Supabase's no-store survives on ◐ and ○ pages) | |
| 7 Route Handlers | Done | |
| 8 Sign-in card | Done (tests only; no code change needed) | |
| 9 Privacy page | Done: `NOT_YET_SET` gone, the full cookie check is back | |
| 10 Config and ops scripts | Done: clear-out run locally with commit (0 users, 0 shops, 13 campuses, 10 categories, 24 pickup points, `eduvos.com, vossie.net`), then reset | |
| 11 Integration and e2e | Done: unit 2,933 (357 files), db 60 (12 files), pgTAP 2,337 (36 files); `pnpm e2e:supabase` 23 passed, 5 skipped (desktop-only checks at phone); sample sign-in-return, accounts and performance at 390 and 1440: 110 passed | |
| 12 Docs | Done (`docs/PROGRESS.md` left for main at merge) | |
| 13 Runbook A (email) | | |
| 13 Runbook B (switch) | | |

## Changes made during the build

- Task 0: baseline on `02a3458` (C1 committed): pgTAP 2,289 in 35 files, unit 2,768, db 51; lint and typecheck clean. Main hasn't moved past `04aa943`. `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.117.3 as checked. `supabase status -o env` names `API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY` and `DB_URL` (CLI 2.118).
- Task 1: `signInMode()` reads C0's `onSupabase()` (the controller's one name), not a local `usesSupabase`. A sign-in card test on Supabase was added to `components/auth/SignIn.test.tsx`; the step 2 sample line is the view's (`sampleCode` null on Supabase, Task 5).
- Task 2: the errors check also takes amendment 18's `code-check-failed`. `save_sign_in_attempt` goes further than amendment 2's rule, which still let a stale "wrong" save undo a lockout (the lockout nulls `code_expires_at`, so the stale save's code read as "new"): a lockout (`step = 'email'` with `locked`) now sticks, as no later save of that key is legitimate (signing in again starts a new attempt); a late save about an older code keeps the newer code and its count; otherwise the count is never lowered except by a later `codeExpiresAt`. Bad input raises 22023 (no key, or `expiresAt` missing or more than 31 minutes ahead). `make_first_admin` returns `no-account` for a blank address. Test 06's service-role allowlist gains the four new functions (one assertion's array). `forget_account` already cleared the address's sign-in rows (test asserts it). Amendment 17's `auth.audit_log_entries` assertion is not written: it waits on Lama's choice. Advisors: nothing at warn or error. `pnpm db:types` adds the four functions only.
- Task 3: `AUTH_COOKIE` and `isAuthCookie` live in the plain `lib/auth/cookie-names.ts` (amendment 4), re-exported by `lib/supabase/cookies.ts`. The 30 days is `sessionLifetime(options)` (`maxAge` 0 stays 0), applied in `requestCookies().setAll` and in `renewalClient`'s `setAll` before `onSet` (amendment 1); `authCookieOptions()` carries `maxAge` for the record only. `clearHere()` is in `lib/supabase/auth.ts` (outside the `AuthClient` type). `AuthRefusal` gains `tooSoon?: true`, set only for `over_email_send_rate_limit` whose message starts "For security purposes" (amendment 5; the message is read to classify, never passed on). Local Auth answers the domain hook's refusal with status 403 and no code.
- Task 4, **`forViewer()` as built** (for C2–C5): `lib/data/supabase/clients.ts` `forViewer(): Promise<DbClient>` imports `./auth-session` with `import()` (no cycle), takes `viewerSession()` and returns `tokenClient(accessToken)` from `lib/supabase/viewer.ts`: the publishable key with the verified access token as a bearer, `persistSession`/`autoRefreshToken` off, so no page read can refresh the session (amendment 3 applied to the viewer client too, not only `currentClaims`; the cookie `viewerClient()` is kept but unused). It rejects with "forViewer() needs a signed-in session" when signed out. `viewerSession(): Promise<VerifiedSession | null>` (`SessionClaims & { accessToken }`) in `lib/data/supabase/auth-session.ts` reads the cookie each call and verifies once per token per render (React `cache` keyed by the token), so a session changed mid-request is never answered from before. C2's `viewerId()` is one line over it: `(await viewerSession())?.userId`, or throw; not written here. `tests/db/viewer.ts`'s seam is unchanged and still replaces `forViewer`.
- Task 4, **the auth façade as built:** `lib/data/auth-session.ts` exports `SessionClaims`, `SendOutcome`, `VerifyOutcome`, `currentClaims()`, `readClaims()` (amendment 12's uncached read), `liveUserId()`, `sendSignInCode(email)`, `verifySignInCode(email, code)`, `signOutHere()`, `clearAuthCookies()`. On the sample backend the reads answer null and the rest throw "… runs on Supabase only", loading nothing. `currentClaims` is not wrapped in `cache()` at the façade: a no-argument cache could hand a Route Handler the session from before `verifyOtp`; the per-token cache in the twin gives one check per render instead. Claims need `sub`, `session_id` and `email` (lower-cased). `liveUserId()` is `getUser(token)` on the cookieless public client (no refresh). `signOutHere()` clears the cookie in a `finally`.
- Task 4: `lib/data/session-renewal.ts` is the façade with the early returns (sample backend, no `vossie_auth*` cookie) and the `import()`; `lib/data/supabase/session-renewal.ts` throws until Task 6 writes it (nothing calls it before `proxy.ts`).
- Task 4: `recordWrongTry`'s twin keeps the sample's type (`Promise<number>`) and maps a gone attempt to 0; Task 5 treats any count below 1 as "no attempt" and sends nothing to Supabase, which is amendment 2's intent.
- Task 4: `completeProfile` takes `{ email, firstName, campusSlug, policyVersion, now }` (one signature both backends share; the sample makes the account and records consent, returning false when the address has one). `getViewerAccount(claims)`, `hasProfile(userId)` and `clearSessionFormStates(sessionKey)` each have a sample version. `exportAccountData`'s shared body is the new sample export `assembleExport({ account, consents }, now)`, so the key order isn't copied. The twin's `getViewerAccount` gives a pending shop `sellerSlug: null` (the sample sets it at approval). `updateAccountDetails` and `recordConsent` throw for an id that isn't the session's. Storage removal is in the twin (no C2 helper yet): batches of 1,000 from `photos`, failures logged by status and count only.
- Task 4: unit tests use a new `tests/helpers/fake-supabase.ts` (a chain-recording client). The db tests are `lib/data/supabase/sign-in.db.test.ts` and `accounts.db.test.ts` (sessions, form states with a taken row, deletion with a shop, a listing and another account's conversation, which is kept with `seller_gone`).
- Task 5: Supabase's tests are in two new files, `lib/auth/session-supabase.test.ts` and `lib/auth/sign-in-supabase.test.ts` (step 1, step 2, step 3, the sample button, Send a new code and the view), over `tests/helpers/supabase-auth-fakes.ts`, so the sample suites stay as they were; `messages.test.ts` gains the words. `getSignInView` links each step's errors only to the fields that step shows (`STEP_FIELDS`), so Supabase's refusals on step 2 are unlinked; the sample's errors link as before. `sendCode` returns `SignInError | null`; on Supabase it refuses with `code-soon` before reserving when the attempt's code is under a minute old (amendment 6). `verifySignInCode`'s `failed` is `code-check-failed` (amendment 18). `finishProfile` on Supabase ends the attempt when `readClaims()` is null or names another address (amendment 11).
- Task 5: `app/privacy/page.test.tsx`'s narrowed guard now also skips `lib/data/supabase` (loaded only through `import()` on Supabase, boundaries rule 2): its auth session and `forViewer()` reach the cookie setters. Task 9 still restores the full check by naming the cookie.
- Found: `lib/data/contract/stats.db.test.ts` fails once the hourly `settle-sales` job has run after a reset (it confirms the seed's done sale); a fresh `supabase db reset` passes. Predates this batch.
- Task 9 (done first, controller's decision 1): the privacy page names `vossie_auth` (and its `.0`/`.1` parts) under "Sign-in cookies", Supabase (Ireland), Vercel (Dublin) and Resend (United States, keeping the recipient's address and the email in its logs for its retention period) under POPIA section 72, and that Supabase Auth keeps security records of sign-ins (the IP address and browser) for a limited time. The preview's "in memory" lines gain the live site's ("kept in Supabase's database until you delete it or Eduvos's retention periods remove it"), and the code line says Vossie doesn't keep the code on the live site (Supabase keeps a fingerprint for its 10 minutes). `NOT_YET_SET`, the C0 narrowing (`cookieSetterImports` and its test) and the phase B one (skipping `lib/data/supabase`) are gone: every `vossie_` name in the code must be on the page, with no exception, and a test asserts code outside `lib/supabase` reaches Supabase and the page names `vossie_auth`. The wording is a draft for Lama and Eduvos.
- Controller's decision 2 (amendment 17): no test for Auth's database audit log. Runbook B5 gains "turn off writing Auth audit logs to the database if the dashboard offers it"; otherwise the privacy page's sentence covers it. A GO-LIVE line says the same.
- Controller's decision 3: `getAccountActivity` on Supabase moves to C3; nothing built here.
- Controller's decision 4: `stats.db.test.ts` no longer depends on the job: before each test it takes back any automatic confirmation the job made (`status 'confirmed'`, `confirmed_by 'auto'` back to `done`) and puts it back after, so the counts at the contract's fixed past time match the sample store's whether or not the job has run (checked both ways: fresh reset, and after `select public.settle_auto_confirm()`).
- Task 6, **the spike passed**: on a Supabase build against the local stack, an expired session's request to `/` and `/how-it-works` (◐) and `/offline` (○, `x-nextjs-cache: HIT`, normally `s-maxage=31536000`) all came back with `Set-Cookie: vossie_auth=…; Max-Age=2592000; HttpOnly; SameSite=lax` and Supabase's own `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0` and `Pragma: no-cache`. No fallback needed. The spike also found three things, fixed with tests:
  - every signed-in render logged "Next.js encountered the unstable value `Date.now()` while prerendering" (`getClaims` compares the token's `exp` with the clock): the Supabase auth session now awaits `connection()` once it finds a token, as the sample `getViewer` does; none in the e2e logs since;
  - a removal written through `response.cookies` comes back from Next's render without its `Max-Age=0` (`request-store.js`, `mergeMiddlewareCookies`), leaving an empty session cookie in the browser: removals go straight onto the response's `Set-Cookie` headers, after the sets, and come off the request passed on; the façade treats an empty `vossie_auth` as none;
  - `matcher` now runs the proxy only for a request carrying `vossie_auth` or `vossie_auth.0` (`has`), so signed-out visitors and sample mode never reach it (spec 5's "pay nothing"); `proxy.test.ts` checks both with and without the cookie.
- Task 6, found at Task 11: with `proxy.ts` present, sample `accounts.spec.ts` "Back to the account page after signing out" failed about half the time at 390 and 1440 (never without the file, 5 runs): the test clicked the account page's Saved link before that streamed link hydrated, so the browser loaded `/saved` as a new document, and the Menu click then landed on a page not yet hydrated. The test now waits for the link's hydration first (its expectations unchanged); 6 runs and the final run pass. For the controller: why the proxy's presence shifts the timing wasn't found within the time box.
- Task 7: `endSessionAfterDeletion()` (`lib/auth/session.ts`) replaces the delete route's `SESSION_COOKIE`; on Supabase the route re-checks with `liveUserId()` after `getViewer()`, and a failed deletion leaves `delete-failed` ("We couldn't delete your account just now. Try again in a minute.", no field, so the summary lists it without a link) with the session kept and no tag expired. The Supabase route tests are one file, `app/route-handlers-supabase.test.ts`.
- Task 8: no code change; `components/auth/SignIn.test.tsx` checks the card on Supabase has nothing about samples on any step, and that the three refusals link to the email field on step 1 and are listed without links on step 2.
- Task 10: `email_sent = 1000` locally (it applies when the local stack next starts; local Auth already runs with a high email limit). `[remotes.staging.auth.rate_limit]` records `email_sent = 30` (amendment 21, set in the dashboard: runbook A4 now says so, as amendment 9 asked), 60, 60, 150; `additional_redirect_urls = []` on the live project (amendment 19b); seeding off. `.env.example` as planned (the domains line gives `vossie.net,eduvos.com`). `clear-sample-data.sql` matches the plan, with profiles and policy versions counted too; `supabase/ops/clear-sample-data.test.ts` checks as text that it's one transaction ending in rollback, empties every content table the migrations make, keeps the reference data, and leaves Storage to the dashboard. `make_first_admin` is Task 2's (pgTAP); not run against anything else.
- Task 11: port 3303 (controller), one worker, and the checks of the server's behaviour (wrong tries, ten posts at once, renewal, idle sweep, two accounts in one browser) at desktop-1440 only, to stay inside local Auth's 30 per 5 minutes; no limit was hit. Mailpit and the stack's helpers are one file, `tests/e2e-supabase/helpers/local.ts`, which doesn't import Supabase's packages (boundaries rule 4): SQL runs through `docker exec supabase_db_vossie psql` (no host `psql`), and amendment 2's count of code checks is read from local Auth's container log (`"path":"/verify"`): ten posts at once gave at most 5, and the attempt's counter read 10 (every post counted). Amendment 12's test makes the first session in its own context and copies its cookie in while the browser is on step 2 for the second account, since `/login` shows "signed in" to a signed-in visitor. Test 1's "also without JavaScript" isn't built: `/login`'s form streams inside `<Suspense>`, which needs the browser's JavaScript to show (built the same way in sample mode, whose suite has no such test either). The returning address is a seed account (student or mentor, by project), so no address gets two codes within Supabase's minute. `lib/data/auth-session.db.test.ts` covers the hook's refusal, the code email (subject, the code on its own line in the HTML), a wrong then right code, and the password sign-up guard. supabase-js logs `AuthApiError: Invalid Refresh Token` (status and code, no token) when the proxy finds a swept session; harmless.
- Task 12: CLAUDE.md (four code rules, the commands), the backend spec's section 13, GO-LIVE (ticks for Task 1, the code storage, counting tries, the rate limits and the first admin; lines for Resend, Pro's timeout, backups and Auth's audit log), decision row 82, and the programme plan. `docs/PROGRESS.md` is main's, at merge.

## Amendments on review (2026-10-21)

Checked against the worktree at `04aa943` (`@supabase/ssr` 0.12.7, `@supabase/auth-js` 2.117.3, Next 16.4's docs), Supabase Auth's source (`supabase/auth`, `internal/api/mail.go`, `verify.go`), the CLI's source (`supabase/cli`, `apps/cli-go/pkg/config/auth.go`) and the sibling plan `2026-10-21-supabase-step-2b-and-phase-c-foundation.md` as it stood at review. Amendments 1 to 4 are blockers: apply them before Task 3.

1. **Blocker: `cookieOptions.maxAge` is ignored.** `@supabase/ssr` 0.12.7 spreads `cookieOptions` and then sets `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge` (400 days) on every write, and 0 on every removal (`node_modules/@supabase/ssr/dist/main/cookies.js:228-231` and `:466-471`). Decision 3's 30-day cookie can't come from `cookieOptions`. Change Task 3: the 30 days is applied in the `setAll` callbacks, in `requestCookies()` (`lib/supabase/cookies.ts`) and in the renewal client's `onSet`, as `maxAge: options.maxAge === 0 ? 0 : SESSION_TTL_MS / 1000` for each cookie, with removals left at 0. `authCookieOptions()` may still carry `maxAge` for documentation, but no test may rely on it. Replace the Task 3 test "`verifySignInCode` passes the 30-day `maxAge` in `cookieOptions`" with "after `verifyOtp`, every `vossie_auth*` cookie written has `maxAge` 2592000, and a removal keeps 0". Add the same assertion to the renewal tests and to Task 6 test 4. Task 11 test 1 and B10 step 4 already check the real header. If the package moves past 0.12.7, recheck these lines.

2. **Blocker: the try counter can be lowered, so the 5-try limit can be beaten by posting in parallel.** `record_wrong_try` increments atomically, but every post then saves the whole attempt through `save_sign_in_attempt`, which writes `wrong_tries` from the JSON. A post that counted 1 can land after one that counted 5 and put the counter back to 1. Posts sent together can then each get up to 5 `verifyOtp` calls per round, without limit. The same applies to `lockOut`'s `step = 'email'`, which a stale "wrong" save can undo. Change Task 2's `save_sign_in_attempt`: on conflict, `wrong_tries = case when excluded.code_expires_at is distinct from t.code_expires_at then excluded.wrong_tries else greatest(t.wrong_tries, excluded.wrong_tries) end`, so only a new code (a send sets a new `codeExpiresAt`) resets it. Add pgTAP tests: save with 1 after a count of 5 keeps 5, and save with a new `code_expires_at` and 0 resets. Add a Task 5 unit test: when `recordWrongTry` returns null (the attempt was deleted or swept between the read and the count), go back to `signInPath(next)` without calling Supabase. Don't map null to 0, which would let a try through uncounted. Add a Task 11 e2e test: 10 code posts sent at once on one attempt give at most 5 verifications (count them in Auth's logs or with a spy), and then the attempt is locked.

3. **Blocker: Server Components must not refresh the session.** `getClaims()` with no argument calls `getSession()`, which refreshes an expired session (`GoTrueClient.js:5515-5523`). In a Server Component, `requestCookies().setAll` swallows the write, so the rotated refresh token is never stored. Once the 10-second reuse interval passes, the browser's old token is a reused revoked token. Supabase's sessions guide says the whole session is then terminated. This happens whenever the proxy didn't renew first: Task 6 test 5's failure path, any path outside the matcher (`/photos/[id]` calls `getViewer()`), and clock skew. Change Task 4: only the proxy refreshes. `currentClaims()` reads the stored session without refreshing. It joins the chunks with `combineChunks(AUTH_COOKIE, …)` and decodes with `stringFromBase64URL` after the `base64-` prefix, both exported by `@supabase/ssr`. It then calls `client.auth.getClaims(accessToken)`, which checks the signature and the expiry without refreshing, and returns null for an expired token. Correct Task 6 test 5's description: the render then shows signed out for that request and never refreshes. Add a unit test that `currentClaims()` with an expired access token makes no request to `/token`. Route Handlers that call `getUser()` (`liveUserId`) or `signOut` may still refresh, since they can write cookies.

4. **Blocker: C0's boundary rule.** The sibling plan's `lib/data/boundaries.test.ts` (its Task 12) allows no static import of `./supabase/…` or `@/lib/supabase…` from a `lib/data/*.ts` outside `lib/data/supabase/`: only `import()`. It also requires every file under `lib/data/supabase/` to start with `import "server-only"`. As written, Task 4's `lib/data/auth-session.ts` and Task 6's `lib/data/session-renewal.ts` import `lib/supabase` statically. Move their bodies to `lib/data/supabase/auth-session.ts` and `lib/data/supabase/session-renewal.ts`. Keep the two `lib/data` files as façades that branch on `backend()` and reach the bodies through `await import(…)`. `renewFromProxy` returns `NextResponse.next()` before the import, on the sample backend and without an auth cookie. Move `AUTH_COOKIE` and `isAuthCookie` to a plain module (for example `lib/auth/cookie-names.ts`, next to `SESSION_COOKIE`) that `lib/supabase/cookies.ts` re-exports, so the proxy's cookie check needs no Supabase import. The Supabase versions get the viewer client through the sibling's seam, `forViewer()` in `lib/data/supabase/clients.ts`, not `viewerClient()` directly, so the db tests can mock it. Their signatures follow its `typeof Sample.<fn>` rule.

5. **`over_email_send_rate_limit` means two different things.** Auth returns the same code, with status 429, for the 60-second limit per address ("For security purposes, you can only request this after N seconds.", `validateSentWithinFrequencyLimit`) and for the project-wide hourly email limit ("email rate limit exceeded", `mail.go:341`). Mapping it only to `code-soon` would tell every student "wait a minute" once the project hits its hourly cap. Change the Task 4 mapping table: `code-soon` only when the message starts with "For security purposes". Otherwise the result is `failed`, shown as `send-failed`'s words. This reads the message only to classify it, never to show or log it. Pin both messages in unit tests.

6. **"Send a new code" must not burn the hour's codes.** `sendCode` reserves one of the 5 an hour before Supabase answers. Decision 6 keeps the reservation when Supabase refuses, so a student who presses "Send a new code" four times within a minute gets four `code-soon` answers and has used 4 of their 5 codes. Change Task 5: before reserving, `resendCode` and `sendCode` on Supabase refuse with `code-soon` and call nothing when the attempt's last code was sent less than 60 seconds ago (`codeExpiresAt - CODE_TTL_MS`). State `resendCode`'s mapping explicitly: `email-rate` becomes `code-rate` on step 2, as today's `sendCode(…) === false` does (`lib/auth/actions.ts:62-64`). `startSignIn`'s line `if (await sendCode(attempt, now)) attempt.step = "code"` changes with the new return type (`lib/auth/actions.ts:49`).

7. **Account deletion's partial failure.** If `forget_account` succeeds and the Storage removal then throws, Task 7's `catch` calls `writeFormState`. That inserts into `form_states`, whose `account_id` references the profile that has just been deleted, so the page answers 500 with the account half gone. Change Task 4's `deleteAccountData`: only `forget_account`'s failure throws. A Storage failure is logged with the status and the number of files, no paths, and left to C2's sweep of files no photo row names. Add a GO-LIVE line if C2 doesn't have such a sweep. Task 7's `delete-failed` then only ever follows a deletion that changed nothing.

8. **`clearSessionFormStates` hits the taken-row trigger.** `form_states_keep_taken_rows` (`20261020120400_staff_tools_actions.sql:77`) raises for `authenticated` on a taken, unexpired row. One such row aborts the whole delete at sign-out, so nothing is cleared. The Supabase version deletes `where session_id = $1 and not taken`. The taken rows run out within the hour and the hourly sweep removes them. Add a db test for this.

9. **`email_sent` isn't pushed by `config push`.** The CLI sends `rate_limit.email_sent` only when the file declares `[auth.email.smtp]` with `enabled = true` (`auth.go:423-425`), and decision 11 rightly declares none. Keep the line in `[remotes.staging.auth.rate_limit]` as a record, with a comment that it isn't pushed. Add a step to Task 13: after A4, Lama sets Authentication → Rate Limits → "emails sent per hour" to 100 in the dashboard. Decision 11's claim is half true: the CLI does leave SMTP alone when `smtp` is absent (`nil`, not `enabled = false`), but it pushes every other field of each auth group from the file's values and defaults. B6's per-group prompts are what count. The other rate limits are pushed.

10. **The `SessionRow` type.** `listSessions` returns `SessionRow`, which requires `key` and `accountId` (`lib/data/rows.ts:72`). The sibling's typed-twin rule keeps that type. The Supabase version returns `key: ""` (never a session id) and `accountId` set to the caller's own id. The export already maps only `createdAt` and `expiresAt`. New exports (`hasProfile`, `completeProfile`, `getViewerAccount`, `clearSessionFormStates`) each get a sample version too.

11. **A profileless session.** Decision 7 is right. Make it explicit in Task 5 that `getSignInView()`'s `signed-in` step needs `getViewer()` to return an account, not just claims, so a student between steps 2 and 3 sees step 3 (or step 1 once the attempt runs out), never "signed in". `finishProfile` on Supabase also checks `claims.email === attempt.email` before `completeProfile`. A mismatch ends the attempt, back to step 1.

12. **Same-request reads.** `currentClaims()` is wrapped in React `cache()`. Inside `finishCode` and `finishProfile` (Route Handlers), don't rely on it being fresh after `signOutHere()` or `verifyOtp`. Use an uncached `readClaims()` there, which `currentClaims` wraps. Add a Task 11 e2e test: signed in as A, sign in as B in the same browser. Afterwards there's one `vossie_auth` session, and it's B's.

13. **Task 6 test helper (fixed in the text):** `unstable_doesMiddlewareMatch` from `next/experimental/testing/server`. The docs' `unstable_doesProxyMatch` isn't in the installed build.

14. **File numbers and the backend reader (fixed in the text):** the migration goes after `20261021120700_public_reads.sql`, the pgTAP file is `36_sign_in_phase_b.test.sql`, and `lib/auth/config.ts` reads `backend()` from C0's `lib/backend.ts`.

15. **The default domains.** The sibling plan (its decision 12) changes `emailDomains()`'s default to `["eduvos.com", "vossie.net"]` (`DEFAULT_EMAIL_DOMAINS`). Task 10's `.env.example` line "keeps `eduvos.com` as the code default" follows that instead. `VOSSIE_EMAIL_DOMAINS` in Vercel becomes optional. Keep setting it to the same value, as a belt-and-braces measure.

16. **`vossie.test` on the live project: the plans disagree.** The sibling plan (its staging push, step 5) says staging "keeps `vossie.test` for its sample accounts". This plan makes that project the live one and removes `vossie.test` in B3/B4. The controller resolves this with the sibling's author before either push: Lama's decision 1 makes this plan's version right. The sibling also pushes migrations to the same live project. B1's `migration list --linked` must expect them.

17. **POPIA: what Auth keeps besides the cookie.** With `Sb-Forwarded-For`, `auth.sessions` stores each session's IP address and user agent. Auth also writes `auth.audit_log_entries` (the actor's email and IP for each sign-in and refresh), which `forget_account` and deleting the Auth user leave behind. It keeps platform logs too. Task 9's wording names the IP address and browser kept per session, and Supabase's sign-in logs and how long they're kept. Task 2's `forget_account` test asserts no `auth.audit_log_entries` row names the deleted address, or the runbook turns database audit logging off (Authentication → Settings, "Disable writing auth audit logs to the database") and the page names only the platform logs. This is Lama's choice (below). The data download's `sessions` may add the device name (user agent) with no IP, which is also Lama's call.

18. **Wording for a failed check.** On step 2, `verifySignInCode`'s `failed` shows "We couldn't send the code just now…", which is wrong for a code being checked. Add a fourth code, `code-check-failed`: "We couldn't check the code just now. Try again in a minute." Add it to the attempt's `errors` check in Task 2, to `SignInError` and to `messages.ts`.

19. **Runbook details.**
    - (a) **B2:** before the real push, run `begin; delete from auth.sessions where false; delete from auth.users where false; rollback;` in the SQL editor, to confirm `postgres` still has delete on Auth's tables on the hosted project, which `sweep_idle_sessions` and the clear-out need. In the same visit, read `cron.job_run_details` for `sweep-unfinished-users`, which has run on that project since 2026-10-15.
    - (b) **B6:** `[remotes.staging.auth] additional_redirect_urls` drops `http://localhost:3100` on the live project. Auth's other emails would otherwise accept a redirect to a local address.
    - (c) **Task 11 test 9:** moving `refreshed_at` back needs `psql` against the local database (the admin client can't run SQL). Use the URL `supabase status -o env` prints, read at run time.
    - (d) **A7** creates a live Auth user for Lama. B4's clear-out removes it anyway, so A11's delete is optional, as written.

20. **Ordering note.** Task 1 makes `isSampleMode()` false whenever `VOSSIE_BACKEND=supabase`. The sibling's `pnpm test:db` runs with the Supabase world. Any twin whose behaviour asks `isSampleMode()` or `isSampleAccount()` (message limits, for example) changes there once Task 1 lands. Tell phase C's controller before merging Task 1.

### For Lama

- Amendment 17: turn off Auth's database audit log, or name it on the privacy page (and say how long it's kept). Also: include the device name in Download your data?
- Amendment 18's wording, and amendment 5's: is "send-failed" right when the project's hourly email cap is hit, or do you want a "Vossie is busy, try again in an hour" line?
- Amendment 16: confirm `vossie.test` leaves "Vossie Market" (it's the live project now).

21. **Resend from `wemakesites.co.za` replaces Microsoft 365 (Lama, 2026-10-21).** Vossie goes live first as Lama's submission on https://vossie-pi.vercel.app; Eduvos's official domain and mail follow only if it wins, as a dashboard change plus the privacy page's sender line. Applied in the text above: plan decision 4, open question 2, the risk section (kept as a record, marked superseded), the spec amendment line, the GO-LIVE line, and runbook rows A3, A4, A8, A9 and A10.
   - **Settings:** host `smtp.resend.com`, port `465` (implicit TLS; `587` with STARTTLS also works), username `resend`, password a Resend API key with Sending access restricted to the domain, sender `Vossie <codes@wemakesites.co.za>` (Lama may choose another local part on the domain).
   - **Limits:** Resend's free plan allows 100 emails a day and 3,000 a month. Decision 16's `email_sent = 100` an hour is above the daily cap, so the project's real ceiling is Resend's 100 a day. Set Auth → Rate Limits → emails sent to `30` an hour, so a burst can't use the whole day in minutes; raise it together with a paid Resend plan. A send Resend refuses for its limit reaches the app as `send-failed`.
   - **Privacy page (Task 9):** the hosting paragraph names Resend (United States) as the service that sends sign-in emails, with the recipient's address and the email kept in Resend's logs for its retention period; transfer under POPIA section 72 as for Supabase and Vercel.
   - **Template (A5):** unchanged. The From name is "Vossie"; the body says the code came from Vossie and that you can ignore it if you didn't ask, so a `wemakesites.co.za` address isn't mistaken for phishing.
   - **Tests:** unchanged; local runs use Mailpit. No code depends on the provider.
   - **Risks:** a new domain's first sends may land in Junk until it builds a reputation (the DMARC record helps); the free plan's daily cap; the sender being a domain unrelated to Eduvos, which the template's wording addresses.

### The controller's notes (2026-10-21, after the C4/C5 review)
- **Numbering across the plans (C4/C5 amendment 2):** phase B's migration is `20261021130000_sign_in_phase_b.sql` and its pgTAP files are 36 to 39 (`36_sign_in_phase_b.test.sql`, renamed in the text above). Step 2b/C1 owns `20261021120900`–`…129900` and pgTAP 33–35; C2/C3 `20261022…` and 40–49; C4/C5 `20261023…` and 50–59; step 5 `20261024…` and 60+.
- **Shared helpers:** C2/C3's plan adds `viewerId()` in `lib/data/supabase/clients.ts`, `forViewerAs()` in `lib/data/supabase/viewer.ts` and a `Refused` error class (`refused.ts`). Phase B lands first, so it creates `forViewer()` with those shapes in mind and records what it built under "Changes made during the build", for C2–C5 to reuse.
- **Programme order:** C1 Tasks 18–20 → phase B → C2/C3 → C4/C5 → step 5.
