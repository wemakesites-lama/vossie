"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

type NavLinkProps = ComponentProps<typeof Link> & {
  href: string;
  /** "section" also marks the pages under href (aria-current="true"), as a tab bar's tab does. */
  match?: "page" | "section";
};

/**
 * A link that marks itself aria-current="page" on its own page. Everything else it's given goes to the link as it is
 * (props are passed through rather than named one by one: this file is in every page's layout chunk).
 * usePathname() suspends while Next builds App Shells for routes with unknown params, so the
 * read stays inside this boundary and the plain link is the fallback.
 */
export function NavLink({ match, ...props }: NavLinkProps) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <CurrentAwareLink match={match} {...props} />
    </Suspense>
  );
}

function CurrentAwareLink({ match, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const { href } = props;
  const current =
    pathname === href ? "page" : match === "section" && pathname.startsWith(`${href}/`) ? "true" : undefined;
  return <Link {...props} aria-current={current} />;
}
