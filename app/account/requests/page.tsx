import type { Metadata } from "next";
import { Suspense } from "react";
import { YourRequests, YourRequestsSkeleton } from "@/components/looking-for/YourRequests";

/** One person's list, so search engines leave it out (`/account` is in robots.txt too). */
export const metadata: Metadata = { title: "Your requests", robots: { index: false } };

/** Your requests (community actions spec 2.13). It needs the session, so it renders per request inside <Suspense>. */
export default function YourRequestsPage() {
  return (
    <div className="page requests-page">
      <Suspense fallback={<YourRequestsSkeleton />}>
        <YourRequests />
      </Suspense>
    </div>
  );
}
