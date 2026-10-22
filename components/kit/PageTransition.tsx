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
