import { Suspense, ViewTransition, type ReactNode } from "react";

/**
 * A page's main Suspense boundary, whose outline fades out as the content fades in (calm navigation spec 4, layer 2).
 * default="none" on both, so neither animates on anything else. The fallback's root must be an element: a
 * ViewTransition only fires enter and exit when it comes before any DOM node. Not for small inline boundaries or the
 * home sections, which have their own scroll reveals (plan decision 2).
 */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="reveal-out" default="none">
          {fallback}
        </ViewTransition>
      }
    >
      <ViewTransition enter="reveal-in" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
