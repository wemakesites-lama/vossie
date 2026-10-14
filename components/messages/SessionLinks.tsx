import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";
import { ViewerMessageLink, ViewerReportLink } from "./ViewerLinks";

// Message seller and Report on the listing page, the storefront and the request page (messaging spec 3.6, plan
// decision 3). The static shell has the signed-out link (through sign-in, then on to the composer or the form, spec
// 2.1); the session's link streams in, with the same words and look, so nothing moves. Server Components and a Link,
// with no prefetch: no client bytes.

type LinkProps<Target> = { target: Target; className?: string; children: ReactNode };

export function MessageSellerLink({ target, className, children }: LinkProps<MessageTarget>) {
  const signedOut = (
    <Link href={signInHref(composerPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  );
  return (
    <Suspense fallback={signedOut}>
      <ViewerMessageLink target={target} className={className}>
        {children}
      </ViewerMessageLink>
    </Suspense>
  );
}

export function ReportLink({ target, className, children }: LinkProps<ReportTarget>) {
  const signedOut = (
    <Link href={signInHref(reportPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  );
  return (
    <Suspense fallback={signedOut}>
      <ViewerReportLink target={target} className={className}>
        {children}
      </ViewerReportLink>
    </Suspense>
  );
}
