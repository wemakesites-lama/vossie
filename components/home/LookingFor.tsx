import Link from "next/link";
import { Suspense } from "react";
import { LookingForRequests, RequestsSkeleton } from "./LookingForRequests";
import { SectionHeader } from "./SectionHeader";

/** The Looking For band (spec 7.11). Only the open requests depend on the campus, so only they stream in. */
export function LookingFor() {
  return (
    <section id="looking-for" aria-labelledby="looking-for-title" className="home-panel looking-for">
      <div className="looking-for-intro">
        <SectionHeader id="looking-for" eyebrow="Looking For" title="Can’t find it? Ask for it." tone="navy" />
        <p className="looking-for-copy">Post what you need and sellers on your campus come to you with offers.</p>
      </div>
      <div className="looking-for-requests">
        <Suspense fallback={<RequestsSkeleton />}>
          <LookingForRequests />
        </Suspense>
      </div>
      <Link href="/looking-for" className="btn btn-primary looking-for-action">
        Post a request
      </Link>
    </section>
  );
}
