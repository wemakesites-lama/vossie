"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type NavLinkProps = {
  href: string;
  className?: string;
  /** "section" also marks the pages under href (aria-current="true"), as a tab bar's tab does. */
  match?: "page" | "section";
  prefetch?: false;
  /** The id of something that describes the link, such as a badge. */
  describedBy?: string;
  children: ReactNode;
};

/**
 * A link that marks itself aria-current="page" on its own page.
 * usePathname() suspends while Next builds App Shells for routes with unknown params, so the
 * read stays inside this boundary and the plain link is the fallback.
 */
export function NavLink(props: NavLinkProps) {
  const { href, className, prefetch, describedBy, children } = props;
  return (
    <Suspense
      fallback={
        <Link href={href} prefetch={prefetch} aria-describedby={describedBy} className={className}>
          {children}
        </Link>
      }
    >
      <CurrentAwareLink {...props} />
    </Suspense>
  );
}

function CurrentAwareLink({ href, className, match, prefetch, describedBy, children }: NavLinkProps) {
  const pathname = usePathname();
  const current =
    pathname === href ? "page" : match === "section" && pathname.startsWith(`${href}/`) ? "true" : undefined;
  return (
    <Link href={href} prefetch={prefetch} aria-current={current} aria-describedby={describedBy} className={className}>
      {children}
    </Link>
  );
}
