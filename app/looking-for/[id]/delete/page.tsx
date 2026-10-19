import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteRequest, DeleteRequestSkeleton } from "@/components/looking-for/DeleteRequest";

/** One person's page, so search engines leave it out (plan decision 23). */
export const metadata: Metadata = { title: "Delete your request", robots: { index: false } };

/** One sample id (plan decision 24): the sample has no asker, so it's the 404; other ids render on first request. */
export function generateStaticParams() {
  return [{ id: "r-001" }];
}

/** Delete request's confirm page (community actions spec 2.6). It needs the session, so it renders inside <Suspense>. */
export default function DeleteRequestPage({ params }: PageProps<"/looking-for/[id]/delete">) {
  return (
    <div className="page request-form-page">
      <Suspense fallback={<DeleteRequestSkeleton />}>
        <DeleteForVisitor params={params} />
      </Suspense>
    </div>
  );
}

async function DeleteForVisitor({ params }: Pick<PageProps<"/looking-for/[id]/delete">, "params">) {
  const { id } = await params;
  return <DeleteRequest requestId={id} />;
}
