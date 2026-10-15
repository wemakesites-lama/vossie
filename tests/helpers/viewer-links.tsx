import Link from "next/link";
import type { ReactNode } from "react";
import { composerPath, reportPath, type MessageTarget } from "@/lib/messaging/paths";
import { signInHref } from "@/lib/next-path";
import type { ReportTarget } from "@/lib/types";

type LinkProps<Target> = { target: Target; className?: string; children: ReactNode };

/**
 * Stands in for components/messages/ViewerLinks.tsx in component tests (messaging plan, Task 7). The real links are
 * async Server Components, which jsdom can't render inside a tree; these render the signed-out links, which are what a
 * signed-out visitor gets, and a paused shop's banner (selling plan amendment 16). In a test file:
 *
 *   vi.mock("@/components/messages/ViewerLinks", async () => (await import("@/tests/helpers/viewer-links")).signedOutViewerLinks);
 */
export const signedOutViewerLinks = {
  ViewerMessageLink: ({ target, className, children }: LinkProps<MessageTarget>) => (
    <Link href={signInHref(composerPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  ),
  ViewerReportLink: ({ target, className, children }: LinkProps<ReportTarget>) => (
    <Link href={signInHref(reportPath(target))} prefetch={false} className={className}>
      {children}
    </Link>
  ),
  PausedOwnerOrBanner: ({ children }: { slug: string; className?: string; children: ReactNode }) => children,
};
