import Link from "next/link";
import { Suspense } from "react";
import { PostRequestLink } from "@/components/looking-for/PostRequestLink";
import { aiFeatureOn } from "@/lib/ai/config";
import { LookingForRequests, RequestsSkeleton } from "./LookingForRequests";
import { SectionHeader } from "./SectionHeader";

/** The Looking For band (spec 7.11). Only the open requests depend on the campus, so only they stream in. */
export function LookingFor() {
  return (
    <section id="looking-for" aria-labelledby="looking-for-title" className="home-panel looking-for">
      <div className="looking-for-intro">
        <SectionHeader id="looking-for" eyebrow="Looking For" title="Can’t find it? Ask for it." tone="sky" />
        <p className="looking-for-copy">Post what you need and sellers on your campus come to you with offers.</p>
        {/* Inside the intro, so the tab order matches the layout: the button sits under the copy at every size. */}
        {/* Follows the session in its own <Suspense>, with no prefetch: the homepage is prefetched from every page (decision 53). */}
        <PostRequestLink className="btn btn-primary looking-for-action">Post a request</PostRequestLink>
        {/* Starter pack (AI round two spec section 6). No prefetch: the homepage is prefetched from every page. */}
        {aiFeatureOn("starter-pack") && (
          <p className="looking-for-starter">
            <Link href="/browse/starter" prefetch={false}>
              New on campus? Get a starter pack
            </Link>
          </p>
        )}
      </div>
      <div className="looking-for-requests">
        <Suspense fallback={<RequestsSkeleton />}>
          <LookingForRequests />
        </Suspense>
      </div>
    </section>
  );
}
