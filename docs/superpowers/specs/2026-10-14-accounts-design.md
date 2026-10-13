# Vossie sign-in and accounts (sample mode): design spec

- **Date:** 2026-10-14
- **Status:** Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log.
- **Scope:** stage D, the start of the signed-in half: a sample backend that stands in for Supabase, sign-in by email code, sessions, first sign-in, the account page, privacy settings (POPIA), and the shell's signed-in state. Messaging (stage E), selling (stage F) and staff tools (stage G) build on it.

## Related documents

| File | What it is |
|---|---|
| `docs/reference/FUNCTION-MAP.md` | The old demo: A (identity and access), M (privacy and POPIA), the roles table (section 2) |
| `docs/reference/GO-LIVE.md` | Section 2 (sign-in and account) and section 7 (open decisions: which email proves a student) |
| `CLAUDE.md` | POPIA, SAST and request-time rules |

---

## 1. Goal

Every signed-in screen can be built, clicked through and tested before Supabase and an email service exist, and swapping them in later changes only the data layer and the code delivery.

## 2. Decisions

1. **Sample mode until there's a backend.** A server-side sample store stands in for Supabase:
   - one in-memory store per server process, kept on `globalThis` so every route shares it;
   - seeded from the fixtures, and reset on restart;
   - all reads and writes go through `lib/data` functions shaped like the Supabase ones will be.

   `VOSSIE_SAMPLE_MODE` is on unless set to `0`. With it off and no backend, sign-in says it isn't available yet. Nothing in sample mode leaves the server.
2. **Sign-in is an email code, on one page, without JavaScript.**
   - `/login` step 1: your Eduvos email, and a checkbox, "I agree to the privacy policy" (linked, required).
   - Step 2: a 6-digit code. Codes last 10 minutes, and 5 wrong tries end the attempt.
   - Both steps are plain forms posting to Server Actions, so they work before the app's JavaScript arrives.
   - The attempt lives in an `httpOnly` cookie (`vossie_signin`), never in the URL (CLAUDE.md: no personal data in URLs).
3. **In sample mode the code is shown on the page** ("Sample mode: your code is 482913"), since no email is sent. The real email service is a go-live item.
4. **Which emails can sign in is configuration:** `VOSSIE_EMAIL_DOMAINS`, comma-separated, defaulting to `eduvos.com` (an address at it or a subdomain of it). The real domains are an open Eduvos decision (GO-LIVE section 7). A wrong domain says: "Use your Eduvos email address."
5. **Sessions:**
   - an `httpOnly` cookie `vossie_session` holding a random id: 30 days, `SameSite=Lax`, `Secure` on HTTPS;
   - signing out deletes it and the stored session;
   - a second, readable cookie `vossie_signed_in=1` only tells the header which icon to show; the server never trusts it.
6. **First sign-in asks for a first name and a campus** (prefilled from the campus cookie). It's a third step on `/login`. Sellers see the first name in messages; nobody else sees it.
7. **Consent is recorded:** the policy version (`2026-10-draft`) and the time, shown on the privacy settings page.
8. **Sample accounts make testing quick.** Seeded accounts:

   | Email | Role |
   |---|---|
   | `student@eduvos.com` | Student, Midrand |
   | `seller@eduvos.com` | Approved seller, owns Tech corner |
   | `pending@eduvos.com` | Seller waiting for approval |
   | `mentor@eduvos.com` | Mentor |
   | `admin@eduvos.com` | Admin |

   In sample mode, step 1 also shows "Sign in as a sample account" buttons. Each one signs in straight away and goes to `next`.
9. **Roles:** every account is a student. An account can also have a seller profile (pending, approved or paused), and can be a mentor or an admin. `getViewer()` returns the account or `null`. The old development switch `VOSSIE_SAMPLE_SIGNED_IN` goes, and the context strip's activity comes from the account's real numbers (zeros until messaging and selling exist).
10. **Pages that need an account** call `requireAccount(nextPath)` inside `<Suspense>`. It redirects to `/login?next=…` when signed out. After signing in, `next` is followed (`safeNextPath`).
11. **The sign-in links already on the site keep working.** Message, Report, RSVP, Post a request and the rest still link to `signInHref(...)`. Signed-in visitors who follow one land back where they were. Each later stage turns its own links into the real action for signed-in visitors.
12. **Saved stays on the device in sample mode.** Moving saves into the account needs a server write on every heart tap; that arrives with the real backend. The Saved page's note stays true.
13. **Account deletion is immediate in the store** (POPIA): the account, its sessions, consent and future messages and listings are removed, and the visitor is signed out to the homepage with a toast.

---

## 3. Screens

### 3.1 Sign in (`/login`)

- **Frame:** the h1 "Sign in", one card centred on the page column, and the `next` back link under it as now.
- **Step 1 (email):**
  - an email field (`autocomplete="email"`, `inputmode="email"`) and the consent checkbox;
  - a **Send code** button;
  - in sample mode, then a divider "or" and the sample-account buttons.
  - **Errors** sit under the field and are linked with `aria-describedby`:
    - "Enter your email address.";
    - "Use your Eduvos email address.";
    - "Tick the box to agree to the privacy policy.".
- **Step 2 (code):**
  - "We sent a code to t•••@eduvos.com", a code field (`inputmode="numeric"`, `autocomplete="one-time-code"`, 6 digits), and **Sign in**;
  - "Use a different email", which cancels the attempt;
  - in sample mode, the code in a pale note.
  - **Errors:**
    - "That code isn't right. 4 tries left.";
    - "That code has expired. Send a new one.";
    - "Too many tries. Start again.".
- **Step 3 (first sign-in):** "Your first name" (2 to 40 characters), "Your campus" (a select of the 13 campuses, prefilled), and **Continue**.
- **Signed in already:** the page says "You're signed in as {email}", with links to your account and back.

### 3.2 Your account (`/account`)

- The h1 "Your account", the first name, the email, the campus, and "Member since October 2026".
- **Edit details:** first name and campus, a plain form.
- Links, as rows:
  - Saved;
  - Messages (appears in stage E);
  - Selling: "Start selling" or "Your shop" (stage F);
  - Privacy settings.
- **Sign out:** a form button.

### 3.3 Privacy settings (`/account/privacy`)

- **Consent:** "You agreed to the privacy policy (draft of October 2026) on 14 October 2026 at 10:42."
- **Download your data:** a link to `/account/privacy/export`, a route handler that returns a JSON file (`vossie-data.json`). It holds the account, consent, sessions (no ids) and, as later stages add them, messages, reports and listings.
- **Delete your account:**
  - a section with what happens (decision 13);
  - a checkbox "I understand this can't be undone";
  - a red-outlined **Delete my account** button: a form posting to a Server Action.
- The page is `noindex`, like every account page.

### 3.4 The shell

- **Header:** the account icon's link and name follow `vossie_signed_in`:
  - signed out: "Sign in", to `/login`;
  - signed in: "Your account", to `/account`.
- **Menu:** the same, plus **Sign out** when signed in.
- **Context strip:** signed in, it shows the account's activity (new messages, sales to confirm). With nothing to show, it falls back to the returning or trust strip, as now.

---

## 4. Data and code

- `lib/data/store.ts`: the sample store. Accounts, sessions, sign-in attempts and consents now; later stages add messages, reports, listings and seller profiles. It's seeded from `data/fixtures/accounts.ts`.
- `lib/auth/`:
  - `session.ts`: read the session cookie, `getViewer()`, `requireAccount()`;
  - `actions.ts`: the Server Actions for start, verify, profile, sample sign-in, sign out and delete;
  - `email.ts`: domain checks and masking.
- Codes come from `crypto.randomInt`. Session ids come from `crypto.randomUUID()`. Both are only read in Server Actions, never while prerendering.
- Every account page renders per request inside `<Suspense>`. The sign-in page's frame stays prerendered.

## 5. Security

- Server Actions check their input on the server (lengths, formats, domain) and never trust hidden fields for identity.
- `next` is always passed through `safeNextPath`.
- Codes are compared in constant time (`crypto.timingSafeEqual`) and stored hashed (SHA-256).
- Rate limit, in sample mode: 5 codes per email per hour.

## 6. Accessibility

Labels on every field. Errors are announced: the error summary is focused after a failed post, using `autoFocus` on the summary, which needs no client code. Buttons are at least 44px.

## 7. Performance

Sign-in and account pages add no client code beyond the shell. The header's cookie check adds a few bytes to every page, so it's measured, and the stop rule applies.

## 8. Testing

- **Unit:**
  - the store;
  - domain checks and masking;
  - each Server Action (good input, every error, expiry, lockout);
  - `requireAccount`;
  - the export's shape;
  - deletion.
- **End to end:**
  - sign in with an email and the shown code, then come back to `next`;
  - the first-sign-in step;
  - a wrong code and the lockout;
  - the sample-account buttons;
  - the header and menu states;
  - editing details;
  - downloading data;
  - deleting the account;
  - the forms working with the app's bundle blocked.
- **Checks:** axe on each step and page, and the JS budget.

## 9. Not in this stage

- Real email delivery and Supabase Auth (go-live).
- Saves following the account (decision 12).
- Messaging, selling and staff tools (stages E to G).
