import Link from "next/link";
import { messageHrefFor, reportHrefFor } from "@/lib/messaging/links";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";
import type { LinkProps } from "./SessionLinks";

// The session's part of Message seller and Report (messaging plan decision 3). Async Server Components: they read the
// session, so SessionLinks.tsx puts each inside <Suspense>. A failed lookup gives the signed-out link, which still
// works: the sign-in page says who's signed in.

export async function ViewerMessageLink({ target, className, children }: LinkProps<MessageTarget>) {
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
