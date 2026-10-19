import type { ReactNode } from "react";
import { PostRequestLinkView } from "@/components/looking-for/PostRequestLinkView";

/**
 * Stands in for components/looking-for/ViewerPostRequestLink.tsx in component tests (community actions plan, Task 16).
 * The real one is an async Server Component, which jsdom can't render inside a tree; this renders the link for the
 * session `signedIn` says. It imports PostRequestLinkView, not PostRequestLink: PostRequestLink imports the mocked slot,
 * which would wait on this very factory and never finish. In a test file:
 *
 *   vi.mock("@/components/looking-for/ViewerPostRequestLink", async () => (await import("@/tests/helpers/viewer-post-request")).signedOutViewerPostRequestLink);
 *
 * or, for a test that also needs the signed-in link, with a hoisted flag:
 *
 *   const viewer = vi.hoisted(() => ({ signedIn: false }));
 *   vi.mock("@/components/looking-for/ViewerPostRequestLink", async () =>
 *     (await import("@/tests/helpers/viewer-post-request")).viewerPostRequestLink(() => viewer.signedIn));
 */
export function viewerPostRequestLink(signedIn: () => boolean) {
  return {
    ViewerPostRequestLink: ({ className, children }: { className?: string; children: ReactNode }) => (
      <PostRequestLinkView signedIn={signedIn()} className={className}>
        {children}
      </PostRequestLinkView>
    ),
  };
}

export const signedOutViewerPostRequestLink = viewerPostRequestLink(() => false);
