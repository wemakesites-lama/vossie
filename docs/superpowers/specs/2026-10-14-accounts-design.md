# Vossie sign-in and accounts (sample mode): design spec

- **Date:** 2026-10-14
- **Status:** Built (2026-10-14), in sample mode. Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision is Claude's recommendation, logged in the decisions log (decision 66 for the changes made on plan review and during the build).
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
4. **Which emails can sign in is configuration:** `VOSSIE_EMAIL_DOMAINS`, comma-separated, defaulting to `eduvos.com` (an address at it or a subdomain of it). The real domains are an open Eduvos decision (GO-LIVE section 7). A wrong domain says: "Use your Eduvos email address." The address must be ASCII and have a well-formed domain, so a look-alike letter can't pass as part of a listed domain (changed on the build's review).
5. **Sessions:**
   - an `httpOnly` cookie `vossie_session` holding a random id: 30 days, `SameSite=Lax`, `Secure` on HTTPS;
   - signing out deletes it and the stored session;
   - the header and menu learn the session from the server, as Server Component slots in the root layout, so there's no readable sign-in cookie and no client code for it (plan decision 1; changed on plan review: it saves bytes on every page);
   - session ids, sign-in attempt keys and codes are stored hashed: session and sign-in tokens like codes (plan decision 4).
6. **First sign-in asks for a first name and a campus** (prefilled from the campus cookie). It's a third step on `/login`. Sellers see the first name in messages; nobody else sees it. An email has one account, ever: a second post for a known email (another tab, a double tap) signs in to the account that exists and doesn't overwrite its name or campus.
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
11. **The sign-in links already on the site keep working.** Message, Report, RSVP, Post a request and the rest still link to `signInHref(...)`. Signed-in visitors who follow one see "You're signed in as…" with a link back to where they were (section 3.1). Each later stage turns its own links into the real action for signed-in visitors.
12. **Saved stays on the device in sample mode.** Moving saves into the account needs a server write on every heart tap; that arrives with the real backend. The Saved page's note and the homepage's save note are reworded so they stay true once sign-in exists (they promised saves would follow you "when sign-in arrives").
13. **Account deletion is immediate in the store** (POPIA): the account, its sessions, consent, any sign-in under way for its address and every sample-outbox row sent to it, and future messages and listings, are removed, and the visitor is signed out to the homepage with a toast. Signing out also lands on the homepage, with a toast ("You're signed out"). The toast's wording travels in a short-lived (60-second) flash cookie, and only the homepage carries the client code that shows it. It shows once: Next keeps recent pages hidden and shows them again on Back, which would run the toast's code again, so the code does nothing once the cookie is gone.

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
  - "Use a different email", which cancels the attempt, and **Send a new code**. A new code gives 5 fresh tries and counts towards the 5 an hour; the page says "We sent a new code.";
  - in sample mode, the code in a pale note.
  - **Errors:**
    - "Enter the 6-digit code." (anything that isn't 6 digits doesn't use up a try);
    - "That code isn't right. 4 tries left.";
    - "That code has expired. Send a new one.";
    - "Too many tries. Start again.";
    - the rate-limit message, "You've asked for 5 codes in the last hour. Try again later.", when an email has had 5 codes in an hour.
  - **How long errors show:** a step's errors, and "We sent a new code.", belong to the post that set them, so they show for 60 seconds after it (`SIGN_IN_ERRORS_SHOW_MS`). The attempt lasts 30 minutes, and a later visit starts clean, without a summary that takes focus. What was typed stays.
- **Step 3 (first sign-in):** "Your first name" (2 to 40 characters once tidied: composed as NFC, with invisible and control characters dropped, and at least one letter), "Your campus" (a select of the 13 campuses, prefilled), and **Continue**.
- **Signed in already:** the page says "You're signed in as {email}", with links to your account and back.

### 3.2 Your account (`/account`)

- The h1 "Your account", the first name, the email, the campus, and "Member since October 2026".
- **Edit details:** first name and campus, a plain form. After a save, a status line says "Your details are saved." It's server-rendered form state, not a toast, so the page needs no client code; it shows until the next post or for 10 minutes.
- Links, as rows:
  - Saved;
  - Messages (appears in stage E);
  - Selling, in three states (plan decision 16): no shop, "Start selling" (`/sell`); a shop waiting for approval, "Your shop" with "Waiting for the Hub's approval" (`/sell`); an approved shop, "Your shop" (the storefront), with "Paused" under it when it is paused. Stage F points them at its own pages;
  - Privacy settings.
- **Hub role:** staff accounts show a line, "Hub role: Mentor" or "Hub role: Admin".
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

- **Header:** the account icon's link and name follow the session, which Server Component slots in the root layout read on the server (plan decision 1):
  - signed out: "Sign in", to `/login`;
  - signed in: "Your account", to `/account`.
- **Menu:** the same, plus **Sign out** when signed in. The menu's rows come from the session on the server too, and Sign out closes the menu first, so the homepage's toast isn't hidden behind it (plan decision 14).
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
- Counting a wrong try, and taking a place in the hour's 5 codes, are each one step in the store (a count and a change with nothing between them), so posts sent at once can't get past 5 tries or 5 codes. The real backend must make both atomic too (GO-LIVE section 6).

## 6. Accessibility

Labels on every field. Errors are announced: after a failed post without the app's JavaScript (a full page load), the error summary is focused with `autoFocus`, which needs no client code; with JavaScript, React doesn't autofocus it, so the summary's `role="alert"` announces it instead and focus stays on the button (plan decision 11). Each form gives its summary its own id (`signin-email-summary`, `account-details-summary` and so on), and its heading's id follows (`…-title`), because Next keeps earlier pages in the DOM and ids must stay unique across them. Buttons are at least 44px. The expired-code case is unit-tested only (an end-to-end test can't wait 10 minutes).

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
