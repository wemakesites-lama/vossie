import { Suspense } from "react";
import { FollowSignedOut } from "./FollowViews";
import { ViewerFollow } from "./ViewerFollow";

/**
 * Follow in the storefront's band (community actions spec 2.16, plan decision 16): a box that's always there, 44px
 * high, holding the session's part in its own <Suspense> with the signed-out link as the fallback, so the storefront
 * keeps its prerendered shell and nothing moves when it streams in. No client bytes. The versions are in
 * FollowViews.tsx.
 */
export function FollowControl({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="seller-follow">
      <Suspense fallback={<FollowSignedOut slug={slug} name={name} />}>
        <ViewerFollow slug={slug} name={name} />
      </Suspense>
    </div>
  );
}
