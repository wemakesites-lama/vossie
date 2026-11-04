import type { Metadata } from "next";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { RequestForm } from "@/components/looking-for/RequestForm";
import { RequestFormSkeleton } from "@/components/looking-for/RequestFormSkeleton";

/** One person's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Post a request", robots: { index: false } };

/**
 * Post a request (community actions spec 2.3). It needs the session, so it renders per request inside <Suspense>.
 * `?title=` starts the title (stage D planning decision 3), read inside the same boundary.
 */
export default function NewRequestPage({ searchParams }: PageProps<"/looking-for/new">) {
  return (
    <PageTransition>
      <div className="page request-form-page">
        <Reveal fallback={<RequestFormSkeleton />}>
          <RequestForm requestId={null} searchParams={searchParams} />
        </Reveal>
      </div>
    </PageTransition>
  );
}
