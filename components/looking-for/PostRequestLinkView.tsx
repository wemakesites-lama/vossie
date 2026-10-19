import Link from "next/link";
import type { ReactNode } from "react";
import { NEW_REQUEST_PATH } from "@/lib/looking-for/paths";
import { signInHref } from "@/lib/next-path";

// The two versions of Post a request (community actions plan, Task 16). A pure view with no session: PostRequestLink
// (the <Suspense>) and ViewerPostRequestLink (the session's part) both use it, so neither imports the other.

type PostRequestLinkViewProps = { signedIn: boolean; className?: string; children: ReactNode };

/**
 * Post a request (community actions spec section 3). Signed out, it goes through sign-in and comes back to the form;
 * signed in, it opens the form. A signed-out visitor is never linked straight at the form: the form redirects them to
 * sign-in, and the browser would keep that redirect and replay it after they sign in, leaving them on the sign-in
 * page. Only the address differs between the two, so the link's box is the same and nothing moves.
 */
export function PostRequestLinkView({ signedIn, className, children }: PostRequestLinkViewProps) {
  return (
    <Link href={signedIn ? NEW_REQUEST_PATH : signInHref(NEW_REQUEST_PATH)} prefetch={false} className={className}>
      {children}
    </Link>
  );
}
