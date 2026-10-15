import Link from "next/link";
import type { ReactNode } from "react";
import { messageHrefFor, reportHrefFor } from "@/lib/messaging/links";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import { ownerLinkFor } from "@/lib/selling/links";
import type { ReportTarget } from "@/lib/types";

// The session's part of Message seller and Report (messaging plan decision 3). Async Server Components: they read the
// session, so SessionLinks.tsx puts each inside <Suspense>. A failed lookup gives the signed-out link, which still
// works: the sign-in page says who's signed in. Its owner gets Edit listing or Edit shop instead (selling plan decision
// 19), and Edit shop in a paused shop's banner's place too (amendment 16).

type LinkProps<Target> = { target: Target; className?: string; children: ReactNode };

export async function ViewerMessageLink({ target, className, children }: LinkProps<MessageTarget>) {
  // The owner gets Edit listing or Edit shop instead, with the same look (selling spec 2.12, plan decision 19). A
  // failed lookup gives the usual link.
  const owner = await ownerLinkFor(target).catch(() => null);
  if (owner) {
    return (
      <Link href={owner.href} prefetch={false} className={className}>
        {owner.label}
      </Link>
    );
  }
  const href = await messageHrefFor(target).catch(() => signInHref(composerPath(target)));
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

export async function ViewerReportLink({ target, className, children }: LinkProps<ReportTarget>) {
  const href = await reportHrefFor(target).catch(() => signInHref(reportPath(target)));
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

/**
 * A paused shop's storefront has "Not taking orders right now" in Message's place (selling plan amendment 10), and its
 * owner still gets Edit shop there (selling spec 2.12), with the Message pill's look. `children` is the banner, which is
 * also SellerHero's fallback; both are 48px tall, so nothing moves when this streams in. A failed lookup keeps it.
 */
export async function PausedOwnerOrBanner({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: ReactNode;
}) {
  const owner = await ownerLinkFor({ kind: "shop", sellerSlug: slug }).catch(() => null);
  if (!owner) return children;
  return (
    <Link href={owner.href} prefetch={false} className={className}>
      {owner.label}
    </Link>
  );
}
