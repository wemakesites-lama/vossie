import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestForm } from "@/components/looking-for/RequestForm";
import { RequestFormSkeleton } from "@/components/looking-for/RequestFormSkeleton";

/** One person's form, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Edit your request", robots: { index: false } };

/**
 * One sample id, so the build checks the page keeps its request-time parts inside <Suspense> (plan decision 24). The
 * sample has no asker, so it's the 404 for everyone; every other id renders on its first request.
 */
export function generateStaticParams() {
  return [{ id: "r-001" }];
}

/** Edit your request (community actions spec 2.6). Everything needs the session, so it renders inside <Suspense>. */
export default function EditRequestPage({ params }: PageProps<"/looking-for/[id]/edit">) {
  return (
    <div className="page request-form-page">
      <Suspense fallback={<RequestFormSkeleton />}>
        <EditForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function EditForVisitor({ params }: Pick<PageProps<"/looking-for/[id]/edit">, "params">) {
  const { id } = await params;
  return <RequestForm requestId={id} />;
}
