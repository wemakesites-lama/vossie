# Vossie Homepage, Part 1: Foundation and Site Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Next.js app in `~/Projects/Vossie` with the complete Vossie site shell (announcement bar, crest header, menu, campus picker, search, toasts, bold footer), brand tokens, a sample-data layer and placeholder pages for every link, all tested at phone, tablet and desktop sizes.

**Architecture:**
- **Rendering.** Next.js 16 App Router with Cache Components. The shell is server-rendered and fully static, and client components exist only where there is interaction.
- **Device preferences.** Campus choice (cookie), saved items, recent searches and data saver live in tiny stores read with `useSyncExternalStore`, so nothing in the shell needs a server request.
- **Overlays.** The menu, campus picker, search and iPhone install help are native `<dialog>` elements opened through one small event bus.
- **Header.** The crest-only/reveal behaviour is a pure state machine driving a `data-mode` attribute that plain CSS animates.

**Tech Stack:** Next.js 16.4.0, React 19.3, TypeScript 5.9, Tailwind CSS 4.3 (`@tailwindcss/turbopack`), pnpm 10.30, Vitest 5.0 + Testing Library + jsdom, Playwright 1.64 + axe-core.

**Spec:** `docs/superpowers/specs/2026-10-08-homepage-design.md` (revision 2). **Decisions:** `docs/reference/LANDING-DECISIONS.md`.

---

## How this plan fits

- **Part 1 (this file):**
  - Project setup, tokens and fonts.
  - Data layer and device stores.
  - The whole site shell.
  - Placeholder routes and tests.
  - The homepage body is a placeholder with the hero frame and labelled section slots.
- **Part 2 (written once Part 1 is built):**
  - The 14 homepage sections from spec section 7, on top of this shell.
  - Part 2 is written against the real Part 1 code so its steps can name real files and functions.

## Before you start

**Approvals from Lama (the project owner), given in chat on 2026-10-09:**

1. **Git: approved.** Create the repository in Task 2, Step 9 and commit after every task as the plan says. **Keep `vossie-audit/` out of git**: it's listed in `.gitignore` (Task 2, Step 6) and must never be added. (It duplicates `docs/reference/`, apart from `vossie-blueprint.html`, an outdated design direction.)
2. **Playwright browser download: approved** (Task 4, Step 2, roughly 150 to 250 MB).
3. **Package installs: approved** as part of the build (about 300 to 400 MB in `node_modules/`).
4. **Execution: subagent-driven,** one fresh helper per task with a spec review and a code-quality review after each.
5. **Folder tidy-up: not requested.**
   - `vossie-audit/` and `.superpowers/` (brainstorm session files) stay where they are, untouched.
   - Never delete or move them.

**Global safety rules (from `~/.claude/CLAUDE.md`, highest priority):**
- Check before acting (`ls`, `git status`), as a separate tool call from the action.
- Run git commands one at a time. Never run destructive git commands, never touch `.git/` internals, and only `rm` what Lama named.
- Say what an install will do before running it.
- Never kill an install or build that is still running.

## Facts verified on 2026-10-08 (current docs, npm registry and the `create-next-app@16.4.0` source)

| Area | Fact |
|---|---|
| Scaffold | Passing any flag to `create-next-app` skips its prompts and uses the recommended defaults for anything not passed. Don't pass `--yes`: it pulls in saved preferences from earlier runs on this machine |
| Scaffold folder check | `create-next-app` refuses a folder containing anything other than names like `docs`, `.git` or `.claude`. This project has `vossie-audit/` and `.superpowers/`, so it scaffolds in a scratchpad folder and the files are copied in (Task 1) |
| Tailwind | With Turbopack (the default bundler) the scaffold wires Tailwind through `turbopack.rules` and `@tailwindcss/turbopack`, with no `postcss.config.mjs` |
| Cache Components | On by default (`cacheComponents: true`, `partialPrefetching: true`). Never call `cookies()`, `headers()` or read `searchParams` outside `<Suspense>`. `Date.now()`, `new Date()` and `Math.random()` are not allowed while prerendering |
| Dynamic routes | With Cache Components, `generateStaticParams` must return at least one value, and exporting `dynamicParams` fails the build. With Partial Prefetching the build also renders an "App Shell" with the params unknown, so await `params` inside `<Suspense>` (Task 20) and call `notFound()` for unknown values. Client hooks such as `usePathname()` suspend in that App Shell render too, so the root layout reads them only inside `<Suspense>` (`NavLink`, Task 12) |
| Agent files | `next dev` keeps a managed block in `AGENTS.md` (it never touches `CLAUDE.md`). The installed Next docs live in `node_modules/next/dist/docs/`; read them before using a Next API |
| Lint | `eslint-config-next@16.4.0` turns on `eslint-plugin-react-hooks@7` recommended rules, including the React Compiler rules: no `setState` directly in an effect body, no reading or writing `ref.current` during render, no impure calls during render |
| Images | `priority` is deprecated (use `preload` or `fetchPriority`). `images.qualities` defaults to `[75]` and must list any other quality used |
| `next/form` | `<Form action="/browse">` does client-side navigation for GET forms; calling `event.preventDefault()` in `onSubmit` cancels the navigation |
| Vitest 5 | Needs `vite` installed explicitly (8.x, because `@vitejs/plugin-react@6` needs `vite@^8`). `clearMocks` defaults to `true`. `vi.mock` must be at the top level. Node 22.12+ (26.10 is installed) |
| jest-dom 7 | `@testing-library/dom` is a required peer. Set up with `import "@testing-library/jest-dom/vitest"` |
| jsdom 30 | `<dialog>` has no `showModal()` or `close()`. No `matchMedia`, `ResizeObserver` or `scrollTo`. The test setup (Task 3) provides all of them |
| Fonts | `Special_Gothic_Condensed_One` (weight `"400"` only) and `Geist` (variable) are in Next 16.4's Google font list |

## Conventions for every task

- **Paths and commands.** Paths are relative to `/Users/LamaNkuna/Projects/Vossie`, and commands run from there.
- **Code style.** Match the scaffold: TypeScript, double quotes, semicolons, 2-space indent.
- **Server or client.** Server Components unless a file starts with `"use client"`. Hooks files and plain `lib/` modules have no directive.
- **Breakpoints.**
  - The phone-to-tablet switch is the custom `wide:` variant (defined in Task 5), never `md:`.
  - In CSS it's written `@media (min-width: 48rem) and (min-height: 30rem)`, so landscape phones keep the phone layout (spec section 5).
  - The desktop step is the custom `desk:` variant: 64rem with the same height guard, added in Task 5 after its code review. Use it instead of `lg:`. Tailwind emits its built-in `lg:` rules before custom variants, so a `wide:` value would beat an `lg:` value on desktop.
  - In component CSS, write the desktop step as `@media (min-width: 64rem) and (min-height: 30rem)`. It carries the same height guard as `desk:`, so a wide but very short window never mixes desktop and phone layouts. (Updated 2026-10-09.)
- **Effects.**
  - Never call `setState` directly in an effect body. Use an external store with `useSyncExternalStore`, or set state inside an event or subscription callback.
  - Only read or write `ref.current` in effects and event handlers.
- **Tests.** Unit tests sit next to the code (`*.test.ts` / `*.test.tsx`) and run with `pnpm test`. End-to-end specs live in `tests/e2e/*.spec.ts` and run with `pnpm e2e`.
- **TDD.** Write the test, watch it fail, write the code, watch it pass.
- **Commit steps (git approved by Lama on 2026-10-09).**
  1. Run `git status --short` on its own and check that only the listed files changed.
  2. Run `git add` with the listed files.
  3. Run `git commit` with the given message. Every message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - One git command per tool call.
- **Dev server.** `pnpm dev --port 3100`, or `preview_start` with the `vossie-dev` configuration from Task 2. Before calling a task done, look at it in the browser at 390px and 1280px wide.

## File map (end of Part 1)

```
Vossie/
  AGENTS.md  CLAUDE.md                        agent guidance (scaffold) + project memory (Task 2)
  docs/PROGRESS.md  docs/progress/part-1/     progress log and review screenshots (Tasks 2, 22)
  package.json  pnpm-lock.yaml  pnpm-workspace.yaml  next.config.ts  tsconfig.json
  eslint.config.mjs  next-env.d.ts  .gitignore              scaffold (Task 1), adjusted in Tasks 2-5
  .claude/launch.json                         dev server for the preview pane (Task 2)
  vitest.config.mts  vitest.setup.ts  tests/helpers/dom.ts  unit test setup (Task 3)
  playwright.config.ts                        end-to-end setup, five screen sizes (Task 4)
  tests/e2e/  smoke (4)  brand (5)  boot (18)  routes (20)
              shell  responsive  a11y  performance  screenshots (21)
  app/
    fonts.ts  globals.css  layout.tsx  page.tsx               (Task 5; layout grows in 12-17, final in 18)
    manifest.ts  icon.png  apple-icon.png  favicon.ico        (Task 19)
    not-found.tsx  browse/ sell/ hub/ how-it-works/ safety/ privacy/
    looking-for/ login/ account/ saved/ c/[campus]/ categories/[slug]/   (Task 20)
  assets/brand/crest-white.png                (Task 10)
  components/
    icons.tsx  ComingSoon.tsx                 (Tasks 6, 20)
    brand/Pennant.tsx                         (Task 10)
    ui/ToastRegion.tsx  ui/useOverlayDialog.ts  (Task 9)   ui/NavLink.tsx (Task 12)
    header/header-state.ts  header/header-store.ts  header/useHeaderMode.ts   (Task 11)
    header/SiteHeader.tsx  header/CampusPill.tsx  header/SavedLink.tsx        (Task 12)
    campus/CampusPicker.tsx  campus/useSheetDrag.ts                   (Task 13)
    menu/MenuDrawer.tsx                       (Task 14)
    search/SearchOverlay.tsx                  (Task 15)
    announcement/AnnouncementBar.tsx          (Task 16)
    footer/FitText.tsx  footer/NewsletterForm.tsx  footer/InstallButton.tsx
    footer/ShopYourCampusLink.tsx  footer/SiteFooter.tsx              (Task 17)
    dev/FontSetSwitch.tsx                     (Deferred Task D1, only when Eduvos sends the fonts)
  hooks/
    useCampusChoice.ts  useSavedCount.ts  useLowData.ts  useReducedMotion.ts  useMotionAllowed.ts   (Task 8)
  lib/
    cx.ts (Task 3)  types.ts  data/index.ts (Task 7)
    campus.ts  saved.ts  low-data.ts  boot-script.ts (Task 8)
    overlays.ts  toast.ts (Task 9)  recent-searches.ts (Task 15)  fit-text.ts  install.ts (Task 17)
  data/fixtures/campuses.ts  categories.ts  announcements.ts  trending.ts   (Task 7)
  scripts/make-icons.py                       (Task 19)
```

Each `*.test.ts(x)` sits next to the file it tests.

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create (copied from the scaffold): `package.json`, `pnpm-workspace.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `next-env.d.ts`, `.gitignore`, `AGENTS.md`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/favicon.ico`
- Not copied: the scaffold's `README.md`, `.env.example` and `public/*.svg` demo files

- [ ] **Step 1: Check the project folder**

Run: `ls -la /Users/LamaNkuna/Projects/Vossie`
Expected: only `.superpowers`, `docs` and `vossie-audit` (plus `.DS_Store` if Finder made one). If anything else is there, especially `package.json`, `app/` or `node_modules/`, stop and ask Lama.

- [ ] **Step 2: Check the tools**

Run: `node --version && pnpm --version`
Expected: `v26.10.0` (any v22.12 or later works) and `10.30.1`.

- [ ] **Step 3: Generate the scaffold in your scratchpad, not in the project**

Use your session's scratchpad directory (the system prompt names it) as `SCRATCH`. This downloads `create-next-app@16.4.0` and writes files only inside `SCRATCH/vossie`. It installs nothing (`--skip-install`), creates no git repo (`--disable-git`) and turns off agent feedback (`--no-agent-feedback`). `create-next-app` also remembers these choices as its own defaults for next time, which is harmless.

```bash
pnpm dlx create-next-app@16.4.0 "$SCRATCH/vossie" --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --skip-install --disable-git --cache-components --no-react-compiler --agents-md --no-agent-feedback
```

Expected: it ends with `Success! Created vossie at …/vossie`.

- [ ] **Step 4: Inspect what was generated**

Run: `ls -la "$SCRATCH/vossie" "$SCRATCH/vossie/app" && cat "$SCRATCH/vossie/next.config.ts" "$SCRATCH/vossie/package.json"`

Expected `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

Expected `package.json`:
- `"name": "vossie"`.
- Dependencies `next 16.4.0` and `react` / `react-dom 19.3.0`.
- Dev dependencies `@tailwindcss/turbopack ^4`, `tailwindcss ^4`, `typescript ^5`, `eslint ^9`, `eslint-config-next 16.4.0` and the `@types/*` packages.
- `"packageManager": "pnpm@10.30.1"`.

If either file differs in substance (for example a `postcss.config.mjs` exists, or `cacheComponents` is missing), stop and tell Lama before going on.

- [ ] **Step 5: Copy the scaffold into the project without overwriting anything**

`cp -n` never overwrites. Copy only what the project needs:

```bash
P=/Users/LamaNkuna/Projects/Vossie; S="$SCRATCH/vossie"; mkdir -p "$P/app" "$P/public" && cp -n "$S/package.json" "$S/pnpm-workspace.yaml" "$S/next.config.ts" "$S/tsconfig.json" "$S/eslint.config.mjs" "$S/next-env.d.ts" "$S/.gitignore" "$S/AGENTS.md" "$P/" && cp -n "$S/app/layout.tsx" "$S/app/page.tsx" "$S/app/globals.css" "$S/app/favicon.ico" "$P/app/"
```

Then run: `ls -la /Users/LamaNkuna/Projects/Vossie /Users/LamaNkuna/Projects/Vossie/app`
Expected: the eight root files and four `app/` files above, an empty `public/`, and the original `docs`, `vossie-audit` and `.superpowers` untouched.

- [ ] **Step 6: Install dependencies**

Tell Lama this downloads Next, React, Tailwind, TypeScript and ESLint into `node_modules/` (roughly 300-400 MB). Then run: `pnpm install`
Expected: finishes with no errors. pnpm 10 may list "ignored build scripts"; that's expected, because `pnpm-workspace.yaml` already ignores `sharp` and `unrs-resolver`.

- [ ] **Step 7: Generate route types and run the scaffold once**

Run: `pnpm exec next typegen`
Expected: no errors, and `.next/types/routes.d.ts` exists.

Run `pnpm dev --port 3100` in the background, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/`
Expected: `200`. Stop the dev server once it has answered (it's idle, so stopping it is safe).

- [ ] **Step 8: Commit**

Git doesn't exist until Task 2, so there is nothing to commit here.

---

### Task 2: Project memory, progress log, preview config and housekeeping

**Files:**
- Create: `CLAUDE.md`, `docs/PROGRESS.md`, `.claude/launch.json`
- Modify: `package.json` (scripts), `eslint.config.mjs` (ignores), `.gitignore`

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# Vossie: project notes

@AGENTS.md

Vossie is the student marketplace for every Eduvos campus. Lama Nkuna is the UI/UX designer and developer.

## Source of truth
- Homepage spec: `docs/superpowers/specs/2026-10-08-homepage-design.md`
- Decisions log: `docs/reference/LANDING-DECISIONS.md`
- Build plans: `docs/superpowers/plans/`
- Progress log: `docs/PROGRESS.md` (update at the end of every session)
- Old demo audit and function map: `docs/reference/`
- `vossie-audit/` is a local, untracked copy of the audit, kept out of git at Lama's request. Never add it to git, move it or delete it.

## Stack
- Next.js 16.4 App Router with Cache Components, React 19.3, TypeScript, Tailwind CSS 4.3 (`@tailwindcss/turbopack`)
- pnpm 10 only (never npm or yarn)
- Vitest 5 + Testing Library (unit, next to the code), Playwright + axe (`tests/e2e/`)
- Next.js docs for the installed version are in `node_modules/next/dist/docs/`. Read them before using a Next API.

## Commands
- `pnpm dev --port 3100` (or preview `vossie-dev`)
- `pnpm test` · `pnpm e2e` · `pnpm lint` · `pnpm typecheck` · `pnpm build`

## Brand (Eduvos)
- Navy `#15305D`, sky `#29ABE2`, sky-dark `#1E7BA8`, panel `#F3F3F3`, pale `#E1F0F7`, ink `#373F41`, muted `#5B6577`, idle `#B9C0CC`.
- Sky never carries text, icons or thin borders on white. Navy on sky and sky on navy are fine. Links on white use sky-dark.
- Fonts only through `font-display`, `font-text` and `font-accent` (or `var(--vos-font-*)` in CSS). Never a font name in a component.
- The crest comes only from `assets/brand/` until Eduvos sends the official SVG.
- Icons only from `components/icons.tsx`. No emoji as icons.

## Code rules
- Server Components by default. `"use client"` only where there is interaction.
- Device preferences (campus cookie `vossie_campus`, saved items, recent searches, data saver) go through the stores in `lib/` and `useSyncExternalStore`.
- Never read `cookies()`, `headers()` or `searchParams` outside `<Suspense>`.
- The React Compiler lint rules are on: no `setState` directly in an effect body, no `ref.current` during render.
- Motion: animate only `transform` and `opacity`. Respect `prefers-reduced-motion` and data saver (`html[data-low-data]`).
- Touch targets are at least 44px. No hover-only features.

## Privacy (POPIA)
- Collect the minimum. This stage stores nothing on a server: the campus choice is a cookie, and saved items and recent searches stay in the browser.
- The footer sign-up shows a confirmation only. It sends and stores nothing until there is a real, consented mailing list.
- Photos of people need their consent.

## Time
- SAST (UTC+2, no daylight saving). Store UTC, render in `Africa/Johannesburg`. Never rely on the server's timezone.

## Safety rules (from `~/.claude/CLAUDE.md`, highest priority)
- Verify before acting (`ls`, `git status`), as a separate tool call from the action.
- No `git init`, commits or pushes without Lama's go-ahead. Destructive git commands need confirmation every time. Never touch `.git/` internals. One git command at a time.
- `rm` only what Lama named. Never kill installs or builds mid-flight.
```

- [ ] **Step 2: Write `docs/PROGRESS.md`**

```markdown
# Vossie build progress

## 2026-10-08
- Audited the live demo and mapped its functions (`docs/reference/LIVE-INVENTORY.md`, `docs/reference/FUNCTION-MAP.md`).
- Brainstormed the new homepage with Lama. Decisions are in `docs/reference/LANDING-DECISIONS.md`.
- Wrote the homepage spec, revision 2 (`docs/superpowers/specs/2026-10-08-homepage-design.md`).
- Wrote Part 1 of the build plan (`docs/superpowers/plans/2026-10-08-homepage-part-1-foundation-and-shell.md`).

## Next
- Build Part 1: foundation and site shell.
- Then write and build Part 2: the 14 homepage sections.

## Waiting on
- Eduvos font files and licence confirmation.
- The official crest SVG.
- Photos (after the homepage is built).
```

- [ ] **Step 3: Write `.claude/launch.json`**

Spelling out `PATH` keeps the preview working even if the app starts it with a minimal environment:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "vossie-dev",
      "runtimeExecutable": "/usr/bin/env",
      "runtimeArgs": ["PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin", "pnpm", "dev", "--port", "3100"],
      "port": 3100
    }
  ]
}
```

- [ ] **Step 4: Add the type-check script**

In `package.json`, change `"scripts"` to:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit"
  },
```

- [ ] **Step 5: Keep reference folders and test output out of ESLint**

In `eslint.config.mjs`, replace the `globalIgnores([...])` call with:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference material and tool output:
    "docs/**",
    "vossie-audit/**",
    ".superpowers/**",
    "playwright-report/**",
    "test-results/**",
  ]),
```

- [ ] **Step 6: Extend `.gitignore`**

Append to the end of `.gitignore`:

```gitignore

# test output
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
/.vitest/

# brainstorm companion session files
/.superpowers/

# local copy of the demo audit, kept out of git at Lama's request (the tracked copy is docs/reference/)
/vossie-audit/

# Claude Code's per-machine settings
/.claude/settings.local.json
```

- [ ] **Step 7: Verify**

Run: `pnpm lint`
Expected: exits 0. (The scaffold page may produce warnings; there should be no errors.)

Run: `pnpm typecheck`
Expected: exits 0.

- [ ] **Step 8: Check the preview configuration**

Call `preview_start` with name `vossie-dev`.
Expected: the scaffold page loads at `http://localhost:3100`. Close the tab when done.

- [ ] **Step 9: Create the git repository (approved by Lama on 2026-10-09)**

`vossie-audit/` stays out of git; Step 6 put it in `.gitignore`.

Run these one at a time, checking each result before the next:
1. `git -C /Users/LamaNkuna/Projects/Vossie status`. Expected: "not a git repository". If it says anything else, stop and report.
2. `git -C /Users/LamaNkuna/Projects/Vossie init -b main`
3. `git -C /Users/LamaNkuna/Projects/Vossie status --short --untracked-files=all`. Check the list:
   - Nothing under `node_modules/`, `.next/`, `vossie-audit/` or `.superpowers/` should appear.
   - If any of those appear, stop and report.
4. `git -C /Users/LamaNkuna/Projects/Vossie add AGENTS.md CLAUDE.md .gitignore .claude/launch.json package.json pnpm-lock.yaml pnpm-workspace.yaml next.config.ts tsconfig.json eslint.config.mjs app docs`
5. `git -C /Users/LamaNkuna/Projects/Vossie status --short`. Expected: only the files above, staged, and nothing from `vossie-audit/`.
6. `git -C /Users/LamaNkuna/Projects/Vossie commit -m "chore: scaffold Next.js 16 app with project notes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 3: Unit test setup (Vitest + Testing Library)

**Files:**
- Create: `vitest.config.mts`, `vitest.setup.ts`, `tests/helpers/dom.ts`, `lib/cx.ts`, `lib/cx.test.ts`
- Modify: `package.json` (scripts, dev dependencies)

- [ ] **Step 1: Install the test tools**

Tell Lama this adds Vitest, Vite, jsdom and Testing Library as dev dependencies. It also updates `@types/node` to the Node 24 types, because Vitest 5 expects `^22 || >=24`. Then run:

```bash
pnpm add -D vitest@^5.0.3 vite@^8.3.4 @vitejs/plugin-react@^6.1.2 jsdom@^30.1.2 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.2 @testing-library/jest-dom@^7.0.1 @testing-library/user-event@^14.6.7 @types/node@^24
```

Expected: no peer dependency errors.

- [ ] **Step 2: Write `vitest.config.mts`**

Vite 8 resolves the `@/*` paths from `tsconfig.json` itself (`resolve.tsconfigPaths`), so no paths plugin is needed. (Updated 2026-10-09: the first draft used `vite-tsconfig-paths`, which Vite 8 reports as redundant.)

```ts
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, ".next/**", "tests/e2e/**", "docs/**", "vossie-audit/**"],
  },
});
```

- [ ] **Step 3: Write `tests/helpers/dom.ts`**

```ts
import { vi } from "vitest";

/** A static MediaQueryList for tests (jsdom has no matchMedia). */
export function createMediaQueryList(media: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}

/** Make window.matchMedia answer queries with `isMatch`. Restored after each test by the setup file. */
export function mockMatchMedia(isMatch: (query: string) => boolean) {
  return vi
    .spyOn(window, "matchMedia")
    .mockImplementation((query: string) => createMediaQueryList(query, isMatch(query)));
}

/** Pretend the page is scrolled to `y` and fire a scroll event. */
export function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new Event("scroll"));
}
```

- [ ] **Step 4: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, vi } from "vitest";
import { createMediaQueryList } from "./tests/helpers/dom";

// --- Next.js modules that need the App Router at runtime -------------------

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: {
      src: string | { src: string };
      alt: string;
      width?: number;
      height?: number;
      className?: string;
    }) =>
      createElement("img", {
        src: typeof props.src === "string" ? props.src : props.src.src,
        alt: props.alt,
        width: props.width,
        height: props.height,
        className: props.className,
      }),
  };
});

vi.mock("next/form", async () => {
  const { createElement } = await import("react");
  type FormProps = {
    action: string;
    children?: ReactNode;
    className?: string;
    role?: string;
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  };
  return {
    // Like next/form after hydration: run onSubmit, then stop the browser's own navigation.
    default: ({ action, children, className, role, onSubmit }: FormProps) =>
      createElement(
        "form",
        {
          action,
          className,
          role,
          onSubmit: (event: FormEvent<HTMLFormElement>) => {
            onSubmit?.(event);
            event.preventDefault();
          },
        },
        children,
      ),
  };
});

// --- jsdom gaps ------------------------------------------------------------

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: (query: string) => createMediaQueryList(query, false),
});

if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: vi.fn() });

// jsdom's <dialog> has no behaviour. Give it the parts our overlays use.
Object.defineProperties(HTMLDialogElement.prototype, {
  open: {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute("open");
    },
    set(this: HTMLDialogElement, value: boolean) {
      this.toggleAttribute("open", value);
    },
  },
  show: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  showModal: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  },
});

// --- Reset shared browser state between tests -------------------------------

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  document.cookie = "vossie_campus=; Path=/; Max-Age=0";
  document.documentElement.removeAttribute("data-low-data");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});
```

- [ ] **Step 5: Add the test scripts**

In `package.json` `"scripts"`, add after `"typecheck"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 6: Write the first failing test, `lib/cx.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy class names with single spaces", () => {
    expect(cx("a", false, "b", null, undefined, "", "c")).toBe("a b c");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cx(false, null, undefined)).toBe("");
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `pnpm test lib/cx.test.ts`
Expected: FAIL, because `./cx` can't be resolved.

- [ ] **Step 8: Write `lib/cx.ts`**

```ts
/** Join class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 9: Run it and watch it pass**

Run: `pnpm test lib/cx.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Check types and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 11: Commit**

Files: `package.json pnpm-lock.yaml vitest.config.mts vitest.setup.ts tests/helpers/dom.ts lib/cx.ts lib/cx.test.ts`
Message: `test: add Vitest and Testing Library setup`

---

### Task 4: End-to-end test setup (Playwright + axe)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `package.json` (scripts, dev dependencies)

- [ ] **Step 1: Install Playwright and axe**

Tell Lama this adds `@playwright/test` and `@axe-core/playwright` as dev dependencies. Then run:

```bash
pnpm add -D @playwright/test@^1.64.0 @axe-core/playwright@^4.13.0
```

- [ ] **Step 2: Download Chromium (approved by Lama on 2026-10-09)**

Run: `pnpm exec playwright install chromium` (roughly 150-250 MB, into Playwright's own cache outside the project). Let it finish; never stop it partway.

- [ ] **Step 3: Write `playwright.config.ts`**

These are the five widths from spec section 15. The tests run against a production build on port 3200, so they never collide with the dev server on 3100.

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

// Device setup per project:
// - Phones: mobile emulation, touch and 2x pixels.
// - Tablet: touch only.
// - Laptop and desktop: mouse.
// Every project sends the Desktop Chrome user agent, so user-agent checks (such as the iPhone
// install help) are covered by unit tests rather than here.
const phone = (width: number, height: number) => ({
  ...devices["Desktop Chrome"],
  viewport: { width, height },
  screen: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const desktop = (width: number, height: number) => ({
  ...devices["Desktop Chrome"],
  viewport: { width, height },
});

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "en-ZA",
    timezoneId: "Africa/Johannesburg",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    // Always build and start a fresh server, so tests never run against stale code.
    // E2E_REUSE_SERVER=1 reuses a server you started yourself on port 3200.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 240_000,
  },
  projects: [
    { name: "phone-360", use: phone(360, 780) },
    { name: "phone-390", use: phone(390, 844) },
    { name: "tablet-768", use: { ...desktop(768, 1024), screen: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "laptop-1024", use: desktop(1024, 768) },
    { name: "desktop-1440", use: desktop(1440, 900) },
  ],
});
```

Updated 2026-10-09 from the Task 4 code review:
- **Fresh server every run.** Playwright now builds and starts its own server, and fails loudly if something is already listening on port 3200. Before, it silently reused whatever was answering there.
- **Locale and time zone.** Tests run in South African English with SAST, matching the project's time rule.
- **Screen sizes.** The phones and the tablet report screen sizes that match their viewports.

- [ ] **Step 4: Write `tests/e2e/smoke.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("the homepage responds", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", /en/);
});
```

- [ ] **Step 5: Add the e2e script**

In `package.json` `"scripts"`, add after `"test:watch"`:

```json
    "e2e": "playwright test"
```

- [ ] **Step 6: Run it**

Run: `pnpm e2e`
Expected: the production build runs, then `5 passed` (one per screen size).

- [ ] **Step 7: Commit**

Files: `package.json pnpm-lock.yaml playwright.config.ts tests/e2e/smoke.spec.ts`
Message: `test: add Playwright end-to-end setup at five screen sizes`

---

### Task 5: Brand tokens, interim fonts, base styles and a placeholder homepage

**Files:**
- Create: `app/fonts.ts`, `tests/e2e/brand.spec.ts`
- Replace: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Write the failing end-to-end test, `tests/e2e/brand.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("brand colours, fonts and language are applied", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("on campus");

  const styles = await page.evaluate(() => {
    const hero = document.querySelector("#hero-title")!.closest("section")!;
    const word = document.querySelector("#hero-title span")!;
    return {
      heroBackground: getComputedStyle(hero).backgroundColor,
      wordColour: getComputedStyle(word).color,
      headingFont: getComputedStyle(document.querySelector("#hero-title")!).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily,
      lang: document.documentElement.lang,
    };
  });

  expect(styles.heroBackground).toBe("rgb(21, 48, 93)"); // navy #15305D
  expect(styles.wordColour).toBe("rgb(41, 171, 226)"); // sky #29ABE2
  expect(styles.headingFont).toMatch(/Special Gothic Condensed One/);
  expect(styles.bodyFont).toMatch(/Geist/);
  expect(styles.lang).toBe("en-ZA");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm e2e tests/e2e/brand.spec.ts`
Expected: FAIL. The scaffold page has no `#hero-title`, and its `lang` is `en`.

- [ ] **Step 3: Write `app/fonts.ts`**

```ts
import { Geist, Special_Gothic_Condensed_One } from "next/font/google";

// Interim font set from the approved mockups (spec section 4).
// Components never use these names directly: they use font-display / font-text / font-accent.

export const displayInterim = Special_Gothic_Condensed_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sgc",
});

export const textInterim = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

/** Class names that define the font variables. They go on <html>. */
export const fontVariables = `${displayInterim.variable} ${textInterim.variable}`;
```

- [ ] **Step 4: Replace `app/globals.css`**

```css
@import "tailwindcss";

/* Reference material is not app code: keep it out of Tailwind's class scan. */
@source not "../docs";
@source not "../vossie-audit";
@source not "../.superpowers";

/* "wide" = tablet and up, but only when the screen is also tall enough.
   Landscape phones (e.g. 844 × 390) keep the phone layout (spec section 5).
   Use wide: in class names instead of md:, and the same media query in CSS. */
@custom-variant wide {
  @media (min-width: 48rem) and (min-height: 30rem) {
    @slot;
  }
}

/* ---------------------------------------------------------------------------
   Brand tokens (spec section 4). Each becomes Tailwind utilities,
   e.g. --color-navy gives bg-navy, text-navy, border-navy.
   --------------------------------------------------------------------------- */
@theme {
  --color-*: initial;
  --color-white: #ffffff;
  --color-navy: #15305d;
  --color-sky: #29abe2;
  --color-sky-dark: #1e7ba8;
  --color-panel: #f3f3f3;
  --color-pale: #e1f0f7;
  --color-ink: #373f41; /* the spec's "text" token: long body copy */
  --color-muted: #5b6577;
  --color-line: rgb(21 48 93 / 0.14);
  --color-idle: #b9c0cc;
  --color-danger: #b42318;

  --text-hero: clamp(2.75rem, 2.1rem + 2.8vw, 4rem);
  --text-hero--line-height: 0.96;
  --text-section: clamp(2.125rem, 1.75rem + 1.6vw, 2.875rem);
  --text-section--line-height: 1;
  --text-eyebrow: clamp(0.9375rem, 0.875rem + 0.25vw, 1.125rem);
  --text-eyebrow--line-height: 1.1;
  --text-eyebrow--letter-spacing: 1px;
  --text-list: clamp(1.5rem, 0.95rem + 2.3vw, 2.5rem);
  --text-list--line-height: 1.05;
  --text-body: clamp(0.9375rem, 0.9rem + 0.12vw, 1rem);
  --text-body--line-height: 1.55;
  --text-meta: 0.8125rem;
  --text-meta--line-height: 1.4;

  --radius-panel: 16px;
  --radius-card: 14px;
  --radius-strip: 12px;

  --container-page: 75rem;

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Font families go through switchable variables, so the Eduvos set can replace the interim set. */
@theme inline {
  --font-display: var(--vos-font-display);
  --font-text: var(--vos-font-text);
  --font-accent: var(--vos-font-accent);
}

:root {
  --vos-font-display: var(--font-sgc), "Arial Narrow", sans-serif;
  --vos-font-text: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --vos-font-accent: var(--font-geist), ui-sans-serif, system-ui, sans-serif;

  --dur-fast: 150ms;
  --dur-base: 250ms;
  --dur-slow: 400ms;

  /* Four-point stars from the crest, 13% sky, for navy surfaces only. */
  --stars: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cg fill='%2329ABE2' fill-opacity='0.13'%3E%3Cpath d='M30 18 Q32 28 42 30 Q32 32 30 42 Q28 32 18 30 Q28 28 30 18Z'/%3E%3Cpath d='M120 52 Q121.2 58.8 128 60 Q121.2 61.2 120 68 Q118.8 61.2 112 60 Q118.8 58.8 120 52Z'/%3E%3Cpath d='M80 112 Q82.5 125.5 96 128 Q82.5 130.5 80 144 Q77.5 130.5 64 128 Q77.5 125.5 80 112Z'/%3E%3Cpath d='M152 144 Q153 151 160 152 Q153 153 152 160 Q151 153 144 152 Q151 151 152 144Z'/%3E%3C/g%3E%3C/svg%3E");
}

@layer base {
  html {
    scrollbar-gutter: stable;
    -webkit-text-size-adjust: 100%;
  }

  /* An open modal dialog locks the page behind it. */
  html:has(dialog[open]:modal) {
    overflow: hidden;
  }

  body {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--color-white);
    color: var(--color-ink);
    font-family: var(--vos-font-text);
    font-size: var(--text-body);
    line-height: var(--text-body--line-height);
    -webkit-tap-highlight-color: transparent;
  }

  :focus-visible {
    outline: 2.5px solid var(--focus-ring, var(--color-navy));
    outline-offset: 3px;
  }

  /* The skip link moves focus to <main>; the landmark itself needs no ring. */
  #main:focus {
    outline: none;
  }

  ::selection {
    background: var(--color-sky);
    color: var(--color-navy);
  }

  /* 16px minimum stops iPhones zooming into form fields. */
  input,
  select,
  textarea {
    font-size: max(16px, 1em);
  }
}

@utility surface-navy {
  background-color: var(--color-navy);
  color: var(--color-white);
  --focus-ring: var(--color-sky);
}

@utility texture-stars {
  background-image: var(--stars);
  background-size: 180px 180px;
}

@layer components {
  .skip-link {
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 100;
    translate: 0 -200%;
    padding: 12px 18px;
    border-radius: 999px;
    background: var(--color-navy);
    color: var(--color-white);
    font-weight: 600;
  }

  .skip-link:focus {
    translate: 0 0;
  }

  .eyebrow {
    font-family: var(--vos-font-display);
    font-size: var(--text-eyebrow);
    line-height: 1.1;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--color-sky-dark);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 22px;
    border-radius: 999px;
    font-family: var(--vos-font-text);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    transition: transform var(--dur-fast) var(--ease-out);
  }

  .btn:active {
    transform: scale(0.97);
  }

  .btn-primary {
    background: var(--color-navy);
    color: var(--color-white);
  }

  .btn-sky {
    background: var(--color-sky);
    color: var(--color-navy);
  }

  .btn-outline {
    border: 1.5px solid currentColor;
  }
}

/* ---------------------------------------------------------------------------
   Motion off switches (spec section 8): reduced motion and data saver.
   Unlayered with !important so they beat every component transition.
   --------------------------------------------------------------------------- */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
}

:root[data-low-data] *,
:root[data-low-data] *::before,
:root[data-low-data] *::after {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
```

- [ ] **Step 5: Replace `app/layout.tsx`**

The shell is added in Task 18; for now this is fonts, metadata, the skip link and `<main>`.

```tsx
import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vossie · The Eduvos student marketplace",
    template: "%s · Vossie",
  },
  description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
  applicationName: "Vossie",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15305D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Replace `app/page.tsx` with the placeholder homepage**

This page has the hero frame (so the pennant has something to hang into) and tall labelled slots (so there is room to test scrolling). Part 2 replaces all of it.

```tsx
const COMING_IN_PART_2 = [
  "Shop by category",
  "Collections",
  "Shop by campus",
  "Just listed",
  "How it works",
  "Featured today",
  "Looking For",
  "Free & swaps",
  "Hub and What's on",
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-page px-2.5 pb-16 sm:px-4 wide:px-8">
      <section
        aria-labelledby="hero-title"
        className="surface-navy texture-stars rounded-panel px-5 pb-12 pt-14 wide:px-12 wide:pb-20 wide:pt-24"
      >
        <p className="eyebrow text-sky">The Eduvos student marketplace</p>
        <h1 id="hero-title" className="mt-3 max-w-[14ch] font-display text-hero uppercase">
          Buy &amp; sell <span className="text-sky">textbooks</span> on campus
        </h1>
        <p className="mt-5 max-w-[46ch] text-white/80">
          The site shell is in place. The full homepage arrives in Part 2 of the build.
        </p>
      </section>
      <ol aria-label="Homepage sections arriving in Part 2" className="mt-12 grid gap-4">
        {COMING_IN_PART_2.map((name) => (
          <li
            key={name}
            className="grid min-h-[38vh] place-items-center rounded-panel border-[1.5px] border-dashed border-line text-muted"
          >
            {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 7: Turn on AVIF and WebP for `next/image`**

In `next.config.ts`, add `images` below `partialPrefetching`:

```ts
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
```

**Added during the build (2026-10-09).**

From the Task 5 code review, `globals.css` also gained the following. The exact code is in the commit after `2acc063`.
- **A `desk` variant** (64rem with the height guard), declared after `wide`.
- **Desktop type details** from spec section 4, at 80rem: hero line-height 0.97, body line-height 1.6, button labels 11.5px.
- **Safe-area padding** on `#main` and the skip link, so content clears the iPhone notch in landscape.
- **The navy focus halo** from spec section 10, through a `--focus-halo` variable set by `surface-navy` and the skip link.
- **Motion off-switches** that also cover `::backdrop` and reset `animation-delay`.
- **The brand test** now checks that the fonts really load and that both off-switches collapse transitions.

Commit `2acc063`: after `images`, `next.config.ts` turns off Turbopack's build cache, because a cached build once kept serving stale Tailwind CSS after `globals.css` changed:

```ts
  // Always build from scratch. Once, a cached build kept serving stale Tailwind CSS after
  // globals.css changed, and the end-to-end tests build before every run.
  experimental: {
    turbopackFileSystemCacheForBuild: false,
  },
```

- [ ] **Step 8: Run the tests**

Run: `pnpm e2e tests/e2e/brand.spec.ts tests/e2e/smoke.spec.ts`
Expected: PASS at all five sizes.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 9: Look at it**

Start the dev server (`preview_start` `vossie-dev`) and check the page at 390px and 1280px wide:
- A navy, star-textured hero with a condensed uppercase headline, "textbooks" in sky.
- Dashed placeholder slots below.
- No sideways scrolling.

- [ ] **Step 10: Commit**

Files: `app/fonts.ts app/globals.css app/layout.tsx app/page.tsx next.config.ts tests/e2e/brand.spec.ts`
Message: `feat: add Eduvos brand tokens, interim fonts and placeholder homepage`

---

### Task 6: Icon set

**Files:**
- Create: `components/icons.tsx`, `components/icons.test.tsx`

- [ ] **Step 1: Write the failing test, `components/icons.test.tsx`**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

describe("icons", () => {
  it("exports the shell's icon set", () => {
    expect(Object.keys(icons).sort()).toEqual([
      "ArrowLeftIcon",
      "ArrowUpRightIcon",
      "CheckIcon",
      "ChevronDownIcon",
      "ChevronRightIcon",
      "ClockIcon",
      "CloseIcon",
      "HeartIcon",
      "MapPinIcon",
      "MenuIcon",
      "PauseIcon",
      "PlayIcon",
      "PlusSquareIcon",
      "SearchIcon",
      "ShareIcon",
      "TrendingIcon",
      "UserIcon",
    ]);
  });

  it.each(Object.entries(icons))("%s is a decorative 24px stroke icon", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke-width", "1.8");
  });

  it("passes extra props through", () => {
    const { container } = render(<icons.HeartIcon className="size-5" />);
    expect(container.querySelector("svg")).toHaveClass("size-5");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/icons.test.tsx`
Expected: FAIL, because `./icons` can't be resolved.

- [ ] **Step 3: Write `components/icons.tsx`**

These are original drawings on a 24px grid with a 1.8px stroke (spec section 3).

```tsx
import type { ReactNode, SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.75 20c.9-3.6 3.75-5.5 7.25-5.5s6.35 1.9 7.25 5.5" />
    </Svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19.5 4.9 12.6a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5Z" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5m6-6-6 6 6 6" />
    </Svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </Svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6v12M15 6v12" />
    </Svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l10.5-6.5Z" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function TrendingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 16.5 9.5 10.5l4 4 7-7M15 7.5h5.5V13" />
    </Svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15V3.5m-4 4 4-4 4 4M7 10H5.5v10.5h13V10H17" />
    </Svg>
  );
}

export function PlusSquareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Svg>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/icons.test.tsx`
Expected: PASS (19 tests: the set check, 17 icon checks, and the props check).

- [ ] **Step 5: Commit**

Files: `components/icons.tsx components/icons.test.tsx`
Message: `feat: add inline SVG icon set`

---

### Task 7: Types, sample fixtures and the data layer

**Files:**
- Create: `lib/types.ts`, `data/fixtures/campuses.ts`, `data/fixtures/categories.ts`, `data/fixtures/announcements.ts`, `data/fixtures/trending.ts`, `lib/data/index.ts`, `lib/data/index.test.ts`

The image paths in the fixtures (`/placeholders/...`) point to placeholder art that Part 2 creates. Nothing in Part 1 renders them.

- [ ] **Step 1: Write the failing test, `lib/data/index.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { getAnnouncements, getCampuses, getCategories, getTrendingSearches } from "./index";

describe("sample data layer", () => {
  it("returns the 12 Eduvos campuses with Eduvos Online last", async () => {
    const campuses = await getCampuses();
    expect(campuses.map((c) => c.name)).toEqual([
      "Bedfordview",
      "Bloemfontein",
      "Cape Town Mowbray",
      "Cape Town Tyger Valley",
      "Durban Umhlanga",
      "East London",
      "Mbombela",
      "Midrand",
      "Nelson Mandela Bay",
      "Potchefstroom",
      "Pretoria",
      "Vanderbijlpark",
      "Eduvos Online",
    ]);
    expect(new Set(campuses.map((c) => c.slug)).size).toBe(13);
    for (const campus of campuses) {
      expect(campus.slug).toMatch(/^[a-z0-9-]+$/);
      expect(campus.region.length).toBeGreaterThan(0);
      expect(campus.liveListings).toBeGreaterThan(0);
      expect(campus.image.src).toBe(`/placeholders/campus/${campus.slug}.svg`);
    }
  });

  it("returns the ten confirmed categories in order", async () => {
    const categories = await getCategories();
    expect(categories.map((c) => c.name)).toEqual([
      "Textbooks & notes",
      "Tech",
      "Res & living",
      "Fashion & thrift",
      "Food",
      "Hair & beauty",
      "Tutoring",
      "Services",
      "Tickets & events",
      "Stationery",
    ]);
    expect(new Set(categories.map((c) => c.slug)).size).toBe(10);
  });

  it("returns at most three announcements that link inside the site", async () => {
    const announcements = await getAnnouncements();
    expect(announcements.length).toBeGreaterThan(0);
    expect(announcements.length).toBeLessThanOrEqual(3);
    for (const announcement of announcements) {
      expect(announcement.href.startsWith("/")).toBe(true);
    }
  });

  it("has trending searches for all campuses, keyed only by known campuses", async () => {
    const trending = await getTrendingSearches();
    const slugs = new Set((await getCampuses()).map((c) => c.slug));
    expect(trending.all.length).toBeGreaterThanOrEqual(3);
    for (const key of Object.keys(trending)) {
      expect(key === "all" || slugs.has(key)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test lib/data/index.test.ts`
Expected: FAIL, because `./index` can't be resolved.

- [ ] **Step 3: Write `lib/types.ts`**

```ts
// Shapes follow the future Supabase tables (spec section 13).

export type ImageRef = {
  src: string;
  alt: string;
};

export type Campus = {
  slug: string;
  name: string;
  /** Province, or "Online, anywhere in SA" for Eduvos Online. */
  region: string;
  liveListings: number;
  image: ImageRef;
};

export type Category = {
  slug: string;
  name: string;
  image: ImageRef;
};

export type Announcement = {
  id: string;
  tag: string;
  text: string;
  href: string;
};

/** Trending search terms keyed by campus slug, plus "all" for every campus. */
export type TrendingSearches = Readonly<Record<string, readonly string[]>>;

/** "all" or a campus slug. */
export type CampusChoice = string;
```

- [ ] **Step 4: Write `data/fixtures/campuses.ts`**

```ts
import type { Campus } from "@/lib/types";

const campus = (slug: string, name: string, region: string, liveListings: number): Campus => ({
  slug,
  name,
  region,
  liveListings,
  image: { src: `/placeholders/campus/${slug}.svg`, alt: `${name} campus` },
});

// The 12 Eduvos campuses in alphabetical order, then Eduvos Online. Listing counts are samples.
export const campuses: readonly Campus[] = [
  campus("bedfordview", "Bedfordview", "Gauteng", 132),
  campus("bloemfontein", "Bloemfontein", "Free State", 58),
  campus("cape-town-mowbray", "Cape Town Mowbray", "Western Cape", 96),
  campus("cape-town-tyger-valley", "Cape Town Tyger Valley", "Western Cape", 87),
  campus("durban-umhlanga", "Durban Umhlanga", "KwaZulu-Natal", 74),
  campus("east-london", "East London", "Eastern Cape", 31),
  campus("mbombela", "Mbombela", "Mpumalanga", 22),
  campus("midrand", "Midrand", "Gauteng", 214),
  campus("nelson-mandela-bay", "Nelson Mandela Bay", "Eastern Cape", 45),
  campus("potchefstroom", "Potchefstroom", "North West", 39),
  campus("pretoria", "Pretoria", "Gauteng", 187),
  campus("vanderbijlpark", "Vanderbijlpark", "Gauteng", 51),
  campus("online", "Eduvos Online", "Online, anywhere in SA", 63),
];
```

- [ ] **Step 5: Write `data/fixtures/categories.ts`**

```ts
import type { Category } from "@/lib/types";

const category = (slug: string, name: string): Category => ({
  slug,
  name,
  image: { src: `/placeholders/category/${slug}.svg`, alt: name },
});

// Confirmed by Lama on 2026-10-08; may change later, which is why they live in data.
export const categories: readonly Category[] = [
  category("textbooks-notes", "Textbooks & notes"),
  category("tech", "Tech"),
  category("res-living", "Res & living"),
  category("fashion-thrift", "Fashion & thrift"),
  category("food", "Food"),
  category("hair-beauty", "Hair & beauty"),
  category("tutoring", "Tutoring"),
  category("services", "Services"),
  category("tickets-events", "Tickets & events"),
  category("stationery", "Stationery"),
];
```

- [ ] **Step 6: Write `data/fixtures/announcements.ts`**

```ts
import type { Announcement } from "@/lib/types";

export const announcements: readonly Announcement[] = [
  { id: "live", tag: "New", text: "Live on all 12 Eduvos campuses · Free to list", href: "/sell" },
  { id: "safety", tag: "Safety", text: "Meet at a campus pickup point and never pay before you see it", href: "/safety" },
  { id: "hub", tag: "Hub", text: "Verified Incubation Hub sellers on every campus", href: "/hub" },
];
```

- [ ] **Step 7: Write `data/fixtures/trending.ts`**

```ts
import type { TrendingSearches } from "@/lib/types";

// Generic sample terms; campuses without their own list fall back to "all".
export const trendingSearches: TrendingSearches = {
  all: ["Scientific calculator", "Laptop charger", "Statistics notes", "Knotless braids", "Mini fridge"],
  midrand: ["Accounting 1A notes", "Gaming headset", "Braids", "Desk lamp", "Logo design"],
  pretoria: ["Calculator", "Python tutor", "Kettle", "Thrift jackets", "Lash tech"],
  "cape-town-mowbray": ["Textbooks", "Bicycle", "Laptop stand", "Nails", "Photography"],
};
```

- [ ] **Step 8: Write `lib/data/index.ts`**

```ts
import { announcements } from "@/data/fixtures/announcements";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { trendingSearches } from "@/data/fixtures/trending";
import type { Announcement, Campus, Category, TrendingSearches } from "@/lib/types";

// Sample data for this stage (spec section 13). Switching to Supabase changes only this file:
// keep the signatures, query the tables, and give each function cacheLife() and cacheTag().

export async function getCampuses(): Promise<readonly Campus[]> {
  "use cache";
  return campuses;
}

export async function getCategories(): Promise<readonly Category[]> {
  "use cache";
  return categories;
}

export async function getAnnouncements(): Promise<readonly Announcement[]> {
  "use cache";
  return announcements;
}

export async function getTrendingSearches(): Promise<TrendingSearches> {
  "use cache";
  return trendingSearches;
}
```

- [ ] **Step 9: Run it and watch it pass**

Run: `pnpm test lib/data/index.test.ts`
Expected: PASS (4 tests).

Run: `pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 10: Commit**

Files: `lib/types.ts lib/data data/fixtures`
Message: `feat: add typed sample data layer for campuses, categories, announcements and trending searches`

---

### Task 8: Device preference stores, the boot script and their hooks

These tiny stores hold everything the visitor chooses on their device. Components read them with `useSyncExternalStore`, which gives a safe value during the server render (so the static shell never needs a request) and the real value right after hydration.

**Files:**
- Create: `lib/campus.ts`, `lib/campus.test.ts`, `lib/saved.ts`, `lib/saved.test.ts`, `lib/low-data.ts`, `lib/low-data.test.ts`, `lib/boot-script.ts`, `lib/boot-script.test.ts`
- Create: `hooks/useCampusChoice.ts`, `hooks/useSavedCount.ts`, `hooks/useLowData.ts`, `hooks/useReducedMotion.ts`, `hooks/useMotionAllowed.ts`, `hooks/hooks.test.tsx`

- [ ] **Step 1: Write the failing store tests**

`lib/campus.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  ALL_CAMPUSES,
  CAMPUS_COOKIE,
  campusCookieString,
  campusLabel,
  getCampusCookieValue,
  parseCampusChoice,
  readCampusCookie,
  setCampusChoice,
  subscribeCampus,
} from "./campus";

const campuses = [
  { slug: "midrand", name: "Midrand" },
  { slug: "pretoria", name: "Pretoria" },
];

describe("campus choice", () => {
  it("accepts known slugs and falls back to all campuses", () => {
    expect(parseCampusChoice("midrand", campuses)).toBe("midrand");
    expect(parseCampusChoice("atlantis", campuses)).toBe(ALL_CAMPUSES);
    expect(parseCampusChoice(null, campuses)).toBe(ALL_CAMPUSES);
  });

  it("reads the campus cookie out of a cookie string", () => {
    expect(readCampusCookie(`theme=dark; ${CAMPUS_COOKIE}=pretoria; other=1`)).toBe("pretoria");
    expect(readCampusCookie("theme=dark")).toBeNull();
  });

  it("builds a one-year Lax cookie, adding Secure only on https", () => {
    expect(campusCookieString("midrand", false)).toBe(
      "vossie_campus=midrand; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(campusCookieString("midrand", true)).toMatch(/; Secure$/);
  });

  it("labels the choice for the header and menu", () => {
    expect(campusLabel(null, campuses)).toBe("Campus");
    expect(campusLabel(ALL_CAMPUSES, campuses)).toBe("All campuses");
    expect(campusLabel("pretoria", campuses)).toBe("Pretoria");
  });

  it("saves the choice in the cookie and tells subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCampus(listener);
    setCampusChoice("midrand");
    expect(getCampusCookieValue()).toBe("midrand");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setCampusChoice("pretoria");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

`lib/saved.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getSavedCount, isSaved, readSavedIds, SAVED_KEY, subscribeSaved, toggleSaved } from "./saved";

describe("saved items on this device", () => {
  it("starts empty and survives corrupt storage", () => {
    expect(readSavedIds()).toEqual([]);
    localStorage.setItem(SAVED_KEY, "{not json");
    expect(getSavedCount()).toBe(0);
  });

  it("toggles an id, newest first, and tells subscribers", () => {
    const listener = vi.fn();
    subscribeSaved(listener);
    expect(toggleSaved("a")).toBe(true);
    expect(toggleSaved("b")).toBe(true);
    expect(readSavedIds()).toEqual(["b", "a"]);
    expect(isSaved("a")).toBe(true);
    expect(toggleSaved("a")).toBe(false);
    expect(readSavedIds()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("hears saves made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaved(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: SAVED_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something_else" }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
```

`lib/low-data.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getLowData, LOW_DATA_ATTR, LOW_DATA_KEY, setLowData, subscribeLowData } from "./low-data";

describe("data saver", () => {
  it("is off by default", () => {
    expect(getLowData()).toBe(false);
  });

  it("switches the html attribute, remembers the choice and tells subscribers", () => {
    const listener = vi.fn();
    subscribeLowData(listener);
    setLowData(true);
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
    expect(localStorage.getItem(LOW_DATA_KEY)).toBe("1");
    expect(getLowData()).toBe(true);
    setLowData(false);
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(false);
    expect(localStorage.getItem(LOW_DATA_KEY)).toBe("0");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
```

`lib/boot-script.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_SCRIPT, INSTALL_PROMPT_EVENT } from "./boot-script";
import { LOW_DATA_ATTR, LOW_DATA_KEY } from "./low-data";

type WindowWithPrompt = Window & { __vossieInstallPrompt?: Event | null };

function runBootScript() {
  // Runs the exact string the layout puts in <head>.
  new Function(BOOT_SCRIPT)();
}

function setSaveData(saveData: boolean) {
  Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData } });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "connection");
});

describe("boot script", () => {
  it("turns data saver on when it was saved on", () => {
    localStorage.setItem(LOW_DATA_KEY, "1");
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
  });

  it("follows the browser's Save-Data setting when nothing is saved", () => {
    setSaveData(true);
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(true);
  });

  it("respects a saved 'off' even when Save-Data is on", () => {
    localStorage.setItem(LOW_DATA_KEY, "0");
    setSaveData(true);
    runBootScript();
    expect(document.documentElement.hasAttribute(LOW_DATA_ATTR)).toBe(false);
  });

  it("keeps the browser's install prompt for the footer button", () => {
    runBootScript();
    const announced = vi.fn();
    window.addEventListener(INSTALL_PROMPT_EVENT, announced);
    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    window.dispatchEvent(prompt);
    expect(prompt.defaultPrevented).toBe(true);
    expect((window as WindowWithPrompt).__vossieInstallPrompt).toBe(prompt);
    expect(announced).toHaveBeenCalled();
    window.removeEventListener(INSTALL_PROMPT_EVENT, announced);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/campus.test.ts lib/saved.test.ts lib/low-data.test.ts lib/boot-script.test.ts`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write `lib/campus.ts`**

```ts
import type { Campus, CampusChoice } from "./types";

export const CAMPUS_COOKIE = "vossie_campus";
export const ALL_CAMPUSES = "all";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Turn a raw cookie value into a valid choice. Unknown or missing values mean all campuses. */
export function parseCampusChoice(
  raw: string | null | undefined,
  campuses: readonly Pick<Campus, "slug">[],
): CampusChoice {
  if (!raw) return ALL_CAMPUSES;
  return campuses.some((campus) => campus.slug === raw) ? raw : ALL_CAMPUSES;
}

/** Read the campus cookie out of a `document.cookie`-style string. */
export function readCampusCookie(cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CAMPUS_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** A first-party preference cookie: one year, whole site, Lax, Secure on https. */
export function campusCookieString(choice: CampusChoice, secure: boolean): string {
  const parts = [
    `${CAMPUS_COOKIE}=${encodeURIComponent(choice)}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Label for the header pill and the menu. `null` means "not known yet" (server render). */
export function campusLabel(
  choice: CampusChoice | null,
  campuses: readonly Pick<Campus, "slug" | "name">[],
): string {
  if (choice === null) return "Campus";
  if (choice === ALL_CAMPUSES) return "All campuses";
  return campuses.find((campus) => campus.slug === choice)?.name ?? "All campuses";
}

// --- Client store over the cookie ----------------------------------------

const listeners = new Set<() => void>();

export function subscribeCampus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCampusCookieValue(): string | null {
  return readCampusCookie(document.cookie);
}

export function setCampusChoice(choice: CampusChoice): void {
  document.cookie = campusCookieString(choice, window.location.protocol === "https:");
  listeners.forEach((listener) => listener());
}
```

- [ ] **Step 4: Write `lib/saved.ts`**

```ts
export const SAVED_KEY = "vossie_saved";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Saved listing ids on this device, newest first. Never throws: storage can be blocked. */
export function readSavedIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function getSavedCount(): number {
  return readSavedIds().length;
}

export function isSaved(id: string): boolean {
  return readSavedIds().includes(id);
}

/**
 * Save or unsave a listing. Returns true when it is now saved.
 * Throws when storage is blocked, so the caller can roll back and show "Couldn't update. Try again."
 */
export function toggleSaved(id: string): boolean {
  const ids = readSavedIds();
  const index = ids.indexOf(id);
  if (index === -1) ids.unshift(id);
  else ids.splice(index, 1);
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  emit();
  return index === -1;
}

export function subscribeSaved(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVED_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
```

- [ ] **Step 5: Write `lib/low-data.ts`**

```ts
export const LOW_DATA_KEY = "vossie_low_data";
export const LOW_DATA_ATTR = "data-low-data";

const listeners = new Set<() => void>();

/** The <html> attribute is the source of truth; the boot script sets it before first paint. */
export function getLowData(): boolean {
  return document.documentElement.hasAttribute(LOW_DATA_ATTR);
}

export function setLowData(on: boolean): void {
  document.documentElement.toggleAttribute(LOW_DATA_ATTR, on);
  try {
    localStorage.setItem(LOW_DATA_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeLowData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

- [ ] **Step 6: Write `lib/boot-script.ts`**

```ts
import { LOW_DATA_ATTR, LOW_DATA_KEY } from "./low-data";

export const INSTALL_PROMPT_EVENT = "vossie:installprompt";

/**
 * Inline script for <head>, run before the page paints:
 * - turns data saver on from the saved choice, or from the browser's Save-Data setting when nothing is saved;
 * - keeps the browser's install prompt so the footer's "Add Vossie to your home screen" button can use it.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var v=localStorage.getItem(${JSON.stringify(LOW_DATA_KEY)});var c=navigator.connection;if(v==="1"||(v===null&&c&&c.saveData===true)){d.setAttribute(${JSON.stringify(LOW_DATA_ATTR)},"")}}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__vossieInstallPrompt=e;window.dispatchEvent(new Event(${JSON.stringify(INSTALL_PROMPT_EVENT)}))});window.addEventListener("appinstalled",function(){window.__vossieInstallPrompt=null;window.dispatchEvent(new Event(${JSON.stringify(INSTALL_PROMPT_EVENT)}))})})();`;
```

- [ ] **Step 7: Run the store tests and watch them pass**

Run: `pnpm test lib/campus.test.ts lib/saved.test.ts lib/low-data.test.ts lib/boot-script.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 8: Write the failing hook tests, `hooks/hooks.test.tsx`**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { setLowData } from "@/lib/low-data";
import { SAVED_KEY, toggleSaved } from "@/lib/saved";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { useCampusChoice } from "./useCampusChoice";
import { useLowData } from "./useLowData";
import { isMotionAllowedNow, useMotionAllowed } from "./useMotionAllowed";
import { useReducedMotion } from "./useReducedMotion";
import { useSavedCount } from "./useSavedCount";

const campuses = [{ slug: "midrand" }, { slug: "pretoria" }];

describe("device preference hooks", () => {
  it("useCampusChoice defaults to all campuses and follows the cookie", () => {
    const { result } = renderHook(() => useCampusChoice(campuses));
    expect(result.current).toBe("all");
    act(() => {
      setCampusChoice("pretoria");
    });
    expect(result.current).toBe("pretoria");
  });

  it("useSavedCount counts saves on this device", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));
    const { result } = renderHook(() => useSavedCount());
    expect(result.current).toBe(2);
    act(() => {
      toggleSaved("c");
    });
    expect(result.current).toBe(3);
  });

  it("useLowData follows the data saver switch", () => {
    const { result } = renderHook(() => useLowData());
    expect(result.current).toBe(false);
    act(() => {
      setLowData(true);
    });
    expect(result.current).toBe(true);
  });

  it("useReducedMotion reads the media query", () => {
    mockMatchMedia((query) => query.includes("reduce"));
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("allows motion only without reduced motion and without data saver", () => {
    const { result } = renderHook(() => useMotionAllowed());
    expect(result.current).toBe(true);
    expect(isMotionAllowedNow()).toBe(true);
    act(() => {
      setLowData(true);
    });
    expect(result.current).toBe(false);
    expect(isMotionAllowedNow()).toBe(false);
  });
});
```

- [ ] **Step 9: Run them and watch them fail**

Run: `pnpm test hooks/hooks.test.tsx`
Expected: FAIL, because the hook modules don't exist.

- [ ] **Step 10: Write the hooks**

`hooks/useCampusChoice.ts`:

```ts
import { useSyncExternalStore } from "react";
import { getCampusCookieValue, parseCampusChoice, subscribeCampus } from "@/lib/campus";
import type { Campus, CampusChoice } from "@/lib/types";

const unknownOnServer = () => undefined;

/** The visitor's campus choice, or null while it can't be known (server render and hydration). */
export function useCampusChoice(campuses: readonly Pick<Campus, "slug">[]): CampusChoice | null {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribeCampus,
    getCampusCookieValue,
    unknownOnServer,
  );
  return raw === undefined ? null : parseCampusChoice(raw, campuses);
}
```

`hooks/useSavedCount.ts`:

```ts
import { useSyncExternalStore } from "react";
import { getSavedCount, subscribeSaved } from "@/lib/saved";

const noneOnServer = () => 0;

export function useSavedCount(): number {
  return useSyncExternalStore(subscribeSaved, getSavedCount, noneOnServer);
}
```

`hooks/useLowData.ts`:

```ts
import { useSyncExternalStore } from "react";
import { getLowData, subscribeLowData } from "@/lib/low-data";

const offOnServer = () => false;

export function useLowData(): boolean {
  return useSyncExternalStore(subscribeLowData, getLowData, offOnServer);
}
```

`hooks/useReducedMotion.ts`:

```ts
import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const getSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

// Until the browser answers, assume motion is unwanted, so nothing animates or autoplays early.
const reducedOnServer = () => true;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, reducedOnServer);
}
```

`hooks/useMotionAllowed.ts`:

```ts
import { LOW_DATA_ATTR } from "@/lib/low-data";
import { useLowData } from "./useLowData";
import { REDUCED_MOTION_QUERY, useReducedMotion } from "./useReducedMotion";

/** True when animation and autoplay may run: no reduced-motion preference and data saver off. */
export function useMotionAllowed(): boolean {
  const reduced = useReducedMotion();
  const lowData = useLowData();
  return !reduced && !lowData;
}

/** The same check at one moment, for event handlers. */
export function isMotionAllowedNow(): boolean {
  return (
    !window.matchMedia(REDUCED_MOTION_QUERY).matches &&
    !document.documentElement.hasAttribute(LOW_DATA_ATTR)
  );
}
```

- [ ] **Step 11: Run all unit tests**

Run: `pnpm test`
Expected: PASS, everything green.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 12: Commit**

Files: `lib/campus.ts lib/campus.test.ts lib/saved.ts lib/saved.test.ts lib/low-data.ts lib/low-data.test.ts lib/boot-script.ts lib/boot-script.test.ts hooks`
Message: `feat: add campus, saved, data saver and motion preference stores`

---

### Task 9: Overlay event bus, toasts and the shared dialog hook

**Files:**
- Create: `lib/overlays.ts`, `lib/overlays.test.ts`, `lib/toast.ts`, `lib/toast.test.ts`, `components/ui/ToastRegion.tsx`, `components/ui/ToastRegion.test.tsx`, `components/ui/useOverlayDialog.ts`, `components/ui/useOverlayDialog.test.tsx`
- Modify: `vitest.setup.ts` (harden the reset, reset toasts), `app/globals.css` (toast styles)

- [ ] **Step 1: Write the failing tests**

`lib/overlays.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { onOverlayOpen, openOverlay } from "./overlays";

describe("overlay bus", () => {
  it("passes the trigger to listeners of that overlay only", () => {
    const menu = vi.fn();
    const search = vi.fn();
    const offMenu = onOverlayOpen("menu", menu);
    const offSearch = onOverlayOpen("search", search);
    const trigger = document.createElement("button");
    openOverlay("menu", trigger);
    expect(menu).toHaveBeenCalledWith(trigger);
    expect(search).not.toHaveBeenCalled();
    offMenu();
    openOverlay("menu");
    expect(menu).toHaveBeenCalledTimes(1);
    offSearch();
  });
});
```

`lib/toast.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { dismissToast, getToast, showToast, subscribeToast } from "./toast";

describe("toast store", () => {
  it("shows one toast at a time and only dismisses the matching id", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToast(listener);
    showToast("First");
    const first = getToast();
    showToast("Second");
    expect(getToast()?.message).toBe("Second");
    dismissToast(first!.id);
    expect(getToast()?.message).toBe("Second");
    dismissToast();
    expect(getToast()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});
```

`components/ui/ToastRegion.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { showToast } from "@/lib/toast";
import { ToastRegion } from "./ToastRegion";

describe("ToastRegion", () => {
  it("announces a toast politely and clears it after four seconds", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => {
      showToast("Showing Midrand first");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Showing Midrand first");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("gives a newer toast its own full time", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => {
      showToast("One");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
      showToast("Two");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Two");
  });
});
```

`components/ui/useOverlayDialog.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { openOverlay } from "@/lib/overlays";
import { useOverlayDialog } from "./useOverlayDialog";

function TestDialog({
  onOpen,
}: {
  onOpen?: (trigger: HTMLElement | null, dialog: HTMLDialogElement) => void;
}) {
  const { dialogRef, close, onBackdropClick } = useOverlayDialog("search", onOpen);
  return (
    <dialog ref={dialogRef} aria-label="Test dialog" onClick={onBackdropClick}>
      <p>Content</p>
      <button type="button" onClick={close}>
        Close
      </button>
    </dialog>
  );
}

describe("useOverlayDialog", () => {
  it("opens from the bus, calls onOpen, and gives focus back to the trigger on close", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <>
        <button type="button">Trigger</button>
        <TestDialog onOpen={onOpen} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    act(() => openOverlay("search", trigger));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    expect(dialog).toHaveAttribute("open");
    expect(onOpen).toHaveBeenCalledWith(trigger, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("ignores a second open while already open", () => {
    const onOpen = vi.fn();
    render(<TestDialog onOpen={onOpen} />);
    act(() => openOverlay("search"));
    act(() => openOverlay("search"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on a click inside", () => {
    render(<TestDialog />);
    act(() => openOverlay("search"));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    fireEvent.click(screen.getByText("Content"));
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute("open");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/overlays.test.ts lib/toast.test.ts components/ui`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write `lib/overlays.ts`**

```ts
export type OverlayName = "menu" | "search" | "campus" | "install-help";

type OpenListener = (trigger: HTMLElement | null) => void;

const listeners: Record<OverlayName, Set<OpenListener>> = {
  menu: new Set(),
  search: new Set(),
  campus: new Set(),
  "install-help": new Set(),
};

/** Ask an overlay to open. `trigger` gets focus back when it closes. */
export function openOverlay(name: OverlayName, trigger: HTMLElement | null = null): void {
  listeners[name].forEach((listener) => listener(trigger));
}

export function onOverlayOpen(name: OverlayName, listener: OpenListener): () => void {
  listeners[name].add(listener);
  return () => {
    listeners[name].delete(listener);
  };
}
```

- [ ] **Step 4: Write `lib/toast.ts`**

```ts
export type Toast = { id: number; message: string };

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Show a short confirmation, e.g. "Showing Midrand first". A new toast replaces the current one. */
export function showToast(message: string): void {
  current = { id: nextId++, message };
  emit();
}

/** Dismiss the current toast; with an id, only if that toast is still the one showing. */
export function dismissToast(id?: number): void {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

export function getToast(): Toast | null {
  return current;
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

- [ ] **Step 5: Write `components/ui/ToastRegion.tsx`**

The polite live region is always in the page, so screen readers announce every message. The visible pill is a manual popover, so it shows above any open dialog (the top layer stacks in opening order).

```tsx
"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { dismissToast, getToast, subscribeToast } from "@/lib/toast";

const TOAST_MS = 4000;
const noToastOnServer = () => null;

export function ToastRegion() {
  const toast = useSyncExternalStore(subscribeToast, getToast, noToastOnServer);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popover = popoverRef.current;
    const canPop = popover !== null && typeof popover.showPopover === "function";
    if (!toast) {
      if (canPop && popover.matches(":popover-open")) popover.hidePopover();
      return;
    }
    if (canPop && !popover.matches(":popover-open")) popover.showPopover();
    const timer = window.setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {toast?.message}
      </div>
      <div ref={popoverRef} popover="manual" aria-hidden="true" className="toast-pop">
        {toast && (
          <p key={toast.id} className="toast">
            {toast.message}
          </p>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 6: Write `components/ui/useOverlayDialog.ts`**

```ts
import { useCallback, useEffect, useEffectEvent, useRef, type MouseEvent } from "react";
import { onOverlayOpen, type OverlayName } from "@/lib/overlays";

/**
 * Wires a native <dialog> to the overlay bus: opens it as a modal (so the browser traps focus
 * and Esc closes it), runs `onOpen` once it is open, and gives focus back to the trigger on close.
 * `onOpen` receives the dialog element, so callers never need their own ref to it.
 */
export function useOverlayDialog(
  name: OverlayName,
  onOpen?: (trigger: HTMLElement | null, dialog: HTMLDialogElement) => void,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const handleOpen = useEffectEvent((trigger: HTMLElement | null, dialog: HTMLDialogElement) => {
    onOpen?.(trigger, dialog);
  });

  useEffect(() => {
    return onOverlayOpen(name, (trigger) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      returnFocusRef.current = trigger;
      dialog.showModal();
      handleOpen(trigger, dialog);
    });
  }, [name]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      const trigger = returnFocusRef.current;
      returnFocusRef.current = null;
      if (trigger?.isConnected) trigger.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  /** Close when a click lands on the backdrop rather than the dialog's content. */
  const onBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }, []);

  return { dialogRef, close, onBackdropClick };
}
```

- [ ] **Step 7: Harden the shared test setup and reset toasts between tests**

Updated 2026-10-09 from the Task 3 code review. This step makes four changes:
- **Reset even after a failure.** The reset now runs even if unmounting throws.
- **Toast reset order.** Toasts reset after unmounting, so no component hears it.
- **Act environment.** React's act environment is switched on. Testing Library only does this itself when Vitest globals are on.
- **`<dialog>` patch.**
  - It no longer overrides `open`, which jsdom already reflects correctly.
  - Its methods are writable like a real browser's.
  - A comment records how it differs from a real browser.

**Change 1: imports.** In `vitest.setup.ts`, replace the import block at the top with:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, vi } from "vitest";
import { CAMPUS_COOKIE } from "./lib/campus";
import { LOW_DATA_ATTR } from "./lib/low-data";
import { dismissToast } from "./lib/toast";
import { createMediaQueryList } from "./tests/helpers/dom";
```

**Change 2: the dialog patch and the reset.** Replace everything from the line `// jsdom's <dialog> has no behaviour. Give it the parts our overlays use.` to the end of the file with:

```ts
// jsdom's <dialog> has no behaviour, so give it the parts our overlays use (jsdom already reflects `open`).
// Deliberately simpler than a browser:
// - `close` fires synchronously.
// - Nothing throws InvalidStateError.
// - There's no focus move, inert background, Esc handling, returnValue or :modal.
// The Playwright tests (Task 21) cover real dialog behaviour.
Object.defineProperties(HTMLDialogElement.prototype, {
  show: {
    configurable: true,
    writable: true,
    enumerable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  showModal: {
    configurable: true,
    writable: true,
    enumerable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    writable: true,
    enumerable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  },
});

// --- Reset shared browser state between tests -------------------------------

// Testing Library sets this itself only when Vitest globals are on. With it, React flushes updates inside act().
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  try {
    cleanup();
  } finally {
    // After unmounting, so no component reacts to these resets. Runs even if unmounting threw.
    dismissToast();
    vi.useRealTimers();
    // Undoes vi.spyOn spies made inside tests. A spy made at module level or in beforeAll is undone after the first test.
    vi.restoreAllMocks();
    localStorage.clear();
    document.cookie = `${CAMPUS_COOKIE}=; Path=/; Max-Age=0`;
    document.documentElement.removeAttribute(LOW_DATA_ATTR);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  }
});
```

- [ ] **Step 8: Add the toast styles**

Append to `app/globals.css`:

```css
/* --- Toasts (Task 9) ------------------------------------------------------ */
@layer components {
  .toast-pop {
    position: fixed;
    inset: auto auto max(16px, env(safe-area-inset-bottom)) 50%;
    translate: -50% 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    overflow: visible;
    width: max-content;
    max-width: calc(100vw - 32px);
    pointer-events: none;
  }

  .toast {
    padding: 12px 18px;
    border-radius: 999px;
    background: var(--color-navy);
    color: var(--color-white);
    font-size: 14px;
    font-weight: 600;
    animation: toast-in var(--dur-base) var(--ease-out);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .toast-pop {
      inset: auto auto 24px 24px;
      translate: 0 0;
    }
  }
}

@keyframes toast-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
}
```

- [ ] **Step 9: Run them and watch them pass**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 10: Commit**

Files: `lib/overlays.ts lib/overlays.test.ts lib/toast.ts lib/toast.test.ts components/ui vitest.setup.ts app/globals.css`
Message: `feat: add overlay bus, toast region and shared dialog hook`

---

### Task 10: The crest pennant

**Files:**
- Create: `assets/brand/crest-white.png` (copied), `components/brand/Pennant.tsx`, `components/brand/Pennant.test.tsx`
- Modify: `app/globals.css` (pennant styles)

- [ ] **Step 1: Copy the cleaned crest into the app's assets**

This is the white crest cleaned from Lama's screenshot (362 × 609 px). Replace it when Eduvos sends the official SVG.

```bash
mkdir -p /Users/LamaNkuna/Projects/Vossie/assets/brand && cp -n /Users/LamaNkuna/Projects/Vossie/docs/reference/brand/crest-white-sm.png /Users/LamaNkuna/Projects/Vossie/assets/brand/crest-white.png
```

Run: `ls -la /Users/LamaNkuna/Projects/Vossie/assets/brand`
Expected: `crest-white.png`, about 22 KB.

- [ ] **Step 2: Write the failing test, `components/brand/Pennant.test.tsx`**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pennant } from "./Pennant";

describe("Pennant", () => {
  it("is decorative and draws the crest", () => {
    const { container } = render(<Pennant />);
    const pennant = container.firstElementChild!;
    expect(pennant).toHaveAttribute("aria-hidden", "true");
    expect(pennant).toHaveClass("pennant");
    expect(pennant.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("has a small variant for the footer", () => {
    const { container } = render(<Pennant size="small" />);
    expect(container.firstElementChild).toHaveClass("pennant", "pennant--small");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test components/brand/Pennant.test.tsx`
Expected: FAIL, because `./Pennant` can't be resolved.

- [ ] **Step 4: Write `components/brand/Pennant.tsx`**

```tsx
import Image from "next/image";
import crestWhite from "@/assets/brand/crest-white.png";
import { cx } from "@/lib/cx";

type PennantProps = {
  /** "header" hangs from the header bar; "small" is the footer lockup. */
  size?: "header" | "small";
  className?: string;
};

/**
 * The Eduvos crest in a navy varsity pennant with a white edge (spec section 4).
 * Decorative: the link or button around it carries the accessible name.
 */
export function Pennant({ size = "header", className }: PennantProps) {
  return (
    <span aria-hidden="true" className={cx("pennant", size === "small" && "pennant--small", className)}>
      <span className="pennant-shadow">
        <span className="pennant-shape" />
      </span>
      <span className="pennant-shape pennant-back" />
      <span className="pennant-shape pennant-pen">
        <Image
          src={crestWhite}
          alt=""
          width={36}
          height={60}
          loading={size === "header" ? "eager" : "lazy"}
          className="pennant-crest"
        />
      </span>
    </span>
  );
}
```

- [ ] **Step 5: Add the pennant styles**

Append to `app/globals.css`:

```css
/* --- Pennant (Task 10) ---------------------------------------------------- */
@layer components {
  .pennant {
    --pen-w: 64px;
    --pen-h: 79px;
    --pen-pt: 10px;
    --crest-h: 44px;
    --edge-x: 5px;
    --edge-y: 10px;
    position: relative;
    display: block;
    width: var(--pen-w);
    height: var(--pen-h);
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .pennant {
      --pen-w: 86px;
      --pen-h: 106px;
      --pen-pt: 13px;
      --crest-h: 60px;
      --edge-x: 7px;
      --edge-y: 14px;
    }
  }

  /* After the media query, so the small size wins at every width. */
  .pennant--small {
    --pen-w: 34px;
    --pen-h: 42px;
    --pen-pt: 5px;
    --crest-h: 24px;
    --edge-x: 3px;
    --edge-y: 6px;
  }

  /* Flat top, straight sides, V-shaped base. */
  .pennant-shape {
    position: absolute;
    inset: 0;
    clip-path: polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%);
  }

  /* The white edge: wider and deeper than the navy, so it shows round the sides and the point. */
  .pennant-back {
    inset: 0 calc(var(--edge-x) * -1) calc(var(--edge-y) * -1);
    background: var(--color-white);
  }

  .pennant-pen {
    display: flex;
    justify-content: center;
    padding-top: var(--pen-pt);
    background: var(--color-navy);
  }

  .pennant-crest {
    width: auto;
    height: var(--crest-h);
  }

  /* Soft shadow, shown only while the pennant is pinned on its own (header crest-only mode). */
  .pennant-shadow {
    position: absolute;
    inset: 0 calc(var(--edge-x) * -1) calc(var(--edge-y) * -1);
    filter: drop-shadow(0 6px 12px rgb(21 48 93 / 0.28));
    opacity: 0;
    transition: opacity var(--dur-base) var(--ease-out);
  }

  .pennant-shadow > .pennant-shape {
    background: var(--color-white);
  }
}
```

- [ ] **Step 6: Run it and watch it pass**

Run: `pnpm test components/brand/Pennant.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

Files: `assets/brand/crest-white.png components/brand app/globals.css`
Message: `feat: add the crest pennant`

---

### Task 11: The header state machine

Spec section 6.2 as a pure function, a store that feeds it window scroll positions, and a hook.

**Files:**
- Create: `components/header/header-state.ts`, `components/header/header-state.test.ts`, `components/header/header-store.ts`, `components/header/header-store.test.ts`, `components/header/useHeaderMode.ts`

- [ ] **Step 1: Write the failing state machine test, `components/header/header-state.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  EXPAND_ABOVE,
  headerOnReveal,
  headerOnScroll,
  initialHeaderState,
  REHIDE_AFTER,
  type HeaderState,
} from "./header-state";

function scrollThrough(start: HeaderState, ...positions: number[]): HeaderState {
  return positions.reduce(headerOnScroll, start);
}

describe("header state machine", () => {
  it("stays expanded near the top", () => {
    expect(scrollThrough(initialHeaderState, 0, 60, EXPAND_ABOVE - 1).mode).toBe("expanded");
  });

  it("goes to crest only past 120px", () => {
    expect(scrollThrough(initialHeaderState, 50, EXPAND_ABOVE).mode).toBe("crest");
  });

  it("does not reveal by itself when scrolling up mid-page", () => {
    expect(scrollThrough(initialHeaderState, 900, 600, 300).mode).toBe("crest");
  });

  it("reveals on a tap, and only from crest only", () => {
    const crest = scrollThrough(initialHeaderState, 900);
    expect(headerOnReveal(crest, 900)).toEqual({ mode: "revealed", anchorY: 900 });
    expect(headerOnReveal(initialHeaderState, 0)).toBe(initialHeaderState);
  });

  it("hides again 160px further down from the highest point since the reveal", () => {
    const revealed = headerOnReveal(scrollThrough(initialHeaderState, 900), 900);
    expect(scrollThrough(revealed, 900 + REHIDE_AFTER - 1).mode).toBe("revealed");
    expect(scrollThrough(revealed, 900 + REHIDE_AFTER).mode).toBe("crest");
    // Scrolling up first moves the anchor: 160px down from 700 is 860.
    expect(scrollThrough(revealed, 700, 859).mode).toBe("revealed");
    expect(scrollThrough(revealed, 700, 860).mode).toBe("crest");
  });

  it("always returns to expanded above 120px", () => {
    const revealed = headerOnReveal(scrollThrough(initialHeaderState, 900), 900);
    expect(headerOnScroll(revealed, EXPAND_ABOVE - 1).mode).toBe("expanded");
    expect(scrollThrough(initialHeaderState, 900, 20).mode).toBe("expanded");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/header/header-state.test.ts`
Expected: FAIL, because `./header-state` can't be resolved.

- [ ] **Step 3: Write `components/header/header-state.ts`**

```ts
export type HeaderMode = "expanded" | "crest" | "revealed";

export type HeaderState = {
  mode: HeaderMode;
  /** While revealed: the highest point (smallest scrollY) reached since the reveal. */
  anchorY: number;
};

/** Above this scroll position the full header always shows (spec section 6.2). */
export const EXPAND_ABOVE = 120;

/** Once revealed, scrolling this far down again goes back to crest only. */
export const REHIDE_AFTER = 160;

export const initialHeaderState: HeaderState = { mode: "expanded", anchorY: 0 };

export function headerOnScroll(state: HeaderState, scrollY: number): HeaderState {
  if (scrollY < EXPAND_ABOVE) {
    return state.mode === "expanded" ? state : initialHeaderState;
  }
  if (state.mode === "expanded") return { mode: "crest", anchorY: 0 };
  if (state.mode === "revealed") {
    if (scrollY < state.anchorY) return { mode: "revealed", anchorY: scrollY };
    if (scrollY - state.anchorY >= REHIDE_AFTER) return { mode: "crest", anchorY: 0 };
  }
  return state;
}

export function headerOnReveal(state: HeaderState, scrollY: number): HeaderState {
  return state.mode === "crest" ? { mode: "revealed", anchorY: scrollY } : state;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/header/header-state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing store test, `components/header/header-store.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { setScrollY } from "@/tests/helpers/dom";
import { createHeaderStore } from "./header-store";

describe("header store", () => {
  it("follows window scrolling while subscribed", () => {
    const store = createHeaderStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.getSnapshot()).toBe("expanded");
    setScrollY(400);
    expect(store.getSnapshot()).toBe("crest");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setScrollY(0);
    expect(store.getSnapshot()).toBe("crest");
  });

  it("starts from the current scroll position when it subscribes", () => {
    setScrollY(500);
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    expect(store.getSnapshot()).toBe("crest");
    unsubscribe();
  });

  it("reveals, and a hold stops it hiding again", () => {
    const store = createHeaderStore();
    const unsubscribe = store.subscribe(() => {});
    setScrollY(500);
    store.reveal();
    expect(store.getSnapshot()).toBe("revealed");
    store.setHold(() => true);
    setScrollY(900);
    expect(store.getSnapshot()).toBe("revealed");
    store.setHold(() => false);
    setScrollY(901);
    expect(store.getSnapshot()).toBe("crest");
    unsubscribe();
  });

  it("renders expanded on the server", () => {
    expect(createHeaderStore().getServerSnapshot()).toBe("expanded");
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `pnpm test components/header/header-store.test.ts`
Expected: FAIL, because `./header-store` can't be resolved.

- [ ] **Step 7: Write `components/header/header-store.ts`**

```ts
import {
  headerOnReveal,
  headerOnScroll,
  initialHeaderState,
  type HeaderMode,
  type HeaderState,
} from "./header-state";

/**
 * Feeds window scroll positions into the header state machine, for useSyncExternalStore.
 * `setHold` can veto a hide, so a keyboard user's focus is never pulled out of the header.
 */
export function createHeaderStore() {
  let state: HeaderState = initialHeaderState;
  let hold: () => boolean = () => false;
  const listeners = new Set<() => void>();

  const commit = (next: HeaderState) => {
    const changed = next.mode !== state.mode;
    state = next;
    if (changed) listeners.forEach((listener) => listener());
  };

  const sync = () => {
    const next = headerOnScroll(state, window.scrollY);
    if (next.mode === "crest" && state.mode !== "crest" && hold()) return;
    commit(next);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("scroll", sync, { passive: true });
      sync();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("scroll", sync);
      };
    },
    getSnapshot: (): HeaderMode => state.mode,
    getServerSnapshot: (): HeaderMode => "expanded",
    reveal() {
      commit(headerOnReveal(state, window.scrollY));
    },
    setHold(check: () => boolean) {
      hold = check;
    },
  };
}
```

- [ ] **Step 8: Write `components/header/useHeaderMode.ts`**

```ts
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { createHeaderStore } from "./header-store";

/** True when keyboard focus (a visible focus ring) is inside `root`. */
export function hasKeyboardFocusWithin(root: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!root || !(active instanceof HTMLElement) || !root.contains(active)) return false;
  try {
    return active.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** The header's mode, plus `reveal` for the crest-only pennant. */
export function useHeaderMode(headerRef: RefObject<HTMLElement | null>) {
  const [store] = useState(createHeaderStore);
  const mode = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // Spec 6.2: hiding never moves focus out of a control someone is using.
  useEffect(() => {
    store.setHold(() => hasKeyboardFocusWithin(headerRef.current));
  }, [store, headerRef]);

  return { mode, reveal: store.reveal };
}
```

- [ ] **Step 9: Run them and watch them pass**

Run: `pnpm test components/header`
Expected: PASS (10 tests).

- [ ] **Step 10: Commit**

Files: `components/header/header-state.ts components/header/header-state.test.ts components/header/header-store.ts components/header/header-store.test.ts components/header/useHeaderMode.ts`
Message: `feat: add the header crest-only and reveal state machine`

---

### Task 12: The site header

**Files:**
- Create: `components/ui/NavLink.tsx`, `components/ui/NavLink.test.tsx`, `components/header/SavedLink.tsx`, `components/header/CampusPill.tsx`, `components/header/SiteHeader.tsx`, `components/header/SiteHeader.test.tsx`
- Modify: `app/globals.css` (header styles), `app/layout.tsx` (render the header)

**Why `NavLink` exists.** With Partial Prefetching, `next build` renders an "App Shell" for every dynamic route (`/c/[campus]`, `/categories/[slug]`) with the params unknown. During that render `usePathname()` suspends, and a component in the root layout that reads it without a `<Suspense>` boundary fails the build. `NavLink` keeps that read inside its own boundary.

- [ ] **Step 1: Write the failing test, `components/header/SiteHeader.test.tsx`**

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { onOverlayOpen } from "@/lib/overlays";
import { SAVED_KEY } from "@/lib/saved";
import type { Campus } from "@/lib/types";
import { setScrollY } from "@/tests/helpers/dom";
import { SiteHeader } from "./SiteHeader";

const campus = (slug: string, name: string): Campus => ({
  slug,
  name,
  region: "Gauteng",
  liveListings: 10,
  image: { src: "/placeholder.svg", alt: "" },
});
const campuses = [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")];

function renderHeader() {
  render(<SiteHeader campuses={campuses} />);
  return screen.getByRole("banner");
}

describe("SiteHeader", () => {
  it("starts expanded, with the pennant as the home link", () => {
    const header = renderHeader();
    expect(header).toHaveAttribute("data-mode", "expanded");
    expect(screen.getByRole("link", { name: "Vossie home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
  });

  it("hides everything but the crest past 120px and makes the hidden items inert", () => {
    const header = renderHeader();
    act(() => setScrollY(400));
    expect(header).toHaveAttribute("data-mode", "crest");
    expect(screen.getByRole("button", { name: "Show navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(header.querySelector(".hdr-quick")).toHaveAttribute("inert");
    for (const group of header.querySelectorAll(".hdr-group")) {
      expect(group).toHaveAttribute("inert");
    }
  });

  it("reveals everything on a tap without moving the page, and focuses the first item", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    await user.click(screen.getByRole("button", { name: "Show navigation" }));
    expect(header).toHaveAttribute("data-mode", "revealed");
    expect(screen.getByRole("link", { name: "Vossie home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    expect(window.scrollTo).not.toHaveBeenCalled();
    for (const group of header.querySelectorAll(".hdr-group")) {
      expect(group).not.toHaveAttribute("inert");
    }
  });

  it("hides again after another 160px down, and expands back near the top", async () => {
    const user = userEvent.setup();
    const header = renderHeader();
    act(() => setScrollY(400));
    await user.click(screen.getByRole("button", { name: "Show navigation" }));
    // A mouse user's focus isn't a visible focus ring; blur so the keyboard-focus hold doesn't apply.
    act(() => (document.activeElement as HTMLElement).blur());
    act(() => setScrollY(570));
    expect(header).toHaveAttribute("data-mode", "crest");
    act(() => setScrollY(40));
    expect(header).toHaveAttribute("data-mode", "expanded");
  });

  it("scrolls to the top instead of reloading when the home link is used on the homepage", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("link", { name: "Vossie home" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("opens the menu, search and campus picker through the overlay bus", async () => {
    const user = userEvent.setup();
    renderHeader();
    const menu = vi.fn();
    const search = vi.fn();
    const campusPicker = vi.fn();
    const unsubscribes = [
      onOverlayOpen("menu", menu),
      onOverlayOpen("search", search),
      onOverlayOpen("campus", campusPicker),
    ];
    const menuButton = screen.getByRole("button", { name: "Menu" });
    await user.click(menuButton);
    expect(menu).toHaveBeenCalledWith(menuButton);
    await user.click(screen.getAllByRole("button", { name: "Search" })[0]);
    expect(search).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /^Shopping at/ }));
    await user.click(screen.getByRole("button", { name: "Campuses" }));
    expect(campusPicker).toHaveBeenCalledTimes(2);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  });

  it("shows the chosen campus and the number of saved items on this device", () => {
    setCampusChoice("pretoria");
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));
    renderHeader();
    expect(screen.getByRole("button", { name: "Shopping at Pretoria" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved, 2 items" })).toBeInTheDocument();
  });
});
```

`components/ui/NavLink.test.tsx` (the test setup mocks `usePathname()` to return `"/"`):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavLink } from "./NavLink";

describe("NavLink", () => {
  it("marks the link to the current page", () => {
    render(<NavLink href="/">Home</NavLink>);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves other links unmarked and passes the class through", () => {
    render(
      <NavLink href="/sell" className="menu-link">
        Sell
      </NavLink>,
    );
    const link = screen.getByRole("link", { name: "Sell" });
    expect(link).not.toHaveAttribute("aria-current");
    expect(link).toHaveAttribute("href", "/sell");
    expect(link).toHaveClass("menu-link");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test components/header/SiteHeader.test.tsx components/ui/NavLink.test.tsx`
Expected: FAIL, because `./SiteHeader` and `./NavLink` can't be resolved.

- [ ] **Step 3: Write `components/ui/NavLink.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type NavLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * A link that marks itself aria-current="page" on its own page.
 * usePathname() suspends while Next builds App Shells for routes with unknown params, so the
 * read stays inside this boundary and the plain link is the fallback.
 */
export function NavLink({ href, className, children }: NavLinkProps) {
  return (
    <Suspense
      fallback={
        <Link href={href} className={className}>
          {children}
        </Link>
      }
    >
      <CurrentAwareLink href={href} className={className}>
        {children}
      </CurrentAwareLink>
    </Suspense>
  );
}

function CurrentAwareLink({ href, className, children }: NavLinkProps) {
  const pathname = usePathname();
  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
```

Then write `components/header/SavedLink.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { HeartIcon } from "@/components/icons";
import { useSavedCount } from "@/hooks/useSavedCount";
import { cx } from "@/lib/cx";

export function SavedLink({ className, style }: { className?: string; style?: CSSProperties }) {
  const count = useSavedCount();
  const label = count === 0 ? "Saved" : `Saved, ${count} ${count === 1 ? "item" : "items"}`;
  return (
    <Link href="/saved" aria-label={label} className={cx("hdr-icon-btn relative", className)} style={style}>
      <HeartIcon />
      {count > 0 && (
        <span className="hdr-badge" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Write `components/header/CampusPill.tsx`**

```tsx
"use client";

import type { CSSProperties } from "react";
import { ChevronDownIcon, MapPinIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { campusLabel } from "@/lib/campus";
import { cx } from "@/lib/cx";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";

type CampusPillProps = {
  campuses: readonly Campus[];
  className?: string;
  style?: CSSProperties;
};

/** Shows the current campus and opens the campus picker. Named "Shopping at {campus}". */
export function CampusPill({ campuses, className, style }: CampusPillProps) {
  const choice = useCampusChoice(campuses);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openOverlay("campus", event.currentTarget)}
      className={cx("campus-pill", className)}
      style={style}
    >
      <MapPinIcon className="size-[18px] shrink-0" />
      {/* The space sits outside the hidden span: accessible-name tools trim each element's own text. */}
      <span className="sr-only">Shopping at</span>{" "}
      <span className="truncate">{campusLabel(choice, campuses)}</span>
      <ChevronDownIcon className="size-4 shrink-0" />
    </button>
  );
}
```

- [ ] **Step 5: Write `components/header/SiteHeader.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Pennant } from "@/components/brand/Pennant";
import { MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { isMotionAllowedNow } from "@/hooks/useMotionAllowed";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";
import { CampusPill } from "./CampusPill";
import { SavedLink } from "./SavedLink";
import { useHeaderMode } from "./useHeaderMode";

/** Reveal stagger: each item fades in 40ms after the one before (spec section 6.2). */
const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

export function SiteHeader({ campuses }: { campuses: readonly Campus[] }) {
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { mode, reveal } = useHeaderMode(headerRef);
  const hidden = mode === "crest";

  function showNavigation() {
    flushSync(() => reveal());
    menuButtonRef.current?.focus();
  }

  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/") return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: isMotionAllowedNow() ? "smooth" : "auto" });
  }

  return (
    <header ref={headerRef} data-mode={mode} className="site-header">
      <nav aria-label="Quick links" className="hdr-quick" inert={hidden}>
        <ul>
          <li>
            <NavLink href="/browse">Shop</NavLink>
          </li>
          <li>
            <NavLink href="/sell">Sell</NavLink>
          </li>
          <li>
            <button type="button" aria-haspopup="dialog" onClick={(event) => openOverlay("campus", event.currentTarget)}>
              Campuses
            </button>
          </li>
          <li>
            <NavLink href="/hub">Hub</NavLink>
          </li>
          <li>
            <NavLink href="/how-it-works">How it works</NavLink>
          </li>
          <li>
            <NavLink href="/safety">Safety</NavLink>
          </li>
        </ul>
      </nav>

      <div className="hdr-bar">
        <div className="hdr-bar-bg" aria-hidden="true" />
        <div className="hdr-bar-inner">
          <div className="hdr-group" inert={hidden}>
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("menu", event.currentTarget)}
              className="hdr-item hdr-menu-btn"
              style={stagger(0)}
            >
              <MenuIcon />
              <span className="sr-only wide:not-sr-only">Menu</span>
            </button>
            <button
              type="button"
              aria-label="Search"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("search", event.currentTarget)}
              className="hdr-item hdr-icon-btn wide:hidden"
              style={stagger(1)}
            >
              <SearchIcon />
            </button>
            <CampusPill campuses={campuses} className="hdr-item hidden wide:inline-flex" style={stagger(1)} />
          </div>

          <div className="hdr-pennant-slot">
            {hidden ? (
              <button
                type="button"
                aria-label="Show navigation"
                aria-expanded={false}
                onClick={showNavigation}
                className="hdr-pennant"
              >
                <Pennant />
              </button>
            ) : (
              <Link href="/" aria-label="Vossie home" onClick={goHome} className="hdr-pennant">
                <Pennant />
              </Link>
            )}
          </div>

          <div className="hdr-group hdr-group--end" inert={hidden}>
            <button
              type="button"
              aria-label="Search"
              aria-haspopup="dialog"
              onClick={(event) => openOverlay("search", event.currentTarget)}
              className="hdr-item hdr-icon-btn hidden wide:inline-grid"
              style={stagger(2)}
            >
              <SearchIcon />
            </button>
            <Link href="/account" aria-label="Account" className="hdr-item hdr-icon-btn" style={stagger(3)}>
              <UserIcon />
            </Link>
            <SavedLink className="hdr-item" style={stagger(4)} />
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Run them and watch them pass**

Run: `pnpm test components/header components/ui/NavLink.test.tsx`
Expected: PASS (19 tests).

- [ ] **Step 7: Add the header styles**

Append to `app/globals.css`:

```css
/* --- Site header (Task 12, spec section 6.2) ---------------------------------- */
@layer components {
  .site-header {
    --bar-h: 64px;
    --ql-h: 0px;
    --crest-scale: 0.71; /* about 56px tall when pinned on phones */
    --bar-compact: 0.875; /* revealed bar: 56px of 64px */
    --compact-shift: -4px;
    position: sticky;
    top: 0;
    z-index: 40;
    height: calc(var(--ql-h) + var(--bar-h));
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .site-header {
      --bar-h: 78px;
      --crest-scale: 0.8;
      --bar-compact: 0.82; /* revealed bar: 64px of 78px */
      --compact-shift: -7px;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .site-header {
      --ql-h: 44px;
    }
  }

  /* Crest only: the header box keeps its size (nothing below moves) but lets clicks through. */
  .site-header[data-mode="crest"] {
    pointer-events: none;
  }

  .hdr-quick {
    display: none;
    position: relative;
    z-index: 1;
    height: var(--ql-h);
    background: var(--color-white);
    transition: translate 300ms var(--ease-out), opacity 300ms var(--ease-out), visibility 0s;
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .hdr-quick {
      display: block;
    }
  }

  .hdr-quick ul {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 28px;
    height: 100%;
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .hdr-quick a,
  .hdr-quick button {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    letter-spacing: inherit;
    text-transform: inherit;
  }

  /* sky-dark, not sky: the spec bans thin sky lines on white. */
  .hdr-quick [aria-current="page"] {
    text-decoration: underline 2px var(--color-sky-dark);
    text-underline-offset: 6px;
  }

  .hdr-bar {
    position: relative;
    height: var(--bar-h);
  }

  .hdr-bar-bg {
    position: absolute;
    inset: 0;
    background: var(--color-white);
    box-shadow: 0 1px 0 var(--color-line);
    transform-origin: 50% 0;
    transition: translate 300ms var(--ease-out), scale 300ms var(--ease-out), opacity 300ms var(--ease-out);
  }

  .hdr-bar-inner {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 100%;
    max-width: var(--container-page);
    margin-inline: auto;
    padding-inline: max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-right));
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .hdr-bar-inner {
      padding-inline: 24px;
    }
  }

  .hdr-group {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    transition: translate 300ms var(--ease-out), visibility 0s;
  }

  .hdr-group--end {
    justify-content: flex-end;
  }

  .hdr-item {
    transition:
      opacity 250ms var(--ease-out) calc(var(--i, 0) * 40ms),
      translate 300ms var(--ease-out) calc(var(--i, 0) * 40ms);
  }

  .hdr-icon-btn {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    color: var(--color-navy);
  }

  .hdr-menu-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 44px;
    height: 44px;
    padding: 0 10px;
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .hdr-badge {
    position: absolute;
    top: 5px;
    right: 3px;
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--color-sky);
    color: var(--color-navy);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .campus-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 15rem;
    height: 44px;
    padding: 0 14px;
    border: 1.5px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 600;
  }

  .hdr-pennant-slot {
    position: relative;
    z-index: 2;
    align-self: start;
    pointer-events: auto;
    transform-origin: 50% 0;
    transition: scale 420ms var(--ease-spring), translate 300ms var(--ease-out);
  }

  .hdr-pennant {
    display: block;
    border-radius: 0 0 14px 14px;
  }

  /* Crest only: everything slides up and fades out; the pennant pins to the top at ~80%. */
  .site-header[data-mode="crest"] .hdr-quick,
  .site-header[data-mode="crest"] .hdr-bar-bg {
    translate: 0 -100%;
    opacity: 0;
  }

  .site-header[data-mode="crest"] .hdr-bar-bg {
    transition: translate 250ms var(--ease-out), opacity 250ms var(--ease-out);
  }

  .site-header[data-mode="crest"] .hdr-quick,
  .site-header[data-mode="crest"] .hdr-group {
    visibility: hidden;
    transition: translate 250ms var(--ease-out), opacity 250ms var(--ease-out), visibility 0s linear 250ms;
  }

  .site-header[data-mode="crest"] .hdr-item {
    opacity: 0;
    translate: 0 -10px;
    transition: opacity 250ms var(--ease-out), translate 250ms var(--ease-out);
  }

  .site-header[data-mode="crest"] .hdr-pennant-slot {
    translate: 0 calc(var(--ql-h) * -1);
    scale: var(--crest-scale);
    transition: scale 250ms var(--ease-out), translate 250ms var(--ease-out);
  }

  .site-header[data-mode="crest"] .pennant-shadow {
    opacity: 1;
  }

  /* Revealed mid-page: the bar comes back compact (56px phones, 64px larger screens). */
  .site-header[data-mode="revealed"] .hdr-bar-bg {
    scale: 1 var(--bar-compact);
  }

  .site-header[data-mode="revealed"] .hdr-group {
    translate: 0 var(--compact-shift);
  }
}
```

- [ ] **Step 8: Render the header in the layout**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/header/SiteHeader";
import { getCampuses } from "@/lib/data";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vossie · The Eduvos student marketplace",
    template: "%s · Vossie",
  },
  description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
  applicationName: "Vossie",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15305D",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const campuses = await getCampuses();
  return (
    <html lang="en-ZA" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader campuses={campuses} />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Check the build still prerenders**

Run: `pnpm build`
Expected: the build succeeds with no "blocking route", "uncached data" or prerender errors, and `/` is listed as a static or partially prerendered route.

- [ ] **Step 10: Look at it**

Start the dev server and check each of these at 390px and 1280px:
- **At the top:** the full header shows, and the navy pennant with its white edge hangs into the hero.
- **On desktop:** the quick-link row sits above the bar at 1280px.
- **Scrolling down:** past about 120px the bar and items slide up and fade, and the pennant pins to the top centre, slightly smaller, with a soft shadow.
- **Tapping the pennant:** everything springs back with the items staggering in, and the page doesn't move.
- **Scrolling down again:** about 160px further, it hides again.
- **Back at the top:** it's the full header again.
- **Reduced motion:** turn it on (macOS System Settings › Accessibility › Display › Reduce motion). The changes are now instant.

- [ ] **Step 11: Commit**

Files: `components/header components/ui/NavLink.tsx components/ui/NavLink.test.tsx app/globals.css app/layout.tsx`
Message: `feat: add the site header with crest-only scroll mode and tap to reveal`

---

### Task 13: The campus picker

**Files:**
- Create: `components/campus/useSheetDrag.ts`, `components/campus/CampusPicker.tsx`, `components/campus/CampusPicker.test.tsx`
- Modify: `app/globals.css` (picker styles), `app/layout.tsx` (render the picker and toasts)

- [ ] **Step 1: Write the failing test, `components/campus/CampusPicker.test.tsx`**

```tsx
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { getCampusCookieValue, setCampusChoice } from "@/lib/campus";
import { openOverlay } from "@/lib/overlays";
import type { Campus } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { CampusPicker } from "./CampusPicker";

const campus = (slug: string, name: string, region: string): Campus => ({
  slug,
  name,
  region,
  liveListings: 5,
  image: { src: "/placeholder.svg", alt: "" },
});
const campuses = [
  campus("cape-town-mowbray", "Cape Town Mowbray", "Western Cape"),
  campus("cape-town-tyger-valley", "Cape Town Tyger Valley", "Western Cape"),
  campus("midrand", "Midrand", "Gauteng"),
  campus("online", "Eduvos Online", "Online, anywhere in SA"),
];

function openPicker(trigger: HTMLElement | null = null) {
  act(() => openOverlay("campus", trigger));
  return screen.getByRole("dialog", { name: "Choose your campus" });
}

describe("CampusPicker", () => {
  it("lists All campuses first, then each campus with its region", () => {
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(campuses.length + 1);
    expect(items[0]).toHaveTextContent("All campuses");
    expect(within(dialog).getByRole("button", { name: "Midrand, Gauteng" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Eduvos Online, Online, anywhere in SA" }),
    ).toBeInTheDocument();
  });

  it("filters by name or region, keeps All campuses, and says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    const search = within(dialog).getByRole("searchbox", { name: "Find your campus" });
    await user.type(search, "western");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
    expect(within(dialog).getByRole("status")).toHaveTextContent("No campus matches “zzz”.");
  });

  it("saves the choice, closes and confirms it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </>,
    );
    const dialog = openPicker();
    await user.click(within(dialog).getByRole("button", { name: "Midrand, Gauteng" }));
    expect(getCampusCookieValue()).toBe("midrand");
    expect(dialog).not.toHaveAttribute("open");
    expect(screen.getByRole("status")).toHaveTextContent("Showing Midrand first");
  });

  it("switches back to all campuses", async () => {
    const user = userEvent.setup();
    setCampusChoice("midrand");
    render(
      <>
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </>,
    );
    const dialog = openPicker();
    await user.click(within(dialog).getByRole("button", { name: "All campuses, Shop every campus" }));
    expect(getCampusCookieValue()).toBe("all");
    expect(screen.getByRole("status")).toHaveTextContent("Showing all campuses");
  });

  it("marks the current choice", () => {
    setCampusChoice("midrand");
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    expect(within(dialog).getByRole("button", { name: "Midrand, Gauteng" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      within(dialog).getByRole("button", { name: "All campuses, Shop every campus" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("gives focus back to the button that opened it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Open picker</button>
        <CampusPicker campuses={campuses} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open picker" });
    const dialog = openPicker(trigger);
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
  });

  it("focuses the search box when it opens on a larger screen", () => {
    mockMatchMedia((query) => query === "(min-width: 48rem) and (min-height: 30rem)");
    render(<CampusPicker campuses={campuses} />);
    const dialog = openPicker();
    expect(within(dialog).getByRole("searchbox", { name: "Find your campus" })).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/campus`
Expected: FAIL, because `./CampusPicker` can't be resolved.

- [ ] **Step 3: Write `components/campus/useSheetDrag.ts`**

```ts
import { useRef, type PointerEvent, type RefObject } from "react";

const DISMISS_DISTANCE = 80;

/**
 * Drag a bottom sheet down by its handle; letting go more than 80px down dismisses it.
 * Pointer only: Esc, the Close button and the backdrop cover everyone else.
 */
export function useSheetDrag(sheetRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const startY = useRef<number | null>(null);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const sheet = sheetRef.current;
    if (startY.current === null || !sheet) return;
    sheet.style.transition = "none";
    sheet.style.translate = `0 ${Math.max(0, event.clientY - startY.current)}px`;
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    const sheet = sheetRef.current;
    if (startY.current === null || !sheet) return;
    const distance = event.clientY - startY.current;
    startY.current = null;
    // Clearing the inline styles in the same task as closing lets the sheet glide on from where it was dragged.
    sheet.style.transition = "";
    sheet.style.translate = "";
    if (distance > DISMISS_DISTANCE) onDismiss();
  }

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
```

- [ ] **Step 4: Write `components/campus/CampusPicker.tsx`**

```tsx
"use client";

import { useId, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES, setCampusChoice } from "@/lib/campus";
import { showToast } from "@/lib/toast";
import type { Campus, CampusChoice } from "@/lib/types";
import { useSheetDrag } from "./useSheetDrag";

const DESKTOP_QUERY = "(min-width: 48rem) and (min-height: 30rem)";
const POPOVER_WIDTH = 380;
const EDGE = 16;

/** Campus picker (spec section 6.4): a popover under its trigger on larger screens, a bottom sheet on phones. */
export function CampusPicker({ campuses }: { campuses: readonly Campus[] }) {
  const titleId = useId();
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const choice = useCampusChoice(campuses);

  const { dialogRef, close, onBackdropClick } = useOverlayDialog("campus", (trigger, dialog) => {
    setQuery("");
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const maxHeight = Math.min(560, window.innerHeight * 0.7);
      const top = Math.max(EDGE, Math.min(rect.bottom + 8, window.innerHeight - maxHeight - EDGE));
      const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - EDGE));
      dialog.style.setProperty("--picker-top", `${Math.round(top)}px`);
      dialog.style.setProperty("--picker-left", `${Math.round(left)}px`);
    }
    searchRef.current?.focus();
  });
  const drag = useSheetDrag(dialogRef, close);

  const term = query.trim().toLowerCase();
  const matches = term
    ? campuses.filter((campus) => `${campus.name} ${campus.region}`.toLowerCase().includes(term))
    : campuses;

  function choose(next: CampusChoice) {
    setCampusChoice(next);
    close();
    const name = campuses.find((campus) => campus.slug === next)?.name;
    showToast(name ? `Showing ${name} first` : "Showing all campuses");
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onClick={onBackdropClick} className="sheet-dialog">
      <div className="sheet-inner">
        <div className="sheet-handle" aria-hidden="true" {...drag}>
          <span />
        </div>
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-[1.75rem] uppercase leading-none text-navy">
            Choose your campus
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="hdr-icon-btn -mr-2">
            <CloseIcon />
          </button>
        </div>
        <p className="mt-1 text-meta text-muted">Your campus shows first. You can still shop every campus.</p>
        <label htmlFor={searchId} className="sr-only">
          Find your campus
        </label>
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find your campus"
          autoComplete="off"
          enterKeyHint="search"
          className="picker-search"
        />
        <ul className="picker-list">
          <li>
            <CampusOption
              label="All campuses"
              detail="Shop every campus"
              current={choice === ALL_CAMPUSES}
              onChoose={() => choose(ALL_CAMPUSES)}
            />
          </li>
          {matches.map((campus) => (
            <li key={campus.slug}>
              <CampusOption
                label={campus.name}
                detail={campus.region}
                current={choice === campus.slug}
                onChoose={() => choose(campus.slug)}
              />
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p role="status" className="px-3 py-4 text-muted">
            No campus matches “{query.trim()}”.
          </p>
        )}
      </div>
    </dialog>
  );
}

type CampusOptionProps = {
  label: string;
  detail: string;
  current: boolean;
  onChoose: () => void;
};

function CampusOption({ label, detail, current, onChoose }: CampusOptionProps) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-current={current ? "true" : undefined}
      className="picker-option"
    >
      <span className="flex min-w-0 flex-col items-start">
        <span className="font-semibold text-navy">{label}</span>
        <span className="sr-only">,</span>{" "}
        <span className="text-meta text-muted">{detail}</span>
      </span>
      {current && <CheckIcon className="size-5 shrink-0 text-sky-dark" />}
    </button>
  );
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm test components/campus`
Expected: PASS (7 tests).

- [ ] **Step 6: Add the picker styles**

Append to `app/globals.css`:

```css
/* --- Sheets and the campus picker (Task 13, spec section 6.4) ---------------- */
/* .sheet-*: a bottom sheet on phones, a popover from 768px. Also used by the iPhone install help (Task 17). */
@layer components {
  /* Phones: a bottom sheet. */
  .sheet-dialog {
    position: fixed;
    inset: auto 0 0 0;
    width: 100%;
    max-width: none;
    max-height: 85dvh;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 20px 20px 0 0;
    background: var(--color-white);
    color: var(--color-ink);
    overflow: hidden;
    translate: 0 100%;
    transition-property: translate, opacity, overlay, display;
    transition-duration: var(--dur-slow);
    transition-timing-function: var(--ease-out);
    transition-behavior: allow-discrete;
  }

  .sheet-dialog[open] {
    translate: 0 0;
  }

  @starting-style {
    .sheet-dialog[open] {
      translate: 0 100%;
    }
  }

  .sheet-dialog::backdrop {
    background: rgb(21 48 93 / 0.4);
  }

  .sheet-inner {
    display: flex;
    flex-direction: column;
    max-height: 85dvh;
    padding: 4px 16px max(16px, env(safe-area-inset-bottom));
  }

  .sheet-handle {
    display: grid;
    place-items: center;
    height: 28px;
    touch-action: none;
    cursor: grab;
  }

  .sheet-handle > span {
    width: 40px;
    height: 4px;
    border-radius: 999px;
    background: var(--color-idle);
  }

  .picker-search {
    width: 100%;
    height: 48px;
    margin-top: 12px;
    padding: 0 16px;
    border: 1.5px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink);
  }

  .picker-list {
    margin-top: 8px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .picker-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 6px 12px;
    border-radius: 12px;
    text-align: left;
  }

  .picker-option[aria-current="true"] {
    background: var(--color-pale);
  }

  @media (hover: hover) and (pointer: fine) {
    .picker-option:hover {
      background: var(--color-panel);
    }
  }

  /* Tablet and up: a popover under the button that opened it. */
  @media (min-width: 48rem) and (min-height: 30rem) {
    .sheet-dialog {
      inset: auto;
      top: var(--picker-top, 96px);
      left: var(--picker-left, 24px);
      width: 380px;
      max-height: min(70vh, 560px);
      border: 1.5px solid var(--color-line);
      border-radius: 16px;
      translate: 0 -8px;
      opacity: 0;
      transition-duration: var(--dur-base);
    }

    .sheet-dialog[open] {
      translate: 0 0;
      opacity: 1;
    }

    @starting-style {
      .sheet-dialog[open] {
        translate: 0 -8px;
        opacity: 0;
      }
    }

    .sheet-dialog::backdrop {
      background: transparent;
    }

    .sheet-inner {
      max-height: min(70vh, 560px);
      padding: 16px;
    }

    .sheet-handle {
      display: none;
    }
  }
}
```

- [ ] **Step 7: Render the picker and toasts in the layout**

In `app/layout.tsx`, add these imports below the `SiteHeader` import:

```tsx
import { CampusPicker } from "@/components/campus/CampusPicker";
import { ToastRegion } from "@/components/ui/ToastRegion";
```

and add these two lines straight after the closing `</main>` tag:

```tsx
        <CampusPicker campuses={campuses} />
        <ToastRegion />
```

- [ ] **Step 8: Look at it**

In the dev server, check each of these:
- **1280px:** the header's campus pill opens a popover under it. Typing "cape" filters to the two Cape Town campuses, and choosing Midrand closes it and shows "Showing Midrand first" bottom-left.
- **After choosing:** the pill reads Midrand, and still does after a reload.
- **390px:** in the next task the picker opens from the menu. For now, check the sheet by running `document.querySelector(".sheet-dialog").showModal()` in the console. It should slide up from the bottom, and dragging the handle down more than 80px should close it.

- [ ] **Step 9: Commit**

Files: `components/campus app/globals.css app/layout.tsx`
Message: `feat: add the campus picker as a desktop popover and phone bottom sheet`

---

### Task 14: The menu

**Files:**
- Create: `components/menu/MenuDrawer.tsx`, `components/menu/MenuDrawer.test.tsx`
- Modify: `app/globals.css` (menu styles), `app/layout.tsx` (render the menu)

- [ ] **Step 1: Write the failing test, `components/menu/MenuDrawer.test.tsx`**

```tsx
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { onOverlayOpen, openOverlay } from "@/lib/overlays";
import type { Campus, Category } from "@/lib/types";
import { MenuDrawer } from "./MenuDrawer";

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "pretoria", name: "Pretoria", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];
const categories: Category[] = [
  { slug: "textbooks-notes", name: "Textbooks & notes", image: { src: "/p.svg", alt: "" } },
  { slug: "tech", name: "Tech", image: { src: "/p.svg", alt: "" } },
];

function renderMenu() {
  render(
    <>
      <button type="button">Menu trigger</button>
      <MenuDrawer campuses={campuses} categories={categories} />
    </>,
  );
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: "Menu trigger" });
  act(() => openOverlay("menu", trigger));
  return { trigger, menu: screen.getByRole("dialog", { name: "Menu" }) };
}

describe("MenuDrawer", () => {
  it("shows the main links", () => {
    renderMenu();
    const { menu } = openMenu();
    expect(within(menu).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/browse");
    for (const name of ["Sell", "Hub", "How it works", "Safety", "Account"]) {
      expect(within(menu).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(menu).getByRole("button", { name: "Campuses" })).toBeInTheDocument();
  });

  it("drills into categories and back, moving focus with you", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu } = openMenu();
    await user.click(within(menu).getByRole("button", { name: "Shop by category" }));
    expect(within(menu).getByRole("heading", { name: "Shop by category" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/categories/tech");
    const back = within(menu).getByRole("button", { name: "Back" });
    expect(back).toHaveFocus();
    await user.click(back);
    expect(within(menu).getByRole("button", { name: "Shop by category" })).toHaveFocus();
  });

  it("drills into campuses with a link to each campus", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu } = openMenu();
    await user.click(within(menu).getByRole("button", { name: "Campuses" }));
    expect(within(menu).getByRole("heading", { name: "Campuses" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "All campuses" })).toHaveAttribute("href", "/browse");
    expect(within(menu).getByRole("link", { name: "Midrand, Gauteng" })).toHaveAttribute("href", "/c/midrand");
  });

  it("shows the current campus and opens the campus picker from it", async () => {
    const user = userEvent.setup();
    setCampusChoice("midrand");
    const picker = vi.fn();
    const unsubscribe = onOverlayOpen("campus", picker);
    renderMenu();
    const { menu } = openMenu();
    const campusSwitch = within(menu).getByRole("button", { name: /Shopping at Midrand/ });
    await user.click(campusSwitch);
    expect(picker).toHaveBeenCalledWith(campusSwitch);
    unsubscribe();
  });

  it("switches data saver on", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu } = openMenu();
    const toggle = within(menu).getByRole("switch", { name: "Data saver" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-low-data");
  });

  it("closes with the Close button, returns focus, and reopens on the main view", async () => {
    const user = userEvent.setup();
    renderMenu();
    const { menu, trigger } = openMenu();
    await user.click(within(menu).getByRole("button", { name: "Shop by category" }));
    await user.click(within(menu).getByRole("button", { name: "Close" }));
    expect(menu).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
    act(() => openOverlay("menu", trigger));
    expect(within(menu).getByRole("button", { name: "Shop by category" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/menu`
Expected: FAIL, because `./MenuDrawer` can't be resolved.

- [ ] **Step 3: Write `components/menu/MenuDrawer.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { ArrowLeftIcon, ChevronRightIcon, CloseIcon, MapPinIcon } from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { useLowData } from "@/hooks/useLowData";
import { campusLabel } from "@/lib/campus";
import { setLowData } from "@/lib/low-data";
import { openOverlay } from "@/lib/overlays";
import type { Campus, Category } from "@/lib/types";

type View = "main" | "categories" | "campuses";

type MenuDrawerProps = {
  campuses: readonly Campus[];
  categories: readonly Category[];
};

/** Full-screen navy menu (spec section 6.3) with drill-down views for categories and campuses. */
export function MenuDrawer({ campuses, categories }: MenuDrawerProps) {
  const [view, setView] = useState<View>("main");
  const backRef = useRef<HTMLButtonElement>(null);
  const shopDrillRef = useRef<HTMLButtonElement>(null);
  const campusesDrillRef = useRef<HTMLButtonElement>(null);
  const choice = useCampusChoice(campuses);
  const lowData = useLowData();
  const { dialogRef, close } = useOverlayDialog("menu", () => setView("main"));

  function drillInto(next: Exclude<View, "main">) {
    flushSync(() => setView(next));
    backRef.current?.focus();
  }

  function goBack() {
    const from = view;
    flushSync(() => setView("main"));
    (from === "categories" ? shopDrillRef : campusesDrillRef).current?.focus();
  }

  /** Links navigate in place, so close the menu as soon as one is followed. */
  function closeOnLink(event: MouseEvent<HTMLDialogElement>) {
    if ((event.target as HTMLElement).closest("a")) close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Menu"
      onClick={closeOnLink}
      className="menu-dialog surface-navy texture-stars"
    >
      <div className="menu-inner">
        <div className="menu-top">
          <button type="button" onClick={close} className="menu-close">
            <CloseIcon />
            <span>Close</span>
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => openOverlay("campus", event.currentTarget)}
            className="menu-campus"
          >
            <MapPinIcon className="size-5 shrink-0" />
            <span className="min-w-0 truncate">
              Shopping at <strong>{campusLabel(choice, campuses)}</strong>
            </span>
            <span className="sr-only">.</span>{" "}
            <span className="menu-campus-change">Change</span>
          </button>
        </div>

        {view === "main" && (
          <nav aria-label="Main" className="menu-view">
            <ul className="menu-links">
              <li className="menu-row">
                <NavLink href="/browse">Shop</NavLink>
                <button
                  ref={shopDrillRef}
                  type="button"
                  aria-label="Shop by category"
                  onClick={() => drillInto("categories")}
                  className="menu-drill"
                >
                  <ChevronRightIcon />
                </button>
              </li>
              <li>
                <NavLink href="/sell">Sell</NavLink>
              </li>
              <li>
                <button
                  ref={campusesDrillRef}
                  type="button"
                  onClick={() => drillInto("campuses")}
                  className="menu-link-button"
                >
                  Campuses
                  <ChevronRightIcon className="menu-inline-arrow" />
                </button>
              </li>
              <li>
                <NavLink href="/hub">Hub</NavLink>
              </li>
              <li>
                <NavLink href="/how-it-works">How it works</NavLink>
              </li>
              <li>
                <NavLink href="/safety">Safety</NavLink>
              </li>
              <li>
                <NavLink href="/account">Account</NavLink>
              </li>
            </ul>
          </nav>
        )}

        {view === "categories" && (
          <section aria-labelledby="menu-categories-title" className="menu-view">
            <button ref={backRef} type="button" onClick={goBack} className="menu-back">
              <ArrowLeftIcon />
              Back
            </button>
            <h2 id="menu-categories-title" className="menu-drill-title">
              Shop by category
            </h2>
            <ul className="menu-sublinks">
              <li>
                <Link href="/browse">Everything</Link>
              </li>
              {categories.map((category) => (
                <li key={category.slug}>
                  <NavLink href={`/categories/${category.slug}`}>{category.name}</NavLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === "campuses" && (
          <section aria-labelledby="menu-campuses-title" className="menu-view">
            <button ref={backRef} type="button" onClick={goBack} className="menu-back">
              <ArrowLeftIcon />
              Back
            </button>
            <h2 id="menu-campuses-title" className="menu-drill-title">
              Campuses
            </h2>
            <ul className="menu-sublinks">
              <li>
                <Link href="/browse">All campuses</Link>
              </li>
              {campuses.map((campus) => (
                <li key={campus.slug}>
                  <NavLink href={`/c/${campus.slug}`}>
                    {campus.name}
                    <span className="sr-only">,</span>{" "}
                    <span className="menu-sublink-detail">{campus.region}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="menu-bottom">
          <button
            type="button"
            role="switch"
            aria-checked={lowData}
            onClick={() => setLowData(!lowData)}
            className="menu-switch"
          >
            <span>Data saver</span>
            <span className="menu-switch-track" aria-hidden="true">
              <span className="menu-switch-thumb" />
            </span>
          </button>
          <p className="text-meta text-white/75">Pauses autoplay and animation, and loads lighter photos.</p>
        </div>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/menu`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the menu styles**

Append to `app/globals.css`:

```css
/* --- Menu (Task 14, spec section 6.3) ------------------------------------------ */
@layer components {
  .menu-dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    opacity: 0;
    translate: 0 -16px;
    transition-property: opacity, translate, overlay, display;
    transition-duration: 300ms;
    transition-timing-function: var(--ease-out);
    transition-behavior: allow-discrete;
  }

  .menu-dialog[open] {
    opacity: 1;
    translate: 0 0;
  }

  @starting-style {
    .menu-dialog[open] {
      opacity: 0;
      translate: 0 -16px;
    }
  }

  .menu-dialog::backdrop {
    background: transparent;
  }

  .menu-inner {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    max-width: var(--container-page);
    margin-inline: auto;
    padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
      max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .menu-inner {
      padding: 20px 32px 40px;
    }
  }

  .menu-top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .menu-close,
  .menu-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 12px 0 6px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .menu-campus {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    max-width: 100%;
    padding: 0 16px;
    border: 1.5px solid rgb(255 255 255 / 0.25);
    border-radius: 999px;
    font-size: 14px;
  }

  .menu-campus-change {
    color: var(--color-sky);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .menu-view {
    flex: 1;
    padding-top: 28px;
    animation: menu-view-in var(--dur-base) var(--ease-out);
  }

  .menu-links {
    display: grid;
    gap: 4px;
  }

  .menu-links a,
  .menu-link-button {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    font-family: var(--vos-font-display);
    font-size: clamp(2.5rem, 1.6rem + 4.4vw, 4.5rem);
    line-height: 1;
    text-transform: uppercase;
  }

  .menu-links [aria-current="page"] {
    color: var(--color-sky);
  }

  .menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .menu-drill {
    display: inline-grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border: 1.5px solid rgb(255 255 255 / 0.25);
    border-radius: 999px;
    color: var(--color-sky);
  }

  .menu-inline-arrow {
    width: 0.5em;
    height: 0.5em;
    color: var(--color-sky);
  }

  .menu-drill-title {
    margin-top: 16px;
    font-family: var(--vos-font-display);
    font-size: var(--text-section);
    line-height: 1;
    text-transform: uppercase;
  }

  .menu-sublinks {
    display: grid;
    margin-top: 16px;
    border-top: 1px solid rgb(255 255 255 / 0.15);
  }

  .menu-sublinks a {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    min-height: 52px;
    padding: 12px 4px;
    border-bottom: 1px solid rgb(255 255 255 / 0.15);
    font-size: 18px;
    font-weight: 600;
  }

  .menu-sublinks [aria-current="page"] {
    color: var(--color-sky);
  }

  .menu-sublink-detail {
    color: rgb(255 255 255 / 0.7);
    font-size: 13px;
    font-weight: 400;
  }

  .menu-bottom {
    display: grid;
    gap: 6px;
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid rgb(255 255 255 / 0.15);
  }

  .menu-switch {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 44px;
    max-width: 22rem;
    font-weight: 600;
  }

  .menu-switch-track {
    position: relative;
    width: 46px;
    height: 28px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.25);
  }

  .menu-switch[aria-checked="true"] .menu-switch-track {
    background: var(--color-sky);
  }

  .menu-switch-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--color-white);
    transition: translate var(--dur-fast) var(--ease-out);
  }

  .menu-switch[aria-checked="true"] .menu-switch-thumb {
    translate: 18px 0;
  }
}

@keyframes menu-view-in {
  from {
    opacity: 0;
    translate: 16px 0;
  }
}
```

- [ ] **Step 6: Render the menu in the layout**

In `app/layout.tsx`:
1. Add `import { MenuDrawer } from "@/components/menu/MenuDrawer";` below the `CampusPicker` import.
2. Change the data import to `import { getCampuses, getCategories } from "@/lib/data";`.
3. Replace `const campuses = await getCampuses();` with:

```tsx
  const [campuses, categories] = await Promise.all([getCampuses(), getCategories()]);
```

4. Add this line straight after the closing `</main>` tag, above `<CampusPicker … />`:

```tsx
        <MenuDrawer campuses={campuses} categories={categories} />
```

- [ ] **Step 7: Look at it**

In the dev server, check each of these at 390px and 1280px:
- **Opening:** Menu opens a full-screen navy panel with big condensed links, sliding and fading in over 300ms.
- **Drill-downs:** the arrow next to Shop drills into categories, Back returns, and Campuses lists every campus.
- **Campus switch:** "Shopping at … Change" opens the campus picker on top (a sheet at 390px). Choosing a campus updates the switch and shows the toast above the menu.
- **Data saver:** the switch flips and survives a reload.
- **Closing:** Esc closes the menu and focus returns to the Menu button. Following a link closes it too.

- [ ] **Step 8: Commit**

Files: `components/menu app/globals.css app/layout.tsx`
Message: `feat: add the full-screen menu with category and campus drill-downs and data saver`

---

### Task 15: The search overlay

**Files:**
- Create: `lib/recent-searches.ts`, `lib/recent-searches.test.ts`, `components/search/SearchOverlay.tsx`, `components/search/SearchOverlay.test.tsx`
- Modify: `app/globals.css` (search styles), `app/layout.tsx` (render the overlay)

- [ ] **Step 1: Write the failing tests**

`lib/recent-searches.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addRecentSearch, clearRecentSearches, getRecentSearches, RECENT_KEY } from "./recent-searches";

describe("recent searches on this device", () => {
  it("starts empty and survives corrupt storage", () => {
    expect(getRecentSearches()).toEqual([]);
    localStorage.setItem(RECENT_KEY, "{not json");
    expect(getRecentSearches()).toEqual([]);
  });

  it("tidies terms, ignores blanks and puts the newest first", () => {
    addRecentSearch("  laptop   charger ");
    addRecentSearch("   ");
    addRecentSearch("braids");
    expect(getRecentSearches()).toEqual(["braids", "laptop charger"]);
  });

  it("moves a repeated term to the top, ignoring case, and keeps five", () => {
    for (const term of ["a", "b", "c", "d", "e", "f"]) addRecentSearch(term);
    addRecentSearch("C");
    expect(getRecentSearches()).toEqual(["C", "f", "e", "d", "b"]);
  });

  it("clears", () => {
    addRecentSearch("notes");
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});
```

`components/search/SearchOverlay.test.tsx`:

```tsx
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import { openOverlay } from "@/lib/overlays";
import { addRecentSearch, getRecentSearches } from "@/lib/recent-searches";
import type { Campus, Category, TrendingSearches } from "@/lib/types";
import { SearchOverlay } from "./SearchOverlay";

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "pretoria", name: "Pretoria", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];
const categories: Category[] = [{ slug: "tech", name: "Tech", image: { src: "/p.svg", alt: "" } }];
const trending: TrendingSearches = {
  all: ["Scientific calculator", "Laptop charger", "Statistics notes"],
  midrand: ["Braids", "Desk lamp", "Gaming headset"],
};

function openSearch() {
  render(
    <>
      <button type="button">Search trigger</button>
      <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Search trigger" });
  act(() => openOverlay("search", trigger));
  return screen.getByRole("dialog", { name: "Search Vossie" });
}

describe("SearchOverlay", () => {
  it("opens with the search box focused and shows trending searches for all campuses", () => {
    const dialog = openSearch();
    expect(within(dialog).getByRole("searchbox", { name: "Search Vossie" })).toHaveFocus();
    expect(within(dialog).getByRole("heading", { name: "Trending on Vossie" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Laptop charger" })).toHaveAttribute(
      "href",
      "/browse?q=Laptop%20charger",
    );
  });

  it("shows trending searches for the chosen campus", () => {
    setCampusChoice("midrand");
    const dialog = openSearch();
    expect(within(dialog).getByRole("heading", { name: "Trending at Midrand" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Braids" })).toBeInTheDocument();
  });

  it("falls back to all-campus terms when the campus has none of its own", () => {
    setCampusChoice("pretoria");
    const dialog = openSearch();
    expect(within(dialog).getByRole("heading", { name: "Trending at Pretoria" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Scientific calculator" })).toBeInTheDocument();
  });

  it("remembers a submitted search and closes", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    await user.type(within(dialog).getByRole("searchbox", { name: "Search Vossie" }), "  calculator {enter}");
    expect(getRecentSearches()).toEqual(["calculator"]);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("ignores an empty search", async () => {
    const user = userEvent.setup();
    const dialog = openSearch();
    await user.type(within(dialog).getByRole("searchbox", { name: "Search Vossie" }), "   {enter}");
    expect(getRecentSearches()).toEqual([]);
    expect(dialog).toHaveAttribute("open");
  });

  it("lists recent searches and clears them", async () => {
    const user = userEvent.setup();
    addRecentSearch("Mini fridge");
    const dialog = openSearch();
    expect(within(dialog).getByRole("link", { name: "Mini fridge" })).toHaveAttribute(
      "href",
      "/browse?q=Mini%20fridge",
    );
    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    expect(getRecentSearches()).toEqual([]);
  });

  it("links every category", () => {
    const dialog = openSearch();
    expect(within(dialog).getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/categories/tech");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/recent-searches.test.ts components/search`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write `lib/recent-searches.ts`**

```ts
export const RECENT_KEY = "vossie_recent_searches";
const MAX_RECENT = 5;

/** Recent searches on this device, newest first. Never throws: storage can be blocked. */
export function getRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  const clean = term.trim().replace(/\s+/g, " ");
  if (!clean) return;
  const rest = getRecentSearches().filter((existing) => existing.toLowerCase() !== clean.toLowerCase());
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([clean, ...rest].slice(0, MAX_RECENT)));
  } catch {
    // Storage blocked: recent searches just won't be remembered.
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}
```

- [ ] **Step 4: Write `components/search/SearchOverlay.tsx`**

```tsx
"use client";

import Form from "next/form";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ClockIcon, CloseIcon, SearchIcon, TrendingIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES } from "@/lib/campus";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/recent-searches";
import type { Campus, Category, TrendingSearches } from "@/lib/types";

type SearchOverlayProps = {
  campuses: readonly Campus[];
  categories: readonly Category[];
  trending: TrendingSearches;
};

const browseHref = (term: string) => `/browse?q=${encodeURIComponent(term)}`;

/** Full-screen search (spec section 6.5). Submitting goes to /browse?q=… */
export function SearchOverlay({ campuses, categories, trending }: SearchOverlayProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const choice = useCampusChoice(campuses);
  const { dialogRef, close } = useOverlayDialog("search", () => {
    setRecent(getRecentSearches());
    inputRef.current?.focus();
  });

  const campus = choice && choice !== ALL_CAMPUSES ? campuses.find((c) => c.slug === choice) : undefined;
  const trendingTerms = (campus && trending[campus.slug]) || trending.all || [];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const term = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (!term) {
      event.preventDefault();
      return;
    }
    addRecentSearch(term);
    close();
  }

  /** Following any link closes the overlay; search-term links are remembered too. */
  function onLinkClick(event: MouseEvent<HTMLDialogElement>) {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    if (link.dataset.term) addRecentSearch(link.dataset.term);
    close();
  }

  return (
    <dialog ref={dialogRef} aria-label="Search Vossie" onClick={onLinkClick} className="search-dialog">
      <div className="search-inner">
        <Form action="/browse" onSubmit={onSubmit} role="search" className="search-form">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search Vossie
          </label>
          <SearchIcon className="size-6 shrink-0 text-navy" />
          <input
            ref={inputRef}
            id={`${id}-q`}
            name="q"
            type="search"
            placeholder="Textbooks, tech, braids…"
            autoComplete="off"
            enterKeyHint="search"
            className="search-input"
          />
          <button type="button" onClick={close} aria-label="Close search" className="hdr-icon-btn shrink-0">
            <CloseIcon />
          </button>
        </Form>

        {recent.length > 0 && (
          <section aria-labelledby={`${id}-recent`} className="search-section">
            <div className="flex items-center justify-between gap-4">
              <h2 id={`${id}-recent`} className="search-heading">
                Recent
              </h2>
              <button
                type="button"
                onClick={() => {
                  clearRecentSearches();
                  setRecent([]);
                }}
                className="search-clear"
              >
                Clear
              </button>
            </div>
            <ul className="search-chips">
              {recent.map((term) => (
                <li key={term}>
                  <Link href={browseHref(term)} data-term={term} className="search-chip">
                    <ClockIcon className="size-4" />
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby={`${id}-trending`} className="search-section">
          <h2 id={`${id}-trending`} className="search-heading">
            {campus ? `Trending at ${campus.name}` : "Trending on Vossie"}
          </h2>
          <ul className="search-chips">
            {trendingTerms.map((term) => (
              <li key={term}>
                <Link href={browseHref(term)} data-term={term} className="search-chip">
                  <TrendingIcon className="size-4" />
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={`${id}-categories`} className="search-section">
          <h2 id={`${id}-categories`} className="search-heading">
            Categories
          </h2>
          <ul className="search-categories">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/categories/${category.slug}`} className="search-category">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 5: Run them and watch them pass**

Run: `pnpm test lib/recent-searches.test.ts components/search`
Expected: PASS (11 tests).

- [ ] **Step 6: Add the search styles**

Append to `app/globals.css`:

```css
/* --- Search overlay (Task 15, spec section 6.5) ------------------------------- */
@layer components {
  .search-dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--color-white);
    color: var(--color-ink);
    overflow-y: auto;
    overscroll-behavior: contain;
    opacity: 0;
    transition-property: opacity, overlay, display;
    transition-duration: var(--dur-base);
    transition-timing-function: var(--ease-out);
    transition-behavior: allow-discrete;
  }

  .search-dialog[open] {
    opacity: 1;
  }

  @starting-style {
    .search-dialog[open] {
      opacity: 0;
    }
  }

  .search-dialog::backdrop {
    background: transparent;
  }

  .search-inner {
    max-width: 48rem;
    margin-inline: auto;
    padding: max(12px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom));
  }

  .search-form {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 0 6px 0 16px;
    border: 1.5px solid var(--color-navy);
    border-radius: 999px;
  }

  /* The whole field shows the focus ring, so the input itself doesn't need one. */
  .search-form:focus-within {
    outline: 2.5px solid var(--color-navy);
    outline-offset: 3px;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    height: 56px;
    background: transparent;
    color: var(--color-ink);
    font-size: 18px;
    outline: none;
  }

  .search-section {
    margin-top: 28px;
  }

  .search-heading {
    color: var(--color-sky-dark);
    font-family: var(--vos-font-display);
    font-size: var(--text-eyebrow);
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .search-clear {
    min-height: 44px;
    padding: 0 8px;
    color: var(--color-sky-dark);
    font-size: 14px;
    font-weight: 600;
  }

  .search-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .search-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    background: var(--color-panel);
    color: var(--color-navy);
    font-size: 14px;
    font-weight: 600;
  }

  .search-categories {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .search-category {
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 0 16px;
    border: 1.5px solid var(--color-line);
    border-radius: 14px;
    color: var(--color-navy);
    font-weight: 600;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .search-inner {
      padding: 32px;
    }

    .search-categories {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
```

- [ ] **Step 7: Render the overlay in the layout**

In `app/layout.tsx`:
1. Add `import { SearchOverlay } from "@/components/search/SearchOverlay";` below the `MenuDrawer` import.
2. Change the data import to `import { getCampuses, getCategories, getTrendingSearches } from "@/lib/data";`.
3. Replace the `Promise.all` line with:

```tsx
  const [campuses, categories, trending] = await Promise.all([
    getCampuses(),
    getCategories(),
    getTrendingSearches(),
  ]);
```

4. Add this line below `<MenuDrawer … />`:

```tsx
        <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
```

- [ ] **Step 8: Look at it**

In the dev server, check each of these at 390px and 1280px:
- **Opening:** Search opens a full-screen white panel with the cursor in the box.
- **Submitting:** "calculator" + Enter lands on `/browse?q=calculator` (the placeholder page arrives in Task 20, so a 404 is expected for now).
- **Reopening:** "calculator" now shows under Recent.
- **Campus:** after choosing Midrand in the picker, the heading reads "Trending at Midrand".

- [ ] **Step 9: Commit**

Files: `lib/recent-searches.ts lib/recent-searches.test.ts components/search app/globals.css app/layout.tsx`
Message: `feat: add the search overlay with recent, trending and category shortcuts`

---

### Task 16: The announcement bar

Spec section 6.1. It has one addition: a pause/play button. WCAG 2.2.2 needs a way to stop content that updates by itself, and pausing on hover or focus doesn't help touch users. With reduced motion or data saver it starts paused, and the button can still step it on.

**Files:**
- Create: `components/announcement/AnnouncementBar.tsx`, `components/announcement/AnnouncementBar.test.tsx`
- Modify: `app/globals.css` (announcement styles), `app/layout.tsx` (render the bar)

- [ ] **Step 1: Write the failing test, `components/announcement/AnnouncementBar.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Announcement } from "@/lib/types";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { AnnouncementBar } from "./AnnouncementBar";

const messages: Announcement[] = [
  { id: "a", tag: "New", text: "First message", href: "/sell" },
  { id: "b", tag: "Safety", text: "Second message", href: "/safety" },
  { id: "c", tag: "Hub", text: "Third message", href: "/hub" },
];

const activeText = (container: HTMLElement) =>
  container.querySelector(".announce-item[data-active]")?.textContent;

describe("AnnouncementBar", () => {
  it("moves to the next message every six seconds and loops", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    expect(activeText(container)).toContain("First message");
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
  });

  it("makes the hidden messages inert", () => {
    const { container } = render(<AnnouncementBar messages={messages} />);
    const items = container.querySelectorAll(".announce-item");
    expect(items[0]).not.toHaveAttribute("inert");
    expect(items[1]).toHaveAttribute("inert");
    expect(items[2]).toHaveAttribute("inert");
  });

  it("stops when paused and starts again on play", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause announcements" }));
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    fireEvent.click(screen.getByRole("button", { name: "Play announcements" }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
  });

  it("holds still while the pointer is over it", () => {
    vi.useFakeTimers();
    const { container } = render(<AnnouncementBar messages={messages} />);
    const bar = screen.getByRole("region", { name: "Announcements" });
    fireEvent.mouseEnter(bar);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    fireEvent.mouseLeave(bar);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(activeText(container)).toContain("Second message");
  });

  it("starts paused with reduced motion", () => {
    vi.useFakeTimers();
    mockMatchMedia((query) => query.includes("reduce"));
    const { container } = render(<AnnouncementBar messages={messages} />);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(activeText(container)).toContain("First message");
    expect(screen.getByRole("button", { name: "Play announcements" })).toBeInTheDocument();
  });

  it("shows a single message without a pause button, and nothing without messages", () => {
    const { rerender, container } = render(<AnnouncementBar messages={messages.slice(0, 1)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<AnnouncementBar messages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test components/announcement`
Expected: FAIL, because `./AnnouncementBar` can't be resolved.

- [ ] **Step 3: Write `components/announcement/AnnouncementBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState, type FocusEvent } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import type { Announcement } from "@/lib/types";

const ROTATE_MS = 6000;

type PlayChoice = "auto" | "playing" | "paused";

/** Announcement bar (spec section 6.1): up to three messages, cross-fading every six seconds. */
export function AnnouncementBar({ messages }: { messages: readonly Announcement[] }) {
  const items = messages.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [playChoice, setPlayChoice] = useState<PlayChoice>("auto");
  const [holding, setHolding] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const motionAllowed = useMotionAllowed();
  const playing = playChoice === "playing" || (playChoice === "auto" && motionAllowed);
  const rotating = items.length > 1 && playing && !holding && !pageHidden;

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, items.length]);

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHolding(false);
  };

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Announcements"
      className="announce surface-navy"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={onBlur}
    >
      <div className="announce-inner">
        <div className="announce-stack">
          {items.map((message, position) => (
            <Link
              key={message.id}
              href={message.href}
              className="announce-item"
              data-active={position === index ? "" : undefined}
              inert={position !== index}
            >
              <span className="announce-tag">{message.tag}</span>{" "}
              <span className="announce-text">{message.text}</span>
            </Link>
          ))}
        </div>
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setPlayChoice(playing ? "paused" : "playing")}
            aria-label={playing ? "Pause announcements" : "Play announcements"}
            className="announce-toggle"
          >
            {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          </button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/announcement`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the announcement styles**

Append to `app/globals.css`:

```css
/* --- Announcement bar (Task 16, spec section 6.1) ------------------------------ */
@layer components {
  .announce-inner {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: var(--container-page);
    margin-inline: auto;
    padding-inline: max(12px, env(safe-area-inset-left)) max(4px, env(safe-area-inset-right));
  }

  .announce-stack {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .announce-item {
    grid-area: 1 / 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding-block: 6px;
    font-size: 13px;
    line-height: 1.35;
    opacity: 0;
    transition: opacity var(--dur-slow) var(--ease-out);
  }

  .announce-item[data-active] {
    opacity: 1;
  }

  .announce-tag {
    flex-shrink: 0;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--color-sky);
    color: var(--color-navy);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  /* Phones: wraps to two lines at most. */
  .announce-text {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .announce-toggle {
    display: inline-grid;
    flex-shrink: 0;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
  }

  /* Larger screens: inset from the edges with rounded bottom corners. */
  @media (min-width: 48rem) and (min-height: 30rem) {
    .announce {
      width: calc(100% - 48px);
      max-width: calc(var(--container-page) - 48px);
      margin-inline: auto;
      border-radius: 0 0 12px 12px;
    }

    .announce-inner {
      justify-content: center;
      padding-inline: 16px 4px;
    }

    .announce-stack {
      flex: 0 1 auto;
      justify-items: center;
    }
  }
}
```

- [ ] **Step 6: Render the bar in the layout**

In `app/layout.tsx`:
1. Add `import { AnnouncementBar } from "@/components/announcement/AnnouncementBar";` as the first `@/components` import.
2. Change the data import to `import { getAnnouncements, getCampuses, getCategories, getTrendingSearches } from "@/lib/data";`.
3. Replace the `Promise.all` block with:

```tsx
  const [announcements, campuses, categories, trending] = await Promise.all([
    getAnnouncements(),
    getCampuses(),
    getCategories(),
    getTrendingSearches(),
  ]);
```

4. Add this line between the skip link and `<SiteHeader … />`:

```tsx
        <AnnouncementBar messages={announcements} />
```

- [ ] **Step 7: Look at it**

In the dev server, check each of these:
- **1280px:** a navy inset bar with rounded bottom corners above the header, changing message every 6 seconds and holding while hovered.
- **390px:** full width, wrapping to two lines at most.
- **Scrolling:** the bar scrolls away while the header sticks.
- **Reduced motion:** it doesn't rotate, and Play steps it on.

- [ ] **Step 8: Commit**

Files: `components/announcement app/globals.css app/layout.tsx`
Message: `feat: add the rotating announcement bar with pause control`

---

### Task 17: The bold footer

Spec section 6.6:
- Two giant links.
- A campus updates sign-up that confirms on screen only.
- "Add Vossie to your home screen".
- Four link groups (accordions on phones).
- The pennant legal line.
- A full-width VOSSIE wordmark sized to the footer's width.

**Files:**
- Create: `lib/fit-text.ts`, `lib/fit-text.test.ts`, `lib/install.ts`
- Create: `components/footer/FitText.tsx`, `components/footer/FitText.test.tsx`, `components/footer/NewsletterForm.tsx`, `components/footer/NewsletterForm.test.tsx`, `components/footer/InstallButton.tsx`, `components/footer/InstallButton.test.tsx`, `components/footer/ShopYourCampusLink.tsx`, `components/footer/SiteFooter.tsx`, `components/footer/SiteFooter.test.tsx`
- Modify: `app/globals.css` (footer styles), `app/layout.tsx` (render the footer)

- [ ] **Step 1: Write the failing tests**

`lib/fit-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fitFontSize } from "./fit-text";

describe("fitFontSize", () => {
  it("scales the base size so the text fills the target width", () => {
    expect(fitFontSize(500, 100, 1000)).toBe(200);
  });

  it("rounds down to a tenth of a pixel so the text never overflows", () => {
    expect(fitFontSize(300, 100, 1000)).toBe(333.3);
  });

  it("keeps the base size when nothing can be measured", () => {
    expect(fitFontSize(0, 100, 1000)).toBe(100);
    expect(fitFontSize(500, 100, 0)).toBe(100);
  });
});
```

`components/footer/FitText.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FitText } from "./FitText";

describe("FitText", () => {
  it("sizes the text to its parent's content width", () => {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1020);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 340,
      height: 80,
      top: 0,
      left: 0,
      right: 340,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    render(
      <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
        <FitText>VOSSIE</FitText>
      </div>,
    );
    // Content width 1000px; text measured at 340px when set to 100px, so 100 × 1000 / 340.
    expect(screen.getByText("VOSSIE")).toHaveStyle({ fontSize: "294.1px" });
  });
});
```

`components/footer/NewsletterForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NewsletterForm } from "./NewsletterForm";

describe("NewsletterForm", () => {
  it("explains what it is for and links the privacy notice", () => {
    render(<NewsletterForm />);
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveAttribute("type", "email");
    expect(screen.getByRole("link", { name: "privacy notice" })).toHaveAttribute("href", "/privacy");
  });

  it("does not accept an invalid address", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Get updates" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("confirms on screen and stores nothing", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    const email = screen.getByRole("textbox", { name: "Email address" });
    await user.type(email, "thandi@example.com");
    await user.click(screen.getByRole("button", { name: "Get updates" }));
    expect(screen.getByRole("status")).toHaveTextContent("nothing was sent or saved");
    expect(email).toHaveValue("");
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});
```

`components/footer/InstallButton.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { InstallButton } from "./InstallButton";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

afterEach(() => {
  window.__vossieInstallPrompt = null;
});

describe("InstallButton", () => {
  it("shows nothing where the browser can't install", () => {
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses the browser's install prompt when there is one", async () => {
    const user = userEvent.setup();
    const prompt = vi.fn().mockResolvedValue(undefined);
    window.__vossieInstallPrompt = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    render(<InstallButton />);
    await user.click(screen.getByRole("button", { name: "Add Vossie to your home screen" }));
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add Vossie to your home screen" })).not.toBeInTheDocument();
  });

  it("explains Share › Add to Home Screen on iPhone", async () => {
    const user = userEvent.setup();
    vi.spyOn(Navigator.prototype, "userAgent", "get").mockReturnValue(IPHONE);
    render(<InstallButton />);
    await user.click(screen.getByRole("button", { name: "Add Vossie to your home screen" }));
    const sheet = screen.getByRole("dialog", { name: "Add Vossie to your home screen" });
    expect(within(sheet).getByText(/Add to Home Screen/)).toBeInTheDocument();
  });

  it("shows nothing once installed", () => {
    mockMatchMedia((query) => query === "(display-mode: standalone)");
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

`components/footer/SiteFooter.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import type { Campus } from "@/lib/types";
import { SiteFooter } from "./SiteFooter";

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "online", name: "Eduvos Online", region: "Online, anywhere in SA", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];

describe("SiteFooter", () => {
  it("leads with two giant links", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
  });

  it("sends 'Shop your campus' to the chosen campus", () => {
    setCampusChoice("midrand");
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/c/midrand");
  });

  it("links every campus, the privacy notice and the sign-up", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getAllByRole("link", { name: "Eduvos Online" })[0]).toHaveAttribute("href", "/c/online");
    expect(screen.getAllByRole("link", { name: "Privacy (POPIA)" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
  });

  it("credits the Incubation Hub and hides the decorative wordmark from screen readers", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    expect(screen.getByText("An Eduvos Incubation Hub project")).toBeInTheDocument();
    expect(container.querySelector(".footer-wordmark")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test lib/fit-text.test.ts components/footer`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Write `lib/fit-text.ts`**

```ts
/**
 * The font size that makes text exactly fill `targetWidth`, given its width measured at `baseSize`.
 * Text width grows in proportion to font size, so one measurement is enough.
 * Rounded down to 0.1px so the text never overflows.
 */
export function fitFontSize(measuredWidth: number, baseSize: number, targetWidth: number): number {
  if (measuredWidth <= 0 || targetWidth <= 0) return baseSize;
  return Math.floor(((baseSize * targetWidth) / measuredWidth) * 10) / 10;
}
```

- [ ] **Step 4: Write `lib/install.ts`**

```ts
import { INSTALL_PROMPT_EVENT } from "./boot-script";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Kept by the boot script when the browser offers to install the site. */
    __vossieInstallPrompt?: InstallPromptEvent | null;
  }
}

export type InstallKind = "prompt" | "ios" | "installed" | "unsupported";

/** What "Add Vossie to your home screen" can do in this browser right now. */
export function getInstallKind(): InstallKind {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (window.__vossieInstallPrompt) return "prompt";
  const userAgent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
  return isIos ? "ios" : "unsupported";
}

export function subscribeInstall(listener: () => void): () => void {
  window.addEventListener(INSTALL_PROMPT_EVENT, listener);
  return () => window.removeEventListener(INSTALL_PROMPT_EVENT, listener);
}

/** Show the browser's own install prompt (Chrome, Edge, Samsung Internet). It can only be used once. */
export async function promptInstall(): Promise<void> {
  const event = window.__vossieInstallPrompt;
  if (!event) return;
  window.__vossieInstallPrompt = null;
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
  await event.prompt();
}
```

- [ ] **Step 5: Write `components/footer/FitText.tsx`**

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { fitFontSize } from "@/lib/fit-text";

const BASE_SIZE = 100;

/** Sizes its text to fill its parent's content width exactly; refits on resize and once fonts load. */
export function FitText({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const text = ref.current;
    const parent = text?.parentElement;
    if (!text || !parent) return;
    let active = true;

    const fit = () => {
      const style = getComputedStyle(parent);
      const target = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      text.style.fontSize = `${BASE_SIZE}px`;
      text.style.fontSize = `${fitFontSize(text.getBoundingClientRect().width, BASE_SIZE, target)}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    void document.fonts?.ready.then(() => {
      if (active) fit();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
```

- [ ] **Step 6: Write `components/footer/NewsletterForm.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

/**
 * Campus updates sign-up (spec section 6.6). There is no mailing list yet, so it only confirms
 * on screen: nothing is sent or stored (POPIA: don't collect what we can't use yet).
 */
export function NewsletterForm() {
  const id = useId();
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    form.reset();
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="footer-signup">
      <label htmlFor={`${id}-email`} className="footer-label">
        Email address
      </label>
      <div className="footer-signup-row">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          aria-describedby={`${id}-consent`}
          className="footer-input"
        />
        <button type="submit" className="btn btn-sky shrink-0">
          Get updates
        </button>
      </div>
      <p id={`${id}-consent`} className="footer-consent">
        Only campus updates, and you can unsubscribe at any time. See our <Link href="/privacy">privacy notice</Link>.
      </p>
      <p role="status" className="footer-signup-status">
        {sent ? "Thanks! Campus updates aren't live yet, so nothing was sent or saved. Sign-ups open soon." : null}
      </p>
    </form>
  );
}
```

- [ ] **Step 7: Write `components/footer/InstallButton.tsx`**

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { CloseIcon, PlusSquareIcon, ShareIcon } from "@/components/icons";
import { useOverlayDialog } from "@/components/ui/useOverlayDialog";
import { getInstallKind, promptInstall, subscribeInstall, type InstallKind } from "@/lib/install";
import { openOverlay } from "@/lib/overlays";

const unknownOnServer = (): InstallKind | null => null;

/** "Add Vossie to your home screen": the browser's prompt where there is one, a how-to sheet on iPhone. */
export function InstallButton() {
  const kind = useSyncExternalStore<InstallKind | null>(subscribeInstall, getInstallKind, unknownOnServer);

  if (kind === "prompt") {
    return (
      <button type="button" onClick={() => void promptInstall()} className="footer-install">
        <PlusSquareIcon className="size-5" />
        Add Vossie to your home screen
      </button>
    );
  }

  if (kind === "ios") {
    return (
      <>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => openOverlay("install-help", event.currentTarget)}
          className="footer-install"
        >
          <PlusSquareIcon className="size-5" />
          Add Vossie to your home screen
        </button>
        <IosInstallHelp />
      </>
    );
  }

  return null;
}

function IosInstallHelp() {
  const { dialogRef, close, onBackdropClick } = useOverlayDialog("install-help");
  return (
    <dialog ref={dialogRef} aria-labelledby="install-help-title" onClick={onBackdropClick} className="sheet-dialog">
      <div className="sheet-inner">
        <div className="flex items-start justify-between gap-3 pt-3">
          <h2 id="install-help-title" className="font-display text-[1.75rem] uppercase leading-none text-navy">
            Add Vossie to your home screen
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="hdr-icon-btn -mr-2 -mt-2">
            <CloseIcon />
          </button>
        </div>
        <ol className="install-steps">
          <li>
            Tap <ShareIcon className="install-icon" /> <strong>Share</strong> in Safari’s toolbar.
          </li>
          <li>
            Choose <PlusSquareIcon className="install-icon" /> <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Vossie opens like an app.
          </li>
        </ol>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 8: Write `components/footer/ShopYourCampusLink.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES } from "@/lib/campus";
import type { Campus } from "@/lib/types";

/** The footer's giant "Shop your campus" link: the chosen campus, or everything. */
export function ShopYourCampusLink({ campuses }: { campuses: readonly Campus[] }) {
  const choice = useCampusChoice(campuses);
  const href = choice && choice !== ALL_CAMPUSES ? `/c/${choice}` : "/browse";
  return (
    <Link href={href} className="footer-giant">
      Shop your campus
      <ArrowUpRightIcon className="footer-giant-arrow" />
    </Link>
  );
}
```

- [ ] **Step 9: Write `components/footer/SiteFooter.tsx`**

The phone accordions and the larger-screen columns hold the same links. CSS shows exactly one of them at each size, so screen readers only ever meet one.

```tsx
import Link from "next/link";
import { Pennant } from "@/components/brand/Pennant";
import { ArrowUpRightIcon, ChevronDownIcon } from "@/components/icons";
import type { Campus } from "@/lib/types";
import { FitText } from "./FitText";
import { InstallButton } from "./InstallButton";
import { NewsletterForm } from "./NewsletterForm";
import { ShopYourCampusLink } from "./ShopYourCampusLink";

type FooterLink = { href: string; label: string };
type LinkGroup = { title: string; links: readonly FooterLink[] };

const LINK_GROUPS: readonly LinkGroup[] = [
  {
    title: "Shop",
    links: [
      { href: "/browse", label: "Browse everything" },
      { href: "/categories/textbooks-notes", label: "Textbooks & notes" },
      { href: "/categories/tech", label: "Tech" },
      { href: "/categories/services", label: "Services" },
      { href: "/looking-for", label: "Looking For" },
      { href: "/saved", label: "Saved" },
    ],
  },
  {
    title: "Sell",
    links: [
      { href: "/sell", label: "List an item" },
      { href: "/how-it-works", label: "How selling works" },
      { href: "/hub", label: "Incubation Hub" },
      { href: "/safety", label: "Seller safety" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/safety", label: "Safety" },
      { href: "/privacy", label: "Privacy (POPIA)" },
      { href: "/account", label: "Your account" },
    ],
  },
];

/** The bold footer (spec section 6.6). */
export function SiteFooter({ campuses }: { campuses: readonly Campus[] }) {
  const groups: readonly LinkGroup[] = [
    ...LINK_GROUPS,
    { title: "Campuses", links: campuses.map((campus) => ({ href: `/c/${campus.slug}`, label: campus.name })) },
  ];

  return (
    <footer className="site-footer surface-navy texture-stars">
      <div className="footer-inner">
        <h2 className="sr-only">Site links</h2>
        <div className="footer-giants">
          <ShopYourCampusLink campuses={campuses} />
          <Link href="/sell" className="footer-giant">
            Start selling
            <ArrowUpRightIcon className="footer-giant-arrow" />
          </Link>
        </div>

        <div className="footer-grid">
          <section aria-labelledby="footer-updates-title" className="footer-updates">
            <h3 id="footer-updates-title" className="footer-heading">
              Campus updates
            </h3>
            <p className="footer-copy">New listings, Hub events and safety tips from your campus, once a week.</p>
            <NewsletterForm />
            <InstallButton />
          </section>

          {groups.map((group) => (
            <div key={group.title} className="footer-group">
              <details className="footer-accordion wide:hidden">
                <summary className="footer-summary">
                  {group.title}
                  <ChevronDownIcon className="footer-summary-icon" />
                </summary>
                <FooterLinks links={group.links} />
              </details>
              <div className="hidden wide:block">
                <h3 className="footer-heading">{group.title}</h3>
                <FooterLinks links={group.links} />
              </div>
            </div>
          ))}
        </div>

        <div className="footer-legal">
          <Pennant size="small" />
          <p>An Eduvos Incubation Hub project</p>
          <p className="footer-legal-links">
            <Link href="/privacy">Privacy (POPIA)</Link> · <Link href="/safety">Safety</Link>
          </p>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        <FitText className="footer-wordmark-text">VOSSIE</FitText>
      </div>
    </footer>
  );
}

function FooterLinks({ links }: { links: readonly FooterLink[] }) {
  return (
    <ul className="footer-links">
      {links.map((link) => (
        <li key={`${link.href}-${link.label}`}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 10: Run them and watch them pass**

Run: `pnpm test lib/fit-text.test.ts components/footer`
Expected: PASS (15 tests).

- [ ] **Step 11: Add the footer styles**

Append to `app/globals.css`:

```css
/* --- Footer (Task 17, spec section 6.6) ---------------------------------------- */
@layer components {
  .site-footer {
    margin-top: 72px;
    overflow: hidden;
  }

  .footer-inner {
    max-width: var(--container-page);
    margin-inline: auto;
    padding: 48px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left));
  }

  .footer-giants {
    display: grid;
    gap: 8px;
    padding-bottom: 32px;
    border-bottom: 1px solid rgb(255 255 255 / 0.15);
  }

  .footer-giant {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    min-height: 44px;
    font-family: var(--vos-font-display);
    font-size: clamp(2.75rem, 1.5rem + 5vw, 5.5rem);
    line-height: 0.95;
    text-transform: uppercase;
  }

  .footer-giant-arrow {
    flex-shrink: 0;
    width: 0.7em;
    height: 0.7em;
    color: var(--color-sky);
    transition: translate var(--dur-fast) var(--ease-out);
  }

  @media (hover: hover) and (pointer: fine) {
    .footer-giant:hover .footer-giant-arrow {
      translate: 4px -4px;
    }
  }

  .footer-grid {
    display: grid;
    gap: 8px;
    padding-block: 32px;
  }

  .footer-updates {
    padding-bottom: 16px;
  }

  .footer-heading {
    margin-bottom: 12px;
    color: var(--color-sky);
    font-family: var(--vos-font-display);
    font-size: var(--text-eyebrow);
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .footer-copy {
    color: rgb(255 255 255 / 0.8);
  }

  .footer-links {
    display: grid;
  }

  .footer-links a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: rgb(255 255 255 / 0.85);
  }

  @media (hover: hover) and (pointer: fine) {
    .footer-links a:hover {
      color: var(--color-white);
      text-decoration: underline;
    }
  }

  .footer-accordion {
    border-bottom: 1px solid rgb(255 255 255 / 0.15);
  }

  .footer-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    font-weight: 600;
    list-style: none;
    cursor: pointer;
  }

  .footer-summary::-webkit-details-marker {
    display: none;
  }

  .footer-summary-icon {
    transition: rotate var(--dur-fast) var(--ease-out);
  }

  .footer-accordion[open] .footer-summary-icon {
    rotate: 180deg;
  }

  .footer-accordion .footer-links {
    padding-bottom: 12px;
  }

  .footer-label {
    display: block;
    margin-top: 16px;
    font-size: 14px;
    font-weight: 600;
  }

  .footer-signup-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .footer-input {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-ink);
  }

  .footer-consent {
    margin-top: 8px;
    color: rgb(255 255 255 / 0.75);
    font-size: 13px;
  }

  .footer-consent a,
  .footer-legal-links a {
    color: var(--color-white);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-signup-status:not(:empty) {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgb(255 255 255 / 0.1);
    font-size: 14px;
  }

  .footer-install {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    margin-top: 16px;
    color: var(--color-sky);
    font-weight: 600;
  }

  .install-steps {
    display: grid;
    gap: 12px;
    margin-top: 16px;
    padding-left: 1.25rem;
    color: var(--color-ink);
    list-style: decimal;
  }

  .install-icon {
    display: inline;
    width: 1.2em;
    height: 1.2em;
    vertical-align: -0.25em;
    color: var(--color-sky-dark);
  }

  .footer-legal {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    padding-top: 24px;
    border-top: 1px solid rgb(255 255 255 / 0.15);
    color: rgb(255 255 255 / 0.8);
    font-size: 13px;
  }

  .footer-legal-links {
    margin-left: auto;
  }

  /* Sized by FitText to the footer's width; the negative margin crops the letters slightly at the bottom. */
  .footer-wordmark {
    margin-top: 24px;
    padding-inline: 8px;
    line-height: 0;
  }

  .footer-wordmark-text {
    display: inline-block;
    margin-bottom: -0.1em;
    color: var(--color-sky);
    font-family: var(--vos-font-display);
    font-size: 24vw; /* first paint, before FitText measures */
    line-height: 0.8;
    white-space: nowrap;
  }

  @media (min-width: 48rem) and (min-height: 30rem) {
    .footer-inner {
      padding: 72px 32px 32px;
    }

    .footer-giants {
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding-bottom: 48px;
    }

    .footer-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 32px;
      padding-block: 48px;
    }

    .footer-updates {
      grid-column: 1 / -1;
      max-width: 32rem;
    }
  }

  @media (min-width: 64rem) and (min-height: 30rem) {
    .footer-grid {
      grid-template-columns: 1.6fr repeat(3, minmax(0, 1fr)) 1.3fr;
    }

    .footer-updates {
      grid-column: auto;
    }
  }
}
```

- [ ] **Step 12: Render the footer in the layout**

In `app/layout.tsx`, add `import { SiteFooter } from "@/components/footer/SiteFooter";` below the `CampusPicker` import, and add this line straight after the closing `</main>` tag:

```tsx
        <SiteFooter campuses={campuses} />
```

- [ ] **Step 13: Look at it**

In the dev server, check each of these at 360px, 390px, 768px and 1280px:
- **Giant links:** "Shop your campus" and "Start selling" with sky arrows, stacked on phones.
- **Wordmark:** VOSSIE in sky fills the width edge to edge, slightly cropped at the bottom, with no sideways scrolling.
- **Phones:** the link groups are accordions.
- **Sign-up:** a valid address shows the "nothing was sent or saved" note.

- [ ] **Step 14: Commit**

Files: `lib/fit-text.ts lib/fit-text.test.ts lib/install.ts components/footer app/globals.css app/layout.tsx`
Message: `feat: add the bold footer with sign-up, install help and fitted wordmark`

---

### Task 18: Finish the root layout (boot script and final order)

**Files:**
- Create: `tests/e2e/boot.spec.ts`
- Replace: `app/layout.tsx` (final version)

- [ ] **Step 1: Write the failing end-to-end test, `tests/e2e/boot.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("data saver chosen on an earlier visit applies before the page paints", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vossie_low_data", "1"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-low-data", "");
});

test("the browser's Save-Data setting turns data saver on when nothing is saved", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-low-data", "");
});

test("data saver is off by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-low-data");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm e2e tests/e2e/boot.spec.ts`
Expected: the first two tests FAIL (nothing sets the attribute yet); the third passes.

- [ ] **Step 3: Replace `app/layout.tsx` with its final version**

The inline `<head>` script runs before first paint, so data saver users never see an animation start. It's the pattern the Next docs recommend for attributes on `<html>`, and it keeps the shell static. The overlays sit after the footer because they open as modals in the top layer, so their place in the page doesn't matter.

```tsx
import type { Metadata, Viewport } from "next";
import { AnnouncementBar } from "@/components/announcement/AnnouncementBar";
import { CampusPicker } from "@/components/campus/CampusPicker";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { MenuDrawer } from "@/components/menu/MenuDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { BOOT_SCRIPT } from "@/lib/boot-script";
import { getAnnouncements, getCampuses, getCategories, getTrendingSearches } from "@/lib/data";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vossie · The Eduvos student marketplace",
    template: "%s · Vossie",
  },
  description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
  applicationName: "Vossie",
  appleWebApp: {
    capable: true,
    title: "Vossie",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15305D",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [announcements, campuses, categories, trending] = await Promise.all([
    getAnnouncements(),
    getCampuses(),
    getCategories(),
    getTrendingSearches(),
  ]);

  return (
    <html lang="en-ZA" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <head>
        {/* Before first paint: data saver and the install prompt (lib/boot-script.ts). */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AnnouncementBar messages={announcements} />
        <SiteHeader campuses={campuses} />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter campuses={campuses} />
        <MenuDrawer campuses={campuses} categories={categories} />
        <SearchOverlay campuses={campuses} categories={categories} trending={trending} />
        <CampusPicker campuses={campuses} />
        <ToastRegion />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm e2e tests/e2e/boot.spec.ts tests/e2e/smoke.spec.ts tests/e2e/brand.spec.ts`
Expected: PASS at all five sizes.

- [ ] **Step 5: Check the whole project**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all exit 0.

Run: `pnpm build`
Expected: succeeds with no prerender, "blocking route" or Suspense errors, and `/` is static or partially prerendered.

- [ ] **Step 6: Commit**

Files: `app/layout.tsx tests/e2e/boot.spec.ts`
Message: `feat: finish the root layout with the pre-paint boot script`

---

### Task 19: App icons and the install manifest

**Files:**
- Create: `scripts/make-icons.py`, `app/manifest.ts`, `app/manifest.test.ts`
- Create (generated): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `app/icon.png`, `app/apple-icon.png`
- Replace (generated): `app/favicon.ico` (the scaffold's Next.js logo becomes the crest)

- [ ] **Step 1: Write the failing test, `app/manifest.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("describes an installable Vossie app", () => {
    const app = manifest();
    expect(app.short_name).toBe("Vossie");
    expect(app.start_url).toBe("/");
    expect(app.display).toBe("standalone");
    expect(app.theme_color).toBe("#15305D");
    expect(app.icons?.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(app.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test app/manifest.test.ts`
Expected: FAIL, because `./manifest` can't be resolved.

- [ ] **Step 3: Write `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vossie · The Eduvos student marketplace",
    short_name: "Vossie",
    description: "Buy and sell textbooks, tech and services with students on your Eduvos campus.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#15305D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test app/manifest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/make-icons.py`**

```python
"""Generate Vossie's app icons from the cleaned crest artwork.

Run from the project root:  python3 scripts/make-icons.py
Re-run when Eduvos supplies the official crest (point CREST at the new file).
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CREST = ROOT / "docs/reference/brand/crest-white.png"
NAVY = (21, 48, 93, 255)


def icon(size: int, crest_height: float, corner: float = 0.0) -> Image.Image:
    """A navy square (optionally rounded) with the white crest centred at `crest_height` of the size."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * corner), fill=255)
    canvas.paste(Image.new("RGBA", (size, size), NAVY), (0, 0), mask)

    crest = Image.open(CREST).convert("RGBA")
    height = round(size * crest_height)
    width = round(crest.width * height / crest.height)
    crest = crest.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(crest, ((size - width) // 2, (size - height) // 2))
    return canvas


def main() -> None:
    icons = ROOT / "public/icons"
    icons.mkdir(parents=True, exist_ok=True)
    icon(192, 0.62).save(icons / "icon-192.png", optimize=True)
    icon(512, 0.62).save(icons / "icon-512.png", optimize=True)
    # Maskable: the crest stays inside the central 80% safe zone.
    icon(512, 0.46).save(icons / "icon-maskable-512.png", optimize=True)
    # iOS rounds the corners itself.
    icon(180, 0.6).save(ROOT / "app/apple-icon.png", optimize=True)
    icon(64, 0.7, corner=0.18).save(ROOT / "app/icon.png", optimize=True)
    icon(48, 0.72, corner=0.18).save(ROOT / "app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Icons written to public/icons and app/.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Generate the icons**

This overwrites the scaffold's `app/favicon.ico` (the Next.js logo) with the crest, which is intended.

Run: `python3 scripts/make-icons.py`
Expected: `Icons written to public/icons and app/.`

Then run:

```bash
python3 -c "from PIL import Image; [print(p, Image.open(p).size) for p in ['public/icons/icon-192.png','public/icons/icon-512.png','public/icons/icon-maskable-512.png','app/apple-icon.png','app/icon.png']]"
```

Expected: sizes 192, 512, 512, 180 and 64 (square).

- [ ] **Step 7: Look at them**

Open `public/icons/icon-512.png` and `public/icons/icon-maskable-512.png` with the Read tool. Expected: the white crest centred on navy, with the maskable one smaller.

- [ ] **Step 8: Commit**

Files: `scripts/make-icons.py app/manifest.ts app/manifest.test.ts app/icon.png app/apple-icon.png app/favicon.ico public/icons`
Message: `feat: add crest app icons and the install manifest`

---

### Task 20: Placeholder routes and the 404 page

Spec section 14: every link in the shell goes somewhere real.

**Files:**
- Create: `components/ComingSoon.tsx`, `components/ComingSoon.test.tsx`, `app/not-found.tsx`, `tests/e2e/routes.spec.ts`
- Create: `app/browse/page.tsx`, `app/sell/page.tsx`, `app/hub/page.tsx`, `app/how-it-works/page.tsx`, `app/safety/page.tsx`, `app/privacy/page.tsx`, `app/looking-for/page.tsx`, `app/login/page.tsx`, `app/account/page.tsx`, `app/saved/page.tsx`
- Create: `app/c/[campus]/page.tsx`, `app/categories/[slug]/page.tsx`

**Dynamic routes under Cache Components (verified in the 16.4 docs):**
- `generateStaticParams` lists every campus or category.
- `params` is awaited inside `<Suspense>`, so the build can make the route's App Shell.
- `dynamicParams` is not allowed and would fail the build.
- Unknown slugs call `notFound()`. Because that happens inside the boundary, the page shows the branded 404 marked `noindex`.

- [ ] **Step 1: Write the failing tests**

`components/ComingSoon.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComingSoon } from "./ComingSoon";

describe("ComingSoon", () => {
  it("titles the page, explains it and links home", () => {
    render(<ComingSoon title="Browse">Filters arrive later.</ComingSoon>);
    expect(screen.getByRole("heading", { level: 1, name: "Browse" })).toBeInTheDocument();
    expect(screen.getByText("Coming in the next stage")).toBeInTheDocument();
    expect(screen.getByText("Filters arrive later.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the homepage" })).toHaveAttribute("href", "/");
  });
});
```

`tests/e2e/routes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const PLACEHOLDERS: Array<[path: string, title: string]> = [
  ["/browse", "Browse"],
  ["/sell", "Start selling"],
  ["/hub", "The Incubation Hub"],
  ["/how-it-works", "How Vossie works"],
  ["/safety", "Safety"],
  ["/privacy", "Privacy (POPIA)"],
  ["/looking-for", "Looking For"],
  ["/login", "Sign in"],
  ["/account", "Your account"],
  ["/saved", "Saved"],
  ["/c/midrand", "Midrand"],
  ["/c/online", "Eduvos Online"],
  ["/categories/tech", "Tech"],
  ["/categories/textbooks-notes", "Textbooks & notes"],
];

/** Routes don't change with width, so one phone and one desktop size are enough. */
function onlyAtPhoneAndDesktop() {
  test.skip(!["phone-390", "desktop-1440"].includes(test.info().project.name), "Covered at 390 and 1440");
}

test.describe("placeholder routes", () => {
  for (const [path, title] of PLACEHOLDERS) {
    test(`${path} renders inside the shell`, async ({ page }) => {
      onlyAtPhoneAndDesktop();
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByText("Coming in the next stage")).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeAttached();
    });
  }

  test("unknown campus and category slugs show the 404 page", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    await page.goto("/c/atlantis");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
    await page.goto("/categories/spaceships");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
  });

  test("a made-up path is a real 404", async ({ page }) => {
    onlyAtPhoneAndDesktop();
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test components/ComingSoon.test.tsx`
Expected: FAIL, because `./ComingSoon` can't be resolved.

Run: `pnpm e2e tests/e2e/routes.spec.ts`
Expected: FAIL, because the routes don't exist yet.

- [ ] **Step 3: Write `components/ComingSoon.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

type ComingSoonProps = {
  title: string;
  children?: ReactNode;
};

/** Body for pages that arrive in a later stage (spec section 14). */
export function ComingSoon({ title, children }: ComingSoonProps) {
  return (
    <section aria-labelledby="page-title" className="mx-auto w-full max-w-page px-4 pb-8 pt-16 wide:px-8 wide:pt-24">
      <p className="eyebrow">Coming in the next stage</p>
      <h1 id="page-title" className="mt-3 font-display text-section uppercase text-navy">
        {title}
      </h1>
      <div className="mt-4 max-w-[60ch] text-muted">{children ?? "This page arrives in the next build stage."}</div>
      <Link href="/" className="btn btn-primary mt-8">
        Back to the homepage
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm test components/ComingSoon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write `app/not-found.tsx`**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <section aria-labelledby="page-title" className="mx-auto w-full max-w-page px-4 pb-8 pt-16 wide:px-8 wide:pt-24">
      <p className="eyebrow">Page not found</p>
      <h1 id="page-title" className="mt-3 font-display text-section uppercase text-navy">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 max-w-[60ch] text-muted">The link may be old, or the page may not exist yet.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          Back to the homepage
        </Link>
        <Link href="/browse" className="btn btn-outline text-navy">
          Browse everything
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Write the ten static placeholder pages**

`app/browse/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Browse" };

export default function BrowsePage() {
  return <ComingSoon title="Browse">Search results, filters and every listing arrive in the next stage.</ComingSoon>;
}
```

`app/sell/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Start selling" };

export default function SellPage() {
  return <ComingSoon title="Start selling">Listing an item, a service or a swap arrives in the next stage.</ComingSoon>;
}
```

`app/hub/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "The Incubation Hub" };

export default function HubPage() {
  return (
    <ComingSoon title="The Incubation Hub">
      The Hub&apos;s story, verified sellers and events arrive in the next stage.
    </ComingSoon>
  );
}
```

`app/how-it-works/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "How Vossie works" };

export default function HowItWorksPage() {
  return <ComingSoon title="How Vossie works">Step-by-step guides for buying and selling arrive in the next stage.</ComingSoon>;
}
```

`app/safety/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Safety" };

export default function SafetyPage() {
  return (
    <ComingSoon title="Safety">
      Until the full guide arrives: meet at an approved campus pickup point, check the item before you pay, and never
      pay a deposit to someone you haven&apos;t met.
    </ComingSoon>
  );
}
```

`app/privacy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Privacy (POPIA)" };

export default function PrivacyPage() {
  return (
    <ComingSoon title="Privacy (POPIA)">
      <p>The full privacy notice arrives with accounts. For now Vossie keeps very little:</p>
      <ul className="mt-3 list-disc pl-5">
        <li>
          Your campus choice, in a cookie called <code>vossie_campus</code> that lasts a year. Your browser sends it
          back to Vossie so pages can show your campus first.
        </li>
        <li>Saved items, recent searches and the data saver setting stay in your browser and never leave it.</li>
      </ul>
      <p className="mt-3">
        The campus updates form doesn&apos;t send or store your email yet. Clearing your browser data removes
        everything above.
      </p>
    </ComingSoon>
  );
}
```

`app/looking-for/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Looking For" };

export default function LookingForPage() {
  return <ComingSoon title="Looking For">Posting a request and getting offers from sellers arrives in the next stage.</ComingSoon>;
}
```

`app/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <ComingSoon title="Sign in">Signing in with your email arrives in the next stage.</ComingSoon>;
}
```

`app/account/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return <ComingSoon title="Your account">Your profile, listings and messages arrive in the next stage.</ComingSoon>;
}
```

`app/saved/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <ComingSoon title="Saved">
      The items you save are kept on this device. Seeing them all here arrives in the next stage.
    </ComingSoon>
  );
}
```

- [ ] **Step 7: Write the two dynamic placeholder pages**

`app/c/[campus]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCampuses } from "@/lib/data";

export const metadata: Metadata = { title: "Campus" };

export async function generateStaticParams() {
  return (await getCampuses()).map((campus) => ({ campus: campus.slug }));
}

export default function CampusPage({ params }: PageProps<"/c/[campus]">) {
  return (
    <Suspense fallback={<ComingSoon title="Campus" />}>
      <CampusDetails params={params} />
    </Suspense>
  );
}

async function CampusDetails({ params }: Pick<PageProps<"/c/[campus]">, "params">) {
  const { campus: slug } = await params;
  const campus = (await getCampuses()).find((item) => item.slug === slug);
  if (!campus) notFound();
  return (
    <ComingSoon title={campus.name}>
      {campus.liveListings} live listings at {campus.name} ({campus.region}). The campus storefront arrives in the next
      stage.
    </ComingSoon>
  );
}
```

`app/categories/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { getCategories } from "@/lib/data";

export const metadata: Metadata = { title: "Category" };

export async function generateStaticParams() {
  return (await getCategories()).map((category) => ({ slug: category.slug }));
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<ComingSoon title="Category" />}>
      <CategoryDetails params={params} />
    </Suspense>
  );
}

async function CategoryDetails({ params }: Pick<PageProps<"/categories/[slug]">, "params">) {
  const { slug } = await params;
  const category = (await getCategories()).find((item) => item.slug === slug);
  if (!category) notFound();
  return <ComingSoon title={category.name}>Every {category.name.toLowerCase()} listing arrives in the next stage.</ComingSoon>;
}
```

- [ ] **Step 8: Build and run the route tests**

Run: `pnpm typecheck`
Expected: exit 0. (`next typegen` creates the `PageProps<"/c/[campus]">` types first.)

Run: `pnpm build`
Expected:
- The build succeeds.
- Every campus and category page is prerendered.
- No errors about `usePathname`, params or Suspense.

Run: `pnpm e2e tests/e2e/routes.spec.ts`
Expected: PASS at 390px and 1440px (the other sizes report as skipped).

- [ ] **Step 9: Commit**

Files: `components/ComingSoon.tsx components/ComingSoon.test.tsx app/not-found.tsx app/browse app/sell app/hub app/how-it-works app/safety app/privacy app/looking-for app/login app/account app/saved app/c app/categories tests/e2e/routes.spec.ts`
Message: `feat: add placeholder pages for every shell link and a branded 404`

---

### Task 21: End-to-end checks for the whole shell

These cover spec section 15 for the shell: header states at every size, keyboard and focus, overlays, campus choice, search, reduced motion, sideways scrolling, axe, the wordmark and the size budgets.

**Files:**
- Create: `tests/e2e/shell.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/performance.spec.ts`, `tests/e2e/screenshots.spec.ts`

- [ ] **Step 1: Write `tests/e2e/shell.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";

const isTabletOrWider = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

async function openCampusPicker(page: Page) {
  if (isTabletOrWider(page)) {
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  return page.getByRole("dialog", { name: "Choose your campus" });
}

test.describe("header", () => {
  test("hides to the crest, pops back without moving the page, and hides again 160px later", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(menu).toBeHidden();
    const pennant = page.getByRole("button", { name: "Show navigation" });
    await expect(pennant).toBeVisible();
    await expect.poll(async () => (await pennant.boundingBox())?.y ?? 99).toBeLessThanOrEqual(1);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    // A real tap on touch screens (the spec says "tap"), a click elsewhere.
    if (test.info().project.use.hasTouch) await pennant.tap();
    else await pennant.click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("link", { name: "Vossie home" })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    await page.evaluate(() => window.scrollBy(0, 200));
    await expect(menu).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(menu).toBeVisible();
  });

  test.describe("on a landscape phone", () => {
    test.use({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

    test("keeps the phone layout (the wide: variant needs 30rem of height)", async ({ page }) => {
      test.skip(test.info().project.name !== "phone-390", "Checked once, in the phone project");
      await page.goto("/");
      const pill = page.locator(".site-header .campus-pill");
      await expect(pill).toHaveCount(1);
      await expect(pill).toBeHidden();
      await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    });
  });

  test("the home pennant scrolls back to the top on the homepage", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.getByRole("link", { name: "Vossie home" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("never hides while a header control has keyboard focus", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });
    for (let i = 0; i < 20 && !(await menu.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(menu).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.locator(".site-header")).toHaveAttribute("data-mode", "expanded");
    await expect(menu).toBeFocused();
  });
});

test.describe("menu", () => {
  test("traps focus, closes on Escape and gives focus back", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Menu" });
    await menuButton.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const escaped = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active && active !== document.body && !active.closest("dialog[open]"));
      });
      expect(escaped).toBe(false);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test("closes when a link is followed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("link", { name: "Sell" }).click();
    await expect(page).toHaveURL(/\/sell$/);
    await expect(menu).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start selling");
  });
});

test.describe("campus picker", () => {
  test("saves the choice, confirms it, and remembers it after a reload", async ({ page, context }) => {
    await page.goto("/");
    const picker = await openCampusPicker(page);
    await expect(picker).toBeVisible();
    await picker.getByRole("searchbox", { name: "Find your campus" }).fill("mid");
    await picker.getByRole("button", { name: "Midrand, Gauteng" }).click();
    await expect(picker).toBeHidden();
    await expect(page.locator(".toast")).toHaveText("Showing Midrand first");

    const cookie = (await context.cookies()).find((c) => c.name === "vossie_campus");
    expect(cookie?.value).toBe("midrand");

    await page.reload();
    if (isTabletOrWider(page)) {
      await expect(page.getByRole("button", { name: "Shopping at Midrand" })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Menu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at Midrand/ }),
      ).toBeVisible();
    }
  });
});

test.describe("search", () => {
  test("submits to browse and remembers the search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).click();
    const dialog = page.getByRole("dialog", { name: "Search Vossie" });
    const box = dialog.getByRole("searchbox", { name: "Search Vossie" });
    await expect(box).toBeFocused();
    await box.fill("calculator");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/browse\?q=calculator$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Browse");

    await page.getByRole("button", { name: "Search" }).click();
    await expect(dialog.getByRole("link", { name: "calculator" })).toBeVisible();
  });
});

test.describe("announcement bar", () => {
  test("moves on every six seconds", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    const active = page.locator(".announce-item[data-active]");
    await expect(active).toContainText("Live on all 12");
    await page.clock.fastForward(6500);
    await expect(active).toContainText("pickup point");
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("stays still and offers Play", async ({ page }) => {
      await page.clock.install();
      await page.goto("/");
      await page.clock.fastForward(13_000);
      await expect(page.locator(".announce-item[data-active]")).toContainText("Live on all 12");
      await expect(page.getByRole("button", { name: "Play announcements" })).toBeVisible();
    });
  });
});

test.describe("footer", () => {
  test("the VOSSIE wordmark fills the footer width", async ({ page }) => {
    await page.goto("/");
    const wordmark = page.locator(".footer-wordmark-text");
    await wordmark.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        wordmark.evaluate((element) => {
          const parent = element.parentElement!;
          const style = getComputedStyle(parent);
          const target = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          return Math.abs(element.getBoundingClientRect().width - target);
        }),
      )
      .toBeLessThanOrEqual(2);
  });

  test("link groups open as accordions on phones", async ({ page }) => {
    test.skip(isTabletOrWider(page), "Phones only");
    await page.goto("/");
    const shop = page.locator("summary.footer-summary", { hasText: /^Shop$/ });
    await shop.scrollIntoViewIfNeeded();
    await shop.click();
    await expect(page.getByRole("link", { name: "Browse everything" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Write `tests/e2e/responsive.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

// The projects cover 360, 390, 768, 1024 and 1440 (phones with mobile emulation).
// These are the spec's other test widths.
const EXTRA_WIDTHS = [430, 1280];

const sidewaysOverflow = () =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth;

test("no sideways scrolling at this project's size", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready); // measure after the web fonts swap in
  expect(await page.evaluate(sidewaysOverflow)).toBeLessThanOrEqual(0);
});

test("no sideways scrolling at the in-between widths", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop-1440", "This test walks the extra widths itself");
  for (const width of EXTRA_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(sidewaysOverflow), `sideways overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test("the main controls are reachable with the keyboard", async ({ page }) => {
  await page.goto("/");
  const reached = new Set<string>();
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return "";
      return (active.getAttribute("aria-label") || active.textContent || "").trim().replace(/\s+/g, " ");
    });
    if (name) reached.add(name);
  }
  for (const expected of ["Skip to content", "Menu", "Vossie home", "Account", "Shop your campus", "Start selling", "Get updates"]) {
    expect([...reached].some((name) => name.startsWith(expected)), `${expected} should be reachable`).toBe(true);
  }
});
```

- [ ] **Step 3: Write `tests/e2e/a11y.spec.ts`**

Reduced motion makes every transition instant, so axe sees the final state of each overlay.

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

async function seriousIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

test("the homepage", async ({ page }) => {
  await page.goto("/");
  expect(await seriousIssues(page)).toEqual([]);
});

test("the homepage scrolled to crest only", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(page.getByRole("button", { name: "Show navigation" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("dialog", { name: "Search Vossie" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("the campus picker", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  await expect(page.getByRole("dialog", { name: "Choose your campus" })).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);
});

test("a placeholder page", async ({ page }) => {
  await page.goto("/privacy");
  expect(await seriousIssues(page)).toEqual([]);
});
```

- [ ] **Step 4: Write `tests/e2e/performance.spec.ts`**

The budgets come from spec section 11. Part 1 measures the shell alone, which leaves room for Part 2's sections.

```ts
import { expect, test } from "@playwright/test";

test("a first visit to the homepage stays inside the size budgets", async ({ page }) => {
  test.skip(test.info().project.name !== "phone-390", "Measured once, at phone size");
  const pending: Array<Promise<void>> = [];
  const bytes = { script: 0, font: 0, total: 0 };

  page.on("requestfinished", (request) => {
    pending.push(
      request.sizes().then((sizes) => {
        bytes.total += sizes.responseBodySize + sizes.responseHeadersSize;
        if (request.resourceType() === "script") bytes.script += sizes.responseBodySize;
        if (request.resourceType() === "font") bytes.font += sizes.responseBodySize;
      }),
    );
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await Promise.all(pending);
  console.log(`Homepage shell: ${JSON.stringify(bytes)}`);

  expect(bytes.script, "JavaScript, compressed").toBeLessThanOrEqual(150 * 1024);
  expect(bytes.font, "fonts").toBeLessThanOrEqual(60 * 1024);
  expect(bytes.total, "whole first visit").toBeLessThanOrEqual(350 * 1024);
});
```

If a budget fails, don't raise it. Report the measured numbers to Lama; trimming is a design decision.

- [ ] **Step 5: Write `tests/e2e/screenshots.spec.ts`**

This only runs on request (`SCREENSHOTS=1`). It saves review images for Lama.

```ts
import { test } from "@playwright/test";

test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1 to refresh the review screenshots");

test("shell review screenshots", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!["phone-390", "desktop-1440"].includes(project), "Saved at 390 and 1440 only");
  const shot = (name: string) => page.screenshot({ path: `docs/progress/part-1/${project}-${name}.png` });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await shot("01-top");

  await page.evaluate(() => window.scrollTo(0, 700));
  await page.getByRole("button", { name: "Show navigation" }).waitFor();
  await shot("02-crest-only");

  await page.getByRole("button", { name: "Show navigation" }).click();
  await shot("03-revealed");

  await page.getByRole("button", { name: "Menu" }).click();
  await shot("04-menu");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Search" }).click();
  await shot("05-search");
  await page.keyboard.press("Escape");

  if (project === "desktop-1440") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /^Shopping at/ }).click();
  } else {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /^Shopping at/ }).click();
  }
  await shot("06-campus-picker");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.locator(".footer-wordmark").scrollIntoViewIfNeeded();
  await shot("07-footer");
});
```

- [ ] **Step 6: Run the full end-to-end suite**

Run: `pnpm e2e`
Expected: everything passes at all five sizes (skips are expected where a test says so). The performance test logs the measured sizes; note them for Task 22.

If something fails, use the `systematic-debugging` skill. Fix the app, not the test, unless the test is wrong about the spec.

- [ ] **Step 7: Commit**

Files: `tests/e2e/shell.spec.ts tests/e2e/responsive.spec.ts tests/e2e/a11y.spec.ts tests/e2e/performance.spec.ts tests/e2e/screenshots.spec.ts`
Message: `test: cover the shell end to end at five screen sizes`

---

### Task 22: Final verification, review screenshots and the progress log

**Files:**
- Create (generated): `docs/progress/part-1/*.png`
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Run every check from a clean build**

Run each and confirm the result before the next:
1. `pnpm lint` (exit 0)
2. `pnpm typecheck` (exit 0)
3. `pnpm test` (all pass)
4. `pnpm build` (succeeds, no prerender errors)
5. `pnpm e2e` (all pass)

Use the `verification-before-completion` skill: only report what you actually saw pass.

- [ ] **Step 2: Save the review screenshots**

Run: `SCREENSHOTS=1 pnpm e2e tests/e2e/screenshots.spec.ts`
Expected: 14 PNGs in `docs/progress/part-1/` (7 at 390px, 7 at 1440px).

Open a few with the Read tool and compare them with `docs/reference/mockups/home-v2.html` for the header, pennant, menu and footer:
- The navy and sky colours.
- The pennant's white edge.
- The condensed uppercase type.
- The bold footer wordmark.

- [ ] **Step 3: Update `docs/PROGRESS.md`**

Add a dated entry above `## Next`, using the real numbers:

```markdown
## <date the build finished>: Part 1 built (foundation and site shell)
- Next.js 16.4 app with Eduvos tokens, interim fonts and a typed sample-data layer.
- Shell: announcement bar, crest header (crest-only on scroll, tap to reveal), menu, campus picker, search, toasts, bold footer.
- Placeholder pages for every link, branded 404, app icons and install manifest.
- Checks: lint, types, <N> unit tests and <N> end-to-end tests passing at 360, 390, 768, 1024 and 1440px; axe clean.
- First-visit size of the shell at 390px: JS <n> KB, fonts <n> KB, total <n> KB (budgets 150 / 60 / 350).
- Review screenshots: `docs/progress/part-1/`.
```

Replace `## Next` with:

```markdown
## Next
- Lama reviews the Part 1 screenshots.
- Write Part 2 of the plan (the 14 homepage sections) against the real Part 1 code, then build it.
```

- [ ] **Step 4: Commit**

Files: `docs/PROGRESS.md docs/progress/part-1`
Message: `docs: record Part 1 results and review screenshots`

- [ ] **Step 5: Report to Lama**

Send the 390px and 1440px screenshots with `SendUserFile`. Then summarise in plain English:
- What works.
- The measured sizes against the budgets.
- Anything skipped (for example the end-to-end tests if Chromium wasn't approved).
- Anything that needs Lama's decision.

---

### Deferred Task D1: Try Eduvos's own fonts (only once Eduvos sends the files)

Don't start this until Lama has supplied all five `.woff2` files and confirmed that Eduvos's licence covers Vossie's domain (spec section 4).

**Files:**
- Create: `app/fonts/eduvos/cocogoose-pro.woff2`, `LarkenBlack.woff2`, `LarkenBold.woff2`, `LarkenMedium.woff2`, `LarkenMediumItalic.woff2` (copied from wherever Lama puts them)
- Create: `components/dev/FontSetSwitch.tsx`, `components/dev/FontSetSwitch.test.tsx`
- Modify: `app/fonts.ts`, `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1: Copy the files in and check the licence position**

Ask Lama where the files are, then copy them with `cp -n` into `app/fonts/eduvos/`.

Ask whether the licence allows the files in a private git repository. If not, add `/app/fonts/eduvos/` to `.gitignore` before any commit, and note in `CLAUDE.md` that the files are supplied separately.

- [ ] **Step 2: Write the failing test, `components/dev/FontSetSwitch.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FONT_SET_KEY, FontSetSwitch } from "./FontSetSwitch";

describe("FontSetSwitch", () => {
  it("switches the whole page between font sets and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<FontSetSwitch />);
    const select = screen.getByRole("combobox", { name: "Font set (development only)" });
    await user.selectOptions(select, "eduvos");
    expect(document.documentElement).toHaveAttribute("data-font-set", "eduvos");
    expect(localStorage.getItem(FONT_SET_KEY)).toBe("eduvos");
    await user.selectOptions(select, "interim");
    expect(document.documentElement).not.toHaveAttribute("data-font-set");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test components/dev`
Expected: FAIL, because `./FontSetSwitch` can't be resolved.

- [ ] **Step 4: Write `components/dev/FontSetSwitch.tsx`**

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";

export const FONT_SET_KEY = "vossie_font_set";
const SETS = [
  { value: "interim", label: "Interim (Special Gothic + Geist)" },
  { value: "eduvos", label: "Eduvos: Cocogoose Pro" },
  { value: "eduvos-larken", label: "Eduvos: Larken headlines" },
] as const;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => document.documentElement.getAttribute("data-font-set") ?? "interim";
const getServerSnapshot = () => "interim";

function applyFontSet(value: string) {
  if (value === "interim") document.documentElement.removeAttribute("data-font-set");
  else document.documentElement.setAttribute("data-font-set", value);
  try {
    localStorage.setItem(FONT_SET_KEY, value);
  } catch {
    // Storage blocked: the switch still works until reload.
  }
  listeners.forEach((listener) => listener());
}

/** Development-only switch for comparing font sets on real screens (spec section 4). */
export function FontSetSwitch() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Bring back the set chosen before the last reload.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_SET_KEY);
      if (saved && saved !== getSnapshot()) applyFontSet(saved);
    } catch {
      // Storage blocked: start on the interim set.
    }
  }, []);

  return (
    <label className="fixed bottom-3 right-3 z-[70] flex items-center gap-2 rounded-full bg-navy px-3 py-2 text-meta text-white">
      <span className="sr-only">Font set (development only)</span>
      <select value={current} onChange={(event) => applyFontSet(event.target.value)} className="bg-transparent">
        {SETS.map((set) => (
          <option key={set.value} value={set.value} className="text-ink">
            {set.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 5: Load the Eduvos files without preloading them**

Append to `app/fonts.ts`:

```ts
import localFont from "next/font/local";

// Eduvos's own fonts, loaded only when the Eduvos font set is switched on (preload: false).
export const cocogoose = localFont({
  src: "./fonts/eduvos/cocogoose-pro.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
  variable: "--font-cocogoose",
});

export const larken = localFont({
  src: [
    { path: "./fonts/eduvos/LarkenMedium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/eduvos/LarkenMediumItalic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/eduvos/LarkenBold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/eduvos/LarkenBlack.woff2", weight: "900", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-larken",
});
```

Move the new `import localFont …` line up to sit with the other import at the top of the file. Then change the last line to:

```ts
export const fontVariables = `${displayInterim.variable} ${textInterim.variable} ${cocogoose.variable} ${larken.variable}`;
```

If `fontTools` is available, check Cocogoose's real weight range:

```bash
python3 -c "from fontTools.ttLib import TTFont; f=TTFont('app/fonts/eduvos/cocogoose-pro.woff2'); print([(a.axisTag, a.minValue, a.maxValue) for a in f['fvar'].axes])"
```

Then set `weight` to that range (for example `"200 900"`).

- [ ] **Step 6: Add the two Eduvos sets to `app/globals.css`**

Add this below the `:root { … }` block:

```css
/* Eduvos font sets (Deferred Task D1), switched by <html data-font-set>. */
:root[data-font-set="eduvos"] {
  --vos-font-display: var(--font-cocogoose), "Arial Black", sans-serif;
  --vos-font-text: var(--font-cocogoose), ui-sans-serif, system-ui, sans-serif;
  --vos-font-accent: var(--font-larken), Georgia, serif;
}

:root[data-font-set="eduvos-larken"] {
  --vos-font-display: var(--font-larken), Georgia, serif;
  --vos-font-text: var(--font-cocogoose), ui-sans-serif, system-ui, sans-serif;
  --vos-font-accent: var(--font-larken), Georgia, serif;
}
```

- [ ] **Step 7: Show the switch in development only**

In `app/layout.tsx`:
1. Import `FontSetSwitch` from `@/components/dev/FontSetSwitch`.
2. Add `{process.env.NODE_ENV !== "production" && <FontSetSwitch />}` just before `<ToastRegion />`.

- [ ] **Step 8: Test and compare**

Run: `pnpm test components/dev && pnpm lint && pnpm typecheck`
Expected: PASS, exit 0.

In the dev server, switch between the three sets at 360, 390, 768, 1280 and 1440px and check for clipped or overflowing text. The spec's width risk applies: Cocogoose is far wider than the condensed face, so the hero headline, menu links, footer giants and wordmark need the closest look. Ask Lama to pick a set.

- [ ] **Step 9: Make Lama's choice the default (after the decision)**

Move the chosen set's three variables into the main `:root` block and delete the other `data-font-set` rules. Remove `FontSetSwitch`, its test and the layout line. Keep only the fonts that are used, with `preload: true` for the display face. Re-run `pnpm e2e tests/e2e/performance.spec.ts`; the fonts must stay within 60 KB.

- [ ] **Step 10: Commit**

Files: the files above (font files only if the licence allows).
Message: `feat: switch to Eduvos's fonts`

---

## Handoff to Part 2

Part 2 builds the homepage sections (spec section 7.3 to 7.13) on top of this shell. It can use:

- **Campus:**
  - `useCampusChoice(campuses)` (client), `setCampusChoice()`, and `openOverlay("campus", trigger)` for hero chips and Shop by campus.
  - `ALL_CAMPUSES`, `campusLabel()` and the `vossie_campus` cookie.
- **Feedback and saves:** `showToast()` for confirmations; `toggleSaved()` (throws when storage is blocked, so the heart can roll back), `isSaved()` and `useSavedCount()`.
- **Motion:** `useMotionAllowed()` and `isMotionAllowedNow()` for the hero autoplay and the campus highlight cycle.
- **Components:**
  - `Pennant`, `NavLink`, the icon set and the `.sheet-dialog` sheet/popover styles.
  - The tokens (`text-hero`, `text-section`, `eyebrow`, `btn`, `surface-navy`, `texture-stars`, `rounded-panel`/`card`/`strip`).

Part 2 must add:

1. **Server-side campus reading.** Campus-aware sections (Just listed, Featured, Looking For, What's on) read `cookies()` inside their own `<Suspense>` boundaries, with skeletons as the fallbacks. Never read cookies in the layout or at the top of the page.
2. **`router.refresh()` after a campus choice,** so those server sections re-render. Add it in `CampusPicker`'s `choose()` and mock `useRouter` in its test, which the setup already does.
3. **The remaining data functions from spec section 13:**
   - `getCollections`, `getJustListed`, `getFeatured`, `getRequests`, `getFreeAndSwaps`, `getHubEvents`, `getViewerContext`.
   - Fixtures for each, with at least one campus that has no new listings.
4. **Placeholder art** for every `image.src` in the fixtures, at the final ratios from spec section 12, under `public/placeholders/`.
5. **`/collections/[slug]`**, the last placeholder route, using the same `generateStaticParams` + `<Suspense>` pattern as Task 20.
6. **A new `app/page.tsx`** with the 14-section homepage, replacing the placeholder.
7. **Before calling the homepage done:**
   - The Lighthouse mobile check (spec section 11).
   - Screenshots compared with `docs/reference/mockups/home-v2.html`.

### Notes from the Part 1 reviews (2026-10-09)

**Decisions for Lama**
- **Display-font layout shift.**
  - Special Gothic Condensed One has no fallback metrics in `next/font`, so the swap from the fallback can move content. One rough measurement on the placeholder page gave CLS 0.156 at 360px with a plain sans-serif fallback; the budget is 0.05.
  - Decide with the real hero and the final fonts:
    - Option 1: `display: "optional"` for the display face.
    - Option 2: keep `swap` and add a CLS check that delays `**/*.woff2` and sums the layout shifts.
  - `next/font/local` (the Eduvos fonts) computes fallback metrics itself.

**Accessibility cautions**
- **Contrast.**
  - The default `.eyebrow` colour (sky-dark) passes only on white. It fails on `panel` (4.25:1) and `pale` (4.04:1), so eyebrows there should be navy.
  - Small sky text over the 13% star texture dips to about 4.0:1 where a star crosses a letter. Either keep small sky text off textured areas, or lighten the stars to about 6%.
- **Tap feedback.** The tap highlight is off globally, and only `.btn` has a pressed state. Give new tappable links, icon buttons and cards their own `:active` feedback.

**Layout**
- **Full-width bands.** `#main` carries the safe-area insets as side padding. In landscape on notched iPhones, a full-width band placed inside `<main>` therefore stops at the inset, leaving thin white strips. For edge-to-edge bands, give the band its own `margin-inline` that cancels the inset (`calc(env(safe-area-inset-left) * -1)`) and put matching padding back inside it.

**Testing**
- **`next/navigation` mock.** The mock in `vitest.setup.ts` can't be asserted on: `useRouter()` returns new spies on every call, and `usePathname()` is always "/". A test that needs either should mock `next/navigation` in its own file with `vi.hoisted` singletons.
- **Other test helpers.**
  - `createMediaQueryList` is static, so `change` events never fire.
  - The `next/image` and `next/form` mocks drop props that aren't on their short lists.

