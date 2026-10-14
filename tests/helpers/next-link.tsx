import type { ReactNode } from "react";

/**
 * Stands in for next/link in a component test that checks `prefetch`. next/link draws a plain <a> in jsdom and keeps
 * `prefetch` to itself, so this one shows it as data-prefetch: "auto" when the link says nothing (Next's default) and
 * otherwise the value it was given. A plain <a href> (Refresh, plan decision 19) has no data-prefetch at all. In a test
 * file:
 *
 *   vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);
 */
export const nextLinkShowingPrefetch = {
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={href} data-prefetch={prefetch === undefined ? "auto" : String(prefetch)} {...rest}>
      {children}
    </a>
  ),
};

/** The links in `container` that would prefetch: Next's default (the attribute says "auto") or `true`. */
export function prefetchingLinks(container: HTMLElement): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>("a[data-prefetch]")].filter(
    (link) => link.dataset.prefetch !== "false",
  );
}
