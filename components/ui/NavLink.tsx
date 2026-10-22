"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

type NavLinkProps = ComponentProps<typeof Link> & {
  href: string;
  /** "section" also marks the pages under href (aria-current="true"), as a tab bar's tab does. */
  match?: "page" | "section";
  /**
   * Other paths whose pages also mark this link current (aria-current="true"): the admin bar's More on the pages it
   * holds (role views N3 plan decision 8).
   */
  also?: readonly string[];
};

/**
 * A link that marks itself aria-current="page" on its own page. Everything else it's given goes to the link as it is
 * (props are passed through rather than named one by one: this file is in every page's layout chunk).
 * usePathname() suspends while Next builds App Shells for routes with unknown params, so the
 * read stays inside this boundary and the plain link is the fallback.
 */
export function NavLink({ match, also, ...props }: NavLinkProps) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <CurrentAwareLink match={match} also={also} {...props} />
    </Suspense>
  );
}

function CurrentAwareLink({ match, also, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const { href } = props;
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const section = (match === "section" && pathname.startsWith(`${href}/`)) || (also?.some(under) ?? false);
  const current = pathname === href ? "page" : section ? "true" : undefined;
  return <Link {...props} aria-current={current} />;
}
