# Vossie hardening: design spec

- **Date:** 2026-10-20
- **Status:** Draft (2026-10-20), decided by Claude under Lama's standing goal (decision 54); Lama may revisit.
- **Scope:** stage K. Four items from the go-live checklist (`docs/reference/GO-LIVE.md`) that sample mode can build:
  1. **Stage D's sign-in replay of a gated page's redirect** (section 6, Quality; PROGRESS's stage H open point; community actions plan amendment 18).
  2. **A limit on messages per account** (section 6, Backend).
  3. **Keyed hashes for sign-in codes and tokens** (section 6, Backend).
  4. **Info pages that say what's true today** (section 6, Content), after stages I and J.

  It builds on stages D (sign-in, sessions, form state), E (messaging, the report limit), H (offers, the session-following links), I (saved searches) and J (staff roles, numbers, Show again). It needs nothing from the other session's uncommitted work (`app/layout.tsx`, `app/globals.css`, `components/header/*`, `components/ui/NavLink*`, `components/tabbar/`, `components/icons*`, and the e2e specs and helper it edits). Its tests go in new spec files.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-14-accounts-design.md` | Stage D: the three sign-in steps, sessions, hashing (section 5), `requireAccount` (2.10) |
| `docs/superpowers/specs/2026-10-14-messaging-design.md` | Stage E: the composer, replies, the report limit (9.7, 9.15), error words |
| `docs/superpowers/plans/2026-10-14-community-actions.md` | Amendment 18: the replay found, the session-following links, the CLAUDE.md rule |
| `docs/superpowers/specs/2026-10-20-staff-accounts-and-numbers-design.md` | Stage J: roles, numbers, Show again; the shape this spec follows |
| `docs/superpowers/specs/2026-10-15-supabase-backend-design.md` | Untracked. Section 4.2 keys the sign-in attempt by an HMAC; section 8 names `VOSSIE_AUTH_HMAC_KEY`; section 4.4 makes counted writes Postgres functions |
| `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` | Kept pages: Next hides earlier pages in React `<Activity>` and keeps their state, "including authentication changes" |
| `node_modules/next/dist/docs/01-app/02-guides/adopting-partial-prefetching.md`, `optimizing-prefetching.md` | With `partialPrefetching: true` (our `next.config.ts`), session data resolves in the App Shell, cached per session on the client |
| `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` | "Client cache behavior": a revalidation from a Server Action clears the whole client cache |
| `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md`, `revalidateTag.md` | `updateTag` works only in Server Actions; a Route Handler uses `revalidateTag(tag, { expire: 0 })` |

---

## 1. Goal

- A visitor who is sent to sign-in from any page that needs an account lands on that page after signing in, however they got there.
- A spammer can't send hundreds of first messages, and no real buyer or seller ever meets the limit.
- A leaked copy of the store can't be turned back into sign-in codes or session tokens.
- How it works, How trust works, Safety and the privacy policy say what Vossie does today.

No public page gains a byte of JavaScript.

## 2. Decisions

### The sign-in replay

1. **The likely mechanism is a kept page's redirect, held in client state, not a cached redirect.** What the code and the docs show:
   - **Signing in already clears the client router's caches.** `startSession` sets a cookie inside the Server Action. Next's action handler sees the changed cookie (`addRevalidationHeader` in `next/dist/server/app-render/action-handler.js`) and answers `x-action-revalidated` "static and dynamic". The client's `serverActionReducer` then calls `invalidateBfCache()` and `invalidateEntirePrefetchCache()`. The `cacheLife` docs say the same: any revalidation from a Server Action clears the whole client cache. So the `refresh()` tried in `afterSignIn` added nothing, which is what was seen.
   - **The server renders the destination signed in.** A Server Action's `redirect()` to a path on this site makes Next fetch that page's Flight data on the server (`createRedirectRenderResult`). `getForwardedHeaders` merges the action's `Set-Cookie` into the forwarded cookie header. So `/looking-for/new` is rendered with the new session, and the response carries the form, not a second redirect.
   - **What survives is component state in a kept page.** With Cache Components, the layout router keeps the last 3 segments at each level in a hidden `<Activity>` (`MAX_BF_CACHE_ENTRIES = 3` in `bfcache-state-manager.js`). The docs say Activity keeps state "across navigations, including authentication changes". Each segment has its own `RedirectErrorBoundary`, a class component that holds `{ redirect }` in state. It acts on the redirect from a `useEffect` in `HandleRedirect`, which calls `router.replace(…)` and then `reset()` in one transition.
   - **The replay.** On the signed-out visit, `requireAccount` throws its redirect inside the page's `<Suspense>`. The boundary for `/looking-for/new` catches it, and its effect starts the replace to `/login?next=…`. `reset()` re-renders the old content, which throws the same redirect again before the navigation commits. Then the segment is hidden, and effects don't run in a hidden Activity. So the boundary is hidden still holding `{ redirect: "/login?next=…" }`.

     After signing in, the action's redirect pushes to the same segment key. Activity shows the kept segment again, its effect mounts, and it calls `router.replace("/login?next=…")` before the new content can show. The visitor is back on sign-in, now signed in, and sees "You're signed in as…".
   - **Confidence:** medium (about 60%) that this is the exact path. High (about 90%) that the fix in decision 2 removes the replay whatever the exact path is, because nothing from the old document survives a full page load. This is a framework behaviour (a redirect boundary's state outliving the redirect in a kept page), with no clean fix at the app level:
     - keying the page on `useRouter().bfcacheId` needs client code wrapped round every page, which means `app/layout.tsx` and bytes on every page;
     - expiring caches doesn't touch component state.

     Decision 6's spike checks the mechanism before anything changes.
2. **The fix: the steps that finish signing in end with a full page load.** The three posts that can start a session become plain HTML form posts to Route Handlers that answer **303 See Other**, so the browser itself loads the destination as a new document:
   - **Step 2's code** (`verifyCode`), which signs in an existing account: `POST /login/code`.
   - **Step 3's profile** (`completeProfile`), which makes the account on a first sign-in: `POST /login/profile`.
   - **The sample-account buttons** (`signInAsSample`): `POST /login/sample`.

   The forms keep their fields, their hidden `next` and their buttons. Only `action` changes, from a Server Action to the handler's path, with `method="post"`. React and Next don't intercept a form whose action is a string, so the browser posts it and follows the 303. That works the same with and without the app's JavaScript. A wrong code, an expired code, a lockout or a missing name ends with a 303 back to `/login?next=…`, exactly as the Server Action's redirect does today. The page then shows the step's errors from the attempt row, as now (accounts spec 3.1).

   Step 1 (`startSignIn`), "Send a new code" (`resendCode`) and "Use a different email" (`cancelSignIn`) stay Server Actions: none of them starts a session.

   **Candidates rejected:**
   - **`refresh()` or `revalidatePath` before the redirect.** It was tried. Changing the cookie already clears the router's caches, and neither touches component state.
   - **A Server Action redirect to a Route Handler path, hoping the client falls back to a hard navigation.** Next fetches the redirect target itself, and `fetch` follows the handler's 303 to the page's Flight data. The client would then make a soft navigation to the handler's address. It depends on internals and gets it wrong.
   - **`window.location.assign()` after the action.** It needs client code on `/login`, and does nothing without JavaScript.
   - **Gated pages showing a "sign in to continue" panel instead of redirecting.** It avoids the redirect boundary entirely, but changes every gated page, adds a tap, and breaks the plain rule that a page needing an account sends you to sign in. Kept as the fallback if the spike's stop rule fires.
   - **Keying pages on `bfcacheId`.** It needs `app/layout.tsx` (another session's uncommitted edits) and client code on every page.
3. **The handlers check that the post came from Vossie.** Server Actions compare the `Origin` header with the host. A Route Handler doesn't, so each of the three does it first, through one function, `isSameOrigin(request)` in `lib/auth/same-origin.ts`:
   - the post's `Origin` header must be present, and its host must equal `x-forwarded-host` when the host sets it, else `host`, which is Next's own rule;
   - otherwise the answer is **403** with a short plain-text body ("This form must be sent from Vossie."), and nothing is read or written.

   The attempt cookie (`vossie_signin`, `SameSite=Lax`) already keeps another site's post from finishing someone's code step. The check matters most for the sample buttons, which need no cookie: without it, another site could sign a visitor in as a sample account (login CSRF).

   A `GET` to any of the three paths answers 303 to `/login`. `robots.txt` already disallows `/login`, which covers them.
4. **Cache tags from a Route Handler use `revalidateTag`.** `signInAsSample` calls `sellersChanged()` when a deleted sample shop comes back, and `updateTag` throws outside a Server Action. `lib/data/tags.ts` gains `sellersChangedNow()`, which calls `revalidateTag(SELLERS_TAG, { expire: 0 })`, the docs' form for "gone immediately" from a Route Handler. Nothing else the three steps do expires a tag.
5. **The way out of a stranded sign-in page loads in full too.** A visitor stranded by a sign-in in another tab, or by a replay this stage didn't foresee, sees "You're signed in as…". Today its only button is a `<Link>` to `/account`, a client navigation that a kept redirect could catch again.
   - `SignedInNote` gains a **Continue** button, a plain `<a href={next}>`, when the page has a safe `next` that isn't `/login` itself.
   - "Your account" becomes a plain `<a href="/account">` too.

   A plain anchor is a full page load, so neither can be caught. Both stay 44px buttons, and there's no client code.
6. **A spike comes first, with a stop rule** (as stage J's decision 15). The plan's first task writes decision 13's reproduction tests and runs them on today's code, before changing anything:
   - it records where the browser ends, and the body of the sign-in post's response;
   - if the client-navigation variant fails on today's code (stranded on `/login`) while the response carries the gated page's own content (its heading), the mechanism in decision 1 is confirmed in substance (the server answered right, and the client undid it). The fix goes ahead;
   - if no variant fails on today's code, the replay can't be reproduced. The stage stops item 1, changes nothing in sign-in, and reports to Lama with what was tried. A working flow isn't changed on a guess. The go-live item stays open;
   - if a variant fails but the response itself carries a redirect to `/login`, the cause is on the server (the cookie isn't reaching the render). The fix still holds, because the 303's request carries the new cookie, but the plan records the different cause.

   After the fix, every variant must pass.
7. **The session-following links stay, and the CLAUDE.md rule softens.** Post a request, Offer to help, Follow and Message keep their `<Suspense>` links: they save a signed-out visitor a bounce, and their tests stay. Once the fix holds, the plan rewrites CLAUDE.md's "Never link a signed-out visitor straight at a page that needs sign-in…" line. It becomes "Prefer `signInHref(next)` or a session-following link for signed-out visitors: it saves a bounce. A direct link is no longer a trap: sign-in ends with a full page load (stage K)." The "Forms are plain `<form action={serverAction}>`" line gains the exception: "except the three sign-in posts that start a session, which post to Route Handlers that answer 303 (stage K)."

### The message limits

8. **Two limits per account, sized well above real use.**
   - **20 new conversations in any 24 hours.** It counts conversations the account started as a buyer: a message about a listing or a question to a shop that made a new conversation.
     - Offers are left out: they have their own limit of 20 per shop a day (community actions spec 2.9), and F's counting leaves them out of enquiries too.
     - A message that joins a conversation the buyer already has (messaging spec 2.2) starts nothing, so it isn't counted or refused by this limit.
     - **Why 20:** a busy first week of term means a student messages a handful of sellers a day for textbooks and a calculator. Twenty different shops or listings in a day is past that, and is what a spammer needs. It matches the offers limit, so the two ways of starting a conversation have the same ceiling.
   - **60 messages in any hour.** It counts every message the account sends, as buyer or as seller: first messages, replies and offers' first messages. A seller's messages are found through their shop.
     - **Why 60:** it's a message a minute for a whole hour. Two people chatting quickly rarely pass 30 in an hour, and a seller answering a queue at the start of term types slower than one a minute. It stops a flood into one thread, and a script.
   - Both windows slide, as the report limit's does ("in the last 24 hours", not "today"), so nothing resets at midnight for a script to wait for.
9. **Where the limits are checked, and in what order.** In the Server Actions, after the fields are checked and before the scam check (an error you can fix comes first, and a refusal never follows a "Check this before you send"):
   - `sendFirstMessage` (`lib/messaging/actions.ts`):
     - when the post would make a new conversation (`findConversation` finds none), the conversations limit;
     - then, always, the messages limit.
   - `sendReply`: the messages limit.
   - The offer composer's send (`lib/looking-for/actions.ts`): the messages limit, after the shop's 20 offers a day.

   A refused post writes the form state with the error and what was typed, never the URL (D decision 3), and goes back to the form with `RedirectType.replace`, as every other refusal does. It writes nothing else: no conversation, no message, no notification.
10. **Everyone has the same limits, staff included; the sample accounts don't, in sample mode.**
    - No staff tool sends messages, and a mentor or admin messages a seller as a student does. So a role changes nothing.
    - The five sample accounts (`student@`, `seller@`, `pending@`, `mentor@` and `admin@eduvos.com`) are exempt while `isSampleMode()` is true. Every end-to-end project and every demo shares them, and a full run starts far more than 20 conversations as the sample student. Fresh accounts, made by signing in with a new address, meet the limits as anyone would. Sample mode, and with it the exemption, goes at launch.
    - The exemption is one function, `isSampleAccount(account)`, reading the fixtures' emails. It's tested both ways.
11. **On the real backend, the count goes with the write.** The two counts here are awaits before the write, as the request and offer limits are, so posts sent at the same moment can slip past them (go-live checklist, amendment 17.8). In Supabase:
    - `start_conversation` and `send_message` are already Postgres functions (Supabase spec 4.4), and they do the count in the same transaction, behind `pg_advisory_xact_lock` on the sender's id;
    - `messages` gains a `sender_id` (set to null when the account is deleted), with an index on `(sender_id, sent_at)`. Counting by side through a join to the shop is slow and wrong once a shop changes hands;
    - `conversations` gains a partial index on `(buyer_id, created_at) where request_id is null`.

### Keyed hashes

12. **HMAC-SHA-256 with a server secret, named `VOSSIE_AUTH_HMAC_KEY`.** It's the Supabase spec's name (section 8), so the app has one name for one key and phase B adds nothing new. **Changed from the brief:** "for example `VOSSIE_CODE_KEY`".
    - `lib/auth/secrets.ts` keeps its function names, so no caller changes:
      - `hashToken(token)` becomes `HMAC(key, "token:" + token)`;
      - `hashCode(attemptKey, code)` becomes `HMAC(key, "code:" + attemptKey + ":" + code)`;
      - both are hex.
    - The purpose prefix keeps a token's hash and a code's hash from ever being the same value.
    - `codeMatches` still compares in constant time (`timingSafeEqual`).
    - With the key, a leaked store gives nothing back: trying all million codes needs the key, which lives only in the host's environment.
13. **What it covers.**
    - **Session tokens:** `vossie_session`'s value, and so every form-state row, which is keyed by the session's hash.
    - **Sign-in attempt tokens:** `vossie_signin`'s value.
    - **Sign-in codes.**

    Left out:
    - **One-time form tokens** (`lib/staff/once.ts` and selling's and saved searches' tokens). They're kept under the session's key, prove nothing on their own, and only stop a second press.
    - **Sample mode's outbox** (`saveSampleEmail`). It keeps the plain code, because sample mode shows the code on the screen to whoever holds the attempt cookie. It goes with sample mode at launch, when an email service sends the code instead.
14. **Without the key: a development key and a loud log in sample mode, a refusal outside it, checked at first use and never at build.**
    - The key is read by one function, `authKey()` in `lib/auth/secrets.ts`, the first time something is hashed. That happens only in a Server Action, a Route Handler or a request-time render that has a sign-in cookie. `next build` prerenders without cookies, so it never calls it, and a missing runtime secret can't fail a build. Nothing reads the variable at module scope; a unit test imports the module with the variable unset and checks that nothing throws.
    - **Set, with at least 32 characters:** it's used as given (UTF-8 bytes). `.env.example` says to make one with `openssl rand -base64 32`.
    - **Set, but shorter:** `authKey()` throws "VOSSIE_AUTH_HMAC_KEY is too short: use at least 32 characters." in any mode. A short key is a mistake to stop, not to work round. The message never includes the value.
    - **Unset, in sample mode** (development, the end-to-end server and the Vercel preview): a fixed development key, `vossie-development-key-not-a-secret`, and one `console.warn` per server process: "[vossie] VOSSIE_AUTH_HMAC_KEY is not set, so sign-in codes and sessions are hashed with the development key. Set it before any real account signs in."
    - **Unset, with sample mode off:** `authKey()` throws "VOSSIE_AUTH_HMAC_KEY must be set when sample mode is off." Today that changes nothing, because sample mode off turns sign-in off and `getViewer()` returns null before hashing. It's the guard phase B's real sign-in will meet first.
    - **Changed from the brief:** "a refusal to start in production". The Vercel preview is a production build in sample mode, and refusing to start would take it down. A start-up check (`instrumentation.ts`) would also run where Next's build could reach it. The refusal belongs to sample mode being off, which is what "real accounts" means here.
15. **Existing rows simply reset.** The store is in memory, and a deploy restarts it. For a development server that keeps `globalThis` across reloads, `STORE_VERSION` goes up by one, so no row hashed the old way is ever matched: everyone signed in is signed out once, and a sign-in under way starts again. Changing the key later does the same, and that's the intended way to end every session at once. `.env.example` says so.

### Info pages

16. **The words change where stages H to J made them out of date, and nowhere else.** Section 6 gives every new sentence. In short:
    - **How it works:** who needs an account, and "What can I do on Vossie today?", gain Looking For, offers, following, saved searches with their alerts, and the Hub's RSVPs and office hours.
    - **How trust works:** a new section, "When something is reported", says what the Hub does with a report, including Show again (stage J).
    - **Safety:** requests can be reported and hidden too.
    - **The privacy policy:** "Your account" opens with everything that needs an account, says what a staff role keeps and who sees it (stage J), and lists every kind of notification. The session cookie's line says the server keeps only a keyed fingerprint (item 3).

    Admins' numbers and the staff log's roles are already in the policy (stage J). The staff tools themselves (staff accounts, numbers, Show again's page) are for staff and get no public explanation.
17. **Each changed page's "Last updated" date is the day the stage lands.** The privacy policy keeps its draft banner.

---

## 3. Item 1: signing in comes back to the page

### Behaviour

- From step 2's **Sign in**, step 3's **Continue** or a sample account's button, the browser posts to the handler. The handler does exactly what the Server Action did:
  - checks the input and the attempt (or, for a sample button, the email);
  - writes the attempt's errors and `postedAt`, or records consent and starts the session;
  - answers `303` with `Location` set to:
    - `next` when it's safe and isn't under `/login` (`afterSignIn`'s rule);
    - else `/account`;
    - or, on any refusal or error, `signInHref(next)` or `/login`.
- `Location` is a relative path. That's valid HTTP, and it avoids building an absolute address from `request.url` behind a proxy. `siteUrl()` isn't needed.
- The new document is the gated page itself, signed in. History holds `/login?next=…` and then the page. Back shows the sign-in page's signed-in note, as it does today.
- The handlers set and delete cookies through the existing helpers (`setPrivateCookie`, `deleteCookie`, `startSession`). They use `cookies()` from `next/headers`, which Route Handlers may write.

### Data and code

- The three actions' bodies move into plain functions in `lib/auth/sign-in-finish.ts`: `finishCode(formData, now)`, `finishProfile(formData, now)` and `finishSample(formData, now)`. Each returns the path to go to, and they're unit-tested without Next.
- `app/login/code/route.ts`, `app/login/profile/route.ts` and `app/login/sample/route.ts` each:
  - export `POST`: `isSameOrigin` first, then `await request.formData()`, then the function, then `new Response(null, { status: 303, headers: { Location: path } })`;
  - export `GET`: a 303 to `/login`.
- `verifyCode`, `completeProfile` and `signInAsSample` leave `lib/auth/actions.ts`; `backToSignIn` and `afterSignIn` become path functions the handlers share.
- `components/auth/SignInSteps.tsx`:
  - `CodeStep`'s main form becomes `<form action="/login/code" method="post" noValidate …>`;
  - `ProfileStep`'s form becomes `<form action="/login/profile" method="post" …>`;
  - the sample list's form becomes `<form action="/login/sample" method="post" …>`;
  - `SignedInNote` takes `next` and draws decision 5's plain anchors. `app/login/page.tsx` passes it through `SignIn`.
- `lib/data/tags.ts` gains `sellersChangedNow()` (decision 4).
- No new table, row or cookie. `STORE_VERSION` moves for item 3, not for this.

### Rules

- Identity still comes only from the attempt cookie and the session, never from a form field. `next` still goes through `safeNextPath`.
- Wrong tries are still counted in one step before the compare (`recordWrongTry`), and codes still in one step against the hour's five (`reserveCodeSend`).
- The Origin check comes before any read of the body or cookies.
- No handler reads the clock or randomness while prerendering: they run only for a request.

### Words

No new words on the screen. The 403's body, "This form must be sent from Vossie.", is never seen by someone using Vossie.

### Privacy (POPIA)

- Nothing new is collected or kept.
- A full page load after sign-in also drops the signed-out pages the browser was keeping hidden, so nothing from before the sign-in lingers in the page.

### Accessibility

- Every refusal is now a full page load, so the error summary is always focused on arrival (`autoFocus`), with JavaScript or without. Today, with JavaScript, it's announced by `role="alert"` and focus stays on the button (accounts spec 6). Focusing the summary is the better behaviour, and it's now the same everywhere.
- The Continue and Your account anchors keep their button look, a 44px target and a visible focus ring. Their names are their visible words, "Continue" and "Your account" (WCAG 2.5.3). Continue sits straight under "You're signed in as…", which gives it its context.

### Performance

- **First-visit JavaScript doesn't move on any page, `/login` included.** The step components are Server Components today. Their forms' Server Action references put a hidden `$ACTION_ID_…` input in the HTML and no client code, so a string `action` changes the HTML by a few bytes and the JavaScript by none. The plan checks it with `pnpm build` and `tests/e2e/performance.spec.ts`: sign-in must stay 150,591 B. Every public page must stay where stage J left it, the listing forms at 152,265 B, 40 B under the 152,305 B stop line. Any change stops the build to find out why.
- **The cost:** one full page load at the end of each sign-in, about the HTML of the destination; the JavaScript is already in the browser's cache. A wrong code also reloads the page rather than patching it. Both happen a few times per sign-in at most.
- No `<Link>` is added. The two anchors don't prefetch.

### Tests

- **Unit** (`lib/auth/sign-in-finish.test.ts`, `lib/auth/same-origin.test.ts`, and a test next to each `route.ts`):
  - every path today's `sign-in-actions.test.ts` covers, moved to the three functions: a right code for an existing account, a right code for a new email (on to step 3), wrong, expired, not six digits, the fifth wrong try, a missing name or campus, another tab finishing first, an unknown sample email;
  - the returned path: `next`, `/account` when `next` is missing or under `/login`, `signInHref(next)` on any refusal;
  - `isSameOrigin`:
    - a missing `Origin` refused;
    - another host refused;
    - `x-forwarded-host` used when present;
    - a port difference refused;
  - each handler:
    - 403 with nothing written for a foreign `Origin`;
    - 303 with a relative `Location` for a good post;
    - `GET` gives 303 to `/login`;
    - the sample handler calls `sellersChangedNow`, never `updateTag`;
  - `SignedInNote` draws Continue as an `<a>` to `next`, none when `next` is missing or under `/login`, and "Your account" as an `<a>`.
- **End to end** (a new file, `tests/e2e/sign-in-return.spec.ts`, read-only apart from sessions and fresh accounts, in the device projects at 390 and 1440px). These are decision 6's reproduction tests:
  1. **Client navigation, sample account.** Signed out, open `/`, wait for the app to hydrate, then `window.next.router.push("/looking-for/new")`, as `messaging.spec.ts` already pushes. Expect `/login?next=%2Flooking-for%2Fnew`. Press "Sign in as Sample student". Expect `/looking-for/new` and its heading, and still there after 2 seconds (the replay was a late `replace`).
  2. **The same with a prefetch first:** `router.prefetch("/looking-for/new")`, wait, then `push`. The board's old plain `<Link>` prefetched the App Shell, which for a signed-out visitor carries the redirect.
  3. **Client navigation, by code:** the same to `/account`, signing in with a fresh address, the shown code and step 3. Expect `/account` with "Your account".
  4. **A dynamic gated page:** the same to `/listings/l-001/message`. Expect the composer.
  5. **A full load first:** `page.goto("/account")` signed out, then sign in. Expect `/account`.
  6. **Without the app's JavaScript** (bundle blocked, as E's tests do): variants 3 and 5 end on the page.
  7. **Back** after variant 1 shows the sign-in page's "You're signed in as…" with Continue, and Continue opens `/looking-for/new`.
  8. **A foreign post:** `page.request.post("/login/sample", { headers: { Origin: "https://evil.example" }, form: … })` answers 403, and `/account` then still goes to sign-in.

  The spike (decision 6) also logs, for variant 1 on today's code, the sign-in post's response (whether it carries "Post a request" or a redirect) and every URL the page passes through.
- **Checks:**
  - axe on `/login`'s signed-in note with Continue, at 390 and 1440px;
  - layout shift on `/login` (step 2 after a wrong code) under 0.05;
  - the JS budget above.
- `accounts.spec.ts`, which another session has edited, isn't touched. If one of its tests fails because a step now reloads the page (a wait for a soft navigation, say), that's recorded and handed to Lama, not edited here.

## 4. Item 2: the message limits

### Behaviour

- The composer, a thread's reply form and the offer composer refuse a post past a limit, with the error in the form's error summary, what was typed kept, and nothing sent. The scam check isn't reached, so no "Check this before you send" comes first.
- On the composer, a buyer at the conversations limit can still message a seller they've already written to: the Message link opens that thread (messaging plan decision 2), and a reply there counts only towards the hour's 60.
- The limits never show before they're reached. A real buyer or seller should never see them.

### Data and code

- `lib/messaging/rules.ts`:
  - `CONVERSATIONS_PER_DAY = 20`;
  - `MESSAGES_PER_HOUR = 60`;
  - `HOUR_MS`.
- `lib/data/messages.ts`:
  - `countConversationsStartedSince(buyerId, since)`: conversations with `buyerId` set to the account, no `requestId`, and `createdAt` after `since`;
  - `countMessagesSentSince(accountId, shopSlug, since)`: messages after `since` that are either `from: "buyer"` in a conversation whose `buyerId` is the account, or `from: "seller"` in one whose `sellerSlug` is the account's shop (`shopSlug` null for an account with no shop).

  Both read the store only, with no new rows. Counting is a loop over the store, fine at sample mode's size.
- `lib/messaging/limits.ts`: `messageLimitErrors(account, { newConversation }, now)` returns `[]`, `["conversation-rate"]` or `["message-rate"]` (the conversations limit first). It returns `[]` for a sample account in sample mode (`isSampleAccount`, decision 10). The three actions call it.
- `lib/auth/sample-accounts.ts` (or the fixtures module that already lists them): `isSampleAccount(account)`, true when the account's email is one of the five fixtures' and `isSampleMode()`.

### Rules

- The account is the session's, never the form's.
- A message counts when stored. A refused post stores nothing, so it doesn't count.
- Deleting an account deletes its messages (messaging spec 9.8), so its counts go with them. No limit outlives the account.
- Offers count towards the hour's 60, never towards the 20 conversations.

### Words

In `lib/messaging/errors.ts`, beside `report-rate`, belonging to no field (`field: "none"`), so the summary has no link:
- `conversation-rate`: "You've started 20 conversations in the last 24 hours. You can still reply in those. Try again later to start a new one."
- `message-rate`: "You've sent 60 messages in the last hour. Try again later."

Both are built from the constants, as the report limit's are. The offer composer's list (`lib/looking-for/errors.ts`) gains `message-rate` with the same words.

### Privacy (POPIA)

- Nothing new is stored: the limits count rows that already exist (messages and conversations), at the moment of a post.
- Nobody else sees that someone reached a limit: not the other person, and not staff.
- The privacy policy needs no new sentence.

### Accessibility

- The error summary is E's (`ErrorSummary`), with the form's own id, focused after a post without the app's JavaScript and announced by `role="alert"` with it.
- The words say what was counted and what still works, so nobody has to guess.

### Performance

Server only: three actions and two data functions. No component changes, so no page's JavaScript or HTML moves.

### Tests

- **Unit:**
  - `countConversationsStartedSince`:
    - offers left out;
    - a conversation joined again (not created) not counted;
    - the 24-hour edge;
    - a deleted buyer's gone;
  - `countMessagesSentSince`:
    - a buyer's and a seller's messages both counted;
    - the other side's not;
    - an offer's first message counted for the shop;
    - the hour's edge;
  - `messageLimitErrors`:
    - under, at and past each limit;
    - the conversations limit only for a new conversation;
    - staff not exempt;
    - each sample account exempt in sample mode and not with sample mode off;
  - each action:
    - the 21st new conversation refused, with what was typed kept and nothing written;
    - a message into an existing conversation at 20 conversations goes through;
    - the 61st message in an hour refused on a reply and on an offer;
    - a refusal comes before the scam check;
  - the error words and their constants.
- **End to end** (new, `tests/e2e/hardening-writes.spec.ts`, in a new project, `hardening-writes`, at 1440px, run after `staff-accounts-writes`, because it starts conversations the sample seller's inbox shows):
  - a fresh account messages 20 different listings across the sample shops, then a 21st:
    - the summary says the conversations limit and has focus without the app's JavaScript;
    - the typed message is still in the field;
  - the same account replies in one of its 20 threads, and it's sent.

  The hour's 60 is unit-tested only: 61 posts make a slow test of a rule the unit tests pin.
- **Checks:** axe on the composer showing the conversations limit, at 1440px.

## 5. Item 3: keyed hashes

### Behaviour

Nothing a student sees changes. On a server without the key, the log has decision 14's line once.

### Data and code

- `lib/auth/secrets.ts`:
  - `authKey()`: reads `process.env.VOSSIE_AUTH_HMAC_KEY` once and caches it per process;
  - `hashToken` and `hashCode` use `createHmac("sha256", authKey())` with decision 12's prefixes;
  - `codeMatches` is unchanged apart from the hash it compares.
- `STORE_VERSION` goes up by one (decision 15). No row's shape changes.
- `.env.example` gains:

  ```
  # The secret that keys the hashes of sign-in codes, session tokens and sign-in attempt tokens (stage K). At least 32
  # characters: make one with `openssl rand -base64 32`. Unset in sample mode, a fixed development key is used and the
  # server logs a warning; unset with sample mode off, signing in refuses to run. Changing it signs everyone out.
  # VOSSIE_AUTH_HMAC_KEY=
  ```

### Rules

- The key is never logged, never sent to the browser, never in a `NEXT_PUBLIC_` variable, and never in the repo.
- It's read only at request time (decision 14).
- One key serves sample mode and phase B. In phase B, Supabase Auth makes, hashes and checks the email codes and keeps the sessions itself (Supabase spec 5). The key then keys the `vossie_signin` attempt (Supabase spec 4.2) and anything still hashed in the app. Phase B confirms from Supabase's own docs how Auth stores email codes, and records it on the go-live list.

### Privacy (POPIA)

- POPIA section 19 asks for reasonable security measures. A keyed hash is one: a stolen store without the key gives no codes and no live sessions.
- The privacy policy's session cookie line says so (section 6).

### Accessibility

Nothing changes.

### Performance

Server only. An HMAC costs about what a SHA-256 does. No page changes.

### Tests

- **Unit** (`lib/auth/secrets.test.ts`):
  - the same input and key give the same hash;
  - another key gives another hash;
  - `hashToken(x)` never equals `hashCode` of anything that joins to the same string (the prefixes);
  - `codeMatches` true and false;
  - the development key with one warning, however many hashes;
  - the short key refused, with a message that doesn't contain the key;
  - unset with sample mode off refused;
  - importing the module with the variable unset throws nothing.
- **Session and sign-in tests** keep passing unchanged, since they go through the same function names. One test checks that a session row made before `STORE_VERSION` moved isn't found.
- **A guard test:** `lib/auth` has no `createHash(` left (a grep in a unit test, as `install-event.test.ts` does for its rule).
- **End to end:** nothing new. Every sign-in test already exercises it.

## 6. Item 4: the info pages

Exact sentences. Apostrophes are written as `&apos;` in the JSX, as now. Nothing else on these pages changes.

### How it works (`app/how-it-works/page.tsx`)

- **"Who can use Vossie?"**: replace the paragraph with:

  > Anyone can browse, save and share listings, and read Looking For and the Hub. Messaging, selling, reporting, posting a request, following a shop, saving a search and saying you'll go to a Hub event need an account. Accounts are for Eduvos students, who sign in with their Eduvos email address.

- **"What can I do on Vossie today?"**: replace the paragraph with these two:

  > Browse every campus, save listings on your device and share them, and sign in with your Eduvos email. Signed in, you can message sellers, report a problem, ask for something on Looking For and read shops' offers, follow shops, save a search and hear when a new listing matches it, say you'll go to a Hub event or ask for an office-hours slot, and set up a shop of your own.

  > While Vossie is a preview, what you add lives in the server&apos;s memory, so it can disappear when the server restarts. Notifications show on Vossie only: nothing is emailed yet.

- `updated` becomes the landing date.

### How trust works (`app/trust/page.tsx`)

- **"The three badges"**, the sample note: unchanged. It's still true: only Tech corner has an account behind it, and the other shops are samples.
- **A new section, "When something is reported"** (`id: "trust-reports"`), after "What counts" and before "How Featured today is picked":

  > Anyone signed in can report a listing, a shop or a Looking For request. A member of the Hub team reads every report.

  > The Hub can hide a listing or a request, or pause a shop. It tells the seller, or the student who asked, and they can see why. It tells the person who reported it that the Hub has acted, and never names them to the seller.

  > If the Hub hid something it shouldn&apos;t have, it can show it again, and tells the seller or the student who asked. Hub staff are mentors and admins from the Eduvos Incubation Hub, and only a Hub admin can give someone that role.

- `metadata.description` becomes: "How Vossie decides who to trust: Verified sellers, the New seller, Responsive and Trusted badges, what happens after a report, and how Featured today is picked."
- `updated` becomes the landing date.

### Safety (`app/safety/page.tsx`)

- **"Reporting a problem"**, its first paragraph becomes:

  > If a listing, a request or a person worries you, report it. Every listing, every seller&apos;s page and every Looking For request has a Report link. Reporting needs an account: signed out, the link takes you to sign in first, then to the report. A member of the Hub team reads every report, and can hide a listing or a request, or pause an account.

- `updated` becomes the landing date.

### Privacy policy (`app/privacy/page.tsx`)

- **"What this site stores today"**, first paragraph: after "your account, your sign-ins, your consent," insert "your staff role if you have one,".
- **The `vossie_session` line** becomes:

  > `vossie_session`: a random code that keeps you signed in, for up to 30 days. Vossie&apos;s server keeps only a fingerprint of it, made with a secret key, so the code can&apos;t be read back from the server&apos;s records. Signing out or deleting your account ends it.

- **"Your account"**, the opening paragraph becomes:

  > You need an account to message, sell, report, post on Looking For, follow shops, save searches and RSVP to the Hub. Later, keeping your saved listings on every device will need one too. This is what your account holds, and why.

- **The email bullet** gains one sentence, after "…to send you sign-in codes." and before "Allowed under":

  > A sign-in code is kept only as a fingerprint made with a secret key, and only until you finish signing in or the attempt runs out after 30 minutes.

- **The notifications bullet** becomes:

  > **Your notifications.** A note when someone messages you, a sale needs confirming, a shop offers to help with your request, a shop you follow lists something new, a search you saved has a new match, the Hub acts on your report, your shop, your listing or your request, or your staff role changes. Only you see them. Allowed under POPIA section 11: needed to run your account.

- **A new bullet, after "A log of what Hub staff do"**:

  > **If you&apos;re Hub staff: your role.** Whether you&apos;re a mentor or an admin. A Hub admin gives the role using your exact Eduvos email, and Hub admins see the first name, email and campus of everyone with a role. Nobody can search or list students who don&apos;t have one. Allowed under POPIA section 11: our legitimate interest in running Vossie safely.

- `updated` becomes the landing date. The draft banner stays.

### Privacy, accessibility and performance

- These are words only. Every page stays a static Server Component in the `InfoPage` frame, with its headings in order and its new section a labelled region like the others.
- No JavaScript or cookie changes, so the privacy page's name test needs nothing.
- Every claim above is true in sample mode today; none promises what isn't built. "Notifications show on Vossie only" matches decision 57 and the search alerts spec. The trust page's "and they can see why" matches `listingHiddenText` ("See why in My listings") and the asker's Your requests.

### Tests

- **Unit:** each page's test:
  - checks its new sentences (one key phrase each: "saved a search", "When something is reported", "every Looking For request", "If you're Hub staff");
  - checks the trust page's section order;
  - checks that no page still says "Messaging, selling and, later" or "and can hide a listing or pause an account.".

  `how-it-works/page.test.tsx`'s "six short questions" stays six.
- **Checks:** axe on `/trust`, `/how-it-works`, `/safety` and `/privacy` at 390px (the info pages' existing axe test may already cover them; the plan checks before adding one).

## 7. Files (summary)

| File | Change |
|---|---|
| `app/login/code/route.ts`, `app/login/profile/route.ts`, `app/login/sample/route.ts` | New: the three posts that start a session (item 1) |
| `lib/auth/sign-in-finish.ts`, `lib/auth/same-origin.ts` | New: the steps' logic, and the Origin check |
| `lib/auth/actions.ts` | Loses `verifyCode`, `completeProfile`, `signInAsSample` |
| `components/auth/SignInSteps.tsx`, `components/auth/SignIn.tsx`, `app/login/page.tsx` | Three forms' `action`; `SignedInNote`'s anchors and `next` |
| `lib/data/tags.ts` | `sellersChangedNow()` |
| `lib/messaging/rules.ts`, `errors.ts`, `actions.ts`, `limits.ts` (new) | The two limits |
| `lib/data/messages.ts` | The two counts |
| `lib/looking-for/actions.ts`, `lib/looking-for/errors.ts` | The hour's limit on offers |
| `lib/auth/sample-accounts.ts` (new, or the fixtures' module) | `isSampleAccount` |
| `lib/auth/secrets.ts`, `lib/data/store.ts`, `.env.example` | Keyed hashes, `STORE_VERSION`, the variable |
| `app/how-it-works/page.tsx`, `app/trust/page.tsx`, `app/safety/page.tsx`, `app/privacy/page.tsx` | Words (section 6) |
| `tests/e2e/sign-in-return.spec.ts`, `tests/e2e/hardening-writes.spec.ts`, `playwright.config.ts` | New tests; the `hardening-writes` project, run last |
| `CLAUDE.md` | Decision 7's two lines, once the fix holds |

None of these is in the other session's uncommitted set. `app/layout.tsx` isn't needed, so nothing blocks item 1.

## 8. Not in this stage

- **A full page load on sign-out and on deleting an account.** Kept pages (decision 1) mean a signed-in person's pages, their email on `/account` say, can stay hidden in the document after signing out, until the tab is closed or reloaded. On a shared campus computer that's worth closing. The same fix (a Route Handler answering 303) applies, but sign-out sits in the menu, the account page and the toast's tests in `accounts.spec.ts`, which another session has edited. So it waits for that work to land (an open question for Lama).
- Reporting the kept-redirect behaviour to Next.js upstream with a minimal reproduction (an open question).
- Showing the message limits before they're reached, a limit on unanswered messages in a row, or staff seeing who reached a limit.
- Per-IP limits on sign-in (go-live, with the real backend).
- Counting the limits atomically (go-live, decision 11).
- Rotating the key without signing everyone out (two keys tried in turn). Not needed while sessions live in memory.
- Moving any other form to Route Handlers. Every other form stays a Server Action.
- Info pages beyond section 6, and the terms and seller guidelines, whose moderation sentences are still true.

## 9. Go-live changes

For `docs/reference/GO-LIVE.md`, when the stage is built:
- **Section 6, Quality:** tick "Stage D's sign-in replay of a gated page's redirect", with "sign-in ends with a full page load (stage K)". If decision 6's stop rule fires, it stays open with the spike's findings.
- **Section 6, Backend:**
  - tick "Keyed hashes for codes", with "HMAC-SHA-256 under `VOSSIE_AUTH_HMAC_KEY` (stage K)";
  - add "Set `VOSSIE_AUTH_HMAC_KEY` (32+ characters) in every deployed environment, the Vercel preview included, so no deployment uses the development key";
  - add "Phase B: confirm how Supabase Auth stores email codes";
  - tick "A limit on messages per account", with "20 new conversations a day and 60 messages an hour (stage K)";
  - add "The message limits counted in the database: `start_conversation` and `send_message` count with the write, under an advisory lock on the sender; `messages.sender_id` with an index on `(sender_id, sent_at)`; a partial index on `conversations (buyer_id, created_at) where request_id is null`" (decision 11).
- **Section 6, Content:** tick "Info pages say what's true today" for stages H to J, and keep the line for later stages ("update them as stages land").
- **Section 6, Production:** add "Sign-out and account deletion end with a full page load, so a shared computer keeps no hidden signed-in pages" (section 8).
- **Section 6, Launch:** add "Remove the sample accounts' exemption from the message limits with sample mode" (it goes by itself, since `isSampleAccount` needs sample mode; listed so nobody keeps it on purpose).

## 10. Open questions for Lama

1. **The limits' numbers:** 20 new conversations a day and 60 messages an hour. Eduvos may know of busier sellers.
2. **Sign-out and deletion as full page loads** (section 8): build them once the header and tab bar session's work has landed?
3. **Report the kept-redirect behaviour to Next.js?** The spike's reproduction would be the issue's example.
4. **The key on the Vercel preview:** set `VOSSIE_AUTH_HMAC_KEY` there now, so the preview never logs the development key's warning?
5. **The new trust page section's wording**, in particular "never names them to the seller" and the line about who Hub staff are.
