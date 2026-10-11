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
