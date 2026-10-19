import { Suspense, type ReactNode } from "react";
import { PostRequestLinkView } from "./PostRequestLinkView";
import { ViewerPostRequestLink } from "./ViewerPostRequestLink";

type PostRequestLinkProps = { className?: string; children: ReactNode };

/**
 * Post a request on the board and the homepage's band (community actions spec section 3): the session's part in its
 * own <Suspense>, with the sign-in link as the fallback, so both pages keep their prerendered shells. Server Components
 * and a Link with no prefetch: no client bytes. The fallback and the session's link are the same element with the
 * same classes and words, so nothing moves when the session's part streams in. The two versions are in
 * PostRequestLinkView.tsx.
 */
export function PostRequestLink({ className, children }: PostRequestLinkProps) {
  return (
    <Suspense
      fallback={
        <PostRequestLinkView signedIn={false} className={className}>
          {children}
        </PostRequestLinkView>
      }
    >
      <ViewerPostRequestLink className={className}>{children}</ViewerPostRequestLink>
    </Suspense>
  );
}
