# Launchpad: build plan

Spec: `docs/superpowers/specs/2026-10-26-launchpad-design.md`. Status: built 2026-10-26 (spec section 10 has what changed).

## Before starting

- `git status` (its own call). The tree had Lama's own uncommitted files at planning time (`.claude/launch.json`, `docs/PROGRESS.md`, the brief PDF, two untracked docs). Leave them alone, and stage only this work's files (memory "Shared file edits").
- Testing: speed first (memory "Efficient testing"). Each task names its targeted run. The wider run is Task 6.
- Commits: one at the end, only with Lama's go-ahead (memory "Controller commits").

## Decisions

1. **Keep the `/hub` addresses** unless Lama answers spec 8.1 otherwise. A move to `/launchpad` would be its own task (redirects in `next.config`, `PARENTS`, `TOP_LEVEL`, sitemap, `cls.spec.ts`, every `/hub/` link).
2. **New components replace old ones** rather than reshaping them, so old tests are deleted with their component, not bent:
   - `HubIntro` replaces `HubStory`;
   - `VerifiedShops` replaces `VerifiedSellers`;
   - `HubPostRow` and `HubTipRow` replace `HubPostCard` in the feed.
   - `HubPostCard` stays only if `UpcomingPosts` (a post page's "More from Launchpad") still uses it. It does today, so it stays and only its heading text changes there.
3. **One reader, two lists:** `HubFeed` keeps its single `getHubPosts` call and renders Coming up and Tips. `HUB_FEED_TYPES` drops `tips`, and `readHubFeedType("tips")` returns `"all"`.

## Tasks

### Task 1: The intro

- `components/hub/HubIntro.tsx` (Server Component), with its test: eyebrow, h1 "Launchpad", lede, "Book office hours" to `/hub?type=office-hours#hub-coming-up`, and "Start selling" to `/sell`.
- `app/hub/page.tsx`: render `HubIntro`, drop `getHubBanner()` from this page, and set the new metadata (spec 5).
- CSS: `.hub-intro` panel on `var(--color-pale)`, 16px radius, padding 24px phone / 40px from `wide:`, and the actions row wrapping with a 12px gap. Remove `.hub-story*`.
- Delete `HubStory.tsx` and `HubStory.test.tsx`.
- Run `pnpm test components/hub`.

### Task 2: Coming up and Tips as rows

- `components/hub/HubPostRow.tsx`: date block (`aria-hidden`; day and short month from a SAST helper in `lib/time.ts`, adding `sastDayMonth` with a test if none exists), eyebrow, h3 link covering the row (`FORWARD`, no prefetch, `NavPending` last), the one line with when, where and campus, and going for events.
- `components/hub/HubTipRow.tsx`: h3 link, date and summary.
- `components/hub/HubFeed.tsx`: section "Coming up" (`id="hub-coming-up"`) with the tabs All, Events, Office hours, then section "Tips" (`id="hub-tips"`). Move the sections' h2s into `HubFeed`, so the page's `Reveal` wraps both. The empty and error text are from spec 4.2 and 4.3.
- `lib/hub.ts`: `HUB_FEED_TYPES` without `tips`, and `hubFeedHref` anchors to `#hub-coming-up`. Update `lib/hub` tests.
- `HubFeedSkeleton`: the tabs plus three row outlines, kept no taller than the empty state.
- CSS: `.hub-row`, `.hub-row-date`, `.hub-row-link::after` (whole-row target, focus ring on the row as `hub-card` does), and a rule between rows with `var(--color-line)`. Remove the feed's grid rules, but keep `.hub-card*` while `UpcomingPosts` uses them.
- Tests: rewrite `HubFeed.test.tsx` for the two sections, plus new tests for the row components.
- Run `pnpm test components/hub lib/hub`.

### Task 3: Verified shops

- `components/hub/VerifiedShops.tsx`: h2 "Verified shops", the line, the "How Verified works" link to `/trust`, and rows (40px photo, name link with `CARD`, no prefetch and `NavPending`, then "{category} · {campus}" and the check with "Verified"). Keep the `ul.hub-sellers` class for the data saver rule.
- CSS: one column, two from `@media (min-width: 48rem) and (min-height: 30rem)`, three from `(min-width: 64rem) and (min-height: 30rem)`. Remove the sideways scroll and the tile rules.
- `app/hub/page.tsx`: order intro, `#hub-feed` boundary (Coming up and Tips), Verified shops, credit line (spec 4.5).
- Delete `VerifiedSellers.tsx` and its test, and add `VerifiedShops.test.tsx`.
- Run `pnpm test components/hub`.

### Task 4: The name everywhere spec 3 lists

- `SiteHeader.tsx`, `MenuDrawer.tsx`: "Hub" becomes "Launchpad".
- `SiteFooter.tsx`: the `/hub` link label becomes "Launchpad".
- `lib/nav/trail.ts`: `"/hub": "Launchpad"`.
- `UpcomingPosts.tsx`: "More from Launchpad" (the heading and the `SectionError` title).
- `HubBanner.tsx`: the button text becomes "Visit Launchpad".
- `lib/staff/notices.ts`: `post-published` becomes "Published. It's on Launchpad."
- Update the matching unit tests (`SiteHeader`, `MenuDrawer`, `SiteFooter`, trail, `HubPostView`, notices) and e2e locators (`community.spec.ts`, `home.spec.ts`, `motion.spec.ts`, `info.spec.ts`, `role-views.spec.ts`, `role-views-admin.spec.ts`, `routes.spec.ts`, `staff-writes.spec.ts`: grep each for "Hub" names first, and change only the ones spec 3 moves).
- Check that nothing in the "stays" column changed: `grep -rn "Launchpad" app components lib` should show only the files above.
- Run `pnpm test` (the whole unit suite is fast) and `pnpm typecheck`.

### Task 5: Header fit (spec 8.3)

- Preview at 1024x768 and 1440x900: the quick links stay on one line. Screenshot both for Lama.
- If they wrap, stop and ask Lama (no change on our own).

### Task 6: Checks

- `pnpm lint`, `pnpm typecheck`.
- e2e, device projects, targeted: `community.spec.ts`, `cls.spec.ts`, `a11y.spec.ts`, `routes.spec.ts`, `home.spec.ts`, `motion.spec.ts`, and `performance.spec.ts` at 360, 390 and 1440.
- `pnpm build`, then record `/hub`'s first-visit JS (expect no change) in progress.
- Screenshots of `/hub` at 390 and 1440 for Lama.

### Task 7: Docs

- Decisions log: add decision 93 (Launchpad), pointing at this spec and plan.
- Community pages spec 5.1: one line saying it's replaced by the Launchpad spec.
- `CLAUDE.md`: one bullet under "The name": Launchpad is the page and the Incubation Hub is the team; the `/hub` addresses and `hub-*` names stay internal.
- Spec status: built, plus a "What the build changed" section if anything moved.
- `docs/PROGRESS.md`: this session's entry (Lama's file has uncommitted edits: append with Edit, never Write).
