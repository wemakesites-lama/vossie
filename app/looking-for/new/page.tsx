import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestForm } from "@/components/looking-for/RequestForm";
import { RequestFormSkeleton } from "@/components/looking-for/RequestFormSkeleton";

/** One person's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Post a request", robots: { index: false } };

/** Post a request (community actions spec 2.3). It needs the session, so it renders per request inside <Suspense>. */
export default function NewRequestPage() {
  return (
    <div className="page request-form-page">
      <Suspense fallback={<RequestFormSkeleton />}>
        <RequestForm requestId={null} />
      </Suspense>
    </div>
  );
}
