import { ViewTransition, type ReactNode } from "react";

// Calm navigation spec 4, layer 3; types in lib/motion.ts: tabs carry "nav-tab" (a crossfade), links one level deeper
// "nav-forward" (a short slide), "Back to…" links "nav-back" (the slide mirrored). A page change with no type crossfades
// too: Next 16.4 sometimes commits a link's navigation without its types (seen on listing cards and request rows, never
// on Hub post cards; plan Task 6), and a redirect to another page has none. Browser Back never animates (React skips
// popstate). Only a page's mount and unmount animate here; Suspense reveals fade through Reveal.
const BY_TYPE = { "nav-tab": "nav-tab", "nav-forward": "nav-forward", "nav-back": "nav-back", default: "nav-tab" } as const;

/** Wraps a page's content (every page, a test checks). Goes in the page, never a layout: layouts don't remount. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={BY_TYPE} exit={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  );
}
