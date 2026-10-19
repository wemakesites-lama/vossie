import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth/session";
import { PostRequestLinkView } from "./PostRequestLinkView";

/**
 * Post a request once the session is read (community actions plan, Task 16): the form's own address when signed in,
 * the sign-in link otherwise. An async Server Component: PostRequestLink puts it inside <Suspense>. A failed session
 * read gives the sign-in link, which still works: the sign-in page says who's signed in.
 */
export async function ViewerPostRequestLink({ className, children }: { className?: string; children: ReactNode }) {
  const account = await getViewer().catch(() => null);
  return (
    <PostRequestLinkView signedIn={account !== null} className={className}>
      {children}
    </PostRequestLinkView>
  );
}
