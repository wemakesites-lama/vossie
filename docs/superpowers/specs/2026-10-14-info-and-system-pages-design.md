# Vossie info, legal and system pages: design spec

- **Date:** 2026-10-14
- **Status:** Approved under Lama's standing goal (2026-10-14): "make recommended decisions where needed and continue working in the same manner". Each decision below is Claude's recommendation, logged in the decisions log.
- **Scope:** part C of the "other public pages" stage (decision 48): the info and legal pages, the error page, and the production basics that aren't screens (robots, sitemap, `metadataBase`, security headers). Parts A (shopping) and B (community) have their own specs.

## Related documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-10-08-homepage-design.md` | Tokens, breakpoints, accessibility and budgets |
| `docs/reference/FUNCTION-MAP.md` | The old demo: trust rules (section 6), H (trust and safety), M (privacy) |
| `docs/reference/GO-LIVE.md` | Sections 1 and 6 list these pages and the production work |

---

## 1. Goal

Every page a visitor can reach from the menu, the footer or a listing says something real, the legal pages exist as clearly marked drafts for Eduvos to sign off, a failure shows a branded page, and search engines and link previews get absolute, correct URLs.

## 2. Decisions this spec makes

1. **Legal pages are drafts, and say so.** The privacy policy, terms of use and seller guidelines carry a banner: "Draft for Eduvos to review. Not yet in force." The Information Officer is "to be named by Eduvos", never a made-up person. Lama and Eduvos's legal team own the final wording.
2. **The privacy policy describes this stage truthfully:** no accounts yet; two first-party cookies (`vossie_campus`, `vossie_saved`) and three browser-only stores (recently viewed, recent searches, data saver); nothing is stored on a server. A second section, "When sign-in arrives", lists what accounts will collect and why, so the page doesn't need rewriting from scratch.
3. **One trust page.** "How trust works" (`/trust`) explains Verified, the three badges and how Featured today is picked, in plain words. The homepage's "How trust works" link moves there from `/safety`.
4. **The badge rules are the old demo's (section 6),** minus Top Hustler, which this build doesn't have: New seller is the default; Responsive needs at least 3 enquiries in 90 days and 80% answered within 48 hours; Trusted needs 85%, at least 5 buyer-confirmed sales or swaps and an account at least 30 days old. They're stated as how it will work when accounts arrive.
5. **Info pages share one frame,** `InfoPage`: an h1, a one-line lede, "Last updated {date}", an optional draft banner, then sections with h2s. On desktop a short "On this page" list of section links sits on the left; on phones it sits under the lede. The body is a comfortable reading width (about 65 characters).
6. **The error page is built, then measured.** `app/error.tsx` must be a client component. If it puts any page past the stop line, it's dropped and noted, as the global error page was in the browse and listing stage (decision 46). `app/global-error.tsx` stays Next's default.
7. **`metadataBase` comes from an environment variable,** `NEXT_PUBLIC_SITE_URL`, falling back to `http://localhost:3000`. That fixes the duplicated `og:image` and gives the sitemap absolute URLs. `.env.example` documents it.
8. **Robots:** everything is crawlable except `/saved`, `/login`, `/account` and `/sell`. The sitemap lists the static pages, every listing, seller, collection, request and Hub post.
9. **Security headers, without a Content Security Policy for now:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera, microphone and geolocation off), and `Strict-Transport-Security` in production. A CSP needs per-request nonces for Next's inline scripts, which would make every prerendered page dynamic; it's on the go-live checklist instead.
10. **No offline page yet.** It needs a service worker (client code on every page). It stays on the checklist as "can follow launch".
11. **The footer gains Terms, Seller guidelines and How trust works.** "Seller safety" in the Sell column points to `/seller-guidelines`.

---

## 3. Pages

| Route | Content |
|---|---|
| `/how-it-works` | Buying (find it, message the seller, meet at a pickup point on campus, pay cash or swap: no online payment), selling (apply, the Hub checks you, list, reply within 48 hours), trust in one paragraph with a link to `/trust`, and 6 short questions and answers |
| `/safety` | Meeting safely (approved pickup points, daylight, a friend), checking before paying, never paying in advance or sharing bank details or codes, the signs of a scam, and how to report. Links to `/trust` and the Hub |
| `/trust` | Verified by the Hub, the three badges and their rules (decision 4), what doesn't count (WhatsApp leads, sales the buyer didn't confirm), and how Featured today is picked (verified sellers with something listed, a fair daily draw per campus, a week's break before the same seller again, staff can pin) |
| `/privacy` | Draft (decision 1). Who's responsible, what this site stores today (decision 2), what accounts will collect, why and the lawful basis, how long, who it's shared with (no one is sold anything), where it's hosted (to be decided; section 72 safeguards if outside South Africa), your rights (access, correction, deletion, objection, complaint to the Information Regulator), and how to contact the Hub |
| `/terms` | Draft. Who can use Vossie, that Vossie isn't a party to sales, prohibited items and behaviour, content you post, moderation and suspension, liability in plain terms, and changes to the terms |
| `/seller-guidelines` | Draft. Who can sell, what can't be sold (a short list: weapons, alcohol and tobacco to under-18s, medicines, counterfeit goods, academic dishonesty such as writing assignments), honest listings and photos, prices and swaps, replying within 48 hours, meeting at pickup points, and what happens after a report |

Every page is a prerendered Server Component with metadata (title and description). None adds client code.

## 4. The error page

- `app/error.tsx` (client): the branded frame of the 404 page with the h1 "Something went wrong", "It's not you. Try again, or head back home.", a **Try again** button (calls `reset()`) and a **Go home** link.
- It never shows the error message or stack to the visitor.
- The 404 page (`app/not-found.tsx`) is unchanged.

## 5. Production basics

- `app/robots.ts` and `app/sitemap.ts` (Next's metadata files), using `NEXT_PUBLIC_SITE_URL` (decision 7).
- `metadataBase: new URL(siteUrl())` in the root layout, with `lib/site-url.ts` holding the fallback.
- `headers()` in `next.config.ts` for decision 9, with `Strict-Transport-Security` only when `NODE_ENV` is production.

## 6. Accessibility

The homepage spec's section 10 applies. The "On this page" list is a `<nav aria-label="On this page">`. The draft banner is text, not colour alone. Links in body text are underlined, sky-dark on white.

## 7. Testing

- **Unit:** `InfoPage` (lede, date, banner, contents links matching the sections' ids); each page renders its h1 and sections; `robots` and `sitemap` output; `siteUrl()`; the error page (message, `reset` called, no error text shown).
- **End to end:** each page renders with one h1 and its title; the footer and the trust link reach them; `/robots.txt` and `/sitemap.xml` answer with the expected entries; the response headers are present; `og:image` appears once and is absolute.
- **Checks:** axe on each page, layout shift, the JS budget for one info page and, after the error page, for the homepage, browse and the listing page.

## 8. Not in this part

The final legal wording (Eduvos), the offline page, a Content Security Policy, analytics and monitoring.
