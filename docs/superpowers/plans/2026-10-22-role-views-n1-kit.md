# Role views N1: the kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, server-only kit (tokens, icons, cards, queues, tiles, rows, five charts), the section bars for `/sell`, `/admin` and `/mentor` (with the desktop sidebar, the slim footer and `/admin/more`), page transitions, press feedback and the "You" label, keeping every page inside the 150 KB first-visit JavaScript budget (Lama, 2026-10-22: smooth, functional and fast matter more than byte-identical bundles).

**Architecture:** Every new component is a React Server Component in `components/kit/` or `components/charts/` (charts `import "server-only"`). The section bars render from new `app/sell/layout.tsx`, `app/admin/layout.tsx` and `app/mentor/layout.tsx` inside `<Suspense>`, after the same role or shop check the pages use; CSS (`body:has(.section-shell:not([style*="display"]) > .section-bar)`) hides the root tab bar and the footer's marketing blocks. Page transitions use React 19.3's built-in `<ViewTransition>` through one `PageTransition` wrapper in each section page.

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, TypeScript, Tailwind CSS 4.3 with component CSS in `app/globals.css`, Vitest 5 + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-22-role-views-design.md` (sections 4, 5, 9 and the N1 row of 10).

---

## Rules for whoever builds this

- **Commits:** implementers leave their work uncommitted. The controller checks each task and commits it, only with Lama's go-ahead for the stage (project memory, CLAUDE.md). Every "Commit" step below is for the controller.
- **One git command at a time.** Run `git status` before any git command, as a separate call.
- **Stop only your own server** (by PID or port), never `pkill` by name.
- Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` before Task 13.
- Never write a font name, a hex colour, `md:` or `lg:` in a component. Use tokens, `wide:` and `desk:`.
- Sky (`#29ABE2`) never carries text, icons or thin lines on white.
- No `Date.now()`, `new Date()` or `Math.random()` in anything that can prerender. Every kit component takes `now` from its caller when it needs time.

## Plan decisions (where this plan narrows or departs from the spec; Lama to confirm at plan review)

1. **The sidebar starts at `wide:`, not `desk:`** (spec §4.1 said `desk:`, with StaffFrame's pills between). At 768px a 13rem sidebar leaves 35rem for content, and one navigation pattern for tablet and desktop is simpler. Inside a section shell, StaffFrame's pill row is hidden at every width; it still shows on `/hub/manage`, `/hub/new` and `/hub/[id]/edit`, which sit outside the three folders.
2. **Browser Back has no animation** (the spec said it crossfades). React gives Back no transition type, and mapping "no type" to a crossfade would also fade every `router.refresh()` after a form post (`done()`) and every Suspense reveal. Tabs crossfade (`nav-tab`), deeper links slide (`nav-forward`), everything else is instant.
3. **The seller bar's Messages badge waits for N2** (`sellerQueue`). N1's badges are the admin's Shops (`countWaitingShops`), Reports (`openReportCount`) and Hub (`openBookingCount`), and the mentor's Office hours (`openBookingCount`): the same counters the Overview shows, so "badge equals list" holds.
4. **The mentor bar's Export is a plain `<a download>`,** because it's a CSV route, not a page.
5. **Two more icons than the spec named:** `StoreIcon` (the Shop and Shops tabs) and `GridIcon` (Overview and Today).
6. **`Feed` takes items that already have a SAST day**, grouped by a pure helper (`groupBySastDay`); collapsing repeats stays the caller's job (spec §5.2).
7. **No separate `SegmentedLinks` component:** the spec's `SegmentedLinks` is `LinkTabs` with a new `look: "segmented"`, so there is one link-row component.
8. **The pages under More mark no tab in N1.** `/admin/hidden`, `/admin/featured` and the rest sit outside the five tabs' paths. N3 decides how the bar shows them (spec 7.2 has Hidden's current-page fix).
9. **The bar comes after the content in the page,** so "Skip to content" lands on the page, not the bar. CSS puts it at the bottom on phones and in the first grid column on tablet and up.
10. **Admins reach Mentoring through More** (a seventh row), since StaffFrame's pill row, which listed it, steps aside inside a section.
11. **The "added HTML under about 8 KB" gate starts in N2.** N1 adds no role home; it only restyles the existing seller and admin tiles.
12. **Page-level CSS ignores hidden pages:** with Cache Components, Next keeps pages you've left in the page, hidden (Activity). Every rule that reaches outside a section shell names only a showing one (`.section-shell:not([style*="display"])`), as the listing page's rules already do.

## File structure

**Create**
- `components/kit/Pill.tsx`: one pill with six tones.
- `components/kit/Card.tsx`: `Card` and `SectionHeader`.
- `components/kit/Banner.tsx`, `components/kit/EmptyState.tsx`.
- `components/kit/StatTile.tsx`: `StatTile` and `StatRow`.
- `components/kit/NeedsYouList.tsx`.
- `components/kit/ListRow.tsx`.
- `components/kit/SetupChecklist.tsx`.
- `components/kit/Feed.tsx` and `lib/kit/feed-groups.ts`.
- `components/kit/SectionBar.tsx`: the bar itself (presentational).
- `components/kit/sections.tsx`: `SellBar`, `AdminBar`, `MentorBar` (async; each reads the session and its counts).
- `components/kit/PageTransition.tsx`.
- `components/charts/StatDelta.tsx`, `Sparkline.tsx`, `BarList.tsx`, `RatioBar.tsx`, `SplitBar.tsx`, `NumbersTable.tsx`.
- `lib/charts/scale.ts`: pure maths for the charts.
- `app/sell/layout.tsx`, `app/admin/layout.tsx`, `app/mentor/layout.tsx`.
- `app/admin/more/page.tsx` and `components/staff/AdminMore.tsx`.
- `tests/e2e/role-views.spec.ts` and `tests/e2e/role-views-screenshots.spec.ts`.
- A test file next to every new component and helper (`*.test.tsx` / `*.test.ts`).
- `lib/data/badge-counts.test.ts`: each bar badge equals its list (Task 11).

**Modify**
- `app/globals.css`: tokens in `@theme`; one new block, "Role views kit (N1)", at the end of the file.
- `components/icons.tsx` and `components/icons.test.tsx`.
- `components/ui/LinkTabs.tsx`: the `"segmented"` look.
- `components/tabbar/TabBar.tsx` and its test: "You".
- `components/sell/Dashboard.tsx` and `components/staff/AdminOverview.tsx`: `StatRow` and `StatTile`.
- `lib/staff/paths.ts`: `ADMIN_MORE_PATH`.
- `vitest.setup.ts`: a no-op mock of `server-only` (Task 4).
- Every `page.tsx` under `app/admin`, `app/mentor`, `app/sell`, `app/hub/manage`, `app/hub/new` and `app/hub/[id]/edit`, plus `app/account/page.tsx` (33 files): `PageTransition`.
- `playwright.config.ts`: nothing (the new specs run in the device projects; there are no writes in N1).
- `CLAUDE.md`, `docs/reference/LANDING-DECISIONS.md`, `docs/PROGRESS.md`.

---

### Task 0: Record the JS baseline

**Files:** none changed. The output goes into this plan's "Changes made during the build" section at the end.

- [ ] **Step 1: Build and measure on a clean tree**

```bash
git status
```
Expected: only the plan and other sessions' files are untracked or modified. Nothing under `app/`, `components/` or `lib/` is changed.

```bash
pnpm build && pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Expected: all pass. Each test logs its page's bytes.

- [ ] **Step 2: Write the numbers down**

Copy each page's `scriptBrotli` value into "Changes made during the build" under "Baseline". Task 16 compares against them and records each change. The homepage should read 150,661 B (at `88ba438`). If it doesn't, write down what it reads; that is the baseline.

---

### Task 1: Tokens and icons

**Files:**
- Modify: `app/globals.css` (the `@theme` block, lines 33–48)
- Modify: `components/icons.tsx` (append after `FlagIcon`)
- Test: `components/icons.test.tsx`

- [ ] **Step 1: Update the icon test first**

In `components/icons.test.tsx`, replace the sorted list in "exports the site's icon set" with:

```ts
    expect(Object.keys(icons).sort()).toEqual([
      "AlertIcon",
      "ArrowDownIcon",
      "ArrowLeftIcon",
      "ArrowRightIcon",
      "ArrowUpIcon",
      "ArrowUpRightIcon",
      "BagIcon",
      "CalendarIcon",
      "ChartIcon",
      "CheckIcon",
      "ChevronDownIcon",
      "ChevronLeftIcon",
      "ChevronRightIcon",
      "ClockIcon",
      "CloseIcon",
      "DownloadIcon",
      "FlagIcon",
      "GridIcon",
      "HeartIcon",
      "HomeIcon",
      "InfoIcon",
      "MapPinIcon",
      "MenuIcon",
      "MessageIcon",
      "PauseIcon",
      "PlayIcon",
      "PlusIcon",
      "PlusSquareIcon",
      "SearchIcon",
      "ShareIcon",
      "ShieldIcon",
      "StoreIcon",
      "TrendingIcon",
      "UserIcon",
    ]);
```

Check the existing list first. If it has names this list lacks, keep them; the rule is "the old list plus the nine new names".

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/icons.test.tsx`
Expected: FAIL. The new names are missing.

- [ ] **Step 3: Add the nine icons** at the end of `components/icons.tsx`

```tsx
/** A rise, beside a number that went up (role views spec 5.3). */
export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

/** A fall, beside a number that went down. */
export function ArrowDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  );
}

/** Something needs attention (warning banners). */
export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  );
}

/** A note or an explanation (info banners). */
export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </Svg>
  );
}

/** Dates: events, office hours, the admin's Hub tab. */
export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}

/** A file to save: the mentor's CSV. */
export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Svg>
  );
}

/** Numbers and charts. */
export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  );
}

/** A shop: the seller's Shop tab, the admin's and mentor's Shops tabs. */
export function StoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v10h16V10" />
      <path d="M3 10 5 4h14l2 6c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3Z" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  );
}

/** An overview: the seller's Overview tab and the admin's Today. */
export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  );
}
```

- [ ] **Step 4: Add the tokens.** In `app/globals.css`'s `@theme` block, after `--color-danger: #b42318;`, add:

```css
  /* Status colours (role views spec 5.1). Each passes AA as text on white, on panel and on its own tint, and is
     always paired with an arrow, a sign or a word, never colour alone. */
  --color-success: #14663a; /* 7.02 on white, 6.15 on its tint, 6.33 on panel */
  --color-success-tint: #e3f4ea;
  --color-warning: #7a4a00; /* 7.48, 6.69, 6.74 */
  --color-warning-tint: #fdf1dc;
  --color-danger-tint: #fde7e5; /* danger on it: 5.55 */
```

After `--radius-strip: 12px;`, add:

```css
  --shadow-card: 0 1px 2px rgb(21 48 93 / 0.06), 0 1px 1px rgb(21 48 93 / 0.04);
```

In `:root` (after `--dur-slow: 400ms;`), add:

```css
  --space-card: 12px;
```

and at the end of the new CSS block (Task 2, Step 3), the `wide:` step: `@media (min-width: 48rem) and (min-height: 30rem) { :root { --space-card: 16px; } }`.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run components/icons.test.tsx && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit (controller)**

```bash
git add components/icons.tsx components/icons.test.tsx app/globals.css
git commit -m "feat(kit): status colour tokens, card shadow and spacing, nine icons (role views N1 Task 1)"
```

---

### Task 2: Pill, Card, SectionHeader, Banner, EmptyState

**Files:**
- Create: `components/kit/Pill.tsx`, `components/kit/Card.tsx`, `components/kit/Banner.tsx`, `components/kit/EmptyState.tsx`
- Test: `components/kit/basics.test.tsx`
- Modify: `app/globals.css` (start the kit block at the end of the file)

- [ ] **Step 1: Write the failing tests** in `components/kit/basics.test.tsx`

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoIcon, PlusIcon } from "@/components/icons";
import { Banner } from "./Banner";
import { Card, SectionHeader } from "./Card";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("shows its words and carries its tone for the styles", () => {
    render(<Pill tone="warning">Due</Pill>);
    const pill = screen.getByText("Due");
    expect(pill).toHaveClass("kit-pill");
    expect(pill).toHaveAttribute("data-tone", "warning");
  });
});

describe("SectionHeader", () => {
  it("is a heading at the level asked for, with its count and its link", () => {
    render(<SectionHeader title="Needs you" level={2} count={3} action={{ label: "Manage", href: "/sell/listings" }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Needs you 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/sell/listings");
  });

  it("has no link when no action is given", () => {
    render(<SectionHeader title="Your badge" level={3} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Card", () => {
  it("is a section named by its title", () => {
    render(
      <Card title="Your badge" level={2}>
        <p>12 of 15</p>
      </Card>,
    );
    const card = screen.getByRole("region", { name: "Your badge" });
    expect(within(card).getByText("12 of 15")).toBeInTheDocument();
  });

  it("is a plain block without a title", () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.querySelector("section")).toBeNull();
    expect(screen.getByText("Body")).toHaveClass("kit-card");
  });
});

describe("Banner", () => {
  it("says one sentence with at most one link", () => {
    render(
      <Banner tone="info" icon={<InfoIcon />} action={{ label: "Keep it open", href: "/account/requests" }}>
        Your request closes in 2 days.
      </Banner>,
    );
    expect(screen.getByText("Your request closes in 2 days.")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("EmptyState", () => {
  it("has a title, one line and one primary action", () => {
    render(
      <EmptyState
        icon={<PlusIcon />}
        title="Nothing available yet"
        line="Add a listing and it shows here."
        action={{ label: "New listing", href: "/sell/listings/new" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nothing available yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New listing" })).toHaveAttribute("href", "/sell/listings/new");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/kit/basics.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write the components**

`components/kit/Pill.tsx`:
```tsx
import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/**
 * One pill for every status (role views spec 5.2), in place of the styles each feature kept. "live" is solid sky with
 * navy text (sky never carries text on white). The words carry the meaning; the tone only adds to them.
 */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="kit-pill" data-tone={tone}>
      {children}
    </span>
  );
}
```

`components/kit/Card.tsx`:
```tsx
import Link from "next/link";
import { useId, type ReactNode } from "react";

type Action = { label: string; href: string };

type SectionHeaderProps = {
  title: string;
  level: 2 | 3;
  count?: number;
  action?: Action;
  id?: string;
};

/** A card's title row (spec 5.2): the heading, an optional count, an optional "Manage ›" link in sky-dark. */
export function SectionHeader({ title, level, count, action, id }: SectionHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="kit-section-header">
      <Heading id={id} className="kit-section-title">
        {title}
        {count !== undefined && <span className="kit-section-count"> {count}</span>}
      </Heading>
      {action && (
        <Link href={action.href} prefetch={false} className="kit-section-action">
          {action.label}
        </Link>
      )}
    </div>
  );
}

type CardProps = {
  title?: string;
  level?: 2 | 3;
  count?: number;
  action?: Action;
  children: ReactNode;
};

/** A white card on the panel background (spec 5.2). With a title it's a named region; without, a plain block. */
export function Card({ title, level = 2, count, action, children }: CardProps) {
  const id = useId();
  if (!title) return <div className="kit-card">{children}</div>;
  return (
    <section aria-labelledby={id} className="kit-card">
      <SectionHeader id={id} title={title} level={level} count={count} action={action} />
      {children}
    </section>
  );
}
```

`components/kit/Banner.tsx`:
```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "./Pill";

type BannerProps = {
  tone: Exclude<Tone, "live">;
  icon: ReactNode;
  children: ReactNode;
  action?: { label: string; href: string };
};

/** A tinted panel with one sentence and at most one link (spec 5.2). */
export function Banner({ tone, icon, children, action }: BannerProps) {
  return (
    <div className="kit-banner" data-tone={tone}>
      <span className="kit-banner-icon">{icon}</span>
      <p>
        {children}
        {action && (
          <>
            {" "}
            <Link href={action.href} prefetch={false}>
              {action.label}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
```

`components/kit/EmptyState.tsx`:
```tsx
import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  line: string;
  action: { label: string; href: string };
};

/** What an empty list says (spec 5.2): an icon, an action title, one line, one primary button. */
export function EmptyState({ icon, title, line, action }: EmptyStateProps) {
  return (
    <div className="kit-empty">
      <span className="kit-empty-icon">{icon}</span>
      <h3 className="kit-empty-title">{title}</h3>
      <p>{line}</p>
      <Link href={action.href} prefetch={false} className="btn btn-primary">
        {action.label}
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Start the kit CSS block** at the very end of `app/globals.css`

```css
/* --- Role views kit (N1; role views spec section 5) ------------------------------------------------------------
   Server-rendered building blocks for the role homes. Colours only from tokens; status colours always beside an
   arrow, a sign or a word. Sky only as a solid fill with navy text, or as a track beside a printed value. */
@layer components {
  .kit-card {
    display: grid;
    gap: 10px;
    padding: var(--space-card);
    border-radius: var(--radius-card);
    background: var(--color-white);
    box-shadow: var(--shadow-card);
  }

  .kit-section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .kit-section-title {
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .kit-section-count {
    color: var(--color-navy);
  }

  .kit-section-action {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
  }

  .kit-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.5;
    white-space: nowrap;
  }

  .kit-pill[data-tone="neutral"] { background: var(--color-panel); color: var(--color-ink); }
  .kit-pill[data-tone="info"] { background: var(--color-pale); color: var(--color-navy); }
  .kit-pill[data-tone="success"] { background: var(--color-success-tint); color: var(--color-success); }
  .kit-pill[data-tone="warning"] { background: var(--color-warning-tint); color: var(--color-warning); }
  .kit-pill[data-tone="danger"] { background: var(--color-danger-tint); color: var(--color-danger); }
  .kit-pill[data-tone="live"] { background: var(--color-sky); color: var(--color-navy); }

  .kit-banner {
    display: flex;
    gap: 10px;
    align-items: start;
    padding: 12px var(--space-card);
    border-radius: var(--radius-card);
  }

  .kit-banner[data-tone="neutral"] { background: var(--color-panel); color: var(--color-ink); }
  .kit-banner[data-tone="info"] { background: var(--color-pale); color: var(--color-navy); }
  .kit-banner[data-tone="success"] { background: var(--color-success-tint); color: var(--color-success); }
  .kit-banner[data-tone="warning"] { background: var(--color-warning-tint); color: var(--color-warning); }
  .kit-banner[data-tone="danger"] { background: var(--color-danger-tint); color: var(--color-danger); }

  .kit-banner a {
    color: inherit;
    font-weight: 700;
    text-decoration: underline;
  }

  .kit-banner-icon > svg {
    width: 20px;
    height: 20px;
  }

  .kit-empty {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 24px var(--space-card);
    text-align: center;
  }

  .kit-empty-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
  }

  .kit-empty-title {
    color: var(--color-navy);
    font-weight: 700;
  }
}

@media (min-width: 48rem) and (min-height: 30rem) {
  :root {
    --space-card: 16px;
  }
}
```

Later tasks append to this `@layer components` block, before the media query.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run components/kit/basics.test.tsx && pnpm lint && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit (controller)**

```bash
git add components/kit app/globals.css
git commit -m "feat(kit): Pill, Card, SectionHeader, Banner and EmptyState (role views N1 Task 2)"
```

---

### Task 3: Chart maths

**Files:**
- Create: `lib/charts/scale.ts`
- Test: `lib/charts/scale.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { barShare, isTooSmallToChart, sparkline } from "./scale";

describe("barShare", () => {
  it("is the value's share of the largest, from 0", () => {
    expect(barShare(14, 28)).toBe(0.5);
    expect(barShare(0, 28)).toBe(0);
  });
  it("is 0 when everything is 0, never NaN", () => {
    expect(barShare(0, 0)).toBe(0);
  });
  it("never goes past 1", () => {
    expect(barShare(30, 28)).toBe(1);
  });
});

describe("isTooSmallToChart", () => {
  it("writes numbers instead with fewer than 2 points", () => {
    expect(isTooSmallToChart([5])).toBe(true);
    expect(isTooSmallToChart([null, 7, null])).toBe(true);
  });
  it("writes numbers instead when the largest is 3 or under", () => {
    expect(isTooSmallToChart([1, 3, 2])).toBe(true);
  });
  it("charts 2 or more points with a largest over 3", () => {
    expect(isTooSmallToChart([1, 4])).toBe(false);
  });
});

describe("sparkline", () => {
  it("spreads the points across the width and puts the largest at the top", () => {
    const line = sparkline([0, 10], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toEqual(["2,18 98,2"]);
    expect(line.last).toEqual({ x: 98, y: 2 });
  });

  it("breaks the line at a missing day and marks both edges of the gap", () => {
    const line = sparkline([4, 8, null, 6, 2], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toHaveLength(2);
    expect(line.gapEdges).toEqual([
      { x: 26, y: 2 },
      { x: 74, y: 6 },
    ]);
  });

  it("draws a flat line along the bottom when everything is 0", () => {
    const line = sparkline([0, 0, 0], { width: 100, height: 20, pad: 2 });
    expect(line.segments).toEqual(["2,18 50,18 98,18"]);
  });

  it("has no last point when the last day is missing", () => {
    expect(sparkline([3, 5, null], { width: 100, height: 20, pad: 2 }).last).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run lib/charts/scale.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// The charts' arithmetic (role views spec 5.3), kept pure so it's tested on its own. Bars start at 0; missing values
// (null) are gaps, never zeros.

/** A bar's length as a share of the largest value, 0 to 1. */
export function barShare(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** Fewer than 2 known points, or a largest value of 3 or under: write the numbers instead of a chart (spec 5.3). */
export function isTooSmallToChart(points: readonly (number | null)[]): boolean {
  const known = points.filter((point): point is number => point !== null);
  return known.length < 2 || Math.max(...known) <= 3;
}

type Box = { width: number; height: number; pad: number };
type Point = { x: number; y: number };

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A sparkline's polyline segments in a width × height box: one segment per unbroken run of known points, the edges
 * of each gap (drawn as open circles), and the last point (drawn as a dot) when the last day is known.
 */
export function sparkline(points: readonly (number | null)[], { width, height, pad }: Box) {
  const known = points.filter((point): point is number => point !== null);
  const max = known.length ? Math.max(...known) : 0;
  const step = points.length > 1 ? (width - 2 * pad) / (points.length - 1) : 0;
  const at = (value: number, index: number): Point => ({
    x: round(pad + index * step),
    y: round(height - pad - (max > 0 ? (value / max) * (height - 2 * pad) : 0)),
  });

  const segments: string[] = [];
  const gapEdges: Point[] = [];
  let run: Point[] = [];
  points.forEach((value, index) => {
    if (value === null) {
      if (run.length) {
        gapEdges.push(run[run.length - 1]);
        segments.push(run.map((p) => `${p.x},${p.y}`).join(" "));
        run = [];
      }
      return;
    }
    const point = at(value, index);
    if (run.length === 0 && index > 0 && points[index - 1] === null) gapEdges.push(point);
    run.push(point);
  });
  if (run.length) segments.push(run.map((p) => `${p.x},${p.y}`).join(" "));

  const lastValue = points[points.length - 1];
  const last = lastValue === null || lastValue === undefined ? null : at(lastValue, points.length - 1);
  return { segments, gapEdges, last };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run lib/charts/scale.test.ts`
Expected: PASS. If the gap-edge test's numbers differ, check the arithmetic by hand: with width 100, pad 2 and 5 points, step = 24, so x = 2, 26, 50, 74, 98; max = 8, so y(8) = 2 and y(6) = 18 − 12 = 6. Fix the code, not the test.

- [ ] **Step 5: Commit (controller)**

```bash
git add lib/charts
git commit -m "feat(charts): pure chart maths, bars from 0, sparkline gaps, too-small rule (role views N1 Task 3)"
```

---

### Task 4: NumbersTable and StatDelta

**Files:**
- Modify: `vitest.setup.ts`
- Create: `components/charts/NumbersTable.tsx`, `components/charts/StatDelta.tsx`
- Test: `components/charts/StatDelta.test.tsx`

- [ ] **Step 0: Let tests import server-only modules.** The `server-only` package's default export throws outside a server build (`node_modules/server-only/package.json`), and today tests mock it file by file (`lib/supabase/env.test.ts:4-5`). Every chart imports it, and so, through `StatDelta` and `RatioBar`, do `StatTile`, `SetupChecklist` and the two dashboards after Task 15. In `vitest.setup.ts`, beside the `next/navigation` mock, add:

```ts
// The role views charts import "server-only", whose default export throws outside a server build. Tests render them
// directly, so it's a no-op here (role views N1 plan, Task 4).
vi.mock("server-only", () => ({}));
```

Run: `pnpm vitest run lib/supabase/env.test.ts`
Expected: PASS (its own mock still works beside the global one).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumbersTable } from "./NumbersTable";
import { StatDelta } from "./StatDelta";

describe("StatDelta", () => {
  // getByText matches an element's own text only, and the arrow is in a child span, so these read the whole text.
  it("says a rise in words, with an arrow and a sign", () => {
    const { container } = render(<StatDelta now={9} previous={6} />);
    expect(container.querySelector(".stat-delta")).toHaveTextContent("↑ 3 on last week");
  });

  it("says a fall", () => {
    const { container } = render(<StatDelta now={4} previous={5} />);
    expect(container.querySelector(".stat-delta")).toHaveTextContent("↓ 1 on last week");
  });

  it("says when nothing changed", () => {
    render(<StatDelta now={4} previous={4} />);
    expect(screen.getByText("Same as last week")).toBeInTheDocument();
  });

  it("can't compare when either side is masked or missing", () => {
    const { rerender } = render(<StatDelta now="under5" previous={7} />);
    expect(screen.getByText("Can't compare")).toBeInTheDocument();
    rerender(<StatDelta now={7} previous="hidden" />);
    expect(screen.getByText("Can't compare")).toBeInTheDocument();
    rerender(<StatDelta now={7} previous={null} />);
    expect(screen.getByText("Can't compare")).toBeInTheDocument();
  });

  it("names the period it compares with", () => {
    const { container } = render(<StatDelta now={9} previous={6} period="the 14 days before" />);
    expect(container.querySelector(".stat-delta")).toHaveTextContent("↑ 3 on the 14 days before");
  });
});

describe("NumbersTable", () => {
  it("is a captioned table inside a Show the numbers disclosure", () => {
    render(<NumbersTable caption="Enquiries by day" rows={[["Mon", "2"], ["Tue", "Hidden"]]} headers={["Day", "Enquiries"]} />);
    expect(screen.getByText("Show the numbers")).toBeInTheDocument();
    // Closed <details>: its content is in the page but not exposed until opened, hence hidden: true.
    expect(screen.getByRole("table", { name: "Enquiries by day", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Hidden", hidden: true })).toBeInTheDocument();
  });
});
```

The arrow glyph in the expected text is the visible icon's text alternative (`sr-only`), so the whole sentence reads the same with or without the icon.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/charts/StatDelta.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`components/charts/NumbersTable.tsx`:
```tsx
import "server-only";

type NumbersTableProps = {
  caption: string;
  headers: readonly [string, string];
  rows: readonly (readonly [string, string])[];
};

/** A chart's numbers as a table, closed by default (role views spec 5.3): exact values for anyone who wants them. */
export function NumbersTable({ caption, headers, rows }: NumbersTableProps) {
  return (
    <details className="chart-numbers">
      <summary>Show the numbers</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
```

`components/charts/StatDelta.tsx`:
```tsx
import "server-only";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";

export type CountValue = number | "hidden" | "under5" | null;

type StatDeltaProps = {
  now: CountValue;
  previous: CountValue;
  /** What it's compared with, as the sentence says it. */
  period?: string;
};

/**
 * The change against the period before (role views spec 5.3): an arrow, a signed number and words, so the colour is
 * never the only signal. A masked or missing side can't be compared (protectCounts).
 */
export function StatDelta({ now, previous, period = "last week" }: StatDeltaProps) {
  if (typeof now !== "number" || typeof previous !== "number") {
    return <span className="stat-delta" data-trend="none">Can&apos;t compare</span>;
  }
  const change = now - previous;
  if (change === 0) return <span className="stat-delta" data-trend="flat">Same as {period}</span>;
  const up = change > 0;
  return (
    <span className="stat-delta" data-trend={up ? "up" : "down"}>
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      <span className="sr-only">{up ? "↑" : "↓"}</span> {Math.abs(change)} on {period}
    </span>
  );
}
```

Append to the kit CSS block:

```css
  .stat-delta {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 600;
  }

  .stat-delta > svg {
    width: 14px;
    height: 14px;
  }

  .stat-delta[data-trend="up"] { color: var(--color-success); }
  .stat-delta[data-trend="down"] { color: var(--color-danger); }
  .stat-delta:is([data-trend="flat"], [data-trend="none"]) { color: var(--color-muted); }

  .chart-numbers summary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
    cursor: pointer;
  }

  .chart-numbers table {
    width: 100%;
    font-size: 14px;
    border-collapse: collapse;
  }

  .chart-numbers :is(th, td) {
    padding: 6px 0;
    border-top: 1px solid var(--color-line);
    text-align: left;
  }

  .chart-numbers td {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/charts/StatDelta.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add vitest.setup.ts components/charts app/globals.css
git commit -m "feat(charts): StatDelta in words with arrows, never colour alone; Show the numbers table (role views N1 Task 4)"
```

---

### Task 5: StatTile and StatRow

**Files:**
- Create: `components/kit/StatTile.tsx`
- Test: `components/kit/StatTile.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatRow, StatTile } from "./StatTile";

describe("StatTile", () => {
  it("shows a label and a big number", () => {
    render(<StatTile label="Enquiries" value={9} />);
    expect(screen.getByText("Enquiries")).toBeInTheDocument();
    expect(screen.getByText("9")).toHaveClass("stat-tile-value");
  });

  it("is one link when it has an href, named by its label and number", () => {
    render(<StatTile label="Enquiries" value={9} href="/messages?tab=selling" />);
    expect(screen.getByRole("link", { name: /Enquiries\s*9/ })).toHaveAttribute("href", "/messages?tab=selling");
  });

  it("writes masked counts as words, never as 0", () => {
    const { rerender } = render(<StatTile label="Reports" value="under5" />);
    expect(screen.getByText("Under 5")).toBeInTheDocument();
    rerender(<StatTile label="Reports" value="hidden" />);
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("shows the delta and a footer when given", () => {
    render(<StatTile label="Sales" value={4} delta={{ previous: 4 }} footer={<a href="/x">Review</a>} />);
    expect(screen.getByText("Same as last week")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toBeInTheDocument();
  });
});

describe("StatRow", () => {
  it("is a list of tiles", () => {
    render(
      <StatRow label="This week">
        <StatTile label="Enquiries" value={9} />
        <StatTile label="Sales" value={4} />
      </StatRow>,
    );
    const list = screen.getByRole("list", { name: "This week" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/kit/StatTile.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import Link from "next/link";
import { Children, type ReactNode } from "react";
import { StatDelta, type CountValue } from "@/components/charts/StatDelta";

type StatTileProps = {
  label: string;
  value: Exclude<CountValue, null>;
  /** The period before, for the change line; omit for no change line. */
  delta?: { previous: CountValue; period?: string };
  /** The whole tile links here. */
  href?: string;
  /** A line under the tile (a tile without href may carry its own link). */
  footer?: ReactNode;
};

const shown = (value: StatTileProps["value"]) =>
  value === "hidden" ? "Hidden" : value === "under5" ? "Under 5" : value.toLocaleString("en-ZA");

/** A number with its label (role views spec 5.2), replacing .sell-numbers and .staff-counts. */
export function StatTile({ label, value, delta, href, footer }: StatTileProps) {
  const body = (
    <>
      <span className="stat-tile-label">{label}</span>{" "}
      <span className="stat-tile-value" data-masked={typeof value === "number" ? undefined : ""}>
        {shown(value)}
      </span>
      {delta && <StatDelta now={value} previous={delta.previous} period={delta.period} />}
    </>
  );
  return (
    <div className="stat-tile">
      {href ? (
        <Link href={href} prefetch={false} transitionTypes={["nav-forward"]} className="stat-tile-link">
          {body}
        </Link>
      ) : (
        body
      )}
      {footer}
    </div>
  );
}

/** Tiles side by side: three to a row on phones (spec 5.2). */
export function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="stat-row">
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}
```

`StatDelta` imports `server-only`, and `StatTile` is a server component too, which is fine. `StatTile` must never be imported from a `"use client"` file; Task 16's grep checks this.

Append to the CSS block:

```css
  .stat-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: 8px;
  }

  .stat-tile {
    display: grid;
    align-content: start;
    gap: 4px;
    padding: 10px;
    border-radius: var(--radius-strip);
    background: var(--color-white);
    box-shadow: var(--shadow-card);
  }

  .stat-tile-link {
    display: grid;
    gap: 4px;
    min-height: 44px;
    color: inherit;
  }

  .stat-tile-label {
    color: var(--color-muted);
    font-size: 13px;
  }

  .stat-tile-value {
    color: var(--color-navy);
    font-family: var(--vos-font-display);
    font-size: 28px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .stat-tile-value[data-masked] {
    font-family: var(--vos-font-text);
    font-size: 16px;
    font-weight: 700;
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/kit/StatTile.test.tsx && pnpm typecheck`
Expected: PASS. `transitionTypes` is typed on `Link` (`next/dist/client/app-dir/link.d.ts:183`).

- [ ] **Step 5: Commit (controller)**

```bash
git add components/kit/StatTile.tsx components/kit/StatTile.test.tsx app/globals.css
git commit -m "feat(kit): StatTile and StatRow with masked counts as words (role views N1 Task 5)"
```

---

### Task 6: NeedsYouList

**Files:**
- Create: `components/kit/NeedsYouList.tsx`
- Test: `components/kit/NeedsYouList.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NeedsYouList } from "./NeedsYouList";

const items = [
  { key: "replies", count: 2, title: "Buyers waiting for a reply", detail: "Oldest: Desk lamp", age: { label: "31h", tone: "warning" as const }, href: "/messages?tab=selling", urgent: true },
  { key: "drafts", count: 0, title: "Drafts ready to publish", href: "/sell/listings?tab=drafts" },
  { key: "sold", count: 1, title: "Sales to mark as sold", href: "/messages/c-1" },
];

describe("NeedsYouList", () => {
  it("lists only the items with something waiting, each one link", () => {
    render(<NeedsYouList label="Needs you" items={items} allClear="All clear" />);
    const list = screen.getByRole("list", { name: "Needs you" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/messages?tab=selling");
    expect(links[0]).toHaveAccessibleName(/2\s*Buyers waiting for a reply\s*Oldest: Desk lamp\s*31h/);
  });

  it("marks urgent counts and age tones for the styles", () => {
    render(<NeedsYouList label="Needs you" items={items} allClear="All clear" />);
    expect(screen.getByText("2")).toHaveAttribute("data-urgent");
    expect(screen.getByText("31h")).toHaveAttribute("data-tone", "warning");
  });

  it("says All clear when nothing is waiting", () => {
    render(<NeedsYouList label="Needs you" items={items.map((item) => ({ ...item, count: 0 }))} allClear="All clear" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("All clear")).toBeInTheDocument();
  });

  it("keeps a zero row when asked to", () => {
    render(
      <NeedsYouList
        label="Waiting"
        items={[{ key: "hidden", count: 0, title: "Hidden by the Hub", href: "/admin/hidden", keepWhenZero: true }, items[0]]}
        allClear="All clear"
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/kit/NeedsYouList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import Link from "next/link";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import type { Tone } from "./Pill";

export type NeedsYouItem = {
  key: string;
  count: number;
  title: string;
  detail?: string;
  /** How long the oldest has waited, worked out by the caller at request time in SAST. */
  age?: { label: string; tone: Extract<Tone, "info" | "warning" | "danger"> };
  href: string;
  /** Navy count: someone is waiting on you. Otherwise pale. */
  urgent?: boolean;
  /** Show the row at 0 too (the admin's Hidden). */
  keepWhenZero?: boolean;
};

type NeedsYouListProps = { label: string; items: readonly NeedsYouItem[]; allClear: string };

/**
 * What needs this person now, most urgent first as the caller orders it (role views spec 5.2). Each row is one link
 * that goes deeper (nav-forward). With nothing waiting, one "All clear" line.
 */
export function NeedsYouList({ label, items, allClear }: NeedsYouListProps) {
  const shown = items.filter((item) => item.count > 0 || item.keepWhenZero);
  if (shown.every((item) => item.count === 0)) {
    return (
      <p className="needs-clear">
        <CheckIcon /> {allClear}
      </p>
    );
  }
  return (
    <ul aria-label={label} className="needs-list">
      {shown.map((item) => (
        <li key={item.key}>
          <Link href={item.href} prefetch={false} transitionTypes={["nav-forward"]} className="needs-row">
            <span className="needs-count" data-urgent={item.urgent ? "" : undefined}>
              {item.count > 99 ? "99+" : item.count}
            </span>
            <span className="needs-text">
              <span className="needs-title">{item.title}</span>{" "}
              {item.detail && <span className="needs-detail">{item.detail}</span>}
            </span>
            {item.age && (
              <span className="needs-age" data-tone={item.age.tone}>
                {item.age.label}
              </span>
            )}
            <ChevronRightIcon className="needs-chevron" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

Append to the CSS block:

```css
  .needs-list {
    display: grid;
  }

  .needs-list li + li {
    border-top: 1px solid var(--color-line);
  }

  .needs-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding-block: 8px;
    color: var(--color-ink);
  }

  .needs-count {
    display: grid;
    flex: none;
    place-items: center;
    min-width: 28px;
    height: 28px;
    padding-inline: 6px;
    border-radius: 999px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .needs-count[data-urgent] {
    background: var(--color-navy);
    color: var(--color-white);
  }

  .needs-text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .needs-title {
    font-weight: 600;
  }

  .needs-detail {
    overflow: hidden;
    color: var(--color-muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .needs-age {
    flex: none;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
  }

  .needs-age[data-tone="info"] { background: var(--color-pale); color: var(--color-navy); }
  .needs-age[data-tone="warning"] { background: var(--color-warning-tint); color: var(--color-warning); }
  .needs-age[data-tone="danger"] { background: var(--color-danger-tint); color: var(--color-danger); }

  .needs-chevron {
    flex: none;
    width: 18px;
    height: 18px;
    color: var(--color-muted);
  }

  .needs-clear {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--color-success);
    font-weight: 600;
  }

  .needs-clear > svg {
    width: 20px;
    height: 20px;
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/kit/NeedsYouList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/kit/NeedsYouList.tsx components/kit/NeedsYouList.test.tsx app/globals.css
git commit -m "feat(kit): NeedsYouList, one link per waiting item with age chips, All clear at zero (role views N1 Task 6)"
```

---

### Task 7: ListRow and the segmented look

**Files:**
- Create: `components/kit/ListRow.tsx`
- Modify: `components/ui/LinkTabs.tsx`
- Test: `components/kit/ListRow.test.tsx`, plus a case in `components/ui/LinkTabs.test.tsx` (create the file if it doesn't exist)

- [ ] **Step 1: Write the failing tests**

`components/kit/ListRow.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListRow } from "./ListRow";
import { Pill } from "./Pill";

describe("ListRow", () => {
  it("is one link holding the lead, title, detail, pill and meta", () => {
    render(
      <ul>
        <ListRow
          href="/mentor/tech-corner"
          lead={{ kind: "initials", text: "Tech corner" }}
          title="Tech corner"
          detail="No enquiries in 14 days"
          pill={<Pill tone="danger">Quiet</Pill>}
          meta="Midrand"
        />
      </ul>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/mentor/tech-corner");
    expect(link).toHaveAccessibleName(/Tech corner\s*No enquiries in 14 days\s*Quiet\s*Midrand/);
    expect(screen.getByText("TC")).toHaveAttribute("aria-hidden", "true");
  });
});
```

Add to `components/ui/LinkTabs.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkTabs } from "./LinkTabs";

describe("LinkTabs, segmented", () => {
  it("styles the row as a segmented control and marks the open view", () => {
    render(
      <LinkTabs
        label="Shops"
        look="segmented"
        current="needs"
        tabs={[
          { key: "needs", label: "Needs you (2)", href: "/mentor" },
          { key: "all", label: "All (6)", href: "/mentor?view=all" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Shops" })).toHaveClass("link-segments");
    expect(screen.getByRole("link", { name: "Needs you (2)" })).toHaveAttribute("aria-current", "page");
  });
});
```

If `LinkTabs.test.tsx` already exists, add only the `describe` block and merge the imports.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/kit/ListRow.test.tsx components/ui/LinkTabs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`components/kit/ListRow.tsx`:
```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";

type Lead =
  | { kind: "initials"; text: string }
  | { kind: "icon"; icon: ReactNode }
  | { kind: "thumb"; node: ReactNode };

type ListRowProps = {
  href: string;
  lead: Lead;
  title: string;
  detail?: string;
  pill?: ReactNode;
  meta?: string;
};

/** "Tech corner" → "TC"; one word → its first two letters. */
export function initialsOf(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** A row in a list (role views spec 5.2): one link, at least 56px tall, that goes deeper. Render it inside a <ul>. */
export function ListRow({ href, lead, title, detail, pill, meta }: ListRowProps) {
  return (
    <li>
      <Link href={href} prefetch={false} transitionTypes={["nav-forward"]} className="list-row">
        <span className="list-row-lead" aria-hidden="true">
          {lead.kind === "initials" ? initialsOf(lead.text) : lead.kind === "icon" ? lead.icon : lead.node}
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{title}</span>{" "}
          {detail && <span className="list-row-detail">{detail}</span>}
        </span>
        {pill}
        {meta && <span className="list-row-meta">{meta}</span>}
        <ChevronRightIcon className="needs-chevron" />
      </Link>
    </li>
  );
}
```

In `components/ui/LinkTabs.tsx`, change the `look` type and the class choice:

```tsx
  /** "chips": pills, the board's (plan decision 7). "tabs": browse's underlined tabs, the Hub's. "segmented": 2 to 4
   * views as one control (role views spec 5.2). */
  look: "chips" | "tabs" | "segmented";
```

```tsx
export function LinkTabs({ label, tabs, current, look }: LinkTabsProps) {
  const navClass = { chips: "link-chips", tabs: "category-tabs", segmented: "link-segments" }[look];
  const linkClass = { chips: "link-chip", tabs: "category-tab", segmented: "link-segment" }[look];
  return (
    <nav aria-label={label} className={navClass}>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              prefetch={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={linkClass}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Remove the old `const chips = look === "chips";` line.

Append to the CSS block:

```css
  .list-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding-block: 8px;
    color: var(--color-ink);
  }

  :is(ul, ol) > li + li > .list-row {
    border-top: 1px solid var(--color-line);
  }

  .list-row-lead {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border-radius: 10px;
    background: var(--color-pale);
    color: var(--color-navy);
    font-size: 13px;
    font-weight: 700;
  }

  .list-row-text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .list-row-title {
    font-weight: 600;
  }

  .list-row-detail {
    color: var(--color-muted);
    font-size: 13px;
  }

  .list-row-meta {
    flex: none;
    color: var(--color-muted);
    font-size: 13px;
  }

  .link-segments ul {
    display: flex;
    gap: 3px;
    padding: 3px;
    border-radius: var(--radius-strip);
    background: var(--color-panel);
  }

  .link-segments li {
    flex: 1;
  }

  .link-segment {
    display: grid;
    place-items: center;
    min-height: 44px;
    padding-inline: 8px;
    border-radius: 9px;
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
    text-align: center;
  }

  .link-segment[aria-current] {
    background: var(--color-white);
    box-shadow: var(--shadow-card);
    color: var(--color-navy);
    font-weight: 700;
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/kit/ListRow.test.tsx components/ui/LinkTabs.test.tsx && pnpm vitest run components/ui`
Expected: PASS, and existing `LinkTabs` users are unchanged.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/kit/ListRow.tsx components/kit/ListRow.test.tsx components/ui/LinkTabs.tsx components/ui/LinkTabs.test.tsx app/globals.css
git commit -m "feat(kit): ListRow and LinkTabs' segmented look (role views N1 Task 7)"
```

---

### Task 8: Sparkline and BarList

**Files:**
- Create: `components/charts/Sparkline.tsx`, `components/charts/BarList.tsx`
- Test: `components/charts/Sparkline.test.tsx`, `components/charts/BarList.test.tsx`

- [ ] **Step 1: Write the failing tests**

`components/charts/Sparkline.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

describe("Sparkline", () => {
  it("is a figure named by its takeaway, with the last value in text and the numbers in a table", () => {
    const { container } = render(
      <Sparkline points={[1, 3, 2, 5, 4, 7, 2]} labels={days} label="Enquiries, last 7 days" summary="24 enquiries this week, 2 today" />,
    );
    const figure = screen.getByRole("img", { name: "24 enquiries this week, 2 today" });
    expect(figure.tagName).toBe("FIGURE");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    expect(screen.getByText("Show the numbers")).toBeInTheDocument();
  });

  it("breaks at a missing day", () => {
    const { container } = render(
      <Sparkline points={[4, 8, null, 6, 5, 7, 9]} labels={days} label="Enquiries" summary="Up this week" />,
    );
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "No data", hidden: true })).toBeInTheDocument();
  });

  it("writes the summary instead of a chart when there's too little to draw", () => {
    const { container } = render(<Sparkline points={[0, 1, 0]} labels={["a", "b", "c"]} label="Enquiries" summary="1 enquiry this week" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector(".chart-summary")).toHaveTextContent("1 enquiry this week (a: 0, b: 1, c: 0)");
  });
});
```

`components/charts/BarList.test.tsx`:
```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarList } from "./BarList";

const rows = [
  { label: "Midrand", value: 28, href: "/admin/numbers?campus=midrand" },
  { label: "Pretoria", value: 19 },
  { label: "Durban", value: "hidden" as const },
  { label: "Cape Town", value: "under5" as const },
];

describe("BarList", () => {
  it("prints every value as text, masked ones as words", () => {
    render(<BarList rows={rows} label="Listings by campus" summary="Midrand listed the most" />);
    const figure = screen.getByRole("img", { name: "Midrand listed the most" });
    expect(within(figure).getByText("28")).toBeInTheDocument();
    expect(within(figure).getAllByText("Hidden").length).toBeGreaterThan(0);
    expect(within(figure).getAllByText("Under 5").length).toBeGreaterThan(0);
  });

  it("sizes bars from 0 against the largest and hatches masked rows", () => {
    const { container } = render(<BarList rows={rows} label="Listings" summary="s" />);
    const bars = container.querySelectorAll<HTMLElement>(".bar-fill");
    expect(bars[0].style.getPropertyValue("--v")).toBe("1");
    expect(bars[1].style.getPropertyValue("--v")).toBe("0.679");
    expect(container.querySelectorAll(".bar-masked")).toHaveLength(2);
  });

  it("makes a row with an href a link", () => {
    render(<BarList rows={rows} label="Listings" summary="s" />);
    expect(screen.getByRole("link", { name: /Midrand/ })).toHaveAttribute("href", "/admin/numbers?campus=midrand");
  });
});
```

The figure has `role="img"`, which hides its children from the accessibility tree. So the tests use `within(figure).getByText` (DOM text), and the link test uses the `NumbersTable` row link, which sits outside the figure (see the implementation).

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/charts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`components/charts/Sparkline.tsx`:
```tsx
import "server-only";
import { isTooSmallToChart, sparkline } from "@/lib/charts/scale";
import { NumbersTable } from "./NumbersTable";

type SparklineProps = {
  points: readonly (number | null)[];
  /** One label per point, for the numbers table ("Mon", "12 Oct"). */
  labels: readonly string[];
  /** What the numbers are, as the table's caption. */
  label: string;
  /** The takeaway, one sentence: the figure's name and its visible caption. */
  summary: string;
};

const BOX = { width: 120, height: 32, pad: 3 };

/** A day-by-day trend (role views spec 5.3): a 2px navy line, gaps for missing days, the last value in text. */
export function Sparkline({ points, labels, label, summary }: SparklineProps) {
  if (isTooSmallToChart(points)) {
    // Too little to draw: the takeaway and the values themselves, in words (spec 5.3).
    const values = points.map((point, index) => `${labels[index] ?? index + 1}: ${point ?? "no data"}`).join(", ");
    return (
      <p className="chart-summary">
        {summary} <span className="chart-values">({values})</span>
      </p>
    );
  }
  const line = sparkline(points, BOX);
  const last = points[points.length - 1];
  return (
    <div className="chart">
      <figure role="img" aria-label={summary} className="sparkline">
        <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} preserveAspectRatio="none" aria-hidden="true">
          {line.segments.map((segment) => (
            <polyline key={segment} points={segment} className="sparkline-line" />
          ))}
          {line.gapEdges.map((edge) => (
            <circle key={`${edge.x}-${edge.y}`} cx={edge.x} cy={edge.y} r={2.5} className="sparkline-gap" />
          ))}
          {line.last && <circle cx={line.last.x} cy={line.last.y} r={3} className="sparkline-dot" />}
        </svg>
        {typeof last === "number" && <span className="sparkline-last">{last}</span>}
        <figcaption className="chart-summary">{summary}</figcaption>
      </figure>
      <NumbersTable
        caption={label}
        headers={["Day", label]}
        rows={points.map((point, index) => [labels[index] ?? String(index + 1), point === null ? "No data" : String(point)])}
      />
    </div>
  );
}
```

`components/charts/BarList.tsx`:
```tsx
import "server-only";
import Link from "next/link";
import type { CSSProperties } from "react";
import { barShare } from "@/lib/charts/scale";
import { NumbersTable } from "./NumbersTable";

export type BarRow = { label: string; value: number | "hidden" | "under5"; href?: string };

type BarListProps = {
  rows: readonly BarRow[];
  label: string;
  summary: string;
  /** The numbers table's first column, e.g. "Campus" or "Shop". */
  rowHeader?: string;
  /** A shared scale for small multiples; defaults to the largest value here. */
  max?: number;
};

const words = (value: BarRow["value"]) =>
  value === "hidden" ? "Hidden" : value === "under5" ? "Under 5" : value.toLocaleString("en-ZA");

/**
 * Horizontal bars with the value printed at the end (role views spec 5.3). Bars start at 0. A masked value is a
 * hatched outline with its word, never a bar of 0 (protectCounts). Rows with an href are links in the table below,
 * because a figure with role="img" hides what's inside it.
 */
export function BarList({ rows, label, summary, rowHeader = "Item", max: sharedMax }: BarListProps) {
  const max = sharedMax ?? Math.max(0, ...rows.map((row) => (typeof row.value === "number" ? row.value : 0)));
  return (
    <div className="chart">
      <figure role="img" aria-label={summary} className="bar-list">
        {rows.map((row) => (
          <div key={row.label} className="bar-row">
            <span className="bar-label">{row.label}</span>
            {typeof row.value === "number" ? (
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ "--v": String(Math.round(barShare(row.value, max) * 1000) / 1000) } as CSSProperties}
                />
              </span>
            ) : (
              <span className="bar-masked" />
            )}
            <span className="bar-value">{words(row.value)}</span>
          </div>
        ))}
        <figcaption className="chart-summary">{summary}</figcaption>
      </figure>
      {rows.some((row) => row.href) && (
        <ul className="bar-links">
          {rows
            .filter((row) => row.href)
            .map((row) => (
              <li key={row.label}>
                <Link href={row.href!} prefetch={false} transitionTypes={["nav-forward"]}>
                  {row.label}: {words(row.value)}
                </Link>
              </li>
            ))}
        </ul>
      )}
      <NumbersTable caption={label} headers={[rowHeader, label]} rows={rows.map((row) => [row.label, words(row.value)])} />
    </div>
  );
}
```

Check the second bar's expected value: 19 / 28 = 0.6786 → rounded to 3 places → 0.679. ✓

Append to the CSS block:

```css
  .chart {
    display: grid;
    gap: 6px;
  }

  .chart-summary {
    color: var(--color-muted);
    font-size: 13px;
  }

  .sparkline {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 10px;
  }

  .sparkline svg {
    width: 100%;
    height: 32px;
  }

  .sparkline .chart-summary {
    grid-column: 1 / -1;
  }

  .sparkline-line {
    fill: none;
    stroke: var(--color-navy);
    stroke-width: 2px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .sparkline-dot {
    fill: var(--color-navy);
  }

  .sparkline-gap {
    fill: var(--color-white);
    stroke: var(--color-navy);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .sparkline-last {
    color: var(--color-navy);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .bar-list {
    display: grid;
    gap: 6px;
  }

  .bar-row {
    display: grid;
    grid-template-columns: minmax(5rem, 7.5rem) minmax(0, 1fr) 3.5rem;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    font-size: 14px;
  }

  .bar-track {
    height: 12px;
    border-radius: 3px;
    background: var(--color-panel);
  }

  .bar-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--color-navy);
    transform: scaleX(var(--v));
    transform-origin: left;
  }

  /* A masked value: dashed muted outline (5.3:1 on white) over a hatch, with its word printed beside it. */
  .bar-masked {
    height: 12px;
    border: 1.5px dashed var(--color-muted);
    border-radius: 3px;
    background: repeating-linear-gradient(45deg, transparent 0 4px, var(--color-panel) 4px 7px);
  }

  .bar-value {
    color: var(--color-ink);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .bar-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
  }

  .bar-links a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-sky-dark);
    font-weight: 600;
  }
```

`transform: scaleX` draws the bar length with no layout change and isn't animated, so the motion rule holds.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/charts`
Expected: PASS. In jsdom, `style.getPropertyValue("--v")` reads custom properties set through React's style object; if it returns "", read `getAttribute("style")` and match `--v:1` instead, and note it in "Changes made during the build".

- [ ] **Step 5: Commit (controller)**

```bash
git add components/charts lib/charts app/globals.css
git commit -m "feat(charts): Sparkline with gaps and BarList with masked rows hatched, both server-only (role views N1 Task 8)"
```

---

### Task 9: RatioBar, SplitBar, SetupChecklist and Feed

**Files:**
- Create: `components/charts/RatioBar.tsx`, `components/charts/SplitBar.tsx`, `components/kit/SetupChecklist.tsx`, `components/kit/Feed.tsx`, `lib/kit/feed-groups.ts`
- Test: `components/charts/RatioBar.test.tsx`, `components/kit/SetupChecklist.test.tsx`, `lib/kit/feed-groups.test.ts`

- [ ] **Step 1: Write the failing tests**

`components/charts/RatioBar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatioBar } from "./RatioBar";
import { SplitBar } from "./SplitBar";

describe("RatioBar", () => {
  it("is a meter with its value in words", () => {
    render(<RatioBar done={12} total={15} target={0.9} label="Replied within 48 hours" />);
    const meter = screen.getByRole("meter", { name: "Replied within 48 hours" });
    expect(meter).toHaveAttribute("aria-valuenow", "12");
    expect(meter).toHaveAttribute("aria-valuemax", "15");
    expect(meter).toHaveAttribute("aria-valuetext", "12 of 15");
    expect(screen.getByText("12 of 15")).toBeInTheDocument();
  });

  it("says None due yet with nothing to count, and draws no bar", () => {
    const { container } = render(<RatioBar done={0} total={0} label="Replied within 48 hours" />);
    expect(screen.getByText("None due yet")).toBeInTheDocument();
    expect(container.querySelector("[role=meter]")).toBeNull();
  });
});

describe("SplitBar", () => {
  it("labels every part with its count in reading order, no legend", () => {
    render(
      <SplitBar
        label="Your listings"
        parts={[
          { label: "available", value: 8, tone: "navy" },
          { label: "paused", value: 2, tone: "sky-dark" },
          { label: "sold", value: 5, tone: "muted" },
          { label: "drafts", value: 0, tone: "idle" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Your listings: 8 available, 2 paused, 5 sold, 0 drafts" })).toBeInTheDocument();
  });
});
```

`components/kit/SetupChecklist.test.tsx`:
```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetupChecklist } from "./SetupChecklist";

const steps = [
  { label: "Add a shop photo", done: true, href: "/sell/profile" },
  { label: "Add your first listing", done: false, href: "/sell/listings/new" },
  { label: "Reply to a buyer", done: false, href: "/messages?tab=selling" },
];

describe("SetupChecklist", () => {
  it("counts what's done and offers the next step as the main button", () => {
    render(<SetupChecklist title="Get your shop going" steps={steps} />);
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Add your first listing" })).toHaveClass("btn-primary");
  });

  it("marks done steps in words, not only with a tick", () => {
    render(<SetupChecklist title="Get your shop going" steps={steps} />);
    expect(screen.getByText("Done:", { exact: false })).toBeInTheDocument();
  });
});
```

`lib/kit/feed-groups.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { groupBySastDay } from "./feed-groups";

// 2026-10-22 10:00 SAST.
const now = new Date("2026-10-22T08:00:00Z");

describe("groupBySastDay", () => {
  it("groups by SAST day into Today, Yesterday and This week, then Earlier, newest first", () => {
    const groups = groupBySastDay(
      [
        { id: "a", at: "2026-10-22T06:00:00Z" },
        { id: "b", at: "2026-10-21T21:59:00Z" }, // 23:59 SAST on the 21st
        { id: "c", at: "2026-10-21T22:01:00Z" }, // 00:01 SAST on the 22nd
        { id: "d", at: "2026-10-18T10:00:00Z" },
        { id: "e", at: "2026-10-01T10:00:00Z" },
      ],
      now,
    );
    expect(groups.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ["Today", ["a", "c"]],
      ["Yesterday", ["b"]],
      ["This week", ["d"]],
      ["Earlier", ["e"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupBySastDay([{ id: "a", at: "2026-10-22T06:00:00Z" }], now).map((group) => group.label)).toEqual(["Today"]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/charts/RatioBar.test.tsx components/kit/SetupChecklist.test.tsx lib/kit`
Expected: FAIL.

- [ ] **Step 3: Implement**

`components/charts/RatioBar.tsx`:
```tsx
import "server-only";
import type { CSSProperties } from "react";
import { barShare } from "@/lib/charts/scale";

type RatioBarProps = {
  done: number;
  total: number;
  /** The goal as a share, 0 to 1, drawn as a navy tick. */
  target?: number;
  label: string;
};

/** "12 of 15" as a bar (role views spec 5.3): sky-dark fill (4.7:1) on a panel track, an optional navy target tick. */
export function RatioBar({ done, total, target, label }: RatioBarProps) {
  if (total === 0) return <p className="ratio-words">None due yet</p>;
  const words = `${done} of ${total}`;
  return (
    <div className="ratio">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={words}
        className="ratio-track"
      >
        <span className="ratio-fill" style={{ "--v": String(barShare(done, total)) } as CSSProperties} />
        {target !== undefined && <span className="ratio-target" style={{ "--t": String(target) } as CSSProperties} />}
      </div>
      <p className="ratio-words">{words}</p>
    </div>
  );
}
```

`components/charts/SplitBar.tsx`:
```tsx
import "server-only";

type Part = { label: string; value: number; tone: "navy" | "sky-dark" | "muted" | "idle" };

/**
 * One stacked bar (role views spec 5.3), for the seller's listing states only. 2px white gaps keep neighbours apart
 * (navy beside sky-dark is 2.8:1); the counts are written underneath in reading order, with no legend.
 */
export function SplitBar({ label, parts }: { label: string; parts: readonly Part[] }) {
  const name = `${label}: ${parts.map((part) => `${part.value} ${part.label}`).join(", ")}`;
  return (
    <figure role="img" aria-label={name} className="split">
      <div className="split-bar">
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <span key={part.label} data-tone={part.tone} style={{ flexGrow: part.value }} />
          ))}
      </div>
      <figcaption className="split-labels">
        {parts.map((part) => (
          <span key={part.label}>
            <b>{part.value}</b> {part.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
```

`lib/kit/feed-groups.ts`:
```ts
import { sastDate } from "@/lib/time";

export type FeedGroupLabel = "Today" | "Yesterday" | "This week" | "Earlier";

const DAY_MS = 86_400_000;

/**
 * Items grouped by their SAST day (role views spec 5.2): Today, Yesterday, the 5 days before that as This week, then
 * Earlier; newest first within each; empty groups left out. `now` comes from the caller, at request time.
 */
export function groupBySastDay<T extends { at: string }>(items: readonly T[], now: Date) {
  const today = sastDate(now);
  const yesterday = sastDate(new Date(now.getTime() - DAY_MS));
  const weekStart = sastDate(new Date(now.getTime() - 6 * DAY_MS));
  const labelOf = (iso: string): FeedGroupLabel => {
    const day = sastDate(new Date(iso));
    if (day === today) return "Today";
    if (day === yesterday) return "Yesterday";
    return day >= weekStart ? "This week" : "Earlier";
  };
  const order: FeedGroupLabel[] = ["Today", "Yesterday", "This week", "Earlier"];
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return order
    .map((label) => ({ label, items: sorted.filter((item) => labelOf(item.at) === label) }))
    .filter((group) => group.items.length > 0);
}
```

Check `sastDate(now)` in `lib/time.ts:12`: it returns `YYYY-MM-DD` for a `Date`, so string comparison orders days.

`components/kit/Feed.tsx`:
```tsx
import type { ReactNode } from "react";
import { groupBySastDay } from "@/lib/kit/feed-groups";

type FeedItem = { id: string; at: string; content: ReactNode };

/** A feed grouped by SAST day (role views spec 5.2). Callers collapse repeats before passing items. */
export function Feed({ label, items, now }: { label: string; items: readonly FeedItem[]; now: Date }) {
  return (
    <div aria-label={label} role="group" className="feed">
      {groupBySastDay(items, now).map((group) => (
        <section key={group.label} aria-label={group.label} className="feed-group">
          <h3 className="kit-section-title">{group.label}</h3>
          <ul className="feed-items">
            {group.items.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`components/kit/SetupChecklist.tsx`:
```tsx
import Link from "next/link";
import { RatioBar } from "@/components/charts/RatioBar";
import { CheckIcon } from "@/components/icons";

type Step = { label: string; done: boolean; href: string };

/**
 * A new shop's first steps (role views spec 5.2): "2 of 5 done", a bar, the steps, and the next one as the main
 * button. Every step completes itself from data; nothing is stored.
 */
export function SetupChecklist({ title, steps }: { title: string; steps: readonly Step[] }) {
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  return (
    <section aria-label={title} className="kit-card setup">
      <h2 className="kit-section-title">{title}</h2>
      <p className="setup-count">
        {done} of {steps.length} done
      </p>
      <RatioBar done={done} total={steps.length} label={title} />
      <ol className="setup-steps">
        {steps.map((step) => (
          <li key={step.label} data-done={step.done ? "" : undefined}>
            {step.done ? (
              <>
                <CheckIcon /> <span className="sr-only">Done: </span>
                {step.label}
              </>
            ) : step === next ? (
              <Link href={step.href} prefetch={false} className="btn btn-primary">
                {step.label}
              </Link>
            ) : (
              <Link href={step.href} prefetch={false}>
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

Append to the CSS block:

```css
  .ratio {
    display: grid;
    gap: 4px;
  }

  .ratio-track {
    position: relative;
    height: 8px;
    border-radius: 999px;
    background: var(--color-panel);
  }

  .ratio-fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--color-sky-dark);
    transform: scaleX(var(--v));
    transform-origin: left;
  }

  .ratio-target {
    position: absolute;
    top: -4px;
    bottom: -4px;
    left: calc(var(--t) * 100%);
    width: 2px;
    background: var(--color-navy);
  }

  .ratio-words {
    color: var(--color-ink);
    font-size: 14px;
    font-weight: 600;
  }

  .split-bar {
    display: flex;
    gap: 2px;
    height: 10px;
  }

  .split-bar span {
    border-radius: 3px;
  }

  .split-bar [data-tone="navy"] { background: var(--color-navy); }
  .split-bar [data-tone="sky-dark"] { background: var(--color-sky-dark); }
  .split-bar [data-tone="muted"] { background: var(--color-muted); }
  .split-bar [data-tone="idle"] {
    background: repeating-linear-gradient(45deg, var(--color-idle) 0 3px, var(--color-white) 3px 6px);
  }

  .split-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 6px;
    color: var(--color-muted);
    font-size: 13px;
  }

  .split-labels b {
    color: var(--color-ink);
  }

  .setup-count {
    color: var(--color-navy);
    font-weight: 700;
  }

  .setup-steps {
    display: grid;
    gap: 8px;
  }

  .setup-steps li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .setup-steps li[data-done] {
    color: var(--color-muted);
  }

  .setup-steps li > svg {
    width: 18px;
    height: 18px;
    color: var(--color-success);
  }

  .feed {
    display: grid;
    gap: 12px;
  }

  .feed-items {
    display: grid;
  }

  .feed-items li + li {
    border-top: 1px solid var(--color-line);
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/charts components/kit lib/kit lib/charts`
Expected: PASS.

- [ ] **Step 5: Commit (controller)**

```bash
git add components/charts components/kit lib/kit app/globals.css
git commit -m "feat(kit): RatioBar as a meter, SplitBar with counts in words, SetupChecklist, Feed by SAST day (role views N1 Task 9)"
```

---

### Task 10: SectionBar

**Files:**
- Create: `components/kit/SectionBar.tsx`
- Test: `components/kit/SectionBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadIcon, GridIcon, HomeIcon, StoreIcon } from "@/components/icons";
import { SectionBar } from "./SectionBar";

const tabs = [
  { key: "overview", href: "/", label: "Overview", icon: <GridIcon /> },
  { key: "shops", href: "/admin/sellers", label: "Shops", icon: <StoreIcon />, match: "section" as const, badge: { count: 3, words: "shops waiting" } },
  { key: "export", href: "/mentor/export", label: "Export", icon: <DownloadIcon />, download: true },
  { key: "exit", href: "/", label: "CampusCart", icon: <HomeIcon />, exit: true },
];

describe("SectionBar", () => {
  it("is a named navigation with one link per tab, in order", () => {
    render(<SectionBar label="Hub console" tabs={tabs} />);
    const bar = screen.getByRole("navigation", { name: "Hub console" });
    expect(bar).toHaveClass("section-bar");
    expect(within(bar).getAllByRole("link").map((link) => link.textContent?.replace(/\d+.*$/, "").trim())).toEqual([
      "Overview",
      "Shops",
      "Export",
      "CampusCart",
    ]);
  });

  it("describes a badge in words without changing the tab's name", () => {
    render(<SectionBar label="Hub console" tabs={tabs} />);
    const shops = screen.getByRole("link", { name: "Shops" });
    expect(shops).toHaveAccessibleDescription("3 shops waiting");
  });

  it("caps a badge at 99+", () => {
    render(<SectionBar label="x" tabs={[{ ...tabs[1], badge: { count: 140, words: "shops waiting" } }]} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows no badge for 0 or a failed count", () => {
    render(<SectionBar label="x" tabs={[{ ...tabs[1], badge: { count: 0, words: "w" } }, { ...tabs[0], key: "b", badge: null }]} />);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("makes Export a plain download link", () => {
    render(<SectionBar label="x" tabs={tabs} />);
    expect(screen.getByRole("link", { name: "Export" })).toHaveAttribute("download");
  });

  it("marks the current page (the tests' page is /)", () => {
    render(<SectionBar label="x" tabs={tabs} />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run components/kit/SectionBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import type { CSSProperties, ReactNode } from "react";
import { NavLink } from "@/components/ui/NavLink";

export type SectionTab = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** "section" also marks the pages under href, as the main bar's Shop and Sell do. */
  match?: "section";
  /** Only a tab whose route has no client component may prefetch (decision 53); everything else passes false. */
  prefetch?: false;
  /** A file, not a page: a plain <a download> (the mentor's CSV). */
  download?: boolean;
  /** Back to the main app: no tab transition, the page changes completely. */
  exit?: boolean;
  /** From the same reader as the list it opens (role views spec 4.2). null: the count failed, so no badge. */
  badge?: { count: number; words: string } | null;
};

/**
 * A section's own bar (role views spec 4.1): fixed to the bottom on phones in place of the main tab bar (the CSS hides
 * the main bar while this one is on the page), a sidebar from the tablet step. Server-rendered; the only client code
 * is NavLink, already in every page's layout chunk.
 */
export function SectionBar({ label, tabs }: { label: string; tabs: readonly SectionTab[] }) {
  return (
    <nav aria-label={label} className="section-bar">
      <ul style={{ "--tabs": tabs.length } as CSSProperties}>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <SectionLink tab={tab} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionLink({ tab }: { tab: SectionTab }) {
  const badgeId = `section-badge-${tab.key}`;
  const badge = tab.badge && tab.badge.count > 0 ? tab.badge : null;
  const inside = (
    <>
      <span className="section-tab-icon">{tab.icon}</span>
      <span className="section-tab-label">{tab.label}</span>
      {badge && (
        <span id={badgeId} className="hdr-badge hdr-badge-alert" aria-hidden="true">
          {badge.count > 99 ? "99+" : badge.count} <span className="sr-only">{badge.words}</span>
        </span>
      )}
    </>
  );
  if (tab.download) {
    return (
      <a href={tab.href} download className="section-tab" aria-describedby={badge ? badgeId : undefined}>
        {inside}
      </a>
    );
  }
  return (
    <NavLink
      href={tab.href}
      match={tab.match}
      prefetch={tab.prefetch}
      transitionTypes={tab.exit ? undefined : ["nav-tab"]}
      className="section-tab"
      aria-describedby={badge ? badgeId : undefined}
    >
      {inside}
    </NavLink>
  );
}
```

`aria-hidden` on the badge keeps it out of the link's name, and `aria-describedby` still reads its text: this is the pattern `AccountTab` uses, and Testing Library's `toHaveAccessibleDescription` follows it.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run components/kit/SectionBar.test.tsx`
Expected: PASS. If the accessible description reads "3 shops waiting" with extra spaces, normalise in the assertion with a regex (`/3\s+shops waiting/`).

- [ ] **Step 5: Commit (controller)**

```bash
git add components/kit/SectionBar.tsx components/kit/SectionBar.test.tsx
git commit -m "feat(kit): SectionBar, badges described in words and capped at 99+, Export as a download (role views N1 Task 10)"
```

---

### Task 11: The three bars and their layouts

**Files:**
- Create: `components/kit/sections.tsx`, `components/kit/sections.test.tsx`
- Create: `app/sell/layout.tsx`, `app/admin/layout.tsx`, `app/mentor/layout.tsx`
- Modify: `lib/staff/paths.ts` (add `ADMIN_MORE_PATH`)
- Modify: `app/globals.css` (bar and sidebar CSS, hide the main bar, slim footer, hide StaffFrame's pills inside a shell)

- [ ] **Step 1: Add the path.** In `lib/staff/paths.ts`, after `ADMIN_HIDDEN_PATH`:

```ts
/** The admin bar's More (role views spec 4.1): everything the five tabs don't hold. */
export const ADMIN_MORE_PATH = "/admin/more";
```

- [ ] **Step 2: Write the failing tests** in `components/kit/sections.test.tsx`

```tsx
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBar, MentorBar, SellBar } from "./sections";

const viewer = vi.hoisted(() => ({ account: null as { id: string; roles: string[] } | null }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

const shop = vi.hoisted(() => ({ own: null as { status: string } | null }));
vi.mock("@/lib/data/shops", () => ({ getShopOf: async () => shop.own }));

const counts = vi.hoisted(() => ({ waiting: 3, reports: 2, slots: 1, failing: false }));
vi.mock("@/lib/data/staff-shops", () => ({
  countWaitingShops: async () => {
    if (counts.failing) throw new Error("down");
    return counts.waiting;
  },
}));
vi.mock("@/lib/data/staff-reports", () => ({ openReportCount: async () => counts.reports }));
vi.mock("@/lib/data/hub-posts", () => ({ openBookingCount: async () => counts.slots }));

afterEach(() => {
  viewer.account = null;
  shop.own = null;
  counts.failing = false;
});

const labels = (nav: HTMLElement) =>
  within(nav).getAllByRole("link").map((link) => link.querySelector(".section-tab-label")?.textContent);

describe("SellBar", () => {
  it("shows nothing to a visitor or a student without a shop: the main bar stays", async () => {
    const { container } = render(await SellBar());
    expect(container).toBeEmptyDOMElement();
    viewer.account = { id: "a", roles: [] };
    const second = render(await SellBar());
    expect(second.container).toBeEmptyDOMElement();
  });

  it("gives an open shop Overview, Listings, Messages, Shop and CampusCart", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "approved" };
    render(await SellBar());
    const bar = screen.getByRole("navigation", { name: "Selling" });
    expect(labels(bar)).toEqual(["Overview", "Listings", "Messages", "Shop", "CampusCart"]);
    expect(within(bar).getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages?tab=selling");
  });

  it("gives a waiting shop no Messages tab", async () => {
    viewer.account = { id: "a", roles: [] };
    shop.own = { status: "pending" };
    render(await SellBar());
    expect(labels(screen.getByRole("navigation", { name: "Selling" }))).toEqual(["Overview", "Listings", "Shop", "CampusCart"]);
  });
});

describe("AdminBar", () => {
  it("shows nothing without the admin role", async () => {
    viewer.account = { id: "m", roles: ["mentor"] };
    const { container } = render(await AdminBar());
    expect(container).toBeEmptyDOMElement();
  });

  it("gives an admin Today, Shops, Reports, Hub and More, with the Overview's counts as badges", async () => {
    viewer.account = { id: "x", roles: ["admin"] };
    render(await AdminBar());
    const bar = screen.getByRole("navigation", { name: "Hub console" });
    expect(labels(bar)).toEqual(["Today", "Shops", "Reports", "Hub", "More"]);
    expect(within(bar).getByRole("link", { name: "Shops" })).toHaveAccessibleDescription(/3\s+shops waiting/);
    expect(within(bar).getByRole("link", { name: "Reports" })).toHaveAccessibleDescription(/2\s+open reports/);
    expect(within(bar).getByRole("link", { name: "Hub" })).toHaveAccessibleDescription(/1\s+slot request waiting/);
  });

  it("drops a badge whose count failed, never guesses", async () => {
    viewer.account = { id: "x", roles: ["admin"] };
    counts.failing = true;
    render(await AdminBar());
    expect(screen.getByRole("link", { name: "Shops" })).not.toHaveAttribute("aria-describedby");
  });
});

describe("MentorBar", () => {
  it("gives a mentor Shops, Office hours, Posts, Export and CampusCart", async () => {
    viewer.account = { id: "m", roles: ["mentor"] };
    render(await MentorBar());
    const bar = screen.getByRole("navigation", { name: "Mentoring" });
    expect(labels(bar)).toEqual(["Shops", "Office hours", "Posts", "Export", "CampusCart"]);
    expect(within(bar).getByRole("link", { name: "Export" })).toHaveAttribute("download");
  });

  it("shows nothing to a student", async () => {
    viewer.account = { id: "s", roles: [] };
    const { container } = render(await MentorBar());
    expect(container).toBeEmptyDOMElement();
  });
});
```

Check the real shop status values in `lib/types.ts` (`OwnShop["status"]`) before running. If "approved" isn't one of them, use the live value (the dashboard's `own.status === "paused"` and `"pending"` are known) and update both the test and `SellBar`.

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run components/kit/sections.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement** `components/kit/sections.tsx`

```tsx
import {
  BagIcon,
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  FlagIcon,
  GridIcon,
  HomeIcon,
  MenuIcon,
  MessageIcon,
  PlusSquareIcon,
  StoreIcon,
} from "@/components/icons";
import { getViewer } from "@/lib/auth/session";
import { openBookingCount } from "@/lib/data/hub-posts";
import { getShopOf } from "@/lib/data/shops";
import { openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import {
  ADMIN_MORE_PATH,
  ADMIN_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_SELLERS_PATH,
  HUB_MANAGE_PATH,
  MENTOR_EXPORT_PATH,
  MENTOR_PATH,
} from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
import { SectionBar, type SectionTab } from "./SectionBar";

// The three sections' bars (role views spec 4.1). Each reads the session itself, inside the layout's <Suspense>, and
// renders nothing for anyone the section isn't for, so the main bar stays (spec 8). Request-time.

const EXIT: SectionTab = { key: "exit", href: "/", label: "CampusCart", icon: <HomeIcon />, exit: true };

/** A count, or null when it failed: a failed badge shows nothing (spec 4.2). */
const orNull = (count: Promise<number>) => count.catch(() => null);

function badge(count: number | null, one: string, many: string): SectionTab["badge"] {
  return count === null ? null : { count, words: count === 1 ? one : many };
}

/** Selling: only for an account that has a shop. A pending shop (waiting, or declined: still "pending" with the Hub's
 * reason, SellHome.tsx) has no Messages yet. */
export async function SellBar() {
  const account = await getViewer().catch(() => null);
  if (!account) return null;
  const own = await getShopOf(account.id).catch(() => null);
  if (!own) return null;
  const open = own.status !== "pending";
  const tabs: SectionTab[] = [
    { key: "overview", href: "/sell", label: "Overview", icon: <GridIcon /> },
    { key: "listings", href: "/sell/listings", label: "Listings", icon: <BagIcon />, match: "section", prefetch: false },
    ...(open
      ? [{ key: "messages", href: "/messages?tab=selling", label: "Messages", icon: <MessageIcon />, prefetch: false } as const]
      : []),
    { key: "shop", href: "/sell/profile", label: "Shop", icon: <StoreIcon />, prefetch: false },
    EXIT,
  ];
  return <SectionBar label="Selling" tabs={tabs} />;
}

/** The Hub console: admins only. Badges from the same counters the Overview shows (plan decision 3). */
export async function AdminBar() {
  const account = await getViewer().catch(() => null);
  if (!canUse(account, "admin")) return null;
  const [waiting, reports, slots] = await Promise.all([
    orNull(countWaitingShops()),
    orNull(openReportCount()),
    orNull(openBookingCount()),
  ]);
  const tabs: SectionTab[] = [
    { key: "today", href: ADMIN_PATH, label: "Today", icon: <GridIcon />, prefetch: false },
    {
      key: "shops",
      href: ADMIN_SELLERS_PATH,
      label: "Shops",
      icon: <StoreIcon />,
      match: "section",
      prefetch: false,
      badge: badge(waiting, "shop waiting", "shops waiting"),
    },
    {
      key: "reports",
      href: ADMIN_REPORTS_PATH,
      label: "Reports",
      icon: <FlagIcon />,
      match: "section",
      prefetch: false,
      badge: badge(reports, "open report", "open reports"),
    },
    {
      key: "hub",
      href: HUB_MANAGE_PATH,
      label: "Hub",
      icon: <CalendarIcon />,
      prefetch: false,
      badge: badge(slots, "slot request waiting", "slot requests waiting"),
    },
    { key: "more", href: ADMIN_MORE_PATH, label: "More", icon: <MenuIcon />, prefetch: false },
  ];
  return <SectionBar label="Hub console" tabs={tabs} />;
}

/** Mentoring: mentors and admins (staff tools spec 2.1). */
export async function MentorBar() {
  const account = await getViewer().catch(() => null);
  if (!canUse(account, "mentor")) return null;
  const slots = await orNull(openBookingCount());
  const tabs: SectionTab[] = [
    { key: "shops", href: MENTOR_PATH, label: "Shops", icon: <StoreIcon />, match: "section", prefetch: false },
    {
      key: "office-hours",
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      label: "Office hours",
      icon: <ClockIcon />,
      prefetch: false,
      badge: badge(slots, "slot request waiting", "slot requests waiting"),
    },
    { key: "posts", href: HUB_MANAGE_PATH, label: "Posts", icon: <PlusSquareIcon />, prefetch: false },
    { key: "export", href: MENTOR_EXPORT_PATH, label: "Export", icon: <DownloadIcon />, download: true },
    EXIT,
  ];
  return <SectionBar label="Mentoring" tabs={tabs} />;
}
```

`/sell` itself keeps prefetch (the header already prefetches it, and it has no client component: CLAUDE.md). The Today tab doesn't prefetch, because staff links never do.

- [ ] **Step 5: The layouts**

`app/sell/layout.tsx`:
```tsx
import { Suspense } from "react";
import { SellBar } from "@/components/kit/sections";

/**
 * The selling section's frame (role views spec 4.1): the Selling bar for an account with a shop, in place of the main
 * bar; nothing for anyone else. Streams in: the bar reads the session.
 */
export default function SellLayout({ children }: LayoutProps<"/sell">) {
  return (
    <div className="section-shell">
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <SellBar />
      </Suspense>
    </div>
  );
}
```

`app/admin/layout.tsx`:
```tsx
import { Suspense } from "react";
import { AdminBar } from "@/components/kit/sections";

/** The Hub console's frame (role views spec 4.1): the admin bar, only for admins. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="section-shell">
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <AdminBar />
      </Suspense>
    </div>
  );
}
```

`app/mentor/layout.tsx`:
```tsx
import { Suspense } from "react";
import { MentorBar } from "@/components/kit/sections";

/** Mentoring's frame (role views spec 4.1): the mentor bar, for mentors and admins. */
export default function MentorLayout({ children }: LayoutProps<"/mentor">) {
  return (
    <div className="section-shell">
      <div className="section-main">{children}</div>
      {/* After the content, so "Skip to content" doesn't land before the bar; CSS places it. */}
      <Suspense fallback={null}>
        <MentorBar />
      </Suspense>
    </div>
  );
}
```

A `null` fallback is right here: the bar is fixed or beside the content, so its arrival shifts nothing on phones. On tablet and up, the sidebar column is reserved by `.section-shell`'s grid whether or not the bar has arrived (CSS below), so nothing moves. Task 16's layout-shift check proves it.

- [ ] **Step 6: The CSS.** Append to the kit block (inside `@layer components`):

```css
  /* --- Section bars (role views spec 4.1) --- */
  .section-bar {
    display: none;
  }

  .section-tab {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 56px;
    color: var(--color-muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    -webkit-tap-highlight-color: transparent;
  }

  .section-tab:focus-visible {
    outline-offset: -4px;
  }

  .section-tab-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 30px;
    border-radius: 999px;
  }

  .section-tab-icon > svg {
    width: 22px;
    height: 22px;
  }

  /* Five tabs at 360px are about 72px each: one line, cut with an ellipsis rather than wrapping. */
  .section-tab-label {
    max-width: 100%;
    overflow: hidden;
    padding-inline: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-tab[aria-current] {
    color: var(--color-navy);
  }

  .section-tab[aria-current] .section-tab-icon {
    background: var(--color-pale);
  }

  .section-tab .hdr-badge {
    top: 3px;
    right: auto;
    left: calc(50% + 8px);
  }
```

After the `@layer components { … }` block closes (before the `--space-card` media query), add the width-dependent rules:

```css
/* Phones: the section bar replaces the main tab bar at the bottom. Where :has isn't supported both show, the section
   bar above, both usable (role views spec 4.1). */
@media not all and (min-width: 48rem) and (min-height: 30rem) {
  .section-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 31;
    display: block;
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    border-top: 1px solid var(--color-line);
    background: var(--color-white);
  }

  .section-bar ul {
    display: grid;
    grid-template-columns: repeat(var(--tabs), 1fr);
    max-width: 32rem;
    margin-inline: auto;
  }

  /* Next keeps pages you've left in the page, hidden with an inline display style (Activity:
     node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md), so every page-level rule names only a
     shell that is showing, as .listing-page:not([style*="display"]) already does (globals.css ~5021). */
  body:has(.section-shell:not([style*="display"]) > .section-bar) .tabbar {
    display: none;
  }

  body:has(:is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="file"]), textarea):focus)
    .section-bar {
    display: none;
  }
}

/* Tablet and up: a sticky sidebar beside the page column (plan decision 1). The column is reserved before the bar
   streams in, so nothing moves when it arrives. */
@media (min-width: 48rem) and (min-height: 30rem) {
  .section-shell:has(.section-bar),
  .section-shell[data-bar] {
    display: grid;
    grid-template-columns: 13rem minmax(0, 1fr);
    align-items: start;
    max-width: var(--container-page);
    margin-inline: auto;
  }

  .section-main {
    grid-column: 2;
    grid-row: 1;
  }

  .section-bar {
    grid-column: 1;
    grid-row: 1;
    position: sticky;
    top: 88px;
    display: block;
    padding: 16px 8px;
  }

  .section-bar ul {
    display: grid;
    gap: 2px;
  }

  .section-tab {
    flex-direction: row;
    justify-content: start;
    gap: 10px;
    height: 44px;
    padding-inline: 8px;
    border-radius: 10px;
    font-size: 15px;
  }

  .section-tab-icon {
    width: 28px;
    height: 28px;
    background: none;
  }

  .section-tab[aria-current] {
    background: var(--color-pale);
  }

  .section-tab[aria-current] .section-tab-icon {
    background: none;
  }

  .section-tab .hdr-badge {
    position: static;
    margin-left: auto;
  }
}

/* Inside a section the bar is the navigation: StaffFrame's pill row steps aside (plan decision 1). */
.section-shell:has(.section-bar) .staff-nav {
  display: none;
}

/* The slim footer on section pages (role views spec 4.1): the legal links and the campus line stay. */
body:has(.section-shell:not([style*="display"]) > .section-bar) :is(.footer-giants, .footer-grid, .footer-wordmark) {
  display: none;
}
```

Every rule that reaches outside the shell uses `body:has(.section-shell:not([style*="display"]) > .section-bar)`, never a bare `body:has(.section-bar)`. A hidden, kept page's bar would otherwise keep the main bar hidden after Exit. Rules scoped inside the shell (`.section-shell:has(.section-bar) …`) are safe as they are, because a hidden shell hides everything inside it.

The `:has(.section-bar)` grid only applies once the bar is on the page. For signed-out visitors and students on the pitch, the sell shell stays a plain block, so `/sell`'s pitch layout doesn't change. On tablet and up, the sidebar column appears when the bar streams in. Task 16 must measure this at 768 and 1440px on `/admin`, `/mentor` and `/sell` (as the seller).
- If an admin or mentor page reaches 0.05, set `data-bar` on those two shells and measure again. They are staff-only routes, so the column is always right, except that the staff 404 view then has an empty 13rem column; note that.
- `data-bar` can't apply to `/sell`, because signed-out visitors and students see the pitch there. If `/sell` reaches 0.05, stop and report to the controller.

Write down which way each went.

- [ ] **Step 6b: Badge equals list** (spec 4.2 and 9). Create `lib/data/badge-counts.test.ts`. It runs on the sample store; the contract tests already hold the two backends to the same answers for each reader.

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { listBookings, openBookingCount } from "./hub-posts";
import { listReports, openReportCount } from "./staff-reports";
import { countWaitingShops, listShopsForReview } from "./staff-shops";
import { resetSampleStore } from "./store";

// Each section bar's badge comes from a counter; the list the tab opens comes from a reader. They must agree, or the
// badge says a number the list doesn't show (role views spec 4.2).
beforeEach(() => {
  resetSampleStore();
});

describe("a bar's badge equals the list it opens", () => {
  it("Shops: waiting shops", async () => {
    const waiting = (await listShopsForReview()).filter((shop) => shop.standing === "waiting");
    expect(await countWaitingShops()).toBe(waiting.length);
  });

  it("Reports: open reports", async () => {
    const open = (await listReports()).filter((report) => report.open);
    expect(await openReportCount()).toBe(open.length);
  });

  it("Hub and Office hours: open slot requests", async () => {
    const open = (await listBookings()).filter((booking) => booking.status === "open");
    expect(await openBookingCount()).toBe(open.length);
  });
});
```

Check `ShopStanding`'s waiting value in `lib/data/staff-shops.ts` (`standingOf(...) === "waiting"` at line 130) and `BookingStatus`'s open value (`"open"`, `lib/data/hub-posts.ts:305`). The sample fixtures should give at least one of each. If a list is empty in the fixtures, add a row in the test (as `lib/data/staff-reports.test.ts` does with its `report()` helper) so the test can fail.

Run: `pnpm vitest run lib/data/badge-counts.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the tests and check the build**

Run: `pnpm vitest run components/kit lib/data/badge-counts.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS, clean.

Run: `pnpm build`
Expected: passes. The route list shows `/sell`, `/admin` and `/mentor` with the same render mode as before (partial prerender). No route turns fully dynamic.

- [ ] **Step 8: Commit (controller)**

```bash
git add components/kit/sections.tsx components/kit/sections.test.tsx lib/data/badge-counts.test.ts app/sell/layout.tsx app/admin/layout.tsx app/mentor/layout.tsx lib/staff/paths.ts app/globals.css
git commit -m "feat: section bars for selling, the Hub console and mentoring, a sidebar from the tablet step, the slim footer (role views N1 Task 11)"
```

---

### Task 12: /admin/more

**Files:**
- Create: `components/staff/AdminMore.tsx`, `components/staff/AdminMore.test.tsx`, `app/admin/more/page.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminMore } from "./AdminMore";

describe("AdminMore", () => {
  it("lists the console's other sections as rows, with the hidden count", () => {
    render(<AdminMore hidden={{ listings: 3, requests: 1 }} />);
    const list = screen.getByRole("list", { name: "More tools" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/hidden",
      "/admin/featured",
      "/admin/pickup-points",
      "/admin/staff",
      "/admin/numbers",
      "/admin/audit",
      "/mentor",
    ]);
    expect(links[0]).toHaveAccessibleName(/Hidden by the Hub\s*4 hidden now/);
  });

  it("says Nothing hidden at 0", () => {
    render(<AdminMore hidden={{ listings: 0, requests: 0 }} />);
    expect(screen.getByRole("link", { name: /Hidden by the Hub\s*Nothing hidden/ })).toBeInTheDocument();
  });
});
```

`countHidden()` returns `{ listings, requests }` (`lib/data/staff-reports.ts:351`), so `AdminMore` takes that shape and sums it. Admins also keep a way into Mentoring: StaffFrame's pills (which listed it) are hidden inside a section shell, so More has a seventh row for it.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/staff/AdminMore.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`components/staff/AdminMore.tsx`:
```tsx
import { ChartIcon, ClockIcon, FlagIcon, MapPinIcon, ShieldIcon, StoreIcon, TrendingIcon } from "@/components/icons";
import { ListRow } from "@/components/kit/ListRow";
import {
  ADMIN_AUDIT_PATH,
  ADMIN_FEATURED_PATH,
  ADMIN_HIDDEN_PATH,
  ADMIN_NUMBERS_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_STAFF_PATH,
  MENTOR_PATH,
} from "@/lib/staff/paths";

/** The admin bar's More (role views spec 4.1): the sections the five tabs don't hold, as rows. */
export function AdminMore({ hidden }: { hidden: { listings: number; requests: number } }) {
  const total = hidden.listings + hidden.requests;
  return (
    <ul aria-label="More tools" className="kit-card">
      <ListRow
        href={ADMIN_HIDDEN_PATH}
        lead={{ kind: "icon", icon: <FlagIcon /> }}
        title="Hidden by the Hub"
        detail={total === 0 ? "Nothing hidden" : `${total} hidden now`}
      />
      <ListRow href={ADMIN_FEATURED_PATH} lead={{ kind: "icon", icon: <TrendingIcon /> }} title="Featured" detail="Pin sellers to a campus" />
      <ListRow href={ADMIN_POINTS_PATH} lead={{ kind: "icon", icon: <MapPinIcon /> }} title="Pickup points" detail="Each campus's meeting places" />
      <ListRow href={ADMIN_STAFF_PATH} lead={{ kind: "icon", icon: <ShieldIcon /> }} title="Staff accounts" detail="Who has a role" />
      <ListRow href={ADMIN_NUMBERS_PATH} lead={{ kind: "icon", icon: <ChartIcon /> }} title="Numbers" detail="Last week, by campus" />
      <ListRow href={ADMIN_AUDIT_PATH} lead={{ kind: "icon", icon: <ClockIcon /> }} title="Audit log" detail="Every staff action" />
      <ListRow href={MENTOR_PATH} lead={{ kind: "icon", icon: <StoreIcon /> }} title="Mentoring" detail="Shops you mentor" />
    </ul>
  );
}
```

`app/admin/more/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminMore } from "@/components/staff/AdminMore";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { countHidden } from "@/lib/data/staff-reports";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { ADMIN_MORE_PATH } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "More tools");
}

/** More (role views spec 4.1): admins only, the 404 for everyone else, like every staff page. */
export default function AdminMorePage() {
  return (
    <Suspense fallback={<StaffSkeleton short />}>
      <More />
    </Suspense>
  );
}

async function More() {
  const account = await requireStaff("admin", ADMIN_MORE_PATH);
  const hidden = await countHidden();
  return (
    <StaffFrame account={account} area="Admin console" title="More tools" current={ADMIN_MORE_PATH} notice={null}>
      <AdminMore hidden={hidden} />
    </StaffFrame>
  );
}
```

Every admin page's eyebrow says "Admin console" (`app/admin/hidden/page.tsx:33`); the bar's label "Hub console" is the navigation's name only.

- [ ] **Step 4: Run the tests and the folder check**

Run: `pnpm vitest run components/staff/AdminMore.test.tsx lib/selling`
Expected: PASS, including the `RESERVED_SLUGS` folder test (`more` is not beside any `[slug]` in the folders it reads).

- [ ] **Step 5: Commit (controller)**

```bash
git add components/staff/AdminMore.tsx components/staff/AdminMore.test.tsx app/admin/more
git commit -m "feat(admin): More tools, the console's other sections as rows (role views N1 Task 12)"
```

---

### Task 13: Page transitions and press feedback

**Files:**
- Create: `components/kit/PageTransition.tsx`, `components/kit/PageTransition.test.tsx`
- Modify: the 25 staff `page.tsx` files, the 7 `app/sell/**/page.tsx` files and `app/account/page.tsx` (listed in Step 3)
- Modify: `app/globals.css`

Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` (Steps 2 and 3 of the guide) first.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTransition } from "./PageTransition";

describe("PageTransition", () => {
  it("renders its page unchanged (the animation is the browser's, during navigations only)", () => {
    render(
      <PageTransition>
        <h1>Today</h1>
      </PageTransition>,
    );
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

`components/kit/PageTransition.tsx`:
```tsx
import { ViewTransition, type ReactNode } from "react";

// Only typed navigations animate (plan decision 2): section tabs carry "nav-tab" (a crossfade), links one level deeper
// carry "nav-forward" (a short slide). Back, refreshes and Suspense reveals have no type, so they don't animate.
const BY_TYPE = { "nav-tab": "nav-tab", "nav-forward": "nav-forward", default: "none" } as const;

/** Wraps a page's content (role views spec 4.4). Goes in the page, never a layout: layouts don't remount. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={BY_TYPE} exit={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  );
}
```

- [ ] **Step 3: Wrap the pages**

The wrapper goes in each page file, **outside** the page's `<Suspense>`, never in `StaffFrame`. StaffFrame renders inside the Suspense, after the role check, so it mounts as a Suspense reveal (no transition type, no animation). The page's static shell, the skeleton, is what a navigation swaps in, so that is where the wrapper must sit.

In every `app/admin/**/page.tsx`, `app/mentor/**/page.tsx`, `app/hub/manage/page.tsx`, `app/hub/new/page.tsx` and `app/hub/[id]/edit/page.tsx`, change

```tsx
    <Suspense fallback={<StaffSkeleton />}>
```

to

```tsx
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
```

and close it with `</PageTransition>` after `</Suspense>` (keep whatever fallback each page has, `short` included). The files (25): the 20 `page.tsx` files under `app/admin` (`find app/admin -name page.tsx` lists them, `more` included), `app/mentor/page.tsx`, `app/mentor/[slug]/page.tsx`, `app/hub/manage/page.tsx`, `app/hub/new/page.tsx` and `app/hub/[id]/edit/page.tsx`.

For the 7 selling pages (`app/sell/page.tsx`, `app/sell/onboarding/page.tsx`, `app/sell/profile/page.tsx`, `app/sell/listings/page.tsx`, `app/sell/listings/new/page.tsx`, `app/sell/listings/[id]/edit/page.tsx`, `app/sell/listings/[id]/delete/page.tsx`) and `app/account/page.tsx`, wrap the outermost returned element the same way. For example, `app/sell/page.tsx` becomes:

```tsx
export default function SellPage() {
  return (
    <PageTransition>
      <div className="page sell-page">
        <Suspense fallback={<SellSkeleton />}>
          <SellHome />
        </Suspense>
      </div>
    </PageTransition>
  );
}
```

33 page files in all. Check the count with `find app/admin app/mentor app/sell app/hub/manage app/hub/new "app/hub/[id]/edit" -name page.tsx | wc -l`: 32 once Task 12 has added `app/admin/more` (31 before it), plus `app/account/page.tsx`.

- [ ] **Step 4: The CSS.** Append after the section-bar media blocks:

```css
/* --- Page transitions (role views spec 4.4): opacity and transform only, no blur, no size animation --- */
::view-transition {
  pointer-events: none;
}

/* The header and both bars never move. */
.site-header { view-transition-name: site-header; }
.tabbar { view-transition-name: main-tabbar; }
.section-bar { view-transition-name: section-bar; }

::view-transition-group(site-header),
::view-transition-group(main-tabbar),
::view-transition-group(section-bar),
::view-transition-old(site-header),
::view-transition-new(site-header),
::view-transition-old(main-tabbar),
::view-transition-new(main-tabbar),
::view-transition-old(section-bar),
::view-transition-new(section-bar) {
  animation: none;
}

/* The browser's own root crossfade stays off: only the typed page wrappers animate (plan decision 2). */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}

/* Typed animations exist only when motion is wanted, so reduced motion and data saver get an instant swap with no
   !important (globals.css asks that nothing else uses it on animation properties). */
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-low-data])::view-transition-old(.nav-tab) {
    animation: 120ms var(--ease-out) both vt-fade reverse;
  }

  :root:not([data-low-data])::view-transition-new(.nav-tab) {
    animation: 180ms var(--ease-out) 60ms both vt-fade;
  }

  :root:not([data-low-data])::view-transition-old(.nav-forward) {
    animation: 140ms ease-in both vt-fade reverse, 200ms ease-in both vt-slide-out;
  }

  :root:not([data-low-data])::view-transition-new(.nav-forward) {
    animation: 200ms var(--ease-out) 60ms both vt-fade, 200ms var(--ease-out) both vt-slide-in;
  }
}

@keyframes vt-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes vt-slide-out {
  to { transform: translateX(-12px); }
}

@keyframes vt-slide-in {
  from { transform: translateX(12px); }
}

/* And the browser's default group animation (position and size) is off for both too. */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none;
  }
}

:root[data-low-data]::view-transition-group(*),
:root[data-low-data]::view-transition-old(*),
:root[data-low-data]::view-transition-new(*) {
  animation: none;
}

/* --- Press feedback (role views spec 4.5) --- */
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-low-data]) :is(.section-tab, .needs-row, .list-row, .stat-tile-link, .link-segment, .btn) {
    transition: scale 100ms var(--ease-out), opacity 100ms var(--ease-out);
  }

  :root:not([data-low-data]) :is(.section-tab, .needs-row, .list-row, .stat-tile-link, .link-segment, .btn):active {
    scale: 0.98;
    opacity: 0.85;
  }
}
```

Check the header's real class name in `components/header/SiteHeader.tsx` (`site-header` is assumed) and use it. Never put two elements with the same `view-transition-name` on one page: the header and each bar render once per page, so this holds.

No `!important` here: the typed animations are only declared under `prefers-reduced-motion: no-preference` and outside `[data-low-data]`, and the plain `animation: none` rules turn off the browser's default group animation. This keeps the rule in globals.css (lines 280–281) that nothing else uses `!important` on animation properties. `.btn` is in the press-feedback list (spec 4.5 names buttons). Check first that `.btn` has no `scale` or `transition` of its own (`grep -n "^  .btn" app/globals.css`); if it does, leave `.btn` out and note it.

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm vitest run components/kit/PageTransition.test.tsx && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS and the build succeeds.

- [ ] **Step 6: Measure transitions' JS cost** (spec 4.4)

```bash
pnpm e2e tests/e2e/performance.spec.ts --project=phone-390 --reporter=line
```
Expected: every page stays inside 150 KB (150 × 1024 B). Record each page's number against Task 0's baseline in "Changes made during the build". `<ViewTransition>` should add about nothing (it ships inside react-dom); if a page grows by more than 1 KB, find out why and write it down, but transitions stay unless a page would pass the budget.

- [ ] **Step 7: Commit (controller)**

```bash
git add components/kit/PageTransition.tsx components/kit/PageTransition.test.tsx app
git commit -m "feat: page transitions (tabs crossfade, deeper links slide, both off for reduced motion and data saver) and press feedback (role views N1 Task 13)"
```

Before this commit, run `git status` and check that only this task's files are staged under `app/`.

---

### Task 14: "You"

**Files:**
- Modify: `components/tabbar/TabBar.tsx` (`AccountTab`'s label)
- Modify: `components/tabbar/TabBar.test.tsx`
- Check: `tests/e2e/**` for `"Account"` tab lookups

- [ ] **Step 1: Update the test first.** In `components/tabbar/TabBar.test.tsx`, change the expected labels to `["Home", "Shop", "Sell", "Saved", "You"]`, and every `getByRole("link", { name: "Account" })` inside the bar to `name: "You"`.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run components/tabbar`
Expected: FAIL ("Account" found where "You" was expected).

- [ ] **Step 3: Change the label.** In `AccountTab`, `label="Account"` becomes `label="You"`. Update its comment's first word to "You (/account)". The badge stays the new-notifications count until N5 (spec 4.3).

- [ ] **Step 4: Find the e2e lookups**

```bash
grep -rnE '"Account"|\|Account\)' tests/e2e
```
Known hits: `tests/e2e/shell.spec.ts:94` (a `toHaveText([... "Account"])` array of the tab labels), `tests/e2e/responsive.spec.ts:44`, and the regex `/^(Sign in|Your account|Account)$/` in `tests/e2e/accounts.spec.ts:27` and `tests/e2e/helpers/messaging.ts:29` (`accountIcon`, which finds whichever account link is visible and is used widely).
- Change both regexes to `/^(Sign in|Your account|You)$/`, and the same regex in the Supabase end-to-end specs: `tests/e2e-supabase/sign-in.spec.ts:38` and `tests/e2e-supabase/account.spec.ts:13` (`grep -rnE '\|Account\)' tests/e2e-supabase`). These run only against the local Supabase stack (`pnpm e2e:supabase`); if it isn't up, record that they were changed but not run.
- Change each tab-bar label array to "You".
- The header's account link keeps its own name ("Your account"), so leave lookups of it alone.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run components/tabbar && pnpm e2e tests/e2e/shell.spec.ts tests/e2e/accounts.spec.ts tests/e2e/responsive.spec.ts tests/e2e/messaging.spec.ts --project=phone-360 --project=phone-390`
Expected: PASS.

- [ ] **Step 6: Commit (controller)**

```bash
git add components/tabbar tests/e2e
git commit -m "feat: the tab bar's Account is now You (role views N1 Task 14, spec 4.3)"
```

---

### Task 15: The current dashboards wear the new tiles

**Files:**
- Modify: `components/sell/Dashboard.tsx` (lines 73–89)
- Modify: `components/staff/AdminOverview.tsx` (the `staff-counts` list)
- Modify: `components/sell/Dashboard.test.tsx`, `components/staff/AdminOverview.test.tsx`

No new data: the same numbers, in `StatTile`.

- [ ] **Step 1: Run the current tests** so you know what they assert

Run: `pnpm vitest run components/sell/Dashboard.test.tsx components/staff/AdminOverview.test.tsx`
Expected: PASS. Read the assertions on "New enquiries", "Replied within 48 hours" and "Review sellers".

- [ ] **Step 2: Update the tests first.** The words stay the same; only the structure changes. In `Dashboard.test.tsx`, wherever it looks up the numbers as `dt`/`dd` (term and definition roles), look them up as list items of `getByRole("list", { name: "In the last 7 days" })`:

```tsx
    const numbers = screen.getByRole("list", { name: "In the last 7 days" });
    expect(within(numbers).getByText("New enquiries")).toBeInTheDocument();
    expect(within(numbers).getByText("2 of 2")).toBeInTheDocument();
```

In `AdminOverview.test.tsx`, keep the assertions on the "Review sellers" links (they stay as each tile's footer link).

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run components/sell/Dashboard.test.tsx`
Expected: FAIL (no list named "In the last 7 days").

- [ ] **Step 4: Change the markup**

In `Dashboard.tsx`, replace the `<dl className="sell-numbers">…</dl>` with the block below. The reply tile keeps its old words ("2 of 2", "None due yet") as text, not a number, so a "0" never sits beside "None due yet":

```tsx
        <StatRow label="In the last 7 days">
          <StatTile label="New enquiries" value={week.enquiries} />
          <div className="stat-tile">
            <span className="stat-tile-label">Replied within 48 hours</span>
            <span className="stat-tile-value" data-masked="">
              {week.due === 0 ? "None due yet" : `${week.repliedInTime} of ${week.due}`}
            </span>
          </div>
          <StatTile label="Sales confirmed" value={week.salesConfirmed} />
        </StatRow>
```

Import `StatRow` and `StatTile` from `@/components/kit/StatTile`.

In `AdminOverview.tsx`, replace the `<ul className="staff-counts">…</ul>` with:

```tsx
        <StatRow label="Needs attention">
          {items.map((item) => (
            <StatTile
              key={item.id}
              label={item.label}
              value={item.count}
              footer={
                <Link href={item.href} prefetch={false} className="staff-row-action">
                  {item.action}
                </Link>
              }
            />
          ))}
        </StatRow>
```

The `<h2>Needs attention</h2>` above stays. The list's `aria-label` repeats it, which is fine: one names the section, the other the list.

- [ ] **Step 5: Remove the dead CSS.** Delete `.sell-numbers` and its rules (`globals.css` around 8110–8140) and `.staff-counts`, `.staff-count`, `.staff-count-number` and `.staff-count-label` (around 8818–8845), after checking nothing else uses them:

```bash
grep -rn "sell-numbers\|staff-count" components app lib tests
```
Expected: no hits outside `globals.css`. If an e2e test uses one as a selector, change that selector to `.stat-tile` and note it.

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run components/sell components/staff && pnpm e2e tests/e2e/selling.spec.ts tests/e2e/staff.spec.ts --project=phone-390 --project=desktop-1440`
Expected: PASS.

- [ ] **Step 7: Commit (controller)**

```bash
git add components/sell/Dashboard.tsx components/sell/Dashboard.test.tsx components/staff/AdminOverview.tsx components/staff/AdminOverview.test.tsx app/globals.css tests/e2e
git commit -m "refactor: the seller dashboard and the Overview use StatTile, two tile copies removed (role views N1 Task 15)"
```

---

### Task 16: End-to-end checks, gates and screenshots

**Files:**
- Create: `tests/e2e/role-views.spec.ts`, `tests/e2e/role-views-screenshots.spec.ts`

- [ ] **Step 1: Write the spec** `tests/e2e/role-views.spec.ts`

```ts
import { expect, test, type Page } from "@playwright/test";
import { seriousIssues } from "./helpers/axe";
import { main, onlyAt, project, signInAsSample } from "./helpers/messaging";

const phone = () => project().startsWith("phone");
const mainBar = (page: Page) => page.getByRole("navigation", { name: "Main" });
const bar = (page: Page, name: string) => page.getByRole("navigation", { name });

test.describe("section bars (role views spec 4.1)", () => {
  test("the seller's bar replaces the main bar, and CampusCart goes home", async ({ page }) => {
    await signInAsSample(page, "Seller, Tech corner", "/sell");
    const selling = bar(page, "Selling");
    await expect(selling).toBeVisible();
    await expect(selling.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    if (phone()) await expect(mainBar(page)).toBeHidden();
    await selling.getByRole("link", { name: "CampusCart" }).click();
    await expect(page).toHaveURL(/\/$/);
    // The kept /sell page is still in the DOM, hidden (Activity): what matters is that nothing of it shows.
    await expect(bar(page, "Selling")).toBeHidden();
    if (phone()) await expect(mainBar(page)).toBeVisible();
    await expect(page.locator(".footer-giants")).toBeVisible();
  });

  test("a student without a shop keeps the main bar on /sell", async ({ page }) => {
    await signInAsSample(page, "Student, Midrand", "/sell");
    await expect(main(page).getByRole("heading").first()).toBeVisible();
    await expect(bar(page, "Selling")).toHaveCount(0);
    if (phone()) await expect(mainBar(page)).toBeVisible();
  });

  test("the waiting seller's bar has no Messages", async ({ page }) => {
    await signInAsSample(page, "Seller waiting for approval", "/sell");
    await expect(bar(page, "Selling").getByRole("link", { name: "Messages" })).toHaveCount(0);
  });

  test("the admin's bar carries the Overview's counts and More opens the other tools", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin");
    const console_ = bar(page, "Hub console");
    await expect(console_.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    await console_.getByRole("link", { name: "More" }).click();
    await expect(page).toHaveURL(/\/admin\/more$/);
    await expect(main(page).getByRole("list", { name: "More tools" }).getByRole("link")).toHaveCount(7);
  });

  test("a mentor gets the mentoring bar, not the console's", async ({ page }) => {
    await signInAsSample(page, "Mentor", "/mentor");
    await expect(bar(page, "Mentoring")).toBeVisible();
    await page.goto("/admin");
    await expect(bar(page, "Hub console")).toHaveCount(0);
  });

  test("from the tablet step the bar is a sidebar beside the page", async ({ page }) => {
    test.skip(phone(), "Tablet and up");
    await signInAsSample(page, "Admin", "/admin");
    const box = await bar(page, "Hub console").boundingBox();
    const content = await main(page).locator(".section-main").boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(content!.x + 1);
  });

  test("section pages have the slim footer", async ({ page }) => {
    await signInAsSample(page, "Admin", "/admin");
    await expect(page.locator(".footer-giants")).toBeHidden();
    await expect(page.locator(".footer-legal")).toBeVisible();
  });

  test("no serious or critical accessibility issues on the section homes", async ({ page }) => {
    for (const [label, path] of [
      ["Seller, Tech corner", "/sell"],
      ["Admin", "/admin/more"],
      ["Mentor", "/mentor"],
    ] as const) {
      await page.context().clearCookies();
      await signInAsSample(page, label, path);
      expect(await seriousIssues(page), `${label} at ${path}`).toEqual([]);
    }
  });
});

test.describe("motion (role views spec 4.4 and 4.5)", () => {
  // Spec 9: the transition pseudo-elements compute animation-name none, for reduced motion and for data saver.
  // A probe element with the nav-tab class (what a section tab's navigation gives the page) shows which animation a
  // real tab switch would run. The root's own crossfade is always off, so measuring the root would prove nothing.
  async function tabAnimation(page: Page): Promise<string> {
    return page.evaluate(async () => {
      if (!("startViewTransition" in document)) return "unsupported";
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0 auto auto 0;width:10px;height:10px;";
      probe.style.setProperty("view-transition-name", "vt-probe");
      probe.style.setProperty("view-transition-class", "nav-tab");
      document.body.append(probe);
      const transition = document.startViewTransition(() => {});
      await transition.ready;
      const name = getComputedStyle(document.documentElement, "::view-transition-new(vt-probe)").animationName;
      await transition.finished;
      probe.remove();
      return name;
    });
  }

  test("a tab switch animates when motion is allowed (the control)", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Admin", "/admin");
    expect(await tabAnimation(page)).toBe("vt-fade");
  });

  test("view transitions are off for reduced motion", async ({ page }) => {
    onlyAt("phone-390");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInAsSample(page, "Admin", "/admin");
    expect(await tabAnimation(page)).toBe("none");
    const tab = bar(page, "Hub console").getByRole("link", { name: "Reports" });
    expect(await tab.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  });

  test("view transitions are off with data saver", async ({ page }) => {
    onlyAt("phone-390");
    await signInAsSample(page, "Admin", "/admin");
    await page.evaluate(() => document.documentElement.setAttribute("data-low-data", ""));
    expect(await tabAnimation(page)).toBe("none");
  });
});
```

Check `onlyAt`'s real behaviour in `tests/e2e/helpers/messaging.ts:9` (it calls `test.skip` for other projects); adjust if it returns a boolean instead.

- [ ] **Step 2: Add the layout-shift check.** Read how `tests/e2e/cls.spec.ts` measures (fonts held back, at 390 and 1440). Add one test there, in its existing style, for `/admin`, `/mentor` and `/sell` (as "Seller, Tech corner"), signed in, at 390 and 1440, with the same 0.05 limit. If the 1440 admin page fails because the sidebar column arrives late, apply Task 11 Step 6's `data-bar` fix and rerun.

- [ ] **Step 3: The screenshots spec** `tests/e2e/role-views-screenshots.spec.ts`

```ts
import { test } from "@playwright/test";
import { signInAsSample } from "./helpers/messaging";

test.skip(!process.env.SCREENSHOTS, "Only with SCREENSHOTS=1");

const SHOTS = [
  ["seller-overview", "Seller, Tech corner", "/sell"],
  ["seller-listings", "Seller, Tech corner", "/sell/listings"],
  ["admin-today", "Admin", "/admin"],
  ["admin-more", "Admin", "/admin/more"],
  ["mentor-shops", "Mentor", "/mentor"],
] as const;

for (const [name, label, path] of SHOTS) {
  test(`role views N1: ${name}`, async ({ page }) => {
    const width = test.info().project.name.split("-").pop();
    test.skip(!["390", "1440"].includes(width!), "390 and 1440 only");
    await signInAsSample(page, label, path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `docs/progress/role-views/n1-${width}-${name}.png`, fullPage: true });
  });
}
```

- [ ] **Step 4: Run everything**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: clean, and every unit test passes. Write the count down.

```bash
pnpm build && pnpm e2e tests/e2e/role-views.spec.ts tests/e2e/cls.spec.ts tests/e2e/performance.spec.ts tests/e2e/shell.spec.ts tests/e2e/a11y.spec.ts tests/e2e/staff.spec.ts tests/e2e/selling.spec.ts tests/e2e/accounts.spec.ts --reporter=line
```
Expected: all pass at 360, 390, 768, 1024 and 1440.

- [ ] **Step 5: The JS gate**

Compare every page's `scriptBrotli` from the performance run with Task 0's baseline. **Every page must stay inside 150 KB**, and each change is recorded in "Changes made during the build". A page that grows by more than 1 KB needs a one-line reason. The usual surprises are a kit file imported from a client component, or a new client import pulling a large module; fix those, because the kit is meant to be server-only.

Then run:

```bash
grep -rln "use client" components/kit components/charts
```
Expected: no output.

```bash
grep -l "serviceWorker.register" .next/static/chunks/*.js
```
Expected: no output (CLAUDE.md).

```bash
grep -rn "newContext(" tests/e2e | grep -v serviceWorkers
```
Expected: no output.

- [ ] **Step 6: Take the screenshots**

```bash
SCREENSHOTS=1 pnpm e2e tests/e2e/role-views-screenshots.spec.ts --project=phone-390 --project=desktop-1440
```
Expected: 10 PNGs in `docs/progress/role-views/`.

- [ ] **Step 7: Commit (controller)**

```bash
git add tests/e2e/role-views.spec.ts tests/e2e/role-views-screenshots.spec.ts tests/e2e/cls.spec.ts docs/progress/role-views
git commit -m "test: role views N1 end to end (bars, sidebar, slim footer, axe, motion off, layout shift) and screenshots"
```

---

### Task 17: Docs

**Files:**
- Modify: `CLAUDE.md` (Code rules), `docs/reference/LANDING-DECISIONS.md` (a new row), `docs/PROGRESS.md` (a new section), and this plan's "Changes made during the build"

- [ ] **Step 1: CLAUDE.md.** Add three bullets to "Code rules", after the staff pages' bullets:

```markdown
- Sections have their own bottom bar (role views spec 4.1): `app/sell/layout.tsx`, `app/admin/layout.tsx` and `app/mentor/layout.tsx` render `SellBar`, `AdminBar` or `MentorBar` (`components/kit/sections.tsx`) inside `<Suspense fallback={null}>`, each returning null for anyone the section isn't for. CSS hides the main tab bar and the footer's marketing blocks with `body:has(.section-shell:not([style*="display"]) > .section-bar)` (never a bare `body:has(.section-bar)`: Next keeps left pages in the page, hidden); from the tablet step the bar is a sidebar. A bar's badge comes from the same reader as the list it opens, and a failed count shows no badge.
- The role views kit (`components/kit`, `components/charts`) is Server Components only; chart files `import "server-only"`. Charts sit in a `<figure>` named by a one-sentence takeaway with a "Show the numbers" table, bars start at 0, missing values are gaps, a masked count (`protectCounts`) is a hatched "Hidden" or "Under 5" and never 0, and fewer than 2 points or a largest of 3 or under is written as text. Data marks are navy or sky-dark, never sky.
- Page transitions: section pages and `/account` wrap their content in `PageTransition` (outside the page's `<Suspense>`). Section tabs pass `transitionTypes={["nav-tab"]}`, links one level deeper `["nav-forward"]`; nothing else animates. Both are off for reduced motion and data saver. Never give two elements one `view-transition-name`.
```

- [ ] **Step 2: The decisions log.** Add row 84 (check the last number first; 83 is the rename):

```markdown
| 84 | 2026-10-22 | How does each role get a focused home? | **Workspaces** (role views spec): one account, the buyer app by default; `/sell`, `/admin` and `/mentor` swap in their own bottom bar (a sidebar from the tablet step); "You" replaces Account; a server-only kit of tiles, Needs-you queues and five charts; built as N1 (kit) to N5 (buyer). Lama, 2026-10-22. |
```

Match the table's real column layout. Read its header first.

- [ ] **Step 3: PROGRESS.md.** Add "## 2026-10-2X: Role views N1 built (the kit)" before "## Next", in the style of the stage sections above it:
- what's built;
- where the build differed from the plan;
- checks, with the unit count, the e2e counts and the JS bytes against the baseline;
- the open points for Lama: the plan decisions 1–6, the warning thresholds, the sample words, and the screenshots to review.

Update "## Next" with "N2, the seller home, can be planned".

- [ ] **Step 4: Fill in "Changes made during the build"** below, one bullet per departure, each with its commit.

- [ ] **Step 5: Commit (controller), with Lama's go-ahead**

```bash
git add CLAUDE.md docs/reference/LANDING-DECISIONS.md docs/PROGRESS.md docs/superpowers/plans/2026-10-22-role-views-n1-kit.md
git commit -m "docs: role views N1 built: CLAUDE.md rules for section bars, the kit and page transitions; decision 84; progress"
```

Stage only these lines if other sessions have uncommitted lines in PROGRESS or the decisions log (project memory: stage only your own files; use `git add -p` there, never `git add .`).

---

## Changes made during the build

- **Baseline (Task 0):** _to be filled in by the implementer: each page's `scriptBrotli`._
